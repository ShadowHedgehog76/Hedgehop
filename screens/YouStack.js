import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import YouScreen from './YouScreen';
import PlaylistsScreen from './PlaylistsScreen';
import PlaylistDetailScreen from './PlaylistDetailScreen';
import HelpSupportScreen from './HelpSupportScreen';
import DonationScreen from './DonationScreen';

const Stack = createStackNavigator();

export default function YouStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="YouMain" component={YouScreen} />
      <Stack.Screen name="Playlists" component={PlaylistsScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="Donation" component={DonationScreen} />
    </Stack.Navigator>
  );
}
