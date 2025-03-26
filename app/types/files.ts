export interface FileData {
  name: string;
  content: string;
  audioPath?: string;
}

export interface FileListProps {
  files: FileData[];
}
