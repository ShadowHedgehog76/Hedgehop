import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceType } from '../src/hooks/useDeviceType';
import crossPartyService from '../src/services/crossPartyService';

export default function CrossPartyHostScreen({ navigation, route }) {
  const { roomId, roomCode } = route.params;
  const [roomData, setRoomData] = useState(null);
  const [guests, setGuests] = useState([]);
  const { isTablet } = useDeviceType();

  useEffect(() => {
    // Écouter les changements du salon
    const listener = crossPartyService.listenToRoom(roomId, (data) => {
      if (data) {
        setRoomData(data);
        setGuests(data.guests ? Object.values(data.guests) : []);
      } else {
        // Le salon a été supprimé
        Alert.alert('Salon fermé', 'Le salon a été fermé', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    });

    return () => {
      crossPartyService.stopListeningToRoom(roomId);
    };
  }, [roomId]);

  const handleCloseRoom = () => {
    Alert.alert(
      'Fermer le salon',
      'Êtes-vous sûr de vouloir fermer ce salon ? Tous les invités seront déconnectés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Fermer',
          style: 'destructive',
          onPress: async () => {
            const result = await crossPartyService.closeRoom(roomId, roomCode);
            if (result.success) {
              navigation.goBack();
            } else {
              Alert.alert('Erreur', result.error);
            }
          }
        }
      ]
    );
  };

  const renderGuest = ({ item }) => (
    <View style={styles.guestItem}>
      <View style={styles.guestAvatar}>
        <Ionicons name="person" size={20} color="#fff" />
      </View>
      <View style={styles.guestInfo}>
        <Text style={styles.guestName}>{item.id}</Text>
        <Text style={styles.guestStatus}>
          Connecté depuis {new Date(item.joinedAt).toLocaleTimeString()}
        </Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: item.isConnected ? '#22c55e' : '#f97316' }]} />
    </View>
  );

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
          
          <Text style={styles.headerTitle}>Salon CrossParty</Text>
          
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleCloseRoom}
          >
            <Ionicons name="close" size={24} color="#ff3b30" />
          </TouchableOpacity>
        </View>

        <View style={styles.roomCodeContainer}>
          <Text style={styles.roomCodeLabel}>Code du salon</Text>
          <View style={styles.roomCodeBox}>
            <Text style={styles.roomCodeText}>{roomCode}</Text>
          </View>
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              <QRCode value={roomCode} size={isTablet ? 220 : 180} backgroundColor="#fff" color="#000" />
            </View>
            <Text style={styles.qrHint}>Scannez ce QR code pour rejoindre rapidement</Text>
          </View>
          <Text style={styles.roomCodeSubtext}>
            Partagez ce code avec vos amis pour qu'ils puissent rejoindre
          </Text>
        </View>

        <View style={styles.guestsSection}>
          <Text style={styles.sectionTitle}>
            Invités connectés ({guests.length})
          </Text>
          
          {guests.length === 0 ? (
            <View style={styles.noGuests}>
              <Ionicons name="people-outline" size={48} color="#666" />
              <Text style={styles.noGuestsText}>
                En attente d'invités...
              </Text>
              <Text style={styles.noGuestsSubtext}>
                Les invités qui rejoignent avec le code apparaîtront ici
              </Text>
            </View>
          ) : (
            <FlatList
              data={guests}
              renderItem={renderGuest}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={styles.controlText}>Lecture</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="pause" size={24} color="#fff" />
            <Text style={styles.controlText}>Pause</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={24} color="#fff" />
            <Text style={styles.controlText}>Suivant</Text>
          </TouchableOpacity>
        </View>
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCodeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  roomCodeLabel: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 10,
  },
  roomCodeBox: {
    backgroundColor: 'rgba(31,76,255,0.15)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(31,76,255,0.3)',
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginBottom: 10,
  },
  roomCodeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f4cff',
    letterSpacing: 8,
  },
  roomCodeSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
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
  guestsSection: {
    flex: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  noGuests: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noGuestsText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  noGuestsSubtext: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  guestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  guestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f4cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  guestStatus: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,76,255,0.15)',
    borderRadius: 12,
    padding: 16,
    minWidth: 80,
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.3)',
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});