import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// --- Import des écrans principaux ---
import HomeStack from './screens/HomeStack';
import NewsStack from './screens/NewsStack'; // tout en haut
import FavoritesScreen from './screens/FavoritesScreen';
import PlayerScreen from './screens/PlayerScreen';
import PlayerBar from './src/components/PlayerBar';
import AlbumScreenDisabled from './screens/AlbumScreenDisabled'; // ✅ ajouté ici

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainLayout() {
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
            }
            return <Ionicons name={icon} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Favorites" component={FavoritesScreen} />
        <Tab.Screen name="News" component={NewsStack} />
      </Tab.Navigator>

      <PlayerBar />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainLayout" component={MainLayout} />
        <Stack.Screen name="PlayerScreen" component={PlayerScreen} />

        {/* ✅ ajouté ici, accessible depuis n’importe quel onglet */}
        <Stack.Screen name="AlbumScreenDisabled" component={AlbumScreenDisabled} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
