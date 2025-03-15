import path from 'path';
import fs from 'fs/promises';
import { downloadSubtitle, DownloadSubtitleResult, YoutubeTranscriptNotAvailableLanguageError } from './downloader';
import { Translator } from './translator';
import { TencentTranslator, OpenAITranslator } from './translator';
import { logger } from './utils';

const log = logger('subtitle-manager');

export interface GetSubtitleOptions {
  url: string;
  language?: string;
  cookieContents?: string;
}

interface SubtitleVersion {
  subtitle: string;
  language: string;
}

interface CacheEntry {
  timestamp: number;
  title: string;
  versions: Record<string, SubtitleVersion>;
}

export interface SubtitleResponse {
  title: string;
  subtitle: string;
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
          };
        }
        log.info(`Cached subtitle not found for language: ${lang}`);
      }
    } catch (error) {
      log.error('Read cache error:', error);
    }
    return null;
  }

  async getSubtitle(options: GetSubtitleOptions): Promise<SubtitleResponse> {
    const videoId = await getVideoId(options.url);
    const cachePath = this.getCachePath(videoId);
    const targetLang = options.language || 'zh';

    await this.ensureCacheDir();

    // Try to read from cache first
    const cachedResult = await this.readCache(cachePath, targetLang);
    if (cachedResult) {
      return cachedResult;
    }

    // Download fresh subtitles
    log.info('Downloading new subtitles, videoId:', videoId);
    let result: DownloadSubtitleResult;
    try {
      result = await downloadSubtitle({
        videoId,
        language: targetLang,
        cookieContents: options.cookieContents,
      });
    } catch (error) {
      if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
        log.info('Chinese subtitles not available, checking cache for English');
        // Check cache for English subtitles
        const cachedEnglishSubtitle = await this.readCache(cachePath, 'en');
        if (cachedEnglishSubtitle) {
          result = {
            title: cachedEnglishSubtitle.title,
            subtitle: cachedEnglishSubtitle.subtitle,
            language: 'en',
          };
        } else {
          // If not in cache, download English
          log.info('Falling back to downloading English subtitles');
          result = await downloadSubtitle({
            videoId,
            language: 'en',
            cookieContents: options.cookieContents,
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
      cacheEntry = { timestamp: Date.now(), title: result.title, versions: {} };
    }

    // Update cache with original version
    cacheEntry.timestamp = Date.now();
    cacheEntry.versions[result.language] = {
      subtitle: result.subtitle,
      language: result.language,
    };
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry));

    // Translate if needed
    if (targetLang !== result.language) {
      log.info(`Translating subtitles from ${result.language} to ${targetLang}`);
      const translatedSubtitle = await this.translator.translate(result.subtitle.slice(0, 600), {
        to: targetLang,
      });

      // Update cache with translated version
      cacheEntry.timestamp = Date.now();
      cacheEntry.versions[targetLang] = {
        subtitle: translatedSubtitle,
        language: targetLang,
      };
      await fs.writeFile(cachePath, JSON.stringify(cacheEntry));

      return {
        title: result.title,
        subtitle: translatedSubtitle,
      };
    }

    return {
      title: result.title,
      subtitle: result.subtitle,
    };
  }
}
