import { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { trackScreenView } from '../services/analytics';

/**
 * Hook pour tracker les vues d'écran
 * @param {string} screenName - Nom de l'écran à tracker
 * @example
 * useAnalyticsTracking('PlayerScreen');
 */
export const useAnalyticsTracking = (screenName) => {
  useFocusEffect(() => {
    if (screenName) {
      trackScreenView(screenName);
      console.log(`📊 Analytics: ${screenName}`);
    }
  });
};

export default useAnalyticsTracking;
