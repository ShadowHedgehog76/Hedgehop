import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, TextInput, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlaylists, removeTrack, deletePlaylist, renamePlaylist } from '../src/api/playlists';
import { setGlobalTracks, playTrack } from '../src/api/player';
import QRCode from 'react-native-qrcode-svg';
import LZString from 'lz-string';
import { database } from '../src/config/firebaseConfig';
import { ref as dbRef, set as dbSet, onValue as dbOnValue, remove as dbRemove } from 'firebase/database';
import { useDeviceType } from '../src/hooks/useDeviceType';

// Placeholder fiable
const safeImage = 'https://via.placeholder.com/96x96/222/EEEEEE.png?text=%E2%99%AA';

export default function PlaylistDetailScreen({ route, navigation }) {
  const { playlistId } = route.params || {};
  const [playlist, setPlaylist] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareId, setShareId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [transferStatus, setTransferStatus] = useState('idle'); // idle | uploading | waiting | transferred | error
  const unsubscribeRef = useRef(null);
  const { isTablet } = useDeviceType();
  const haloAnim = useRef(new Animated.Value(0)).current;

  const load = async () => {
    const lists = await getPlaylists();
    const pl = lists.find((p) => p.id === playlistId) || null;
    setPlaylist(pl);
    if (pl && !newName) setNewName(pl.name);
  };

  useEffect(() => {
    load();
    const focus = navigation.addListener('focus', load);
    return focus;
  }, [playlistId]);
  // Génère un ID base62 de 24 caractères
  const generateId24 = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 24; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  };

  // À l'ouverture du QR: uploader la playlist complète dans RTDB et stocker l'ID
  useEffect(() => {
    const doUpload = async () => {
      if (!qrOpen || !playlist) return;
      try {
        setUploading(true);
        setTransferStatus('uploading');
        const id = generateId24();
        const payload = {
          t: 'hedgehop_playlist_full_v1',
          n: playlist.name,
          tracks: playlist.tracks || [],
          createdAt: Date.now(),
        };
        await dbSet(dbRef(database, `qrPlaylists/${id}`), payload);
        setShareId(id);
        setTransferStatus('waiting');

        // Écouter l'état de la clé pour savoir quand elle a été consommée (supprimée côté scanner)
        const nodeRef = dbRef(database, `qrPlaylists/${id}`);
        const unsub = dbOnValue(nodeRef, (snap) => {
          if (snap.exists()) {
            setTransferStatus('waiting');
          } else {
            setTransferStatus('transferred');
          }
        });
        unsubscribeRef.current = unsub;
      } catch (e) {
        console.warn('Upload playlist QR failed:', e);
        setShareId('');
        setTransferStatus('error');
      } finally {
        setUploading(false);
      }
    };
    doUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen]);

  // Nettoyer quand on ferme le modal: supprimer la clé si non consommée et détacher l'écouteur
  useEffect(() => {
    if (!qrOpen) {
      // Cleanup asynchrone
      (async () => {
        try {
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          if (shareId && transferStatus !== 'transferred') {
            await dbRemove(dbRef(database, `qrPlaylists/${shareId}`));
          }
        } catch {}
        finally {
          setShareId('');
          setTransferStatus('idle');
        }
      })();
    }
  }, [qrOpen]);

  // Auto-fermeture du modal 1s après transfert réussi
  const autoCloseTimerRef = useRef(null);
  useEffect(() => {
    if (qrOpen && transferStatus === 'transferred') {
      // Lance un petit halo d'animation de succès
      try {
        haloAnim.setValue(0);
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      } catch {}
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        setQrOpen(false);
      }, 1000);
    }
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [qrOpen, transferStatus]);

  const tracks = useMemo(() => playlist?.tracks || [], [playlist]);

  const handlePlayAll = () => {
    if (!tracks.length) return;
    setGlobalTracks(tracks);
    playTrack(tracks[0], 0);
  };

  const handlePlayItem = (item, index) => {
    setGlobalTracks(tracks);
    playTrack(item, index);
  };

  const confirmDeletePlaylist = async () => {
    if (!playlist) return;
    await deletePlaylist(playlist.id);
    navigation.goBack();
  };

  const handleRemoveTrack = async (item) => {
    if (!playlist) return;
    await removeTrack(playlist.id, item);
    await load();
  };

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await renamePlaylist(playlist.id, trimmed);
    setRenameOpen(false);
    await load();
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => handlePlayItem(item, index)}>
      <Image source={{ uri: item.image || safeImage }} style={styles.cover} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.rowSub}>{item.album || 'Inconnu'}</Text>
      </View>
      <TouchableOpacity onPress={() => handleRemoveTrack(item)} style={styles.removeBtn}>
        <Ionicons name="remove" size={18} color="#ff3b30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.title}>{playlist?.name || 'Playlist'}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setQrOpen(true)}>
            <Ionicons name="qr-code" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setRenameOpen(true)}>
            <Ionicons name="pencil" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll} disabled={!tracks.length}>
          <Ionicons name="play" size={18} color="#000" />
          <Text style={styles.playAllText}>Play all</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeletePlaylist}>
          <Ionicons name="trash" size={18} color="#ff3b30" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={tracks}
        keyExtractor={(item, i) => `${item.url || item.id || item.title}-${i}`}
        contentContainerStyle={tracks.length === 0 ? styles.emptyList : { padding: 16 }}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={styles.empty}> 
            <Ionicons name="musical-notes" size={48} color="#555" />
            <Text style={styles.emptyText}>Empty playlist</Text>
            <Text style={styles.emptySub}>Add tracks from the player.</Text>
          </View>
        )}
      />

      {/* QR Modal */}
      <Modal transparent visible={qrOpen} animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Transfer playlist</Text>
            <View style={[styles.transferContainer, isTablet ? styles.transferRow : styles.transferCol]}>
              {/* Left: QR */}
              <View style={[styles.transferLeft, isTablet ? { alignItems: 'center' } : { alignItems: 'center' }]}>
                <View style={styles.qrWrapper}>
                  {playlist && (() => {
                    const qrSize = isTablet ? 260 : 220;
                    const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
                    const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
                    return (
                      <View style={[styles.qrBox, { width: qrSize, height: qrSize }]}> 
                        {transferStatus === 'transferred' && (
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.qrHalo,
                              {
                                borderRadius: qrSize / 2 + 8,
                                opacity: haloOpacity,
                                transform: [{ scale: haloScale }],
                              },
                            ]}
                          />
                        )}
                        <QRCode
                          value={shareId || '...'}
                          size={qrSize}
                          backgroundColor="#fff"
                          color="#000"
                          ecl="L"
                        />
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Right: Info + status */}
              <View style={styles.transferRight}>
                {isTablet ? (
                  <>
                    <Text style={[styles.transferIntro, { textAlign: 'left' }]}>
                      Scan this QR with another device to receive this playlist. It will be automatically removed from the server after transfer.
                    </Text>
                    <View style={[styles.statusRow, { justifyContent: 'flex-start' }]}>
                      {transferStatus === 'uploading' && (
                        <>
                          <Ionicons name="cloud-upload-outline" size={24} color="#aaa" style={{ marginRight: 8 }} />
                          <Text style={[styles.statusText, styles.statusTextBig]}>Preparing transfer...</Text>
                        </>
                      )}
                      {transferStatus === 'waiting' && (
                        <>
                          <Ionicons name="time-outline" size={24} color="#aaa" style={{ marginRight: 8 }} />
                          <Text style={[styles.statusText, styles.statusTextBig]}>Waiting for scan...</Text>
                        </>
                      )}
                      {transferStatus === 'transferred' && (
                        <>
                          <Ionicons name="checkmark-circle" size={24} color="#22c55e" style={{ marginRight: 8 }} />
                          <Text style={[styles.statusText, styles.statusTextBig, { color: '#22c55e' }]}>Transfert terminé</Text>
                        </>
                      )}
                      {transferStatus === 'error' && (
                        <>
                          <Ionicons name="alert-circle" size={24} color="#ff6b6b" style={{ marginRight: 8 }} />
                          <Text style={[styles.statusText, styles.statusTextBig, { color: '#ff6b6b' }]}>Transfer error</Text>
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.statusRow, { justifyContent: 'center' }]}>
                      {transferStatus === 'uploading' && (
                        <>
                          <Ionicons name="cloud-upload-outline" size={26} color="#aaa" style={{ marginRight: 10 }} />
                          <Text style={[styles.statusText, styles.statusTextBigger]}>Preparing transfer...</Text>
                        </>
                      )}
                      {transferStatus === 'waiting' && (
                        <>
                          <Ionicons name="time-outline" size={26} color="#aaa" style={{ marginRight: 10 }} />
                          <Text style={[styles.statusText, styles.statusTextBigger]}>Waiting for scan...</Text>
                        </>
                      )}
                      {transferStatus === 'transferred' && (
                        <>
                          <Ionicons name="checkmark-circle" size={26} color="#22c55e" style={{ marginRight: 10 }} />
                          <Text style={[styles.statusText, styles.statusTextBigger, { color: '#22c55e' }]}>Transfert terminé</Text>
                        </>
                      )}
                      {transferStatus === 'error' && (
                        <>
                          <Ionicons name="alert-circle" size={26} color="#ff6b6b" style={{ marginRight: 10 }} />
                          <Text style={[styles.statusText, styles.statusTextBigger, { color: '#ff6b6b' }]}>Transfer error</Text>
                        </>
                      )}
                    </View>
                    <Text style={[styles.transferIntro, { textAlign: 'center', marginTop: 8 }]}>
                      Scan this QR with another device to receive this playlist. It will be automatically removed from the server after transfer.
                    </Text>
                  </>
                )}
              </View>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalConfirm} onPress={() => setQrOpen(false)}>
                  <Ionicons name="close" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalConfirmText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </Modal>

      {/* Rename modal */}
      <Modal transparent visible={renameOpen} animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename playlist</Text>
            <TextInput
              style={styles.input}
              placeholder="Playlist name"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRenameOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleRename}>
                <Text style={styles.modalConfirmText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  menuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1, marginHorizontal: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  playAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  playAllText: { color: '#000', fontWeight: '800' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,59,48,0.15)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  deleteText: { color: '#ff3b30', fontWeight: '800' },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#ccc', fontSize: 16, marginTop: 12, fontWeight: '600' },
  emptySub: { color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 8 },
  cover: { width: 48, height: 48, borderRadius: 8, marginRight: 12, backgroundColor: '#222' },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowSub: { color: '#aaa', fontSize: 12, marginTop: 2 },
  removeBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,59,48,0.15)', marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '86%', backgroundColor: '#151515', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginBottom: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 12 },
  modalCancelText: { color: '#aaa', fontWeight: '700' },
  modalConfirm: { backgroundColor: '#1f4cff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
  qrWrapper: { backgroundColor: '#fff', padding: 10, borderRadius: 12 },
  qrBox: { alignItems: 'center', justifyContent: 'center' },
  qrHalo: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderWidth: 3,
    borderColor: '#22c55e',
  },
  // Transfer layout
  transferContainer: { paddingVertical: 10 },
  transferRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  transferCol: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  transferLeft: { marginRight: 16 },
  transferRight: { flex: 1, paddingHorizontal: 4, marginTop: 10 },
  transferIntro: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statusText: { color: '#aaa', fontWeight: '700' },
  statusTextBig: { fontSize: 18 },
  statusTextBigger: { fontSize: 20 },
});
