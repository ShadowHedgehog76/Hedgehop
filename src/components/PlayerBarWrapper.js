import React from 'react';
import { useNavigation } from '@react-navigation/native';
import PlayerBar from './PlayerBar';

export default function PlayerBarWrapper() {
  const navigation = useNavigation();
  return <PlayerBar navigation={navigation} />;
}
