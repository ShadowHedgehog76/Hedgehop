import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCatalog } from '../src/api/catalog';
import { setGlobalTracks, playTrack } from '../src/api/player';
import crossPartyService from '../src/services/crossPartyService';

function normalizeText(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .trim();
}

// Levenshtein edit distance (number of insertions, deletions, substitutions)
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Array(n + 1).fill(0);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

function fuzzyScore(query, candidate) {
  // exact/substring match shortcut
  if (!query) return Infinity;
  if (candidate.includes(query)) return 0; // best case

  // compute distance vs full string and per-word min
  const distFull = levenshtein(query, candidate);
  const words = candidate.split(/\s+/g).filter(Boolean);
  const distWord = words.length > 0 ? Math.min(...words.map(w => levenshtein(query, w))) : distFull;

  // prefer word match; normalize by length to avoid bias
  const normFull = distFull / Math.max(1, candidate.length);
  const normWord = distWord / Math.max(1, query.length);
  // final score blends both
  return Math.min(normWord, normFull);
}

function wordThresholdByQuery(queryLen) {
  if (queryLen <= 3) return 0; // very short queries: exact/substring only
  if (queryLen <= 5) return 1;
  if (queryLen <= 8) return 2;
  return 3; // allow a few edits on long queries
}

function isTitleRelated(query, title) {
  if (!query) return false;
  if (title.includes(query)) return true;
  const words = title.split(/\s+/g).filter(Boolean);
  const thr = wordThresholdByQuery(query.length);
  for (const w of words) {
    if (levenshtein(query, w) <= thr) return true;
  }
  return false;
}

export default function SearchTracksScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const PLAYERBAR_INSET = 100; // keep results clear of the PlayerBar

  useEffect(() => {
    (async () => {
      const data = await getCatalog({ forceRefresh: false });
      const flat = [];
      for (const cat of data || []) {
        for (const album of cat.albums || []) {
          const image = album.image;
          const albumTitle = album.title;
          for (const t of album.tracks || []) {
            const playable = t.url || t.streamUrl || t.source;
            if (!playable) continue; // skip non-playable tracks
            flat.push({
              ...t,
              url: t.url ?? t.streamUrl ?? t.source, // normalize url field
              image: t.image || image,
              album: t.album || albumTitle,
              _searchTitle: normalizeText(t.title || ''),
              _searchAlbum: normalizeText(albumTitle || ''),
            });
          }
        }
      }
      setTracks(flat);
    })();
  }, []);

  const normalizedQuery = useMemo(() => normalizeText(query), [query]);

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    const scored = [];
    for (const t of tracks) {
      const title = t._searchTitle;
      // Only keep results that relate to the TITLE (not album-only matches)
      if (!isTitleRelated(normalizedQuery, title)) continue;
      const score = fuzzyScore(normalizedQuery, title);
      if (!Number.isFinite(score)) continue;
      // Slightly stricter threshold since we require title relation
      if (score >= 0.6) continue;
      scored.push({ track: t, score });
    }
    return scored
      .sort((a, b) => a.score - b.score)
      .slice(0, 100);
  }, [normalizedQuery, tracks]);

  const handlePlay = (t) => {
    const playable = t.url || t.streamUrl || t.source;
    if (!playable) return;
    
    // Vérifier si on est un guest dans une CrossParty room
    const roomInfo = crossPartyService.getCurrentRoomInfo();
    const isGuestInCrossParty = roomInfo.roomId && !roomInfo.isHost;
    
    const trackData = {
      id: t.id || t.title,
      title: t.title,
      artist: t.artist || 'Unknown Artist',
      album: t.album || 'Unknown Album',
      duration: t.duration || 0,
      uri: playable,
      url: playable,
      image: t.image,
    };
    
    if (isGuestInCrossParty) {
      // Guest: ajouter à la queue
      console.log('➕ Guest ajoute à la queue:', trackData.title);
      crossPartyService.addToQueue(
        trackData,
        roomInfo.userId,
        'You'
      );
    } else {
      // Host ou pas en room: jouer directement
      console.log('▶️ Jouant directement:', trackData.title);
      setGlobalTracks([trackData]);
      playTrack(trackData, 0);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Search Tracks</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#aaa" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Type a track title..."
          placeholderTextColor="#777"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#777" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {normalizedQuery.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: PLAYERBAR_INSET }] }>
          <Text style={styles.emptyText}>Start typing to find tracks</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: PLAYERBAR_INSET }]}>
          <Text style={styles.emptyText}>No tracks found</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => (item.track.id ? String(item.track.id) : `${item.track.title}-${idx}`)}
          contentContainerStyle={{ paddingBottom: PLAYERBAR_INSET }}
          renderItem={({ item, index }) => {
            const t = item.track;
            const playable = !!t.url; // already normalized above
            return (
              <TouchableOpacity
                style={[styles.row, !playable && { opacity: 0.5 }]}
                onPress={() => playable && handlePlay(t)}
                disabled={!playable}
              >
                <Image source={{ uri: t.image }} style={styles.cover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>{t.album}</Text>
                </View>
                {playable ? (
                  <Ionicons name="play" size={18} color="#1f4cff" />
                ) : (
                  <Ionicons name="musical-notes" size={18} color="#555" />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { color: '#fff', flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#777', fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  cover: { width: 46, height: 46, borderRadius: 8, backgroundColor: '#111' },
  rowTitle: { color: '#fff', fontWeight: '700' },
  rowSubtitle: { color: '#aaa', fontSize: 12, marginTop: 2 },
});
