import React, { createContext, useState, useCallback } from 'react';
import { EventEmitter } from 'fbemitter';

export const NavigationContext = createContext();

// Créer un event emitter global pour la navigation
const navigationEmitter = new EventEmitter();

export function NavigationProvider({ children }) {
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const navigateToPartyRoom = useCallback((roomId) => {
    console.log('🎯 NavigationContext: Émission événement navigateToPartyRoom:', roomId);
    // Émettre l'événement pour que tous les listeners se synchronisent
    navigationEmitter.emit('navigateToPartyRoom', roomId);
    
    // Aussi mettre le state comme fallback
    setPendingNavigation({ screen: 'PartyRoom', roomId });
  }, []);

  const clearPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  // Fonction pour écouter les événements de navigation
  const onNavigateToPartyRoom = useCallback((callback) => {
    console.log('🎯 NavigationContext: Ajout listener navigateToPartyRoom');
    return navigationEmitter.addListener('navigateToPartyRoom', callback);
  }, []);

  return (
    <NavigationContext.Provider value={{ 
      pendingNavigation, 
      navigateToPartyRoom, 
      clearPendingNavigation,
      onNavigateToPartyRoom
    }}>
      {children}
    </NavigationContext.Provider>
  );
}


