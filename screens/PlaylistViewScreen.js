import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { playTrack } from '../src/api/player';
import {
  getPlaylists,
  deletePlaylist,
  removeTrack,
  renamePlaylist,
} from '../src/api/playlists';

const { width } = Dimensions.get('window');

export default function PlaylistViewScreen({ route, navigation }) {
  const { playlist } = route.params;
  const [currentPlaylist, setCurrentPlaylist] = useState(playlist);

  // --- Création d’une mosaïque visuelle ---
  const images = (playlist.tracks || []).slice(0, 4).map(t => t.image).filter(Boolean);

  const deletePlaylistConfirm = () => {
    Alert.alert(
      'Supprimer la playlist',
      'Voulez-vous vraiment supprimer cette playlist ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(currentPlaylist.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleRemoveTrack = async (track) => {
    await removeTrack(currentPlaylist.id, track);
    const updated = await getPlaylists();
    const updatedPlaylist = updated.find((p) => p.id === currentPlaylist.id);
    setCurrentPlaylist(updatedPlaylist || { ...currentPlaylist, tracks: [] });
  };

  const handleRename = () => {
    Alert.prompt(
      'Renommer la playlist',
      'Entrez un nouveau nom :',
      async (newName) => {
        if (newName && newName.trim()) {
          await renamePlaylist(currentPlaylist.id, newName);
          const updated = await getPlaylists();
          const updatedPlaylist = updated.find((p) => p.id === currentPlaylist.id);
          setCurrentPlaylist(updatedPlaylist);
        }
      },
      'plain-text',
      currentPlaylist.name
    );
  };

  return (
    <View style={styles.container}>
      {/* === FOND MOSAÏQUE FLOU === */}
      <View style={styles.mosaicContainer}>
        {images.map((img, i) => (
          <Image
            key={i}
            source={{ uri: img }}
            style={[
              styles.mosaicPiece,
              { top: i < 2 ? 0 : '50%', left: i % 2 === 0 ? 0 : '50%' },
            ]}
            blurRadius={25}
          />
        ))}
      </View>

      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.darkOverlay} />

      {/* === Bouton retour === */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={26} color="white" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {/* === IMAGE PRINCIPALE NETTE === */}
        <View style={styles.headerSection}>
          <Image
            source={{ uri: images[0] || 'https://placehold.co/600x600?text=Playlist' }}
            style={styles.playlistImage}
          />
          <Text style={styles.playlistTitle}>{currentPlaylist.name}</Text>
          <Text style={styles.trackCount}>
            {currentPlaylist.tracks?.length || 0} pistes
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'white' }]}
              onPress={() => console.log('▶️ Lecture de toute la playlist')}
            >
              <Ionicons name="play" size={18} color="black" style={{ marginRight: 6 }} />
              <Text style={[styles.actionText, { color: 'black' }]}>Play All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#1f4cff' }]}
              onPress={handleRename}
            >
              <Ionicons name="create-outline" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={[styles.actionText, { color: 'white' }]}>Renommer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
              onPress={deletePlaylistConfirm}
            >
              <Ionicons name="trash" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={[styles.actionText, { color: 'white' }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* === LISTE DES MORCEAUX === */}
        {currentPlaylist.tracks.length === 0 ? (
          <Text style={styles.emptyText}>Aucune piste dans cette playlist</Text>
        ) : (
          currentPlaylist.tracks.map((track, i) => (
            <View key={i} style={styles.trackWrapper}>
              <TouchableOpacity
                style={styles.trackPill}
                onPress={() => playTrack(track)}
              >
                <Image source={{ uri: track.image }} style={styles.trackIcon} />
                <Text numberOfLines={1} style={styles.trackTitle}>
                  {track.title}
                </Text>

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveTrack(track)}
                >
                  <Ionicons name="close" size={18} color="#ff6666" />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  mosaicContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexWrap: 'wrap',
  },
  mosaicPiece: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    resizeMode: 'cover',
  },

  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 30,
    padding: 6,
  },

  headerSection: { alignItems: 'center', marginTop: 110, marginBottom: 25 },
  playlistImage: { width: width * 0.6, height: width * 0.6, borderRadius: 20 },
  playlistTitle: { color: 'white', fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 15 },
  trackCount: { color: '#aaa', fontSize: 14, marginTop: 5, marginBottom: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' },
  actionButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 14, marginHorizontal: 6 },
  actionText: { fontWeight: '600', fontSize: 14 },

  trackWrapper: { marginHorizontal: 20, marginBottom: 10 },
  trackPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' },
  trackIcon: { width: 45, height: 45, borderRadius: 10, marginRight: 12 },
  trackTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: 'white' },
  removeButton: { paddingHorizontal: 8 },
  emptyText: { color: '#aaa', textAlign: 'center', fontStyle: 'italic', marginTop: 50, fontSize: 16 },
});
