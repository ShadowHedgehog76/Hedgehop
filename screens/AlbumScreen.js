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
import { toggleFavorite, getFavorites, favEmitter } from '../src/api/favorites';
import { getPlaylists, addTrack, createPlaylist } from '../src/api/playlists';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const [favorites, setFavorites] = useState([]);
  const [showCross, setShowCross] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [playlists, setPlaylists] = useState([]);

  const imageScale = useRef(new Animated.Value(0.8)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listTranslate = useRef(new Animated.Value(50)).current;

  // Normalise les clés pour "crossmusic"
  const getCrossArray = (t) => t?.crossmusic ?? t?.crossMusic ?? t?.cross ?? [];

  // Animations d’entrée
  useEffect(() => {
    Animated.sequence([
      Animated.spring(imageScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(listTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Favoris
  useEffect(() => {
    (async () => {
      const favs = await getFavorites();
      setFavorites(favs);
    })();
    const sub = favEmitter.addListener('update', (favs) => setFavorites(favs));
    return () => sub.remove();
  }, []);

  // Playlists
  useEffect(() => {
    (async () => {
      try {
        const savedPlaylists = await getPlaylists();
        setPlaylists(savedPlaylists || []);
      } catch (err) {
        console.error('Erreur chargement playlists', err);
      }
    })();
  }, []);

  const isFav = (track) =>
    favorites.some(
      (f) =>
        f.title === track.title &&
        f.album === album.title &&
        (f.crossTitle === track.crossTitle || !f.crossTitle)
    );

  const handleFavorite = async (track) => {
    await toggleFavorite({
      ...track,
      album: album.title,
      image: album.image,
      crossTitle: track.crossTitle || null,
    });
    setFavorites(await getFavorites());
  };

  const addTrackToPlaylist = async (playlistId, track) => {
    await addTrack(playlistId, { ...track, album: album.title, image: album.image });
  };

  const createNewPlaylist = async (track) => {
    const newPlaylist = await createPlaylist('Nouvelle playlist', [track]);
    setPlaylists([...playlists, newPlaylist]);
  };

  return (
    <View style={styles.container}>
      {/* Fond flou */}
      <Image source={{ uri: album.image }} style={RNStyleSheet.absoluteFillObject} blurRadius={25} />
      <BlurView intensity={60} tint="dark" style={RNStyleSheet.absoluteFillObject} />
      <View style={styles.darkOverlay} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        {/* Back */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="white" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerSection}>
          <Animated.Image
            source={{ uri: album.image }}
            style={[styles.albumImage, { transform: [{ scale: imageScale }] }]}
          />
          <View style={styles.albumTextBlock}>
            <Text style={styles.albumTitle}>{album.title}</Text>
            <Text style={styles.trackCount}>{album.tracks?.length || 0} pistes</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: 'white' }]}
                onPress={() => {
                  const playableTracks = album.tracks
                    .filter((t) => t.url)
                    .map((t) => ({
                      ...t,
                      album: album.title,
                      image: album.image,
                    }));

                  if (playableTracks.length > 0) {
                    setGlobalTracks(playableTracks);
                    playTrack(playableTracks[0], 0); // démarre au premier morceau
                  } else {
                    console.warn('Aucune piste lisible dans cet album.');
                  }
                }}

              >
                <Ionicons name="play" size={18} color="black" style={{ marginRight: 6 }} />
                <Text style={[styles.actionText, { color: 'black' }]}>Play All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#1f4cff' }]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowCross((v) => !v);
                }}
              >
                <Ionicons
                  name="shuffle"
                  size={18}
                  color="white"
                  style={{ marginRight: 6, transform: [{ rotate: showCross ? '90deg' : '0deg' }] }}
                />
                <Text style={[styles.actionText, { color: 'white' }]}>
                  {showCross ? 'Standard' : 'CrossMusic'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="ellipsis-horizontal" size={18} color="#777" style={{ marginRight: 6 }} />
                <Text style={[styles.actionText, { color: '#777' }]}>More...</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contenu */}
        <Animated.View style={{ transform: [{ translateY: listTranslate }], opacity: listOpacity }}>
          {!showCross ? (
            // === MODE STANDARD ===
            album.tracks?.map((track, index) => {
              const playable = !!track.url;
              return (
                <View key={index} style={styles.trackWrapper}>
                  <TouchableOpacity
                    onPress={() => {
                      // Optionnel : définir la queue globale sur l’album pour le random/next
                      setGlobalTracks(
                        album.tracks.map((t) => ({
                          ...t,
                          album: album.title,
                          image: album.image,
                        }))
                      );
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

                    {/* Favori */}
                    <TouchableOpacity style={styles.heartButton} onPress={() => handleFavorite(track)}>
                      <Ionicons
                        name={isFav(track) ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isFav(track) ? 'red' : 'white'}
                      />
                    </TouchableOpacity>

                    {/* Menu */}
                    <TouchableOpacity style={styles.trackRight} onPress={() => setActiveTrack(track)}>
                      <Ionicons name="ellipsis-vertical" size={20} color="#aaa" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            // === MODE CROSSMUSIC ===
            album.tracks
              .filter((t) => getCrossArray(t).length > 0)
              .map((track, index) => {
                const crossArr = getCrossArray(track); // toutes les variantes
                return (
                  <View key={index} style={styles.crossGroup}>
                    <Text style={styles.crossGroupTitle}>{track.title}</Text>

                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={crossArr}
                      keyExtractor={(_, i) => i.toString()}
                      renderItem={({ item }) => {
                        const playableUrl = item.url ?? item.streamUrl ?? item.source ?? null;
                        const artwork = item.image ?? item.cover ?? item.artwork ?? album.image;

                        return (
                          <View style={styles.crossAlbumCard}>
                            {/* Image en haut */}
                            <Image source={{ uri: artwork }} style={styles.crossAlbumImage} />

                            {/* Footer titre + boutons */}
                            <View style={styles.crossCardFooter}>
                              <Text numberOfLines={1} style={styles.crossAlbumText}>
                                {item.title}
                              </Text>

                              <View style={styles.crossCardButtons}>
                                <TouchableOpacity onPress={() => handleFavorite({ ...item, crossTitle: track.title })}>
                                  <Ionicons
                                    name={isFav({ ...item, crossTitle: track.title }) ? 'heart' : 'heart-outline'}
                                    size={18}
                                    color={isFav({ ...item, crossTitle: track.title }) ? 'red' : 'white'}
                                  />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setActiveTrack({ ...item, crossTitle: track.title })}>
                                  <Ionicons name="ellipsis-vertical" size={18} color="#ccc" />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* === OVERLAY CLIQUABLE : ENVOIE LES MÉTADONNÉES REQUISES === */}
                            <TouchableOpacity
                              style={RNStyleSheet.absoluteFill}
                              disabled={!playableUrl}
                              onPress={() => {
                                // 1) Construire l’original enrichi
                                const originalTrack = {
                                  ...track,
                                  url: track.url ?? track.streamUrl ?? track.source ?? null,
                                  album: album.title,
                                  image: album.image,
                                  crossmusic: crossArr, // indispensable pour PlayerScreen
                                };

                                // 2) Normaliser la liste des cross pour parentCrossList
                                const parentCrossList = crossArr.map((x) => ({
                                  ...x,
                                  url: x.url ?? x.streamUrl ?? x.source ?? null,
                                  album: album.title,
                                  image: x.image ?? album.image,
                                }));

                                // Optionnel : définir la queue globale = original + toutes les cross
                                setGlobalTracks([
                                  originalTrack,
                                  ...parentCrossList,
                                ]);

                                // 3) Lancer la variante sélectionnée avec le contexte complet
                                playTrack({
                                  ...item,
                                  url: playableUrl,
                                  album: album.title,
                                  image: artwork,
                                  crossTitle: track.title,           // nom de la “famille”
                                  parentOriginalTrack: originalTrack, // ⬅️ requis par PlayerScreen
                                  parentCrossList,                    // ⬅️ requis par PlayerScreen
                                });
                              }}
                            />
                          </View>
                        );
                      }}
                    />
                  </View>
                );
              })
          )}
        </Animated.View>
      </ScrollView>

      {/* (Menus favoris / playlist retirés ici pour la brièveté si besoin) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  darkOverlay: { ...RNStyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
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
  actionRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 6,
  },
  actionText: { fontWeight: '600', fontSize: 14 },
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
  crossGroup: { marginBottom: 25 },
  crossGroupTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginLeft: 20, marginBottom: 10 },
  crossAlbumCard: {
    width: width * 0.4,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  crossAlbumImage: { width: '100%', height: width * 0.4, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  crossCardFooter: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  crossAlbumText: { flex: 1, color: 'white', fontSize: 14, fontWeight: '600', marginRight: 6 },
  crossCardButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
