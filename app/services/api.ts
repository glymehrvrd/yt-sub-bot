import { FileData } from '../types/files';

interface ApiResponse {
  err?: string;
  data?: {
    files?: FileData[];
    taskId?: string;
    task?: any;
  };
}

export async function createSubtitleTask(
  url: string,
  language: string = 'zh',
  needTTS: boolean = false
): Promise<ApiResponse> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      language,
      needTTS,
    }),
  });

  const data = await response.json();
  if (!response.ok || 'err' in data) {
    throw new Error(data.err || 'Network response was not ok');
  }

  return data;
}

export async function getTaskStatus(taskId: string): Promise<ApiResponse> {
  const params = new URLSearchParams({ taskId });
  const response = await fetch(`/api/tasks?${params.toString()}`);

  const data = await response.json();
  if (!response.ok || 'err' in data) {
    throw new Error(data.err || 'Network response was not ok');
  }

  return data;
}

export function setupWebSocket(taskId: string, onUpdate: (data: any) => void) {
  const ws = new WebSocket(`ws://localhost:8080`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.data?.id === taskId) {
      onUpdate(message.data);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  return () => ws.close();
}
