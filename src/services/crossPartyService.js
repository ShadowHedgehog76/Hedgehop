// CrossPartyService.js - Service de gestion des rooms de party synchronisée
import { 
  ref, 
  set, 
  get, 
  update, 
  remove, 
  onValue, 
  onDisconnect,
  push,
  child
} from 'firebase/database';
import { EventEmitter } from 'fbemitter';
import { database } from '../config/firebaseConfig';

// Fonction utilitaire pour nettoyer les objets (enlever les undefined)
const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null)
  );
};

// Fonction utilitaire pour extraire les infos de piste (y compris depuis l'URL)
const extractTrackInfo = (trackData) => {
  let artist = trackData?.artist || trackData?.artistName || '';
  let album = trackData?.album || trackData?.albumName || '';
  
  // Si l'artiste n'est pas disponible, essayer d'extraire depuis l'URL
  if (!artist && trackData?.uri) {
    // Exemple: si l'URL contient des infos encodées
    try {
      const urlParams = new URLSearchParams(new URL(trackData.uri).search);
      artist = urlParams.get('artist') || artist;
      album = urlParams.get('album') || album;
    } catch (e) {
      // L'URI n'est pas une URL valide, ignorer
    }
  }
  
  return {
    artist: artist || 'Unknown Artist',
    album: album || 'Unknown Album',
  };
};

class CrossPartyService {
  constructor() {
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isHost = false;
    this.listeners = [];
    this.emitter = new EventEmitter();
  }

  // Génère un code de room aléatoire (6 caractères)
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Crée une nouvelle room
  async createRoom(hostUserId, hostUsername = 'Anonymous') {
    try {
      const roomCode = this.generateRoomCode();
      const roomId = push(ref(database, 'crossparty/rooms')).key;
      
      const roomData = {
        roomId,
        roomCode,
        hostId: hostUserId,
        hostUsername,
        createdAt: Date.now(),
        participants: {
          [hostUserId]: {
            userId: hostUserId,
            username: hostUsername,
            isHost: true,
            joinedAt: Date.now()
          }
        },
        currentTrack: null,
        isPlaying: false,
        queue: []
      };

      // Créer la room dans Firebase
      await set(ref(database, `crossparty/rooms/${roomId}`), roomData);
      
      // Créer un mapping code -> roomId pour faciliter la recherche
      await set(ref(database, `crossparty/codes/${roomCode}`), roomId);

      // Configurer la déconnexion automatique
      const roomRef = ref(database, `crossparty/rooms/${roomId}`);
      onDisconnect(roomRef).remove();

      this.currentRoomId = roomId;
      this.currentUserId = hostUserId;
      this.isHost = true;

      // Émettre un événement
      this.emitter.emit('hostStatusChanged', { isHost: true, roomId });

      return { success: true, roomId, roomCode };
    } catch (error) {
      console.error('Error creating room:', error);
      return { success: false, error: error.message };
    }
  }

  // Rejoint une room avec un code
  async joinRoom(roomCode, userId, username = 'Anonymous') {
    try {
      // Vérifier si le code existe
      const codeSnapshot = await get(ref(database, `crossparty/codes/${roomCode.toUpperCase()}`));
      
      if (!codeSnapshot.exists()) {
        return { success: false, error: 'Room code not found' };
      }

      const roomId = codeSnapshot.val();

      // Vérifier si la room existe encore
      const roomSnapshot = await get(ref(database, `crossparty/rooms/${roomId}`));
      
      if (!roomSnapshot.exists()) {
        // Nettoyer le code obsolète
        await remove(ref(database, `crossparty/codes/${roomCode.toUpperCase()}`));
        return { success: false, error: 'Room no longer exists' };
      }

      // Ajouter le participant à la room
      const participantData = {
        userId,
        username,
        isHost: false,
        joinedAt: Date.now()
      };

      await set(
        ref(database, `crossparty/rooms/${roomId}/participants/${userId}`),
        participantData
      );

      // Configurer la déconnexion automatique pour ce participant
      const participantRef = ref(database, `crossparty/rooms/${roomId}/participants/${userId}`);
      onDisconnect(participantRef).remove();

      this.currentRoomId = roomId;
      this.currentUserId = userId;
      this.isHost = false;

      // Émettre un événement
      this.emitter.emit('hostStatusChanged', { isHost: false, roomId });

      return { success: true, roomId };
    } catch (error) {
      console.error('Error joining room:', error);
      return { success: false, error: error.message };
    }
  }

  // Quitte la room actuelle
  async leaveRoom() {
    if (!this.currentRoomId || !this.currentUserId) {
      return { success: false, error: 'Not in a room' };
    }

    try {
      if (this.isHost) {
        // Si c'est l'hôte qui part, supprimer toute la room
        await remove(ref(database, `crossparty/rooms/${this.currentRoomId}`));
        
        // Récupérer le code de la room avant de la supprimer
        const roomSnapshot = await get(ref(database, `crossparty/rooms/${this.currentRoomId}`));
        if (roomSnapshot.exists()) {
          const roomCode = roomSnapshot.val().roomCode;
          await remove(ref(database, `crossparty/codes/${roomCode}`));
        }
      } else {
        // Sinon, retirer seulement le participant
        await remove(
          ref(database, `crossparty/rooms/${this.currentRoomId}/participants/${this.currentUserId}`)
        );
      }

      // Nettoyer les listeners
      this.removeAllListeners();

      this.currentRoomId = null;
      this.currentUserId = null;
      this.isHost = false;

      // Émettre un événement
      this.emitter.emit('hostStatusChanged', { isHost: false, roomId: null });

      return { success: true };
    } catch (error) {
      console.error('Error leaving room:', error);
      return { success: false, error: error.message };
    }
  }

  // Kick un participant (réservé à l'hôte)
  async kickParticipant(participantId) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can kick participants' };
    }

    if (participantId === this.currentUserId) {
      return { success: false, error: 'Cannot kick yourself' };
    }

    try {
      await remove(
        ref(database, `crossparty/rooms/${this.currentRoomId}/participants/${participantId}`)
      );
      return { success: true };
    } catch (error) {
      console.error('Error kicking participant:', error);
      return { success: false, error: error.message };
    }
  }

  // Transfère le rôle de host à un participant
  async transferHost(newHostId) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can transfer host' };
    }

    if (newHostId === this.currentUserId) {
      return { success: false, error: 'You are already the host' };
    }

    try {
      const updates = {};
      
      // Mettre à jour l'ancien host
      updates[`crossparty/rooms/${this.currentRoomId}/participants/${this.currentUserId}/isHost`] = false;
      
      // Mettre à jour le nouveau host
      updates[`crossparty/rooms/${this.currentRoomId}/participants/${newHostId}/isHost`] = true;
      
      // Mettre à jour l'ID du host dans la room
      updates[`crossparty/rooms/${this.currentRoomId}/hostId`] = newHostId;
      
      await update(ref(database), updates);
      
      this.isHost = false;
      
      // Émettre un événement pour notifier les changements
      this.emitter.emit('hostTransferred', { oldHostId: this.currentUserId, newHostId });
      
      return { success: true };
    } catch (error) {
      console.error('Error transferring host:', error);
      return { success: false, error: error.message };
    }
  }

  // Écoute les changements dans la room
  subscribeToRoom(roomId, callback) {
    const roomRef = ref(database, `crossparty/rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ exists: true, data: snapshot.val() });
      } else {
        // La room n'existe plus (l'hôte est parti)
        callback({ exists: false, data: null });
      }
    }, (error) => {
      console.error('Error subscribing to room:', error);
      callback({ exists: false, error: error.message });
    });

    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  // Écoute les participants de la room
  subscribeToParticipants(roomId, callback) {
    const participantsRef = ref(database, `crossparty/rooms/${roomId}/participants`);
    
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      const participants = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          participants.push(childSnapshot.val());
        });
      }
      callback(participants);
    });

    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  // Met à jour la lecture en cours (réservé à l'hôte)
  // Accepte un objet trackData avec: id, title, artist, duration, uri, image, etc.
  async updateCurrentTrack(trackData) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can update track' };
    }

    try {
      // Extraire les infos d'artiste et album
      const { artist, album } = extractTrackInfo(trackData);

      // Valider et nettoyer les données
      const trackWithMetadata = {
        id: trackData?.id || trackData?.trackId || 'unknown',
        title: trackData?.title || trackData?.name || 'Unknown Track',
        artist: artist,
        album: album,
        duration: trackData?.duration || 0,
        uri: trackData?.uri || trackData?.url || '',
        image: trackData?.image || trackData?.albumArt || '',
        currentPosition: trackData?.currentPosition || 0,
        updatedAt: Date.now(),
        updatedBy: this.currentUserId
      };

      // Enlever les undefined
      const cleanedTrack = cleanObject(trackWithMetadata);

      await update(ref(database, `crossparty/rooms/${this.currentRoomId}`), {
        currentTrack: cleanedTrack,
        isPlaying: true,
        lastTrackChangeAt: Date.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating track:', error);
      return { success: false, error: error.message };
    }
  }

  // Synchronise la piste actuelle avec timestamp pour que tous les clients jouent en même temps
  async synchronizeTrack(trackData, currentPosition = 0) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can synchronize track' };
    }

    try {
      const syncTimestamp = Date.now();
      
      // Extraire les infos d'artiste et album
      const { artist, album } = extractTrackInfo(trackData);

      // Nettoyer et valider les données de la piste
      const trackWithSync = {
        id: trackData?.id || trackData?.trackId || 'unknown',
        title: trackData?.title || trackData?.name || 'Unknown Track',
        artist: artist,
        album: album,
        duration: trackData?.duration || 0,
        uri: trackData?.uri || trackData?.url || '',
        image: trackData?.image || trackData?.albumArt || '',
        currentPosition,
        syncedAt: syncTimestamp,
        updatedBy: this.currentUserId,
        isPlaying: true
      };

      // Enlever les undefined
      const cleanedTrack = cleanObject(trackWithSync);

      await update(ref(database, `crossparty/rooms/${this.currentRoomId}`), {
        currentTrack: cleanedTrack,
        isPlaying: true,
        lastTrackChangeAt: syncTimestamp,
        lastSyncTimestamp: syncTimestamp
      });

      return { success: true, syncTimestamp };
    } catch (error) {
      console.error('Error synchronizing track:', error);
      return { success: false, error: error.message };
    }
  }

  // Met à jour l'état de lecture (réservé à l'hôte)
  // Enregistre aussi le timestamp exact du changement pour la synchronisation
  async updatePlaybackState(isPlaying, trackPosition = null) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can update playback state' };
    }

    try {
      const updateData = {
        isPlaying,
        playbackStateChangedAt: Date.now()
      };

      // Si on pause/play avec une position spécifique, la sauvegarder
      if (trackPosition !== null) {
        updateData.trackPosition = trackPosition;
      }

      await update(ref(database, `crossparty/rooms/${this.currentRoomId}`), updateData);
      return { success: true };
    } catch (error) {
      console.error('Error updating playback state:', error);
      return { success: false, error: error.message };
    }
  }

  // Sauvegarde l'état complet de la musique (piste + play/pause + position)
  async savePlaybackState(trackData, isPlaying, currentPosition = 0) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can save playback state' };
    }

    try {
      // Extraire les infos d'artiste et album
      const { artist, album } = extractTrackInfo(trackData);

      // Nettoyer les données de la piste en s'assurant que les champs requis sont présents
      const cleanTrackData = {
        id: trackData?.id || trackData?.trackId || 'unknown',
        title: trackData?.title || trackData?.name || 'Unknown Track',
        artist: artist,
        album: album,
        duration: trackData?.duration || 0,
        uri: trackData?.uri || trackData?.url || '',
        image: trackData?.image || trackData?.albumArt || '',
        currentPosition: currentPosition || 0,
        updatedAt: Date.now()
      };

      // Enlever tout undefined de l'objet
      const cleanedTrack = cleanObject(cleanTrackData);

      const playbackState = {
        currentTrack: cleanedTrack,
        isPlaying,
        lastPlaybackUpdateAt: Date.now(),
        updatedBy: this.currentUserId
      };

      await update(ref(database, `crossparty/rooms/${this.currentRoomId}`), playbackState);
      return { success: true };
    } catch (error) {
      console.error('Error saving playback state:', error);
      return { success: false, error: error.message };
    }
  }

  // Ajoute une piste à la queue (n'importe quel participant)
  async addToQueue(trackData) {
    if (!this.currentRoomId) {
      return { success: false, error: 'Not in a room' };
    }

    try {
      const queueRef = ref(database, `crossparty/rooms/${this.currentRoomId}/queue`);
      const newTrackRef = push(queueRef);
      
      await set(newTrackRef, {
        ...trackData,
        addedBy: this.currentUserId,
        addedAt: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error('Error adding to queue:', error);
      return { success: false, error: error.message };
    }
  }

  // Supprime tous les listeners
  removeAllListeners() {
    this.listeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.listeners = [];
  }

  // Récupère les informations de la room actuelle
  getCurrentRoomInfo() {
    return {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      isHost: this.isHost
    };
  }

  // Vérifie si l'utilisateur est actuellement dans une room
  isInRoom() {
    return this.currentRoomId !== null;
  }

  // S'abonner aux changements de statut host
  subscribeToHostStatusChanges(callback) {
    return this.emitter.addListener('hostStatusChanged', callback);
  }

  // S'abonner au transfert de host
  subscribeToHostTransfer(callback) {
    return this.emitter.addListener('hostTransferred', callback);
  }

  // Ajouter une musique à la queue (guest ou host)
  async addToQueue(trackData, userId, username = 'Anonymous') {
    if (!this.currentRoomId) {
      return { success: false, error: 'Not in a room' };
    }

    try {
      // Extraire les infos d'artiste et album
      const { artist, album } = extractTrackInfo(trackData);

      // Nettoyer les données de la piste (en respectant les valeurs du trackData si présentes)
      const cleanTrackData = {
        id: trackData?.id || trackData?.trackId || 'unknown',
        title: trackData?.title || trackData?.name || 'Unknown Track',
        artist: trackData?.artist || artist,
        album: trackData?.album || album,
        duration: trackData?.duration || 0,
        uri: trackData?.uri || trackData?.url || '',
        image: trackData?.image || trackData?.albumArt || '',
      };

      const cleanedTrack = cleanObject(cleanTrackData);

      // Créer un item de queue avec timestamp et userId
      const queueItem = {
        ...cleanedTrack,
        addedBy: {
          userId,
          username
        },
        addedAt: Date.now(),
        queueId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Ajouter à Firebase
      const queueRef = ref(database, `crossparty/rooms/${this.currentRoomId}/queue`);
      const newItemRef = child(queueRef, queueItem.queueId);
      await set(newItemRef, queueItem);

      console.log(`✅ Track added to queue: ${queueItem.title} from album: ${queueItem.album}`);
      return { success: true, queueId: queueItem.queueId };
    } catch (error) {
      console.error('Error adding to queue:', error);
      return { success: false, error: error.message };
    }
  }

  // Supprimer une musique de la queue (host seulement)
  async removeFromQueue(queueId) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can remove from queue' };
    }

    try {
      const queueItemRef = ref(database, `crossparty/rooms/${this.currentRoomId}/queue/${queueId}`);
      await remove(queueItemRef);

      console.log(`✅ Track removed from queue: ${queueId}`);
      return { success: true };
    } catch (error) {
      console.error('Error removing from queue:', error);
      return { success: false, error: error.message };
    }
  }

  // S'abonner aux changements de la queue
  subscribeToQueue(roomId, callback) {
    const queueRef = ref(database, `crossparty/rooms/${roomId}/queue`);
    
    const unsubscribe = onValue(queueRef, (snapshot) => {
      const queueItems = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          queueItems.push(childSnapshot.val());
        });
      }
      // Trier par ordre d'ajout
      queueItems.sort((a, b) => a.addedAt - b.addedAt);
      callback(queueItems);
    }, (error) => {
      console.error('Error subscribing to queue:', error);
      callback([]);
    });

    this.listeners.push(unsubscribe);
    return unsubscribe;
  }
}

// Export d'une instance unique (singleton)
const crossPartyService = new CrossPartyService();
export default crossPartyService;
