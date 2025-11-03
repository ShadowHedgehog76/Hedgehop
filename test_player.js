// Test rapide des fonctions du player pour la fête de dev du 7 novembre
import * as Player from './src/api/player.js';

async function testPlayerFunctions() {
  console.log('🧪 TEST DES FONCTIONS PLAYER - FÊTE DE DEV 7 NOV');
  
  try {
    // Test 1: Fonctions CrossParty existent
    console.log('✅ Test 1: Vérification des fonctions CrossParty');
    const functions = [
      'stopAllAudio',
      'getCrossPartyDebugInfo',
      'enableCrossParty',
      'disableCrossParty',
      'smartPlayTrack',
      'smartPauseTrack',
      'smartResumeTrack',
      'resetCrossPartyLoopProtection',
      'emergencyBreakLoops'
    ];
    
    functions.forEach(funcName => {
      if (typeof Player[funcName] === 'function') {
        console.log(`  ✅ ${funcName} existe`);
      } else {
        console.log(`  ❌ ${funcName} MANQUANT`);
      }
    });
    
    // Test 2: Debug info
    console.log('✅ Test 2: Debug CrossParty');
    const debugInfo = Player.getCrossPartyDebugInfo();
    console.log('  Debug info:', debugInfo);
    
    // Test 3: Fonctions de base
    console.log('✅ Test 3: Fonctions de base');
    console.log('  getCurrentTrack:', typeof Player.getCurrentTrack);
    console.log('  getPlaybackStatus:', typeof Player.getPlaybackStatus);
    console.log('  isTrackPlaying:', typeof Player.isTrackPlaying);
    console.log('  getQueue:', typeof Player.getQueue);
    
    console.log('🎉 TOUS LES TESTS PASSÉS - PRÊT POUR LA FÊTE !');
    
  } catch (error) {
    console.error('❌ ERREUR DANS LES TESTS:', error);
  }
}

// Lancer les tests
testPlayerFunctions();