import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  UIManager,
  LayoutAnimation,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { playTrack, setGlobalTracks } from '../src/api/player';
import { getFavorites, toggleFavorite, favEmitter } from '../src/api/favorites';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const imageScale = useRef(new Animated.Value(0.8)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listTranslate = useRef(new Animated.Value(50)).current;

  // --- Chargement & synchro favoris ---
  useEffect(() => {
    (async () => {
      const favs = await getFavorites();
      setFavorites(favs);
    })();

    const sub = favEmitter.addListener('update', (favs) => setFavorites(favs));
    return () => sub.remove();
  }, []);

  // --- Animations d’entrée ---
  useEffect(() => {
    Animated.sequence([
      Animated.spring(imageScale, { toValue: 1, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(listTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleFavorite = async (track) => {
    await toggleFavorite(track);
  };

  const isFav = (track) =>
    favorites.some(
      (f) =>
        f.title === track.title &&
        f.album === track.album &&
        (f.crossTitle === track.crossTitle || !f.crossTitle)
    );

  // --- Lecture de tous les favoris ---
  const handlePlayAll = () => {
    const playable = favorites.filter((t) => t.url);
    if (playable.length === 0) return;
    setGlobalTracks(playable);
    playTrack(playable[0], 0);
  };

  // --- Générer la mosaïque du fond ---
  const getMosaicGrid = () => {
    const imgs = favorites.slice(0, 4).map((f) => f.image);
    while (imgs.length < 4) imgs.push(imgs[0] || null);
    return imgs;
  };
  const mosaicImages = getMosaicGrid();

  return (
    <View style={styles.container}>
      {/* 🌌 Fond mosaïque + flou */}
      <View style={styles.backgroundWrapper}>
        {mosaicImages.map((img, i) => (
          <Image
            key={i}
            source={img ? { uri: img } : null}
            style={styles.mosaicTile}
            resizeMode="cover"
          />
        ))}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.darkOverlay} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        {/* === EN-TÊTE === */}
        <View style={styles.headerSection}>
          <Animated.View style={{ transform: [{ scale: imageScale }] }}>
            <View style={styles.mosaicContainer}>
              {mosaicImages.map((img, i) => (
                <Image key={i} source={img ? { uri: img } : null} style={styles.mosaicImage} />
              ))}
            </View>
          </Animated.View>

          <View style={styles.albumTextBlock}>
            <Text style={styles.albumTitle}>Favoris</Text>
            <Text style={styles.trackCount}>{favorites.length} pistes</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: 'white' }]}
                onPress={handlePlayAll}
              >
                <Ionicons name="play" size={18} color="black" style={{ marginRight: 6 }} />
                <Text style={[styles.actionText, { color: 'black' }]}>Play All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* === LISTE DES FAVORIS === */}
        <Animated.View style={{ transform: [{ translateY: listTranslate }], opacity: listOpacity }}>
          {favorites.length === 0 ? (
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
              Aucun favori pour le moment 💔
            </Text>
          ) : (
            favorites.map((track, index) => {
              const playable = !!track.url;
              return (
                <View key={index} style={styles.trackWrapper}>
                  <TouchableOpacity
                    onPress={() => {
                      setGlobalTracks([]);
                      playTrack(track)
                    }}
                    disabled={!playable}
                    style={[styles.trackPill, { opacity: playable ? 1 : 0.5 }]}
                  >
                    <Image source={{ uri: track.image }} style={styles.trackIcon} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.trackTitle, { color: playable ? 'white' : '#777' }]}
                        numberOfLines={1}
                      >
                        {track.title}
                      </Text>
                      <Text style={styles.trackSubtitle} numberOfLines={1}>
                        {track.album}
                      </Text>
                    </View>

                    {/* ❤️ Bouton Favori */}
                    <TouchableOpacity style={styles.heartButton} onPress={() => handleFavorite(track)}>
                      <Ionicons
                        name={isFav(track) ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isFav(track) ? 'red' : 'white'}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // === FOND MOSAÏQUE ===
  backgroundWrapper: {
    ...RNStyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mosaicTile: { width: '50%', height: '50%' },
  darkOverlay: { ...RNStyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // === HEADER ===
  headerSection: { alignItems: 'center', marginTop: 110, marginBottom: 30 },
  mosaicContainer: {
    width: width * 0.6,
    height: width * 0.6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 20,
    overflow: 'hidden',
  },
  mosaicImage: { width: '50%', height: '50%', resizeMode: 'cover' },
  albumTextBlock: { alignItems: 'center', marginTop: 18 },
  albumTitle: { color: 'white', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  trackCount: { color: '#aaa', fontSize: 14, marginTop: 6 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 6,
  },
  actionText: { fontWeight: '600', fontSize: 14 },

  // === LISTE ===
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
  trackTitle: { fontSize: 16, fontWeight: '600' },
  trackSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  heartButton: { paddingHorizontal: 6, marginLeft: 4 },
});
