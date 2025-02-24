'use client';

import { useState, useEffect } from 'react';
import FileList from './FileList';
import { FileData } from '../types/files';
import { fetchSubtitle } from '../services/api';

export default function UrlForm() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [preferChinese, setPreferChinese] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(false);

  useEffect(() => {
    // Load saved credentials on component mount
    const savedUsername = localStorage.getItem('yt-username');
    const savedPassword = localStorage.getItem('yt-password');
    if (savedUsername) setUsername(savedUsername);
    if (savedPassword) setPassword(savedPassword);
    setSaveCredentials(!!savedUsername || !!savedPassword);
  }, []);

  const handleSubmit = async () => {
    if (!url) {
      alert('Please enter URL');
      return;
    }

    // Save or remove credentials based on checkbox
    if (saveCredentials) {
      localStorage.setItem('yt-username', username);
      localStorage.setItem('yt-password', password);
    } else {
      localStorage.removeItem('yt-username');
      localStorage.removeItem('yt-password');
    }

    setLoading(true);
    try {
      const response = await fetchSubtitle(url, isChecked, preferChinese, username, password);
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
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Please enter URL"
          className="w-full p-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (optional)"
            className="flex-1 p-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (optional)"
            className="flex-1 p-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveCredentials}
            onChange={(e) => setSaveCredentials(e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
          <span>Save credentials</span>
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
          <span>Split by chapters</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={preferChinese}
            onChange={(e) => setPreferChinese(e.target.checked)}
            className="w-4 h-4 text-blue-600"
          />
          <span>Prefer Chinese subtitles</span>
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
