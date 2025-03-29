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
    const completedTask = await taskService.completeTask(task.id, 'title');
    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.progress).toBe(100);
    expect(completedTask.title).toBe('title');
  });

  it('should fail a task', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    const failedTask = await taskService.failTask(task.id, 'Test error');
    expect(failedTask.status).toBe('FAILED');
    expect(failedTask.error).toBe('Test error');
  });

  it('should get tasks list', async () => {
    await taskService.createTask('https://youtube.com/watch?v=test1');
    await taskService.createTask('https://youtube.com/watch?v=test2');
    const tasks = await taskService.getTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks[0].createdAt.getTime()).toBeGreaterThanOrEqual(tasks[1].createdAt.getTime());
  });

  it('should delete a task', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    const deletedTask = await taskService.deleteTask(task.id);
    expect(deletedTask.id).toBe(task.id);
    const foundTask = await taskService.getTask(task.id);
    expect(foundTask).toBeNull();
  });
});