import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken } from './auth';
import { User } from '../types';

interface WSClient {
  ws: WebSocket;
  user: User;
}

let wss: WebSocketServer | null = null;
const wsClients = new Map<string, Set<WSClient>>();

export function initWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server, path: '/api/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    // Store user info on the connection
    (ws as any).userId = payload.sub;
    (ws as any).username = payload.username;
    (ws as any).role = payload.role;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch {
        // Ignore invalid messages
      }
    });

    ws.on('close', () => {
      removeClient(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
      removeClient(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', at: Date.now() }));
  });

  console.log('[WebSocket] Server initialized on /api/ws');
}

function handleMessage(ws: WebSocket, message: any): void {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', at: Date.now() }));
      break;
    case 'subscribe':
      // Client can subscribe to specific events
      if (message.channels) {
        (ws as any).subscriptions = message.channels;
      }
      break;
    default:
      // Unknown message type
      break;
  }
}

function removeClient(ws: WebSocket): void {
  const userId = (ws as any).userId;
  if (userId && wsClients.has(userId)) {
    const clients = wsClients.get(userId)!;
    for (const client of clients) {
      if (client.ws === ws) {
        clients.delete(client);
        break;
      }
    }
    if (clients.size === 0) {
      wsClients.delete(userId);
    }
  }
}

export function broadcastUpdate(type: string, data: any): void {
  if (!wss) return;

  const message = JSON.stringify({ type, data, at: Date.now() });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch {
        // Client disconnected
      }
    }
  });
}

export function broadcastToUser(userId: string, type: string, data: any): void {
  if (!wss) return;

  const message = JSON.stringify({ type, data, at: Date.now() });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && (client as any).userId === userId) {
      try {
        client.send(message);
      } catch {
        // Client disconnected
      }
    }
  });
}

export function broadcastToRole(role: string, type: string, data: any): void {
  if (!wss) return;

  const message = JSON.stringify({ type, data, at: Date.now() });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && (client as any).role === role) {
      try {
        client.send(message);
      } catch {
        // Client disconnected
      }
    }
  });
}

export function getConnectedClientsCount(): number {
  return wss ? wss.clients.size : 0;
}