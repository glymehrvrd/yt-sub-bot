import path from 'path';
import fs from 'fs/promises';
import { downloadSubtitle, DownloadSubtitleResult, YoutubeTranscriptNotAvailableLanguageError } from './downloader';
import { Translator } from './translator';
import { OpenAITranslator } from './translator';
import { logger } from './utils';
import { generateAudioFromText } from './tts';
import { TaskService } from './services/TaskService';

const log = logger('subtitle-manager');

interface SubtitleVersion {
  subtitle: string;
  language: string;
  originalLanguage: string;
}

interface CacheEntry {
  timestamp: number;
  title: string;
  versions: Record<string, SubtitleVersion>;
}

export interface GetSubtitleOptions {
  taskId: string;
  url: string;
  language?: string;
  cookieContents?: string;
  tts?: boolean;
}

export interface DownloadSubtitleResponse {
  title: string;
  subtitle: string;
  language: string;
}

export interface QuerySubtitleResponse extends DownloadSubtitleResponse {
  audioPath?: string;
}

export async function getVideoId(url: string): Promise<string> {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : url;
}

export class SubtitleManager {
  private cacheDir: string;
  private translator: Translator;
  private taskService: TaskService;

  constructor(
    cacheDir: string = path.join(process.cwd(), '.cache', 'subtitles'),
    taskService: TaskService = new TaskService()
  ) {
    this.cacheDir = cacheDir;
    this.translator = new OpenAITranslator({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
    });
    this.taskService = taskService;
  }

  /**
   * 处理任务
   * @param params 任务参数
   * @param cookieContents YouTube cookie内容
   */
  async processTask(params: { taskId: string; url: string; language: string; needTTS: boolean }) {
    // Start processing task in background
    const cookiePath = path.join(process.cwd(), 'www.youtube.com_cookies.txt');
    let cookieContents = '';
    try {
      cookieContents = await fs.readFile(cookiePath, 'utf-8');
    } catch (error) {
      console.warn('Cookie file not found, proceeding without cookies');
      await this.taskService.updateTaskStatus(params.taskId, 'FAILED', 0);
      await this.taskService.failTask(
        params.taskId,
        'Cookie file not found - please add www.youtube.com_cookies.txt file'
      );
      throw error;
    }

    try {
      await this.get({
        url: params.url,
        language: params.language,
        taskId: params.taskId,
        cookieContents,
        tts: params.needTTS,
      });
    } catch (error) {
      await this.taskService.failTask(params.taskId, error instanceof Error ? error.message : 'Task failed');
      throw error;
    }
  }

  private async ensureCacheDir(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private getCachePath(videoId: string): string {
    return path.join(this.cacheDir, `${videoId}.json`);
  }

  private async readCache(cachePath: string, lang: string): Promise<DownloadSubtitleResponse | null> {
    try {
      const cacheStats = await fs.stat(cachePath);
      if (cacheStats.isFile()) {
        const cached: CacheEntry = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
        if (cached.versions[lang]) {
          log.info(`Found cached subtitles with language: ${lang}`);
          return {
            title: cached.title,
            subtitle: cached.versions[lang].subtitle,
            language: lang,
          };
        }
        log.info(`Cached subtitle not found for language: ${lang}`);
      }
    } catch (error) {
      // cache not exists
    }
    return null;
  }

  async get(options: GetSubtitleOptions) {
    const videoId = await getVideoId(options.url);
    const language = options.language || 'zh';

    await this.taskService.updateTaskStatus(options.taskId, 'DOWNLOADING', 10);

    let {
      title,
      subtitle,
      language: downloadedLanguage,
    } = await this.downloadSubtitle(videoId, language, options.taskId, options.cookieContents);

    if (downloadedLanguage !== language) {
      await this.taskService.updateTaskStatus(options.taskId, 'TRANSLATING', 50);
      await this.translate(options.taskId, videoId, subtitle, downloadedLanguage, language);
    }

    if (downloadedLanguage !== language && options.tts) {
      await this.taskService.updateTaskStatus(options.taskId, 'GENERATING_AUDIO', 80);
      const audioPath = await this.tts(videoId, subtitle, options.taskId);
    }

    await this.taskService.completeTask(options.taskId, title);

    return;
  }

  async query(videoId: string, language: string): Promise<QuerySubtitleResponse | null> {
    // Read subtitle from cache
    const cachePath = this.getCachePath(videoId);
    const cachedResult = await this.readCache(cachePath, language);
    if (!cachedResult) {
      return null;
    }
    return cachedResult;
  }

  async downloadSubtitle(
    videoId: string,
    language: string,
    taskId: string,
    cookie?: string
  ): Promise<DownloadSubtitleResponse> {
    const cachePath = this.getCachePath(videoId);
    await this.ensureCacheDir();

    // Try to read from cache first
    const cachedResult = await this.readCache(cachePath, language);
    if (cachedResult) {
      return cachedResult;
    }

    // Download fresh subtitles
    log.info('Downloading new subtitles, videoId:', videoId);
    await this.taskService.updateTaskStatus(taskId, 'DOWNLOADING', 20);

    let downloadResult: DownloadSubtitleResult;
    try {
      downloadResult = await downloadSubtitle({
        videoId,
        language,
        cookieContents: cookie,
      });
    } catch (error) {
      if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
        log.info('Chinese subtitles not available, checking cache for English');
        // Check cache for English subtitles
        const cachedEnglishSubtitle = await this.readCache(cachePath, 'en');
        if (cachedEnglishSubtitle) {
          downloadResult = {
            title: cachedEnglishSubtitle.title,
            subtitle: cachedEnglishSubtitle.subtitle,
            language: 'en',
          };
        } else {
          // If not in cache, download English
          log.info('Falling back to downloading English subtitles');
          downloadResult = await downloadSubtitle({
            videoId,
            language: 'en',
            cookieContents: cookie,
          });
        }
      } else {
        await this.taskService.failTask(taskId, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }

    // Read existing cache or create new entry
    let cacheEntry: CacheEntry;
    try {
      cacheEntry = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
    } catch (error) {
      cacheEntry = { timestamp: Date.now(), title: downloadResult.title, versions: {} };
    }

    // Update cache with original version
    cacheEntry.timestamp = Date.now();
    cacheEntry.versions[downloadResult.language] = {
      subtitle: downloadResult.subtitle,
      language: downloadResult.language,
      originalLanguage: downloadResult.language,
    };
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry));

    return {
      title: downloadResult.title,
      subtitle: downloadResult.subtitle,
      language: downloadResult.language,
    };
  }

  async translate(taskId: string, videoId: string, subtitle: string, originalLanguage: string, language: string) {
    // Translate if needed
    log.info(`Translating subtitles from ${originalLanguage} to ${language}`);
    const translatedSubtitle = await this.translator.translate(subtitle, {
      to: language,
    });

    // Update cache with translated version
    let cacheEntry: CacheEntry;
    const cachePath = this.getCachePath(videoId);
    cacheEntry = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
    cacheEntry.timestamp = Date.now();
    cacheEntry.versions[language] = {
      subtitle: translatedSubtitle,
      language: language,
      originalLanguage: originalLanguage,
    };
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry));

    return translatedSubtitle;
  }

  async tts(videoId: string, subtitle: string, taskId: string): Promise<string> {
    const audioDir = path.join(this.cacheDir, 'audio');
    await fs.mkdir(audioDir, { recursive: true });
    const audioPath = path.join(audioDir, `${videoId}.mp3`);

    try {
      const audioStats = await fs.stat(audioPath);
      if (audioStats.isFile()) {
        log.info('Found cached audio file');
        return audioPath;
      }
    } catch (error) {
      // File doesn't exist, continue with generation
    }

    try {
      await generateAudioFromText(subtitle, audioPath);
      return audioPath;
    } catch (error) {
      log.error('TTS generation failed:', error);
      await this.taskService.failTask(taskId, 'TTS generation failed');
      // Return subtitle without audio if TTS fails
    }
    return audioPath;
  }
}
