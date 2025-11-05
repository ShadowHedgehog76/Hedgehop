// CrossPartyScreen.js - Écran pour créer ou rejoindre une room CrossParty
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import crossPartyService from '../src/services/crossPartyService';
import authService from '../src/services/auth';
import { useAlert } from '../src/components/CustomAlert';

export default function CrossPartyScreen({ navigation }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà dans une room
    const roomInfo = crossPartyService.getCurrentRoomInfo();
    if (roomInfo.roomId) {
      // Rediriger directement vers la room active
      navigation.replace('PartyRoom', { roomId: roomInfo.roomId });
      return;
    }

    // Vérifier l'authentification
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);

    // Récupérer l'utilisateur actuel
    const unsubscribe = authService.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, [navigation]);

  const handleCreateRoom = async () => {
    if (!user) {
      showAlert({ title: 'Error', message: 'You must be logged in to create a room', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const userId = user.uid;
      const username = user.displayName || user.email || 'Anonymous';
      
      const result = await crossPartyService.createRoom(userId, username);

      if (result.success) {
        setGeneratedCode(result.roomCode);
        setShowCodeModal(true);
        
        // Naviguer vers la room après 2 secondes
        setTimeout(() => {
          setShowCodeModal(false);
          navigation.navigate('PartyRoom', { roomId: result.roomId });
        }, 2000);
      } else {
        showAlert({ title: 'Error', message: result.error || 'Failed to create room', type: 'error' });
      }
    } catch (error) {
      showAlert({ title: 'Error', message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      showAlert({ title: 'Error', message: 'Please enter a room code', type: 'error' });
      return;
    }

    if (!user) {
      showAlert({ title: 'Error', message: 'You must be logged in to join a room', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const userId = user.uid;
      const username = user.displayName || user.email || 'Anonymous';
      
      const result = await crossPartyService.joinRoom(roomCode.toUpperCase(), userId, username);

      if (result.success) {
        navigation.navigate('PartyRoom', { roomId: result.roomId });
      } else {
        showAlert({ title: 'Error', message: result.error || 'Failed to join room', type: 'error' });
      }
    } catch (error) {
      showAlert({ title: 'Error', message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my Hedgehop party with code: ${generatedCode}`,
        title: 'Hedgehop Party Code',
      });
    } catch (error) {
      console.error('Error sharing code:', error);
    }
  };

  const handleAskPermissionAndScan = async () => {
    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setScanning(true);
  };

  const onBarCodeScanned = ({ data }) => {
    setScanning(false);
    if (data) setRoomCode(data);
  };

  return (
    <LinearGradient
      colors={['#0a0a0a', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      {/* Volet de verrouillage si pas authentifié */}
      {!isAuthenticated && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={64} color="white" />
          <Text style={styles.lockTitle}>Sign in required</Text>
          <Text style={styles.lockSubtitle}>You must be logged in to use CrossParty</Text>
          <TouchableOpacity 
            style={styles.lockBackBtn} 
            onPress={() => navigation.navigate('YouMain')}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
            <Text style={styles.lockBackText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.header, !isAuthenticated && { opacity: 0.3 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('YouMain')}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CrossParty</Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.content, !isAuthenticated && { opacity: 0.3 }]}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={80} color="#1f4cff" />
        </View>

        <Text style={styles.title}>Listen Together</Text>
        <Text style={styles.subtitle}>
          Create a room or join friends with a code
        </Text>

        {/* Créer une room */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreateRoom}
          disabled={loading}
        >
          <LinearGradient
            colors={['#1f4cff', '#0a32cc']}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.buttonText}>Create a Room</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        {/* Rejoindre une room */}
        <View style={styles.joinContainer}>
          <Text style={styles.joinLabel}>Enter Room Code</Text>
          <TextInput
            style={styles.input}
            placeholder="XXXXXX"
            placeholderTextColor="#666"
            value={roomCode}
            onChangeText={setRoomCode}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.joinButton, loading && styles.buttonDisabled]}
            onPress={handleJoinRoom}
            disabled={loading || !roomCode.trim()}
          >
            <Text style={styles.joinButtonText}>Join Room</Text>
            <Ionicons name="arrow-forward" size={20} color="#1f4cff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.joinButton, { marginTop: 10, backgroundColor: '#1f4cff' }]}
            onPress={handleAskPermissionAndScan}
          >
            <Ionicons name="qr-code" size={20} color="#fff" />
            <Text style={[styles.joinButtonText, { color: '#fff' }]}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>
        {scanning && (
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#000C', zIndex: 10, justifyContent: 'center', alignItems: 'center' }}>
            <CameraView
              style={{ width: 300, height: 300, borderRadius: 16, overflow: 'hidden' }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onBarCodeScanned}
            />
            <TouchableOpacity onPress={() => setScanning(false)} style={{ marginTop: 20 }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 14, marginTop: 10 }}>Scan a room QR code</Text>
          </View>
        )}
      </View>

      {/* Modal de code généré */}
      <Modal
        visible={showCodeModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#00ff00" />
            </View>
            <Text style={styles.modalTitle}>Room Created!</Text>
            <Text style={styles.modalSubtitle}>Share this code with friends:</Text>
            
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{generatedCode}</Text>
            </View>

            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareCode}
            >
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share Code</Text>
            </TouchableOpacity>

            <Text style={styles.modalFooter}>Redirecting to room...</Text>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  createButton: {
    marginBottom: 30,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    marginHorizontal: 15,
    fontSize: 14,
    fontWeight: 'bold',
  },
  joinContainer: {
    backgroundColor: 'rgba(31, 76, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(31, 76, 255, 0.3)',
  },
  joinLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 3,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  joinButtonText: {
    color: '#1f4cff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: 8,
    padding: 15,
    marginTop: 30,
    gap: 10,
  },
  infoText: {
    color: '#ffa500',
    fontSize: 14,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    borderWidth: 1,
    borderColor: '#1f4cff',
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  codeContainer: {
    backgroundColor: 'rgba(31, 76, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#1f4cff',
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 5,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f4cff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 15,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
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
  lockBackBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  lockBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  modalFooter: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
  