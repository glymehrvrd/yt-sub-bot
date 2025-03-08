import { logger } from '@/lib/utils';
import { decodeXML } from 'entities';

const log = logger('downloader');

// Constants
const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

// Error classes
export class YoutubeTranscriptError extends Error {
  constructor(message) {
    super(`[YoutubeTranscript] 🚨 ${message}`);
  }
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
  constructor() {
    super('YouTube is receiving too many requests from this IP and now requires solving a captcha to continue');
  }
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`The video is no longer available (${videoId})`);
  }
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`Transcript is disabled on this video (${videoId})`);
  }
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
  constructor(videoId: string) {
    super(`No transcripts are available for this video (${videoId})`);
  }
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
  constructor(lang: string, availableLangs: string[], videoId: string) {
    super(
      `No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
        ', '
      )}`
    );
  }
}

// Interfaces
interface TranscriptConfig {
  lang?: string;
  cookies?: string;
}

interface Transcription {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

interface TranscriptResponse {
  title: string;
  transcriptions: Transcription[];
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

// Helper functions
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

function retrieveVideoId(videoId: string) {
  if (videoId.length === 11) {
    return videoId;
  }
  const matchId = videoId.match(RE_YOUTUBE);
  if (matchId && matchId.length) {
    return matchId[1];
  }
  throw new YoutubeTranscriptError('Impossible to retrieve Youtube video ID.');
}

// Main functions
async function fetchTranscript(videoId: string, config?: TranscriptConfig): Promise<TranscriptResponse> {
  const identifier = retrieveVideoId(videoId);
  log.debug('Fetching transcript:', {
    videoId: identifier,
    language: config?.lang || 'default',
    hasCookies: !!config?.cookies,
  });

  const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${identifier}`, {
    headers: {
      ...(config?.lang && { 'Accept-Language': config.lang }),
      ...(config?.cookies && { Cookie: config.cookies }),
      'User-Agent': USER_AGENT,
    },
  });

  const videoPageBody = await videoPageResponse.text();
  const titleMatch = videoPageBody.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Untitled';

  const splittedHTML = videoPageBody.split('"captions":');

  if (splittedHTML.length <= 1) {
    if (videoPageBody.includes('class="g-recaptcha"')) {
      throw new YoutubeTranscriptTooManyRequestError();
    }
    if (!videoPageBody.includes('"playabilityStatus":')) {
      throw new YoutubeTranscriptVideoUnavailableError(videoId);
    }
    throw new YoutubeTranscriptDisabledError(videoId);
  }

  const captions = (() => {
    try {
      return JSON.parse(splittedHTML[1].split(',"videoDetails')[0].replace('\n', ''));
    } catch (e) {
      return undefined;
    }
  })()?.['playerCaptionsTracklistRenderer'];

  if (!captions) {
    throw new YoutubeTranscriptDisabledError(videoId);
  }

  if (!('captionTracks' in captions)) {
    throw new YoutubeTranscriptNotAvailableError(videoId);
  }

  log.debug('Found caption tracks:', {
    count: captions.captionTracks?.length || 0,
    availableLanguages: captions.captionTracks?.map((track) => track.languageCode) || [],
  });

  if (config?.lang && !captions.captionTracks.some((track) => track.languageCode === config?.lang)) {
    throw new YoutubeTranscriptNotAvailableLanguageError(
      config?.lang,
      captions.captionTracks.map((track) => track.languageCode),
      videoId
    );
  }

  const transcriptURL = (
    config?.lang
      ? captions.captionTracks.find((track) => track.languageCode === config?.lang)
      : captions.captionTracks[0]
  ).baseUrl;

  const transcriptResponse = await fetch(transcriptURL, {
    headers: {
      ...(config?.lang && { 'Accept-Language': config.lang }),
      ...(config?.cookies && { Cookie: config.cookies }),
      'User-Agent': USER_AGENT,
    },
  });

  log.debug('Transcript response status:', transcriptResponse.status, `url: ${transcriptURL}`);

  if (!transcriptResponse.ok) {
    throw new YoutubeTranscriptNotAvailableError(videoId);
  }
  const transcriptBody = await transcriptResponse.text();
  const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
  log.debug('Parsed transcript entries:', results.length);

  return {
    title,
    transcriptions: results.map((result) => ({
      text: result[3].replace(/\n/g, ' '),
      duration: parseFloat(result[2]),
      offset: parseFloat(result[1]),
      lang: config?.lang ?? captions.captionTracks[0].languageCode,
    })),
  };
}

export async function downloadSubtitle({
  videoId,
  preferChinese = false,
  cookieContents,
}: DownloadSubtitleOptions): Promise<DownloadSubtitleResult> {
  log.info('Starting subtitle download');
  const lang = preferChinese ? 'zh' : 'en';
  const transcript = await fetchTranscript(videoId, {
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

    if (currentWordCount + newWordCount > MAX_WORDS || currentParagraph.endsWith('.')) {
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
