import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useStats } from '../src/hooks/useStats';
import { useDeviceType } from '../src/hooks/useDeviceType';
import { useAlert } from '../src/components/CustomAlert';
import { useAnalyticsTracking } from '../src/hooks/useAnalyticsTracking';
import { trackUserEngagement } from '../src/services/analytics';
import authService from '../src/services/auth';
import { useState, useEffect } from 'react';

export default function StatsScreen({ navigation }) {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const { formattedStats, loading, recordPlay, loadStats, resetStats, exportStats } = useStats();
  const { isTablet, getGridColumns, isLandscape } = useDeviceType();
  const { showAlert } = useAlert();

  // Tracker l'écran
  useAnalyticsTracking('StatsScreen');

  // Écouter les changements d'authentification en temps réel
  useEffect(() => {
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);

    const unsubscribe = authService.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe?.();
  }, []);

  const handleResetStats = () => {
    showAlert({ 
      title: 'Reset statistics',
      message: 'Are you sure you want to clear all your listening statistics?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetStats();
            showAlert({ title: '✅', message: 'Statistics reset', type: 'success' });
          },
        },
      ]
    });
  };

  const handleExportStats = async () => {
    const exported = await exportStats();
    if (exported) {
      showAlert({ 
        title: '📊 Statistics exported',
        message: `Data exported successfully!\n\nTotal plays: ${exported.playCount}\nTotal time: ${Math.floor(exported.totalListeningTime / 60)}h${exported.totalListeningTime % 60}m`,
        type: 'success'
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1f1f1f', '#2a2a2a', '#1a1a1a']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={64} color="white" />
          <Text style={styles.lockTitle}>Sign in required</Text>
          <Text style={styles.lockSubtitle}>You must be logged in to view your statistics</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="musical-notes" size={48} color="#667eea" />
          <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  if (!formattedStats) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="stats-chart" size={48} color="#94a3b8" />
          <Text style={styles.emptyText}>No statistics available</Text>
      </View>
    );
  }

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const StatCard = ({ title, value, icon, color, subtitle, isTablet }) => (
    <View style={[
      styles.statCard, 
      { borderColor: color },
      isTablet && styles.tabletStatCard
    ]}>
      <LinearGradient
        colors={[`${color}20`, `${color}10`, '#1a1a1a']}
        style={styles.statCardGradient}
      >
        <View style={styles.statCardHeader}>
          <Ionicons name={icon} size={isTablet ? 32 : 24} color={color} />
          <Text style={[styles.statCardTitle, isTablet && styles.tabletStatCardTitle]}>
            {title}
          </Text>
        </View>
        <Text style={[
          styles.statCardValue, 
          { color },
          isTablet && styles.tabletStatCardValue
        ]}>
          {value}
        </Text>
        {subtitle && (
          <Text style={[styles.statCardSubtitle, isTablet && styles.tabletStatCardSubtitle]}>
            {subtitle}
          </Text>
        )}
      </LinearGradient>
    </View>
  );

  const RecentActivity = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📈 Recent Activity</Text>
      <View style={styles.activityList}>
        {formattedStats.recentActivity && formattedStats.recentActivity.length > 0 ? (
          formattedStats.recentActivity.slice(0, 8).map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <Ionicons name="play-circle" size={20} color="#22c55e" />
              <Text style={styles.activityText}>
                {activity.trackTitle} - {activity.timeAgo}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.activityItem}>
            <Ionicons name="musical-note" size={20} color="#94a3b8" />
            <Text style={styles.activityText}>No recent activity</Text>
          </View>
        )}
      </View>
    </View>
  );

  const TopTracks = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎵 Top Tracks</Text>
      {formattedStats.topTracks && formattedStats.topTracks.length > 0 ? (
        formattedStats.topTracks.slice(0, 5).map((track, index) => (
          <View key={index} style={styles.topItem}>
            <View style={styles.topItemRank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.topItemInfo}>
              <Text style={styles.topItemTitle}>{track.title}</Text>
              <Text style={styles.topItemPlays}>{track.plays} plays</Text>
            </View>
            <Ionicons name="musical-note" size={20} color="#667eea" />
          </View>
        ))
      ) : (
        <View style={styles.topItem}>
          <View style={styles.topItemRank}>
            <Text style={styles.rankText}>-</Text>
          </View>
          <View style={styles.topItemInfo}>
            <Text style={styles.topItemTitle}>No tracks played</Text>
            <Text style={styles.topItemPlays}>Start listening!</Text>
          </View>
          <Ionicons name="musical-note" size={20} color="#94a3b8" />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Gradient background */}
      <LinearGradient
        colors={['#1f1f1f', '#2a2a2a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
  <Text style={styles.headerTitle}>Listening Statistics</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={loadStats} style={styles.headerButton}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleResetStats} style={styles.headerButton}>
            <Ionicons name="trash" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats principales */}
        <View style={[
          styles.statsGrid, 
          isTablet && styles.tabletStatsGrid
        ]}>
          <StatCard
            title="Total Time"
            value={formatTime(formattedStats.totalListeningTime)}
            icon="time"
            color="#22c55e"
            subtitle="Cumulative"
            isTablet={isTablet}
          />
          
          <StatCard
            title="Plays"
            value={formattedStats.playCount.toString()}
            icon="play"
            color="#3b82f6"
            subtitle="Total"
            isTablet={isTablet}
          />
          
          <StatCard
            title="Streak"
            value={`${formattedStats.streakDays} day${formattedStats.streakDays > 1 ? 's' : ''}`}
            icon="flame"
            color="#f59e0b"
            subtitle="Consecutive"
            isTablet={isTablet}
          />
          
          <StatCard
            title="Avg. Session"
            value={formatTime(formattedStats.averageSessionTime)}
            icon="stopwatch"
            color="#8b5cf6"
            subtitle="Per session"
            isTablet={isTablet}
          />
        </View>

        {/* Favoris */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❤️ Your Favorites</Text>
          
          <View style={styles.favoriteItem}>
            <Ionicons name="albums" size={24} color="#e879f9" />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Favorite Album</Text>
              <Text style={styles.favoriteValue}>{formattedStats.mostPlayedAlbum}</Text>
            </View>
          </View>
          
          <View style={styles.favoriteItem}>
            <Ionicons name="musical-note" size={24} color="#06b6d4" />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Favorite Track</Text>
              <Text style={styles.favoriteValue}>{formattedStats.mostPlayedTrack}</Text>
            </View>
          </View>
          
          <View style={styles.favoriteItem}>
            <Ionicons name="library" size={24} color="#f97316" />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Favorite Genre</Text>
              <Text style={styles.favoriteValue}>{formattedStats.favoriteGenre}</Text>
            </View>
          </View>
        </View>

        {/* Bottom sections - responsive layout */}
        {isTablet ? (
          <View style={styles.tabletBottomSections}>
            <View style={styles.tabletBottomLeft}>
              <TopTracks />
            </View>
            <View style={styles.tabletBottomRight}>
              <RecentActivity />
            </View>
          </View>
        ) : (
          <>
            <TopTracks />
            <RecentActivity />
          </>
        )}
        
        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleExportStats}>
            <Ionicons name="download" size={24} color="#3b82f6" />
            <Text style={styles.actionText}>Export statistics</Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📊 Total of {formattedStats.totalSessions} listening sessions
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  statCardGradient: {
    padding: 16,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginLeft: 8,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statCardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    marginTop: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  favoriteInfo: {
    marginLeft: 16,
    flex: 1,
  },
  favoriteLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  favoriteValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 2,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  topItemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  rankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  topItemInfo: {
    flex: 1,
  },
  topItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  topItemPlays: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 2,
  },
  activityList: {
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityText: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 12,
  },
  footer: {
    marginTop: 32,
    marginBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
    padding: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginLeft: 12,
  },

  // Tablet-specific styles
  tabletStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tabletStatCard: {
    width: '23%',
    minHeight: 140,
  },
  tabletStatCardTitle: {
    fontSize: 16,
  },
  tabletStatCardValue: {
    fontSize: 28,
  },
  tabletStatCardSubtitle: {
    fontSize: 14,
  },
  tabletBottomSections: {
    flexDirection: 'row',
    marginTop: 24,
    justifyContent: 'space-between',
  },
  tabletBottomLeft: {
    flex: 0.48,
  },
  tabletBottomRight: {
    flex: 0.48,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});