// useCrossPartySync.js - Hook pour synchroniser la musique dans une room crossparty
import { useEffect, useRef, useCallback } from 'react';
import crossPartyService from '../services/crossPartyService';
import { playerEmitter, getCurrentTrack, getPlaybackStatus, isTrackPlaying, playTrack, pauseTrack, resumeTrack, seekTo } from '../api/player';

export const useCrossPartySyncHost = (roomId, isHost) => {
  const syncIntervalRef = useRef(null);
  const lastSyncTimeRef = useRef(0);
  const lastIsPlayingRef = useRef(null);
  const progressThrottleRef = useRef(0);

  const syncCurrentPlayback = useCallback(async () => {
    if (!isHost || !roomId) return;

    try {
      const currentTrack = getCurrentTrack();
      const playbackStatus = getPlaybackStatus();
      const isPlaying = isTrackPlaying();

      if (!currentTrack) return;

      // Préparer les données de la piste (incluant album)
      const trackData = {
        id: currentTrack.id || currentTrack.trackId,
        title: currentTrack.title || currentTrack.name,
        artist: currentTrack.artist || currentTrack.artistName,
        album: currentTrack.album || currentTrack.albumName,
        duration: playbackStatus?.durationMillis || 0,
        uri: currentTrack.uri || currentTrack.url,
        image: currentTrack.image || currentTrack.albumArt,
      };

      // Sauvegarder l'état de la musique
      const result = await crossPartyService.savePlaybackState(
        trackData,
        isPlaying,
        playbackStatus?.positionMillis || 0
      );

      console.log(`🎵 [HOST SYNC] ${trackData.title}, playing=${isPlaying}, position=${playbackStatus?.positionMillis || 0}ms`);

      if (!result.success) {
        console.warn('Failed to sync playback:', result.error);
      }
    } catch (error) {
      console.error('Error in syncCurrentPlayback:', error);
    }
  }, [isHost, roomId]);

  // Écouter les changements du player
  useEffect(() => {
    if (!isHost || !roomId) return;

    const playSub = playerEmitter.addListener('play', ({ track }) => {
      if (track) {
        // Synchroniser immédiatement au démarrage
        lastIsPlayingRef.current = true;
        syncCurrentPlayback();
      }
    });

    const pauseSub = playerEmitter.addListener('pause', () => {
      // IMPORTANT: Synchroniser IMMÉDIATEMENT quand on met en pause
      // Sans throttle pour s'assurer que l'état est capturé
      lastIsPlayingRef.current = false;
      lastSyncTimeRef.current = 0; // Réinitialiser le throttle
      syncCurrentPlayback();
    });

    const resumeSub = playerEmitter.addListener('resume', () => {
      // IMPORTANT: Synchroniser IMMÉDIATEMENT quand on reprend
      lastIsPlayingRef.current = true;
      lastSyncTimeRef.current = 0; // Réinitialiser le throttle
      syncCurrentPlayback();
    });

    const progressSub = playerEmitter.addListener('progress', () => {
      // Synchroniser périodiquement la progression (avec throttle)
      const now = Date.now();
      if (now - progressThrottleRef.current > 1000) {
        progressThrottleRef.current = now;
        syncCurrentPlayback();
      }
    });

    return () => {
      playSub.remove();
      pauseSub.remove();
      resumeSub.remove();
      progressSub.remove();
    };
  }, [isHost, roomId, syncCurrentPlayback]);

  // Fonction manuelle pour forcer la synchronisation
  const forceSyncNow = useCallback(async () => {
    lastSyncTimeRef.current = 0; // Réinitialiser le throttle
    progressThrottleRef.current = 0;
    return syncCurrentPlayback();
  }, [syncCurrentPlayback]);

  // Ajouter un intervalle de vérification régulière pour s'assurer que isPlaying est toujours à jour
  useEffect(() => {
    if (!isHost || !roomId) return;

    // Vérifier et mettre à jour l'état toutes les 2 secondes
    const interval = setInterval(async () => {
      try {
        const isPlaying = isTrackPlaying();
        // Si l'état n'a pas changé, ne pas synchroniser
        if (isPlaying === lastIsPlayingRef.current) return;
        
        lastIsPlayingRef.current = isPlaying;
        // Forcer la synchronisation si l'état a changé
        await syncCurrentPlayback();
      } catch (error) {
        console.error('Error in periodic isPlaying check:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isHost, roomId, syncCurrentPlayback]);

  return { forceSyncNow, syncCurrentPlayback };
};

export const useCrossPartySyncClient = (roomId, isHost) => {
  const lastPlayedTrackRef = useRef(null);
  const lastStateRef = useRef({ track: null, isPlaying: false, position: 0 });
  const isApplyingSyncRef = useRef(false);
  const syncTimeoutRef = useRef(null);

  // S'abonner aux changements de la room (pour voir la musique synchronisée)
  useEffect(() => {
    if (isHost || !roomId) return;

    const unsubscribe = crossPartyService.subscribeToRoom(roomId, (result) => {
      // Si la room n'existe plus (l'hôte a fermé), déconnecter le guest immédiatement
      if (!result.exists) {
        console.log('🔴 Guest: La room a été fermée par l\'hôte');
        // Nettoyer les refs locales
        lastPlayedTrackRef.current = null;
        lastStateRef.current = { track: null, isPlaying: false, position: 0 };
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        // Émettre l'événement de déconnexion pour notifier toute l'app
        crossPartyService.emitter.emit('roomClosed', { roomId });
        // Forcer la déconnexion complète du service
        crossPartyService.currentRoomId = null;
        crossPartyService.currentUserId = null;
        crossPartyService.isHost = false;
        crossPartyService.emitter.emit('hostStatusChanged', { isHost: false, roomId: null });
        return;
      }

      if (!result.data.currentTrack) return;

      const roomTrack = result.data.currentTrack;
      const roomIsPlaying = result.data.isPlaying || false;
      const roomPosition = result.data.currentTrack?.currentPosition || 0;

      console.log(`🔍 [FIREBASE UPDATE] track=${roomTrack.title}, isPlaying=${roomIsPlaying}, position=${roomPosition}ms`);

      // Éviter les mises à jour infinies
      if (isApplyingSyncRef.current) {
        return;
      }

      try {
        isApplyingSyncRef.current = true;

        const currentTrack = lastPlayedTrackRef.current;
        const lastState = lastStateRef.current;

        // Vérifier si la piste a changé (utiliser l'URI/URL comme identifiant unique)
        const roomTrackUri = roomTrack.uri || roomTrack.url;
        const currentTrackUri = currentTrack?.uri || currentTrack?.url;
        
        // Aussi vérifier si on joue déjà cette piste localement
        const currentlyPlayingTrack = getCurrentTrack();
        const currentlyPlayingUri = currentlyPlayingTrack?.uri || currentlyPlayingTrack?.url;
        
        const trackChanged = !currentTrack || currentTrackUri !== roomTrackUri;
        const alreadyPlayingThisTrack = currentlyPlayingUri === roomTrackUri;

        if (trackChanged && !alreadyPlayingThisTrack) {
          console.log(`🎵 Client: Nouvelle piste du host: ${roomTrack.title} (URI: ${roomTrackUri})`);
          lastPlayedTrackRef.current = roomTrack;
          
          // Lancer la nouvelle piste avec les infos du host
          // Convertir uri en url si nécessaire
          const trackToPlay = {
            ...roomTrack,
            url: roomTrack.uri || roomTrack.url,
            uri: roomTrack.uri || roomTrack.url,
          };
          
          console.log(`🎵 Client: Nouvelle piste ${trackToPlay.title}, shouldPlay: ${roomIsPlaying}`);
          
          // IMPORTANT: Vérifier l'état du host AVANT de lancer la piste
          if (roomIsPlaying) {
            // Le host joue, donc on lance la piste
            console.log(`🎵 Client: Host joue, lancement de la piste`);
            playTrack(trackToPlay, null).catch(err => {
              console.error('❌ Erreur lors du lancement de la piste:', err);
            });
            lastStateRef.current = { track: roomTrack, isPlaying: true, position: roomPosition };
            console.log(`🎵 [NEW TRACK LOADED] lastStateRef.isPlaying initialisé à: true`);
            
            // Attendre que le son se charge pour synchroniser la position
            // Réduire le délai à 400ms au lieu de 800ms pour éviter les coupures
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = setTimeout(async () => {
              try {
                const playbackStatus = getPlaybackStatus();
                const currentPosition = playbackStatus?.positionMillis || 0;
                const positionDiff = Math.abs(roomPosition - currentPosition);

                console.log(`🎵 [LOAD SYNC] room=${roomPosition}ms, current=${currentPosition}ms, diff=${positionDiff}ms`);
                // Les guests ne se synchronisent pas sur la position, juste sur la piste et le play/pause
              } catch (err) {
                console.warn('⚠️ Erreur lors de la vérification:', err);
              }
            }, 400);
          } else {
            // Le host est en pause, ne pas lancer la piste, la charger seulement
            console.log(`🎵 Client: Host est en pause, chargement sans lecture`);
            // Dans ce cas, on change le track dans le state local mais sans le jouer
            // Le guest sera en pause sur cette piste et pourra la jouer manuellement ou attendre que le host la lance
            lastStateRef.current = { track: roomTrack, isPlaying: false, position: roomPosition };
            console.log(`🎵 [NEW TRACK PAUSED] lastStateRef.isPlaying initialisé à: false`);
            // Optionnel: charger la piste en arrière-plan si disponible
            // Pour maintenant on attend juste que l'état change
          }
        } else {
          // Même piste ou déjà en train de la jouer
          if (alreadyPlayingThisTrack && !lastPlayedTrackRef.current) {
            // On joue déjà cette piste mais le hook vient de démarrer
            console.log(`🎵 Client: Déjà en train de jouer: ${roomTrack.title}`);
            lastPlayedTrackRef.current = roomTrack;
            lastStateRef.current = { track: roomTrack, isPlaying: isTrackPlaying(), position: roomPosition };
          }

          console.log(`🔄 [STATE COMPARISON] lastState.isPlaying=${lastState.isPlaying}, roomIsPlaying=${roomIsPlaying}, willChange=${lastState.isPlaying !== roomIsPlaying}`);

          // Vérifier l'état de lecture
          if (lastState.isPlaying !== roomIsPlaying) {
            console.log(`🔄 État play/pause changé: ${lastState.isPlaying} → ${roomIsPlaying}`);
            
            if (roomIsPlaying && !lastState.isPlaying) {
              console.log(`🎵 [PLAY ACTION] Résumé: lastState=${lastState.isPlaying}, room=${roomIsPlaying}`);
              resumeTrack().catch(err => console.warn('⚠️ Resume failed:', err));
            } else if (!roomIsPlaying && lastState.isPlaying) {
              console.log(`⏸️ [PAUSE ACTION] Pause: lastState=${lastState.isPlaying}, room=${roomIsPlaying}`);
              pauseTrack().catch(err => console.warn('⚠️ Pause failed:', err));
            }
            
            lastStateRef.current.isPlaying = roomIsPlaying;
          } else {
            console.log(`🔄 [NO STATE CHANGE] lastState=${lastState.isPlaying}, room=${roomIsPlaying}`);
          }
          
          // Vérifier si le position a changé significativement (seek)
          const positionDiff = Math.abs((lastState.position || 0) - roomPosition);
          console.log(`🎵 [SYNC DEBUG] Position: local=${lastState.position}ms, room=${roomPosition}ms, diff=${positionDiff}ms`);
          
          // Les guests se synchronisent seulement si y'a un gros écart (> 12 secondes)
          if (positionDiff > 12000) {
            console.log(`⚠️ [LARGE POSITION DISCREPANCY] Seeking from ${lastState.position}ms to ${roomPosition}ms (diff: ${positionDiff}ms)`);
            seekTo(roomPosition);
          }
          
          lastStateRef.current.position = roomPosition;
        }
      } finally {
        isApplyingSyncRef.current = false;
      }
    });

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      unsubscribe();
    };
  }, [isHost, roomId]);

  return {};
};
