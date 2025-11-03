import React, { createContext, useContext, useState } from 'react';

export const CrossPartyContext = createContext();

export const useCrossParty = () => {
  const context = useContext(CrossPartyContext);
  if (!context) {
    throw new Error('useCrossParty must be used within a CrossPartyProvider');
  }
  return context;
};

export const CrossPartyProvider = ({ children }) => {
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [guestId, setGuestId] = useState(null);

  const joinRoom = (id, code, hostStatus = false, guest_Id = null) => {
    setRoomId(id);
    setRoomCode(code);
    setIsHost(hostStatus);
    setGuestId(guest_Id);
  };

  const leaveRoom = () => {
    setRoomId(null);
    setRoomCode(null);
    setIsHost(false);
    setGuestId(null);
  };

  const isInRoom = () => {
    return roomId !== null;
  };

  const value = {
    roomId,
    roomCode,
    isHost,
    guestId,
    joinRoom,
    leaveRoom,
    isInRoom,
  };

  return (
    <CrossPartyContext.Provider value={value}>
      {children}
    </CrossPartyContext.Provider>
  );
};