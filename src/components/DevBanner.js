import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DevBanner() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { top: insets.top }]}>
      <View style={styles.bannerWrapper}>
        <LinearGradient
          colors={['#ef4444', '#dc2626', '#b91c1c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Text style={styles.text}>DEV</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 10,
    pointerEvents: 'none', // Permet de cliquer à travers
  },
  bannerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 300,
    height: 300,
    // Pas d'overflow: 'hidden' pour laisser déborder
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: -150,
    width: 400,
    height: 50,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});