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
import YouScreen from './screens/YouScreen'; // ✅ écran profil/paramètres
import PlayerBar from './src/components/PlayerBar';
import DevBanner from './src/components/DevBanner'; // ✅ banderole dev
import AlbumScreenDisabled from './screens/AlbumScreenDisabled'; // ✅ ajouté ici
import DevScreen from './screens/DevScreen'; // ✅ page dev secrète

// --- Import des composants tablette ---
import TabletLayout from './src/components/TabletLayout';
import { useDeviceType } from './src/hooks/useDeviceType';

// --- Import des services ---
import authService from './src/services/auth';
import { loadFavorites } from './src/api/favorites';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainLayout({ navigation }) {
  const [homeClickCount, setHomeClickCount] = useState(0);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const clickTimeoutRef = useRef(null);
  
  const { isTablet, isLandscape } = useDeviceType();



  // Écouter les événements pour désactiver le mode dev
  useEffect(() => {
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
    }, 3000);

    // Vérifier si on a atteint 15 clics
    if (newCount === 15) {
      setHomeClickCount(0);
      setDevModeEnabled(true);
    } else if (newCount >= 10) {
      // Feedback visuel quand on approche des 15 clics
      console.log(`🔥 ${15 - newCount} clics restants pour le dev mode...`);
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
    switch (activeTab) {
      case 'Home':
        return <HomeStack navigation={navigation} />;
      case 'Favorites':
        return <FavoritesScreen navigation={navigation} />;
      case 'News':
        return <NewsStack navigation={navigation} />;
      case 'Stats':
        return <StatsScreen navigation={navigation} />;
      case 'Player':
        return <PlayerScreen navigation={navigation} />;
      case 'You':
        return <YouScreen navigation={navigation} />;
      case 'Dev':
        return <DevScreen 
          navigation={navigation} 
          onDisableDevMode={() => setDevModeEnabled(false)} 
        />;
      default:
        return <HomeStack navigation={navigation} />;
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
        <Tab.Screen name="You" component={YouScreen} />
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

export default function App() {
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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainLayout" component={MainLayout} />
        <Stack.Screen name="PlayerScreen" component={PlayerScreen} />

        {/* ✅ ajouté ici, accessible depuis n'importe quel onglet */}
        <Stack.Screen name="AlbumScreenDisabled" component={AlbumScreenDisabled} />
        <Stack.Screen name="DevScreen" component={DevScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
