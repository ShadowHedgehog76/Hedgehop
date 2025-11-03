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
  enableCrossParty, 
  disableCrossParty,
  processCrossPartyUpdate
} from '../api/player';

export default function CrossPartyBadgeNew({ 
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
  
  // ID unique pour cet utilisateur
  const [userId] = useState(() => `${isHost ? 'host' : 'guest'}_${Date.now()}_${Math.random()}`);

  useEffect(() => {
    if (!roomId) return;

    // Activer CrossParty dans le player
    console.log('🎵 CrossParty Badge: Activation pour', { roomId, userId, isHost });
    enableCrossParty(roomId, userId);

    // Écouter les changements du salon
    const listener = crossPartyService.listenToRoom(roomId, (data) => {
      if (data && data.isActive) {
        console.log('🌐 CrossParty Badge: Données reçues:', data);
        setRoomData(data);
        setGuests(data.guests ? Object.values(data.guests) : []);
        
        // Traiter les mises à jour CrossParty
        processCrossPartyUpdate(data);
        
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
      disableCrossParty();
    };
  }, [roomId, userId]);

  const handleRoomClosed = () => {
    Alert.alert(
      'Room closed', 
      isHost ? 'You closed the room' : 'The host closed the room',
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const closeRoom = async () => {
    try {
      await crossPartyService.closeRoom(roomId);
      onClose();
    } catch (error) {
  console.error('Room close error:', error);
    }
  };

  const leaveRoom = async () => {
    try {
      await crossPartyService.leaveRoom(roomId, guestId);
      onClose();
    } catch (error) {
  console.error('Leave room error:', error);
    }
  };

  const handleAction = () => {
    if (isHost) {
      Alert.alert(
        'Close room?',
        'All guests will be disconnected.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Close', style: 'destructive', onPress: closeRoom }
        ]
      );
    } else {
      Alert.alert(
        'Leave room?',
        'You will no longer listen together.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: leaveRoom }
        ]
      );
    }
  };

  if (!roomData) return null;

  // Interface compacte (badge)
  if (!isExpanded) {
    return (
      <Animated.View 
        style={[
          styles.badgePosition,
          { opacity: animatedValue }
        ]}
      >
        <TouchableOpacity 
          onPress={() => setIsExpanded(true)}
          style={styles.badgeButton}
        >
          <LinearGradient
            colors={['#1f4cff', '#7b61ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badgeGradient}
          >
            <Ionicons name="people" size={16} color="white" />
            <Text style={styles.badgeText}>{roomCode}</Text>
            <Text style={styles.guestCount}>{guests.length}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Interface étendue (modal)
  return (
    <Modal
      visible={isExpanded}
      transparent
      animationType="fade"
      onRequestClose={() => setIsExpanded(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>CrossParty - {roomCode}</Text>
            <TouchableOpacity 
              onPress={() => setIsExpanded(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.roleText}>
              {isHost ? '🏠 Host' : '👥 Guest'} • {guests.length} connected
            </Text>
          </View>

          {/* Host QR: quick share code */}
          {isHost && (
            <View style={styles.qrSection}>
              <View style={styles.qrWrapper}>
                <QRCode value={roomCode || ''} size={160} backgroundColor="#fff" color="#000" />
              </View>
              <Text style={styles.qrHint}>Scan to join this room</Text>
            </View>
          )}

          <View style={styles.currentTrackSection}>
            {roomData.currentTrack ? (
              <View>
                <Text style={styles.currentTrackTitle}>Now playing:</Text>
                <Text style={styles.trackName}>{roomData.currentTrack.title}</Text>
                <Text style={styles.trackArtist}>{roomData.currentTrack.album}</Text>
              </View>
            ) : (
              <Text style={styles.noTrackText}>No track playing</Text>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.actionButton, isHost ? styles.hostButton : styles.guestButton]}
            onPress={handleAction}
          >
            <Text style={styles.actionButtonText}>
              {isHost ? 'Close room' : 'Leave room'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Badge styles (unifiés)
  badgePosition: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1000,
  },
  badgeButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  guestCount: {
    color: 'white',
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  infoSection: {
    marginBottom: 20,
  },
  roleText: {
    color: '#888',
    fontSize: 14,
  },
  currentTrackSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
  },
  qrHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  currentTrackTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  trackName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  trackArtist: {
    color: '#888',
    fontSize: 14,
  },
  noTrackText: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  hostButton: {
    backgroundColor: '#ff4444',
  },
  guestButton: {
    backgroundColor: '#666',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});