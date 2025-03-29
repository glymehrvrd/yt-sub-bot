import { NextRequest } from 'next/server';
import { GET as sseHandler } from '../app/api/tasks/route';
import { PrismaClient } from '@prisma/client';
import { TextDecoder } from 'util';
import { jest } from '@jest/globals';

const prisma = new PrismaClient();
const decoder = new TextDecoder();

describe('SSE Endpoint', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return SSE response', async () => {
    const request = new NextRequest('http://localhost/api/sse');
    const response = await sseHandler(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('connection')).toBe('keep-alive');
  });

  it('should only send changed tasks', async () => {
    const request = new NextRequest('http://localhost/api/sse');
    const response = await sseHandler(request);
    const reader = response.body?.getReader();

    if (!reader) throw new Error('No reader available');

    // Read initial connection message
    const { value: initialValue } = await reader.read();
    expect(decoder.decode(initialValue)).toContain('event: connected');

    // Mock task changes
    const mockGetTasks = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve([{ id: '1', status: 'PENDING' }]))
      .mockImplementationOnce(() => Promise.resolve([{ id: '1', status: 'COMPLETED' }]))
      .mockImplementationOnce(() => Promise.resolve([{ id: '1', status: 'COMPLETED' }]));

    jest.spyOn(require('../lib/services/TaskService'), 'TaskService').mockImplementation(() => ({
      getTasks: mockGetTasks,
    }));

    // Wait for updates
    jest.advanceTimersByTime(2500);
    await new Promise(process.nextTick);
    const { value: update1 } = await reader.read();
    expect(decoder.decode(update1)).toContain('"status":"COMPLETED"');

    jest.advanceTimersByTime(2500);
    await new Promise(process.nextTick);
    const { value: update2 } = await reader.read();
    expect(update2).toBeUndefined(); // Should not send update when no changes
  });
});