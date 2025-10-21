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
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/sonic_data.json')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('❌ Erreur chargement JSON:', err))
      .finally(() => setLoading(false));
  }, []);

  // --- Statut d’un album ---
  const getAlbumStatus = (album) => {
    const tracks = album.tracks || [];
    const total = tracks.length;
    const playable = tracks.filter(t => !!t.url).length;

    if (total === 0 || playable === 0)
      return { label: 'Coming soon', color: '#ffae42', icon: 'hourglass-outline', status: 'ComingSoon' };
    if (playable === total)
      return { label: 'Completed', color: '#00ff7f', icon: 'checkmark-circle', status: 'Completed' };
    return { label: `${playable}/${total} ready`, color: '#1f4cff', icon: 'time', status: 'Working' };
  };

  // --- Carte d’album ---
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

  // --- Grouper les albums par 2 (affichage 2 par colonne)
  const chunkAlbums = (albums) => {
    const result = [];
    for (let i = 0; i < albums.length; i += 2) {
      result.push(albums.slice(i, i + 2));
    }
    return result;
  };

  // --- Filtres disponibles avec couleurs ---
  const filters = [
    { key: 'All', label: 'All', color: '#fff' },
    { key: 'Completed', label: 'Completed', color: '#00ff7f' },
    { key: 'Working', label: 'Working', color: '#1f4cff' },
    { key: 'ComingSoon', label: 'News', color: '#ffae42' },
  ];

  // --- Appliquer le filtre sur les catégories ---
  const filteredCategories = categories.map(cat => {
    const filteredAlbums = cat.albums.filter(album => {
      const status = getAlbumStatus(album).status;
      if (activeFilter === 'All') return true;
      return status === activeFilter;
    });
    return { ...cat, albums: filteredAlbums };
  }).filter(cat => cat.albums.length > 0);

  // --- Loader ---
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#1f4cff" size="large" />
        <Text style={{ color: 'white', marginTop: 10 }}>Chargement des albums...</Text>
      </View>
    );
  }

  // --- Rendu principal ---
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 50 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>💫 Hedgehop 💫</Text>

      {/* === Barre de filtres === */}
      <View style={styles.filterBar}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterButton,
              { borderColor: f.color },
              activeFilter === f.key && { backgroundColor: f.color }
            ]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: f.color },
                activeFilter === f.key && { color: 'black', fontWeight: '700' }
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* === Liste des catégories filtrées === */}
      {filteredCategories.length === 0 ? (
        <Text style={styles.noAlbums}>Aucun album trouvé pour ce filtre.</Text>
      ) : (
        filteredCategories.map((cat, idx) => {
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
        })
      )}
    </ScrollView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  filterButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    marginBottom: 10,
  },
  filterText: {
    fontWeight: '600',
    fontSize: 13,
  },
  categoryBlock: { marginBottom: 25 },
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
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusText: { marginLeft: 4, fontSize: 12 },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  noAlbums: {
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
});
