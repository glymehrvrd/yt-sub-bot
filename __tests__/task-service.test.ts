import { PrismaClient } from '@prisma/client';
import { TaskService } from '../lib/services/TaskService';
import { execSync } from 'child_process'; // Import execSync

const prisma = new PrismaClient();

describe('TaskService', () => {
  let taskService: TaskService;

  beforeAll(() => {
    // Ensure the test database schema is applied before tests run
    try {
      console.log('Applying database schema for task-service tests...');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('Database schema applied.');
    } catch (error) {
      console.error('Failed to apply database schema:', error);
      throw error; // Fail fast if db setup fails
    }
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
    expect(tasks[0].createdAt.getTime()).toBeLessThanOrEqual(tasks[1].createdAt.getTime());
  });

  it('should delete a task', async () => {
    const task = await taskService.createTask('https://youtube.com/watch?v=test');
    const deletedTask = await taskService.deleteTask(task.id);
    expect(deletedTask.id).toBe(task.id);
    const foundTask = await taskService.getTask(task.id);
    expect(foundTask).toBeNull();
  });
});