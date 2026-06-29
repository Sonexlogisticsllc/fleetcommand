-- ═══════════════════════════════════════════════════════════════════════════
-- SONEX DISPATCH HUB — Supabase SQL Schema + Storage Setup
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Carrier Documents Table ─────────────────────────────────────────────────
-- Stores uploaded compliance documents (CDL, insurance, registration, etc.)
-- with upsert constraint: one document per type per carrier

CREATE TABLE IF NOT EXISTS carrier_documents (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id        UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  doc_type          TEXT NOT NULL,
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_path         TEXT,                       -- Supabase Storage path for deletion
  expiration_date   DATE,                       -- NULL for non-expiring docs
  uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by       TEXT NOT NULL DEFAULT 'carrier',  -- 'admin' | 'carrier'
  notes             TEXT,
  UNIQUE(carrier_id, doc_type)                  -- one doc per type per carrier (upsert)
);

-- Index for fast carrier lookup
CREATE INDEX IF NOT EXISTS idx_carrier_documents_carrier_id ON carrier_documents(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_documents_expiration ON carrier_documents(expiration_date);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Enable RLS and allow anon key to read/write (since we use anon key client-side)
-- For production, tighten these policies to require auth

ALTER TABLE carrier_documents ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (Phase 1 — tighten in Phase 2 with auth)
CREATE POLICY "Allow all carrier_documents" ON carrier_documents
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Verify other tables exist ───────────────────────────────────────────────
-- These should already exist from your Supabase setup. Run if not:

-- CREATE TABLE IF NOT EXISTS carriers ( ... );  -- Already set up
-- CREATE TABLE IF NOT EXISTS loads ( ... );      -- Already set up
-- CREATE TABLE IF NOT EXISTS messages ( ... );   -- Already set up

-- ─── STORAGE BUCKETS ─────────────────────────────────────────────────────────
-- Run in Supabase Dashboard → Storage → Create bucket (or use SQL below)
-- NOTE: Storage bucket creation via SQL requires Supabase >=2.x

-- Option A: Create via Dashboard
-- Go to Storage → "New bucket" → create these 4 buckets as PUBLIC:
--   1. load-documents
--   2. carrier-documents
--   3. message-attachments
--   4. cargo-photos

-- Option B: SQL (if your Supabase version supports it)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES
--   ('load-documents', 'load-documents', true),
--   ('carrier-documents', 'carrier-documents', true),
--   ('message-attachments', 'message-attachments', true),
--   ('cargo-photos', 'cargo-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies (run these for each bucket in Storage → Policies tab)
-- Or add via Dashboard → Storage → [bucket] → Policies → Add policy

-- For load-documents:
CREATE POLICY "Public read load-documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'load-documents');
CREATE POLICY "Authenticated upload load-documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'load-documents');
CREATE POLICY "Authenticated update load-documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'load-documents');
CREATE POLICY "Authenticated delete load-documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'load-documents');

-- For carrier-documents:
CREATE POLICY "Public read carrier-documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'carrier-documents');
CREATE POLICY "Authenticated upload carrier-documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'carrier-documents');
CREATE POLICY "Authenticated update carrier-documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'carrier-documents');
CREATE POLICY "Authenticated delete carrier-documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'carrier-documents');

-- For message-attachments:
CREATE POLICY "Public read message-attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'message-attachments');
CREATE POLICY "Authenticated upload message-attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'message-attachments');
CREATE POLICY "Authenticated update message-attachments" ON storage.objects
  FOR UPDATE USING (bucket_id = 'message-attachments');
CREATE POLICY "Authenticated delete message-attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'message-attachments');

-- For cargo-photos:
CREATE POLICY "Public read cargo-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'cargo-photos');
CREATE POLICY "Authenticated upload cargo-photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cargo-photos');
CREATE POLICY "Authenticated update cargo-photos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'cargo-photos');
CREATE POLICY "Authenticated delete cargo-photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'cargo-photos');

-- ─── DONE ────────────────────────────────────────────────────────────────────
-- After running:
-- 1. Create the 4 Storage buckets in Dashboard → Storage (set to Public)
-- 2. Deploy the app and test uploads
-- 3. Files will appear in Storage → [bucket] → browse files
