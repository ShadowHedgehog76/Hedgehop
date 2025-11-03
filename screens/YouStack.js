import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import YouScreen from './YouScreen';
import PlaylistsScreen from './PlaylistsScreen';
import PlaylistDetailScreen from './PlaylistDetailScreen';

const Stack = createStackNavigator();

export default function YouStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="YouMain" component={YouScreen} />
      <Stack.Screen name="Playlists" component={PlaylistsScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    </Stack.Navigator>
  );
}
