import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlaylists, createPlaylist, deletePlaylist, playlistEmitter, upsertPlaylistByName } from '../src/api/playlists';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LZString from 'lz-string';
import { getCatalog } from '../src/api/catalog';
import { database } from '../src/config/firebaseConfig';
import { ref as dbRef, get as dbGet, child as dbChild, remove as dbRemove } from 'firebase/database';

export default function PlaylistsScreen({ navigation }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const processingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    const data = await getPlaylists();
    setPlaylists(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const sub = playlistEmitter.addListener('update', (pls) => setPlaylists(pls));
    return () => sub.remove();
  }, []);

  const handleCreate = async () => {
    const pl = await createPlaylist('New playlist');
    if (pl?.id) {
      navigation.navigate('PlaylistDetail', { playlistId: pl.id });
    }
  };

  const handleDelete = async (id) => {
    await deletePlaylist(id);
  };

  const handleAskPermissionAndScan = async () => {
    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    processingRef.current = false;
    setScanning(true);
  };

  const onBarCodeScanned = async ({ data }) => {
    if (processingRef.current) return;
    processingRef.current = true;
    const finish = () => {
      setScanning(false);
      // libère le lock (au cas où l'overlay reste ouvert)
      setTimeout(() => { processingRef.current = false; }, 400);
    };
    try {
      // Helper: résout des métadonnées (title/album/image) depuis le catalogue par URL
      const resolveTracksFromUrls = async (urls, nameFallback = 'Playlist importée') => {
        const catalog = await getCatalog();
        const map = new Map();
        try {
          for (const cat of catalog || []) {
            for (const album of cat.albums || []) {
              // pistes principales
              for (const t of album.tracks || []) {
                if (t?.url) {
                  map.set(t.url, { title: t.title, album: album.title, image: album.image });
                }
                // crossmusic
                if (Array.isArray(t?.crossmusic)) {
                  for (const c of t.crossmusic) {
                    if (c?.url) {
                      map.set(c.url, { title: c.title, album: album.title, image: album.image, crossTitle: t.title });
                    }
                  }
                }
              }
            }
          }
        } catch {}

        const tracks = (urls || []).map((u) => ({
          url: u,
          ...(map.get(u) || {}),
        }));
        const pl = await upsertPlaylistByName(nameFallback, tracks);
        finish();
        if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
      };

      // 0) Si c'est une URL, aller chercher le JSON et le traiter
      if (typeof data === 'string' && /^https?:\/\//i.test(data)) {
        try {
          const res = await fetch(data);
          if (res.ok) {
            const remote = await res.json();
            // Supporte l'ancien format {type,name,tracks} et le format minimal {t:'hpl_v1',n,tr}
            if (remote?.type === 'hedgehop_playlist_v1') {
              const name = remote.name || 'Playlist importée';
              const tracks = Array.isArray(remote.tracks) ? remote.tracks : [];
              const pl = await upsertPlaylistByName(name, tracks);
              finish();
              if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
              return;
            }
            if (remote?.t === 'hpl_v1') {
              const name = remote.n || 'Playlist importée';
              const tracks = Array.isArray(remote.tr) ? remote.tr.map((x) => ({
                title: x.t,
                album: x.a,
                url: x.u,
                ...(x.c ? { crossTitle: x.c } : {}),
              })) : [];
              const pl = await upsertPlaylistByName(name, tracks);
              finish();
              if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
              return;
            }
            // Si autre schéma: tenter {name,tracks}
            if (remote?.t === 'hpl_v2' && Array.isArray(remote.u)) {
              const name = remote.n || 'Playlist importée';
              await resolveTracksFromUrls(remote.u, name);
              return;
            }
            if (remote?.name && Array.isArray(remote.tracks)) {
              const pl = await upsertPlaylistByName(remote.name, remote.tracks);
              finish();
              if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
              return;
            }
          }
        } catch (e) {
          // ignore fetch errors
        }
      }

  // 0bis) If it's a 24-char ID, fetch from RTDB then delete
      if (typeof data === 'string' && /^[A-Za-z0-9]{24}$/.test(data)) {
        try {
          const snapshot = await dbGet(dbChild(dbRef(database), `qrPlaylists/${data}`));
          if (snapshot.exists()) {
            const remote = snapshot.val();
            // Supporte: full v1: { t:'hedgehop_playlist_full_v1', n, tracks }
            if (remote?.t === 'hedgehop_playlist_full_v1') {
              const name = remote.n || 'Playlist importée';
              const tracks = Array.isArray(remote.tracks) ? remote.tracks : [];
              const pl = await upsertPlaylistByName(name, tracks);
              // Supprimer après récupération
              await dbRemove(dbRef(database, `qrPlaylists/${data}`));
              finish();
              if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
              return;
            }
            // v2 ultra-compact possible: { t:'hpl_v2', n, u:[] }
            if (remote?.t === 'hpl_v2' && Array.isArray(remote.u)) {
              const name = remote.n || 'Playlist importée';
              await resolveTracksFromUrls(remote.u, name);
              await dbRemove(dbRef(database, `qrPlaylists/${data}`));
              return;
            }
            // fallback générique
            if (remote?.name && Array.isArray(remote.tracks)) {
              const pl = await upsertPlaylistByName(remote.name, remote.tracks);
              await dbRemove(dbRef(database, `qrPlaylists/${data}`));
              finish();
              if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
              return;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      let payload = null;
      // 1) Essayer directement JSON (ancien format)
      try {
        payload = JSON.parse(data);
      } catch {}

      // 2) Sinon tenter décompression (nouveau format compressé)
      if (!payload) {
        const decompressed = LZString.decompressFromEncodedURIComponent(data);
        if (decompressed) {
          try { payload = JSON.parse(decompressed); } catch {}
        }
      }

      if (!payload) return finish();

      // Ancien format lisible
      if (payload?.type === 'hedgehop_playlist_v1') {
        const name = payload.name || 'Playlist importée';
        const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
        const pl = await upsertPlaylistByName(name, tracks);
        finish();
        if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
        return;
      }

      // Nouveau format minimal/compressé
      if (payload?.t === 'hpl_v1') {
        const name = payload.n || 'Playlist importée';
        const tracks = Array.isArray(payload.tr) ? payload.tr.map((x) => ({
          title: x.t,
          album: x.a,
          url: x.u,
          ...(x.c ? { crossTitle: x.c } : {}),
        })) : [];
        const pl = await upsertPlaylistByName(name, tracks);
        finish();
        if (pl?.id) navigation.navigate('PlaylistDetail', { playlistId: pl.id });
        return;
      }

      // Ultra compact: uniquement les URLs audio
      // Ultra compact: uniquement les URLs audio (v2 local)
      if (payload?.t === 'hpl_v2') {
        const name = payload.n || 'Playlist importée';
        const urls = Array.isArray(payload.u) ? payload.u : [];
        await resolveTracksFromUrls(urls, name);
        return;
      }
    } catch (e) {
      // no-op
    }
    finish();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.name}</Text>
  <Text style={styles.itemSubtitle}>{item.tracks?.length || 0} track(s)</Text>
      </View>
      <TouchableOpacity style={styles.itemAction} onPress={() => handleDelete(item.id)}>
        <Ionicons name="trash" size={20} color="#ff3b30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Playlists</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleAskPermissionAndScan}>
            <Ionicons name="qr-code" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createText}>New playlist</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={playlists.length === 0 ? styles.emptyList : { padding: 16 }}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="musical-notes" size={48} color="#555" />
            <Text style={styles.emptyText}>No playlists yet</Text>
            <Text style={styles.emptySub}>Create your first playlist to organize your music.</Text>
          </View>
        )}
        refreshing={loading}
        onRefresh={load}
      />

      {scanning && (
        <View style={styles.scannerOverlay}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarCodeScanned}
          />
          <View style={styles.scannerTopBar}>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setScanning(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan a playlist QR</Text>
          </View>
          <View style={styles.scanGuide} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerActions: { width: 40, alignItems: 'flex-end' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  actions: { paddingHorizontal: 16, paddingBottom: 8 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f4cff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  createText: { color: '#fff', fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  itemSubtitle: { color: '#aaa', fontSize: 12, marginTop: 2 },
  itemAction: {
    marginLeft: 12,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,48,0.15)'
  },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#ccc', fontSize: 16, marginTop: 12, fontWeight: '600' },
  emptySub: { color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  scannerTopBar: { position: 'absolute', top: 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scannerClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  scannerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  scanGuide: { width: 240, height: 240, borderRadius: 16, borderWidth: 2, borderColor: '#1f4cff' },
});
