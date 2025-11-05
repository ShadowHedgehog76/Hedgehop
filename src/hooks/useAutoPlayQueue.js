// useAutoPlayQueue.js - Lecture automatique de la piste suivante depuis la queue
import { useEffect, useRef } from 'react';
import { playerEmitter, playTrack } from '../api/player';
import crossPartyService from '../services/crossPartyService';

export const useAutoPlayQueue = (roomId, isHost, queue) => {
  const queueRef = useRef(queue);

  // Mettre à jour la référence de la queue
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Écouter quand une piste finit
  useEffect(() => {
    if (!isHost || !roomId) return;

    const finishSub = playerEmitter.addListener('finish', () => {
      console.log('🎵 Piste terminée, vérification queue...');
      
      // Si la queue a des pistes, jouer la première
      if (queueRef.current && queueRef.current.length > 0) {
        const nextTrack = queueRef.current[0];
        console.log(`🎵 Lecture auto: ${nextTrack.title}`);
        
        // Jouer la piste
        playTrack(nextTrack).catch(err => {
          console.error('❌ Erreur lors de la lecture auto de queue:', err);
        });

        // Supprimer la piste de la queue
        crossPartyService.removeFromQueue(nextTrack.queueId).catch(err => {
          console.error('❌ Erreur lors de la suppression de la queue:', err);
        });
      }
    });

    return () => {
      finishSub.remove();
    };
  }, [isHost, roomId]);
};
