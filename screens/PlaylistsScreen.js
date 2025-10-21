import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  playlistEmitter,
} from '../src/api/playlists';

const { width } = Dimensions.get('window');

export default function PlaylistsScreen({ navigation }) {
  const [playlists, setPlaylists] = useState([]);

  // --- Chargement des playlists ---
  useEffect(() => {
    (async () => setPlaylists(await getPlaylists()))();
    const sub = playlistEmitter.addListener('update', (list) => setPlaylists(list));
    return () => sub.remove();
  }, []);

  // --- Création d’une nouvelle playlist ---
  const handleCreatePlaylist = async () => {
    const newPl = await createPlaylist('Nouvelle playlist');
    setPlaylists(await getPlaylists());
    navigation.navigate('PlaylistView', { playlist: newPl });
  };

  // --- Génération de l'image mixée (ou placeholder) ---
  const getMixedImageGrid = (tracks) => {
    const images = tracks?.slice(0, 4).map((t) => t.image).filter(Boolean);
    if (!images || images.length === 0) {
      return (
        <View style={[styles.placeholder, { backgroundColor: '#222' }]}>
          <Ionicons name="musical-notes-outline" size={40} color="#666" />
        </View>
      );
    }

    return (
      <View style={styles.imageGrid}>
        {images.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{
              width: '50%',
              height: '50%',
              opacity: 0.9,
            }}
          />
        ))}
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.darkOverlay} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.title}>Vos playlists</Text>

        {/* --- Liste des playlists --- */}
        {playlists.map((playlist, index) => (
          <TouchableOpacity
            key={index}
            style={styles.playlistCard}
            onPress={() => navigation.navigate('PlaylistView', { playlist })}
          >
            {getMixedImageGrid(playlist.tracks)}
            <View style={styles.playlistInfo}>
              <Text style={styles.playlistName} numberOfLines={1}>
                {playlist.name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* --- Bouton nouvelle playlist --- */}
        <TouchableOpacity style={styles.newPlaylistBtn} onPress={handleCreatePlaylist}>
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.newPlaylistText}>Nouvelle playlist</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* === STYLES === */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    marginTop: 60,
    marginBottom: 20,
    marginLeft: 20,
  },
  playlistCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: width * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playlistInfo: {
    position: 'absolute',
    bottom: 14,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistName: { color: 'white', fontSize: 18, fontWeight: '700', flex: 1 },
  menuButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  newPlaylistBtn: {
    marginTop: 30,
    marginHorizontal: 60,
    paddingVertical: 14,
    borderRadius: 40,
    backgroundColor: '#1f4cff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPlaylistText: {
    color: 'white',
    fontWeight: '700',
    marginLeft: 6,
    fontSize: 16,
  },
  placeholder: {
    width: '100%',
    height: width * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
