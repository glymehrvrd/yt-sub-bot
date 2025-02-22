'use client'

import UrlForm from './components/UrlForm';

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold mb-8">YouTube Subtitle Downloader</h1>
      <UrlForm />
    </main>
  );
}
