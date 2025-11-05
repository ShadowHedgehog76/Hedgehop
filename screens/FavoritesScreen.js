import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  UIManager,
  LayoutAnimation,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { playTrack, setGlobalTracks } from '../src/api/player';
import { getFavorites, toggleFavorite, favEmitter } from '../src/api/favorites';
import { useDeviceType } from '../src/hooks/useDeviceType';
import authService from '../src/services/auth';
import { getPlaylists, createPlaylist, addTrack } from '../src/api/playlists';
import crossPartyService from '../src/services/crossPartyService';
import { useAlert } from '../src/components/CustomAlert';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FavoritesScreen() {
  console.log('🚀 FavoritesScreen DÉMARRÉ');
  
  const [favorites, setFavorites] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('Initialisation...');
  const [renderKey, setRenderKey] = useState(0); // Pour forcer le re-render
  // Playlist modal state
  const [plistModalVisible, setPlistModalVisible] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlName, setNewPlName] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  // Cross-party state
  const [isInCrossPartyRoom, setIsInCrossPartyRoom] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const { isTablet } = useDeviceType();
  const { showAlert } = useAlert();
  console.log('🚀 Mode tablette:', isTablet);

  const imageScale = useRef(new Animated.Value(0.8)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listTranslate = useRef(new Animated.Value(50)).current;

  // --- Fonction de chargement des favoris ---
  const loadFavorites = async () => {
    try {
      setLoading(true);
      setDebugInfo('Chargement en cours...');
      
      console.log('🎵 === CHARGEMENT FAVORIS ===');
      const isAuth = authService.isAuthenticated();
      console.log('🎵 1. Utilisateur connecté:', isAuth);
      setDebugInfo(`Auth: ${isAuth ? 'Oui' : 'Non'} - Récupération...`);
      
      const favs = await getFavorites();
      console.log('🎵 2. Favoris récupérés:', favs?.length || 0);
      setDebugInfo(`Trouvé ${favs?.length || 0} favoris`);
      
      if (favs && Array.isArray(favs)) {
        setFavorites([...favs]);
        setDebugInfo(`${favs.length} favoris chargés ✓`);
        console.log('🎵 3. State mis à jour avec', favs.length, 'favoris');
        
        // 🔄 FORCER LE RE-RENDER GRAPHIQUE
        setTimeout(() => {
          setRenderKey(prev => prev + 1);
          console.log('🔄 Re-render forcé pour l\'affichage');
        }, 100);
      } else {
        console.error('🎵 ❌ Résultat invalide:', favs);
        setFavorites([]);
        setDebugInfo('❌ Données invalides');
      }
    } catch (error) {
      console.error('🎵 ❌ Erreur:', error);
      setFavorites([]);
      setDebugInfo(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Chargement initial ---
  useEffect(() => {
    console.log('🎵 🚀 MONTAGE COMPOSANT - Chargement initial');
    loadFavorites();
  }, []);

  // --- Re-chargement si l'état d'authentification change ---
  useEffect(() => {
    const checkAuth = () => {
      console.log('🎵 🔄 Vérification auth state:', authService.isAuthenticated());
      loadFavorites();
    };

    // Vérifier périodiquement l'état d'auth (au cas où Firebase mettrait du temps)
    const interval = setInterval(checkAuth, 1000);
    
    // Nettoyer l'interval après 10 secondes
    setTimeout(() => clearInterval(interval), 10000);

    return () => clearInterval(interval);
  }, []);

  // --- Listener pour les mises à jour de favoris ---
  useEffect(() => {
    const sub = favEmitter.addListener('update', (favs) => {
      console.log('🎵 Favoris mis à jour via emitter:', favs.length, 'pistes');
      setFavorites([...favs]);
    });
    
    return () => sub.remove();
  }, []);

  // Charger les playlists quand le modal s'ouvre
  useEffect(() => {
    if (plistModalVisible) {
      (async () => {
        const pls = await getPlaylists();
        setPlaylists(pls);
      })();
    }
  }, [plistModalVisible]);

  // --- Rechargement à chaque focus sur la page ---
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Page des favoris focalisée - rechargement...');
      loadFavorites();
      
      // Force un re-render graphique immédiat
      setRenderKey(prev => prev + 1);
    }, [])
  );

  // --- Détecter si l'utilisateur est dans une room cross-party ---
  useEffect(() => {
    const checkCrossPartyStatus = () => {
      const roomInfo = crossPartyService.getCurrentRoomInfo();
      setIsInCrossPartyRoom(!!roomInfo?.roomId);
    };

    // Vérifier au chargement
    checkCrossPartyStatus();

    // Écouter les changements de room
    const unsubscribe = crossPartyService.subscribeToHostStatusChanges((status) => {
      checkCrossPartyStatus();
    });

    return () => unsubscribe?.remove?.();
  }, []);

  // --- Vérifier l'authentification ---
  useEffect(() => {
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);

    // Écouter les changements d'authentification en temps réel
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe?.();
  }, []);

  // --- Animations d'entrée ---
  useEffect(() => {
    Animated.sequence([
      Animated.spring(imageScale, { toValue: 1, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(listOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(listTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleFavorite = async (track) => {
    if (!isAuthenticated) {
      showAlert({
        title: '❌ Non connecté',
        message: 'Vous devez être connecté pour ajouter des favoris',
        type: 'info',
      });
      return;
    }
    await toggleFavorite(track);
  };

  // --- Ajouter à une playlist ---
  const openAddToPlaylist = (track) => {
    if (!isAuthenticated) {
      showAlert({
        title: '❌ Non connecté',
        message: 'Vous devez être connecté pour ajouter des pistes aux playlists',
        type: 'info',
      });
      return;
    }
    setSelectedTrack(track);
    setNewPlName('');
    setPlistModalVisible(true);
  };

  const handleAddToExisting = async (playlistId) => {
    if (!selectedTrack) return;
    await addTrack(playlistId, selectedTrack);
    setPlistModalVisible(false);
  };

  const handleCreateAndAdd = async () => {
    if (!selectedTrack) return;
  const name = newPlName.trim() || 'New playlist';
    const pl = await createPlaylist(name);
    await addTrack(pl.id, selectedTrack);
    setPlistModalVisible(false);
  };

  const isFav = (track) =>
    favorites.some(
      (f) =>
        f.title === track.title &&
        f.album === track.album &&
        (f.crossTitle === track.crossTitle || !f.crossTitle)
    );

  // --- Lecture de tous les favoris ---
  const handlePlayAll = () => {
    const playable = favorites.filter((t) => t.url);
    if (playable.length === 0) return;
    setGlobalTracks(playable);
    playTrack(playable[0], 0);
  };

  // --- Lecture d'une piste individuelle (avec gestion cross-party) ---
  const handleTrackPlay = async (track, trackIndex = 0) => {
    const roomInfo = crossPartyService.getCurrentRoomInfo();
    const inRoom = !!roomInfo?.roomId;

    if (inRoom) {
      // En room → ajouter à la queue
      await handleAddToQueue(track);
    } else {
      // Pas en room → lancer la piste
      setGlobalTracks(favorites.filter((t) => t.url));
      playTrack(track, trackIndex);
    }
  };

  // --- Ajouter une piste à la queue cross-party ---
  const handleAddToQueue = async (track) => {
    if (!isInCrossPartyRoom) {
      showAlert({
        title: '❌ Pas dans une room',
        message: 'Vous devez être dans une room cross-party pour ajouter des pistes à la queue',
        type: 'info',
      });
      return;
    }

    try {
      const trackData = {
        id: track.id || track.trackId,
        title: track.title || track.name,
        artist: track.artist || track.artistName,
        album: track.album || track.albumName,
        duration: track.duration || 0,
        uri: track.uri || track.url,
        url: track.uri || track.url,
        image: track.image || track.albumArt,
      };

      const roomInfo = crossPartyService.getCurrentRoomInfo();
      const result = await crossPartyService.addToQueue(
        trackData,
        roomInfo.userId,
        roomInfo.isHost ? 'Host' : 'You'
      );
      if (result.success) {
        showAlert({
          title: '✅ Ajoutée à la queue',
          message: `${track.title} a été ajoutée à la queue`,
          type: 'success',
        });
      } else {
        showAlert({
          title: '❌ Erreur',
          message: result.error || 'Impossible d\'ajouter à la queue',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      showAlert({
        title: '❌ Erreur',
        message: error.message || 'Une erreur est survenue',
        type: 'error',
      });
    }
  };

  // --- Générer la mosaïque du fond ---
  const getMosaicGrid = () => {
    const imgs = favorites.slice(0, 4).map((f) => f.image);
    while (imgs.length < 4) imgs.push(imgs[0] || null);
    return imgs;
  };
  const mosaicImages = getMosaicGrid();

  console.log('🚀 RENDU FavoritesScreen - isTablet:', isTablet, 'favorites:', favorites.length);
  
  return (
    <View style={styles.container}>
      {/* Volet de verrouillage si pas authentifié */}
      {!isAuthenticated && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={64} color="white" />
          <Text style={styles.lockTitle}>Sign in required</Text>
          <Text style={styles.lockSubtitle}>You must be logged in to view your favorites</Text>
        </View>
      )}

      
      {/* 🌌 Fond mosaïque + flou */}
      <View style={[styles.backgroundWrapper, !isAuthenticated && styles.blurred]}>
        {mosaicImages.map((img, i) => (
          <Image
            key={i}
            source={img ? { uri: img } : null}
            style={styles.mosaicTile}
            resizeMode="cover"
          />
        ))}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.darkOverlay} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        {/* === EN-TÊTE (Mobile uniquement) === */}
        {!isTablet && (
          <View style={styles.headerSection}>
            <Animated.View style={{ transform: [{ scale: imageScale }] }}>
              <View style={styles.mosaicContainer}>
                {mosaicImages.map((img, i) => (
                  <Image key={i} source={img ? { uri: img } : null} style={styles.mosaicImage} />
                ))}
              </View>
            </Animated.View>

            <View style={styles.albumTextBlock}>
              <Text style={styles.albumTitle}>Favorites</Text>
              <Text style={styles.trackCount}>
                {favorites.length} {favorites.length === 1 ? 'track' : 'tracks'}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: 'white' }]}
                  onPress={handlePlayAll}
                >
                  <Ionicons name="play" size={18} color="black" style={{ marginRight: 8 }} />
                  <Text style={[styles.actionText, { color: 'black' }]}>Play All</Text>
                </TouchableOpacity>
                
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: 'blue', marginLeft: 10 }]}
                    onPress={async () => {
                      console.log('🔄 Rechargement manuel des favoris...');
                      const newFavs = await getFavorites();
                      console.log('🔄 Favoris rechargés:', newFavs);
                      console.log('🔄 Détails premier favori:', JSON.stringify(newFavs[0], null, 2));
                      // Forcer un re-render complet
                      setFavorites([]);
                      setTimeout(() => setFavorites([...newFavs]), 100);
                    }}
                  >
                    <Ionicons name="refresh" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={[styles.actionText, { color: 'white' }]}>Refresh</Text>
                  </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* === LISTE DES FAVORIS === */}
        {favorites.length === 0 ? (
          <Animated.View 
            key={`favorites-empty-${renderKey}`}
            style={{ transform: [{ translateY: listTranslate }], opacity: listOpacity }}
          >
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
              No favorites yet 💔
            </Text>
          </Animated.View>
        ) : isTablet ? (
          // === INTERFACE TABLETTE (SANS ANIMATION) ===
          <View 
            key={`tablet-${renderKey}-${favorites.length}`}
            style={styles.tabletLayout}
          >
            {/* Côté gauche - Mosaïque */}
            <View style={styles.tabletLeftSide}>
              <Animated.View style={[styles.mosaicContainer, { transform: [{ scale: imageScale }] }]}>
                {mosaicImages.map((img, i) => (
                  <Image key={i} source={img ? { uri: img } : null} style={styles.mosaicImage} />
                ))}
              </Animated.View>
              
              <Text style={styles.tabletTitle}>My Favorites</Text>
              <Text style={styles.tabletSubtitle}>
                {favorites.length} {favorites.length === 1 ? 'track' : 'tracks'}
              </Text>
              
              {/* Boutons d'action */}
              <View style={styles.tabletButtonsContainer}>
                <TouchableOpacity style={styles.playAllButton} onPress={handlePlayAll}>
                  <Ionicons name="play" size={18} color="black" style={{ marginRight: 8 }} />
                  <Text style={styles.playAllText}>Play All</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.tabletActionButton, { backgroundColor: 'blue' }]} 
                  onPress={() => {
                    console.log('🔄 Rechargement manuel des favoris...');
                    loadFavorites();
                  }}
                >
                  <Ionicons name="refresh" size={18} color="white" style={{ marginRight: 8 }} />
                  <Text style={[styles.tabletActionText, { color: 'white' }]}>Refresh</Text>
                </TouchableOpacity>
              </View>
              
              {/* Statistiques supplémentaires */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Ionicons name="musical-notes" size={16} color="#aaa" />
                  <Text style={styles.statText}>
                    {favorites.filter(t => t.url).length} available
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="heart" size={16} color="red" />
                  <Text style={styles.statText}>Your favorites</Text>
                </View>
              </View>
            </View>

            {/* Côté droit - Liste des pistes */}
            <ScrollView style={styles.tabletRightSide} showsVerticalScrollIndicator={false}>

              {favorites.map((track, index) => {
                const playable = !!track.url;
                return (
                  <TouchableOpacity
                    key={track.favId || index}
                    style={[
                      styles.tabletTrackItem, 
                      !playable && styles.disabledTrack,
                      { backgroundColor: playable ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)' }
                    ]}
                    onPress={() => {
                      if (playable) {
                        handleTrackPlay(track, index);
                      }
                    }}
                    disabled={!playable}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trackNumber}>
                      <Text style={[styles.trackNumberText, { color: playable ? '#fff' : '#555' }]}>
                        {index + 1}
                      </Text>
                    </View>
                    
                    <Image 
                      source={{ uri: track.image }} 
                      style={[styles.tabletTrackImage, !playable && { opacity: 0.5 }]}
                      resizeMode="cover"
                    />
                    
                    <View style={styles.trackDetails}>
                      <Text style={[styles.trackTitle, !playable && styles.disabledText]}>
                        {track.title}
                        {!playable && <Text style={styles.unavailableTag}> (Unavailable)</Text>}
                      </Text>
                      <Text style={[styles.trackAlbum, !playable && styles.disabledText]}>
                        {track.album}
                      </Text>
                    </View>
                    {/* ➕ Ajouter à une playlist */}
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={() => openAddToPlaylist(track)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addButtonText}>＋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.favoriteButton}
                      onPress={() => handleFavorite(track)}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name="heart"
                        size={22}
                        color="red"
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          // === AFFICHAGE MOBILE (original) ===
          <Animated.View 
            key={`mobile-${renderKey}-${favorites.length}`}
            style={{ transform: [{ translateY: listTranslate }], opacity: listOpacity }}
          >
            {favorites.map((track, index) => {
              const playable = !!track.url;
              return (
                <View key={track.favId || index} style={styles.trackWrapper}>
                  <TouchableOpacity
                    onPress={() => {
                      if (playable) {
                        handleTrackPlay(track, index);
                      }
                    }}
                    disabled={!playable}
                    style={[styles.trackPill, { opacity: playable ? 1 : 0.5 }]}
                  >
                    <Image source={{ uri: track.image }} style={styles.trackIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 16 }}>
                        {track.title}
                      </Text>
                      <Text style={{ color: '#aaa', fontSize: 14, marginTop: 2 }}>
                        {track.album}
                      </Text>
                    </View>
                    {/* ➕ Ajouter à une playlist */}
                    <TouchableOpacity style={styles.addButton} onPress={() => openAddToPlaylist(track)}>
                      <Text style={styles.addButtonText}>＋</Text>
                    </TouchableOpacity>
                    {/* ❤️ Bouton Favori */}
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
            })}
          </Animated.View>
        )}

        {/* Modal d'ajout à une playlist */}
        <Modal
          visible={plistModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPlistModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add to playlist</Text>

              {/* Liste des playlists existantes */}
              <ScrollView style={{ maxHeight: 220 }}>
                {playlists.length === 0 ? (
                  <Text style={{ color: '#999', textAlign: 'center', marginVertical: 8 }}>
                    No playlists yet
                  </Text>
                ) : (
                  playlists.map((pl) => (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.modalPlaylistItem}
                      onPress={() => handleAddToExisting(pl.id)}
                    >
                      <Ionicons name="list" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#fff', flex: 1 }}>{pl.name}</Text>
                      <Text style={{ color: '#888' }}>{pl.tracks?.length || 0}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {/* Create a new playlist */}
              <View style={styles.modalDivider} />
              <View style={styles.modalRow}>
                <TextInput
                  value={newPlName}
                  onChangeText={setNewPlName}
                  placeholder="Playlist name"
                  placeholderTextColor="#777"
                  style={styles.modalInput}
                />
                <TouchableOpacity style={styles.modalCreateButton} onPress={handleCreateAndAdd}>
                  <Text style={styles.modalCreateButtonText}>Create and add</Text>
                </TouchableOpacity>
              </View>

              {/* Close */}
              <TouchableOpacity style={styles.modalClose} onPress={() => setPlistModalVisible(false)}>
                <Text style={{ color: '#bbb' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // === FOND MOSAÏQUE ===
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mosaicTile: { width: '50%', height: '50%' },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // === ROOM BADGE ===
  // Supprimé - maintenant dans App.js
  
  headerSection: { alignItems: 'center', marginTop: 110, marginBottom: 30 },
  mosaicContainer: {
    width: Math.min(width * 0.6, 300), // Taille max pour tablette
    height: Math.min(width * 0.6, 300),
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 20,
    overflow: 'hidden',
  },
  mosaicImage: { width: '50%', height: '50%', resizeMode: 'cover' },
  albumTextBlock: { alignItems: 'center', marginTop: 18 },
  albumTitle: { color: 'white', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  trackCount: { color: '#aaa', fontSize: 14, marginTop: 6 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 6,
    minHeight: 44,
    minWidth: 120,
  },
  actionText: { fontWeight: '600', fontSize: 14 },

  // === LISTE ===
  trackWrapper: { 
    paddingHorizontal: 20, // Padding au lieu de margin pour que les pastilles respirent
    marginBottom: 12,
  },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: width > 600 ? 18 : 16,
    paddingHorizontal: width > 600 ? 24 : 20,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    minHeight: width > 600 ? 80 : 60, // Hauteur minimale plus importante
    flex: 1, // Maintenant avec du padding sur le wrapper, ça va respirer
  },
  trackIcon: { 
    width: width > 600 ? 60 : 45, // Plus grand sur tablette
    height: width > 600 ? 60 : 45, 
    borderRadius: 12, 
    marginRight: width > 600 ? 20 : 12 // Plus d'espacement sur tablette
  },
  trackTitle: { 
    fontSize: width > 600 ? 18 : 16, // Plus grand sur tablette
    fontWeight: '600' 
  },
  trackSubtitle: { 
    fontSize: width > 600 ? 14 : 12, // Plus grand sur tablette
    color: '#aaa', 
    marginTop: 2 
  },
  heartButton: { paddingHorizontal: 6, marginLeft: 4 },
  addButton: { paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  addButtonText: { color: 'white', fontSize: 20, lineHeight: 20 },

  // === STYLES TABLETTE ===
  // === STYLES TABLETTE (comme AlbumScreen) ===
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
  tabletRightSide: {
    flex: 0.65,
    paddingLeft: 20,
    paddingRight: 20,
  },
  tabletTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 30,
    marginBottom: 8,
    textAlign: 'center',
  },
  tabletSubtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 20,
    textAlign: 'center',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minHeight: 44,
    minWidth: 120,
  },
  playAllText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
  },
  tabletButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tabletActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minHeight: 44,
    minWidth: 120,
  },
  tabletActionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  statsContainer: {
    marginTop: 10,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    color: '#aaa',
    fontSize: 14,
  },
  listHeader: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  listHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  listHeaderLine: {
    height: 2,
    backgroundColor: 'white',
    borderRadius: 1,
    width: 60,
  },
  tabletTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 6,
    marginHorizontal: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    minHeight: 70,
  },
  disabledTrack: {
    opacity: 0.5,
  },
  trackNumber: {
    width: 30,
    alignItems: 'center',
    marginRight: 12,
  },
  trackNumberText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
  },
  tabletTrackImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 16,
  },
  trackDetails: {
    flex: 1,
  },
  trackTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackAlbum: {
    color: '#aaa',
    fontSize: 15,
  },
  disabledText: {
    color: '#666',
  },
  favoriteButton: {
    padding: 8,
  },
  unavailableTag: {
    color: '#ff6b6b',
    fontSize: 12,
    fontStyle: 'italic',
  },
  listFooter: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  listFooterText: {
    color: '#aaa',
    fontSize: 14,
    fontStyle: 'italic',
  },
  tabletLeftSide: {
    flex: 0.35,
    alignItems: 'center',
    paddingRight: 20,
  },
  tabletMosaicContainer: {
    width: 280,
    height: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 20,
    overflow: 'hidden',
  },
  tabletMosaicImage: {
    width: '50%',
    height: '50%',
  },
  tabletRightSide: {
    flex: 0.65,
    paddingLeft: 20,
  },
  tabletHeader: {
    marginBottom: 30,
    paddingTop: 20, // Espace supplémentaire en haut de l'en-tête
  },
  tabletTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  tabletTrackCount: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 16,
  },
  tabletActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabletActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  tabletActionText: {
    fontWeight: '600',
    fontSize: 14,
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
    marginRight: 12,
  },
  tabletPlayIcon: {
    marginRight: 12,
  },
  tabletTrackInfo: {
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
  },
  tabletHeartButton: {
    padding: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalPlaylistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },
  modalCreateButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCreateButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  blurred: {
    opacity: 0.3,
  },
  modalClose: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
