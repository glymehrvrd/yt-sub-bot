import { FileData } from '../types/files';

interface ApiResponse {
  err?: string;
  data?: {
    files?: FileData[];
  };
}

export async function fetchSubtitle(url: string, language: string = 'en'): Promise<ApiResponse> {
  const params = new URLSearchParams({
    url: url,
    language: language,
  });

  const response = await fetch(`/api/subtitle?${params.toString()}`, {
    method: 'GET',
  });

  const data = await response.json();
  if (!response.ok || 'err' in data) {
    throw new Error(data.err || 'Network response was not ok');
  }

  return data;
}
