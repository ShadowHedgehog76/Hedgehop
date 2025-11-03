import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

export const useDeviceType = () => {
  const [deviceType, setDeviceType] = useState('phone');
  const [orientation, setOrientation] = useState('portrait');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      
      const { width, height } = window;
      const isLandscape = width > height;
      
      // Détection du type d'appareil basée sur les dimensions
      const minDimension = Math.min(width, height);
      const maxDimension = Math.max(width, height);
      
      let type = 'phone';
      
      // Critères pour tablette : 
      // - Dimension minimale > 600px (tablettes 7")
      // - OU dimension maximale > 900px (tablettes en portrait)
      if (minDimension >= 600 || maxDimension >= 900) {
        type = 'tablet';
      }
      
      setDeviceType(type);
      setOrientation(isLandscape ? 'landscape' : 'portrait');
    });

    // Vérification initiale
    const { width, height } = dimensions;
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);
    
    if (minDimension >= 600 || maxDimension >= 900) {
      setDeviceType('tablet');
    }
    
    setOrientation(width > height ? 'landscape' : 'portrait');

    return () => subscription?.remove();
  }, []);

  const isTablet = deviceType === 'tablet';
  const isPhone = deviceType === 'phone';
  const isLandscape = orientation === 'landscape';
  const isPortrait = orientation === 'portrait';

  // Tailles responsive
  const getResponsiveValue = (phoneValue, tabletValue) => {
    return isTablet ? tabletValue : phoneValue;
  };

  // Nombre de colonnes pour les grilles
  const getGridColumns = () => {
    if (isTablet) {
      return isLandscape ? 5 : 4;
    }
    return 2; // Pour téléphone (utilisé seulement pour NewsScreen)
  };

  // Largeur des cartes d'albums
  const getCardWidth = () => {
    const { width } = dimensions;
    
    if (isTablet) {
      // Pour tablette : taille fixe optimale pour scroll horizontal
      return Math.min(width * 0.25, 200); // ~25% de la largeur d'écran, max 200px
    } else {
      // Pour téléphone : taille fixe optimale pour scroll horizontal
      return Math.min(width * 0.42, 150); // ~42% de la largeur d'écran, max 150px
    }
  };

  return {
    deviceType,
    orientation,
    dimensions,
    isTablet,
    isPhone,
    isLandscape,
    isPortrait,
    getResponsiveValue,
    getGridColumns,
    getCardWidth,
  };
};