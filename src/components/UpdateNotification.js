import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAlert } from './CustomAlert';

export const UpdateNotification = ({ updateInfo, onDismiss }) => {
  const [slideAnim] = useState(new Animated.Value(0));
  const { showAlert } = useAlert();

  useEffect(() => {
    if (updateInfo) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 7,
      }).start();
    }
  }, [updateInfo, slideAnim]);

  if (!updateInfo) return null;

  const handleDownload = async () => {
    try {
      await Linking.openURL(updateInfo.downloadUrl);
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Could not open GitHub page',
        type: 'error',
      });
    }
  };

  const handleDismiss = () => {
    showAlert({
      title: '⚠️ VERSION WARNING ⚠️',
      message: '🚨 CRITICAL UPDATE REQUIRED 🚨\n\n' +
               'Using an OLDER VERSION will cause:\n\n' +
               '❌ FAVORITES - Data Loss Risk\n' +
               '❌ STATISTICS - Corruption Issues\n' +
               '❌ PLAYLISTS - Sync Failures\n' +
               '❌ CROSS-MUSIC - Feature Breakdown\n\n' +
               '⚡ Your data might be PERMANENTLY LOST ⚡\n\n' +
               '🔴 UPDATE NOW to protect your data! 🔴',
      type: 'warning',
      buttons: [
        {
          text: '❌ Ignore (Not Recommended)',
          style: 'disabled',
          onPress: () => {
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              onDismiss();
            });
          },
        },
        {
          text: '✅ DOWNLOAD NOW!',
          onPress: handleDownload,
          style: 'primary',
        },
      ],
    });
  };

  const slideTranslate = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideTranslate }],
        },
      ]}
    >
      <LinearGradient
        colors={['#1f4cff', '#1a3aa3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download" size={24} color="#fff" />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>New Update Available!</Text>
            <Text style={styles.version}>
              V{updateInfo.currentVersion} → V{updateInfo.latestVersion}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              A new version of Hedgehop is available on GitHub.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownload}
          >
            <Ionicons name="download" size={16} color="#fff" />
            <Text style={styles.downloadText}>Download</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  gradient: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  version: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  downloadButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
