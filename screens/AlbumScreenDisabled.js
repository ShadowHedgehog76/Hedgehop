// AlbumScreenDisabled.js
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  FlatList,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { playTrack, setGlobalTracks } from '../src/api/player';
import { useDeviceType } from '../src/hooks/useDeviceType';

const { width } = Dimensions.get('window');
const PLAYERBAR_HEIGHT = 90; // ✅ espace pour la playerbar et la tabbar

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlbumScreenDisabled({ route, navigation }) {
  const { album } = route.params;
  const [showCross, setShowCross] = useState(false);
  
  const { isTablet, dimensions, isLandscape } = useDeviceType();

  const imageScale = useRef(new Animated.Value(0.8)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listTranslate = useRef(new Animated.Value(50)).current;

  const getCrossArray = (t) => t?.crossmusic ?? t?.crossMusic ?? t?.cross ?? [];

  const totalCrossCount = useMemo(() => {
    return album.tracks?.reduce((acc, t) => acc + (getCrossArray(t)?.length || 0), 0);
  }, [album]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(imageScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(listTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Layout tablette responsive
  if (isTablet) {
    return (
      <View style={styles.container}>
        {/* Fond flou */}
        <Image source={{ uri: album.image }} style={StyleSheet.absoluteFillObject} blurRadius={25} />
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.darkOverlay} />
        
        {/* Header badges */}
        {(() => {
          const totalTracks = album.tracks?.length || 0;
          const availableTracks = album.tracks?.filter((t) => t.url)?.length || 0;
          
          if (totalTracks === 0) return null;
          
          let stateLabel = 'Coming Soon';
          let color = '#f97316';
          let icon = 'time';

          if (availableTracks === totalTracks && totalTracks > 0) {
            stateLabel = 'Completed';
            color = '#22c55e';
            icon = 'checkmark-circle';
          } else if (availableTracks > 0) {
            stateLabel = 'Working';
            color = '#3b82f6';
            icon = 'construct';
          }

          return (
            <View style={[styles.tabletBadge, { backgroundColor: color }]}>
              <Ionicons name={icon} size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.tabletBadgeText}>{stateLabel}</Text>
              {totalCrossCount > 0 && (
                <>
                  <View style={styles.badgeSeparator} />
                  <Ionicons name="musical-notes" size={14} color="#fff" />
                  <Text style={styles.tabletBadgeText}>{totalCrossCount}</Text>
                </>
              )}
            </View>
          );
        })()}

        {/* Bouton retour */}
        <TouchableOpacity style={styles.tabletBackButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>

        {/* Layout côte-à-côte pour tablette */}
        <View style={styles.tabletLayout}>
          {/* Côté gauche - Album info */}
          <View style={styles.tabletLeftSide}>
            <Animated.Image
              source={{ uri: album.image }}
              style={[styles.tabletAlbumImage, { transform: [{ scale: imageScale }] }]}
            />
            
            <View style={styles.tabletAlbumInfo}>
              <Text style={styles.tabletAlbumTitle}>{album.title}</Text>
              <Text style={styles.tabletTrackCount}>
                {album.tracks?.length || 0} tracks
              </Text>
            </View>
          </View>

          {/* Côté droit - Liste des pistes */}
          <View style={styles.tabletRightSide}>
            <FlatList
              data={album.tracks}
              keyExtractor={(_, i) => i.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item: track }) => {
                const playable = !!track.url;
                return (
                  <View style={styles.tabletTrackWrapper}>
                    <TouchableOpacity
                      style={[styles.tabletTrack, !playable && styles.tabletTrackDisabled]}
                      onPress={() => {
                        if (playable) {
                          const albumTracks = album.tracks
                            .filter((t) => t.url)
                            .map((t) => ({ ...t, album: album.title, image: album.image }));
                          const trackIndex = albumTracks.findIndex((t) => t.title === track.title);
                          setGlobalTracks(albumTracks);
                          playTrack(albumTracks[trackIndex] || albumTracks[0], trackIndex);
                        }
                      }}
                      disabled={!playable}
                    >
                      <View style={styles.tabletTrackLeft}>
                        <Image 
                          source={{ uri: album.image }} 
                          style={styles.tabletTrackIcon} 
                        />
                        <Ionicons 
                          name={playable ? "play-circle" : "time"} 
                          size={20} 
                          color={playable ? "#1f4cff" : "#666"}
                          style={styles.tabletPlayIcon}
                        />
                        <View style={styles.tabletTrackInfo}>
                          <Text style={[styles.tabletTrackTitle, !playable && styles.tabletTrackTitleDisabled]}>
                            {track.title}
                          </Text>
                          {track.artist && (
                            <Text style={styles.tabletTrackArtist}>{track.artist}</Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.tabletTrackRight}>
                        {getCrossArray(track).length > 0 && (
                          <View style={styles.tabletCrossBadge}>
                            <Ionicons name="musical-notes" size={12} color="#1f4cff" />
                            <Text style={styles.tabletCrossCount}>{getCrossArray(track).length}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🌌 Fond flou */}
      <Image source={{ uri: album.image }} style={StyleSheet.absoluteFillObject} blurRadius={25} />
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.darkOverlay} />

      {/* 🏷️ Étiquettes glossy (état + cross) */}
      <View style={styles.topBadges}>
        {(() => {
          const totalTracks = album.tracks?.length || 0;
          const availableTracks = album.tracks?.filter((t) => t.url)?.length || 0;
          let stateLabel = 'Coming Soon';
          let color = '#f97316';
          let icon = 'time';

          if (availableTracks === totalTracks && totalTracks > 0) {
            stateLabel = 'Completed';
            color = '#22c55e';
            icon = 'checkmark-circle';
          } else if (availableTracks > 0) {
            stateLabel = 'Working';
            color = '#3b82f6';
            icon = 'construct';
          }

          return (
            <View style={[styles.crossMusicBadgeTop, { top: 50, right: -23, backgroundColor: color }]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'transparent']}
                style={{
                  ...StyleSheet.absoluteFillObject,
                  top: 0,
                  height: '50%',
                  borderTopLeftRadius: 14,
                  borderBottomLeftRadius: 14,
                  borderTopRightRadius: 26,
                  borderBottomRightRadius: 26,
                }}
              />
              <Ionicons name={icon} size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.crossBadgeTextTop}>{stateLabel}</Text>
            </View>
          );
        })()}

        {totalCrossCount > 0 && (
          <View style={[styles.crossMusicBadgeTop, { top: 100, right: -23 }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'transparent']}
              style={{
                ...StyleSheet.absoluteFillObject,
                top: 0,
                height: '50%',
                borderTopLeftRadius: 14,
                borderBottomLeftRadius: 14,
                borderTopRightRadius: 26,
                borderBottomRightRadius: 26,
              }}
            />
            <Ionicons name="musical-notes" size={18} color="#fff" />
            <Text style={styles.crossBadgeTextTop}>{totalCrossCount} Cross</Text>
          </View>
        )}
      </View>

      {/* === Liste de pistes === */}
      <FlatList
        data={album.tracks}
        keyExtractor={(_, i) => i.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: PLAYERBAR_HEIGHT }} // ✅ Espace en bas
        ListHeaderComponent={
          <>
            {/* Bouton retour */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={26} color="white" />
            </TouchableOpacity>

            {/* En-tête de l’album */}
            <View style={styles.headerSection}>
              <Animated.Image
                source={{ uri: album.image }}
                style={[styles.albumImage, { transform: [{ scale: imageScale }] }]}
              />
              <View style={styles.albumTextBlock}>
                <Text style={styles.albumTitle}>{album.title}</Text>
                <Text style={styles.trackCount}>{album.tracks?.length || 0} tracks</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item: track }) => {
          const playable = !!track.url;
          return (
            <View style={styles.trackWrapper}>
              <TouchableOpacity
                onPress={() => {
                  setGlobalTracks([]);
                  playTrack({ ...track, album: album.title, image: album.image });
                }}
                disabled={!playable}
                style={[styles.trackPill, { opacity: playable ? 1 : 0.5 }]}
              >
                <Image source={{ uri: album.image }} style={styles.trackIcon} />
                <Text
                  style={[styles.trackTitle, { color: playable ? 'white' : '#777' }]}
                  numberOfLines={1}
                >
                  {track.title}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  topBadges: { position: 'absolute', top: 40, right: 0, zIndex: 30 },

  crossMusicBadgeTop: {
    position: 'absolute',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  crossBadgeTextTop: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowRadius: 4,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 30,
    padding: 6,
  },
  headerSection: { alignItems: 'center', marginTop: 110, marginBottom: 30 },
  albumImage: { width: width * 0.6, height: width * 0.6, borderRadius: 20 },
  albumTextBlock: { alignItems: 'center', marginTop: 18 },
  albumTitle: { color: 'white', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  trackCount: { color: '#aaa', fontSize: 14, marginTop: 6 },

  trackWrapper: { marginHorizontal: 20, marginBottom: 10 },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  trackIcon: { width: 45, height: 45, borderRadius: 10, marginRight: 12 },
  trackTitle: { flex: 1, fontSize: 16, fontWeight: '600' },

  // Styles tablette
  tabletBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10,
  },
  tabletBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeSeparator: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },
  tabletBackButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 30,
    padding: 8,
  },
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 120,
    paddingHorizontal: 20,
  },
  tabletLeftSide: {
    flex: 0.35,
    alignItems: 'center',
    paddingRight: 20,
  },
  tabletAlbumImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    maxWidth: 300,
    maxHeight: 300,
    marginBottom: 20,
  },
  tabletAlbumInfo: {
    alignItems: 'center',
    width: '100%',
  },
  tabletAlbumTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  tabletTrackCount: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
  tabletRightSide: {
    flex: 0.65,
    paddingLeft: 20,
  },
  tabletTrackWrapper: {
    marginBottom: 4,
  },
  tabletTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabletTrackDisabled: {
    opacity: 0.5,
  },
  tabletTrackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tabletTrackIcon: {
    width: 45,
    height: 45,
    borderRadius: 8,
    marginRight: 8,
  },
  tabletPlayIcon: {
    marginRight: 8,
  },
  tabletTrackInfo: {
    marginLeft: 8,
    flex: 1,
  },
  tabletTrackTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tabletTrackTitleDisabled: {
    color: '#666',
  },
  tabletTrackArtist: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  tabletTrackRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabletCrossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31,76,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  tabletCrossCount: {
    color: '#1f4cff',
    fontSize: 12,
    fontWeight: '700',
  },
});
