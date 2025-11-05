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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';
import { useAlert } from '../src/components/CustomAlert';
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
  playNext,
  playPrevious,
  
} from '../src/api/player';
import { getPlaylists, createPlaylist, addTrack } from '../src/api/playlists';
import crossPartyService from '../src/services/crossPartyService';
import authService from '../src/services/auth';

const { width } = Dimensions.get('window');
const safeImage = 'https://i.imgur.com/ODLC1hY.jpeg';
const safeAlbum = 'Unknown';

export default function PlayerScreen({ navigation }) {
  const [track, setTrack] = useState(getCurrentTrack());
  const [status, setStatus] = useState(getPlaybackStatus());
  const [isPlaying, setIsPlaying] = useState(isTrackPlaying());
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [crossList, setCrossList] = useState([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { isTablet, dimensions, isLandscape } = useDeviceType();
  const { showAlert } = useAlert();
  const scrollXTitle = useRef(new Animated.Value(0)).current;
  const scrollXAlbum = useRef(new Animated.Value(0)).current;
  const [plistModal, setPlistModal] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlName, setNewPlName] = useState('');

  // Vérifier et mettre à jour le statut de room
  useEffect(() => {
    const roomInfo = crossPartyService.getCurrentRoomInfo();
    setIsInRoom(crossPartyService.isInRoom());
    setIsHost(roomInfo.isHost);

    // S'abonner aux changements de statut host
    const unsubscribe = crossPartyService.subscribeToHostStatusChanges((data) => {
      console.log(`🎮 PlayerScreen: Host status changed:`, data);
      setIsHost(data.isHost);
      setIsInRoom(data.roomId !== null);
    });

    return () => {
      if (typeof unsubscribe?.remove === 'function') unsubscribe.remove();
    };
  }, []);

  // Vérifier l'authentification
  useEffect(() => {
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);
  }, []);

  useEffect(() => {
    const q = getQueue ? getQueue() : [];
    setQueue(q);
    const idx = q.findIndex(
      (t) => (track?.url && t.url === track.url) || (track?.id && t.id === track.id)
    );
    setCurrentIndex(idx);
  }, []);

  const openAddToPlaylist = async () => {
    const pls = await getPlaylists();
    setPlaylists(pls);
    setPlistModal(true);
  };

  const handleAddToExisting = async (playlistId) => {
    if (!track) return;
    await addTrack(playlistId, track);
    setPlistModal(false);
  };

  const handleCreateAndAdd = async () => {
    const name = (newPlName || 'New playlist').trim();
    const pl = await createPlaylist(name);
    if (pl) {
      await addTrack(pl.id, track);
      // Naviguer vers la playlist créée
      if (isTablet) {
        // En tablette, commuter sur l'onglet You (YouStack gère le détail depuis la liste)
        navigation.navigate('You');
      } else {
        // Sur téléphone, deep-link vers YouStack > PlaylistDetail
        navigation.navigate('MainLayout', {
          screen: 'You',
          params: { screen: 'PlaylistDetail', params: { playlistId: pl.id } },
        });
      }
    }
    setNewPlName('');
    setPlistModal(false);
  };

  useEffect(() => {
    const playSub = playerEmitter.addListener('play', ({ track }) => {
      setTrack(track);
      setIsPlaying(true);
      const q = getQueue ? getQueue() : [];
      setQueue(q);
      const idx = q.findIndex(
        (t) => (track?.url && t.url === track.url) || (track?.id && t.id === track.id)
      );
      setCurrentIndex(idx);
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

  // Gérer la liste CrossMusic
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

  const duration = status.durationMillis || 1;
  const position = status.positionMillis || 0;

  const togglePlayPause = async () => {
    // Les guests ne peuvent pas contrôler la musique dans une room
    if (isInRoom && !isHost) {
      showAlert({ title: 'Read Only', message: 'Only the host can control playback in a party room.', type: 'warning' });
      return;
    }

    console.log('🎮 PlayerScreen: togglePlayPause appelé', { 
      isPlaying, 
      isTablet, 
      action: isPlaying ? 'pause' : 'resume' 
    });
    
    if (isPlaying) {
      await pauseTrack();
      // setIsPlaying sera appelé automatiquement par l'événement 'pause'
    } else {
      await resumeTrack();
      // setIsPlaying sera appelé automatiquement par l'événement 'resume'
    }
  };

  const handlePlayCross = (item) => {
    // Les guests ne peuvent pas changer la musique dans une room
    if (isInRoom && !isHost) {
      showAlert({ title: 'Read Only', message: 'Only the host can change the track in a party room.', type: 'warning' });
      return;
    }

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

  const handleSeekTo = (position) => {
    // Les guests ne peuvent pas contrôler la position dans une room
    if (isInRoom && !isHost) {
      showAlert({ title: 'Read Only', message: 'Only the host can seek in a party room.', type: 'warning' });
      return;
    }
    seekTo(position);
  };

  const handlePlayNext = () => {
    // Les guests ne peuvent pas contrôler la queue dans une room
    if (isInRoom && !isHost) {
      showAlert({ title: 'Read Only', message: 'Only the host can skip tracks in a party room.', type: 'warning' });
      return;
    }
    playNext();
  };

  const handlePlayPrevious = () => {
    // Les guests ne peuvent pas contrôler la queue dans une room
    if (isInRoom && !isHost) {
      showAlert({ title: 'Read Only', message: 'Only the host can skip tracks in a party room.', type: 'warning' });
      return;
    }
    playPrevious();
  };

  if (!track) {
    return (
      <View style={styles.empty}>
  <Text style={styles.emptyText}>No track playing</Text>
      </View>
    );
  }

  const hasQueue = queue && queue.length > 1;
  const crossCount = track.crossmusic ? track.crossmusic.length : 0;

  // Helper function to format time
  const formatTime = (millis) => {
    const seconds = Math.floor(millis / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Tablet queue renderer
  const renderTabletQueue = () => (
    <View style={styles.tabletQueueSection}>
      <Text style={styles.tabletSectionTitle}>Queue ({queue.length} tracks)</Text>
      <FlatList
        data={queue}
        horizontal={true}
        keyExtractor={(item, i) => `${item.id || item.url || item.title}-${i}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        renderItem={({ item, index }) => {
          const isCurrent = index === currentIndex;
          const crossCount = item.crossmusic ? item.crossmusic.length : 0;

          return (
            <TouchableOpacity
              style={styles.tabletQueueCard}
              onPress={() => playTrack(item, index)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.image || safeImage }}
                style={styles.tabletQueueImage}
                resizeMode="cover"
              />
              {isCurrent && (
                <View style={styles.tabletCurrentIndicator}>
                  <Ionicons name="musical-notes" size={24} color="white" />
                </View>
              )}
              {crossCount > 0 && (
                <View style={styles.tabletCrossBadge}>
                  <Text style={styles.tabletCrossCount}>{crossCount}</Text>
                </View>
              )}
              <Text numberOfLines={2} style={styles.tabletQueueTitle}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  // Tablet cross music renderer
  const renderTabletCrossMusic = () => (
    <View style={styles.tabletQueueSection}>
      <Text style={styles.tabletSectionTitle}>CrossMusic ({crossList.length})</Text>
      <FlatList
        data={crossList}
        horizontal={true}
        keyExtractor={(item, i) => item.isOriginal ? 'original' : `${item.title}-${i}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tabletQueueCard}
            onPress={() => handlePlayCross(item)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.image || track.image || safeImage }}
              style={styles.tabletQueueImage}
              resizeMode="cover"
            />
            <Text 
              numberOfLines={2} 
              style={[
                styles.tabletQueueTitle,
                item.isOriginal && { color: '#1f4cff', fontWeight: '900' }
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // Tablet layout with side-by-side view
  if (isTablet) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: track.image || safeImage }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header with badge + Add to playlist */}
        <View style={styles.tabletHeader}>
          {hasQueue && crossCount > 0 && (
            <View style={styles.crossMusicBadgeTop}>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'transparent']}
                style={{
                  ...StyleSheet.absoluteFillObject,
                  top: 0,
                  height: '50%',
                  borderTopLeftRadius: 14,
                  borderBottomLeftRadius: 14,
                  borderTopRightRadius: 26,
                  borderBottomRightRadius: 26,
                }}
              />
              <Ionicons name="shuffle" size={20} color="#fff" />
              <Text style={styles.crossBadgeTextTop}>{crossCount}</Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.addBtn} 
            onPress={openAddToPlaylist}
            disabled={!isAuthenticated}
          >
            <Ionicons name="add-circle" size={26} color={isAuthenticated ? "#fff" : "#555"} />
          </TouchableOpacity>
        </View>

        {/* Tablet main content */}
        <View style={styles.tabletContent}>
          {/* Left side - Album artwork */}
          <View style={styles.tabletArtwork}>
            <Image 
              source={{ uri: track.image || safeImage }} 
              style={styles.tabletAlbumImage}
            />
          </View>

          {/* Right side - Controls and info */}
          <View style={styles.tabletControls}>
            {/* Track info */}
            <View style={styles.tabletTrackInfo}>
              <Text style={[styles.title, styles.tabletTitle]}>
                {track.crossTitle ? track.crossTitle : track.title}
              </Text>

              {track.crossTitle && (
                <View style={styles.crossBadge}>
                  <Ionicons name="musical-notes" size={20} color="#1f4cff" style={{ marginHorizontal: 4 }} />
                  <Text style={[styles.crossTitle, { fontSize: 18 }]}>{track.title}</Text>
                </View>
              )}

              <Text style={[styles.album, styles.tabletAlbum]}>{track.album}</Text>
            </View>

            {/* Progress slider */}
            <View style={styles.tabletProgressContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={{ flex: 1, height: 40 }}
                  minimumValue={0}
                  maximumValue={duration}
                  value={position}
                  minimumTrackTintColor="#1f4cff"
                  maximumTrackTintColor="#777"
                  thumbTintColor="#1f4cff"
                  onSlidingComplete={handleSeekTo}
                  disabled={isInRoom && !isHost}
                />
              </View>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Main controls */}
            <View style={styles.tabletMainControls}>
              <TouchableOpacity onPress={handlePlayPrevious} style={styles.controlButton} disabled={isInRoom && !isHost}>
                <Ionicons name="play-skip-back" size={44} color={isInRoom && !isHost ? '#666' : 'white'} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.tabletPlayButton} onPress={togglePlayPause}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={48} color="black" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePlayNext} style={styles.controlButton} disabled={isInRoom && !isHost}>
                <Ionicons name="play-skip-forward" size={44} color={isInRoom && !isHost ? '#666' : 'white'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom section - Queue/CrossMusic */}
        {(hasQueue || crossList.length > 0) && (
          <View style={styles.tabletBottomSection}>
            {hasQueue ? renderTabletQueue() : renderTabletCrossMusic()}
          </View>
        )}
        {/* Modal Add to Playlist (tablet) */}
        <Modal transparent visible={plistModal} animationType="fade" onRequestClose={() => setPlistModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add to playlist</Text>
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 240 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.plRow} onPress={() => handleAddToExisting(item.id)}>
                    <Ionicons name="musical-notes" size={18} color="#1f4cff" />
                    <Text style={styles.plRowText}>{item.name}</Text>
                    <Text style={styles.plCount}>{item.tracks?.length || 0}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <View style={{ paddingVertical: 12 }}>
                    <Text style={{ color: '#aaa' }}>No playlists yet</Text>
                  </View>
                )}
              />

              <View style={styles.separator} />
              <Text style={[styles.modalTitle, { marginTop: 8 }]}>New playlist</Text>
              <TextInput
                style={styles.input}
                placeholder="Playlist name"
                placeholderTextColor="#666"
                value={newPlName}
                onChangeText={setNewPlName}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setPlistModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={handleCreateAndAdd}>
                  <Text style={styles.modalConfirmText}>Create and add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Phone layout (original)
  return (
    <>
    <View style={styles.container}>
      <Image source={{ uri: track.image || safeImage }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Bouton retour */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={openAddToPlaylist}
          disabled={!isAuthenticated}
        >
          <Ionicons name="add-circle" size={26} color={isAuthenticated ? "#fff" : "#555"} />
        </TouchableOpacity>
      </View>

      {/* 🌟 PASTILLE EN HAUT À DROITE */}
      {hasQueue && crossCount > 0 && (
        <View style={styles.crossMusicBadgeTop}>
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'transparent']}
            style={{
              ...StyleSheet.absoluteFillObject,
              top: 0,
              height: '50%',
              borderTopLeftRadius: 14,
              borderBottomLeftRadius: 14,
              borderTopRightRadius: 26,
              borderBottomRightRadius: 26,
            }}
          />
          <Ionicons name="shuffle" size={18} color="#fff" />
          <Text style={styles.crossBadgeTextTop}>{crossCount}</Text>
        </View>
      )}

      <View style={styles.center}>
        {/* === TITRE ET CROSS BADGE === */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {track.crossTitle ? track.crossTitle : track.title}
          </Text>

          {/* Indicateur CrossMusic */}
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

          <Text style={styles.album}>{track.album}</Text>
        </View>

        {/* SLIDER */}
        <View style={styles.progressContainer}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            minimumTrackTintColor="#1f4cff"
            maximumTrackTintColor="#777"
            thumbTintColor="#1f4cff"
            onSlidingComplete={handleSeekTo}
            disabled={isInRoom && !isHost}
          />
        </View>

        {/* CONTROLS */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={handlePlayPrevious} disabled={isInRoom && !isHost}>
            <Ionicons name="play-skip-back" size={36} color={isInRoom && !isHost ? '#666' : 'white'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="black" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePlayNext} disabled={isInRoom && !isHost}>
            <Ionicons name="play-skip-forward" size={36} color={isInRoom && !isHost ? '#666' : 'white'} />
          </TouchableOpacity>
        </View>

        {/* === FILE DE LECTURE OU MODE SOLO === */}
        {hasQueue ? (
          <View style={styles.crossSection}>
            <Text style={styles.queueTitle}>File de lecture</Text>
            <FlatList
              data={queue}
              horizontal
              keyExtractor={(item, i) => `${item.id || item.url || item.title}-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item, index }) => {
                const isCurrent = index === currentIndex;
                const crossCount = item.crossmusic ? item.crossmusic.length : 0;

                return (
                  <TouchableOpacity
                    style={styles.crossCard}
                    onPress={() => playTrack(item, index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: item.image || safeImage }}
                      style={styles.crossImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,1)']}
                      style={styles.crossGradient}
                    />
                    {isCurrent && (
                      <View style={styles.nowPlayingIconCentered}>
                        <Ionicons name="musical-notes" size={60} color="white" />
                      </View>
                    )}
                    {crossCount > 0 && (
                      <View style={styles.crossMusicBadge}>
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
                        <Ionicons name="shuffle" size={14} color="#fff" />
                        <Text style={styles.crossBadgeText}>{crossCount}</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.crossCardTitle}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : (
          crossList.length > 0 && (
            <View style={styles.crossSection}>
              <Text style={styles.queueTitle}>CrossMusic</Text>
              <FlatList
                data={crossList}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, i) => item.isOriginal ? 'original' : `${item.title}-${i}`}
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
                      colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,1)']}
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
          )
        )}
      </View>
    </View>
    {/* Modal Add to Playlist */}
    <Modal transparent visible={plistModal} animationType="fade" onRequestClose={() => setPlistModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add to playlist</Text>
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 240 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.plRow} onPress={() => handleAddToExisting(item.id)}>
                <Ionicons name="musical-notes" size={18} color="#1f4cff" />
                <Text style={styles.plRowText}>{item.name}</Text>
                <Text style={styles.plCount}>{item.tracks?.length || 0}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={{ paddingVertical: 12 }}>
                <Text style={{ color: '#aaa' }}>No playlists yet</Text>
              </View>
            )}
          />

          <View style={styles.separator} />
          <Text style={[styles.modalTitle, { marginTop: 8 }]}>New playlist</Text>
          <TextInput
            style={styles.input}
            placeholder="Playlist name"
            placeholderTextColor="#666"
            value={newPlName}
            onChangeText={setNewPlName}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setPlistModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalConfirm} onPress={handleCreateAndAdd}>
              <Text style={styles.modalConfirmText}>Create and add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#777' },
  topBar: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { },
  addBtn: { },
  center: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40 },
  titleBlock: { alignItems: 'center', marginBottom: 30 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  album: { color: '#aaa', fontSize: 15, marginTop: 6 },

  // Tablet-specific styles
  tabletHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  tabletContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingVertical: 20,
    minHeight: 300,
  },
  tabletArtwork: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 30,
  },
  tabletAlbumImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    maxWidth: 400,
    maxHeight: 400,
  },
  tabletControls: {
    flex: 0.55,
    justifyContent: 'space-between',
    paddingLeft: 30,
    paddingVertical: 20,
  },
  tabletTrackInfo: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  tabletTitle: {
    fontSize: 36,
    textAlign: 'left',
  },
  tabletAlbum: {
    fontSize: 20,
    textAlign: 'left',
  },
  tabletProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 25,
  },
  sliderContainer: {
    flex: 1,
    marginHorizontal: 15,
  },
  timeText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'center',
  },
  tabletMainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  controlButton: {
    marginHorizontal: 20,
  },
  tabletPlayButton: {
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 25,
    marginHorizontal: 30,
  },
  tabletBottomSection: {
    height: 280,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 10,
  },
  tabletQueueSection: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    flex: 1,
  },
  tabletSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginLeft: 5,
  },
  tabletQueueCard: {
    width: 140,
    height: 200,
    margin: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabletQueueImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  tabletQueueTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    padding: 8,
    lineHeight: 16,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletCurrentIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  tabletCrossBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#1f4cff',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletCrossCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },

  crossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  crossTitle: {
    color: '#1f4cff',
    fontSize: 20,
    fontWeight: '900',
  },

  progressContainer: { width: '100%', marginBottom: 30 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', width: '70%', marginBottom: 30 },
  playButton: { backgroundColor: '#fff', borderRadius: 50, padding: 22 },
  crossSection: { width: '100%', alignItems: 'center', marginBottom: 40 },
  queueTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10, marginLeft: 20, alignSelf: 'flex-start' },
  crossCard: { width: width * 0.4, height: width * 0.4, borderRadius: 16, overflow: 'hidden', marginHorizontal: 10 },
  crossImage: { width: '100%', height: '100%' },
  crossGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  crossCardTitle: { position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '700' },
  nowPlayingIconCentered: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },

  crossMusicBadgeTop: {
    position: 'absolute', top: 50, right: -23,
    backgroundColor: '#1f4cff',
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14, borderTopRightRadius: 26, borderBottomRightRadius: 26,
    flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingLeft: 12, paddingRight: 32,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 60, borderWidth: 3, borderColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  crossBadgeTextTop: { color: '#fff', fontSize: 15, fontWeight: '900', marginLeft: 8, textShadowColor: 'rgba(255,255,255,0.35)', textShadowRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '86%', backgroundColor: '#151515', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  modalCancelText: { color: '#aaa', fontWeight: '700' },
  modalConfirm: { backgroundColor: '#1f4cff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 8 },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  plRowText: { color: '#fff', fontWeight: '700', flex: 1 },
  plCount: { color: '#aaa', fontSize: 12 },
  crossMusicBadge: {
    position: 'absolute', bottom: 110, right: -15, backgroundColor: '#1f4cff',
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderTopRightRadius: 22, borderBottomRightRadius: 22,
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 10, paddingRight: 26,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 50, borderWidth: 3, borderColor: 'rgba(0,0,0,0.6)', overflow: 'hidden',
  },
  crossBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 6, textShadowColor: 'rgba(255,255,255,0.35)', textShadowRadius: 4 },
});
