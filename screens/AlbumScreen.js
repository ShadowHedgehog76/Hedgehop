// AlbumScreen.js
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
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { playTrack, setGlobalTracks } from '../src/api/player';
import { toggleFavorite, getFavorites, favEmitter } from '../src/api/favorites';
import { getPlaylists } from '../src/api/playlists';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const [favorites, setFavorites] = useState([]);
  const [showCross, setShowCross] = useState(false);

  const imageScale = useRef(new Animated.Value(0.8)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listTranslate = useRef(new Animated.Value(50)).current;

  const getCrossArray = (t) => t?.crossmusic ?? t?.crossMusic ?? t?.cross ?? [];

  // Total cross
  const totalCrossCount = useMemo(() => {
    return album.tracks?.reduce((acc, t) => acc + (getCrossArray(t)?.length || 0), 0);
  }, [album]);

  // Animations d'entrée
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

  return (
    <View style={styles.container}>
      {/* Fond flou */}
      <Image source={{ uri: album.image }} style={RNStyleSheet.absoluteFillObject} blurRadius={25} />
      <BlurView intensity={60} tint="dark" style={RNStyleSheet.absoluteFillObject} />
      <View style={styles.darkOverlay} />

      {/* 🏷️ ÉTIQUETTES glossy en haut à droite */}
      <View style={styles.topBadges}>
        {/* État de disponibilité de l’album */}
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

        {/* Total cross */}
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

      <FlatList
        data={showCross ? album.tracks.filter((t) => getCrossArray(t).length > 0) : album.tracks}
        keyExtractor={(_, i) => i.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }} // ✅ espace sous la PlayerBar
        ListHeaderComponent={
          <>
            {/* Bouton retour */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={26} color="white" />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.headerSection}>
              <Animated.Image
                source={{ uri: album.image }}
                style={[styles.albumImage, { transform: [{ scale: imageScale }] }]}
              />

              {/* ✅ Barre de progression Working (centrée sous la jaquette) */}
              {(() => {
                const totalTracks = album.tracks?.length || 0;
                const availableTracks = album.tracks?.filter((t) => t.url)?.length || 0;
                const completion = totalTracks > 0 ? availableTracks / totalTracks : 0;
                const isWorking = availableTracks > 0 && availableTracks < totalTracks;

                if (!isWorking) return null;

                return (
                  <View style={styles.progressWrapper}>
                    <View style={styles.progressBarBackground}>
                      <View style={[styles.progressBarFill, { width: `${completion * 100}%` }]} />
                      <LinearGradient
                        colors={['rgba(255,255,255,0.25)', 'transparent']}
                        style={styles.progressGloss}
                      />
                    </View>
                    <Text style={styles.progressText}>{Math.round(completion * 100)}%</Text>
                  </View>
                );
              })()}

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
                        playTrack(playableTracks[0], 0);
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
                </View>
              </View>
            </View>
          </>
        }
        renderItem={({ item: track }) => {
          if (!showCross) {
            // === MODE STANDARD ===
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
          } else {
            // === MODE CROSSMUSIC (grille) ===
            const crossArr = getCrossArray(track);
            if (!crossArr.length) return null;

            return (
              <View style={styles.crossGroup}>
                <Text style={styles.crossGroupTitle}>{track.title}</Text>

                <FlatList
                  data={crossArr}
                  keyExtractor={(_, i) => i.toString()}
                  numColumns={2}
                  scrollEnabled={false}
                  renderItem={({ item }) => {
                    const playableUrl = item.url ?? item.streamUrl ?? item.source ?? null;
                    const artwork = item.image ?? item.cover ?? item.artwork ?? album.image;

                    return (
                      <TouchableOpacity
                        style={styles.crossGridCard}
                        activeOpacity={0.85}
                        onPress={() => {
                          const originalTrack = {
                            ...track,
                            url: track.url ?? track.streamUrl ?? track.source ?? null,
                            album: album.title,
                            image: album.image,
                            crossmusic: crossArr,
                          };

                          const parentCrossList = crossArr.map((x) => ({
                            ...x,
                            url: x.url ?? x.streamUrl ?? x.source ?? null,
                            album: album.title,
                            image: x.image ?? album.image,
                          }));

                          setGlobalTracks([]);

                          playTrack({
                            ...item,
                            url: playableUrl,
                            album: album.title,
                            image: artwork,
                            crossTitle: track.title,
                            parentOriginalTrack: originalTrack,
                            parentCrossList,
                          });
                        }}
                      >
                        <Image source={{ uri: artwork }} style={styles.crossGridImage} />
                        <Text numberOfLines={2} style={styles.crossGridText}>
                          {item.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            );
          }
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

  // ✅ Barre de progression glossy
  progressWrapper: {
    width: '70%',
    marginTop: 16,
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
  },
  progressGloss: {
    ...RNStyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  progressText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },

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
  crossGroup: { marginBottom: 30 },
  crossGroupTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 20,
    marginBottom: 10,
  },
  crossGridCard: {
    flex: 1,
    margin: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  crossGridImage: {
    width: '100%',
    height: width * 0.4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  crossGridText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 8,
    paddingHorizontal: 6,
  },
});
