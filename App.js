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
import PlayerBar from './src/components/PlayerBar';
import DevBanner from './src/components/DevBanner'; // ✅ banderole dev
import AlbumScreenDisabled from './screens/AlbumScreenDisabled'; // ✅ ajouté ici
import DevScreen from './screens/DevScreen'; // ✅ page dev secrète

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainLayout({ navigation }) {
  const [homeClickCount, setHomeClickCount] = useState(0);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const clickTimeoutRef = useRef(null);



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
