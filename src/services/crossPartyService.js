import { database } from '../config/firebaseConfig';
import { ref, push, set, get, onValue, off, remove, update } from 'firebase/database';

class CrossPartyService {
  constructor() {
    this.roomListeners = new Map();
  }

  // Génère un code de salon à 6 caractères
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Crée un nouveau salon
  async createRoom() {
    try {
      const roomCode = this.generateRoomCode();
      
      // Vérifier si le code existe déjà
      const codeRef = ref(database, `crossparty/codes/${roomCode}`);
      const codeSnapshot = await get(codeRef);
      
      if (codeSnapshot.exists()) {
        // Si le code existe, essayer avec un nouveau code
        return this.createRoom();
      }

      // Créer le salon dans la base de données
      const roomsRef = ref(database, 'crossparty/rooms');
      const newRoomRef = push(roomsRef);
      const roomId = newRoomRef.key;

      const roomData = {
        id: roomId,
        code: roomCode,
        hostId: 'host', // TODO: Utiliser l'ID utilisateur réel
        createdAt: Date.now(),
        isActive: true,
        currentTrack: null,
        playbackState: {
          isPlaying: false,
          position: 0,
          timestamp: Date.now()
        },
        guests: {},
        queue: []
      };

      // Sauvegarder le salon
      await set(newRoomRef, roomData);
      
      // Créer la référence du code vers le salon
      await set(codeRef, { roomId, createdAt: Date.now() });

      return {
        success: true,
        roomId,
        roomCode
      };
    } catch (error) {
      console.error('Erreur création salon:', error);
      return {
        success: false,
        error: 'Erreur lors de la création du salon'
      };
    }
  }

  // Rejoint un salon avec un code
  async joinRoom(roomCode) {
    try {
      // Chercher le salon avec ce code
      const codeRef = ref(database, `crossparty/codes/${roomCode}`);
      const codeSnapshot = await get(codeRef);

      if (!codeSnapshot.exists()) {
        return {
          success: false,
          error: 'Code de salon invalide'
        };
      }

      const { roomId } = codeSnapshot.val();

      // Vérifier que le salon existe et est actif
      const roomRef = ref(database, `crossparty/rooms/${roomId}`);
      const roomSnapshot = await get(roomRef);

      if (!roomSnapshot.exists()) {
        return {
          success: false,
          error: 'Salon introuvable'
        };
      }

      const roomData = roomSnapshot.val();

      if (!roomData.isActive) {
        return {
          success: false,
          error: 'Ce salon n\'est plus actif'
        };
      }

      // Ajouter l'invité au salon
      const guestId = `guest_${Date.now()}`; // TODO: Utiliser l'ID utilisateur réel
      const guestRef = ref(database, `crossparty/rooms/${roomId}/guests/${guestId}`);
      
      await set(guestRef, {
        id: guestId,
        joinedAt: Date.now(),
        isConnected: true
      });

      return {
        success: true,
        roomId,
        guestId
      };
    } catch (error) {
      console.error('Erreur rejoindre salon:', error);
      return {
        success: false,
        error: 'Erreur lors de la connexion au salon'
      };
    }
  }

  // Écoute les changements d'un salon
  listenToRoom(roomId, callback) {
    const roomRef = ref(database, `crossparty/rooms/${roomId}`);
    
    const listener = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    });

    this.roomListeners.set(roomId, listener);
    return listener;
  }

  // Arrête d'écouter un salon
  stopListeningToRoom(roomId) {
    const listener = this.roomListeners.get(roomId);
    if (listener) {
      const roomRef = ref(database, `crossparty/rooms/${roomId}`);
      off(roomRef, 'value', listener);
      this.roomListeners.delete(roomId);
    }
  }



  // ===== NOUVEAU SYSTÈME SIMPLIFIÉ =====
  
  // Met à jour l'état complet de la room (piste + lecture)
  async updateRoomState(roomId, newState, userId = 'unknown') {
    try {
      console.log('🎵 CrossParty: Mise à jour état complet room', { roomId, userId, newState });
      
      const roomRef = ref(database, `crossparty/rooms/${roomId}`);
      
      // Préparer les données avec structure complète
      const timestamp = Date.now();
      const stateId = `${timestamp}_${Math.random()}`;
      
      const updateData = {
        // Mettre à jour playbackState (structure existante)
        'playbackState/isPlaying': newState.isPlaying !== undefined ? newState.isPlaying : false,
        'playbackState/position': newState.position !== undefined ? newState.position : 0,
        'playbackState/timestamp': timestamp,
        
        // Ajouter les nouvelles données nécessaires
        'playbackState/action': newState.action || 'UNKNOWN',
        'playbackState/stateId': stateId,
        'playbackState/lastUpdatedBy': userId,
        
        // Mettre à jour currentTrack si fourni
        ...(newState.currentTrack && { 'currentTrack': newState.currentTrack }),
        
        // Mettre à jour au niveau room
        'lastUpdated': timestamp,
        'lastUpdatedBy': userId
      };
      
      await update(roomRef, updateData);
      console.log('✅ CrossParty: État room mis à jour avec succès', { stateId, timestamp });
      return { success: true, stateId, timestamp };
    } catch (error) {
      console.error('❌ CrossParty: Erreur mise à jour room:', error);
      return { success: false, error: error.message };
    }
  }

  // Commande pour jouer une piste (remplace updateCurrentTrack)
  async playTrack(roomId, track, userId = 'unknown') {
    return this.updateRoomState(roomId, {
      currentTrack: track,
      isPlaying: true,
      position: typeof track?.position === 'number' ? track.position : 0,
      timestamp: track?.timestamp || Date.now(),
      action: 'PLAY_TRACK'
    }, userId);
  }

  // Commande pour pause
  async pausePlayback(roomId, position = 0, userId = 'unknown') {
    return this.updateRoomState(roomId, {
      isPlaying: false,
      position: position,
      action: 'PAUSE'
    }, userId);
  }

  // Commande pour resume
  async resumePlayback(roomId, position = 0, userId = 'unknown') {
    return this.updateRoomState(roomId, {
      isPlaying: true,
      position: position,
      action: 'RESUME'
    }, userId);
  }

  // Commande pour arrêter complètement
  async stopPlayback(roomId, userId = 'unknown') {
    return this.updateRoomState(roomId, {
      currentTrack: null,
      isPlaying: false,
      position: 0,
      action: 'STOP'
    }, userId);
  }

  // Ajoute une piste à la file d'attente
  async addToQueue(roomId, track) {
    try {
      const queueRef = ref(database, `crossparty/rooms/${roomId}/queue`);
      const queueSnapshot = await get(queueRef);
      
      let queue = [];
      if (queueSnapshot.exists()) {
        queue = Object.values(queueSnapshot.val());
      }

      queue.push({
        ...track,
        addedAt: Date.now(),
        addedBy: 'user' // TODO: Utiliser l'ID utilisateur réel
      });

      await set(queueRef, queue);
      return { success: true };
    } catch (error) {
      console.error('Erreur ajout queue:', error);
      return { success: false, error: 'Erreur d\'ajout à la file' };
    }
  }

  // Met en pause la lecture pour tous les appareils
  // NOTE: Méthode remplacée par la version avec position & userId plus haut
  // (pausePlayback(roomId, position, userId))
  // Cette implémentation simplifiée faisait perdre la position (repartait à 0)
  // et écrasait la bonne méthode à cause d'un doublon de nom. Elle est supprimée.

  // Reprend la lecture pour tous les appareils
  // NOTE: Méthode remplacée par la version avec position & userId plus haut
  // (resumePlayback(roomId, position, userId))
  // Cette implémentation simplifiée ne propageait pas la position et causait
  // une reprise à 0. Elle est supprimée.

  // Ferme un salon (hôte uniquement)
  async closeRoom(roomId, roomCode) {
    try {
      // Marquer le salon comme inactif
      const roomRef = ref(database, `crossparty/rooms/${roomId}`);
      await update(roomRef, { isActive: false });

      // Supprimer la référence du code
      const codeRef = ref(database, `crossparty/codes/${roomCode}`);
      await remove(codeRef);

      // Arrêter d'écouter
      this.stopListeningToRoom(roomId);

      return { success: true };
    } catch (error) {
      console.error('Erreur fermeture salon:', error);
      return { success: false, error: 'Erreur de fermeture' };
    }
  }

  // Quitte un salon (invité uniquement)
  async leaveRoom(roomId, guestId) {
    try {
      const guestRef = ref(database, `crossparty/rooms/${roomId}/guests/${guestId}`);
      await remove(guestRef);

      // Arrêter d'écouter
      this.stopListeningToRoom(roomId);

      return { success: true };
    } catch (error) {
      console.error('Erreur quitter salon:', error);
      return { success: false, error: 'Erreur de déconnexion' };
    }
  }
}

export default new CrossPartyService();