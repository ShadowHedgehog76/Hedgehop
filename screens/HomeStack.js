import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './HomeScreen';
import AlbumScreen from './AlbumScreen';
import AlbumScreenDisabled from './AlbumScreenDisabled';
import PlaylistDetailScreen from './PlaylistDetailScreen';

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card', // tu peux changer en 'modal' pour un effet vertical
        animationEnabled: true, // transition fluide
        gestureEnabled: true,
      }}
    >
      {/* 🏠 Écran principal (accueil) */}
      <Stack.Screen name="HomeMain" component={HomeScreen} />

      {/* 💿 Écran d’album */}
      <Stack.Screen
        name="Album"
        component={AlbumScreen}
        options={{
          animationTypeForReplace: 'push',
          gestureDirection: 'horizontal',
        }}
      />

      <Stack.Screen
        name="AlbumScreenDisabled"
        component={AlbumScreenDisabled}
        options={{
          animationTypeForReplace: 'push',
          gestureDirection: 'horizontal',
        }}
      />
      <Stack.Screen
        name="PlaylistDetail"
        component={PlaylistDetailScreen}
        options={{
          animationTypeForReplace: 'push',
          gestureDirection: 'horizontal',
        }}
      />
    </Stack.Navigator>
  );
}
