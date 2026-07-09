-- 此 SQL 用於在 Supabase 的 SQL Editor 中執行，建立對應的資料表
-- 因為是單一使用者應用程式，所以不特別啟用 Row Level Security (RLS) 的限制，
-- 或是你可以自己根據 Supabase Auth 加上 auth.uid() 的過濾。

CREATE TABLE cards (
  "id" text PRIMARY KEY,
  "deckId" text NOT NULL,
  "front" text NOT NULL,
  "back" text NOT NULL,
  "tags" text[] DEFAULT '{}',
  "cardType" text NOT NULL,
  "due" bigint NOT NULL,
  "stability" float8 NOT NULL,
  "difficulty" float8 NOT NULL,
  "elapsedDays" float8 NOT NULL,
  "scheduledDays" float8 NOT NULL,
  "reps" integer NOT NULL,
  "lapses" integer NOT NULL,
  "state" integer NOT NULL,
  "lastReview" bigint,
  "updatedAt" bigint NOT NULL,
  "createdAt" bigint NOT NULL,
  "deletedAt" bigint,
  "syncVersion" integer NOT NULL DEFAULT 1
);

CREATE TABLE decks (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "parentId" text,
  "icon" text,
  "newCardsPerDay" integer NOT NULL,
  "reviewsPerDay" integer NOT NULL,
  "targetRetention" float8 NOT NULL,
  "updatedAt" bigint NOT NULL,
  "createdAt" bigint NOT NULL,
  "deletedAt" bigint,
  "syncVersion" integer NOT NULL DEFAULT 1
);

-- 建立索引以加速同步查詢
CREATE INDEX idx_cards_updated_at ON cards("updatedAt");
CREATE INDEX idx_decks_updated_at ON decks("updatedAt");
