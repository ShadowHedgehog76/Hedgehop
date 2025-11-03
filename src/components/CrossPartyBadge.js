import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import crossPartyService from '../services/crossPartyService';
import { 
  playTrackFromCrossParty, 
  pauseFromCrossParty, 
  resumeFromCrossParty,
  setCrossPartyRoom,
  clearCrossPartyRoom,
  playerEmitter,
  stopAllAudio
} from '../api/player';

export default function CrossPartyBadge({ 
  isTablet = false, 
  roomId = null, 
  roomCode = null, 
  isHost = false,
  guestId = null,
  onClose 
}) {
  const [roomData, setRoomData] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [guests, setGuests] = useState([]);
  const [animatedValue] = useState(new Animated.Value(0));
  const [lastSyncedTrack, setLastSyncedTrack] = useState(null);
  const [lastLocalTrackTime, setLastLocalTrackTime] = useState(0);
  
  // ID unique pour cette instance du badge (pour éviter la boucle)
  const [instanceId] = useState(() => `${isHost ? 'host' : 'client'}_${Date.now()}_${Math.random()}`);

  useEffect(() => {
    if (!roomId) return;

    // Configurer le player pour CrossParty
    console.log('🎵 CrossParty Badge: Configuration du player avec roomId:', roomId, 'instanceId:', instanceId);
    setCrossPartyRoom(roomId, instanceId);

    // Écouter les changements de piste locaux
    const localTrackChangeListener = (data) => {
      console.log('🎵 CrossParty Badge: Changement de piste local détecté');
      setLastLocalTrackTime(data.timestamp);
    };
    const localTrackSubscription = playerEmitter.addListener('localTrackChange', localTrackChangeListener);

    // Écouter les changements du salon
    const listener = crossPartyService.listenToRoom(roomId, (data) => {
      if (data && data.isActive) {
        setRoomData(data);
        setGuests(data.guests ? Object.values(data.guests) : []);
        
        // Synchronisation de la lecture
        syncPlaybackWithRoom(data);
        
        // Animation d'apparition
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // Le salon a été fermé
        handleRoomClosed();
      }
    });

    return () => {
      crossPartyService.stopListeningToRoom(roomId);
      // Déconnecter le player du CrossParty
      clearCrossPartyRoom();
      // Supprimer l'écoute des événements locaux
      if (localTrackSubscription) {
        localTrackSubscription.remove();
      }
    };
  }, [roomId]);

  const handleRoomClosed = () => {
    Alert.alert(
      'Room closed', 
      isHost ? 'You closed the room' : 'The host closed the room',
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const syncPlaybackWithRoom = async (data) => {
    try {
      // Gérer les commandes d'arrêt global
      if (data.globalStop && data.globalStop.initiatorId !== instanceId) {
        console.log('🛑 CrossParty: Arrêt global reçu - arrêt de toute musique');
        try {
          await stopAllAudio(); // Utilise la fonction du player.js
          console.log('✅ CrossParty: Arrêt global effectué');
        } catch (error) {
          console.error('❌ Erreur arrêt global:', error);
        }
      }

      // Synchroniser la piste actuelle
      if (data.currentTrack && data.currentTrack.title !== lastSyncedTrack?.title) {
        const now = Date.now();
        const timeSinceLastLocal = now - lastLocalTrackTime;
        
        const trackInitiatorId = data.currentTrack.__metadata?.initiatorId;
        
        console.log('🎵 CrossParty Badge: Nouvelle piste détectée', {
          newTrack: data.currentTrack.title,
          lastSynced: lastSyncedTrack?.title,
          trackInitiatorId,
          myInstanceId: instanceId,
          isHost,
          roomId
        });
        
        // Éviter la double lecture si c'est notre propre changement
        if (trackInitiatorId === instanceId) {
          console.log('⏭️ CrossParty: Changement initié par nous - ignoré (éviter double lecture)');
        } else {
          console.log('🎵 CrossParty: Synchronisation de la nouvelle piste (changement externe)');
          await playTrackFromCrossParty(data.currentTrack);
        }
        setLastSyncedTrack(data.currentTrack);
      }

      // Synchroniser l'état de lecture (play/pause)
      if (data.playbackState) {
        const { isPlaying: roomIsPlaying, initiatorId: playbackInitiatorId } = data.playbackState;
        
        console.log('🎮 CrossParty Badge: Synchronisation play/pause', { 
          roomIsPlaying,
          playbackInitiatorId,
          myInstanceId: instanceId,
          isHost 
        });
        
        // Éviter la boucle si c'est notre propre changement de play/pause
        if (playbackInitiatorId === instanceId) {
          console.log('🎮 CrossParty: Changement play/pause initié par nous - ignoré');
        } else {
          if (roomIsPlaying) {
            console.log('▶️ CrossParty: Reprise de la lecture (changement externe)');
            await resumeFromCrossParty();
          } else {
            console.log('⏸️ CrossParty: Pause de la lecture (changement externe)');
            await pauseFromCrossParty();
          }
        }
      }
    } catch (error) {
      console.error('Erreur de synchronisation CrossParty:', error);
    }
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleCloseRoom = async () => {
    if (isHost) {
      Alert.alert(
        'Close room',
        'Are you sure you want to close this room?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Close',
            style: 'destructive',
            onPress: async () => {
              const result = await crossPartyService.closeRoom(roomId, roomCode);
              if (result.success) {
                onClose();
              } else {
                Alert.alert('Error', result.error);
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Leave room',
        'Are you sure you want to leave this room?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              if (guestId) {
                await crossPartyService.leaveRoom(roomId, guestId);
              }
              onClose();
            }
          }
        ]
      );
    }
  };

  if (!roomId || !roomData) {
    return null;
  }

  const CompactBadge = () => (
    <TouchableOpacity 
      style={[styles.compactBadge, isTablet ? styles.tabletBadge : styles.phoneBadge]}
      onPress={handleToggleExpanded}
    >
      <LinearGradient
        colors={['#1f4cff', '#0038cc']}
        style={styles.badgeGradient}
      >
        <Ionicons name="people" size={16} color="#fff" />
        <Text style={styles.compactText}>{roomCode}</Text>
        <View style={styles.guestCount}>
          <Text style={styles.guestCountText}>{guests.length}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const ExpandedView = () => (
    <Modal
      visible={isExpanded}
      transparent
      animationType="fade"
      onRequestClose={() => setIsExpanded(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.expandedContainer}>
          <LinearGradient
            colors={['#1a1a1a', '#2a2a2a']}
            style={styles.expandedContent}
          >
            {/* Header */}
            <View style={styles.expandedHeader}>
              <View style={styles.headerLeft}>
                <Ionicons name="people" size={24} color="#1f4cff" />
                <View style={styles.headerInfo}>
                  <Text style={styles.expandedTitle}>
                    {isHost ? 'Your room' : 'Room'}
                  </Text>
                  <Text style={styles.expandedCode}>Code: {roomCode}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsExpanded(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Status */}
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>
                {isHost ? 'Guests' : 'Participants'} ({guests.length})
              </Text>
              
              {guests.length === 0 ? (
                <Text style={styles.noGuests}>Waiting for guests...</Text>
              ) : (
                guests.map((guest, index) => (
                  <View key={guest.id} style={styles.guestItem}>
                    <Ionicons name="person" size={16} color="#1f4cff" />
                    <Text style={styles.guestName}>{guest.id}</Text>
                    <View style={[styles.statusDot, { 
                      backgroundColor: guest.isConnected ? '#22c55e' : '#f97316' 
                    }]} />
                  </View>
                ))
              )}
            </View>

            {/* Host QR */}
            {isHost && (
              <View style={styles.qrSection}>
                <Text style={styles.sectionTitle}>Shareable QR</Text>
                <View style={styles.qrWrapper}>
                  <QRCode value={roomCode || ''} size={180} backgroundColor="#fff" color="#000" />
                </View>
                <Text style={styles.qrHint}>Your friends can scan this code to join</Text>
              </View>
            )}

            {/* Current Track */}
            {roomData.currentTrack && (
              <View style={styles.trackSection}>
                <Text style={styles.sectionTitle}>Now playing</Text>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle}>{roomData.currentTrack.title}</Text>
                  <Text style={styles.trackArtist}>{roomData.currentTrack.artist}</Text>
                </View>
              </View>
            )}

            {/* Controls - now accessible to everyone */}
            <View style={styles.controlsSection}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={async () => {
                  try {
                    await crossPartyService.resumePlayback(roomId);
                    await resumeFromCrossParty();
                  } catch (error) {
                    console.error('CrossParty play error:', error);
                  }
                }}
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.controlText}>Play</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={async () => {
                  try {
                    await crossPartyService.pausePlayback(roomId);
                    await pauseFromCrossParty();
                  } catch (error) {
                    console.error('CrossParty pause error:', error);
                  }
                }}
              >
                <Ionicons name="pause" size={20} color="#fff" />
                <Text style={styles.controlText}>Pause</Text>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseRoom}>
              <Ionicons name={isHost ? "close-circle" : "exit"} size={20} color="#ff3b30" />
              <Text style={styles.closeButtonText}>
                {isHost ? 'Close room' : 'Leave'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  return (
    <Animated.View style={[styles.container, { opacity: animatedValue }]}>
      <CompactBadge />
      <ExpandedView />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  compactBadge: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  phoneBadge: {
    paddingLeft: 50,
    top: 50,
    right: 50,
    minWidth: 80,
  },
  tabletBadge: {
    paddingLeft: 50,
    right: 50,
    minWidth: 80,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  compactText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  guestCount: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  expandedContent: {
    padding: 20,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerInfo: {
    gap: 2,
  },
  expandedTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  expandedCode: {
    color: '#1f4cff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  noGuests: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  guestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  guestName: {
    color: '#aaa',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackSection: {
    marginBottom: 20,
  },
  qrSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
  },
  qrHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
  },
  trackInfo: {
    backgroundColor: 'rgba(31,76,255,0.1)',
    borderRadius: 8,
    padding: 12,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackArtist: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  controlsSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,76,255,0.2)',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  controlText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.2)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  closeButtonText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
});