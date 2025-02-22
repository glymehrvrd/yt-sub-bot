'use client';

import { useState } from 'react';
import { FileData, FileListProps } from '../types/files';
import Toast from './Toast';

export default function FileList({ files }: FileListProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const previewFile = (file: FileData) => {
    setCurrentFile(file);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setCurrentFile(null);
    setCopySuccess(false);
  };

  const copyContent = async () => {
    if (currentFile?.content) {
      try {
        await navigator.clipboard.writeText(currentFile.content);
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

  const downloadFile = (file: FileData) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8">
      {files.length > 0 ? (
        <div className="flex flex-col gap-4">
          {files.map((file) => (
            <div key={file.name} className="flex flex-wrap items-start gap-4 p-4 bg-gray-100 rounded-md">
              <span className="text-left flex-1 min-w-[200px] break-all">{file.name}</span>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => previewFile(file)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md whitespace-nowrap"
                >
                  Preview
                </button>
                <button
                  onClick={() => downloadFile(file)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md whitespace-nowrap"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-600 py-8">No files available</div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={1500} />}

      {showPreview && currentFile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold truncate flex-1 pr-4">{currentFile.name}</h3>
              <div className="flex gap-2 shrink-0">
                <button
                  className={`min-w-[80px] py-2 px-4 rounded-md ${
                    copySuccess ? 'bg-green-600' : 'bg-gray-600'
                  } text-white touch-manipulation`}
                  onClick={copyContent}
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
              <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md text-sm">{currentFile.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
