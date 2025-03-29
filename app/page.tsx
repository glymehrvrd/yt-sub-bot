import UrlForm from './components/UrlForm';
import TaskList from './components/TaskList';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">YouTube Subtitle Processor</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold mb-4">New Task</h2>
            <UrlForm />
          </div>
          
          <div>
            <TaskList />
          </div>
        </div>
      </div>
    </main>
  );
}
