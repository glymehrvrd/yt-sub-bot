import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/services/TaskService';
import { SubtitleManager } from '@/lib/subtitle-manager';

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
      return NextResponse.json(await TaskService.convertTaskDTO(task));
    } else {
      // List all tasks (sorted by creation date, newest first)
      const tasks = await taskService.getTasks(20);
      return NextResponse.json(await Promise.all(tasks.map(TaskService.convertTaskDTO)));
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
    const { url, language = 'zh', needTTS = false } = await request.json();

    // Create task
    const task = await taskService.createTask(url, language, needTTS);

    const subtitleManager = new SubtitleManager();
    subtitleManager.processTask({
      taskId: task.id,
      url,
      language,
      needTTS,
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