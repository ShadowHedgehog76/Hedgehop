import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './HomeScreen';
import AlbumScreen from './AlbumScreen';

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
    </Stack.Navigator>
  );
}
