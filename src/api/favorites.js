import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'fbemitter';

export const favEmitter = new EventEmitter();
const KEY = 'favorites';

/** Construit un ID unique même si plusieurs alts ont le même titre */
export const buildFavId = (t = {}) => {
  const album = t.album || 'UnknownAlbum';
  // parentTitle = titre de la piste “mère” pour une CrossMusic (ex: "E-Stadium")
  const parent = t.parentTitle || t.parent || '';
  const title = t.title || 'UnknownTrack';
  const url = t.url || '';
  return `${album}::${parent}::${title}::${url}`;
};

export const getFavorites = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const isFavorite = (track, favorites = []) => {
  const favId = buildFavId(track);
  return favorites.some(f => f.favId === favId);
};

export const toggleFavorite = async (track) => {
  const favId = buildFavId(track);
  const current = await getFavorites();
  const exists = current.some(f => f.favId === favId);

  const next = exists
    ? current.filter(f => f.favId !== favId)
    : [...current, { ...track, favId }];

  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  favEmitter.emit('update', next);
  return next;
};
