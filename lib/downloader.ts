import { YoutubeTranscript } from '@/lib/youtube-transcript';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '@/lib/utils';
import { decodeXML } from 'entities';

interface Chapter {
  title: string;
  start_time: number;
  end_time?: number;
}

interface VideoInfo {
  id: string;
  title: string;
  chapters?: Chapter[];
}

interface DownloadOptions {
  url: string;
  splitByChapter?: boolean;
  preferChinese?: boolean;
  cookieContents?: string;
}

const log = logger('downloader');

async function getVideoId(url: string): Promise<string> {
  const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : url;
}

function parseCookies(cookieContents: string): string {
  return cookieContents
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [domain, , path, secure, expiry, name, value] = line.split('\t');
      if (domain && path && name && value) {
        return `${name}=${value}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('; ');
}

export async function downloadSubtitles({
  url,
  splitByChapter = false,
  preferChinese = false,
  cookieContents,
}: DownloadOptions): Promise<string[]> {
  const videoId = await getVideoId(url);
  const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
    lang: preferChinese ? 'zh' : 'en',
    cookies: cookieContents ? parseCookies(cookieContents) : undefined,
  });

  const paragraphList: string[] = [];
  let currentParagraph = '';
  let previousTime = 0;

  for (const item of transcript) {
    const now = item.offset;
    const text = decodeXML(decodeXML(item.text));

    if (now - previousTime > 5) {
      if (currentParagraph !== '') {
        paragraphList.push(currentParagraph);
      }
      currentParagraph = text;
      previousTime = now;
    } else {
      currentParagraph = currentParagraph ? `${currentParagraph} ${text}` : text;
    }
  }

  if (currentParagraph !== '') {
    paragraphList.push(currentParagraph);
  }

  const outputDir = path.join(os.tmpdir(), 'subtitles');
  await fs.mkdir(outputDir, { recursive: true });

  // For now, we'll use the video ID as the title since we don't have access to the video title
  const videoTitle = sanitizeFilename(videoId);
  const content = paragraphList.join('\n');

  const outputPath = path.join(outputDir, `${videoTitle}.txt`);
  await fs.writeFile(outputPath, content);

  return [outputPath];
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .slice(0, 100);
}
