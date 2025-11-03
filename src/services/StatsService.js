import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Charger les statistiques depuis AsyncStorage
  async loadStats() {
    try {
      const statsString = await AsyncStorage.getItem(this.STATS_KEY);
      if (statsString) {
        return JSON.parse(statsString);
      }
      return this.getDefaultStats();
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
      return this.getDefaultStats();
    }
  }

  // Sauvegarder les statistiques
  async saveStats(stats) {
    try {
      await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
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
}

// Instance singleton
const statsService = new StatsService();
export default statsService;