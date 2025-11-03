// player.js
import { Audio } from 'expo-av';
import { EventEmitter } from 'fbemitter';
import statsService from '../services/StatsService';

// CrossParty imports (lazy loading pour éviter les dépendances circulaires)
let crossPartyService = null;
let crossPartyContext = null;

// Fonction pour initialiser les services CrossParty
const initCrossParty = async () => {
  if (!crossPartyService) {
    try {
      const module = await import('../services/crossPartyService');
      crossPartyService = module.default;
      console.log('🎵 CrossParty Service initialisé avec succès');
    } catch (error) {
      console.error('❌ Erreur initialisation CrossParty Service:', error);
    }
  }
  return crossPartyService;
};

export const playerEmitter = new EventEmitter();

let currentSound = null;
let currentTrack = null;
let isPlaying = false;
let playbackStatus = { positionMillis: 0, durationMillis: 1 };

// Fonction pour arrêter toutes les musiques de force (appelée à l'init)
export async function stopAllAudio() {
  try {
    console.log('🛑 Arrêt forcé de toutes les instances audio...');
    
    // Configurer le mode audio pour empêcher le mélange
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    });
    
    // Arrêter notre instance actuelle si elle existe
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    
    isPlaying = false;
    console.log('✅ Toutes les instances audio arrêtées');
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt global audio:', error);
  }
}

// Variables pour le tracking des statistiques
let trackStartTime = null;
let currentPlayingTrack = null;

// ===== NOUVEAU SYSTÈME CROSSPARTY SIMPLIFIÉ =====
let crossPartyRoomId = null;
let crossPartyUserId = null;
let isProcessingCrossPartyUpdate = false; // Pour éviter les boucles
let lastProcessedStateId = null; // Pour éviter de traiter le même état plusieurs fois

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

// ===== NOUVELLES FONCTIONS CROSSPARTY SIMPLIFIÉES =====

export function enableCrossParty(roomId, userId) {
  crossPartyRoomId = roomId;
  crossPartyUserId = userId;
  console.log('🎵 CrossParty activé:', { roomId, userId });
}

export function disableCrossParty() {
  crossPartyRoomId = null;
  crossPartyUserId = null;
  isProcessingCrossPartyUpdate = false;
  lastProcessedStateId = null;
  console.log('🎵 CrossParty désactivé');
}

export function isInCrossPartyMode() {
  return !!crossPartyRoomId;
}

// Fonction appelée quand on reçoit un update depuis Firebase
export async function processCrossPartyUpdate(roomData) {
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

  console.log('🎵 CrossParty: Traitement mise à jour:', roomData.action);
  isProcessingCrossPartyUpdate = true;
  lastProcessedStateId = roomData.stateId;

  try {
    switch (roomData.action) {
      case 'PLAY_TRACK':
        if (roomData.currentTrack) {
          await forceStopAndPlay(roomData.currentTrack);
        }
        break;
      case 'PAUSE':
        await forcePause();
        break;
      case 'RESUME':
        await forceResume();
        break;
      case 'STOP':
        await forceStop();
        break;
      default:
        console.log('🤷 CrossParty: Action inconnue:', roomData.action);
    }
  } catch (error) {
    console.error('❌ CrossParty: Erreur traitement:', error);
  } finally {
    isProcessingCrossPartyUpdate = false;
  }
}

// ===== FONCTIONS DE FORCE (SANS SYNC CROSSPARTY) =====

async function forceStopAndPlay(track) {
  console.log('🎵 Force: Arrêt complet puis lecture', track.title);
  await stopAllAudio();
  await createAndPlaySound(track);
}

async function forcePause() {
  console.log('⏸️ Force: Pause');
  if (currentSound && isPlaying) {
    await currentSound.pauseAsync();
    isPlaying = false;
    playerEmitter.emit('pause', { track: currentTrack });
  }
}

async function forceResume() {
  console.log('▶️ Force: Resume');
  if (currentSound && !isPlaying) {
    await currentSound.playAsync();
    isPlaying = true;
    playerEmitter.emit('resume', { track: currentTrack });
  }
}

async function forceStop() {
  console.log('🛑 Force: Stop complet');
  await stopAllAudio();
}

// Fonction pour créer et jouer le son (utilisée dans playTrack)
async function createAndPlaySound(track, index = null) {
  try {
    console.log('🎵 Création du son pour:', track.title);
    
    // Trouver l'index si pas fourni
    if (index !== null) {
      currentIndex = index;
    } else {
      currentIndex = globalTracks.findIndex((t) => t.url === track.url);
    }

    // Enregistrer l'écoute précédente si différente
    if (currentPlayingTrack && trackStartTime && currentPlayingTrack.url !== track.url) {
      await recordPlay(currentPlayingTrack, trackStartTime);
    }

    // Créer et lire la nouvelle piste
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.url },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    currentTrack = track;
    isPlaying = true;

    // Commencer le tracking
    currentPlayingTrack = track;
    trackStartTime = Date.now();

    console.log(`✅ Lecture active: ${track.title} (index ${currentIndex})`);
    playerEmitter.emit('play', { track, index: currentIndex });
    
  } catch (error) {
    console.error('❌ Erreur création son:', error);
  }
}

// ===== NOUVELLE FONCTION PLAYTRACK SIMPLIFIÉE =====
export async function playTrack(track, index = null) {
  try {
    if (!track?.url) {
      console.warn('❌ Aucune URL pour cette piste :', track);
      return;
    }
    
    console.log(`🎵 PlayTrack appelé: ${track.title}`);

    // Arrêt forcé avant toute nouvelle piste
    await stopAllAudio();

    // Synchronisation CrossParty SI on est connecté ET que ce n'est pas un traitement CrossParty
    if (crossPartyRoomId && !isProcessingCrossPartyUpdate) {
      console.log('� CrossParty: Synchronisation nouvelle piste...');
      const service = await initCrossParty();
      if (service) {
        try {
          await service.playTrack(crossPartyRoomId, track, crossPartyUserId);
          console.log('✅ CrossParty: Synchronisé avec succès');
        } catch (error) {
          console.error('❌ CrossParty: Erreur synchronisation:', error);
        }
      }
    }

    // La fonction stopAllAudio() s'occupe déjà de tout nettoyer
    console.log('🎵 Démarrage de la nouvelle piste après nettoyage...');

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
// ===== NOUVELLE FONCTION PAUSE SIMPLIFIÉE =====
export async function pauseTrack() {
  console.log('⏸️ pauseTrack appelée');
  
  // Pause locale
  if (currentSound && isPlaying) {
    await currentSound.pauseAsync();
    isPlaying = false;
    playerEmitter.emit('pause', { track: currentTrack });
  }

  // Synchronisation CrossParty SI connecté ET pas en traitement
  if (crossPartyRoomId && !isProcessingCrossPartyUpdate) {
    console.log('🌐 CrossParty: Synchronisation pause...');
    const service = await initCrossParty();
    if (service) {
      try {
        await service.pausePlayback(crossPartyRoomId, playbackStatus.positionMillis || 0, crossPartyUserId);
        console.log('✅ CrossParty: Pause synchronisée');
      } catch (error) {
        console.error('❌ CrossParty: Erreur pause sync:', error);
      }
    }
  }
}

// ===== NOUVELLE FONCTION RESUME SIMPLIFIÉE =====
export async function resumeTrack() {
  console.log('▶️ resumeTrack appelée');
  
  // Resume locale
  if (currentSound && !isPlaying) {
    await currentSound.playAsync();
    isPlaying = true;
    playerEmitter.emit('resume', { track: currentTrack });
  }

  // Synchronisation CrossParty SI connecté ET pas en traitement
  if (crossPartyRoomId && !isProcessingCrossPartyUpdate) {
    console.log('🌐 CrossParty: Synchronisation resume...');
    const service = await initCrossParty();
    if (service) {
      try {
        await service.resumePlayback(crossPartyRoomId, playbackStatus.positionMillis || 0, crossPartyUserId);
        console.log('✅ CrossParty: Resume synchronisé');
      } catch (error) {
        console.error('❌ CrossParty: Erreur resume sync:', error);
      }
    }
  }
}

// --- Stop ---
export async function stopTrack() {
  console.log('🛑 stopTrack appelée');
  
  // Enregistrer l'écoute avant d'arrêter
  if (currentPlayingTrack && trackStartTime) {
    await recordPlay(currentPlayingTrack, trackStartTime);
  }
  
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      console.log('✅ Son arrêté et déchargé');
    } catch (error) {
      console.warn('⚠️ Erreur lors de l\'arrêt du son:', error);
    }
    currentSound = null;
  }
  
  // Force l'arrêt global
  try {
    await stopAllAudio();
  } catch (error) {
    console.warn('⚠️ Erreur lors de l\'arrêt global:', error);
  }
  
  isPlaying = false;
  
  // Reset du tracking
  currentPlayingTrack = null;
  trackStartTime = null;
  
  playerEmitter.emit('stop');
}

// --- Seek ---
export async function seekTo(positionMillis) {
  if (currentSound) {
    await currentSound.setPositionAsync(positionMillis);
  }
}

// --- Callback de progression + détection de fin ---
async function onPlaybackStatusUpdate(status) {
  if (!status.isLoaded) return;

  playbackStatus = status;
  playerEmitter.emit('progress', status);

  if (status.didJustFinish && !status.isLooping) {
    console.log('⏭️ Fin de la piste → suivante...');
    
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
