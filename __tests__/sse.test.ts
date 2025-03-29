import { NextRequest } from 'next/server';
import { GET as sseHandler } from '../app/api/sse/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('SSE Endpoint', () => {
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