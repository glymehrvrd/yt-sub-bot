import { NextRequest, NextResponse } from 'next/server';
import { SubtitleManager } from '@/lib/subtitle-manager';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ err: 'URL is required' }, { status: 400 });
    }

    const language = searchParams.get('language') || 'zh';
    const tts = searchParams.get('tts') === 'true';

    const cookiePath = path.join(process.cwd(), 'www.youtube.com_cookies.txt');
    const cookieContents = await fs.readFile(cookiePath, 'utf-8');

    const subtitleManager = new SubtitleManager();
    const subtitle = await subtitleManager.get({
      url,
      cookieContents,
      language,
      tts,
    });

    if (!subtitle.subtitle.length) {
      return NextResponse.json({ err: 'No subtitles found for this video' }, { status: 404 });
    }

    const files = [{
      name: subtitle.title,
      content: subtitle.subtitle,
      audioPath: subtitle.audioPath
    }];

    return NextResponse.json({ data: { files } });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { err: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
