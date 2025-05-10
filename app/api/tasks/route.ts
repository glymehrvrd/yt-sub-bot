import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/services/TaskService';
import { SubtitleManager } from '@/lib/subtitle-manager';
import { Task } from '@/app/types/task';
import { logger } from '@/lib/utils';

const log = logger('route');
const taskService = new TaskService();

export async function GET(request: NextRequest) {
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  });

  let lastTasks: Task[] = [];

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Send initial connection message
  writer.write(new TextEncoder().encode('event: connected\ndata: {}\n\n'));

  const pollTasks = async () => {
    const tasks = await Promise.all(await taskService.getTasks(20));
    // Find changed tasks
    const changedTasks = tasks.filter((task) => {
      const lastTask = lastTasks.find((t) => t.id === task.id);
      return !lastTask || lastTask.status !== task.status || lastTask.progress !== task.progress;
    });

    if (changedTasks.length > 0) {
      log.debug(`found ${changedTasks.length} changed tasks`);
      writer.write(new TextEncoder().encode(`event: update\ndata: ${JSON.stringify(changedTasks)}\n\n`));
      lastTasks = await Promise.all(tasks.map(TaskService.convertTaskDTO)); // Update last tasks
    }
  };

  // Run immediately
  await pollTasks();

  // Then set up interval
  const interval = setInterval(pollTasks, 2000);

  // Clean up on client disconnect
  const abortHandler = () => {
    clearInterval(interval);
    writer.close();
  };
  request.signal.addEventListener('abort', abortHandler);

  return new Response(stream.readable, { headers });
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