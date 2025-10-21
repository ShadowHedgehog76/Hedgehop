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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { playTrack } from '../src/api/player';
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

  // --- Chargement & synchro ---
  useEffect(() => {
    (async () => {
      const favs = await getFavorites();
      setFavorites(favs);
    })();

    const sub = favEmitter.addListener('update', (favs) => setFavorites(favs));
    return () => sub.remove();
  }, []);

  // --- Animation d'entrée ---
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

  const handleExpand = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const isFav = (track) => favorites.some((f) => f.id === track.id);

  // --- Mosaïque de fond ---
  const getMosaicGrid = () => {
    const imgs = favorites.slice(0, 4).map((f) => f.image);
    while (imgs.length < 4) imgs.push(imgs[0] || null);
    return imgs;
  };
  const mosaicImages = getMosaicGrid();

  return (
    <View style={styles.container}>
      {/* 🌌 FOND MOSAÏQUE + FLOU */}
      <View style={styles.backgroundWrapper}>
        {mosaicImages.map((img, i) => (
          <Image
            key={i}
            source={img ? { uri: img } : null}
            style={styles.mosaicTile}
            resizeMode="cover"
          />
        ))}
        {/* Flou au-dessus de toutes les images */}
        <BlurView
          intensity={80}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        {/* Légère surcouche sombre */}
        <View style={styles.darkOverlay} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        {/* --- EN-TÊTE --- */}
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
                onPress={() => console.log('▶️ Lecture de tous les favoris')}
              >
                <Ionicons name="play" size={18} color="black" style={{ marginRight: 6 }} />
                <Text style={[styles.actionText, { color: 'black' }]}>Play All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* --- LISTE DES PISTES --- */}
        <Animated.View style={{ transform: [{ translateY: listTranslate }], opacity: listOpacity }}>
          {favorites.length === 0 ? (
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
              Aucun favori pour le moment 💔
            </Text>
          ) : (
            favorites.map((track, index) => {
              const playable = !!track.url;
              const hasCross = Array.isArray(track.crossmusic) && track.crossmusic.length > 0;
              const expanded = expandedIndex === index;

              return (
                <View key={index}>
                  <View style={styles.trackWrapper}>
                    <TouchableOpacity
                      onPress={() => playTrack(track)}
                      disabled={!playable}
                      style={[styles.trackPill, { opacity: playable ? 1 : 0.5 }]}
                    >
                      <Image source={{ uri: track.image }} style={styles.trackIcon} />
                      <Text
                        style={[styles.trackTitle, { color: playable ? 'white' : '#777' }]}
                        numberOfLines={1}
                      >
                        {track.title}
                      </Text>

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

                  {expanded && hasCross && (
                    <Animated.View style={styles.crossListContainer}>
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginHorizontal: 10 }}
                        data={track.crossmusic}
                        keyExtractor={(_, i) => i.toString()}
                        renderItem={({ item }) => (
                          <View style={styles.crossCard}>
                            <TouchableOpacity
                              disabled={!item.url}
                              onPress={() => playTrack(item)}
                              style={{ alignItems: 'center' }}
                            >
                              <Image
                                source={{ uri: item.image || track.image }}
                                style={[styles.crossImage, !item.url && { tintColor: 'gray', opacity: 0.4 }]}
                              />
                              <Text style={styles.crossTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      />
                    </Animated.View>
                  )}
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

  /* === FOND MOSAÏQUE === */
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mosaicTile: {
    width: '50%',
    height: '50%',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  /* === EN-TÊTE === */
  headerSection: { alignItems: 'center', marginTop: 110, marginBottom: 30 },
  mosaicContainer: {
    width: width * 0.6,
    height: width * 0.6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 20,
    overflow: 'hidden',
  },
  mosaicImage: {
    width: '50%',
    height: '50%',
    resizeMode: 'cover',
  },
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

  /* === LISTE === */
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
  heartButton: { paddingHorizontal: 6, marginLeft: 4 },
  trackRight: { marginLeft: 4, padding: 4 },

  crossListContainer: {
    marginTop: 6,
    marginBottom: 12,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 30,
    paddingVertical: 12,
  },
  crossCard: {
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 10,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  crossImage: { width: 90, height: 90, borderRadius: 10, marginBottom: 6 },
  crossTitle: { color: 'white', fontSize: 12, textAlign: 'center' },
});
