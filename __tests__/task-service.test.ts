import { PrismaClient } from '@prisma/client';
import { TaskService } from '../lib/services/TaskService';

const prisma = new PrismaClient();

describe('TaskService', () => {
  let taskService: TaskService;

  beforeAll(async () => {
    taskService = new TaskService();
  });

  afterAll(async () => {
    await prisma.task.deleteMany();
    await prisma.$disconnect();
  });

  it('should create a new task', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    expect(task).toHaveProperty('id');
    expect(task.status).toBe('PENDING');
  });

  it('should update task status', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    const updatedTask = await taskService.updateTaskStatus(task.id, 'DOWNLOADING', 10);
    expect(updatedTask.status).toBe('DOWNLOADING');
    expect(updatedTask.progress).toBe(10);
  });

  it('should complete a task', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    const completedTask = await taskService.completeTask(task.id, '/path/to/subtitle.srt', '/path/to/audio.mp3');
    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.progress).toBe(100);
    expect(completedTask.subtitlePath).toBe('/path/to/subtitle.srt');
    expect(completedTask.audioPath).toBe('/path/to/audio.mp3');
  });

  it('should fail a task', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    const failedTask = await taskService.failTask(task.id, 'Test error');
    expect(failedTask.status).toBe('FAILED');
    expect(failedTask.error).toBe('Test error');
  });
});