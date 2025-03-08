import { YoutubeTranscript } from '@/lib/youtube-transcript';
import { logger } from '@/lib/utils';
import { decodeXML } from 'entities';

const log = logger('downloader');

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

export interface DownloadSubtitleOptions {
  videoId: string;
  preferChinese?: boolean;
  cookieContents?: string;
}

export interface DownloadSubtitleResult {
  title: string;
  subtitle: string;
}

export async function downloadSubtitle({
  videoId,
  preferChinese = false,
  cookieContents,
}: DownloadSubtitleOptions): Promise<DownloadSubtitleResult> {
  log.info('Starting subtitle download');
  const lang = preferChinese ? 'zh' : 'en';
  const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
    lang: lang,
    cookies: cookieContents ? parseCookies(cookieContents) : undefined,
  });

  const paragraphList: string[] = [];
  let currentParagraph = '';
  let currentWordCount = 0;
  const MAX_WORDS = 1000;

  for (const item of transcript.transcriptions) {
    const text = decodeXML(decodeXML(item.text));
    const newWordCount = text.split(/\s+/).length;

    if (currentWordCount + newWordCount > MAX_WORDS) {
      if (currentParagraph !== '') {
        paragraphList.push(currentParagraph);
      }
      currentParagraph = text;
      currentWordCount = newWordCount;
    } else {
      currentParagraph = currentParagraph ? `${currentParagraph} ${text}` : text;
      currentWordCount += newWordCount;
    }
  }

  if (currentParagraph !== '') {
    paragraphList.push(currentParagraph);
  }

  return {
    title: transcript.title,
    subtitle: paragraphList.join('\n'),
  };
}
