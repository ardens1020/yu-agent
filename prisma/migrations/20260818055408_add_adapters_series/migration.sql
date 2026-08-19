-- CreateTable
CREATE TABLE "NoticeSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "monthPattern" TEXT NOT NULL DEFAULT '[]',
    "medianIntervalDays" INTEGER,
    "intervalStdDays" INTEGER,
    "firstSeenAt" DATETIME,
    "lastSeenAt" DATETIME,
    "nextExpectedFrom" DATETIME,
    "nextExpectedTo" DATETIME,
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "articleNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "writer" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "contentHtml" TEXT,
    "contentText" TEXT,
    "originUrl" TEXT NOT NULL,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT,
    "aiTags" TEXT NOT NULL DEFAULT '[]',
    "deadlineAt" DATETIME,
    "deadlineSource" TEXT,
    "targetGrades" TEXT NOT NULL DEFAULT '[]',
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "enrichedAt" DATETIME,
    "company" TEXT,
    "recruitStatus" TEXT,
    "eventStart" DATETIME,
    "eventEnd" DATETIME,
    "structured" TEXT NOT NULL DEFAULT '{}',
    "seriesId" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notice_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "NoticeSeries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notice" ("actionRequired", "adminNote", "aiTags", "articleNo", "attachments", "contentHash", "contentHtml", "contentText", "createdAt", "deadlineAt", "enrichedAt", "id", "isHidden", "isPinned", "originUrl", "publishedAt", "sourceId", "summary", "targetGrades", "title", "updatedAt", "views", "writer") SELECT "actionRequired", "adminNote", "aiTags", "articleNo", "attachments", "contentHash", "contentHtml", "contentText", "createdAt", "deadlineAt", "enrichedAt", "id", "isHidden", "isPinned", "originUrl", "publishedAt", "sourceId", "summary", "targetGrades", "title", "updatedAt", "views", "writer" FROM "Notice";
DROP TABLE "Notice";
ALTER TABLE "new_Notice" RENAME TO "Notice";
CREATE INDEX "Notice_publishedAt_idx" ON "Notice"("publishedAt");
CREATE INDEX "Notice_contentHash_idx" ON "Notice"("contentHash");
CREATE INDEX "Notice_seriesId_idx" ON "Notice"("seriesId");
CREATE INDEX "Notice_deadlineAt_idx" ON "Notice"("deadlineAt");
CREATE UNIQUE INDEX "Notice_sourceId_articleNo_key" ON "Notice"("sourceId", "articleNo");
CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "boardNo" TEXT NOT NULL,
    "listPath" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "adapter" TEXT NOT NULL DEFAULT 'YU_BOARD',
    "origin" TEXT NOT NULL DEFAULT 'https://www.yu.ac.kr',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastCrawledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Source" ("boardNo", "category", "createdAt", "id", "isActive", "lastCrawledAt", "listPath", "name", "siteId", "sortOrder", "updatedAt") SELECT "boardNo", "category", "createdAt", "id", "isActive", "lastCrawledAt", "listPath", "name", "siteId", "sortOrder", "updatedAt" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE UNIQUE INDEX "Source_listPath_key" ON "Source"("listPath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "NoticeSeries_key_key" ON "NoticeSeries"("key");

-- CreateIndex
CREATE INDEX "NoticeSeries_nextExpectedFrom_idx" ON "NoticeSeries"("nextExpectedFrom");

-- CreateIndex
CREATE INDEX "NoticeSeries_confidence_idx" ON "NoticeSeries"("confidence");
