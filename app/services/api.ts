import { FileData } from '../types/files';

interface ApiResponse {
  err?: string;
  data?: {
    files?: FileData[];
  };
}

export async function fetchSubtitle(url: string, splitByChapter: boolean): Promise<ApiResponse> {
  const response = await fetch(`/api/subtitle?url=${encodeURIComponent(url)}&splitByChapter=${splitByChapter}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok || 'err' in data) {
    throw new Error(data.err || 'Network response was not ok');
  }

  return data;
}