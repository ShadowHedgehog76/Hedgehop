// player.js
import { Audio } from 'expo-av';
import { EventEmitter } from 'fbemitter';

export const playerEmitter = new EventEmitter();

let currentSound = null;
let currentTrack = null;
let isPlaying = false;
let playbackStatus = { positionMillis: 0, durationMillis: 1 };

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

    currentSound = sound;
    currentTrack = track;
    isPlaying = true;

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
    await currentSound.stopAsync();
    await currentSound.unloadAsync();
    currentSound = null;
    isPlaying = false;
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
