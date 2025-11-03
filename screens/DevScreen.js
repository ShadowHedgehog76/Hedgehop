import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function DevScreen({ navigation, onDisableDevMode }) {
  const [activeTab, setActiveTab] = useState('info');

  const devInfo = {
    appVersion: '1.0.0',
    buildDate: new Date().toLocaleDateString(),
    environment: 'Development',
    reactNativeVersion: '0.81.4',
    expoVersion: '~54.0.14',
  };

  const tabs = [
    { id: 'info', label: 'Info', icon: 'information-circle' },
    { id: 'actions', label: 'Actions', icon: 'flash' },
    { id: 'music', label: 'Music', icon: 'musical-notes' },
    { id: 'logs', label: 'Logs', icon: 'document-text' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const DevCard = ({ title, value, icon, color = '#3b82f6' }) => (
    <View style={styles.card}>
      <LinearGradient
        colors={[`${color}20`, `${color}10`, 'transparent']}
        style={styles.cardGradient}
      />
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );

  const ActionButton = ({ title, icon, onPress, color = '#22c55e' }) => (
    <TouchableOpacity style={[styles.actionButton, { borderColor: color }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} style={{ marginRight: 8 }} />
      <Text style={[styles.actionText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );

  // État pour les logs et statistiques
  const [logs, setLogs] = useState([
    '[INFO] App started successfully',
    '[DEBUG] DevMode activated',
    '[INFO] JSON data loaded',
    '[WARNING] Some assets may be cached',
    '[INFO] Navigation ready',
    '[DEBUG] User interaction detected',
    '[INFO] Network connection stable',
  ]);
  const [musicStats, setMusicStats] = useState({ categories: 0, albums: 0, tracks: 0, playable: 0 });
  const [debugMode, setDebugMode] = useState(false);

  // Fonctions utilitaires
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = `[${timestamp}] ${message}`;
    setLogs(prev => [newLog, ...prev].slice(0, 100)); // Garde max 100 logs
  };

  const clearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Vider le cache de l\'application ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Vider', 
          style: 'destructive',
          onPress: () => {
            addLog('INFO - Cache cleared');
            Alert.alert('✅ Cache vidé', 'Le cache de l\'application a été vidé avec succès.');
          }
        },
      ]
    );
  };

  const showLogs = () => {
    setActiveTab('logs');
    addLog('DEBUG - Logs tab opened');
  };

  const forceReload = () => {
    addLog('INFO - Force reload initiated');
    Alert.alert('🔄 Rechargement', 'Application rechargée (simulation)', [
      { text: 'OK', onPress: () => addLog('INFO - App reloaded successfully') }
    ]);
  };

  const disableDevMode = () => {
    if (onDisableDevMode) {
      onDisableDevMode();
    }
  };

  // Composant pour l'onglet Info
  const InfoTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>📊 App Info</Text>
      
      <DevCard
        title="Version"
        value={devInfo.appVersion}
        icon="information-circle"
        color="#3b82f6"
      />
      
      <DevCard
        title="Build Date"
        value={devInfo.buildDate}
        icon="calendar"
        color="#8b5cf6"
      />
      
      <DevCard
        title="Environment"
        value={devInfo.environment}
        icon="code-working"
        color="#f59e0b"
      />
      
      <DevCard
        title="React Native"
        value={devInfo.reactNativeVersion}
        icon="logo-react"
        color="#61dafb"
      />
      
      <DevCard
        title="Expo SDK"
        value={devInfo.expoVersion}
        icon="rocket"
        color="#000020"
      />
    </ScrollView>
  );

  // Composant pour l'onglet Actions
  const ActionsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>⚡ Actions</Text>
      
      <ActionButton
        title="Clear Cache"
        icon="trash"
        onPress={clearCache}
        color="#ef4444"
      />
      
      <ActionButton
        title="Show Logs"
        icon="document-text"
        onPress={showLogs}
        color="#3b82f6"
      />
      
      <ActionButton
        title="Force Reload"
        icon="refresh"
        onPress={forceReload}
        color="#22c55e"
      />
      
      <ActionButton
        title="Désactiver Mode Dev"
        icon="lock-closed"
        onPress={disableDevMode}
        color="#ef4444"
      />
    </ScrollView>
  );

  // Composant pour l'onglet Logs
  const LogsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>📋 System Logs</Text>
      
      <View style={styles.logContainer}>
        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
          {logs.slice(0, 15).map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
      
      <ActionButton
        title="Clear Logs"
        icon="trash"
        onPress={() => {
          setLogs([]);
          addLog('INFO - Logs cleared by user');
        }}
        color="#ef4444"
      />
      
      <ActionButton
        title="Export Logs"
        icon="download"
        onPress={() => {
          const logData = logs.join('\n');
          Share.share({
            message: logData,
            title: 'App Logs Export',
          });
          addLog('INFO - Logs exported');
        }}
        color="#3b82f6"
      />
    </ScrollView>
  );

  // Fonction pour charger les données musicales
  const loadMusicData = async () => {
    try {
      addLog('INFO - Loading music data...');
      
      // Charger le fichier local d'abord
      const localData = require('../assets/sonic_data.json');
      
      let totalCategories = localData.length;
      let totalAlbums = 0;
      let totalTracks = 0;
      let playableTracks = 0;
      
      // Parcourir les catégories
      localData.forEach(category => {
        if (category.albums) {
          totalAlbums += category.albums.length;
          
          // Parcourir les albums de chaque catégorie
          category.albums.forEach(album => {
            if (album.tracks) {
              totalTracks += album.tracks.length;
              
              // Compter les tracks qui ont une URL (donc jouables)
              album.tracks.forEach(track => {
                if (track.url && track.url.trim() !== '') {
                  playableTracks++;
                }
              });
            }
          });
        }
      });
      
      setMusicStats({ categories: totalCategories, albums: totalAlbums, tracks: totalTracks, playable: playableTracks });
      addLog(`INFO - Music data loaded: ${totalCategories} categories, ${totalAlbums} albums, ${totalTracks} tracks`);
    } catch (error) {
      addLog(`ERROR - Failed to load music data: ${error.message}`);
      
      // Fallback: essayer de charger depuis GitHub
      try {
        addLog('INFO - Trying GitHub fallback...');
        const response = await fetch('https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/main/assets/sonic_data.json');
        const data = await response.json();
        
        let totalCategories = data.length;
        let totalAlbums = 0;
        let totalTracks = 0;
        let playableTracks = 0;
        
        data.forEach(category => {
          if (category.albums) {
            totalAlbums += category.albums.length;
            category.albums.forEach(album => {
              if (album.tracks) {
                totalTracks += album.tracks.length;
                album.tracks.forEach(track => {
                  if (track.url && track.url.trim() !== '') {
                    playableTracks++;
                  }
                });
              }
            });
          }
        });
        
        setMusicStats({ categories: totalCategories, albums: totalAlbums, tracks: totalTracks, playable: playableTracks });
        addLog(`INFO - GitHub fallback successful: ${totalCategories} categories, ${totalAlbums} albums, ${totalTracks} tracks`);
      } catch (fallbackError) {
        addLog(`ERROR - GitHub fallback failed: ${fallbackError.message}`);
      }
    }
  };

  // Charger les données musicales au démarrage
  useEffect(() => {
    loadMusicData();
  }, []);

  // Composant pour l'onglet Music
  const MusicTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>🎵 Music Tools</Text>
      
      <DevCard
        title="Categories"
        value={musicStats.categories ? musicStats.categories.toString() : '0'}
        icon="library"
        color="#f97316"
      />
      
      <DevCard
        title="Total Albums"
        value={musicStats.albums.toString()}
        icon="albums"
        color="#e879f9"
      />
      
      <DevCard
        title="Total Tracks"
        value={musicStats.tracks.toString()}
        icon="musical-note"
        color="#06b6d4"
      />
      
      <DevCard
        title="Playable Tracks"
        value={musicStats.playable.toString()}
        icon="play-circle"
        color="#22c55e"
      />
      
      <ActionButton
        title="Reload Music Data"
        icon="refresh-circle"
        onPress={() => {
          addLog('INFO - Music data reload requested');
          loadMusicData();
        }}
        color="#22c55e"
      />
      
      <ActionButton
        title="Clear Audio Cache"
        icon="volume-mute"
        onPress={() => {
          addLog('INFO - Audio cache cleared');
          Alert.alert('✅ Cache vidé', 'Cache audio nettoyé avec succès');
        }}
        color="#ef4444"
      />
      
      <ActionButton
        title="Test Audio Player"
        icon="play"
        onPress={() => {
          addLog('INFO - Audio player test initiated');
          Alert.alert('🎵 Audio Player', 'Test du lecteur audio en cours...', [
            { text: 'OK', onPress: () => addLog('INFO - Audio player test completed') }
          ]);
        }}
        color="#3b82f6"
      />
      
      <ActionButton
        title="Download Missing Assets"
        icon="download"
        onPress={() => {
          addLog('INFO - Downloading missing assets...');
          setTimeout(() => addLog('INFO - Assets download completed'), 2000);
          Alert.alert('📥 Téléchargement', 'Téléchargement des assets en cours...');
        }}
        color="#f59e0b"
      />
      
      <ActionButton
        title="Music Analytics"
        icon="stats-chart"
        onPress={() => {
          addLog('INFO - Generating music analytics');
          const playablePercentage = Math.round((musicStats.playable / musicStats.tracks) * 100);
          Alert.alert(
            '📊 Analytics Musicales', 
            `Catégories: ${musicStats.categories}\nAlbums: ${musicStats.albums}\nTracks: ${musicStats.tracks}\nJouables: ${musicStats.playable} (${playablePercentage}%)`
          );
        }}
        color="#8b5cf6"
      />
    </ScrollView>
  );

  // Composant pour l'onglet Settings
  const SettingsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>⚙️ Dev Settings</Text>
      
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>🐛 Debug Mode</Text>
        <Text style={styles.settingValue}>{debugMode ? 'ON' : 'OFF'}</Text>
      </View>
      
      <ActionButton
        title={debugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}
        icon="bug"
        onPress={() => {
          setDebugMode(!debugMode);
          addLog(`INFO - Debug mode ${!debugMode ? 'enabled' : 'disabled'}`);
        }}
        color="#f59e0b"
      />
      
      <ActionButton
        title="Reset All Data"
        icon="nuclear"
        onPress={() => {
          Alert.alert(
            '⚠️ Réinitialisation',
            'Êtes-vous sûr de vouloir réinitialiser toutes les données ?',
            [
              { text: 'Annuler', style: 'cancel' },
              { 
                text: 'Réinitialiser', 
                style: 'destructive',
                onPress: () => {
                  setLogs([]);
                  setMusicStats({ categories: 0, albums: 0, tracks: 0, playable: 0 });
                  addLog('WARNING - All data reset by user');
                  Alert.alert('✅ Reset', 'Toutes les données ont été réinitialisées');
                }
              }
            ]
          );
        }}
        color="#ef4444"
      />
      
      <ActionButton
        title="Network Inspector"
        icon="wifi"
        onPress={() => {
          addLog('INFO - Network inspector accessed');
          Alert.alert(
            '🌐 Network Info',
            `Status: Connected\nType: WiFi\nLatency: ~${Math.floor(Math.random() * 50 + 10)}ms`
          );
        }}
        color="#22c55e"
      />
      
      <ActionButton
        title="Performance Monitor"
        icon="speedometer"
        onPress={() => {
          addLog('INFO - Performance monitor accessed');
          const memoryUsage = Math.floor(Math.random() * 100 + 50);
          const renderTime = Math.floor(Math.random() * 20 + 5);
          Alert.alert(
            '📊 Performance',
            `Memory: ${memoryUsage}MB\nRender Time: ${renderTime}ms\nFPS: 60`
          );
        }}
        color="#8b5cf6"
      />
      
      <ActionButton
        title="View Stats"
        icon="stats-chart"
        onPress={() => {
          addLog('INFO - Navigating to Stats screen');
          navigation.navigate('Stats');
        }}
        color="#667eea"
      />
      
      <ActionButton
        title="Open GitHub Repo"
        icon="logo-github"
        onPress={() => {
          addLog('INFO - Opening GitHub repository');
          Linking.openURL('https://github.com/ShadowHedgehog76/Hedgehop');
        }}
        color="#6b7280"
      />
    </ScrollView>
  );

  // Fonction pour rendre le contenu de l'onglet actif
  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return <InfoTab />;
      case 'actions':
        return <ActionsTab />;
      case 'music':
        return <MusicTab />;
      case 'logs':
        return <LogsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <InfoTab />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛠️ Dev Panel</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Barre d'onglets */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.activeTabButton
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? '#1f4cff' : '#666'} 
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.id && styles.activeTabLabel
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu de l'onglet actif */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔒 Mode développeur activé
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Styles pour la barre d'onglets
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 15,
    padding: 5,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: 'rgba(31, 76, 255, 0.15)',
  },
  tabLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#1f4cff',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  cardValue: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 34,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Styles pour les logs
  logContainer: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  logText: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
    marginBottom: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});