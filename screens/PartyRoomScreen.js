// PartyRoomScreen.js - Active party room with participants and music synchronization
import React, { useState, useEffect } from 'react';
import { Modal, Pressable } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import crossPartyService from '../src/services/crossPartyService';
import { useDeviceType } from '../src/hooks/useDeviceType';
import { useAutoPlayQueue } from '../src/hooks/useAutoPlayQueue';
import { playTrack } from '../src/api/player';

export default function PartyRoomScreen({ route, navigation }) {
  const { roomId } = route.params;
  const [roomData, setRoomData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [queue, setQueue] = useState([]);
  const [showQueue, setShowQueue] = useState(false);
  const { isTablet } = useDeviceType();

  useEffect(() => {
    // Get current room info
    const roomInfo = crossPartyService.getCurrentRoomInfo();
    const currentUserId = roomInfo.userId;

    // Subscribe to room changes
    const unsubscribeRoom = crossPartyService.subscribeToRoom(roomId, (result) => {
      if (!result.exists) {
        // Room no longer exists (host left)
        crossPartyService.removeAllListeners();
        crossPartyService.currentRoomId = null;
        crossPartyService.currentUserId = null;
        crossPartyService.isHost = false;
        navigation.reset({
          index: 0,
          routes: [{ name: 'CrossParty' }],
        });
        return;
      }
      setRoomData(result.data);
      
      // Mettre à jour isHost si le host a changé
      if (result.data.hostId) {
        const newIsHost = result.data.hostId === currentUserId;
        setIsHost(newIsHost);
        crossPartyService.isHost = newIsHost;
        
        // Émettre l'événement pour que BackgroundSyncProvider se mette à jour
        crossPartyService.emitter.emit('hostStatusChanged', { 
          isHost: newIsHost, 
          roomId 
        });
      }
      
      setLoading(false);
    });

    // Subscribe to participants
    const unsubscribeParticipants = crossPartyService.subscribeToParticipants(roomId, (parts) => {
      // Check if current user is still in the room
      const stillInRoom = parts.some(p => p.userId === currentUserId);
      if (!stillInRoom && !loading) {
        // User was kicked
        crossPartyService.removeAllListeners();
        crossPartyService.currentRoomId = null;
        crossPartyService.currentUserId = null;
        crossPartyService.isHost = false;
        navigation.reset({
          index: 0,
          routes: [{ name: 'CrossParty' }],
        });
        return;
      }
      setParticipants(parts);
      
      // Mettre à jour isHost en fonction des données participants
      const currentUser = parts.find(p => p.userId === currentUserId);
      if (currentUser) {
        setIsHost(currentUser.isHost || false);
        crossPartyService.isHost = currentUser.isHost || false;
        
        // Émettre l'événement pour que BackgroundSyncProvider se mette à jour
        crossPartyService.emitter.emit('hostStatusChanged', { 
          isHost: currentUser.isHost || false, 
          roomId 
        });
      }
    });

    // Subscribe to queue
    const unsubscribeQueue = crossPartyService.subscribeToQueue(roomId, (queueItems) => {
      setQueue(queueItems);
    });

    // Cleanup on disconnect
    return () => {
      if (typeof unsubscribeRoom === 'function') unsubscribeRoom();
      if (typeof unsubscribeParticipants === 'function') unsubscribeParticipants();
      if (typeof unsubscribeQueue === 'function') unsubscribeQueue();
    };
  }, [roomId, navigation, loading]);

  // Hook pour la lecture automatique de la queue
  useAutoPlayQueue(roomId, isHost, queue);

  const handleLeaveRoom = async () => {
    const result = await crossPartyService.leaveRoom();
    navigation.reset({
      index: 0,
      routes: [{ name: 'CrossParty' }],
    });
  };

  const handleKickParticipant = async (participant) => {
    await crossPartyService.kickParticipant(participant.userId);
  };

  const handleRemoveFromQueue = async (queueId, trackTitle) => {
    const result = await crossPartyService.removeFromQueue(queueId);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to remove from queue');
    }
  };

  const handleTransferHost = async (participant) => {
    const result = await crossPartyService.transferHost(participant.userId);
    if (result.success) {
      setIsHost(false);
    } else {
      Alert.alert('Error', result.error || 'Failed to transfer host');
    }
  };

  const handleSyncMusic = async () => {
    setSyncStatus('Syncing...');
    const result = await hostSync.forceSyncNow();
    if (result && typeof result.then === 'function') {
      await result;
    }
    
    if (result?.success !== false) {
      setSyncStatus('✓ Synced!');
      setTimeout(() => setSyncStatus(''), 2000);
    } else {
      Alert.alert('Error', 'Failed to sync music');
      setSyncStatus('');
    }
  };

  // Rendu de la queue
  const renderQueueItem = ({ item }) => (
    <View style={styles.queueItem}>
      {item.image && (
        <Image 
          source={{ uri: item.image }} 
          style={styles.queueItemImage}
        />
      )}
      <View style={styles.queueItemInfo}>
        <Text style={styles.queueItemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.queueItemArtist} numberOfLines={1}>
          {item.artist}
        </Text>
        {item.album && (
          <Text style={styles.queueItemAlbum} numberOfLines={1}>
            {item.album}
          </Text>
        )}
        <Text style={styles.queueItemAddedBy}>
          Added by: {item.addedBy?.username || 'Unknown'}
        </Text>
      </View>
      {isHost && (
        <View style={styles.queueItemActions}>
          <TouchableOpacity
            onPress={() => {
              // Convertir l'item de queue en format playTrack (uri -> url)
              const trackForPlay = {
                ...item,
                url: item.uri, // playTrack attend 'url' pas 'uri'
              };
              playTrack(trackForPlay);
              handleRemoveFromQueue(item.queueId, item.title);
            }}
            style={styles.queuePlayButton}
          >
            <Ionicons name="play-circle" size={20} color="#1f4cff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRemoveFromQueue(item.queueId, item.title)}
            style={styles.queueRemoveButton}
          >
            <Ionicons name="trash-outline" size={18} color="#ff4444" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderParticipant = ({ item }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantLeft}>
        <View style={[styles.avatar, item.isHost && styles.avatarHost]}>
          <Ionicons name="person" size={24} color="#fff" />
        </View>
        <View>
          <Text style={styles.participantName}>{item.username}</Text>
          {item.isHost && <Text style={styles.hostBadge}>HOST</Text>}
        </View>
      </View>
      <View style={styles.participantRight}>
        {item.isHost && (
          <Ionicons name="star" size={24} color="#ffd700" />
        )}
        {isHost && !item.isHost && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.transferButton}
              onPress={() => handleTransferHost(item)}
            >
              <Ionicons name="shield" size={24} color="#ffd700" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.kickButton}
              onPress={() => handleKickParticipant(item)}
            >
              <Ionicons name="close-circle" size={24} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={['#0a0a0a', '#1a1a2e', '#16213e']}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1f4cff" />
          <Text style={styles.loadingText}>Loading room...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0a0a0a', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      {/* Header with Back Button + Close/Leave Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'YouMain' }] })}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Party Room</Text>
          {roomData && (
            <Text style={styles.roomCode}>Code: {roomData.roomCode}</Text>
          )}
        </View>
        {/* Leave/Close Button - Top Right */}
        <TouchableOpacity
          style={styles.leaveButtonHeader}
          onPress={handleLeaveRoom}
        >
          <Ionicons name="exit-outline" size={28} color="#ff4444" />
        </TouchableOpacity>
      </View>

      {/* Stats Container with Participants Count, Current Track, and Sync Button */}
      <View style={styles.statsContainer}>
        <View style={styles.statBoxContent}>
          {/* Top Left: Current Track Info */}
          {roomData?.currentTrack && (
            <View style={styles.trackInfoBox}>
              <Text style={styles.trackInfoTitle}>Now Playing</Text>
              <Text style={styles.trackInfoName} numberOfLines={1}>{roomData.currentTrack.title}</Text>
              <Text style={styles.trackInfoArtist} numberOfLines={1}>{roomData.currentTrack.album}</Text>
            </View>
          )}
          
          {/* Center: Participants Count + QR Code */}
          <View style={styles.statBox}>
            <View style={styles.statContent}>
              <Ionicons name="people" size={24} color="#1f4cff" />
              <Text style={styles.statNumber}>{participants.length}</Text>
            </View>
            {roomData?.roomCode && (
              <TouchableOpacity style={styles.qrFloatingBox} onPress={() => setQrModalVisible(true)}>
                <QRCode
                  value={roomData.roomCode}
                  size={35}
                  backgroundColor="transparent"
                  color="#fff"
                />
                <Text style={styles.qrFloatingText}>Scan</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Bottom Left: Queue/Participants Toggle (Visible to everyone on phone) */}
          {!isTablet && (
            <TouchableOpacity
              style={styles.syncButtonInside}
              onPress={() => setShowQueue(!showQueue)}
            >
              <Ionicons 
                name={showQueue ? "list" : "add-circle"} 
                size={18} 
                color="#fff" 
              />
              <Text style={styles.syncButtonText}>
                {showQueue ? 'Participants' : 'Queue'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modal QRCode */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <Pressable style={styles.qrModalOverlay} onPress={() => setQrModalVisible(false)}>
          <View style={styles.qrModalContent}>
            {roomData?.roomCode && (
              <QRCode
                value={roomData.roomCode}
                size={260}
                backgroundColor="transparent"
                color="#fff"
              />
            )}
            <Text style={styles.qrModalText}>Tap to close</Text>
          </View>
        </Pressable>
      </Modal>

      {/* VIEW ACCORDING TO DEVICE TYPE AND PERMISSIONS */}
      {isTablet ? (
        // TABLETTE: Vue split avec participants à gauche et queue à droite (host seulement)
        <View style={styles.tableContainer}>
          {/* Participants List - Left Side */}
          <View style={styles.participantsContainerTablet}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="people-outline" size={20} color="#fff" /> Participants ({participants.length})
            </Text>
            <FlatList
              data={participants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item.userId}
              contentContainerStyle={styles.participantsList}
              scrollEnabled={true}
            />
          </View>

          {/* Queue List - Right Side (Visible to everyone) */}
          <View style={styles.queueContainerTablet}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="add-circle" size={20} color="#ffb700" /> Queue ({queue.length})
            </Text>
            {queue.length > 0 ? (
              <FlatList
                data={queue}
                renderItem={renderQueueItem}
                keyExtractor={(item) => item.queueId}
                scrollEnabled={true}
              />
            ) : (
              <View style={styles.emptyQueueContainer}>
                <Ionicons name="add-circle" size={40} color="#666" />
                <Text style={styles.emptyQueueText}>Queue is empty</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        // TÉLÉPHONE: Vue unique avec bouton pour basculer queue/participants (tous les utilisateurs)
        <View style={styles.phoneContainer}>
          {/* Display Queue or Participants based on toggle */}
          {showQueue ? (
            <View style={styles.participantsContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="add-circle" size={20} color="#ffb700" /> Queue ({queue.length})
              </Text>
              <FlatList
                data={queue}
                renderItem={renderQueueItem}
                keyExtractor={(item) => item.queueId}
                contentContainerStyle={styles.participantsList}
                scrollEnabled={false}
              />
            </View>
          ) : (
            <View style={styles.participantsContainer}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="people-outline" size={20} color="#fff" /> Participants ({participants.length})
              </Text>
              <FlatList
                data={participants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item.userId}
                contentContainerStyle={styles.participantsList}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalContent: {
    backgroundColor: 'rgba(20,20,40,0.98)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  qrModalText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalContent: {
    backgroundColor: 'rgba(20,20,40,0.98)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  qrModalText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButtonHeader: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  roomCode: {
    fontSize: 14,
    color: '#1f4cff',
    marginTop: 2,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  statBoxContent: {
    backgroundColor: 'rgba(31, 76, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(31, 76, 255, 0.3)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  trackInfoBox: {
    flex: 0.4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(31, 76, 255, 0.2)',
  },
  trackInfoTitle: {
    fontSize: 10,
    color: '#999',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  trackInfoName: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 1,
  },
  trackInfoArtist: {
    fontSize: 10,
    color: '#1f4cff',
  },
  statBox: {
    flex: 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'relative',
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // OFFSET ADJUSTMENTS (CSS ONLY - Easy to modify)
    marginLeft: -60,      // Move icon + number left/right
    marginTop: 10,       // Move icon + number up/down
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    // OFFSET ADJUSTMENTS (CSS ONLY - Easy to modify)
    marginLeft: 0,      // Move number left/right relative to icon
    marginTop: 0,       // Move number up/down
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  syncButtonInside: {
    flex: 0.25,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f4cff',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  qrFloatingBox: {
    position: 'absolute',
    right: 4,
    top: 2,
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: 6,
    padding: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  qrFloatingText: {
    color: '#1f4cff',
    fontSize: 7,
    fontWeight: 'bold',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  participantsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  participantsList: {
    paddingBottom: 10,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1f4cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHost: {
    backgroundColor: '#ffd700',
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  hostBadge: {
    fontSize: 11,
    color: '#ffd700',
    fontWeight: 'bold',
    marginTop: 2,
  },
  participantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transferButton: {
    padding: 5,
  },
  kickButton: {
    padding: 5,
  },
  queueContainer: {
    backgroundColor: 'rgba(255, 183, 0, 0.08)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 15,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 183, 0, 0.2)',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 5,
    gap: 10,
  },
  queueItemImage: {
    width: 40,
    height: 40,
    borderRadius: 5,
    backgroundColor: '#1a1a2e',
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  queueItemArtist: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  queueItemAddedBy: {
    color: '#888',
    fontSize: 10,
    marginTop: 3,
    fontStyle: 'italic',
  },
  queueItemAlbum: {
    color: '#999',
    fontSize: 9,
    marginTop: 2,
  },
  queueItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queuePlayButton: {
    padding: 5,
  },
  queueRemoveButton: {
    padding: 5,
  },
  // Styles for split view (Tablet)
  tableContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 0,
  },
  participantsContainerTablet: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 40, 0.5)',
    borderRightWidth: 1,
    borderRightColor: '#333',
    padding: 15,
  },
  queueContainerTablet: {
    flex: 1,
    backgroundColor: 'rgba(255, 183, 0, 0.05)',
    padding: 15,
  },
  // Styles for phone toggle view
  phoneContainer: {
    flex: 1,
  },
  toggleQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(31, 76, 255, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: '#1f4cff',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  toggleQueueButtonText: {
    color: '#1f4cff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyQueueContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyQueueText: {
    color: '#888',
    fontSize: 14,
  },
});
