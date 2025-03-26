'use client';

import { useState } from 'react';
import FileList from './FileList';
import { FileData } from '../types/files';
import { fetchSubtitle } from '../services/api';

export default function UrlForm() {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('zh');
  const [tts, setTts] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!url) {
      alert('Please enter URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchSubtitle(url, language, tts);
      setFiles(response?.data?.files || []);
    } catch (error) {
      console.error('Request failed:', error);
      alert(error instanceof Error ? error.message : 'Request failed, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 my-8">
      <div className="w-full">
        <input
          type="url"
          value={url}
          onInput={(e) => setUrl(e.target.value)}
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

      {files.length > 0 && <FileList files={files} />}
    </div>
  );
}
