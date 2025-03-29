import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/services/TaskService';
import { SubtitleManager } from '@/lib/subtitle-manager';
import fs from 'fs/promises';
import path from 'path';
import { Task as TaskDTO } from '@/app/types/task';
import { Task } from '@prisma/client';

const taskService = new TaskService();

function convertTaskDTO(task: Task): TaskDTO {
  return {};
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');

    if (taskId) {
      // Get single task
      const task = await taskService.getTask(taskId);
      
      if (!task) {
        return NextResponse.json({ err: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(convertTaskDTO(task));
    } else {
      // List all tasks (sorted by creation date, newest first)
      const tasks = await taskService.getTasks(20);
      return NextResponse.json(tasks.map(convertTaskDTO));
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { err: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, language = 'zh' } = await request.json();
    
    // Create task
    const task = await taskService.createTask(url, language);
    
    // Start processing task in background
    const cookiePath = path.join(process.cwd(), 'www.youtube.com_cookies.txt');
    let cookieContents = '';
    try {
      cookieContents = await fs.readFile(cookiePath, 'utf-8');
    } catch (error) {
      console.warn('Cookie file not found, proceeding without cookies');
      await taskService.updateTaskStatus(task.id, 'FAILED', 0);
      await taskService.failTask(task.id, 'Cookie file not found - please add www.youtube.com_cookies.txt file');
      throw error;
    }
    
    const subtitleManager = new SubtitleManager();
    subtitleManager.processTask({
      taskId: task.id,
      url,
      language
    }, cookieContents);

    return NextResponse.json({ taskId: task.id });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { 
        err: error instanceof Error ? error.message : 'Failed to create task' 
      },
      { status: 500 }
    );
  }
}