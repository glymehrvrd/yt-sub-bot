export interface Task {
  id: string;
  url: string;
  title?: string;
  status: string;
  progress: number;
  createdAt: string;
  subtitle?: string;
  language: string;
  originalLanguage?: string;
  audioPath?: string;
  error?: string;
}