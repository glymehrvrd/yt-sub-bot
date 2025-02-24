import { FileData } from '../types/files';
import { encrypt } from '../utils/crypto';

interface ApiResponse {
  err?: string;
  data?: {
    files?: FileData[];
  };
}

export async function fetchSubtitle(
  url: string,
  splitChapter: boolean = false,
  preferChinese: boolean = true,
  username?: string,
  password?: string
): Promise<ApiResponse> {
  const params = new URLSearchParams({
    url: url,
    split_by_chapter: splitChapter.toString(),
    prefer_chinese: preferChinese.toString(),
  });

  if (username) params.append('username', encrypt(username));
  if (password) params.append('password', encrypt(password));

  const response = await fetch(`/api/subtitle?${params.toString()}`, {
    method: 'GET',
  });

  const data = await response.json();
  if (!response.ok || 'err' in data) {
    throw new Error(data.err || 'Network response was not ok');
  }

  return data;
}
