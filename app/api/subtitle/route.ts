import { NextRequest, NextResponse } from 'next/server';
import { SubtitleManager } from '@/lib/subtitle-manager';
import fs from 'fs/promises';
import path from 'path';
import { TaskService } from '@/lib/services/TaskService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const taskService = new TaskService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, language = 'zh', tts = false } = body;

    if (!url) {
      return NextResponse.json({ err: 'URL is required' }, { status: 400 });
    }

    const cookiePath = path.join(process.cwd(), 'www.youtube.com_cookies.txt');
    const cookieContents = await fs.readFile(cookiePath, 'utf-8');

    // Create new task
    const task = await taskService.createTask(url, language);
    
    // Process task in background
    processTask(task.id, url, language, tts, cookieContents);

    return NextResponse.json({ taskId: task.id });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { err: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');

    if (taskId) {
      // Get single task status
      const task = await taskService.getTask(taskId);
      if (!task) {
        return NextResponse.json({ err: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ task });
    } else {
      // List all tasks (sorted by creation date, newest first)
      const tasks = await prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20 // Limit to 20 most recent tasks
      });
      return NextResponse.json({ tasks });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { err: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processTask(
  taskId: string, 
  url: string, 
  language: string, 
  tts: boolean,
  cookieContents: string
) {
  const subtitleManager = new SubtitleManager(undefined, undefined, taskService);
  
  try {
    const subtitle = await subtitleManager.get({
      url,
      language,
      tts,
      cookieContents,
      taskId
    });

    console.log('Task completed successfully:', taskId);
  } catch (error) {
    console.error('Task failed:', taskId, error);
  }
}
