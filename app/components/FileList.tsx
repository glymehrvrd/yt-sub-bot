'use client'

import { useState } from 'react';
import { FileData, FileListProps } from '../types/files';

export default function FileList({ files }: FileListProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

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
      } catch (error) {
        console.error('Copy failed:', error);
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
          {files.map(file => (
            <div key={file.name} className="flex justify-between items-center p-4 bg-gray-100 rounded-md">
              <span className="text-left">{file.name}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => previewFile(file)} 
                  className="px-3 py-1 bg-blue-600 text-white rounded-md"
                >
                  Preview
                </button>
                <button 
                  onClick={() => downloadFile(file)} 
                  className="px-3 py-1 bg-green-600 text-white rounded-md"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-600 py-8">
          No files available
        </div>
      )}

      {showPreview && currentFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={closePreview}>
          <div className="bg-white p-8 rounded-lg w-11/12 max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{currentFile.name}</h3>
              <div className="flex gap-2">
                <button 
                  className={`px-3 py-1 rounded-md ${copySuccess ? 'bg-green-600' : 'bg-gray-600'} text-white`}
                  onClick={copyContent}
                >
                  {copySuccess ? 'Copied' : 'Copy'}
                </button>
                <button className="text-2xl" onClick={closePreview}>×</button>
              </div>
            </div>
            <div className="text-left">
              <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md">{currentFile.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
