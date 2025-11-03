import { useState, useEffect, useCallback } from 'react';
import statsService from '../services/StatsService';

export const useStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les statistiques
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const userStats = await statsService.loadStats();
      setStats(userStats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Enregistrer une nouvelle écoute
  const recordPlay = useCallback(async (albumTitle, trackTitle, category, duration) => {
    try {
      const updatedStats = await statsService.recordPlay(albumTitle, trackTitle, category, duration);
      setStats(updatedStats);
      return updatedStats;
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Calculer les statistiques formatées pour l'affichage
  const getFormattedStats = useCallback(() => {
    if (!stats) return null;

    return {
      totalListeningTime: stats.totalListeningTime || 0,
      playCount: stats.playCount || 0,
      streakDays: stats.streakDays || 0,
      averageSessionTime: statsService.getAverageSessionTime(stats),
      mostPlayedAlbum: statsService.getMostPlayedAlbum(stats),
      mostPlayedTrack: statsService.getMostPlayedTrack(stats),
      favoriteGenre: statsService.getFavoriteCategory(stats),
      topTracks: statsService.getTopTracks(stats, 10),
      recentActivity: statsService.getRecentActivity(stats, 20),
      totalSessions: stats.totalSessions || 0,
    };
  }, [stats]);

  // Réinitialiser les statistiques
  const resetStats = useCallback(async () => {
    try {
      await statsService.resetStats();
      await loadStats();
    } catch (err) {
      setError(err.message);
    }
  }, [loadStats]);

  // Exporter les statistiques
  const exportStats = useCallback(async () => {
    try {
      return await statsService.exportStats();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  // Charger les stats au montage du composant
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    formattedStats: getFormattedStats(),
    loading,
    error,
    recordPlay,
    loadStats,
    resetStats,
    exportStats,
  };
};