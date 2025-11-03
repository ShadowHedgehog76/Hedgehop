import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useDeviceType } from '../src/hooks/useDeviceType';
import crossPartyService from '../src/services/crossPartyService';
import { useCrossParty } from '../src/contexts/CrossPartyContext';

export default function CrossPartyScreen({ navigation }) {
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const { isTablet } = useDeviceType();
  const { joinRoom } = useCrossParty();

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const result = await crossPartyService.createRoom();
      if (result.success) {
        // Utiliser le contexte au lieu de naviguer vers un écran
        joinRoom(result.roomId, result.roomCode, true);
        navigation.goBack(); // Retourner à l'écran précédent
        Alert.alert('Salon créé', `Votre salon est prêt ! Code: ${result.roomCode}`);
      } else {
        Alert.alert('Erreur', result.error);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le salon');
    }
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code de salon');
      return;
    }

    setLoading(true);
    try {
      const result = await crossPartyService.joinRoom(roomCode.trim().toUpperCase());
      if (result.success) {
        // Utiliser le contexte au lieu de naviguer vers un écran
        joinRoom(result.roomId, roomCode.trim().toUpperCase(), false, result.guestId);
        navigation.goBack(); // Retourner à l'écran précédent
        Alert.alert('Salon rejoint', `Vous avez rejoint le salon ${roomCode.trim().toUpperCase()}`);
      } else {
        Alert.alert('Erreur', result.error);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de rejoindre le salon');
    }
    setLoading(false);
  };

  const handleAskPermissionAndScan = async () => {
    try {
      if (!permission || !permission.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra pour scanner un QR code.');
          return;
        }
      }
      setScanning(true);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'accéder à la caméra');
    }
  };

  const onBarCodeScanned = async ({ data }) => {
    if (scanLocked) return;
    setScanLocked(true);
    try {
      const code = String(data || '').trim().toUpperCase();
      const isValid = /^[A-Z0-9]{6}$/.test(code);
      if (!isValid) {
        Alert.alert('QR invalide', 'Le QR code ne contient pas un code de salon valide.');
        setScanLocked(false);
        return;
      }
      setScanning(false);
      setRoomCode(code);
      // Enchaîner la connexion
      setLoading(true);
      const result = await crossPartyService.joinRoom(code);
      if (result.success) {
        joinRoom(result.roomId, code, false, result.guestId);
        navigation.goBack();
        Alert.alert('Salon rejoint', `Vous avez rejoint le salon ${code}`);
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de rejoindre le salon');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Échec du scan');
    } finally {
      setLoading(false);
      setTimeout(() => setScanLocked(false), 800); // petite tempo pour éviter les doubles scans
    }
  };

  if (showJoinRoom) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.content}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setShowJoinRoom(false);
              setRoomCode('');
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="enter" size={60} color="#1f4cff" />
            </View>
            
            <Text style={styles.title}>Rejoindre un salon</Text>
            <Text style={styles.subtitle}>
              Entrez le code à 6 caractères affiché sur l'appareil hôte
            </Text>

            <TextInput
              style={styles.codeInput}
              placeholder="CODE"
              placeholderTextColor="#666"
              value={roomCode}
              onChangeText={setRoomCode}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlign="center"
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.joinButton, loading && styles.disabledButton]}
              onPress={handleJoinRoom}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="enter" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Rejoindre</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scanButton, loading && styles.disabledButton]}
              onPress={handleAskPermissionAndScan}
              disabled={loading}
            >
              <Ionicons name="qr-code" size={20} color="#1f4cff" />
              <Text style={styles.scanButtonText}>Scanner le QR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {scanning && (
          <View style={styles.scannerOverlay}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={({ data }) => onBarCodeScanned({ data })}
            />
            <View style={styles.scannerTopBar}>
              <TouchableOpacity style={styles.scannerClose} onPress={() => setScanning(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.scannerTitle}>Scannez le QR du salon</Text>
            </View>
            <View style={styles.scanGuide} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.centerContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={80} color="#1f4cff" />
          </View>
          
          <Text style={styles.title}>CrossParty</Text>
          <Text style={styles.subtitle}>
            Partagez votre musique en temps réel avec vos amis
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.optionButton, loading && styles.disabledButton]}
              onPress={handleCreateRoom}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Créer un salon</Text>
                  <Text style={styles.buttonSubtext}>Vous serez l'hôte</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => setShowJoinRoom(true)}
              disabled={loading}
            >
              <Ionicons name="enter" size={24} color="#fff" />
              <Text style={styles.buttonText}>Rejoindre un salon</Text>
              <Text style={styles.buttonSubtext}>Avec un code</Text>
            </TouchableOpacity>
          </View>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(31,76,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: 'rgba(31,76,255,0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  optionsContainer: {
    width: '100%',
    gap: 20,
  },
  optionButton: {
    backgroundColor: 'rgba(31,76,255,0.15)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.3)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  buttonSubtext: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  codeInput: {
    width: '80%',
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(31,76,255,0.3)',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 30,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f4cff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(31,76,255,0.4)',
    backgroundColor: 'rgba(31,76,255,0.08)'
  },
  scanButtonText: {
    color: '#1f4cff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)'
  },
  scannerTopBar: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scannerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanGuide: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    bottom: '25%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
  },
});