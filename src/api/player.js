import { Audio } from 'expo-av';
import { EventEmitter } from 'fbemitter';

export const playerEmitter = new EventEmitter();

let currentSound = null;
let currentTrack = null;
let isPlaying = false;
let playbackStatus = { positionMillis: 0, durationMillis: 1 };

// --- Liste de toutes les pistes disponibles ---
let globalTracks = [];

// 🔹 Définir la liste globale des pistes (doit être appelée depuis l'app)
export function setGlobalTracks(list) {
  if (Array.isArray(list)) {
    globalTracks = list.filter((t) => t?.url); // on garde que les valides
    console.log('🎵 Global tracks enregistrées :', globalTracks.length);
  }
}

// --- Lecture d'une piste ---
export async function playTrack(track) {
  try {
    if (!track?.url) {
      console.warn('❌ Aucune URL pour cette piste :', track);
      return;
    }

    // Décharge l'ancienne piste
    if (currentSound) {
      await currentSound.unloadAsync();
      currentSound = null;
    }

    // Crée et lit la nouvelle
    const { sound } = await Audio.Sound.createAsync(
      { uri: track.url },
      { shouldPlay: true },
      onPlaybackStatusUpdate
    );

    currentSound = sound;
    currentTrack = track;
    isPlaying = true;

    console.log('▶️ Lecture :', track.title);
    playerEmitter.emit('play', { track });
  } catch (err) {
    console.error('Erreur lecture:', err);
  }
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
    console.log('⏹️ Piste terminée → recherche suivante...');
    await handleTrackEnd();
  }
}

// --- Sélection d'une nouvelle piste aléatoire ---
async function handleTrackEnd() {
  if (!globalTracks.length) {
    console.warn('⚠️ Aucun globalTracks défini → fin de lecture');
    return;
  }

  // Filtrage intelligent : pas la même, ni cross liée
  const filtered = globalTracks.filter((t) => {
    if (!t || !currentTrack) return false;
    const same =
      t.title?.trim().toLowerCase() === currentTrack.title?.trim().toLowerCase();
    const crossConflict =
      (t.crossTitle && t.crossTitle === currentTrack.title) ||
      (currentTrack.crossTitle && currentTrack.crossTitle === t.title);
    return !same && !crossConflict;
  });

  if (filtered.length === 0) {
    console.warn('Aucune autre piste trouvée après filtrage.');
    return;
  }

  // Choix aléatoire
  const nextTrack = filtered[Math.floor(Math.random() * filtered.length)];
  console.log('🎲 Lecture aléatoire suivante :', nextTrack.title);

  await playTrack(nextTrack);
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
