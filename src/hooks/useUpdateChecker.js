import { useEffect, useState, useRef } from 'react';
import Constants from 'expo-constants';
import { APP_VERSION } from '../config/version';

const GITHUB_REPO = 'ShadowHedgehog76/Hedgehop';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Fonction pour comparer les versions sémantiques (ex: 1.0.0 vs 1.0.1)
const compareVersions = (versionA, versionB) => {
  const partsA = versionA.split('.').map(Number);
  const partsB = versionB.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;

    if (partA > partB) {
      return 1;  // versionA est plus récente
    }
    if (partA < partB) {
      return -1; // versionB est plus récente
    }
  }

  return 0; // versions identiques
};

export const useUpdateChecker = (onUpdateAvailable) => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const isNotificationShownRef = useRef(false);
  const callbackRef = useRef(onUpdateAvailable);

  // Mettre à jour le callback sans relancer l'effect
  useEffect(() => {
    callbackRef.current = onUpdateAvailable;
  }, [onUpdateAvailable]);

  useEffect(() => {
    console.log(`🚀 App started - checking for updates immediately`);
    
    // Réinitialiser le flag de notification au démarrage
    isNotificationShownRef.current = false;
    
    // Fonction pour vérifier les mises à jour
    const checkForUpdates = async () => {
      try {
        console.log(`🔍 Checking for updates...`);
        setError(null);

        const response = await fetch(GITHUB_API_URL, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`⚠️  No releases found on GitHub (404)`);
            setUpdateInfo(null);
            return;
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Vérifier que les données sont valides
        if (!data.name) {
          console.warn(`⚠️  Invalid release data (no name field)`);
          setUpdateInfo(null);
          return;
        }

        // Extraire la version du titre (ex: V1.0.2 -> 1.0.2)
        const latestVersion = data.name.replace(/^[vV]/, '');
        const currentVersion = APP_VERSION;

        console.log(`📦 GitHub release name: "${data.name}"`);
        console.log(`📦 Extracted version: "${latestVersion}"`);
        console.log(`📦 Current app version: "${currentVersion}"`);

        // Valider que la version est un format valide (X.X.X)
        if (!/^\d+\.\d+\.\d+$/.test(latestVersion)) {
          console.warn(`⚠️  Invalid version format: ${latestVersion}`);
          setUpdateInfo(null);
          return;
        }

        // Comparer les versions
        const versionComparison = compareVersions(latestVersion, currentVersion);
        
        console.log(`📊 Comparing: ${latestVersion} vs ${currentVersion} = ${versionComparison}`);
        
        if (versionComparison > 0) {
          // latestVersion > currentVersion : nouvelle update disponible
          console.log(`✅ UPDATE AVAILABLE: ${latestVersion} > ${currentVersion}`);
          const info = {
            latestVersion,
            currentVersion,
            downloadUrl: data.html_url,
            releaseNotes: data.body || 'Check GitHub for release notes',
            publishedAt: data.published_at,
          };

          setUpdateInfo(info);
          
          // Si aucune notification n'est affichée, afficher celle-ci
          if (!isNotificationShownRef.current) {
            console.log(`🎯 Showing update notification`);
            isNotificationShownRef.current = true;
            
            // Appeler le callback si fourni
            if (callbackRef.current) {
              callbackRef.current(info);
            }
          }
        } else {
          console.log(`ℹ️  No update: ${latestVersion} <= ${currentVersion}`);
          setUpdateInfo(null);
          isNotificationShownRef.current = false;
        }
      } catch (err) {
        console.error('❌ Error checking for updates:', err);
        setError(err.message);
        setUpdateInfo(null);
      }
    };

    // Faire un premier check immédiatement
    checkForUpdates();

    // Puis vérifier toutes les 10 secondes
    intervalRef.current = setInterval(() => {
      checkForUpdates();
    }, 10000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []); // Dépendances vides pour ne s'exécuter qu'une seule fois

  return {
    isChecking,
    updateInfo,
    error,
    hasUpdate: updateInfo !== null,
  };
};
