// auth.js - Service d'authentification Firebase
import { 
  initializeAuth,
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  getReactNativePersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../config/firebaseConfig';

// Initialisation Firebase (évite la double initialisation)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialisation de l'authentification avec persistence AsyncStorage
let auth;
try {
  auth = getAuth(app);
} catch (error) {
  // Si getAuth échoue, initialiser avec persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const db = getFirestore(app);

class AuthService {
  constructor() {
    this.auth = auth;
    this.currentUser = null;
    this.listeners = [];
  }

  // Inscription d'un nouvel utilisateur
  async register(email, password, displayName = null) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // Mise à jour du profil avec le nom d'affichage
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      
      // Sauvegarde locale
      await this.saveUserToStorage(user);
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || displayName,
          photoURL: user.photoURL
        }
      };
    } catch (error) {
      console.error('Erreur inscription:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Connexion utilisateur existant
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // Sauvegarde locale
      await this.saveUserToStorage(user);
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      };
    } catch (error) {
      console.error('Erreur connexion:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Déconnexion
  async logout() {
    try {
      await signOut(this.auth);
      await AsyncStorage.removeItem('user');
      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      return {
        success: false,
        error: 'Erreur lors de la déconnexion'
      };
    }
  }

  // Obtenir l'utilisateur actuel
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // Écouter les changements d'état d'authentification
  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      callback(user);
    });
  }

  // Sauvegarde utilisateur en local
  async saveUserToStorage(user) {
    try {
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString()
      };
      await AsyncStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Erreur sauvegarde locale:', error);
    }
  }

  // Récupération utilisateur depuis le stockage local
  async getUserFromStorage() {
    try {
      const userData = await AsyncStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Erreur récupération locale:', error);
      return null;
    }
  }

  // Écouter les changements d'état d'authentification
  onAuthStateChange(callback) {
    return onAuthStateChanged(this.auth, callback);
  }

  // Messages d'erreur traduits
  getErrorMessage(errorCode) {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée';
      case 'auth/invalid-email':
        return 'Adresse email invalide';
      case 'auth/operation-not-allowed':
        return 'Opération non autorisée';
      case 'auth/weak-password':
        return 'Mot de passe trop faible (minimum 6 caractères)';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé';
      case 'auth/user-not-found':
        return 'Aucun compte trouvé avec cette adresse email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/invalid-credential':
        return 'Identifiants invalides';
      case 'auth/network-request-failed':
        return 'Erreur de connexion réseau';
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }

  // Vérifier si l'utilisateur est connecté
  isAuthenticated() {
    return !!this.auth.currentUser;
  }

  // Mise à jour du profil utilisateur
  async updateUserProfile(updates) {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' };
      }

      await updateProfile(user, updates);
      await this.saveUserToStorage(user);
      
      return { success: true };
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      return {
        success: false,
        error: 'Erreur lors de la mise à jour du profil'
      };
    }
  }

  // === GESTION DES FAVORIS UTILISATEUR ===

  // Sauvegarder les favoris de l'utilisateur
  async saveFavorites(favorites) {
    try {
      const user = this.auth.currentUser;
      if (!user) return { success: false, error: 'Utilisateur non connecté' };

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { favorites }, { merge: true });
      
      return { success: true };
    } catch (error) {
      console.error('Erreur sauvegarde favoris:', error);
      return { success: false, error: 'Erreur lors de la sauvegarde des favoris' };
    }
  }

  // Récupérer les favoris de l'utilisateur
  async getFavorites() {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        console.log('🔥 Aucun utilisateur connecté pour récupérer les favoris');
        return [];
      }

      console.log('🔥 Récupération favoris pour utilisateur:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        const favorites = data.favorites || [];
        console.log('🔥 Favoris trouvés dans Firestore:', favorites.length);
        console.log('🔥 Structure du premier favori:', favorites[0]);
        
        // 🔧 CORRECTION: Nettoyer et normaliser les données
        const cleanedFavorites = favorites.map((fav, index) => {
          console.log(`🔧 Favori ${index} RAW from Firestore:`, JSON.stringify(fav));
          console.log(`🔧 Favori ${index} avant nettoyage:`, {
            title: fav.title,
            titleType: typeof fav.title,
            titleLength: fav.title ? fav.title.length : 'null/undefined',
            allKeys: Object.keys(fav)
          });
          
          // Essayer de récupérer le titre de différentes façons
          let finalTitle = fav.title;
          if (!finalTitle && typeof fav.title === 'object') {
            console.log('🔧 Titre est un objet:', fav.title);
            finalTitle = fav.title.stringValue || fav.title._value || String(fav.title);
          }
          if (!finalTitle) {
            finalTitle = fav.name || fav.trackName || `Track ${index + 1}`;
          }
          
          const cleaned = {
            ...fav,
            title: finalTitle,
            album: fav.album || fav.albumName || 'Album inconnu',
            url: fav.url || '',
            image: fav.image || '',
            favId: fav.favId || this.buildFavId(fav)
          };
          
          console.log(`🔧 Favori ${index} après nettoyage:`, {
            title: cleaned.title,
            album: cleaned.album,
            hasUrl: !!cleaned.url
          });
          
          return cleaned;
        });
        
        return cleanedFavorites;
      }
      
      console.log('🔥 Aucun document utilisateur trouvé dans Firestore');
      return [];
    } catch (error) {
      console.error('Erreur récupération favoris:', error);
      return [];
    }
  }

  // Ajouter un favori
  async addFavorite(track) {
    try {
      const user = this.auth.currentUser;
      if (!user) return { success: false, error: 'Utilisateur non connecté' };

      // Construire l'ID unique du favori
      const favId = this.buildFavId(track);
      const favoriteTrack = { ...track, favId };

      console.log('🔥 Ajout favori - Track original:', {
        title: track.title,
        album: track.album,
        artist: track.artist,
        url: track.url
      });
      console.log('🔥 Ajout favori - Track complet à sauvegarder:', favoriteTrack);

      const userDocRef = doc(db, 'users', user.uid);
      
      // Vérifier si le document existe, le créer si nécessaire
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, { favorites: [favoriteTrack] });
        console.log('🔥 Document créé avec premier favori');
      } else {
        await updateDoc(userDocRef, {
          favorites: arrayUnion(favoriteTrack)
        });
        console.log('🔥 Favori ajouté au document existant');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erreur ajout favori:', error);
      return { success: false, error: 'Erreur lors de l\'ajout du favori' };
    }
  }

  // Supprimer un favori
  async removeFavorite(track) {
    try {
      const user = this.auth.currentUser;
      if (!user) return { success: false, error: 'Utilisateur non connecté' };

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const currentFavorites = userDoc.data().favorites || [];
        const favId = this.buildFavId(track);
        
        // Filtrer pour supprimer le favori
        const updatedFavorites = currentFavorites.filter(f => f.favId !== favId);
        
        await updateDoc(userDocRef, {
          favorites: updatedFavorites
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erreur suppression favori:', error);
      return { success: false, error: 'Erreur lors de la suppression du favori' };
    }
  }

  // Construire un ID unique pour un favori (même logique que favorites.js)
  buildFavId(track = {}) {
    const album = track.album || 'UnknownAlbum';
    const parent = track.parentTitle || track.parent || '';
    const title = track.title || 'UnknownTrack';
    const url = track.url || '';
    return `${album}::${parent}::${title}::${url}`;
  }

  // Vérifier si une piste est dans les favoris
  async isFavorite(track) {
    try {
      const favorites = await this.getFavorites();
      const favId = this.buildFavId(track);
      return favorites.some(f => f.favId === favId);
    } catch (error) {
      console.error('Erreur vérification favori:', error);
      return false;
    }
  }

  // === GESTION DES STATISTIQUES UTILISATEUR ===

  // Sauvegarder les statistiques de l'utilisateur
  async saveStats(stats) {
    try {
      const user = this.auth.currentUser;
      if (!user) return { success: false, error: 'Utilisateur non connecté' };

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { stats }, { merge: true });
      
      console.log('🔥 Statistiques sauvegardées dans Firebase');
      return { success: true };
    } catch (error) {
      console.error('Erreur sauvegarde statistiques:', error);
      return { success: false, error: 'Erreur lors de la sauvegarde des statistiques' };
    }
  }

  // Récupérer les statistiques de l'utilisateur
  async getStats() {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        console.log('🔥 Aucun utilisateur connecté pour récupérer les statistiques');
        return null;
      }

      console.log('🔥 Récupération statistiques pour utilisateur:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        const stats = data.stats || null;
        console.log('🔥 Statistiques trouvées dans Firestore:', !!stats);
        return stats;
      }
      
      console.log('🔥 Aucunes statistiques trouvées dans Firestore');
      return null;
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      return null;
    }
  }
}

// Instance singleton du service d'authentification
const authService = new AuthService();

export default authService;