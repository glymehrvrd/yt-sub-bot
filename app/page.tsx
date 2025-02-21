'use client'

import styles from './page.module.css';
import UrlForm from './components/UrlForm';

export default function Home() {
  return (
    <main className={styles.container}>
      <h1>YouTube Subtitle Downloader</h1>
      <UrlForm />
    </main>
  );
}
