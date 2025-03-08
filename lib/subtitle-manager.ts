import path from 'path';
import fs from 'fs/promises';
import { downloadSubtitle } from './downloader';
import { logger } from './utils';

const log = logger('subtitle-manager');

export interface GetSubtitleOptions {
  url: string;
  preferChinese?: boolean;
  cookieContents?: string;
}

interface CacheEntry {
  title: string;
  subtitle: string;
  timestamp: number;
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

  constructor(cacheDir: string = path.join(process.cwd(), '.cache', 'subtitles')) {
    this.cacheDir = cacheDir;
  }

  private async ensureCacheDir(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private getCachePath(videoId: string): string {
    return path.join(this.cacheDir, `${videoId}.json`);
  }

  async getSubtitle(options: GetSubtitleOptions): Promise<SubtitleResponse> {
    const videoId = await getVideoId(options.url);
    const cachePath = this.getCachePath(videoId);

    try {
      await this.ensureCacheDir();

      // Try to read from cache
      const cacheStats = await fs.stat(cachePath);
      if (cacheStats.isFile()) {
        log.info('Found cached subtitles');
        const cached: CacheEntry = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
        return {
          title: cached.title,
          subtitle: cached.subtitle,
        };
      }
    } catch (error) {
      // Cache miss or error, proceed with download
      log.error('Read cache error:', error);
    }

    // Download fresh subtitles
    log.info('Downloading new subtitles, videoId:', videoId);
    const result = await downloadSubtitle({
      videoId,
      preferChinese: options.preferChinese,
      cookieContents: options.cookieContents,
    });

    // Cache the results
    const cacheEntry: CacheEntry = {
      title: result.title,
      subtitle: result.subtitle,
      timestamp: Date.now(),
    };

    await fs.writeFile(cachePath, JSON.stringify(cacheEntry));
    return {
      title: result.title,
      subtitle: result.subtitle,
    };
  }
}
