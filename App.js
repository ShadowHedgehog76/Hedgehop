import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// --- Import des écrans principaux ---
import HomeStack from './screens/HomeStack';
import NewsStack from './screens/NewsStack'; // tout en haut
import FavoritesScreen from './screens/FavoritesScreen';
import StatsScreen from './screens/StatsScreen'; // ✅ écran des statistiques
import PlayerScreen from './screens/PlayerScreen';
import YouStack from './screens/YouStack'; // ✅ pile You + Playlists
import PlayerBar from './src/components/PlayerBar';
import DevBanner from './src/components/DevBanner'; // ✅ banderole dev
import AlbumScreenDisabled from './screens/AlbumScreenDisabled'; // ✅ ajouté ici
import DevScreen from './screens/DevScreen'; // ✅ page dev secrète

// (CrossParty supprimé)

// --- Import des composants tablette ---
import TabletLayout from './src/components/TabletLayout';
import { useDeviceType } from './src/hooks/useDeviceType';
import { stopAllAudio } from './src/api/player';

// --- Import des services et hooks ---
import authService from './src/services/auth';
import { loadFavorites } from './src/api/favorites';
import { AlertProvider } from './src/components/CustomAlert';
import { useCrossPartySyncHost, useCrossPartySyncClient } from './src/hooks/useCrossPartySync';
import crossPartyService from './src/services/crossPartyService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Composant pour gérer la synchronisation en arrière-plan
function BackgroundSyncProvider({ children }) {
  const [roomInfo, setRoomInfo] = useState({ roomId: null, isHost: false });

  // Mettre à jour roomInfo et relancer les hooks si la room change
  useEffect(() => {
    const unsubscribe = crossPartyService.subscribeToHostStatusChanges((data) => {
      console.log('🔄 BackgroundSyncProvider: Mise à jour room:', data);
      setRoomInfo({ 
        roomId: data.roomId, 
        isHost: data.isHost 
      });
    });

    // Initialisation
    const info = crossPartyService.getCurrentRoomInfo();
    setRoomInfo({ 
      roomId: info.roomId, 
      isHost: info.isHost 
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe.remove();
    };
  }, []);

  // Surveiller la disparition de la room même si on n'est pas sur PartyRoomScreen
  // Cela garantit que les guests sont notifiés quand le host ferme la room
  useEffect(() => {
    if (!roomInfo.roomId || roomInfo.isHost) {
      // On ne surveille que si c'est un guest (isHost = false)
      return;
    }

    console.log('👁️ BackgroundSyncProvider: Surveillance de la room pour les guests');
    
    const unsubscribeRoom = crossPartyService.subscribeToRoom(roomInfo.roomId, (result) => {
      // Si la room n'existe plus, le guest a été déconnecté
      if (!result.exists) {
        console.log('🔴 BackgroundSyncProvider: La room a fermé, déconnexion du guest');
        // Forcer la déconnexion complète
        crossPartyService.currentRoomId = null;
        crossPartyService.currentUserId = null;
        crossPartyService.isHost = false;
        // Émettre l'événement pour forcer la mise à jour
        crossPartyService.emitter.emit('hostStatusChanged', { isHost: false, roomId: null });
        // Mettre à jour le state local
        setRoomInfo({ roomId: null, isHost: false });
      }
    });

    return () => {
      if (typeof unsubscribeRoom === 'function') unsubscribeRoom();
    };
  }, [roomInfo.roomId, roomInfo.isHost]);

  // Activer les hooks de synchronisation si dans une room
  useCrossPartySyncHost(roomInfo.roomId, roomInfo.isHost);
  useCrossPartySyncClient(roomInfo.roomId, roomInfo.isHost);

  return children;
}

function MainLayout({ navigation }) {
  const [homeClickCount, setHomeClickCount] = useState(0);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const clickTimeoutRef = useRef(null);
  
  const { isTablet, isLandscape } = useDeviceType();



  // Initialisation audio et écouter les événements pour désactiver le mode dev
  useEffect(() => {
    // Arrêter toutes les instances audio au démarrage
    stopAllAudio().then(() => {
      console.log('🎵 Audio initialisé - toutes les instances précédentes arrêtées');
    }).catch((error) => {
      console.warn('⚠️ Erreur initialisation audio:', error);
    });

    const unsubscribe = navigation.addListener('state', (e) => {
      // Cette approche pourrait être améliorée avec un context ou AsyncStorage
    });

    return unsubscribe;
  }, [navigation]);

  const handleHomeTabPress = () => {
    const newCount = homeClickCount + 1;
    setHomeClickCount(newCount);

    // Reset du compteur après 3 secondes d'inactivité
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setHomeClickCount(0);
    }, 500);

    // Vérifier si on a atteint 10 clics
    if (newCount === 10) {
      setHomeClickCount(0);
      setDevModeEnabled(true);
    } else if (newCount >= 5) {
      // Feedback visuel quand on approche des 10 clics
      console.log(`🔥 ${10 - newCount} clics restants pour le dev mode...`);
    }
  };

  // Fonction pour gérer le changement d'onglet en mode tablette
  const handleTabletTabPress = (tabName) => {
    if (tabName === 'Home') {
      handleHomeTabPress();
    }
    setActiveTab(tabName);
  };

  // Rendu du contenu selon l'onglet actif (mode tablette)
  const renderTabletContent = () => {
    // Cloner l'objet navigation pour ajouter la méthode navigate pour CrossParty
    const tabletNavigation = {
      ...navigation,
      navigate: (screenName, params) => {
        // Pour les écrans CrossParty, utiliser le vrai navigation du Stack
        if (screenName.startsWith('CrossParty')) {
          navigation.navigate(screenName, params);
          return;
        }
        // Sinon, on commute les onglets
        setActiveTab(screenName);
      }
    };

    switch (activeTab) {
      case 'Home':
        return <HomeStack navigation={tabletNavigation} />;
      case 'Favorites':
        return <FavoritesScreen navigation={tabletNavigation} />;
      case 'News':
        return <NewsStack navigation={tabletNavigation} />;
      case 'Stats':
        return <StatsScreen navigation={tabletNavigation} />;
      case 'Player':
        return <PlayerScreen navigation={tabletNavigation} />;
      case 'You':
        return <YouStack />;
      case 'Dev':
        return <DevScreen 
          navigation={tabletNavigation} 
          onDisableDevMode={() => setDevModeEnabled(false)} 
        />;
      default:
        return <HomeStack navigation={tabletNavigation} />;
    }
  };

  if (isTablet) {
    // Mode Tablette avec Sidebar Navigation
    return (
      <View style={{ flex: 1 }}>
        <TabletLayout
          activeTab={activeTab}
          onTabPress={handleTabletTabPress}
          devModeEnabled={devModeEnabled}
          onDisableDevMode={() => setDevModeEnabled(false)}
          isLandscape={isLandscape}
          navigation={navigation}
        >
          {renderTabletContent()}
        </TabletLayout>
        
        {/* Banderole de développement */}
        {devModeEnabled && <DevBanner />}
      </View>
    );
  }

  // Mode Téléphone avec Bottom Tabs (existant)
  return (
    <View style={{ flex: 1 }}>
      
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0a0a0a',
            borderTopColor: '#222',
            height: 60,
            radius: 60,
          },

          tabBarActiveTintColor: '#1f4cff',
          tabBarInactiveTintColor: '#aaa',
          tabBarIcon: ({ color, size }) => {
            let icon;
            switch (route.name) {
              case 'Home':
                icon = 'home';
                break;
              case 'Favorites':
                icon = 'heart';
                break;
              case 'News':
                icon = 'time';
                break;
              case 'Stats':
                icon = 'stats-chart';
                break;
              case 'You':
                icon = 'person';
                break;
              case 'Dev':
                icon = 'code-working';
                break;
            }
            return <Ionicons name={icon} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeStack} 
          listeners={{
            tabPress: (e) => {
              handleHomeTabPress();
            },
          }}
        />
        <Tab.Screen name="Favorites" component={FavoritesScreen} />
        <Tab.Screen name="News" component={NewsStack} />
        <Tab.Screen name="Stats" component={StatsScreen} />
  <Tab.Screen name="You" component={YouStack} />
        {devModeEnabled && (
          <Tab.Screen name="Dev">
            {(props) => (
              <DevScreen 
                {...props} 
                onDisableDevMode={() => {
                  setDevModeEnabled(false);
                }} 
              />
            )}
          </Tab.Screen>
        )}
      </Tab.Navigator>
      
      <PlayerBar />
      
      {/* ✅ Banderole de développement - positionnée en overlay */}
      {devModeEnabled && <DevBanner />}
    </View>
  );
}

function AppContent() {
  // Écouter les changements d'état d'authentification
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      if (user) {
        // Utilisateur connecté : charger les favoris du cloud
        console.log('Utilisateur connecté, chargement des favoris...');
        loadFavorites();
      } else {
        // Utilisateur déconnecté : charger les favoris locaux
        console.log('Utilisateur déconnecté, chargement des favoris locaux...');
        loadFavorites();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <BackgroundSyncProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainLayout" component={MainLayout} />
          <Stack.Screen name="PlayerScreen" component={PlayerScreen} />

          {/* ✅ ajouté ici, accessible depuis n'importe quel onglet */}
          <Stack.Screen name="AlbumScreenDisabled" component={AlbumScreenDisabled} />
          <Stack.Screen name="DevScreen" component={DevScreen} />
          {/* CrossParty supprimé */}
        </Stack.Navigator>
      </NavigationContainer>
    </BackgroundSyncProvider>
  );
}

export default function App() {
  return (
    <AlertProvider>
      <AppContent />
    </AlertProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
