// player.js - VERSION CLEAN SIMPLIFIÉE
import { Audio } from 'expo-av';
import { EventEmitter } from 'fbemitter';
import statsService from '../services/StatsService';

// ===== ÉMETTEUR D'ÉVÉNEMENTS =====
export const playerEmitter = new EventEmitter();

// ===== VARIABLES AUDIO PRINCIPALES =====
let currentSound = null;
let currentTrack = null;
let isPlaying = false;
let playbackStatus = { positionMillis: 0, durationMillis: 1 };

// Variables pour le tracking des statistiques
let trackStartTime = null;
let currentPlayingTrack = null;

// Variables pour la queue
let globalTracks = [];
let currentIndex = -1;

// ===== VARIABLES CROSSPARTY =====
let crossPartyRoomId = null;
let crossPartyUserId = null;
let isProcessingCrossPartyUpdate = false;
let lastProcessedStateId = null;

// Service CrossParty (lazy loading)
let crossPartyService = null;

// ===== INITIALISATION CROSSPARTY =====
const initCrossParty = async () => {
  if (!crossPartyService) {
    try {
      const module = await import('../services/crossPartyService');
      crossPartyService = module.default;
      console.log('🎵 CrossParty Service initialisé');
    } catch (error) {
      console.error('❌ Erreur init CrossParty:', error);
    }
  }
  return crossPartyService;
};

// ===== FONCTION ARRÊT COMPLET =====
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
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    });
    
    // Arrêter notre son actuel
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    
    isPlaying = false;
    console.log('✅ Tous les audios arrêtés');
  } catch (error) {
    console.error('❌ Erreur arrêt audio:', error);
  }
}

// ===== FONCTION ENREGISTREMENT STATISTIQUES =====
async function recordPlay(track, startTime) {
  if (!track || !startTime) return;
  
  const playDuration = Date.now() - startTime;
  console.log(`🎵 Enregistrement: ${track.title} - ${Math.floor(playDuration/1000)}s`);
  
  if (playDuration >= 30000) {
    try {
      await statsService.recordPlay(
        track.albumTitle || track.album || 'Album Inconnu',
        track.title || 'Piste Inconnue',
        track.category || 'Non Classé',
        playDuration
      );
      console.log(`✅ Écoute enregistrée: ${track.title}`);
    } catch (error) {
      console.error('❌ Erreur enregistrement:', error);
    }
  }
}

// ===== FONCTIONS CROSSPARTY =====
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

// Traitement des mises à jour CrossParty depuis Firebase
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

  console.log('🎵 CrossParty: Traitement action:', roomData.action);
  isProcessingCrossPartyUpdate = true;
  lastProcessedStateId = roomData.stateId;

  try {
    switch (roomData.action) {
      case 'PLAY_TRACK':
        if (roomData.currentTrack) {
          await forcePlayTrack(roomData.currentTrack);
        }
        break;
      case 'PAUSE':
        await forcePause();
        break;
      case 'RESUME':
        await forceResume();
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

// ===== FONCTIONS FORCE (SANS SYNC) =====
async function forcePlayTrack(track) {
  console.log('🎵 Force: Lecture piste', track.title);
  await stopAllAudio();
  await createSound(track);
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

// ===== FONCTION CRÉATION SON =====
async function createSound(track, index = null) {
  try {
    console.log('🎵 Création son:', track.title);
    
    // Trouver l'index
    if (index !== null) {
      currentIndex = index;
    } else {
      currentIndex = globalTracks.findIndex((t) => t.url === track.url);
    }

    // Enregistrer écoute précédente
    if (currentPlayingTrack && trackStartTime && currentPlayingTrack.url !== track.url) {
      await recordPlay(currentPlayingTrack, trackStartTime);
    }

    // Créer le nouveau son
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.url },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    currentTrack = track;
    isPlaying = true;
    currentPlayingTrack = track;
    trackStartTime = Date.now();

    console.log(`✅ Lecture: ${track.title}`);
    playerEmitter.emit('play', { track, index: currentIndex });
    
  } catch (error) {
    console.error('❌ Erreur création son:', error);
  }
}

// ===== FONCTIONS PUBLIQUES PRINCIPALES =====
export async function playTrack(track, index = null) {
  try {
    if (!track?.url) {
      console.warn('❌ Pas d\'URL pour:', track?.title);
      return;
    }
    
    console.log(`🎵 playTrack: ${track.title}`);

    // Arrêt complet avant nouvelle piste
    await stopAllAudio();

    // Sync CrossParty si connecté (et pas en traitement)
    if (crossPartyRoomId && !isProcessingCrossPartyUpdate) {
      console.log('🌐 Sync CrossParty...');
      const service = await initCrossParty();
      if (service) {
        try {
          await service.playTrack(crossPartyRoomId, track, crossPartyUserId);
          console.log('✅ Sync CrossParty OK');
        } catch (error) {
          console.error('❌ Erreur sync CrossParty:', error);
        }
      }
    }

    // Créer et jouer le son
    await createSound(track, index);
    
  } catch (error) {
    console.error('❌ Erreur playTrack:', error);
  }
}

export async function pauseTrack() {
  console.log('⏸️ pauseTrack');
  
  // Pause locale
  if (currentSound && isPlaying) {
    await currentSound.pauseAsync();
    isPlaying = false;
    playerEmitter.emit('pause', { track: currentTrack });
  }

  // Sync CrossParty
  if (crossPartyRoomId && !isProcessingCrossPartyUpdate) {
    const service = await initCrossParty();
    if (service) {
      try {
        await service.pausePlayback(crossPartyRoomId, playbackStatus.positionMillis || 0, crossPartyUserId);
        console.log('✅ Pause sync CrossParty');
      } catch (error) {
        console.error('❌ Erreur pause sync:', error);
      }
    }
  }
}

export async function resumeTrack() {
  console.log('▶️ resumeTrack');
  
  // Resume locale
  if (currentSound && !isPlaying) {
    await currentSound.playAsync();
    isPlaying = true;
    playerEmitter.emit('resume', { track: currentTrack });
  }

  // Sync CrossParty
  if (crossPartyRoomId && !isProcessingCrossPartyUpdate) {
    const service = await initCrossParty();
    if (service) {
      try {
        await service.resumePlayback(crossPartyRoomId, playbackStatus.positionMillis || 0, crossPartyUserId);
        console.log('✅ Resume sync CrossParty');
      } catch (error) {
        console.error('❌ Erreur resume sync:', error);
      }
    }
  }
}

export async function stopTrack() {
  console.log('🛑 stopTrack');
  
  // Enregistrer écoute
  if (currentPlayingTrack && trackStartTime) {
    await recordPlay(currentPlayingTrack, trackStartTime);
  }
  
  await stopAllAudio();
  
  // Reset tracking
  currentPlayingTrack = null;
  trackStartTime = null;
  
  playerEmitter.emit('stop');
}

export async function seekTo(positionMillis) {
  if (currentSound) {
    await currentSound.setPositionAsync(positionMillis);
  }
}

// ===== NAVIGATION QUEUE =====
export async function playNext() {
  if (!globalTracks.length) return;

  const nextIndex = currentIndex + 1;
  if (nextIndex >= globalTracks.length) {
    console.log('⏹️ Fin de queue');
    await stopTrack();
    return;
  }

  await playTrack(globalTracks[nextIndex], nextIndex);
}

export async function playPrevious() {
  if (!globalTracks.length) return;

  const prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    console.log('⏮️ Début de queue');
    return;
  }

  await playTrack(globalTracks[prevIndex], prevIndex);
}

// ===== GESTION QUEUE =====
export function setGlobalTracks(list) {
  if (Array.isArray(list)) {
    globalTracks = list.filter((t) => t?.url);
    currentIndex = 0;
    console.log('🎵 Queue:', globalTracks.length, 'pistes');
  }
}

// ===== CALLBACK STATUS =====
async function onPlaybackStatusUpdate(status) {
  if (!status.isLoaded) return;

  playbackStatus = status;
  playerEmitter.emit('progress', status);

  if (status.didJustFinish && !status.isLooping) {
    console.log('⏭️ Fin piste → suivante');
    
    if (currentPlayingTrack && trackStartTime) {
      await recordPlay(currentPlayingTrack, trackStartTime);
      currentPlayingTrack = null;
      trackStartTime = null;
    }
    
    await playNext();
  }
}

// ===== GETTERS =====
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

// ===== FONCTIONS STATISTIQUES =====
export async function getListeningStats() {
  return await statsService.loadStats();
}

export async function resetListeningStats() {
  return await statsService.resetStats();
}

export async function exportListeningStats() {
  return await statsService.exportStats();
}