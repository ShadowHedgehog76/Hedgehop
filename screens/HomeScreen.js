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
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';
import { getPlaylists, playlistEmitter } from '../src/api/playlists';

export default function HomeScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [playlists, setPlaylists] = useState([]);
  
  const { isTablet, getGridColumns, getCardWidth, dimensions, isLandscape } = useDeviceType();

  const loadData = () => {
    setLoading(true);
    // Reset les données pour forcer un rechargement complet
    setCategories([]);
    setActiveFilter('All');
    
    // Ajouter un timestamp pour éviter le cache + headers no-cache
    const timestamp = Date.now();
    const url = `https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/sonic_data.json?t=${timestamp}`;
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        console.log('✅ JSON rechargé avec succès:', data.length, 'catégories');
        setCategories(data);
      })
      .catch(err => {
  console.error('❌ JSON load error:', err);
  // On error, keep previous data if it exists
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Chargement initial (sans timestamp pour éviter des requêtes inutiles au démarrage)
    fetch('https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/sonic_data.json')
      .then(res => res.json())
      .then(data => setCategories(data))
  .catch(err => console.error('❌ JSON load error:', err))
      .finally(() => setLoading(false));

    // Charger les playlists locales et s'abonner aux changements
    (async () => {
      const pls = await getPlaylists();
      setPlaylists(pls);
    })();

    const sub = playlistEmitter.addListener('update', (pls) => setPlaylists(pls));
    return () => sub.remove();
  }, []);

  const getAlbumStatus = (album) => {
    const tracks = album.tracks || [];
    const total = tracks.length;
    const playable = tracks.filter(t => !!t.url).length;

    if (total === 0 || playable === 0)
      return { label: 'Coming Soon', color: '#f97316', icon: 'time', status: 'ComingSoon' };
    if (playable === total)
      return { label: 'Completed', color: '#22c55e', icon: 'checkmark-circle', status: 'Completed' };
    return { label: 'Working', color: '#3b82f6', icon: 'construct', status: 'Working', progress: playable / total };
  };

  const AlbumCard = ({ album }) => {
    const status = getAlbumStatus(album);
    if (status.status === 'ComingSoon') return null;

    const cardWidth = getCardWidth();
    const cardHeight = cardWidth + 80; // Maintain aspect ratio

    return (
      <TouchableOpacity
        style={[styles.card, { 
          width: cardWidth, 
          height: cardHeight,
          marginRight: isTablet ? 12 : 14, // Espacement similaire pour cohérence
          marginBottom: 15 
        }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Album', { album })}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: album.image }} style={styles.image} />
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'transparent']}
              style={{
                ...StyleSheet.absoluteFillObject,
                top: 0,
                height: '50%',
                borderTopLeftRadius: 12,
                borderBottomLeftRadius: 12,
                borderTopRightRadius: 22,
                borderBottomRightRadius: 22,
              }}
            />
            <Ionicons name={status.icon} size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {album.title}
        </Text>

        {album.year && <Text style={styles.yearText}>{album.year}</Text>}

        {/* ✅ Barre de progression glossy */}
        {status.status === 'Working' && (
          <View style={styles.progressWrapper}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${status.progress * 100}%` }]}>
                {/* 💎 Reflet glossy */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.05)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            </View>
            <Text style={styles.progressText}>{Math.round(status.progress * 100)}%</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const chunkAlbums = (albums) => {
    const columns = getGridColumns();
    const result = [];
    for (let i = 0; i < albums.length; i += columns) {
      result.push(albums.slice(i, i + columns));
    }
    return result;
  };

  const PlaylistCard = ({ item }) => {
    const cardWidth = getCardWidth();
    const cardHeight = cardWidth + 60;
    const cover = item.tracks?.[0]?.image || 'https://via.placeholder.com/300x300/222/EEEEEE.png?text=Playlist';
    const count = item.tracks?.length || 0;
    return (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth, height: cardHeight, marginRight: isTablet ? 12 : 14, marginBottom: 15 }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: cover }} style={styles.image} />
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}> 
            <Ionicons name="musical-notes" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>{count} track{count>1?'s':''}</Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const filters = [
    { key: 'All', label: 'All', color: '#fff' },
    { key: 'Completed', label: 'Completed', color: '#22c55e' },
    { key: 'Working', label: 'Working', color: '#3b82f6' },
  ];

  const filteredCategories = categories
    .map(cat => {
      const filteredAlbums = cat.albums.filter(album => {
        const status = getAlbumStatus(album).status;
        if (status === 'ComingSoon') return false;
        if (activeFilter === 'All') return true;
        return status === activeFilter;
      });
      return { ...cat, albums: filteredAlbums };
    })
    .filter(cat => cat.albums.length > 0);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#1f4cff" size="large" />
  <Text style={{ color: 'white', marginTop: 10 }}>Loading albums...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: 50 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerContainer, isTablet ? styles.tabletHeader : styles.phoneHeader]}>
        {!isTablet && <Text style={styles.header}>💫 Hedgehop 💫</Text>}
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={loadData}
          disabled={loading}
        >
          <Ionicons 
            name="refresh" 
            size={20} 
            color={loading ? "#666" : "#fff"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterButton,
              { borderColor: f.color },
              activeFilter === f.key && { backgroundColor: f.color },
            ]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: f.color },
                activeFilter === f.key && { color: 'black', fontWeight: '700' },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredCategories.length === 0 ? (
  <Text style={styles.noAlbums}>No albums found for this filter.</Text>
      ) : (
        filteredCategories.map((cat, idx) => {
          // Both tablet and phone use horizontal scroll for better alignment
          return (
            <View key={idx} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>{cat.category}</Text>
              <FlatList
                key={`cat-${idx}`}
                data={cat.albums}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ 
                  paddingLeft: 12, 
                  paddingRight: 12 
                }}
                renderItem={({ item }) => (
                  <AlbumCard key={item.id || item.title} album={item} />
                )}
              />
            </View>
          );
        })
      )}

      {/* 📂 Catégorie Playlists en bas */}
      {playlists.length > 0 && (
        <View style={[styles.categoryBlock, { marginTop: 10 }]}> 
          <Text style={styles.categoryTitle}>Playlists</Text>
          <FlatList
            key="playlists-section"
            data={playlists}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 12, paddingRight: 12 }}
            renderItem={({ item }) => <PlaylistCard item={item} />}
            keyExtractor={(pl) => pl.id}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  tabletHeader: {
    justifyContent: 'space-between',
  },
  phoneHeader: {
    justifyContent: 'space-between',
  },
  header: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  reloadButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
  filterText: { fontWeight: '600', fontSize: 13 },
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
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
  },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  title: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  yearText: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ✅ Barre de progression glossy
  progressWrapper: {
    width: '80%',
    alignItems: 'center',
    marginTop: 6,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  statusBadge: {
    position: 'absolute',
    top: 8,
    right: -17,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 24,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowRadius: 3,
  },
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
