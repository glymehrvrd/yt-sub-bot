'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 1500 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-lg shadow-lg 
        flex items-center justify-center animate-fade-in-up min-w-[200px]
        ${
          type === 'error'
            ? 'bg-red-500 text-white'
            : type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-gray-700 text-white'
        }`}
    >
      <span className="text-sm font-medium text-center">{message}</span>
    </div>
  );
}
