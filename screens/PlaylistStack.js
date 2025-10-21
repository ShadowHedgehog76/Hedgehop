import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PlaylistsScreen from './PlaylistsScreen';
import PlaylistViewScreen from './PlaylistViewScreen';

const Stack = createStackNavigator();

export default function PlaylistStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="PlaylistsMain" component={PlaylistsScreen} />
      <Stack.Screen name="PlaylistView" component={PlaylistViewScreen} />
    </Stack.Navigator>
  );
}
