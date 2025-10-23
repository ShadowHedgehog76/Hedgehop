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
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { playTrack, setGlobalTracks } from '../src/api/player';

const { width } = Dimensions.get('window');
const PLAYERBAR_HEIGHT = 90; // ✅ espace pour la playerbar et la tabbar

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlbumScreenDisabled({ route, navigation }) {
  const { album } = route.params;
  const [showCross, setShowCross] = useState(false);

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

  return (
    <View style={styles.container}>
      {/* 🌌 Fond flou */}
      <Image source={{ uri: album.image }} style={RNStyleSheet.absoluteFillObject} blurRadius={25} />
      <BlurView intensity={60} tint="dark" style={RNStyleSheet.absoluteFillObject} />
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
                  ...RNStyleSheet.absoluteFillObject,
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
                ...RNStyleSheet.absoluteFillObject,
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
  darkOverlay: { ...RNStyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

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
});
