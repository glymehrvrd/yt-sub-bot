'use client';

import { useState } from 'react';
import { Task } from '../types/task';
import Toast from './Toast';

export default function TaskDetail({ task }: { task: Task }) {
  const [showPreview, setShowPreview] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const previewSubtitle = (task: Task) => {
    setCurrentTask(task);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setCurrentTask(null);
    setCopySuccess(false);
  };

  const copySubtitle = async () => {
    if (currentTask?.subtitle) {
      try {
        await navigator.clipboard.writeText(currentTask.subtitle);
        setCopySuccess(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 2000);
        setToast({ message: 'Content copied to clipboard!', type: 'success' });
      } catch (error) {
        console.error('Copy failed:', error);
        setToast({
          message: 'Unable to copy. Try selecting the text manually',
          type: 'error',
        });
      }
    }
  };

  const downloadSubtitle = (task: Task) => {
    const blob = new Blob([task.subtitle ?? ''], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div key={task.title} className="flex flex-wrap items-start gap-4">
        <div className="flex flex-row gap-2 shrink-0 mt-5.5">
            <button
            onClick={() => previewSubtitle(task)}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full whitespace-nowrap hover:bg-blue-200"
            >
            Preview
            </button>
            <button
            onClick={() => downloadSubtitle(task)}
            className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full whitespace-nowrap hover:bg-green-200"
            >
            Download
            </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={1500} />}

      {showPreview && currentTask && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold truncate flex-1 pr-4">{currentTask.title}</h3>
              <div className="flex gap-2 shrink-0">
                <button
                  className={`min-w-[80px] py-2 px-4 rounded-md ${
                    copySuccess ? 'bg-green-600' : 'bg-gray-600'
                  } text-white touch-manipulation`}
                  onClick={copySubtitle}
                >
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md"
                  onClick={closePreview}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-left whitespace-pre-wrap bg-gray-100 p-4 rounded-md text-sm">
                {currentTask.subtitle}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
