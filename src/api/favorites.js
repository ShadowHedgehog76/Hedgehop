import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'fbemitter';
import authService from '../services/auth';

export const favEmitter = new EventEmitter();
const KEY = 'favorites';

/** Construit un ID unique même si plusieurs alts ont le même titre */
export const buildFavId = (t = {}) => {
  const album = t.album || 'UnknownAlbum';
  // parentTitle = titre de la piste "mère" pour une CrossMusic (ex: "E-Stadium")
  const parent = t.parentTitle || t.parent || '';
  const title = t.title || 'UnknownTrack';
  const url = t.url || '';
  return `${album}::${parent}::${title}::${url}`;
};

export const getFavorites = async () => {
  try {
    // Si l'utilisateur est connecté, récupérer depuis Firebase
    if (authService.isAuthenticated()) {
      console.log('🔥 Utilisateur connecté, récupération depuis Firebase...');
      const favorites = await authService.getFavorites();
      console.log('🔥 Favoris Firebase récupérés:', favorites.length);
      return favorites;
    }
    
    // Sinon, utiliser le stockage local (mode hors ligne)
    console.log('💾 Utilisateur non connecté, récupération locale...');
    const raw = await AsyncStorage.getItem(KEY);
    const favorites = raw ? JSON.parse(raw) : [];
    console.log('💾 Favoris locaux récupérés:', favorites.length);
    return favorites;
  } catch (error) {
    console.error('Erreur getFavorites:', error);
    return [];
  }
};

export const isFavorite = (track, favorites = []) => {
  const favId = buildFavId(track);
  return favorites.some(f => f.favId === favId);
};

export const toggleFavorite = async (track) => {
  try {
    const favId = buildFavId(track);
    const current = await getFavorites();
    const exists = current.some(f => f.favId === favId);

    if (authService.isAuthenticated()) {
      // Mode connecté : utiliser Firebase
      if (exists) {
        await authService.removeFavorite(track);
      } else {
        await authService.addFavorite(track);
      }
      
      // Récupérer la liste mise à jour depuis Firebase
      const updatedFavorites = await authService.getFavorites();
      favEmitter.emit('update', updatedFavorites);
      return updatedFavorites;
    } else {
      // Mode hors ligne : utiliser AsyncStorage
      const next = exists
        ? current.filter(f => f.favId !== favId)
        : [...current, { ...track, favId }];

      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      favEmitter.emit('update', next);
      return next;
    }
  } catch (error) {
    console.error('Erreur toggleFavorite:', error);
    // En cas d'erreur, retourner la liste actuelle
    const current = await getFavorites();
    return current;
  }
};

// === FONCTIONS DE SYNCHRONISATION ===

/** 
 * Synchronise les favoris locaux avec Firebase lors de la connexion
 * Fusionne les favoris locaux avec ceux du cloud
 */
export const syncFavoritesToCloud = async () => {
  try {
    if (!authService.isAuthenticated()) return;

    // Récupérer les favoris locaux
    const raw = await AsyncStorage.getItem(KEY);
    const localFavorites = raw ? JSON.parse(raw) : [];
    
    console.log('🔄 Favoris locaux à synchroniser:', localFavorites.length);
    console.log('🔄 Structure du premier favori local:', localFavorites[0]);
    
    // Récupérer les favoris du cloud
    const cloudFavorites = await authService.getFavorites();
    
    console.log('🔄 Favoris cloud existants:', cloudFavorites.length);
    
    // Fusionner les deux listes (éviter les doublons par favId)
    const mergedFavorites = [...cloudFavorites];
    
    localFavorites.forEach(localFav => {
      // S'assurer que le favori local a un favId
      if (!localFav.favId) {
        localFav.favId = buildFavId(localFav);
      }
      
      const existsInCloud = mergedFavorites.some(cloudFav => cloudFav.favId === localFav.favId);
      if (!existsInCloud) {
        console.log('🔄 Ajout du favori local au cloud:', { title: localFav.title, album: localFav.album });
        mergedFavorites.push(localFav);
      }
    });
    
    // Sauvegarder la liste fusionnée dans Firebase
    await authService.saveFavorites(mergedFavorites);
    
    // Nettoyer le stockage local
    await AsyncStorage.removeItem(KEY);
    
    // Notifier les composants de la mise à jour
    favEmitter.emit('update', mergedFavorites);
    
    console.log(`🔄 Synchronisation terminée: ${mergedFavorites.length} favoris synchronisés`);
    return mergedFavorites;
  } catch (error) {
    console.error('Erreur synchronisation favoris vers cloud:', error);
    return [];
  }
};

/** 
 * Sauvegarde les favoris du cloud en local lors de la déconnexion
 */
export const syncFavoritesToLocal = async () => {
  try {
    if (!authService.isAuthenticated()) return;

    const cloudFavorites = await authService.getFavorites();
    await AsyncStorage.setItem(KEY, JSON.stringify(cloudFavorites));
    
    console.log(`${cloudFavorites.length} favoris sauvegardés localement`);
  } catch (error) {
    console.error('Erreur synchronisation favoris vers local:', error);
  }
};

/** 
 * Charge les favoris appropriés selon l'état de connexion
 * À appeler lors du démarrage de l'app ou changement d'état auth
 */
export const loadFavorites = async () => {
  try {
    const favorites = await getFavorites();
    favEmitter.emit('update', favorites);
    return favorites;
  } catch (error) {
    console.error('Erreur chargement favoris:', error);
    return [];
  }
};
