# Task System Implementation Plan

## Overview
Transform current synchronous subtitle processing into an asynchronous task-based system with status tracking and progress updates.

## Architecture Components

### 1. Database Schema (Prisma)
```prisma
model Task {
  id           String   @id @default(uuid())
  videoId      String
  url          String
  title        String?
  status       TaskStatus
  progress     Int      @default(0)
  language     String   @default("zh")
  error        String?
  subtitlePath String?
  audioPath    String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

enum TaskStatus {
  PENDING
  DOWNLOADING
  TRANSLATING
  GENERATING_AUDIO
  COMPLETED
  FAILED
}
```

### 2. Service Layer
- TaskService for managing task lifecycle
- Server-Sent Events (SSE) for progress updates
- Methods:
  - createTask(url, language)
  - getTask(id)
  - updateTaskStatus(id, status, progress)
  - deleteTask(id)

### 3. API Endpoints
- POST /api/subtitle
  - Create new subtitle task
  - Parameters: url, language
  - Returns: taskId

- GET /api/subtitle
  - List all tasks or get single task status
  - Optional parameter: taskId

- GET /api/sse
  - Server-Sent Events endpoint for real-time updates
  - Returns: Task updates every 2 seconds

### 4. Real-time Updates
- Uses Server-Sent Events (SSE) instead of WebSocket
- More efficient for one-way server->client updates
- Automatic reconnection handling
- Browser-native EventSource API

### 5. Frontend Components
- Task submission form
- Task list with status indicators
- Progress bars for active tasks
- SSE client for real-time updates

## Implementation Changes (SSE Migration)

1. **Removed Components:**
   - WebSocket server implementation
   - WebSocket client code

2. **Added Components:**
   - SSE endpoint (/api/sse)
   - EventSource client in TaskList
   - Simplified update mechanism

3. **Benefits:**
   - Reduced server resource usage
   - Simpler client implementation
   - Better browser compatibility
   - Automatic reconnection

## Testing Strategy
- Unit tests for TaskService
- Integration tests for API endpoints
- SSE endpoint tests
- End-to-end testing for complete workflow
