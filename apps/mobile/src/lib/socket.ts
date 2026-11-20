import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from './auth.store.js';

class MobileSocketManager {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;

  connect(url: string = 'http://localhost:4000'): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const { accessToken, tenantId } = useAuthStore.getState();

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      auth: {
        token: accessToken,
        tenantId,
      },
    });

    this.socket.on('connect', () => {
      if (this.currentRoom) {
        this.socket?.emit('room:join', { roomId: this.currentRoom });
      }
    });

    return this.socket;
  }

  joinRoom(roomId: string): void {
    this.currentRoom = roomId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('room:join', { roomId });
    }
  }

  leaveRoom(roomId: string): void {
    if (this.currentRoom === roomId) {
      this.currentRoom = null;
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit('room:leave', { roomId });
    }
  }

  sendMessage(roomId: string, message: { text: string; isInternal?: boolean }): void {
    if (!this.socket) return;
    const { user, tenantId } = useAuthStore.getState();
    this.socket.emit('chat:message', {
      roomId,
      tenantId,
      senderId: user?.id,
      senderName: user?.name,
      senderType: 'AGENT',
      text: message.text,
      isInternal: message.isInternal,
      timestamp: Date.now(),
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  setSocketForTesting(socket: any): void {
    this.socket = socket;
  }
}

export const mobileSocketManager = new MobileSocketManager();
