'use client';

import { useState, ChangeEvent } from 'react';
import { createSubtitleTask } from '../services/api';
import Toast from './Toast';

export default function UrlForm() {
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('zh');
  const [tts, setTts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const handleSubmit = async () => {
    if (!url) {
      setToast({message: 'Please enter URL', type: 'error'});
      return;
    }

    setLoading(true);
    try {
      const response = await createSubtitleTask(url, language, tts);
      setLoading(false);
    } catch (error) {
      setToast({message: error instanceof Error ? error.message : 'Submit task failed', type: 'error'});
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
    </div>
  );
}
