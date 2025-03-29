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
});
