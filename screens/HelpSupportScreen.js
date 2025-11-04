import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { database } from '../src/config/firebaseConfig';
import { ref as dbRef, query as dbQuery, orderByChild, limitToLast, onValue } from 'firebase/database';

const DONATION_URL = 'https://buymeacoffee.com/nnuoa15xct'; // TODO: replace with your actual donation link
const SUPPORT_EMAIL = 'kaelig.camesella@gmail.com'; // TODO: replace or remove if not needed

export default function HelpSupportScreen({ navigation }) {
  const openDonation = async () => {
    // Open an in-app WebView screen to show the donation page
    navigation.navigate('Donation');
  };

  // Load recent supporters from Firebase (configure your backend or automation to write here)
  const [supporters, setSupporters] = useState([]);
  const [loadingSupporters, setLoadingSupporters] = useState(true);

  useEffect(() => {
    try {
      const q = dbQuery(
        dbRef(database, 'supporters'),
        orderByChild('createdAt'),
        limitToLast(10)
      );
      const unsub = onValue(q, (snap) => {
        const val = snap.val() || {};
        const arr = Object.entries(val).map(([id, s]) => ({ id, ...s }));
        arr.sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
        setSupporters(arr);
        setLoadingSupporters(false);
      }, () => setLoadingSupporters(false));
      return () => unsub();
    } catch {
      setLoadingSupporters(false);
    }
  }, []);

  // Helpers
  const currencySymbol = (c) => {
    const cc = (c || '').toUpperCase();
    if (cc === 'EUR' || cc === 'EURO' || cc === '€') return '€';
    if (cc === 'USD' || cc === 'US$' || cc === '$') return '$';
    if (cc === 'GBP' || cc === '£') return '£';
    if (cc === 'JPY' || cc === '¥') return '¥';
    return c || '';
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - ts) / 1000)); // seconds
    if (diff < 60) return 'just now';
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w} week${w > 1 ? 's' : ''} ago`;
    const date = new Date(ts);
    return date.toLocaleDateString();
  };

  const openEmail = async () => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Hedgehop Support')}`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) throw new Error('Cannot open email app');
      await Linking.openURL(mailto);
    } catch (e) {
      Alert.alert('Error', 'Unable to open your email app.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Help & support</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>Need help?</Text>
        <Text style={styles.paragraph}>
          If you have questions or feedback, feel free to contact us or support the project.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={openDonation}>
          <Ionicons name="heart" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryText}>Make a donation</Text>
        </TouchableOpacity>

        {/* Recent supporters */}
        <View style={styles.supportersHeader}>
          <Text style={styles.supportersTitle}>Recent supporters</Text>
        </View>
        {loadingSupporters ? (
          <View style={styles.supportersLoading}>
            <ActivityIndicator size="small" color="#1f4cff" />
          </View>
        ) : supporters.length === 0 ? (
          <Text style={styles.supportersEmpty}>No supporters yet</Text>
        ) : (
          <View style={styles.supportersList}>
            {supporters.map((s) => {
              const amountStr = s?.amount != null ? `${s.amount}${currencySymbol(s.currency)}` : '';
              const ago = timeAgo(s?.createdAt);
              return (
                <View key={s.id} style={styles.supporterRow}>
                  <View style={styles.supporterLeft}>
                    {s?.avatar ? (
                      <Image source={{ uri: s.avatar }} style={styles.supporterAvatarImg} />
                    ) : (
                      <View style={styles.supporterAvatar}>
                        <Ionicons name="heart" size={14} color="#fff" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.supporterName} numberOfLines={1}>{s?.name || 'Anonymous'}</Text>
                      <Text style={styles.supporterMeta} numberOfLines={1}>
                        {amountStr}{amountStr && ago ? ' · ' : ''}{ago}
                      </Text>
                      {s?.message ? (
                        <Text style={styles.supporterMessage} numberOfLines={1}>{s.message}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={openEmail}>
          <Ionicons name="mail" size={18} color="#1f4cff" style={{ marginRight: 8 }} />
          <Text style={styles.secondaryText}>Contact support</Text>
        </TouchableOpacity>
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
  content: { paddingHorizontal: 20, paddingTop: 10 },
  subtitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  paragraph: { color: '#aaa', marginBottom: 20, lineHeight: 20 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f4cff',
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,76,255,0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  secondaryText: { color: '#1f4cff', fontWeight: '700' },
  supportersHeader: { marginTop: 18, marginBottom: 6 },
  supportersTitle: { color: '#fff', fontWeight: '800' },
  supportersLoading: { paddingVertical: 8 },
  supportersEmpty: { color: '#777', fontStyle: 'italic', paddingVertical: 4 },
  supportersList: { marginTop: 4 },
  supporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  supporterLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  supporterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f4cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supporterAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111',
  },
  supporterName: { color: '#fff', fontWeight: '700' },
  supporterMeta: { color: '#bbb', fontSize: 12, marginTop: 1 },
  supporterMessage: { color: '#aaa', fontSize: 12, marginTop: 2 },
});
