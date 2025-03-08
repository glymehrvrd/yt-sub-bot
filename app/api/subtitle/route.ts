import { NextRequest, NextResponse } from 'next/server';
import { downloadSubtitles } from '@/lib/downloader';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ err: 'URL is required' }, { status: 400 });
    }

    const splitByChapter = searchParams.get('split_by_chapter') === 'true';
    const preferChinese = searchParams.get('prefer_chinese') === 'true';

    const cookiePath = path.join(process.cwd(), 'www.youtube.com_cookies.txt');
    const cookieContents = await fs.readFile(cookiePath, 'utf-8');

    const subtitlePaths = await downloadSubtitles({
      url,
      cookieContents,
      splitByChapter,
      preferChinese,
    });

    if (!subtitlePaths.length) {
      return NextResponse.json({ err: 'No subtitles found for this video' }, { status: 404 });
    }

    const files = await Promise.all(
      subtitlePaths.map(async (path) => {
        const content = await fs.readFile(path, 'utf-8');
        const name = path.split('/').pop() || '';
        return { name, content };
      })
    );

    return NextResponse.json({ data: { files } });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { err: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
