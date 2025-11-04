// CrossPartyService.js - Service de gestion des rooms de party synchronisée
import { 
  ref, 
  set, 
  get, 
  update, 
  remove, 
  onValue, 
  onDisconnect,
  push
} from 'firebase/database';
import { database } from '../config/firebaseConfig';

class CrossPartyService {
  constructor() {
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isHost = false;
    this.listeners = [];
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
  async updateCurrentTrack(trackData) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can update track' };
    }

    try {
      await update(ref(database, `crossparty/rooms/${this.currentRoomId}`), {
        currentTrack: trackData,
        isPlaying: true,
        updatedAt: Date.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating track:', error);
      return { success: false, error: error.message };
    }
  }

  // Met à jour l'état de lecture (réservé à l'hôte)
  async updatePlaybackState(isPlaying) {
    if (!this.isHost || !this.currentRoomId) {
      return { success: false, error: 'Only host can update playback state' };
    }

    try {
      await update(ref(database, `crossparty/rooms/${this.currentRoomId}`), {
        isPlaying,
        updatedAt: Date.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating playback state:', error);
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
}

// Export d'une instance unique (singleton)
const crossPartyService = new CrossPartyService();
export default crossPartyService;
