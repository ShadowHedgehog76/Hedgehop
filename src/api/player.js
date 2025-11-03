// player.js
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
  if (currentSound && isPlaying) {
    await currentSound.pauseAsync();
    isPlaying = false;
    playerEmitter.emit('pause', { track: currentTrack });
  }
}

// --- Reprise ---
export async function resumeTrack() {
  if (currentSound && !isPlaying) {
    await currentSound.playAsync();
    isPlaying = true;
    playerEmitter.emit('resume', { track: currentTrack });
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
