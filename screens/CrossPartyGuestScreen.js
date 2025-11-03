import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';
import crossPartyService from '../src/services/crossPartyService';

export default function CrossPartyGuestScreen({ navigation, route }) {
  const { roomId, roomCode } = route.params;
  const [roomData, setRoomData] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const { isTablet } = useDeviceType();

  useEffect(() => {
    // Écouter les changements du salon
    const listener = crossPartyService.listenToRoom(roomId, (data) => {
      if (data && data.isActive) {
        setRoomData(data);
      } else {
        // Le salon a été fermé ou n'existe plus
        Alert.alert('Room closed', 'The host closed the room', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    });

    return () => {
      crossPartyService.stopListeningToRoom(roomId);
    };
  }, [roomId]);

  const handleLeaveRoom = () => {
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
              const result = await crossPartyService.leaveRoom(roomId, guestId);
              if (result.success) {
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error);
              }
            } else {
              navigation.goBack();
            }
          }
        }
      ]
    );
  };

  const guestCount = roomData?.guests ? Object.keys(roomData.guests).length : 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>CrossParty</Text>
          
          <TouchableOpacity 
            style={styles.leaveButton}
            onPress={handleLeaveRoom}
          >
            <Ionicons name="exit" size={24} color="#ff3b30" />
          </TouchableOpacity>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusIcon}>
            <Ionicons name="people" size={48} color="#22c55e" />
          </View>
          <Text style={styles.statusTitle}>Connected to room</Text>
          <Text style={styles.statusSubtitle}>Code: {roomCode}</Text>
          <Text style={styles.guestCount}>
            {guestCount} {guestCount === 1 ? 'guest connected' : 'guests connected'}
          </Text>
        </View>

        {roomData?.currentTrack && (
          <View style={styles.nowPlaying}>
            <Text style={styles.nowPlayingLabel}>Now playing</Text>
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle}>{roomData.currentTrack.title}</Text>
              <Text style={styles.trackArtist}>{roomData.currentTrack.artist}</Text>
            </View>
            <View style={styles.playbackControls}>
              <View style={styles.playbackStatus}>
                <Ionicons 
                  name={roomData.playbackState?.isPlaying ? "play" : "pause"} 
                  size={16} 
                  color="#1f4cff" 
                />
                <Text style={styles.playbackText}>
                  {roomData.playbackState?.isPlaying ? 'Playing' : 'Paused'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!roomData?.currentTrack && (
          <View style={styles.noMusic}>
            <Ionicons name="musical-notes-outline" size={64} color="#666" />
            <Text style={styles.noMusicText}>No music playing</Text>
            <Text style={styles.noMusicSubtext}>
              The host will start playback soon
            </Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={20} color="#1f4cff" />
            <Text style={styles.infoText}>
              You are connected as a guest
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="sync" size={20} color="#1f4cff" />
            <Text style={styles.infoText}>
              Music is synchronized with the host
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="people" size={20} color="#1f4cff" />
            <Text style={styles.infoText}>
              Enjoy the shared experience!
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.queueButton}>
          <Ionicons name="list" size={20} color="#fff" />
          <Text style={styles.queueButtonText}>View queue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  leaveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  statusSubtitle: {
    fontSize: 16,
    color: '#1f4cff',
    marginBottom: 10,
  },
  guestCount: {
    fontSize: 14,
    color: '#aaa',
  },
  nowPlaying: {
    backgroundColor: 'rgba(31,76,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.3)',
  },
  nowPlayingLabel: {
    fontSize: 14,
    color: '#1f4cff',
    fontWeight: '600',
    marginBottom: 10,
  },
  trackInfo: {
    marginBottom: 15,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 16,
    color: '#aaa',
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playbackStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playbackText: {
    color: '#1f4cff',
    fontWeight: '600',
    marginLeft: 6,
  },
  noMusic: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noMusicText: {
    fontSize: 20,
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  noMusicSubtext: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  infoSection: {
    marginTop: 30,
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoText: {
    color: '#aaa',
    marginLeft: 12,
    fontSize: 16,
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,76,255,0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.3)',
  },
  queueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});