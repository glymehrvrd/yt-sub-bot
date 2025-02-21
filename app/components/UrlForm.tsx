'use client'

import { useState } from 'react';
import FileList from './FileList';
import styles from './UrlForm.module.css';
import { FileData } from '../types/files';
import { fetchSubtitles } from '../services/api';

export default function UrlForm() {
  const [url, setUrl] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!url) {
      alert('Please enter URL');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetchSubtitles(url, isChecked);
      setFiles(response?.data?.files || []);
    } catch (error) {
      console.error('Request failed:', error);
      alert(error instanceof Error ? error.message : 'Request failed, please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.urlForm}>
      <div className={styles.formGroup}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Please enter URL"
          className={styles.urlInput}
        />
      </div>
      
      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className={styles.checkboxInput}
          />
          <span className={styles.checkboxText}>Split by chapters</span>
        </label>
      </div>
      
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={styles.submitButton}
      >
        {loading && <span className={styles.loadingSpinner}></span>}
        {loading ? 'Processing...' : 'Confirm'}
      </button>

      {files.length > 0 && <FileList files={files} />}
    </div>
  );
}
