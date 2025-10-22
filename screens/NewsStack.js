// screens/NewsStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import NewsScreen from './NewsScreen';
import AlbumScreenDisabled from './AlbumScreenDisabled';
import AlbumScreen from './AlbumScreen';

const Stack = createStackNavigator();

export default function NewsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="NewsMain" component={NewsScreen} />
      <Stack.Screen name="AlbumScreenDisabled" component={AlbumScreenDisabled} />
      <Stack.Screen name="AlbumScreen" component={AlbumScreen} />
    </Stack.Navigator>
  );
}
