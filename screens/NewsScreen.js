// NewsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';
import { useAnalyticsTracking } from '../src/hooks/useAnalyticsTracking';
import Markdown from 'react-native-markdown-display';

export default function NewsScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFullText, setShowFullText] = useState(false);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsModalVisible, setNewsModalVisible] = useState(false);
  
  const { isTablet, getCardWidth, getGridColumns } = useDeviceType();

  // Tracker l'écran
  useAnalyticsTracking('NewsScreen');

  // Fonction pour charger les données
  const loadData = useCallback(async () => {
    const timestamp = new Date().getTime();
    
    try {
      // Load albums data
      const albumsResponse = await fetch(`https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/sonic_data.json?t=${timestamp}`);
      const albumsData = await albumsResponse.json();
      setCategories(albumsData);
    } catch (err) {
      console.error('❌ Error loading albums JSON:', err);
    } finally {
      setLoading(false);
    }

    try {
      // Load news data
      const newsResponse = await fetch(`https://raw.githubusercontent.com/ShadowHedgehog76/Hedgehop/master/assets/coming_news.json?t=${timestamp}`);
      const newsData = await newsResponse.json();
      const upcomingNews = newsData.upcomingNews || [];
      
      // Trier par date (plus récent = plus à gauche)
      const sortedNews = upcomingNews.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateB - dateA; // Ordre décroissant (plus récent en premier)
      });
      setNews(sortedNews);
    } catch (err) {
      console.error('❌ Error loading news:', err);
    } finally {
      setNewsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Charger les données au premier montage
  useEffect(() => {
    setLoading(true);
    setNewsLoading(true);
    loadData();
  }, [loadData]);

  // Recharger les données à chaque fois que l'écran est en focus
  useFocusEffect(
    useCallback(() => {
      setNewsLoading(true);
      loadData();
    }, [loadData])
  );

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

  // Fonction pour parser les dates au format DD/MM/YYYY
  const parseDate = (dateString) => {
    if (!dateString) return new Date(0);
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  // Fonction pour formater les dates avec le nom du mois
  const formatDateWithMonthName = (dateString) => {
    if (!dateString) return '';
    const [day, month, year] = dateString.split('/').map(Number);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return `${day} ${monthNames[month - 1]} ${year}`;
  };

  const openNewsModal = (newsItem) => {
    setSelectedNews(newsItem);
    setNewsModalVisible(true);
  };

  const closeNewsModal = () => {
    setNewsModalVisible(false);
    setSelectedNews(null);
  };

  // Fonction pour gérer les actions des boutons
  const handleButtonPress = async (button) => {
    if (!button) return;

    try {
      switch (button.action) {
        case 'download':
        case 'link':
          if (button.url) {
            await Linking.openURL(button.url);
          }
          break;
        case 'navigation':
          if (button.screen && navigation) {
            navigation.navigate(button.screen, button.params || {});
          }
          break;
        default:
          console.warn('Unknown button action:', button.action);
      }
    } catch (error) {
      console.error('Error handling button press:', error);
    }
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

  const renderNewsItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.newsCard}
      activeOpacity={0.8}
      onPress={() => openNewsModal(item)}
    >
      <View style={styles.newsHeader}>
        <View style={styles.newsTagContainer}>
          <View style={[styles.newsTag, getTagStyle(item.tag)]}>
            <Text style={styles.newsTagText}>{item.tag}</Text>
          </View>
          <Text style={styles.newsDate}>{formatDateWithMonthName(item.date)}</Text>
        </View>
      </View>
      
      <Text style={styles.newsTitle}>{item.title}</Text>
      
      {item.images && (
        <Image 
          source={{ uri: typeof item.images === 'string' ? item.images : item.images[0] }} 
          style={styles.newsImage} 
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );

  const getTagStyle = (tag) => {
    switch (tag?.toLowerCase()) {
      // announcement, update, feature, bugfix, update, important, what's next, launch, album news, news
      case 'announcement': return { backgroundColor: '#f97316' };
      case 'update': return { backgroundColor: '#3b82f6' };
      case 'feature': return { backgroundColor: '#22c55e' };
      case 'bugfix': return { backgroundColor: '#ef4444' };
      case 'important': return { backgroundColor: '#eab308' };
      case "what's next": return { backgroundColor: '#fbbf24' };
      case 'launch': return { backgroundColor: '#34d399' };
      case 'album news': return { backgroundColor: '#60a5fa' };
      case 'news': return { backgroundColor: '#818cf8' };
      default: return { backgroundColor: '#6b7280' };
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* News Section */}
      {!newsLoading && news.length > 0 && (
        <View style={{ marginHorizontal: -30, marginBottom: 20 }}>
          <FlatList
            horizontal
            data={news}
            keyExtractor={(item, i) => i.toString()}
            showsHorizontalScrollIndicator={false}
            style={styles.newsList}
            contentContainerStyle={styles.newsListContent}
            renderItem={renderNewsItem}
            scrollEnabled={true}
          />
        </View>
      )}

      {/* Reload button - Top Left */}
      <TouchableOpacity 
        style={[styles.reloadButtonSmall, isTablet && styles.reloadButtonSmallTablet]}
        onPress={() => {
          setNewsLoading(true);
          loadData();
        }}
      >
        <Ionicons name="refresh" size={isTablet ? 18 : 16} color="#1f4cff" />
      </TouchableOpacity>

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
    <View style={{ flex: 1 }}>
      {/* News Detail Modal */}
      <Modal
        visible={newsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeNewsModal}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            {selectedNews && (
              <>
                {/* Header with close button */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={closeNewsModal}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* News content */}
                <View style={styles.modalNewsContent}>
                  {/* Tag and date */}
                  <View style={styles.modalTagContainer}>
                    <View style={[styles.modalTag, getTagStyle(selectedNews.tag)]}>
                      <Text style={styles.modalTagText}>{selectedNews.tag}</Text>
                    </View>
                    <Text style={styles.modalDate}>{formatDateWithMonthName(selectedNews.date)}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.modalTitle}>{selectedNews.title}</Text>

                  {/* Main image */}
                  {selectedNews.images && (
                    <Image 
                      source={{ uri: typeof selectedNews.images === 'string' ? selectedNews.images : selectedNews.images[0] }} 
                      style={styles.modalMainImage} 
                      resizeMode="cover"
                    />
                  )}

                  {/* Markdown content */}
                  <View style={styles.markdownContainer}>
                    <Markdown style={markdownStyles}>
                      {selectedNews.message}
                    </Markdown>
                  </View>

                  {/* Buttons Section */}
                  {selectedNews.buttons && selectedNews.buttons.length > 0 && (
                    <View style={styles.buttonsContainer}>
                      {selectedNews.buttons.map((button, index) => {
                        // Règle: le bouton 1 ne peut jamais être désactivé
                        // Si button.label est 'none', on le saute
                        if (button.label === 'none' && index > 0) {
                          return null;
                        }
                        if (button.label === 'none' && index === 0) {
                          return null; // Impossible selon la règle, mais on le gère quand même
                        }

                        return (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.newsButton,
                              index === 1 && styles.newsButtonSecondary
                            ]}
                            activeOpacity={0.8}
                            onPress={() => handleButtonPress(button)}
                          >
                            <LinearGradient
                              colors={index === 0 ? ['#1f4cff', '#1a3aa3'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.buttonGradient}
                            >
                              <Text style={[styles.newsButtonText, index === 1 && styles.newsButtonTextSecondary]}>
                                {button.label}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <FlatList
      style={styles.container}
      data={workingAlbums}
      keyExtractor={(_, i) => i.toString()}
      numColumns={numColumns}
      key={numColumns}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{ 
        paddingBottom: 120,
        paddingHorizontal: isTablet ? 16 : 8,
      }}
      columnWrapperStyle={numColumns > 1 ? styles.row : null}
      renderItem={({ item }) => {
        const progress = getAlbumProgress(item);
        const cardWidth = getCardWidth();
        const cardHeight = cardWidth + 60; // Réduire la hauteur
        
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
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

  headerContainer: { backgroundColor: '#000', paddingBottom: 30, paddingTop: 20, paddingHorizontal: 20, position: 'relative' },
  footerContainer: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },

  reloadButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(31, 76, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31, 76, 255, 0.3)',
    marginTop: 15,
    marginLeft: 20,
  },
  reloadButtonSmallTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

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

  // === News Section ===
  newsList: { marginTop: 30, marginBottom: 20, width: '100%' },
  newsListContent: { paddingLeft: 20, paddingRight: 20 },
  newsCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 280,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  newsHeader: {
    marginBottom: 12,
  },
  newsTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newsTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  newsDate: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  newsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 20,
  },
  newsImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#222',
  },
  newsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  newsLoadingText: {
    color: '#888',
    marginLeft: 8,
    fontSize: 14,
  },
  noNews: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },

  // === Modal Styles ===
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalNewsContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalTagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalDate: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 20,
  },
  modalMainImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  markdownContainer: {
    marginTop: 10,
  },
  // === Buttons Styles ===
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  newsButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  newsButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  newsButtonTextSecondary: {
    color: 'rgba(255,255,255,0.9)',
  },
});

// Styles pour le markdown
const markdownStyles = {
  body: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  heading2: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 10,
  },
  heading3: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  strong: {
    color: '#fff',
    fontWeight: '700',
  },
  em: {
    color: '#ddd',
    fontStyle: 'italic',
  },
  link: {
    color: '#1f4cff',
    textDecorationLine: 'underline',
  },
  blockquote: {
    backgroundColor: 'rgba(31, 76, 255, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#1f4cff',
    paddingLeft: 16,
    paddingVertical: 8,
    marginVertical: 12,
  },
  list_item: {
    color: '#ccc',
    marginVertical: 2,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  paragraph: {
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: '#333',
    color: '#1f4cff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  fence: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
};
