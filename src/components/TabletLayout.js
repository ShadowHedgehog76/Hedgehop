import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PlayerBar from './PlayerBar';

// CrossParty supprimé

export default function TabletLayout({ 
  activeTab, 
  onTabPress, 
  children, 
  devModeEnabled, 
  onDisableDevMode,
  isLandscape,
  navigation 
}) {
  // CrossParty supprimé
  const tabs = [
    { id: 'Home', label: 'Home', icon: 'home' },
    { id: 'Favorites', label: 'Favorites', icon: 'heart' },
    { id: 'News', label: 'News', icon: 'time' },
    { id: 'Stats', label: 'Stats', icon: 'stats-chart' },
    { id: 'Player', label: 'Player', icon: 'play-circle' },
    { id: 'You', label: 'You', icon: 'person' },
  ];

  if (devModeEnabled) {
    tabs.push({ id: 'Dev', label: 'Dev', icon: 'code-working' });
  }

  const SidebarTab = ({ tab, isActive }) => (
    <TouchableOpacity
      style={[styles.sidebarTab, isActive && styles.sidebarTabActive]}
      onPress={() => onTabPress(tab.id)}
    >
      <LinearGradient
        colors={isActive ? ['#1f4cff', '#0038cc'] : ['transparent', 'transparent']}
        style={styles.tabGradient}
      >
        <Ionicons 
          name={tab.icon} 
          size={24} 
          color={isActive ? '#fff' : '#9ca3af'} 
        />
        <Text style={[
          styles.tabLabel, 
          isActive && styles.tabLabelActive
        ]}>
          {tab.label}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Sidebar Navigation */}
      <View style={[
        styles.sidebar,
        isLandscape ? styles.sidebarLandscape : styles.sidebarPortrait
      ]}>
        <LinearGradient
          colors={['#1a1a1a', '#2a2a2a']}
          style={styles.sidebarGradient}
        >
          {/* Logo/Title */}
          <View style={styles.sidebarHeader}>
            <Text style={styles.appTitle}>🎵 Hedgehop</Text>
            {devModeEnabled && (
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>DEV</Text>
              </View>
            )}
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => (
              <SidebarTab
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
              />
            ))}
          </View>

          {/* CrossParty supprimé */}

          {/* PlayerBar intégrée dans la sidebar */}
          <View style={styles.sidebarPlayerBar}>
            <PlayerBar isTabletSidebar={true} onTabletNavigateToPlayer={() => onTabPress('Player')} />
          </View>

          {/* Dev Controls */}
          {devModeEnabled && (
            <TouchableOpacity
              style={styles.devDisableButton}
              onPress={onDisableDevMode}
            >
              <Ionicons name="lock-closed" size={20} color="#ef4444" />
              <Text style={styles.devDisableText}>Disable Dev Mode</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f0f0f',
  },
  sidebar: {
    backgroundColor: '#1a1a1a',
    borderRightWidth: 1,
    borderRightColor: '#333333',
  },
  sidebarPortrait: {
    width: 280,
  },
  sidebarLandscape: {
    width: 320,
  },
  sidebarGradient: {
    flex: 1,
    paddingVertical: 20,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  devBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 8,
  },
  devBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  sidebarTab: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sidebarTabActive: {
    // Style géré par le gradient
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9ca3af',
    marginLeft: 12,
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sidebarPlayerBar: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    marginTop: 10,
  },
  // CrossParty supprimé
  devDisableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginTop: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  devDisableText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
});