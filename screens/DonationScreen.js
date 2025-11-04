import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const DONATION_URL = 'https://buymeacoffee.com/devlumine';

export default function DonationScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  const openInBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(DONATION_URL);
      if (!supported) throw new Error('Cannot open URL');
      await Linking.openURL(DONATION_URL);
    } catch (e) {
      Alert.alert('Error', 'Unable to open your browser.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Support the project</Text>
        <TouchableOpacity style={styles.externalButton} onPress={openInBrowser}>
          <Ionicons name="open-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1f4cff" />
          </View>
        )}
        <WebView
          source={{ uri: DONATION_URL }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
          style={{ backgroundColor: '#000' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  externalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000'
  },
});
