import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/services/TaskService';
import { SubtitleManager } from '@/lib/subtitle-manager';
import fs from 'fs/promises';
import path from 'path';
import { Task as TaskDTO } from '@/app/types/task';
import { Task } from '@prisma/client';

const taskService = new TaskService();

function convertTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    url: task.url,
    title: task.title || undefined,
    status: task.status,
    progress: task.progress,
    createdAt: task.createdAt.toISOString(),
    language: task.language,
    error: task.error || undefined,
  };
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

    const subtitleManager = new SubtitleManager();
    subtitleManager.processTask({
      taskId: task.id,
      url,
      language,
    });

    return NextResponse.json({ taskId: task.id });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      {
        err: error instanceof Error ? error.message : 'Failed to create task',
      },
      { status: 500 }
    );
  }
}