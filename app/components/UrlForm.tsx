'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import FileList from './FileList';
import { FileData } from '../types/files';
import { createSubtitleTask, getTaskStatus, setupWebSocket } from '../services/api';
import Toast from './Toast';

export default function UrlForm() {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('zh');
  const [tts, setTts] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<any>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const cleanup = setupWebSocket(taskId, (data) => {
      setTaskStatus(data);
      
      if (data.status === 'COMPLETED') {
        fetchTaskResult();
      } else if (data.status === 'FAILED') {
        setToast({message: data.error || 'Task failed', type: 'error'});
        setLoading(false);
      }
    });

    return cleanup;
  }, [taskId]);

  const fetchTaskResult = async () => {
    try {
      const response = await getTaskStatus(taskId!);
      if (response.data?.task?.subtitlePath) {
        setFiles([{
          name: response.data.task.title || 'Subtitle',
          content: '', // Will be fetched separately
          audioPath: response.data.task.audioPath
        }]);
        setToast({message: 'Task completed successfully', type: 'success'});
      }
    } catch (error) {
      setToast({message: error instanceof Error ? error.message : 'Failed to fetch task result', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!url) {
      setToast({message: 'Please enter URL', type: 'error'});
      return;
    }

    setLoading(true);
    setTaskStatus(null);
    try {
      const response = await createSubtitleTask(url, language, tts);
      setTaskId(response.data?.taskId || null);
    } catch (error) {
      setToast({message: error instanceof Error ? error.message : 'Request failed', type: 'error'});
      setLoading(false);
    }
  };

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  return (
    <div className="flex flex-col gap-4 my-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="w-full">
        <input
          type="url"
          value={url}
          onChange={handleUrlChange}
          placeholder="Please enter URL"
          className="w-full p-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="language-select" className="text-base font-medium">
          Language:
        </label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="p-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="en">English</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="tts-checkbox"
          checked={tts}
          onChange={(e) => setTts(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          disabled={language !== 'zh'}
        />
        <label htmlFor="tts-checkbox" className="text-base">
          Generate audio (Chinese only)
        </label>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
        )}
        {loading ? 'Processing...' : 'Confirm'}
      </button>

      {taskStatus && (
        <div className="w-full bg-gray-100 rounded-md p-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">
              {taskStatus.status === 'PENDING' && 'Waiting to start...'}
              {taskStatus.status === 'DOWNLOADING' && 'Downloading subtitles...'}
              {taskStatus.status === 'TRANSLATING' && 'Translating subtitles...'}
              {taskStatus.status === 'GENERATING_AUDIO' && 'Generating audio...'}
              {taskStatus.status === 'COMPLETED' && 'Completed!'}
              {taskStatus.status === 'FAILED' && 'Failed'}
            </span>
            <span className="text-sm font-medium">{taskStatus.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${taskStatus.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {files.length > 0 && <FileList files={files} />}
    </div>
  );
}
