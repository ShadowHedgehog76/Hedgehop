import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'fbemitter';

export const playlistEmitter = new EventEmitter();

const STORAGE_KEY = 'hedgehop_playlists';

/** 🔄 Récupère toutes les playlists */
export const getPlaylists = async () => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (err) {
    console.error('Erreur lecture playlists', err);
    return [];
  }
};

/** 💾 Sauvegarde les playlists */
const savePlaylists = async (playlists) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    playlistEmitter.emit('update', playlists);
  } catch (err) {
    console.error('Erreur sauvegarde playlists', err);
  }
};

/** ➕ Crée une nouvelle playlist */
export const createPlaylist = async (name = 'New playlist', tracks = []) => {
  const playlists = await getPlaylists();
  const newPlaylist = {
    id: `pl_${Date.now().toString(36)}`,
    name,
    tracks,
    createdAt: Date.now(),
  };
  const updated = [...playlists, newPlaylist];
  await savePlaylists(updated);
  return newPlaylist;
};

/** ✅ Upsert par nom (idempotent): si une playlist du même nom existe (insensible à la casse), on remplace ses morceaux; sinon on la crée. */
export const upsertPlaylistByName = async (name = 'Playlist importée', tracks = []) => {
  const playlists = await getPlaylists();

  const norm = (name || '').trim();
  const normLower = norm.toLowerCase();

  // Dédoublonne les morceaux par (url || title+album+crossTitle)
  const seen = new Set();
  const dedupedTracks = [];
  for (const t of Array.isArray(tracks) ? tracks : []) {
    const key = t?.url
      ? `u:${t.url}`
      : `m:${t.title || ''}|${t.album || ''}|${t.crossTitle || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedTracks.push(t);
    }
  }

  const idx = playlists.findIndex((p) => (p.name || '').trim().toLowerCase() === normLower);
  if (idx >= 0) {
    // Remplace le contenu sans créer un doublon
    const existing = playlists[idx];
    const updatedOne = {
      ...existing,
      name: norm || existing.name,
      tracks: dedupedTracks,
      updatedAt: Date.now(),
    };
    const updated = [...playlists];
    updated[idx] = updatedOne;
    await savePlaylists(updated);
    return updatedOne;
  }

  // Sinon, crée une nouvelle playlist
  const newPlaylist = {
    id: `pl_${Date.now().toString(36)}`,
    name: norm || 'Playlist importée',
    tracks: dedupedTracks,
    createdAt: Date.now(),
  };
  const updated = [...playlists, newPlaylist];
  await savePlaylists(updated);
  return newPlaylist;
};

/** 🧩 Ajoute un morceau à une playlist donnée */
export const addTrack = async (playlistId, track) => {
  const playlists = await getPlaylists();
  const updated = playlists.map((p) => {
    if (p.id === playlistId) {
      // Vérifie si le morceau existe déjà
      const already = p.tracks.some(
        (t) =>
          t.title === track.title &&
          t.album === track.album &&
          (t.crossTitle || '') === (track.crossTitle || '')
      );
      if (!already) {
        p.tracks.push(track);
      }
    }
    return p;
  });
  await savePlaylists(updated);
};

/** 🗑️ Supprime un morceau d’une playlist */
export const removeTrack = async (playlistId, track) => {
  const playlists = await getPlaylists();
  const updated = playlists.map((p) => {
    if (p.id === playlistId) {
      p.tracks = p.tracks.filter(
        (t) =>
          !(
            t.title === track.title &&
            t.album === track.album &&
            (t.crossTitle || '') === (track.crossTitle || '')
          )
      );
    }
    return p;
  });
  await savePlaylists(updated);
};

/** 🗑️ Supprime complètement une playlist */
export const deletePlaylist = async (playlistId) => {
  const playlists = await getPlaylists();
  const updated = playlists.filter((p) => p.id !== playlistId);
  await savePlaylists(updated);
};

/** ✏️ Renomme une playlist */
export const renamePlaylist = async (playlistId, newName) => {
  const playlists = await getPlaylists();
  const updated = playlists.map((p) =>
    p.id === playlistId ? { ...p, name: newName } : p
  );
  await savePlaylists(updated);
};
