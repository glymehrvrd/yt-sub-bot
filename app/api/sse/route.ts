import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  });

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Send initial connection message
  writer.write(new TextEncoder().encode('event: connected\ndata: {}\n\n'));

  // Set up polling to send updates
  const interval = setInterval(async () => {
    const tasks = await prisma.task.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
    writer.write(new TextEncoder().encode(`event: update\ndata: ${JSON.stringify(tasks)}\n\n`));
  }, 2000); // Update every 2 seconds

  // Clean up on client disconnect
  request.signal.onabort = () => {
    clearInterval(interval);
    writer.close();
  };

  return new Response(stream.readable, { headers });
}