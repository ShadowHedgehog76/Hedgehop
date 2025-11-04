// PartyRoomScreen.js - Écran de la room active avec participants et synchronisation
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import crossPartyService from '../src/services/crossPartyService';

export default function PartyRoomScreen({ route, navigation }) {
  const { roomId } = route.params;
  const [roomData, setRoomData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  useEffect(() => {
    // Récupérer les informations de la room actuelle
    const roomInfo = crossPartyService.getCurrentRoomInfo();
    setIsHost(roomInfo.isHost);
    const currentUserId = roomInfo.userId;

    // S'abonner aux changements de la room
    const unsubscribeRoom = crossPartyService.subscribeToRoom(roomId, (result) => {
      if (!result.exists) {
        // La room n'existe plus (l'hôte est parti)
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
      setLoading(false);
    });

    // S'abonner aux participants
    const unsubscribeParticipants = crossPartyService.subscribeToParticipants(roomId, (parts) => {
      // Vérifier si l'utilisateur actuel est toujours dans la liste des participants
      const stillInRoom = parts.some(p => p.userId === currentUserId);
      if (!stillInRoom && !loading) {
        // L'utilisateur a été kické
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
    });

    // Nettoyage à la déconnexion
    return () => {
      if (typeof unsubscribeRoom === 'function') unsubscribeRoom();
      if (typeof unsubscribeParticipants === 'function') unsubscribeParticipants();
    };
  }, [roomId, navigation, loading]);

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
          <TouchableOpacity
            style={styles.kickButton}
            onPress={() => handleKickParticipant(item)}
          >
            <Ionicons name="close-circle" size={24} color="#ff4444" />
          </TouchableOpacity>
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
      {/* Header */}
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
        <View style={styles.backButton} />
      </View>

      {/* Participants Count + QR Code */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="people" size={32} color="#1f4cff" />
          <Text style={styles.statNumber}>{participants.length}</Text>
          <Text style={styles.statLabel}>Participants</Text>
          {roomData?.roomCode && (
            <TouchableOpacity style={styles.qrFloatingBox} onPress={() => setQrModalVisible(true)}>
              <QRCode
                value={roomData.roomCode}
                size={60}
                backgroundColor="transparent"
                color="#fff"
              />
              <Text style={styles.qrFloatingText}>Scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modal QRCode agrandi */}
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
            <Text style={styles.qrModalText}>Appuyez pour fermer</Text>
          </View>
        </Pressable>
      </Modal>

      {/* Participants List */}
      <View style={styles.participantsContainer}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="people-outline" size={20} color="#fff" /> Participants
        </Text>
        <FlatList
          data={participants}
          renderItem={renderParticipant}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.participantsList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Current Track Info (placeholder for future integration) */}
      <View style={styles.trackContainer}>
        <Text style={styles.trackTitle}>
          <Ionicons name="musical-notes" size={20} color="#1f4cff" /> Now Playing
        </Text>
        {roomData?.currentTrack ? (
          <View style={styles.trackInfo}>
            <Text style={styles.trackName}>{roomData.currentTrack.title}</Text>
            <Text style={styles.trackArtist}>{roomData.currentTrack.artist}</Text>
          </View>
        ) : (
          <Text style={styles.noTrack}>No track playing</Text>
        )}
      </View>

      {/* Host Controls */}
      {isHost && (
        <View style={styles.hostControls}>
          <Text style={styles.hostControlsTitle}>Host Controls</Text>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => Alert.alert('Info', 'Music sync coming soon!')}
          >
            <Ionicons name="play-circle" size={24} color="#fff" />
            <Text style={styles.controlButtonText}>Sync Music</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Leave Button */}
      <TouchableOpacity
        style={styles.leaveButton}
        onPress={handleLeaveRoom}
      >
        <Ionicons name="exit-outline" size={24} color="#ff4444" />
        <Text style={styles.leaveButtonText}>
          {isHost ? 'Close Room' : 'Leave Room'}
        </Text>
      </TouchableOpacity>
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
  headerCenter: {
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
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: 'rgba(31, 76, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31, 76, 255, 0.3)',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  qrFloatingBox: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: 12,
    padding: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  qrFloatingText: {
    color: '#1f4cff',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: 1,
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
  kickButton: {
    padding: 5,
  },
  trackContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(31, 76, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(31, 76, 255, 0.2)',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  trackInfo: {
    paddingLeft: 5,
  },
  trackName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  trackArtist: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  noTrack: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    paddingLeft: 5,
  },
  hostControls: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)',
  },
  hostControlsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: 10,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f4cff',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    gap: 8,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 15,
    margin: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    gap: 8,
  },
  leaveButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
