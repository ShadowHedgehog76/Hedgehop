import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.45;
const CARD_HEIGHT = CARD_WIDTH + 40;

export default function HomeScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/sonic_data.json')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('❌ Erreur chargement JSON:', err))
      .finally(() => setLoading(false));
  }, []);

  const getAlbumStatus = (album) => {
    const tracks = album.tracks || [];
    const total = tracks.length;
    const playable = tracks.filter(t => !!t.url).length;

    if (total === 0 || playable === 0)
      return { label: 'Coming soon', color: '#ffae42', icon: 'hourglass-outline' };
    if (playable === total)
      return { label: 'Completed', color: '#00ff7f', icon: 'checkmark-circle' };
    return { label: `${playable}/${total} ready`, color: '#1f4cff', icon: 'time' };
  };

  const AlbumCard = ({ album }) => {
    const status = getAlbumStatus(album);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Album', { album })}
      >
        <Image source={{ uri: album.image }} style={styles.image} />
        <Text style={styles.title} numberOfLines={1}>{album.title}</Text>
        <View style={styles.statusRow}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 👇 Groupe les albums par paires de 2 (pour avoir deux lignes par "colonne")
  const chunkAlbums = (albums) => {
    const result = [];
    for (let i = 0; i < albums.length; i += 2) {
      result.push(albums.slice(i, i + 2));
    }
    return result;
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#1f4cff" size="large" />
        <Text style={{ color: 'white', marginTop: 10 }}>Chargement des albums...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 50 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>🎧 Sonic Albums</Text>

      {categories.map((cat, idx) => {
        const albumPairs = chunkAlbums(cat.albums);
        return (
          <View key={idx} style={styles.categoryBlock}>
            <Text style={styles.categoryTitle}>{cat.category}</Text>

            <FlatList
              key={`cat-${idx}`}
              data={albumPairs}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12 }}
              renderItem={({ item }) => (
                <View style={styles.column}>
                  {item.map((album, index) => (
                    <AlbumCard key={index} album={album} />
                  ))}
                </View>
              )}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  categoryBlock: {
    marginBottom: 25,
  },
  categoryTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    marginBottom: 10,
  },
  column: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginRight: 14,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: CARD_WIDTH - 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  title: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
