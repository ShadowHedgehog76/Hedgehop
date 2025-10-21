import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  playerEmitter,
  getCurrentTrack,
  getPlaybackStatus,
  pauseTrack,
  resumeTrack,
  isTrackPlaying,
} from '../api/player';

const { width } = Dimensions.get('window');

export default function PlayerBar() {
  const navigation = useNavigation();
  const [track, setTrack] = useState(getCurrentTrack());
  const [isPlaying, setIsPlaying] = useState(isTrackPlaying());
  const [status, setStatus] = useState(getPlaybackStatus());

  useEffect(() => {
    const playSub = playerEmitter.addListener('play', ({ track }) => {
      setTrack(track);
      setIsPlaying(true);
    });
    const pauseSub = playerEmitter.addListener('pause', () => setIsPlaying(false));
    const resumeSub = playerEmitter.addListener('resume', () => setIsPlaying(true));
    const stopSub = playerEmitter.addListener('stop', () => {
      setTrack(null);
      setIsPlaying(false);
    });
    const progressSub = playerEmitter.addListener('progress', (s) => setStatus(s));

    return () => {
      playSub.remove();
      pauseSub.remove();
      resumeSub.remove();
      stopSub.remove();
      progressSub.remove();
    };
  }, []);

  if (!track) return null;

  const progress = (status.positionMillis / status.durationMillis) * 100 || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => navigation.navigate('PlayerScreen')}
      style={styles.container}
    >
      {/* --- 🔥 FOND FLOUTÉ + DÉGRADÉ NOIR --- */}
      <Image source={{ uri: track.image }} style={StyleSheet.absoluteFillObject} blurRadius={25} />
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.1)',
          'rgba(0,0,0,0.4)',
          'rgba(0,0,0,0.7)',
          'rgba(0,0,0,0.95)',
        ]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0.0, 0.4, 0.7, 1]}
      />

      {/* --- CONTENU DU PLAYER --- */}
      <View style={styles.content}>
        <Image source={{ uri: track.image }} style={styles.image} />

        <View style={styles.info}>
          <View style={styles.infoRow}>
            {/* CrossTitle (blanc) */}
            <Text numberOfLines={1} style={styles.title}>
              {track.crossTitle || track.title}
            </Text>

            {/* Si cross, ajoute icône + titre cross en bleu */}
            {track.crossTitle && (
              <View style={styles.crossBadge}>
                <Ionicons
                  name="musical-notes"
                  size={14}
                  color="#1f4cff"
                  style={{ marginHorizontal: 4 }}
                />
                <Text numberOfLines={1} style={styles.crossTitle}>
                  {track.title}
                </Text>
              </View>
            )}
          </View>

          <Text numberOfLines={1} style={styles.album}>
            {track.album}
          </Text>
        </View>

        <TouchableOpacity onPress={isPlaying ? pauseTrack : resumeTrack} style={styles.playPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* --- BARRE DE PROGRESSION --- */}
      <View style={styles.progressWrapper}>
        <View style={[styles.progress, { width: `${progress}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 75,
    alignSelf: 'center',
    width: width * 0.92,
    height: 70,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    flex: 1,
  },

  image: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 10,
  },

  info: { flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },

  title: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '60%',
  },

  crossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    flexShrink: 1,
  },

  crossTitle: {
    color: '#1f4cff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(31,76,255,0.8)', // couleur bleue lumineuse
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8, // intensité du glow
  },

  album: {
    color: '#ccc',
    fontSize: 12,
  },

  playPause: {
    padding: 10,
  },

  progressWrapper: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  progress: {
    height: '100%',
    backgroundColor: '#1f4cff',
  },
});
