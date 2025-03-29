import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/services/TaskService';

const taskService = new TaskService();

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
      return NextResponse.json(task);
    } else {
      // List all tasks (sorted by creation date, newest first)
      const tasks = await taskService.getTasks(20);
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

export async function POST(request: NextRequest) {
  try {
    const { url, language = 'zh' } = await request.json();
    const task = await taskService.createTask(url, language);
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