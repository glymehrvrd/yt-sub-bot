import { WebSocketServer } from 'ws';
import { TaskService } from './TaskService';
import { logger } from '../utils';

const log = logger('websocket-server');

export function createWebSocketServer(port: number = 8080) {
  const wss = new WebSocketServer({ port });
  const taskService = new TaskService(wss);

  wss.on('connection', (ws) => {
    log.info('New client connected');
    
    ws.on('close', () => {
      log.info('Client disconnected');
    });
  });

  log.info(`WebSocket server started on port ${port}`);
  return { wss, taskService };
}