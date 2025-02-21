import { FileData } from '../types/files';
import { mockFiles } from '../mocks/fileData';

interface ApiResponse {
  files: FileData[];
}

export async function fetchSubtitles(url: string, splitByChapter: boolean): Promise<ApiResponse> {
  if (process.env.NODE_ENV === 'development') {
    // Simulate API delay in development
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { files: mockFiles };
  }

  const response = await fetch(
    `https://api.example.com/subtitles?url=${encodeURIComponent(url)}&splitByChapter=${splitByChapter}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return response.json();
}
