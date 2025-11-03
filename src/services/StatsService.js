import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './auth';

class StatsService {
  constructor() {
    this.STATS_KEY = '@user_stats';
    this.LISTENING_HISTORY_KEY = '@listening_history';
  }

  // Initialiser les stats par défaut
  getDefaultStats() {
    return {
      totalListeningTime: 0, // en minutes
      playCount: 0,
      streakDays: 0,
      lastListeningDate: null,
      favoriteAlbums: {},
      favoriteTracks: {},
      favoriteCategories: {},
      sessions: [],
      totalSessions: 0,
    };
  }

  // Charger les statistiques depuis Firebase ou AsyncStorage
  async loadStats() {
    try {
      // Si l'utilisateur est connecté, récupérer depuis Firebase
      if (authService.isAuthenticated()) {
        console.log('🔥 Chargement statistiques depuis Firebase...');
        const firebaseStats = await authService.getStats();
        if (firebaseStats) {
          console.log('🔥 Statistiques Firebase récupérées');
          return firebaseStats;
        }
        console.log('🔥 Aucunes statistiques Firebase, retour des stats par défaut');
        return this.getDefaultStats();
      }
      
      // Sinon, utiliser le stockage local (mode hors ligne)
      console.log('💾 Chargement statistiques depuis AsyncStorage...');
      const statsString = await AsyncStorage.getItem(this.STATS_KEY);
      if (statsString) {
        const localStats = JSON.parse(statsString);
        console.log('💾 Statistiques locales récupérées');
        return localStats;
      }
      return this.getDefaultStats();
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
      return this.getDefaultStats();
    }
  }

  // Sauvegarder les statistiques dans Firebase ou AsyncStorage
  async saveStats(stats) {
    try {
      if (authService.isAuthenticated()) {
        // Mode connecté : utiliser Firebase
        console.log('🔥 Sauvegarde statistiques dans Firebase...');
        const result = await authService.saveStats(stats);
        if (!result.success) {
          console.error('Erreur Firebase, sauvegarde locale de secours');
          await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
        }
      } else {
        // Mode hors ligne : utiliser AsyncStorage
        console.log('💾 Sauvegarde statistiques dans AsyncStorage...');
        await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des stats:', error);
    }
  }

  // Enregistrer une nouvelle écoute
  async recordPlay(albumTitle, trackTitle, category, duration = 0) {
    try {
      const stats = await this.loadStats();
      const now = new Date();
      
      // Incrémenter le compteur de lectures
      stats.playCount += 1;
      
      // Ajouter le temps d'écoute (en minutes)
      const durationMinutes = Math.ceil(duration / 60000) || 3; // Par défaut 3 min si pas de durée
      stats.totalListeningTime += durationMinutes;
      
      // Mettre à jour les favoris
      if (albumTitle) {
        stats.favoriteAlbums[albumTitle] = (stats.favoriteAlbums[albumTitle] || 0) + 1;
      }
      
      if (trackTitle) {
        stats.favoriteTracks[trackTitle] = (stats.favoriteTracks[trackTitle] || 0) + 1;
      }
      
      if (category) {
        stats.favoriteCategories[category] = (stats.favoriteCategories[category] || 0) + 1;
      }
      
      // Calculer la série de jours
      await this.updateStreak(stats, now);
      
      // Ajouter à l'historique des sessions
      stats.sessions.push({
        albumTitle,
        trackTitle,
        category,
        duration: durationMinutes,
        timestamp: now.toISOString(),
      });
      
      // Garder seulement les 100 dernières sessions
      if (stats.sessions.length > 100) {
        stats.sessions = stats.sessions.slice(-100);
      }
      
      stats.totalSessions += 1;
      stats.lastListeningDate = now.toISOString();
      
      await this.saveStats(stats);
      return stats;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la lecture:', error);
    }
  }

  // Mettre à jour la série de jours consécutifs
  async updateStreak(stats, currentDate) {
    const lastDate = stats.lastListeningDate ? new Date(stats.lastListeningDate) : null;
    
    if (!lastDate) {
      stats.streakDays = 1;
      return;
    }
    
    const daysDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Jour consécutif
      stats.streakDays += 1;
    } else if (daysDiff > 1) {
      // Série brisée
      stats.streakDays = 1;
    }
    // Si daysDiff === 0, c'est le même jour, on ne change rien
  }

  // Obtenir l'album le plus écouté
  getMostPlayedAlbum(stats) {
    if (!stats.favoriteAlbums || Object.keys(stats.favoriteAlbums).length === 0) {
      return 'Aucun';
    }
    
    return Object.entries(stats.favoriteAlbums)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  // Obtenir la track la plus écoutée
  getMostPlayedTrack(stats) {
    if (!stats.favoriteTracks || Object.keys(stats.favoriteTracks).length === 0) {
      return 'Aucune';
    }
    
    return Object.entries(stats.favoriteTracks)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  // Obtenir la catégorie préférée
  getFavoriteCategory(stats) {
    if (!stats.favoriteCategories || Object.keys(stats.favoriteCategories).length === 0) {
      return 'Aucune';
    }
    
    return Object.entries(stats.favoriteCategories)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  // Obtenir le top des tracks
  getTopTracks(stats, limit = 10) {
    if (!stats.favoriteTracks) return [];
    
    return Object.entries(stats.favoriteTracks)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([track, count]) => ({ title: track, plays: count }));
  }

  // Obtenir l'activité récente
  getRecentActivity(stats, limit = 10) {
    if (!stats.sessions) return [];
    
    return stats.sessions
      .slice(-limit)
      .reverse()
      .map(session => ({
        ...session,
        timeAgo: this.getTimeAgo(new Date(session.timestamp)),
      }));
  }

  // Calculer le temps écoulé
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `Il y a ${diffDays}j`;
    if (diffHours > 0) return `Il y a ${diffHours}h`;
    if (diffMins > 0) return `Il y a ${diffMins}min`;
    return 'À l\'instant';
  }

  // Calculer la durée moyenne des sessions
  getAverageSessionTime(stats) {
    if (!stats.sessions || stats.sessions.length === 0) return 0;
    
    const totalTime = stats.sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    return Math.floor(totalTime / stats.sessions.length);
  }

  // Réinitialiser toutes les statistiques
  async resetStats() {
    try {
      await AsyncStorage.removeItem(this.STATS_KEY);
      await AsyncStorage.removeItem(this.LISTENING_HISTORY_KEY);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation des stats:', error);
    }
  }

  // Exporter les statistiques
  async exportStats() {
    try {
      const stats = await this.loadStats();
      return {
        exportDate: new Date().toISOString(),
        ...stats,
      };
    } catch (error) {
      console.error('Erreur lors de l\'export des stats:', error);
      return null;
    }
  }

  // === FONCTIONS DE SYNCHRONISATION ===

  // Synchroniser les statistiques locales vers Firebase lors de la connexion
  async syncStatsToCloud() {
    try {
      if (!authService.isAuthenticated()) return null;

      // Récupérer les statistiques locales
      const statsString = await AsyncStorage.getItem(this.STATS_KEY);
      const localStats = statsString ? JSON.parse(statsString) : this.getDefaultStats();
      
      console.log('🔄 Synchronisation statistiques vers Firebase...');
      console.log('🔄 Stats locales:', { 
        playCount: localStats.playCount,
        totalListeningTime: localStats.totalListeningTime 
      });
      
      // Récupérer les statistiques du cloud
      const cloudStats = await authService.getStats() || this.getDefaultStats();
      
      console.log('🔄 Stats cloud:', { 
        playCount: cloudStats.playCount,
        totalListeningTime: cloudStats.totalListeningTime 
      });
      
      // Fusionner les statistiques (additionner les compteurs)
      const mergedStats = this.mergeStats(localStats, cloudStats);
      
      // Sauvegarder la fusion dans Firebase
      await authService.saveStats(mergedStats);
      
      // Nettoyer le stockage local
      await AsyncStorage.removeItem(this.STATS_KEY);
      
      console.log('🔄 Synchronisation terminée:', { 
        playCount: mergedStats.playCount,
        totalListeningTime: mergedStats.totalListeningTime 
      });
      
      return mergedStats;
    } catch (error) {
      console.error('Erreur synchronisation statistiques vers cloud:', error);
      return null;
    }
  }

  // Sauvegarder les statistiques du cloud en local lors de la déconnexion
  async syncStatsToLocal() {
    try {
      if (!authService.isAuthenticated()) return;

      const cloudStats = await authService.getStats();
      if (cloudStats) {
        await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(cloudStats));
        console.log('🔄 Statistiques sauvegardées localement');
      }
    } catch (error) {
      console.error('Erreur synchronisation statistiques vers local:', error);
    }
  }

  // Fusionner deux objets de statistiques
  mergeStats(localStats, cloudStats) {
    const merged = { ...this.getDefaultStats() };
    
    // Additionner les compteurs numériques
    merged.totalListeningTime = (localStats.totalListeningTime || 0) + (cloudStats.totalListeningTime || 0);
    merged.playCount = (localStats.playCount || 0) + (cloudStats.playCount || 0);
    merged.totalSessions = (localStats.totalSessions || 0) + (cloudStats.totalSessions || 0);
    
    // Prendre la plus grande série
    merged.streakDays = Math.max(localStats.streakDays || 0, cloudStats.streakDays || 0);
    
    // Fusionner les albums favoris
    merged.favoriteAlbums = { ...localStats.favoriteAlbums, ...cloudStats.favoriteAlbums };
    for (const album in localStats.favoriteAlbums) {
      if (cloudStats.favoriteAlbums?.[album]) {
        merged.favoriteAlbums[album] = localStats.favoriteAlbums[album] + cloudStats.favoriteAlbums[album];
      }
    }
    
    // Fusionner les pistes favorites
    merged.favoriteTracks = { ...localStats.favoriteTracks, ...cloudStats.favoriteTracks };
    for (const track in localStats.favoriteTracks) {
      if (cloudStats.favoriteTracks?.[track]) {
        merged.favoriteTracks[track] = localStats.favoriteTracks[track] + cloudStats.favoriteTracks[track];
      }
    }
    
    // Fusionner les catégories favorites
    merged.favoriteCategories = { ...localStats.favoriteCategories, ...cloudStats.favoriteCategories };
    for (const category in localStats.favoriteCategories) {
      if (cloudStats.favoriteCategories?.[category]) {
        merged.favoriteCategories[category] = localStats.favoriteCategories[category] + cloudStats.favoriteCategories[category];
      }
    }
    
    // Combiner les sessions (garder les 100 plus récentes)
    const allSessions = [...(localStats.sessions || []), ...(cloudStats.sessions || [])];
    allSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    merged.sessions = allSessions.slice(0, 100);
    
    // Prendre la date la plus récente
    const localDate = localStats.lastListeningDate ? new Date(localStats.lastListeningDate) : new Date(0);
    const cloudDate = cloudStats.lastListeningDate ? new Date(cloudStats.lastListeningDate) : new Date(0);
    merged.lastListeningDate = localDate > cloudDate ? localStats.lastListeningDate : cloudStats.lastListeningDate;
    
    return merged;
  }
}

// Instance singleton
const statsService = new StatsService();
export default statsService;