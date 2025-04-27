import { PrismaClient, TaskStatus as PrismaTaskStatus, Task } from '@prisma/client';
import { logger } from '../utils';
import { SubtitleManager, DownloadSubtitleResponse } from '../subtitle-manager';
import { Task as TaskDTO } from '@/app/types/task';

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
   * @param needTTS Whether TTS is needed (default: false)
   * @returns Created task object
   */
  async createTask(url: string, language: string = 'zh', needTTS: boolean = false) {
    const videoId = await this.extractVideoId(url);
    return prisma.task.create({
      data: {
        videoId,
        url,
        language,
        needTTS,
        status: 'PENDING',
      },
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
   * 获取任务列表
   * @param limit 返回的最大任务数
   * @returns 任务数组
   */
  async getTasks(limit: number = 20) {
    return prisma.task.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * 删除任务
   * @param id 任务ID
   * @returns 被删除的任务
   */
  async deleteTask(id: string) {
    return prisma.task.delete({ where: { id } });
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
        progress: progress,
      },
    });
  }

  /**
   * Mark task as completed
   * @param id Task ID
   * @returns Completed task object
   */
  async completeTask(id: string, title?: string) {
    return prisma.task.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        title: title,
      },
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
        error,
      },
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

  /**
   * 转换任务为DTO格式
   * @param taskId 任务ID
   * @returns 任务DTO对象
   * @throws 当任务不存在时抛出错误
   */
  static async convertTaskDTO(task: Task): Promise<TaskDTO> {
    // 使用SubtitleManager获取字幕
    const subtitleManager = new SubtitleManager();
    const subtitleResponse = await subtitleManager.query(task.videoId, task.language);
    return {
      id: task.id,
      videoId: task.videoId,
      url: task.url,
      title: task.title || 'Not Fetched Yet',
      status: task.status,
      progress: task.progress,
      createdAt: task.createdAt.toISOString(),
      subtitle: subtitleResponse?.subtitle || '',
      language: subtitleResponse?.language || '',
      originalLanguage: task.language,
      audioPath: '',
      error: task.error ?? undefined,
    };
  }
}
