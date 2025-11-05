import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'fbemitter';
import authService from '../services/auth';

export const playlistEmitter = new EventEmitter();

const STORAGE_KEY = 'hedgehop_playlists';

/** 🔄 Récupère toutes les playlists (Firestore si connecté, sinon AsyncStorage) */
export const getPlaylists = async () => {
  try {
    const user = authService.getCurrentUser();
    
    // Si l'utilisateur est connecté, charger depuis Firestore
    if (user) {
      try {
        const firebasePlaylists = await authService.getPlaylists();
        console.log('📋 Playlists chargées depuis Firestore:', firebasePlaylists.length);
        
        // Sauvegarder en local aussi pour le cache
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(firebasePlaylists));
        return firebasePlaylists;
      } catch (firebaseErr) {
        console.warn('⚠️ Erreur Firestore playlists, utilisant local:', firebaseErr.message);
      }
    }
    
    // Sinon ou en cas d'erreur, charger depuis AsyncStorage
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (err) {
    console.error('❌ Erreur lecture playlists', err);
    return [];
  }
};

/** 💾 Sauvegarde les playlists localement ET sur Firestore */
const savePlaylists = async (playlists) => {
  try {
    // Sauvegarder localement
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    playlistEmitter.emit('update', playlists);
    
    // Sauvegarder sur Firestore si connecté
    const user = authService.getCurrentUser();
    if (user) {
      try {
        await authService.savePlaylists(playlists);
        console.log('☁️ Playlists synchronisées avec Firestore');
      } catch (firebaseErr) {
        console.warn('⚠️ Erreur synchronisation Firestore:', firebaseErr.message);
      }
    }
  } catch (err) {
    console.error('❌ Erreur sauvegarde playlists', err);
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

/** 🔄 Synchronise les playlists après connexion utilisateur */
export const syncPlaylistsOnLogin = async () => {
  try {
    const user = authService.getCurrentUser();
    if (!user) {
      console.log('ℹ️ Pas d\'utilisateur connecté pour la synchronisation');
      return;
    }
    
    console.log('🔄 Synchronisation des playlists utilisateur...');
    
    try {
      const firebasePlaylists = await authService.getPlaylists();
      
      if (firebasePlaylists && firebasePlaylists.length > 0) {
        // L'utilisateur a des playlists sur Firestore
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(firebasePlaylists));
        playlistEmitter.emit('update', firebasePlaylists);
        console.log('✅ Playlists synchronisées depuis Firestore:', firebasePlaylists.length);
      } else {
        // Premier login: migrer les playlists locales vers Firestore
        const localPlaylists = await AsyncStorage.getItem(STORAGE_KEY);
        if (localPlaylists) {
          const parsed = JSON.parse(localPlaylists);
          if (parsed.length > 0) {
            await authService.savePlaylists(parsed);
            console.log('☁️ Playlists locales migrées vers Firestore');
          }
        }
      }
    } catch (firebaseErr) {
      console.warn('⚠️ Erreur lors de la synchronisation Firestore:', firebaseErr.message);
    }
  } catch (err) {
    console.error('❌ Erreur syncPlaylistsOnLogin:', err);
  }
};

/** 🗑️ Nettoie les playlists locales après déconnexion */
export const clearPlaylistsOnLogout = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    playlistEmitter.emit('update', []);
    console.log('🗑️ Playlists locales supprimées après déconnexion');
  } catch (err) {
    console.error('❌ Erreur clearPlaylistsOnLogout:', err);
  }
};
