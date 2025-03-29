-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "error" TEXT,
    "needTTS" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Task" ("createdAt", "error", "id", "language", "progress", "status", "title", "updatedAt", "url", "videoId") SELECT "createdAt", "error", "id", "language", "progress", "status", "title", "updatedAt", "url", "videoId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
