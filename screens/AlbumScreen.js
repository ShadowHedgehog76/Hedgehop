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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { playTrack, setGlobalTracks } from '../src/api/player';
import { toggleFavorite, getFavorites, favEmitter } from '../src/api/favorites';
import { getPlaylists } from '../src/api/playlists';
import { useDeviceType } from '../src/hooks/useDeviceType';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const [favorites, setFavorites] = useState([]);
  const [showCross, setShowCross] = useState(false);
  
  const { isTablet, dimensions, isLandscape } = useDeviceType();

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

  // Rendu des tracks pour tablette
  const renderTabletTrackItem = (track) => {
    if (!showCross) {
      // Mode standard
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
              
              <TouchableOpacity
                onPress={() => handleFavorite(track)}
                style={styles.tabletFavoriteButton}
              >
                <Ionicons
                  name={isFav(track) ? "heart" : "heart-outline"}
                  size={20}
                  color={isFav(track) ? "#e91e63" : "#666"}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      );
    } else {
      // Mode CrossMusic - même système que sur téléphone mais pour tablette
      const crossArr = getCrossArray(track);
      if (!crossArr.length) return null;

      return (
        <View style={styles.tabletCrossGroup}>
          <Text style={styles.tabletCrossGroupTitle}>{track.title}</Text>

          <FlatList
            data={crossArr}
            keyExtractor={(_, i) => i.toString()}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.tabletCrossGrid}
            renderItem={({ item }) => {
              const playableUrl = item.url ?? item.streamUrl ?? item.source ?? null;
              const artwork = item.image ?? item.cover ?? item.artwork ?? album.image;

              return (
                <TouchableOpacity
                  style={styles.tabletCrossGridCard}
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
                  <Image source={{ uri: artwork }} style={styles.tabletCrossGridImage} />
                  <Text numberOfLines={2} style={styles.tabletCrossGridText}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      );
    }
  };

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
            
            {/* Barre de progression pour Working */}
            {(() => {
              const totalTracks = album.tracks?.length || 0;
              const availableTracks = album.tracks?.filter((t) => t.url)?.length || 0;
              const completion = totalTracks > 0 ? availableTracks / totalTracks : 0;
              const isWorking = availableTracks > 0 && availableTracks < totalTracks;

              if (!isWorking) return null;

              return (
                <View style={styles.tabletProgressWrapper}>
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

            <Text style={styles.tabletAlbumTitle}>{album.title}</Text>
            <Text style={styles.tabletTrackCount}>{album.tracks?.length || 0} pistes</Text>

            {/* Boutons d'action */}
            <View style={styles.tabletActionRow}>
              <TouchableOpacity
                style={[styles.tabletActionButton, { backgroundColor: 'white' }]}
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
                  }
                }}
              >
                <Ionicons name="play" size={20} color="black" style={{ marginRight: 8 }} />
                <Text style={[styles.tabletActionText, { color: 'black' }]}>Play All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabletActionButton, { backgroundColor: '#1f4cff' }]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowCross((v) => !v);
                }}
              >
                <Ionicons
                  name="shuffle"
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.tabletActionText, { color: 'white' }]}>
                  {showCross ? 'Standard' : 'CrossMusic'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Côté droit - Liste des tracks */}
          <View style={styles.tabletRightSide}>
            <FlatList
              data={showCross ? album.tracks.filter((t) => getCrossArray(t).length > 0) : album.tracks}
              keyExtractor={(_, i) => i.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item: track }) => {
                // Utilise le même renderItem que pour mobile mais avec styles tablette
                return renderTabletTrackItem(track);
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  // Layout mobile (original)
  return (
    <View style={styles.container}>
      {/* Fond flou */}
      <Image source={{ uri: album.image }} style={StyleSheet.absoluteFillObject} blurRadius={25} />
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
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

        {/* Total cross */}
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
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
  },
  tabletBackButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
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
  },
  tabletProgressWrapper: {
    width: '80%',
    alignItems: 'center',
    marginTop: 16,
  },
  tabletAlbumTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 20,
  },
  tabletTrackCount: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  tabletActionRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  tabletActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  tabletActionText: {
    fontWeight: '700',
    fontSize: 16,
  },
  tabletRightSide: {
    flex: 0.65,
    paddingLeft: 20,
  },
  tabletTrackWrapper: {
    marginBottom: 8,
  },
  tabletTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  tabletFavoriteButton: {
    padding: 4,
  },
  tabletCrossGroup: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: 20,
  },
  tabletCrossGroupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'left',
  },
  tabletCrossGrid: {
    paddingHorizontal: 4,
  },
  tabletCrossGridCard: {
    flex: 1,
    margin: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 140,
  },
  tabletCrossGridImage: {
    width: '100%',
    aspectRatio: 1,
    resizeMode: 'cover',
  },
  tabletCrossGridText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
    marginVertical: 8,
    paddingHorizontal: 8,
    lineHeight: 16,
  },
});
