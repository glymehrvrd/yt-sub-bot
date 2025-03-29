import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');

    if (taskId) {
      // Get single task status
      const task = await prisma.task.findUnique({ 
        where: { id: taskId }
      });
      
      if (!task) {
        return NextResponse.json({ err: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(task);
    } else {
      // List all tasks (sorted by creation date, newest first)
      const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      return NextResponse.json(tasks);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { err: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}