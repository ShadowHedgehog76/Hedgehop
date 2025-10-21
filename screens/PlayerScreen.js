import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import {
  playerEmitter,
  getCurrentTrack,
  getPlaybackStatus,
  pauseTrack,
  resumeTrack,
  seekTo,
  isTrackPlaying,
  playTrack,
  getQueue,
} from '../src/api/player'; // getQueue ajouté pour simuler previous/next

const { width } = Dimensions.get('window');
const safeImage = 'https://i.imgur.com/ODLC1hY.jpeg';
const safeAlbum = 'Inconnu';

export default function PlayerScreen({ navigation }) {
  const [track, setTrack] = useState(getCurrentTrack());
  const [status, setStatus] = useState(getPlaybackStatus());
  const [isPlaying, setIsPlaying] = useState(isTrackPlaying());
  const [crossList, setCrossList] = useState([]);
  const [queue, setQueue] = useState([]);

  // Animation scroll texte
  const scrollXTitle = useRef(new Animated.Value(0)).current;
  const scrollXAlbum = useRef(new Animated.Value(0)).current;
  const [titleWidth, setTitleWidth] = useState(0);
  const [albumWidth, setAlbumWidth] = useState(0);

  // Récupération de la queue pour calculer previous/next
  useEffect(() => {
    const q = getQueue ? getQueue() : [];
    setQueue(q);
  }, []);

  useEffect(() => {
    const playSub = playerEmitter.addListener('play', ({ track }) => {
      setTrack(track);
      setIsPlaying(true);
    });
    const pauseSub = playerEmitter.addListener('pause', () => setIsPlaying(false));
    const resumeSub = playerEmitter.addListener('resume', () => setIsPlaying(true));
    const stopSub = playerEmitter.addListener('stop', () => setIsPlaying(false));
    const progressSub = playerEmitter.addListener('progress', (s) => setStatus(s));

    return () => {
      playSub.remove();
      pauseSub.remove();
      resumeSub.remove();
      stopSub.remove();
      progressSub.remove();
    };
  }, []);

  // Animation titre défilant
  useEffect(() => {
    if (titleWidth > width * 0.8) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scrollXTitle, {
            toValue: -titleWidth + width * 0.8,
            duration: 8000,
            useNativeDriver: true,
          }),
          Animated.timing(scrollXTitle, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [titleWidth]);

  // Animation album défilant
  useEffect(() => {
    if (albumWidth > width * 0.6) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scrollXAlbum, {
            toValue: -albumWidth + width * 0.6,
            duration: 10000,
            useNativeDriver: true,
          }),
          Animated.timing(scrollXAlbum, {
            toValue: 0,
            duration: 10000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [albumWidth]);

  // CrossMusic
  useEffect(() => {
    if (!track) return;

    if (track.crossTitle) {
      const parentList = track.parentCrossList || [];
      const siblings = parentList.filter((t) => t?.title && t.title !== track.title);

      const originalCard = {
        isOriginal: true,
        title: 'Original',
        original:
          track.parentOriginalTrack && {
            ...track.parentOriginalTrack,
            album: track.parentOriginalTrack.album || track.album || safeAlbum,
            image: track.parentOriginalTrack.image || track.image || safeImage,
            crossmusic: track.parentOriginalTrack.crossmusic || parentList,
          },
      };

      setCrossList([originalCard, ...siblings]);
    } else if (track.crossmusic && track.crossmusic.length > 0) {
      setCrossList(track.crossmusic);
    } else {
      setCrossList([]);
    }
  }, [track]);

  // Calcule previous/next à partir de la queue
  const currentIndex = queue.findIndex((t) => t?.id === track?.id);
  const previous = queue[currentIndex - 1];
  const next = queue[currentIndex + 1];

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const duration = status.durationMillis || 1;
  const position = status.positionMillis || 0;

  const togglePlayPause = async () => {
    try {
      if (isPlaying) {
        await pauseTrack();
        setIsPlaying(false);
      } else {
        await resumeTrack();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Erreur play/pause:', err);
    }
  };

  const handlePlayCross = (item) => {
    if (item.isOriginal) {
      const original = item.original;
      if (!original) return;

      playTrack({
        ...original,
        album: original.album || safeAlbum,
        image: original.image || safeImage,
        crossmusic: original.crossmusic || [],
      });
      return;
    }

    playTrack({
      ...item,
      album: track.album || safeAlbum,
      image: track.image || safeImage,
      crossTitle: track.crossTitle || track.title,
      parentCrossList: track.parentCrossList || track.crossmusic || [],
      parentOriginalTrack: track.parentOriginalTrack || track,
    });
  };

  if (!track) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune piste en lecture</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* === FOND IMAGE + DÉGRADÉ === */}
      <Image source={{ uri: track.image }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.3)',
          'rgba(0,0,0,0.6)',
          'rgba(0,0,0,0.9)',
          'rgba(0,0,0,1)',
          'rgba(0,0,0,1)',
        ]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* === Bouton retour === */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={26} color="white" />
      </TouchableOpacity>

      {/* === Cartes gauche/droite === */}
      {previous && (
        <TouchableOpacity
          style={[styles.sideCard, styles.leftCard]}
          activeOpacity={0.8}
          onPress={() => playerEmitter.emit('previous')}
        >
          <Image source={{ uri: previous.image || safeImage }} style={styles.sideCardImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[styles.sideCardTitle, { transform: [{ rotate: '-90deg' }] }]}>
            {previous.title}
          </Text>
        </TouchableOpacity>
      )}

      {next && (
        <TouchableOpacity
          style={[styles.sideCard, styles.rightCard]}
          activeOpacity={0.8}
          onPress={() => playerEmitter.emit('next')}
        >
          <Image source={{ uri: next.image || safeImage }} style={styles.sideCardImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[styles.sideCardTitle, { transform: [{ rotate: '90deg' }] }]}>
            {next.title}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.center}>
        {/* === TITRE === */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Animated.View
              style={{
                transform: [{ translateX: scrollXTitle }],
                maxWidth: width * 0.8,
                overflow: 'hidden',
              }}
              onLayout={(e) => setTitleWidth(e.nativeEvent.layout.width)}
            >
              <Text style={styles.title}>
                {track.crossTitle ? track.crossTitle : track.title}
              </Text>
            </Animated.View>
          </View>

          {track.crossTitle && (
            <View style={styles.crossBadge}>
              <Ionicons
                name="musical-notes"
                size={18}
                color="#1f4cff"
                style={{ marginHorizontal: 4 }}
              />
              <Text style={styles.crossTitle}>{track.title}</Text>
            </View>
          )}

          <Animated.View
            style={{
              transform: [{ translateX: scrollXAlbum }],
              maxWidth: width * 0.6,
              overflow: 'hidden',
            }}
            onLayout={(e) => setAlbumWidth(e.nativeEvent.layout.width)}
          >
            <Text style={styles.album}>{track.album}</Text>
          </Animated.View>
        </View>

        {/* === SLIDER === */}
        <View style={styles.progressContainer}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            minimumTrackTintColor="#1f4cff"
            maximumTrackTintColor="#777"
            thumbTintColor="#1f4cff"
            onSlidingComplete={seekTo}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* === CONTRÔLES === */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => playerEmitter.emit('previous')}>
            <Ionicons name="play-skip-back" size={36} color="white" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="black" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => playerEmitter.emit('next')}>
            <Ionicons name="play-skip-forward" size={36} color="white" />
          </TouchableOpacity>
        </View>

        {/* === CROSSMUSIC === */}
        {crossList.length > 0 && (
          <View style={styles.crossSection}>
            <FlatList
              data={crossList}
              horizontal
              keyExtractor={(item, i) =>
                item.isOriginal ? 'original' : `${item.title}-${i}`
              }
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.crossCard}
                  onPress={() => handlePlayCross(item)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: item.image || track.image }}
                    style={styles.crossImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={[
                      'transparent',
                      'rgba(0,0,0,0.6)',
                      'rgba(0,0,0,0.9)',
                      'rgba(0,0,0,1)',
                    ]}
                    style={styles.crossGradient}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.crossCardTitle,
                      item.isOriginal && { color: '#1f4cff', fontWeight: '900' },
                    ]}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  emptyText: { color: '#777' },
  closeBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },

  // Cartes latérales
  sideCard: {
    position: 'absolute',
    top: '30%',
    width: 100,
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    opacity: 0.7,
    zIndex: 5,
  },
  leftCard: { left: -30 },
  rightCard: { right: -30 },
  sideCardImage: { width: '100%', height: '100%', borderRadius: 20 },
  sideCardTitle: {
    position: 'absolute',
    color: 'white',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
    width: 160,
    left: -30,
    bottom: 50,
  },

  center: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleBlock: { alignItems: 'center', marginBottom: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { color: 'white', fontSize: 28, fontWeight: '900', textAlign: 'center' },

  crossBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  crossTitle: {
    color: '#1f4cff',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(31,76,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  album: { color: '#aaa', fontSize: 15, marginTop: 6, textAlign: 'center' },

  progressContainer: { width: '100%', marginBottom: 30 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -5 },
  timeText: { color: '#aaa', fontSize: 12 },

  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '70%',
    marginBottom: 30,
  },
  playButton: {
    backgroundColor: 'white',
    borderRadius: 50,
    padding: 22,
    shadowColor: '#1f4cff',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },

  crossSection: { marginBottom: 40, width: '100%', alignItems: 'center' },
  crossCard: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  crossImage: { width: '100%', height: '100%', borderRadius: 16 },
  crossGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  crossCardTitle: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
});
