-- Migration: add initial_summary_text column to chat_summaries
-- Run once against the production database.

ALTER TABLE chat_summaries ADD COLUMN IF NOT EXISTS initial_summary_text TEXT;
