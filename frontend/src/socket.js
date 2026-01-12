'use strict';
import { io } from 'socket.io-client';

export function connectSocket({ userId, teamIds }) {
  const socket = io('/', {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { userId, teamIds },
  });
  return socket;
}

