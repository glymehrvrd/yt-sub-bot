'use client';

import { useEffect, useState } from 'react';
import { Task } from '../types/task';
import TaskDetail from './TaskDetail';

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchTasks();

    // Set up SSE connection
    const eventSource = new EventSource('/api/sse');

    eventSource.addEventListener('update', (event) => {
      const data = JSON.parse(event.data);
      // setTasks(data);
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const tasks = await response.json();
      setTasks(tasks);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return <div className="p-4">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Recent Tasks</h2>
      {tasks.length === 0 ? (
        <p>No tasks found</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="p-4 border rounded-lg">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  {' '}
                  {/* Add min-w-0 to allow text truncation */}
                  <h3 className="font-medium truncate">{task.title || 'Not Fetched Yet'}</h3>
                  <p className="text-sm text-gray-500 truncate">{task.url}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>{task.status}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm text-gray-500 shrink-0">
                    {' '}
                    {/* Add shrink-0 to prevent date from shrinking */}
                    {new Date(task.createdAt).toLocaleString()}
                  </span>
                  {task.status === 'COMPLETED' && <TaskDetail task={task} />}
                </div>
              </div>

              {task.status !== 'COMPLETED' && task.status !== 'FAILED' && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Progress</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${task.progress}%` }}></div>
                  </div>
                </div>
              )}

              {task.error && <div className="mt-2 text-sm text-red-600">Error: {task.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
