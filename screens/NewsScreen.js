// NewsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';

export default function NewsScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFullText, setShowFullText] = useState(false);
  
  const { isTablet, getCardWidth, getGridColumns } = useDeviceType();

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/sonic_data.json')
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch((err) => console.error('❌ Error loading JSON:', err))
      .finally(() => setLoading(false));
  }, []);

  const getAlbumStatus = (album) => {
    const tracks = album.tracks || [];
    const total = tracks.length;
    const playable = tracks.filter((t) => !!t.url).length;

    if (total === 0 || playable === 0)
      return { label: 'Coming Soon', color: '#f97316', status: 'ComingSoon' };
    if (playable === total)
      return { label: 'Completed', color: '#22c55e', status: 'Completed' };
    return { label: 'Working', color: '#3b82f6', status: 'Working' };
  };

  const getAlbumProgress = (album) => {
    const total = album.tracks?.length || 0;
    const playable = album.tracks?.filter((t) => !!t.url).length || 0;
    return total > 0 ? playable / total : 0;
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#1f4cff" size="large" />
        <Text style={{ color: 'white', marginTop: 10 }}>Loading albums...</Text>
      </View>
    );
  }

  const allAlbums = categories.flatMap((cat) => cat.albums || []);
  const roadmapAlbums = allAlbums.filter((a) => getAlbumStatus(a).status === 'ComingSoon');
  const workingAlbums = allAlbums.filter((a) => getAlbumStatus(a).status === 'Working');
  roadmapAlbums.sort((a, b) => (a.year || 0) - (b.year || 0)); // oldest first

  const textPreview = `Welcome to the Hedgehop development roadmap!

Here you’ll find albums that are currently planned for future updates. These are works in progress that are not yet playable or available, but are confirmed to be part of Hedgehop’s future expansion. 

Please note that development can take time — some albums may take longer than others to appear here, and the content shown in this list may change at any time. Certain albums could be removed, delayed, or released gradually in parts or batches depending on the project’s progress.

Thank you for your patience and continued support while Hedgehop grows and improves over time!`;

  const paragraphs = textPreview.split('\n\n');
  const visibleText = showFullText ? textPreview : paragraphs.slice(0, 2).join('\n\n');

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.header}>📰 News</Text>
      <Text style={styles.description}>{visibleText}</Text>
      <TouchableOpacity onPress={() => setShowFullText((v) => !v)}>
        <Text style={styles.showMore}>{showFullText ? 'Show less ▲' : 'Read more ▼'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>🛠️ Albums in Progress</Text>
      <Text style={styles.sectionSubtitle}>
        These albums are currently being worked on. They already contain a
        number of playable tracks, but are still in development and will receive
        more updates over time.
      </Text>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <Text style={styles.sectionTitle}>🗺️ Roadmap</Text>
      <Text style={styles.sectionSubtitle}>
        Albums planned for future updates. The oldest ones appear at the top,
        while the most recent are listed toward the bottom, connected by a
        central timeline.
      </Text>

      <View style={styles.timelineContainer}>
        <View style={styles.timelineLine} pointerEvents="none" />
        {roadmapAlbums.map((album, index) => (
          <View key={index} style={styles.timelineItem}>
            <View style={styles.timelineCard}>
              <Image source={{ uri: album.image }} style={styles.timelineImage} />
              <Text style={styles.albumTitle}>{album.title}</Text>
              <Text style={styles.albumYear}>{album.year}</Text>

              <TouchableOpacity
                style={styles.timelineButton}
                onPress={() => navigation.navigate('AlbumScreenDisabled', { album })}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'transparent']}
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    top: 0,
                    height: '55%',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                  }}
                />
                <Ionicons name="musical-notes" size={16} color="#fff" />
                <Text style={styles.timelineButtonText}> View Album</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const numColumns = getGridColumns();

  return (
    <FlatList
      style={styles.container}
      data={workingAlbums}
      keyExtractor={(_, i) => i.toString()}
      numColumns={numColumns}
      key={numColumns} // Force re-render when columns change
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{ 
        paddingBottom: 120,
        paddingHorizontal: isTablet ? 16 : 8
      }}
      columnWrapperStyle={numColumns > 1 ? styles.row : null}
      renderItem={({ item }) => {
        const progress = getAlbumProgress(item);
        const cardWidth = getCardWidth();
        const cardHeight = cardWidth + 80; // Maintenir le ratio
        
        return (
          <TouchableOpacity
            style={[styles.card, { 
              width: cardWidth, 
              height: cardHeight,
              marginBottom: isTablet ? 12 : 16,
              marginHorizontal: isTablet ? 4 : 6
            }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AlbumScreen', { album: item })}
          >
            <View style={styles.imageWrapper}>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
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
                <Ionicons name="construct" size={12} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.badgeText}>Working</Text>
              </View>
            </View>

            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            {item.year && <Text style={styles.albumYearSmall}>{item.year}</Text>}

            {/* ✅ Barre de progression glossy */}
            <View style={styles.progressWrapper}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]}>
                  {/* Reflet glossy */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.5)', 'transparent']}
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      top: 0,
                      height: '50%',
                      borderTopLeftRadius: 20,
                      borderTopRightRadius: 20,
                    }}
                  />
                  <LinearGradient
                    colors={['#3b82f6', '#60a5fa']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              </View>
              <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

  headerContainer: { backgroundColor: '#000', paddingBottom: 30, paddingTop: 50 },
  footerContainer: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },

  header: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  description: { color: '#ccc', fontSize: 15, lineHeight: 22, marginHorizontal: 20, textAlign: 'justify' },
  showMore: { color: '#1f4cff', fontSize: 15, fontWeight: '600', textAlign: 'center', marginVertical: 12 },
  sectionTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', marginLeft: 20, marginTop: 30, marginBottom: 5 },
  sectionSubtitle: { color: '#aaa', fontSize: 14, marginLeft: 20, marginRight: 20, marginBottom: 20, lineHeight: 20 },

  // === Timeline ===
  timelineContainer: { position: 'relative', marginTop: 20, marginBottom: 60, width: '90%', alignItems: 'center' },
  timelineLine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, backgroundColor: '#1f4cff', transform: [{ translateX: -1.5 }], borderRadius: 2, opacity: 0.5, zIndex: 0 },
  timelineItem: { width: '100%', alignItems: 'center', marginVertical: 20 },
  timelineCard: { backgroundColor: '#111', borderRadius: 16, width: '70%', overflow: 'hidden', padding: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  timelineImage: { width: '100%', height: 120, borderRadius: 10, marginBottom: 8 },
  albumTitle: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  albumYear: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  albumYearSmall: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 2 },

  // === Progress bar glossy ===
  progressWrapper: { width: '80%', alignItems: 'center', marginTop: 6 },
  progressBarBackground: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 20, position: 'relative', overflow: 'hidden' },
  progressText: { color: '#aaa', fontSize: 12, fontWeight: '600', marginTop: 4 },

  timelineButton: { backgroundColor: '#1f4cff', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 6, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 4, elevation: 3 },
  timelineButtonText: { color: 'white', fontWeight: '600', fontSize: 13, marginLeft: 4 },

  // === Working Albums Grid ===
  row: {
    justifyContent: 'space-around',
  },
  card: { backgroundColor: '#111', borderRadius: 15, padding: 10, alignItems: 'center' },
  imageWrapper: { width: '100%', position: 'relative', borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  badge: { position: 'absolute', top: 8, right: -17, flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 10, paddingRight: 24, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderWidth: 2, borderColor: 'rgba(0,0,0,0.4)', overflow: 'hidden' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4, textShadowColor: 'rgba(255,255,255,0.35)', textShadowRadius: 3 },
  title: { color: 'white', fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
