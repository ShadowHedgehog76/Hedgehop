// player.js
// TODO: Migrer vers expo-audio (expo-av deprecated in SDK 54)
// import { AudioPlayer } from 'expo-audio';
import { Audio } from 'expo-av';
import { EventEmitter } from 'fbemitter';
import statsService from '../services/StatsService';

export const playerEmitter = new EventEmitter();

let currentSound = null;
let currentTrack = null;
let isPlaying = false;
let playbackStatus = { positionMillis: 0, durationMillis: 1 };

// Variables pour le tracking des statistiques
let trackStartTime = null;
let currentPlayingTrack = null;

// CrossParty désactivé définitivement
let crossPartyRoomId = null;
let crossPartyUserId = null;
let isProcessingCrossPartyUpdate = false;
let lastProcessedStateId = null;
let lastLocalActionTime = 0;
let lastCrossPartyActionTime = 0;
let crossPartyIgnoreTimeout = null;

// Stub: CrossParty complètement désactivé
let crossPartyService = null;
const initCrossParty = async () => null;

// Fonction pour synchroniser l'état avec CrossParty
async function syncWithCrossParty(action, additionalData = {}) {
  // CrossParty supprimé → no-op
  return;
}

// --- Fonction pour enregistrer une écoute ---
async function recordPlay(track, startTime) {
  if (!track || !startTime) {
    console.log('🚫 Pas d\'enregistrement: track ou startTime manquant');
    return;
  }
  
  const playDuration = Date.now() - startTime;
  console.log(`🎵 Tentative d'enregistrement: ${track.title} - Durée: ${Math.floor(playDuration/1000)}s`);
  
  // Enregistrer seulement si la piste a été écoutée pendant au moins 30 secondes
  if (playDuration >= 30000) {
    try {
      await statsService.recordPlay(
        track.albumTitle || track.album || 'Album Inconnu',
        track.title || 'Piste Inconnue',
        track.category || 'Non Classé',
        playDuration
      );
      console.log(`✅ Écoute enregistrée: ${track.title} (${Math.floor(playDuration/1000)}s)`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de l\'écoute:', error);
    }
  } else {
    console.log(`⏭️ Écoute trop courte ignorée: ${track.title} (${Math.floor(playDuration/1000)}s)`);
  }
}

// --- Liste de toutes les pistes disponibles ---
let globalTracks = [];
let currentIndex = -1; // nouvel index de la queue

// 🔹 Définir la liste globale des pistes
export function setGlobalTracks(list) {
  if (Array.isArray(list)) {
    globalTracks = list.filter((t) => t?.url); // on garde que les valides
    currentIndex = 0;
    console.log('🎵 File de lecture définie :', globalTracks.length, 'pistes');
  }
}

// --- Lecture d'une piste spécifique ---
export async function playTrack(track, index = null) {
  try {
    if (!track?.url) {
      console.warn('❌ Aucune URL pour cette piste :', track);
      return;
    }
    
    console.log(`🎵 PlayTrack appelé: ${track.title}`);

    // Stopper la piste précédente
    if (currentSound) {
      await currentSound.unloadAsync();
      currentSound = null;
    }

    // Trouver l’index si pas fourni
    if (index !== null) {
      currentIndex = index;
    } else {
      currentIndex = globalTracks.findIndex((t) => t.url === track.url);
    }

    // Créer et lire la nouvelle piste
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.url },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    // Enregistrer l'écoute précédente si une piste différente était en cours
    if (currentPlayingTrack && trackStartTime && currentPlayingTrack.url !== track.url) {
      await recordPlay(currentPlayingTrack, trackStartTime);
    }

    currentSound = sound;
    currentTrack = track;
    isPlaying = true;

    // Commencer le tracking de la nouvelle piste
    currentPlayingTrack = track;
    trackStartTime = Date.now();

    console.log(`▶️ Lecture : ${track.title} (index ${currentIndex})`);
    playerEmitter.emit('play', { track, index: currentIndex });
    
    // Synchroniser avec CrossParty si activé (sauf si on traite déjà une update CrossParty)
    if (isInCrossPartyMode() && !isProcessingCrossPartyUpdate) {
      if (crossPartyUserId?.includes('client')) {
        console.log('🚀 CLIENT: Force sync PLAY_TRACK immédiate');
        await forceClientSync('PLAY_TRACK');
      } else {
        console.log('🔄 Play locale → Synchronisation CrossParty');
        await syncWithCrossParty('PLAY_TRACK');
      }
    }
  } catch (err) {
    console.error('Erreur lecture:', err);
  }
}

// --- Lecture de la piste suivante ---
export async function playNext() {
  if (!globalTracks.length) return;

  const nextIndex = currentIndex + 1;
  if (nextIndex >= globalTracks.length) {
    console.log('⏹️ Fin de la queue.');
    await stopTrack();
    return;
  }

  const nextTrack = globalTracks[nextIndex];
  await playTrack(nextTrack, nextIndex);
}

// --- Lecture de la piste précédente ---
export async function playPrevious() {
  if (!globalTracks.length) return;

  const prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    console.log('⏮️ Début de la queue.');
    return;
  }

  const prevTrack = globalTracks[prevIndex];
  await playTrack(prevTrack, prevIndex);
}

// --- Pause ---
export async function pauseTrack() {
  if (!currentSound) {
    console.warn('⚠️ Pause: Aucun son chargé');
    return;
  }
  

  
  try {
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Pause: Son pas chargé');
      return;
    }
    
    if ((status.isPlaying || isPlaying)) {
      // Sauvegarder la position actuelle avant de faire la pause
      const currentPos = status.positionMillis || 0;
      playbackStatus = { ...playbackStatus, positionMillis: currentPos };
      
      await currentSound.pauseAsync();
      isPlaying = false;
      playerEmitter.emit('pause', { track: currentTrack, position: currentPos });
      
      console.log(`⏸️ Pause à ${currentPos}ms`);
      
      // Synchroniser avec CrossParty si activé (sauf si on traite déjà une update CrossParty)
      if (isInCrossPartyMode() && !isProcessingCrossPartyUpdate) {
        if (crossPartyUserId?.includes('client')) {
          console.log('🚀 CLIENT: Force sync PAUSE immédiate');
          await forceClientSync('PAUSE');
        } else {
          console.log('🔄 Pause locale → Synchronisation CrossParty');
          await syncWithCrossParty('PAUSE');
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur pause:', error);
  }
}

// --- Reprise ---
export async function resumeTrack() {
  if (!currentSound) {
    console.warn('⚠️ Resume: Aucun son chargé');
    return;
  }
  

  
  try {
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Resume: Son pas chargé');
      return;
    }
    
    if (!status.isPlaying && !isPlaying) {
      // Utiliser la position sauvegardée si disponible
      const savedPosition = playbackStatus.positionMillis || 0;
      if (savedPosition > 0) {
        await currentSound.setPositionAsync(savedPosition);
        console.log(`▶️ Resume à la position sauvegardée: ${savedPosition}ms`);
      }
      
      await currentSound.playAsync();
      isPlaying = true;
      playerEmitter.emit('resume', { track: currentTrack, position: savedPosition });
      
      // Synchroniser avec CrossParty si activé (sauf si on traite déjà une update CrossParty)
      if (isInCrossPartyMode() && !isProcessingCrossPartyUpdate) {
        if (crossPartyUserId?.includes('client')) {
          console.log('🚀 CLIENT: Force sync RESUME immédiate');
          await forceClientSync('RESUME');
        } else {
          console.log('🔄 Resume locale → Synchronisation CrossParty');
          await syncWithCrossParty('RESUME');
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur resume:', error);
  }
}

// --- Stop ---
export async function stopTrack() {
  if (currentSound) {
    // Enregistrer l'écoute avant d'arrêter
    if (currentPlayingTrack && trackStartTime) {
      await recordPlay(currentPlayingTrack, trackStartTime);
    }
    
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
    currentSound = null;
    isPlaying = false;
    
    // Reset du tracking
    currentPlayingTrack = null;
    trackStartTime = null;
    
    playerEmitter.emit('stop');
  }
}

// --- Stop All Audio ---
export async function stopAllAudio() {
  try {
    console.log('🛑 Arrêt complet de tous les audios');
    
    // Configurer le mode audio pour empêcher le mélange
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    
    // Arrêter notre son actuel
    if (currentSound) {
      // Enregistrer l'écoute avant d'arrêter
      if (currentPlayingTrack && trackStartTime) {
        await recordPlay(currentPlayingTrack, trackStartTime);
      }
      
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    
    isPlaying = false;
    
    // Reset du tracking
    currentPlayingTrack = null;
    trackStartTime = null;
    
    playerEmitter.emit('stop');
    
    // Synchroniser avec CrossParty si activé
    await syncWithCrossParty('STOP');
    
    console.log('✅ Tous les audios arrêtés');
  } catch (error) {
    console.error('❌ Erreur arrêt audio:', error);
  }
}

// --- Seek ---
export async function seekTo(positionMillis) {
  if (!currentSound) {
    console.warn('⚠️ Seek: Aucun son chargé');
    return;
  }
  
  try {
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Seek: Son pas chargé');
      return;
    }
    
    await currentSound.setPositionAsync(positionMillis);
    console.log(`🎯 Seek réussi à ${positionMillis}ms`);
  } catch (error) {
    console.error('❌ Erreur seek:', error);
  }
}

// --- Callback de progression + détection de fin ---
async function onPlaybackStatusUpdate(status) {
  if (!status.isLoaded) return;

  // Mettre à jour l'état local avec l'état réel SEULEMENT si on n'est pas en mode CrossParty ou en traitement
  const wasPlaying = isPlaying;
  
  // État local directement (CrossParty supprimé)
  isPlaying = status.isPlaying;
  
  playbackStatus = status;
  
  // Logger les changements d'état inattendus (seulement hors CrossParty)
  if (wasPlaying !== status.isPlaying) {
    console.log(`🔄 Changement d'état détecté: ${wasPlaying ? 'playing' : 'paused'} → ${status.isPlaying ? 'playing' : 'paused'}`);
  }
  
  playerEmitter.emit('progress', status);

  if (status.didJustFinish && !status.isLooping) {
    console.log('⏭️ Fin de la piste → suivante...');
    
    // Émettre l'événement finish pour les hooks qui écoutent
    playerEmitter.emit('finish');
    
    // Enregistrer l'écoute complète avant de passer à la suivante
    if (currentPlayingTrack && trackStartTime) {
      await recordPlay(currentPlayingTrack, trackStartTime);
      // Reset pour éviter de réenregistrer dans playNext
      currentPlayingTrack = null;
      trackStartTime = null;
    }
    
    await playNext(); // 🔥 avance automatiquement dans la queue
  }
}

// --- Getters ---
export function getCurrentTrack() {
  return currentTrack;
}
export function getPlaybackStatus() {
  return playbackStatus;
}
export function isTrackPlaying() {
  return isPlaying;
}
export function getQueue() {
  return globalTracks;
}
export function getCurrentIndex() {
  return currentIndex;
}

// --- Fonctions pour les statistiques ---
export async function getListeningStats() {
  return await statsService.loadStats();
}

export async function resetListeningStats() {
  return await statsService.resetStats();
}

export async function exportListeningStats() {
  return await statsService.exportStats();
}

// --- Fonctions CrossParty ---
export function enableCrossParty(roomId, userId) {
  // CrossParty supprimé: fonction inactive
  crossPartyRoomId = null;
  crossPartyUserId = null;
  console.log('🚫 CrossParty désactivé - enable ignoré');
}

export function disableCrossParty() {
  crossPartyRoomId = null;
  crossPartyUserId = null;
  isProcessingCrossPartyUpdate = false;
  lastLocalActionTime = 0;
  lastCrossPartyActionTime = 0;
  if (crossPartyIgnoreTimeout) {
    clearTimeout(crossPartyIgnoreTimeout);
    crossPartyIgnoreTimeout = null;
  }
  console.log('🎵 CrossParty désactivé');
}

export function isInCrossPartyMode() {
  // CrossParty supprimé
  return false;
}

export function setCrossPartyRoom(roomId, instanceId) {
  crossPartyRoomId = null;
  crossPartyUserId = null;
  console.log('🚫 CrossParty supprimé - setCrossPartyRoom ignoré');
}

export function clearCrossPartyRoom() {
  crossPartyRoomId = null;
  crossPartyUserId = null;
  isProcessingCrossPartyUpdate = false;
  lastLocalActionTime = 0;
  lastCrossPartyActionTime = 0;
  
  // Nettoyer les timeouts
  if (crossPartyIgnoreTimeout) {
    clearTimeout(crossPartyIgnoreTimeout);
    crossPartyIgnoreTimeout = null;
  }
  
  console.log('🎵 CrossParty room effacée');
}

// Versions internes sans synchronisation CrossParty
async function internalPlayTrack(track, index = null) {
  try {
    if (!track?.url) {
      console.warn('❌ Aucune URL pour cette piste :', track);
      return;
    }
    
    console.log(`🎵 Internal PlayTrack: ${track.title}`);

    // Stopper la piste précédente
    if (currentSound) {
      await currentSound.unloadAsync();
      currentSound = null;
    }

    // Trouver l'index si pas fourni
    if (index !== null) {
      currentIndex = index;
    } else {
      currentIndex = globalTracks.findIndex((t) => t.url === track.url);
    }

    // Créer et lire la nouvelle piste
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.url },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    // Enregistrer l'écoute précédente si une piste différente était en cours
    if (currentPlayingTrack && trackStartTime && currentPlayingTrack.url !== track.url) {
      await recordPlay(currentPlayingTrack, trackStartTime);
    }

    currentSound = sound;
    currentTrack = track;
    isPlaying = true;

    // Commencer le tracking de la nouvelle piste
    currentPlayingTrack = track;
    trackStartTime = Date.now();

    console.log(`▶️ Internal Lecture : ${track.title} (index ${currentIndex})`);
    playerEmitter.emit('play', { track, index: currentIndex });
  } catch (err) {
    console.error('Erreur lecture interne:', err);
  }
}

async function internalPauseTrack() {
  if (!currentSound) {
    console.warn('⚠️ Internal pause: Aucun son chargé');
    return;
  }
  
  try {
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Internal pause: Son pas chargé');
      return;
    }
    
    if ((status.isPlaying || isPlaying)) {
      // Sauvegarder la position actuelle avant de faire la pause
      const currentPos = status.positionMillis || 0;
      playbackStatus = { ...playbackStatus, positionMillis: currentPos };
      
      await currentSound.pauseAsync();
      isPlaying = false;
      playerEmitter.emit('pause', { track: currentTrack, position: currentPos });
      
      console.log(`⏸️ Internal pause à ${currentPos}ms`);
    }
  } catch (error) {
    console.error('❌ Erreur internal pause:', error);
  }
}

async function internalResumeTrack() {
  if (!currentSound) {
    console.warn('⚠️ Internal resume: Aucun son chargé');
    return;
  }
  
  try {
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Internal resume: Son pas chargé');
      return;
    }
    
    if (!status.isPlaying && !isPlaying) {
      // Utiliser la position sauvegardée si disponible
      const savedPosition = playbackStatus.positionMillis || 0;
      if (savedPosition > 0) {
        await currentSound.setPositionAsync(savedPosition);
        console.log(`▶️ Internal resume à la position sauvegardée: ${savedPosition}ms`);
      }
      
      await currentSound.playAsync();
      isPlaying = true;
      playerEmitter.emit('resume', { track: currentTrack, position: savedPosition });
    }
  } catch (error) {
    console.error('❌ Erreur internal resume:', error);
  }
}

export async function playTrackFromCrossParty(track, index = null) {
  if (!isInCrossPartyMode()) {
    console.warn('❌ playTrackFromCrossParty appelé hors mode CrossParty');
    return;
  }
  
  // PROTECTION: Ne pas jouer la même piste si elle est déjà en cours
  if (currentTrack && currentTrack.url === track.url && isPlaying) {
    console.log('🚫 CrossParty: Même piste déjà en cours, ignoré');
    return;
  }
  
  // PROTECTION: Éviter les appels trop rapprochés entre actions CrossParty
  const now = Date.now();
  if (lastCrossPartyActionTime > 0 && (now - lastCrossPartyActionTime) < 1000) {
    console.log('🚫 CrossParty: Action CrossParty trop récente, ignoré');
    return;
  }
  
  console.log('🎵 CrossParty: Lecture partagée de', track.title);
  
  // Marquer l'action CrossParty
  lastCrossPartyActionTime = now;
  
  // Utiliser la version interne sans sync PUIS synchroniser
  await internalPlayTrack(track, index);
  
  // Synchroniser avec les autres après l'action locale
  await syncWithCrossParty('PLAY_TRACK');
}

export async function pauseFromCrossParty() {
  if (!isInCrossPartyMode()) {
    console.warn('❌ pauseFromCrossParty appelé hors mode CrossParty');
    return;
  }
  
  // PROTECTION: Ne pas pauser si déjà en pause
  if (!isPlaying) {
    console.log('🚫 CrossParty: Déjà en pause, ignoré');
    return;
  }
  
  // PROTECTION: Éviter les appels trop rapprochés entre actions CrossParty
  const now = Date.now();
  if (lastCrossPartyActionTime > 0 && (now - lastCrossPartyActionTime) < 1000) {
    console.log('🚫 CrossParty: Action CrossParty trop récente, ignoré');
    return;
  }
  
  console.log('⏸️ CrossParty: Pause partagée');
  
  // Marquer l'action CrossParty
  lastCrossPartyActionTime = now;
  
  // Utiliser la version interne sans sync PUIS synchroniser
  await internalPauseTrack();
  
  // Synchroniser avec les autres après l'action locale
  await syncWithCrossParty('PAUSE');
}

export async function resumeFromCrossParty() {
  if (!isInCrossPartyMode()) {
    console.warn('❌ resumeFromCrossParty appelé hors mode CrossParty');
    return;
  }
  
  // PROTECTION: Ne pas reprendre si déjà en lecture
  if (isPlaying) {
    console.log('🚫 CrossParty: Déjà en lecture, ignoré');
    return;
  }
  
  // PROTECTION: Éviter les appels trop rapprochés entre actions CrossParty
  const now = Date.now();
  if (lastCrossPartyActionTime > 0 && (now - lastCrossPartyActionTime) < 1000) {
    console.log('🚫 CrossParty: Action CrossParty trop récente, ignoré');
    return;
  }
  
  console.log('▶️ CrossParty: Reprise partagée');
  
  // Marquer l'action CrossParty
  lastCrossPartyActionTime = now;
  
  // Utiliser la version interne sans sync PUIS synchroniser
  await internalResumeTrack();
  
  // Synchroniser avec les autres après l'action locale
  await syncWithCrossParty('RESUME');
}

// Détection de boucles - compteur d'updates récentes
let recentUpdatesCount = 0;
let lastUpdateCountReset = Date.now();

// Fonction pour adapter les données Firebase à notre format
function adaptFirebaseData(firebaseData) {
  // Si les données sont au format Firebase (avec playbackState)
  if (firebaseData.playbackState && !firebaseData.action) {
    return {
      action: firebaseData.playbackState.action || 'UNKNOWN',
      isPlaying: firebaseData.playbackState.isPlaying || false,
      position: firebaseData.playbackState.position || 0,
      timestamp: firebaseData.playbackState.timestamp || Date.now(),
      stateId: firebaseData.playbackState.stateId || null,
      lastUpdatedBy: firebaseData.playbackState.lastUpdatedBy || 'unknown',
      currentTrack: firebaseData.currentTrack || null,
      // Conserver les données originales aussi
      ...firebaseData
    };
  }
  
  // Si les données sont déjà dans le bon format
  return firebaseData;
}

export async function processCrossPartyUpdate(firebaseData) {
  // Adapter les données Firebase
  const roomData = adaptFirebaseData(firebaseData);
  // Détection de boucle - trop d'updates en peu de temps
  const now = Date.now();
  if (now - lastUpdateCountReset > 10000) {
    // Reset le compteur toutes les 10 secondes
    recentUpdatesCount = 0;
    lastUpdateCountReset = now;
  }
  
  recentUpdatesCount++;
  
  if (recentUpdatesCount > 10) {
    console.warn('🚨 BOUCLE DÉTECTÉE: Trop d\'updates CrossParty (>10 en 10s)');
    emergencyBreakLoops();
    return;
  }

  if (isProcessingCrossPartyUpdate) {
    console.log('⏭️ CrossParty: Mise à jour ignorée (traitement en cours)');
    return;
  }

  if (!roomData.stateId || roomData.stateId === lastProcessedStateId) {
    console.log('⏭️ CrossParty: Mise à jour ignorée (déjà traitée)');
    return;
  }

  if (roomData.lastUpdatedBy === crossPartyUserId) {
    console.log('⏭️ CrossParty: Mise à jour ignorée (initiée par nous)');
    lastProcessedStateId = roomData.stateId;
    return;
  }

  // CÔTÉ CLIENT: Ignorer les updates si on vient de faire une action locale (délai de grâce)
  // MAIS permettre aux clients de recevoir les confirmations du host
  if (crossPartyIgnoreTimeout !== null) {
    const timeSinceLocalAction = Date.now() - lastLocalActionTime;
    const isClientAction = roomData.lastUpdatedBy && roomData.lastUpdatedBy.includes('client');
    const isHostConfirmation = roomData.lastUpdatedBy && roomData.lastUpdatedBy.includes('host') && crossPartyUserId?.includes('client');
    
    // Si c'est une action client et qu'on est pas client nous-même, on laisse passer
    if (isClientAction && !crossPartyUserId?.includes('client')) {
      console.log('🎯 CrossParty: Action client forcée (override protection host)');
    } 
    // Si on est client et qu'on reçoit une confirmation du host, on la traite
    else if (isHostConfirmation) {
      console.log('📡 CLIENT: Réception confirmation host - traitement forcé');
    } 
    else {
      console.log(`⏭️ CrossParty: Update ignorée (action locale récente, ${timeSinceLocalAction}ms)`);
      lastProcessedStateId = roomData.stateId; // Marquer comme traité pour éviter les répétitions
      return;
    }
  }

  // Ignorer les updates très récentes par rapport à notre dernière action locale
  // SAUF si c'est une action client prioritaire OU une confirmation host pour client
  if (roomData.lastUpdated && lastLocalActionTime > 0) {
    const localActionAge = Date.now() - lastLocalActionTime;
    const updateAge = Date.now() - roomData.lastUpdated;
    const isClientAction = roomData.lastUpdatedBy && roomData.lastUpdatedBy.includes('client');
    const isHostToClient = roomData.lastUpdatedBy && roomData.lastUpdatedBy.includes('host') && crossPartyUserId?.includes('client');
    
    if (localActionAge < 4000 && updateAge < localActionAge + 1500 && !isClientAction && !isHostToClient) {
      console.log(`⏭️ CrossParty: Update ignorée (trop proche de notre action locale)`);
      lastProcessedStateId = roomData.stateId; // Marquer comme traité
      return;
    } else if (isClientAction) {
      console.log('🎯 CrossParty: Action client prioritaire acceptée');
    } else if (isHostToClient) {
      console.log('📡 CLIENT: Confirmation host acceptée (sync state)');
    }
  }

    // Ignorer si c'est exactement la même action que notre dernière action locale
    const timeSinceLocalAction = Date.now() - lastLocalActionTime;
    if (timeSinceLocalAction < 5000) {
      // Vérification plus stricte pour éviter les boucles pause/play
      if ((roomData.action === 'PAUSE' && !isPlaying) || 
          (roomData.action === 'RESUME' && isPlaying) ||
          (roomData.action === 'PLAY_TRACK' && isPlaying && currentTrack?.url === roomData.currentTrack?.url)) {
        console.log(`⏭️ CrossParty: Update ignorée - même état déjà actif (${roomData.action})`);
        lastProcessedStateId = roomData.stateId;
        return;
      }
      console.log(`⚠️ CrossParty: Update en écho possible (${timeSinceLocalAction}ms depuis action locale)`);
    }
  
  // PRIORITÉ CLIENT: Si c'est un update forcé client, on le traite immédiatement
  const isClientForceUpdate = roomData.priority === 'CLIENT_FORCE' || roomData.forceUpdate;
  if (isClientForceUpdate) {
    console.log('🚀 CrossParty: UPDATE CLIENT FORCÉ - Traitement prioritaire');
  }
  
  console.log('🎵 CrossParty: Traitement action:', roomData.action, {
    track: roomData.currentTrack?.title,
    isPlaying: roomData.isPlaying,
    position: roomData.position,
    timestamp: roomData.timestamp,
    clientForce: isClientForceUpdate,
    fromUser: roomData.lastUpdatedBy,
    toUser: crossPartyUserId,
    localPlaying: isPlaying
  });
  
  isProcessingCrossPartyUpdate = true;
  lastProcessedStateId = roomData.stateId;

  try {
    switch (roomData.action) {
      case 'PLAY_TRACK':
        if (roomData.currentTrack) {
          // Forcer la lecture même si on est en mode tablette
          await forcePlayTrack(roomData.currentTrack, roomData.position || 0, roomData.timestamp);
          
          // Vérifier que la lecture a bien commencé
          if (currentSound) {
            const status = await currentSound.getStatusAsync();
            console.log('📊 CrossParty: État après PLAY_TRACK:', {
              isLoaded: status.isLoaded,
              isPlaying: status.isPlaying,
              shouldPlay: status.shouldPlay,
              position: status.positionMillis
            });
            
            // Force la lecture si elle n'a pas commencé
            if (status.isLoaded && !status.isPlaying) {
              console.log('🔄 CrossParty: Force lecture car en pause');
              await currentSound.playAsync();
              isPlaying = true;
            }
          }
        }
        break;
      case 'PAUSE':
        await forcePause();
        // Synchroniser la position si fournie
        if (roomData.position && currentSound) {
          await currentSound.setPositionAsync(roomData.position);
        }
        break;
      case 'RESUME':
        // Calculer la position avec le délai réseau
        let resumePosition = roomData.position || 0;
        if (roomData.timestamp && roomData.isPlaying) {
          const timeSinceUpdate = Date.now() - roomData.timestamp;
          resumePosition += timeSinceUpdate;
        }
        await forceResume(resumePosition);
        
        // Vérifier que la reprise a fonctionné
        if (currentSound) {
          const status = await currentSound.getStatusAsync();
          console.log('📊 CrossParty: État après RESUME:', {
            isLoaded: status.isLoaded,
            isPlaying: status.isPlaying,
            position: status.positionMillis
          });
        }
        break;
      case 'STOP':
        await stopAllAudio();
        break;
    }
  } catch (error) {
    console.error('❌ CrossParty: Erreur traitement:', error);
  } finally {
    isProcessingCrossPartyUpdate = false;
  }
}

// Fonctions force (sans sync CrossParty)
async function forcePlayTrack(track, startPosition = 0, timestamp = null) {
  console.log('🎵 Force: Lecture piste', track.title, `à ${startPosition}ms`);
  
  // Arrêter la piste actuelle sans sync
  if (currentSound) {
    await currentSound.unloadAsync();
    currentSound = null;
  }
  
  try {
    if (!track?.url) {
      console.warn('❌ Aucune URL pour cette piste :', track);
      return;
    }

    // Calculer la position avec compensation du délai réseau
    let adjustedPosition = startPosition;
    if (timestamp && timestamp > 0) {
      const networkDelay = Date.now() - timestamp;
      adjustedPosition = Math.max(0, startPosition + networkDelay);
    }

    // Créer la nouvelle piste
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.url },
      { 
        shouldPlay: true, // Démarrer automatiquement
        positionMillis: adjustedPosition 
      },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    currentTrack = track;
    
    // S'assurer que la position est correcte si elle est > 0
    if (adjustedPosition > 0) {
      await sound.setPositionAsync(adjustedPosition);
    }
    
    // S'assurer que la lecture a vraiment commencé (crucial pour tablette)
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        console.log(`✅ Force: Lecture confirmée (tentative ${attempts + 1})`);
        break;
      }
      
      if (status.isLoaded && !status.isPlaying) {
        console.log(`🔄 Force: Tentative ${attempts + 1} de démarrage lecture`);
        await sound.playAsync();
        // Attendre un peu pour que le son démarre
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      attempts++;
    }
    
    // Vérification finale
    const finalStatus = await sound.getStatusAsync();
    isPlaying = finalStatus.isPlaying;
    
    if (!isPlaying) {
      console.warn('⚠️ Force: Lecture n\'a pas pu démarrer après 3 tentatives');
    }

    // Commencer le tracking de la nouvelle piste
    currentPlayingTrack = track;
    trackStartTime = Date.now();

    console.log(`▶️ Force lecture : ${track.title} (position: ${adjustedPosition}ms)`);
    playerEmitter.emit('play', { track, position: adjustedPosition });
  } catch (err) {
    console.error('❌ Erreur force lecture:', err);
  }
}

async function forcePause() {
  console.log('⏸️ Force: Pause');
  if (!currentSound) {
    console.warn('⚠️ Force pause: Aucun son chargé');
    return;
  }
  
  try {
    // Vérifier que le son est chargé avant de faire pause
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Force pause: Son pas chargé');
      return;
    }
    
    if (status.isPlaying || isPlaying) {
      await currentSound.pauseAsync();
      isPlaying = false;
      playerEmitter.emit('pause', { track: currentTrack });
      console.log('✅ Force pause réussie');
    }
  } catch (error) {
    console.error('❌ Erreur force pause:', error);
  }
}

async function forceResume(position = null) {
  console.log('▶️ Force: Resume', position ? `à ${position}ms` : '');
  if (!currentSound) {
    console.warn('⚠️ Force resume: Aucun son chargé');
    return;
  }
  
  try {
    // Vérifier que le son est chargé avant de reprendre
    const status = await currentSound.getStatusAsync();
    if (!status.isLoaded) {
      console.warn('⚠️ Force resume: Son pas chargé');
      return;
    }
    
    if (!status.isPlaying && !isPlaying) {
      // Synchroniser la position si fournie
      if (position !== null && position >= 0) {
        await currentSound.setPositionAsync(position);
      }
      await currentSound.playAsync();
      isPlaying = true;
      playerEmitter.emit('resume', { track: currentTrack, position });
      console.log('✅ Force resume réussie');
    }
  } catch (error) {
    console.error('❌ Erreur force resume:', error);
  }
}

// Fonction utilitaire pour vérifier l'état du son de façon sécurisée
async function getSafeStatus(sound) {
  if (!sound) return null;
  
  try {
    const status = await sound.getStatusAsync();
    return status;
  } catch (error) {
    console.warn('⚠️ Impossible d\'obtenir le statut du son:', error);
    return null;
  }
}

// Fonction pour vérifier si le son est prêt pour les opérations
async function isSoundReady(sound) {
  const status = await getSafeStatus(sound);
  return status && status.isLoaded;
}

// Fonction pour vérifier et synchroniser l'état réel
export async function checkAndSyncPlaybackState() {
  if (!currentSound) return null;
  
  try {
    const realStatus = await getSafeStatus(currentSound);
    if (!realStatus || !realStatus.isLoaded) {
      console.warn('⚠️ Son pas prêt pour vérification d\'état');
      return null;
    }
    
    // Mettre à jour notre état local avec l'état réel
    const wasPlaying = isPlaying;
    isPlaying = realStatus.isPlaying;
    playbackStatus = realStatus;
    
    // Logger les différences d'état
    if (wasPlaying !== isPlaying) {
      console.log(`🔄 État corrigé: ${wasPlaying ? 'playing' : 'paused'} → ${isPlaying ? 'playing' : 'paused'}`);
    }
    
    return {
      isPlaying: realStatus.isPlaying,
      position: realStatus.positionMillis,
      duration: realStatus.durationMillis,
      stateChanged: wasPlaying !== isPlaying
    };
  } catch (error) {
    console.warn('⚠️ Erreur vérification état:', error);
    return null;
  }
}

// === FONCTIONS INTELLIGENTES CROSSPARTY ===
// Ces fonctions décident automatiquement d'utiliser CrossParty ou le mode normal

// Protection contre les appels trop fréquents des fonctions smart
let lastSmartAction = { action: null, time: 0 };

export async function smartPlayTrack(track, index = null) {
  const now = Date.now();
  if (lastSmartAction.action === 'PLAY' && (now - lastSmartAction.time) < 2000) {
    console.log('🚫 Smart Play: Action trop récente, ignoré');
    return;
  }
  
  lastSmartAction = { action: 'PLAY', time: now };
  
  if (isInCrossPartyMode()) {
    console.log('🎵 Smart: Utilisation CrossParty pour PLAY');
    
    // Si on est client, forcer l'action pour override les protections
    if (crossPartyUserId?.includes('client')) {
      console.log('🚀 CLIENT: Force play track avec override');
      await playTrack(track, index); // Action locale d'abord
      await forceClientAction('PLAY_TRACK');
      // Synchroniser l'état après l'action
      setTimeout(() => syncClientState(), 1000);
    } else {
      await playTrackFromCrossParty(track, index);
    }
  } else {
    console.log('🎵 Smart: Utilisation normale pour PLAY');
    await playTrack(track, index);
  }
}

export async function smartPauseTrack() {
  const now = Date.now();
  if (lastSmartAction.action === 'PAUSE' && (now - lastSmartAction.time) < 2000) {
    console.log('🚫 Smart Pause: Action trop récente, ignoré');
    return;
  }
  
  lastSmartAction = { action: 'PAUSE', time: now };
  
  if (isInCrossPartyMode()) {
    console.log('⏸️ Smart: Utilisation CrossParty pour PAUSE');
    
    // Si on est client, forcer l'action pour override les protections
    if (crossPartyUserId?.includes('client')) {
      console.log('🚀 CLIENT: Force pause avec override');
      await pauseTrack(); // Action locale d'abord
      await forceClientAction('PAUSE');
      // Synchroniser l'état après l'action
      setTimeout(() => syncClientState(), 1000);
    } else {
      await pauseFromCrossParty();
    }
  } else {
    console.log('⏸️ Smart: Utilisation normale pour PAUSE');
    await pauseTrack();
  }
}

export async function smartResumeTrack() {
  const now = Date.now();
  if (lastSmartAction.action === 'RESUME' && (now - lastSmartAction.time) < 2000) {
    console.log('🚫 Smart Resume: Action trop récente, ignoré');
    return;
  }
  
  lastSmartAction = { action: 'RESUME', time: now };
  
  if (isInCrossPartyMode()) {
    console.log('▶️ Smart: Utilisation CrossParty pour RESUME');
    
    // Si on est client, forcer l'action pour override les protections
    if (crossPartyUserId?.includes('client')) {
      console.log('🚀 CLIENT: Force resume avec override');
      await resumeTrack(); // Action locale d'abord
      await forceClientAction('RESUME');
      // Synchroniser l'état après l'action
      setTimeout(() => syncClientState(), 1000);
    } else {
      await resumeFromCrossParty();
    }
  } else {
    console.log('▶️ Smart: Utilisation normale pour RESUME');
    await resumeTrack();
  }
}

export async function smartTogglePlayPause() {
  if (isPlaying) {
    await smartPauseTrack();
  } else {
    await smartResumeTrack();
  }
}

// Fonction pour forcer la synchronisation de l'état actuel
export async function forceSyncCurrentState() {
  if (!isInCrossPartyMode()) {
    console.log('🚫 Force sync: Pas en mode CrossParty');
    return;
  }
  
  console.log('🔄 Force sync: Synchronisation état actuel');
  
  if (currentTrack && isPlaying) {
    await syncWithCrossParty('PLAY_TRACK');
  } else if (currentTrack && !isPlaying) {
    await syncWithCrossParty('PAUSE');
  } else {
    await syncWithCrossParty('STOP');
  }
}

// Fonction pour forcer la lecture (spécialement pour les tablettes)
export async function forcePlaybackStart() {
  if (!currentSound || !currentTrack) {
    console.warn('⚠️ Force start: Pas de son ou piste chargé');
    return false;
  }

  try {
    console.log('🚀 Force: Démarrage forcé de la lecture');
    
    const status = await getSafeStatus(currentSound);
    if (!status || !status.isLoaded) {
      console.warn('⚠️ Force start: Son pas chargé');
      return false;
    }

    // Force la lecture multiple fois si nécessaire
    for (let i = 0; i < 3; i++) {
      await currentSound.playAsync();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const newStatus = await getSafeStatus(currentSound);
      if (newStatus && newStatus.isPlaying) {
        isPlaying = true;
        console.log(`✅ Force start: Lecture démarrée (tentative ${i + 1})`);
        playerEmitter.emit('forcePlay', { track: currentTrack });
        return true;
      }
    }
    
    console.warn('❌ Force start: Impossible de démarrer la lecture');
    return false;
  } catch (error) {
    console.error('❌ Erreur force start:', error);
    return false;
  }
}

// Fonction pour réinitialiser les protections anti-boucles (en cas de problème)
export function resetCrossPartyLoopProtection() {
  console.log('🔧 Reset protection anti-boucles CrossParty');
  
  isProcessingCrossPartyUpdate = false;
  lastLocalActionTime = 0;
  lastCrossPartyActionTime = 0;
  
  if (crossPartyIgnoreTimeout) {
    clearTimeout(crossPartyIgnoreTimeout);
    crossPartyIgnoreTimeout = null;
  }
  
  console.log('✅ Protection anti-boucles réinitialisée');
}

// Fonction de test pour vérifier la synchronisation côté client
export async function testClientSync() {
  if (!isInCrossPartyMode()) {
    console.log('❌ Test impossible: Pas en mode CrossParty');
    return;
  }
  
  if (!crossPartyUserId?.includes('client')) {
    console.log('❌ Test impossible: Pas un client');
    return;
  }
  
  console.log('🧪 TEST CLIENT FORCE UPDATE - Début');
  console.log('=====================================');
  
  try {
    // Test 1: Force update pause
    console.log('🧪 Test 1: Force update PAUSE');
    await forceClientSync('PAUSE');
    console.log('✅ Test 1: PAUSE forcé envoyé');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 2: Force update resume  
    console.log('🧪 Test 2: Force update RESUME');
    await forceClientSync('RESUME');
    console.log('✅ Test 2: RESUME forcé envoyé');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 3: Force update play track
    if (currentTrack) {
      console.log('🧪 Test 3: Force update PLAY_TRACK');
      await forceClientSync('PLAY_TRACK');
      console.log('✅ Test 3: PLAY_TRACK forcé envoyé');
    }
    
    console.log('🎉 TEST CLIENT FORCE UPDATE - TOUS RÉUSSIS');
    console.log('Les updates client sont maintenant forcés immédiatement !');
    
  } catch (error) {
    console.error('❌ TEST CLIENT FORCE UPDATE - Erreur:', error);
  }
}

// Fonction pour vérifier que le client peut forcer ses actions
export function isClientForceEnabled() {
  return isInCrossPartyMode() && crossPartyUserId?.includes('client');
}

// Fonction pour synchroniser l'état après une action client
export async function syncClientState() {
  if (!isClientForceEnabled()) return;
  
  console.log('🔄 CLIENT: Synchronisation état post-action');
  
  // Attendre un peu pour laisser le host processer
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Vérifier qu'on a bien l'état attendu
  const debug = getCrossPartyDebugInfo();
  console.log('📊 CLIENT: État actuel:', {
    isPlaying: debug.isPlaying,
    currentTrack: debug.currentTrack,
    position: debug.playbackPosition,
    userType: debug.userType
  });
  
  // Si on détecte une désync, demander une resync
  if (currentSound) {
    try {
      const status = await currentSound.getStatusAsync();
      if (status.isLoaded) {
        console.log('📊 CLIENT: État audio réel:', {
          isPlaying: status.isPlaying,
          position: status.positionMillis,
          shouldPlay: status.shouldPlay
        });
      }
    } catch (error) {
      console.warn('⚠️ CLIENT: Impossible de vérifier l\'état audio');
    }
  }
}

// Fonction d'urgence pour casser les boucles détectées
let lastEmergencyBreak = 0;
export function emergencyBreakLoops() {
  const now = Date.now();
  
  // Protection contre l'appel trop fréquent de cette fonction elle-même
  if (now - lastEmergencyBreak < 5000) {
    console.log('🚫 Emergency break trop récent');
    return;
  }
  
  lastEmergencyBreak = now;
  console.log('🚨 EMERGENCY: Cassage de boucles CrossParty détectées');
  
  // Reset complet de tous les états
  resetCrossPartyLoopProtection();
  
  // Arrêter tous les timeouts en cours
  if (crossPartyIgnoreTimeout) {
    clearTimeout(crossPartyIgnoreTimeout);
    crossPartyIgnoreTimeout = null;
  }
  
  // Forcer un état stable
  isProcessingCrossPartyUpdate = false;
  lastLocalActionTime = 0;
  lastCrossPartyActionTime = 0;
  lastProcessedStateId = `emergency_${now}`;
  
  console.log('🛑 Emergency break terminé - État stable forcé');
}

export function getCrossPartyDebugInfo() {
  return {
    crossPartyRoomId,
    crossPartyUserId,
    isProcessingCrossPartyUpdate,
    isInCrossPartyMode: isInCrossPartyMode(),
    currentTrack: currentTrack?.title || null,
    isPlaying,
    currentIndex,
    lastProcessedStateId,
    playbackPosition: playbackStatus.positionMillis || 0,
    lastLocalActionTime,
    lastCrossPartyActionTime,
    userType: crossPartyUserId?.includes('host') ? 'HOST' : crossPartyUserId?.includes('client') ? 'CLIENT' : 'UNKNOWN'
  };
}

// Fonction spéciale pour forcer les actions côté client (override protections)
export async function forceClientAction(action, extraData = {}) {
  if (!isInCrossPartyMode()) {
    console.warn('❌ forceClientAction: Pas en mode CrossParty');
    return;
  }
  
  if (!crossPartyUserId?.includes('client')) {
    console.warn('❌ forceClientAction: Réservé aux clients uniquement');
    return;
  }
  
  console.log(`🚀 CLIENT FORCE UPDATE: ${action} - FORCE IMMEDIATE`);
  
  try {
    // CLIENT FORCE: Pas de délais, pas de protections
    await forceClientSync(action, extraData);
    
    console.log(`✅ CLIENT FORCE UPDATE: ${action} envoyé immédiatement`);
    
  } catch (error) {
    console.error('❌ CLIENT FORCE UPDATE error:', error);
  }
}

// Nouvelle fonction de sync forcée pour les clients
async function forceClientSync(action, extraData = {}) {
  console.log(`🔥 CLIENT SYNC FORCE: ${action} - BYPASS TOUTES PROTECTIONS`);
  
  try {
    const service = await initCrossParty();
    if (!service || !crossPartyRoomId || !crossPartyUserId) {
      throw new Error('Service CrossParty non disponible');
    }

    // Obtenir la position actuelle réelle du son
    let currentPos = 0;
    if (currentSound) {
      try {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded) {
          currentPos = status.positionMillis || 0;
          playbackStatus = status;
        }
      } catch (error) {
        console.warn('⚠️ Force sync: position par défaut');
        currentPos = playbackStatus.positionMillis || 0;
      }
    }
    
    const timestamp = Date.now();
    
    // FORCE L'UPDATE SELON L'ACTION CLIENT
    switch (action) {
      case 'PLAY_TRACK':
        if (currentTrack) {
          await service.playTrack(crossPartyRoomId, {
            ...currentTrack,
            position: currentPos,
            timestamp: timestamp,
            forceUpdate: true, // Flag spécial client
            priority: 'CLIENT_FORCE'
          }, crossPartyUserId);
          console.log('🔥 CLIENT FORCE: PLAY_TRACK envoyé avec priorité');
        }
        break;
        
      case 'PAUSE':
        await service.pausePlayback(crossPartyRoomId, currentPos, crossPartyUserId, { 
          forceUpdate: true, 
          priority: 'CLIENT_FORCE' 
        });
        console.log('🔥 CLIENT FORCE: PAUSE envoyé avec priorité');
        break;
        
      case 'RESUME':
        await service.resumePlayback(crossPartyRoomId, currentPos, crossPartyUserId, { 
          forceUpdate: true, 
          priority: 'CLIENT_FORCE' 
        });
        console.log('🔥 CLIENT FORCE: RESUME envoyé avec priorité');
        break;
        
      case 'STOP':
        await service.stopPlayback(crossPartyRoomId, crossPartyUserId, { 
          forceUpdate: true, 
          priority: 'CLIENT_FORCE' 
        });
        console.log('🔥 CLIENT FORCE: STOP envoyé avec priorité');
        break;
    }
    
    // Marquer l'action mais avec timeout réduit pour les clients (permettre confirmations host)
    lastCrossPartyActionTime = timestamp;
    lastLocalActionTime = timestamp;
    
    // Timeout très court pour laisser le host confirmer
    if (crossPartyIgnoreTimeout) {
      clearTimeout(crossPartyIgnoreTimeout);
    }
    
    crossPartyIgnoreTimeout = setTimeout(() => {
      console.log('🔓 CLIENT: Fin du délai court - prêt pour confirmations host');
      crossPartyIgnoreTimeout = null;
    }, 800); // Délai court spécial client
    
  } catch (error) {
    console.error('❌ Force client sync error:', error);
    throw error;
  }
}