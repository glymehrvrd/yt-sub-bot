import { NextRequest } from 'next/server';
import { GET as sseHandler } from '../app/api/tasks/route';
import { PrismaClient } from '@prisma/client';
import { TextDecoder } from 'util';
import { jest } from '@jest/globals';
import { execSync } from 'child_process'; // Import execSync

const prisma = new PrismaClient();
const decoder = new TextDecoder();

describe('SSE Endpoint', () => {
  beforeAll(() => {
    // Ensure the test database schema is applied before tests run
    try {
      console.log('Applying database schema for sse tests...');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('Database schema applied.');
    } catch (error) {
      console.error('Failed to apply database schema:', error);
      throw error; // Fail fast if db setup fails
    }
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
