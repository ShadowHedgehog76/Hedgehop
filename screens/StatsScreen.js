import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useStats } from '../src/hooks/useStats';

export default function StatsScreen({ navigation }) {
  const { formattedStats, loading, recordPlay, loadStats, resetStats, exportStats } = useStats();

  const handleResetStats = () => {
    Alert.alert(
      'Réinitialiser les statistiques',
      'Êtes-vous sûr de vouloir effacer toutes vos statistiques d\'écoute ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            await resetStats();
            Alert.alert('✅', 'Statistiques réinitialisées');
          },
        },
      ]
    );
  };

  const handleExportStats = async () => {
    const exported = await exportStats();
    if (exported) {
      Alert.alert(
        '📊 Statistiques Exportées',
        `Données exportées avec succès !\n\nTotal écoutes: ${exported.playCount}\nTemps total: ${Math.floor(exported.totalListeningTime / 60)}h${exported.totalListeningTime % 60}m`
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="musical-notes" size={48} color="#667eea" />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  if (!formattedStats) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="stats-chart" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>Aucune statistique disponible</Text>
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

  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <View style={[styles.statCard, { borderColor: color }]}>
      <LinearGradient
        colors={[`${color}20`, `${color}10`, '#1a1a1a']}
        style={styles.statCardGradient}
      >
        <View style={styles.statCardHeader}>
          <Ionicons name={icon} size={24} color={color} />
          <Text style={styles.statCardTitle}>{title}</Text>
        </View>
        <Text style={[styles.statCardValue, { color }]}>{value}</Text>
        {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
      </LinearGradient>
    </View>
  );

  const RecentActivity = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📈 Activité Récente</Text>
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
            <Text style={styles.activityText}>Aucune activité récente</Text>
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
              <Text style={styles.topItemPlays}>{track.plays} écoutes</Text>
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
            <Text style={styles.topItemTitle}>Aucune track écoutée</Text>
            <Text style={styles.topItemPlays}>Commencez à écouter !</Text>
          </View>
          <Ionicons name="musical-note" size={20} color="#94a3b8" />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1f1f1f', '#2a2a2a', '#1a1a1a']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Statistiques d'Écoute</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={loadStats} style={styles.headerButton}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleResetStats} style={styles.headerButton}>
            <Ionicons name="trash" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats principales */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Temps Total"
            value={formatTime(formattedStats.totalListeningTime)}
            icon="time"
            color="#22c55e"
            subtitle="Cumulé"
          />
          
          <StatCard
            title="Écoutes"
            value={formattedStats.playCount.toString()}
            icon="play"
            color="#3b82f6"
            subtitle="Total"
          />
          
          <StatCard
            title="Série"
            value={`${formattedStats.streakDays} jour${formattedStats.streakDays > 1 ? 's' : ''}`}
            icon="flame"
            color="#f59e0b"
            subtitle="Consécutifs"
          />
          
          <StatCard
            title="Session Moy."
            value={formatTime(formattedStats.averageSessionTime)}
            icon="stopwatch"
            color="#8b5cf6"
            subtitle="Par écoute"
          />
        </View>

        {/* Favoris */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❤️ Vos Favoris</Text>
          
          <View style={styles.favoriteItem}>
            <Ionicons name="albums" size={24} color="#e879f9" />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Album Préféré</Text>
              <Text style={styles.favoriteValue}>{formattedStats.mostPlayedAlbum}</Text>
            </View>
          </View>
          
          <View style={styles.favoriteItem}>
            <Ionicons name="musical-note" size={24} color="#06b6d4" />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Track Préférée</Text>
              <Text style={styles.favoriteValue}>{formattedStats.mostPlayedTrack}</Text>
            </View>
          </View>
          
          <View style={styles.favoriteItem}>
            <Ionicons name="library" size={24} color="#f97316" />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Genre Préféré</Text>
              <Text style={styles.favoriteValue}>{formattedStats.favoriteGenre}</Text>
            </View>
          </View>
        </View>

        <TopTracks />
        <RecentActivity />
        
        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleExportStats}>
            <Ionicons name="download" size={24} color="#3b82f6" />
            <Text style={styles.actionText}>Exporter statistiques</Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📊 Total de {formattedStats.totalSessions} sessions d'écoute
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
});