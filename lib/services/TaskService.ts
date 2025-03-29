import { PrismaClient, TaskStatus as PrismaTaskStatus } from '@prisma/client';
import { logger } from '../utils';

export type TaskStatus = PrismaTaskStatus;

const prisma = new PrismaClient();
const log = logger('task-service');

/**
 * Service for managing subtitle processing tasks
 */
export class TaskService {
  /**
   * Create a new subtitle processing task
   * @param url YouTube video URL
   * @param language Target subtitle language (default: 'zh')
   * @returns Created task object
   */
  async createTask(url: string, language: string = 'zh') {
    const videoId = await this.extractVideoId(url);
    return prisma.task.create({
      data: {
        videoId,
        url,
        language,
        status: 'PENDING',
      }
    });
  }

  /**
   * Get task details by ID
   * @param id Task ID
   * @returns Task object or null if not found
   */
  async getTask(id: string) {
    return prisma.task.findUnique({ where: { id } });
  }

  /**
   * Update task status and progress
   * @param id Task ID
   * @param status New task status
   * @param progress Optional progress percentage
   * @returns Updated task object
   */
  async updateTaskStatus(id: string, status: TaskStatus, progress?: number) {
    return prisma.task.update({
      where: { id },
      data: { 
        status,
        progress: progress !== undefined ? progress : undefined,
      }
    });
  }

  /**
   * Mark task as completed
   * @param id Task ID
   * @param subtitlePath Path to generated subtitle file
   * @param audioPath Path to generated audio file
   * @returns Completed task object
   */
  async completeTask(id: string, subtitlePath?: string, audioPath?: string) {
    return prisma.task.update({
      where: { id },
      data: { 
        status: 'COMPLETED',
        progress: 100,
        subtitlePath,
        audioPath
      }
    });
  }

  /**
   * Mark task as failed
   * @param id Task ID
   * @param error Error message
   * @returns Failed task object
   */
  async failTask(id: string, error: string) {
    return prisma.task.update({
      where: { id },
      data: { 
        status: 'FAILED',
        error
      }
    });
  }

  /**
   * Extract video ID from YouTube URL
   * @param url YouTube URL
   * @returns Extracted video ID or original URL if not found
   */
  private async extractVideoId(url: string): Promise<string> {
    const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : url;
  }
}