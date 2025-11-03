// Test côté client pour la fête de dev du 7 novembre
// Ce test simule les actions d'un client CrossParty

import * as Player from './src/api/player.js';

async function testClientActions() {
  console.log('🎉 TEST CÔTÉ CLIENT - FÊTE DE DEV 7 NOV');
  console.log('=======================================');
  
  // Simuler qu'on est un client
  Player.enableCrossParty('test-room-123', 'client-test-user');
  
  console.log('✅ Mode CrossParty activé en tant que client');
  
  // Test des fonctions smart (celles utilisées par l'interface)
  console.log('\n🧪 Test 1: Smart functions pour client');
  
  try {
    // Ces fonctions devraient maintenant bypasser les protections côté client
    console.log('  - Test smartPauseTrack()');
    await Player.smartPauseTrack();
    
    console.log('  - Test smartResumeTrack()');
    await Player.smartResumeTrack();
    
    console.log('✅ Smart functions OK');
  } catch (error) {
    console.error('❌ Erreur smart functions:', error);
  }
  
  console.log('\n🧪 Test 2: Force client action directe');
  try {
    await Player.testClientSync();
    console.log('✅ Force client action OK');
  } catch (error) {
    console.error('❌ Erreur force client:', error);
  }
  
  console.log('\n🧪 Test 3: Debug info');
  const debugInfo = Player.getCrossPartyDebugInfo();
  console.log('Debug info:', {
    userType: debugInfo.userType,
    isInCrossParty: debugInfo.isInCrossPartyMode,
    roomId: debugInfo.crossPartyRoomId,
    userId: debugInfo.crossPartyUserId
  });
  
  console.log('\n🎉 TOUS LES TESTS CLIENT TERMINÉS');
  console.log('Les clients devraient maintenant pouvoir contrôler la musique !');
}

// Lancer les tests
testClientActions();