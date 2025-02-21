'use client'

import { useState } from 'react';
import styles from './FileList.module.css';
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
    <div className={styles.fileList}>
      {files.length > 0 ? (
        <div className={styles.filesContainer}>
          {files.map(file => (
            <div key={file.name} className={styles.fileItem}>
              <span className={styles.fileName}>{file.name}</span>
              <div className={styles.fileActions}>
                <button 
                  onClick={() => previewFile(file)} 
                  className={`${styles.actionButton} ${styles.previewButton}`}
                >
                  Preview
                </button>
                <button 
                  onClick={() => downloadFile(file)} 
                  className={`${styles.actionButton} ${styles.downloadButton}`}
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.noFiles}>
          No files available
        </div>
      )}

      {showPreview && currentFile && (
        <div className={styles.modalOverlay} onClick={closePreview}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{currentFile.name}</h3>
              <div className={styles.modalActions}>
                <button 
                  className={`${styles.actionButton} ${styles.copyButton} ${copySuccess ? styles.success : ''}`}
                  onClick={copyContent}
                >
                  {copySuccess ? 'Copied' : 'Copy'}
                </button>
                <button className={styles.closeButton} onClick={closePreview}>×</button>
              </div>
            </div>
            <div className={styles.modalBody}>
              <pre className={styles.filePreview}>{currentFile.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
