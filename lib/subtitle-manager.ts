import path from 'path';
import fs from 'fs/promises';
import { downloadSubtitle, DownloadSubtitleResult, YoutubeTranscriptNotAvailableLanguageError } from './downloader';
import { Translator } from './translator';
import { TencentTranslator, OpenAITranslator } from './translator';
import { logger } from './utils';
import { generateAudioFromText } from './tts';

const log = logger('subtitle-manager');

export interface GetSubtitleOptions {
  url: string;
  language?: string;
  cookieContents?: string;
  tts?: boolean;
}

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

export interface SubtitleResponse {
  title: string;
  subtitle: string;
  language: string;
  originalLanguage: string;
  audioPath?: string;
}

export async function getVideoId(url: string): Promise<string> {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : url;
}

export class SubtitleManager {
  private cacheDir: string;
  private translator: Translator;

  constructor(cacheDir: string = path.join(process.cwd(), '.cache', 'subtitles'), useOpenAI: boolean = true) {
    this.cacheDir = cacheDir;
    this.translator = useOpenAI
      ? new OpenAITranslator({
        baseURL: process.env.OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL,
      })
      : new TencentTranslator({
        secretId: process.env.SECRET_ID || '',
        secretKey: process.env.SECRET_KEY || '',
      });
  }

  private async ensureCacheDir(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private getCachePath(videoId: string): string {
    return path.join(this.cacheDir, `${videoId}.json`);
  }

  private async readCache(cachePath: string, lang: string): Promise<SubtitleResponse | null> {
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
            originalLanguage: cached.versions[lang].originalLanguage,
          };
        }
        log.info(`Cached subtitle not found for language: ${lang}`);
      }
    } catch (error) {
      // cache not exists
    }
    return null;
  }

  async get(options: GetSubtitleOptions): Promise<SubtitleResponse> {
    const videoId = await getVideoId(options.url);
    const language = options.language || 'zh';

    let response = await this.getTitleAndSubtitle(videoId, language, options.cookieContents);
    if (response.originalLanguage != language && options.tts) {
      const audioPath = await this.tts(videoId, response.subtitle);
      response.audioPath = audioPath;
    }
    return response;
  }

  async getTitleAndSubtitle(videoId: string, language: string, cookie?: string): Promise<SubtitleResponse> {
    const cachePath = this.getCachePath(videoId);

    await this.ensureCacheDir();

    // Try to read from cache first
    const cachedResult = await this.readCache(cachePath, language);
    if (cachedResult) {
      return cachedResult;
    }

    // Download fresh subtitles
    log.info('Downloading new subtitles, videoId:', videoId);
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

    let response: SubtitleResponse = {
      title: downloadResult.title,
      subtitle: downloadResult.subtitle,
      language: downloadResult.language,
      originalLanguage: downloadResult.language,
    }
    // Translate if needed
    if (language !== downloadResult.language) {
      log.info(`Translating subtitles from ${downloadResult.language} to ${language}`);
      const translatedSubtitle = await this.translator.translate(downloadResult.subtitle, {
        to: language,
      });

      // Update cache with translated version
      cacheEntry.timestamp = Date.now();
      cacheEntry.versions[language] = {
        subtitle: translatedSubtitle,
        language: language,
        originalLanguage: downloadResult.language,
      };
      await fs.writeFile(cachePath, JSON.stringify(cacheEntry));

      response.subtitle = translatedSubtitle;
    }
    return response;
  }

  async tts(videoId: string, subtitle: string): Promise<string> {
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
      // Return subtitle without audio if TTS fails
    }
    return audioPath;
  }
}

