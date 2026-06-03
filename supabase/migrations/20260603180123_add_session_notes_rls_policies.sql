/*
  # Add RLS Policies for session_notes

  The session_notes table was created but never had RLS policies added,
  making it inaccessible to any authenticated user. This migration adds
  the four standard CRUD policies so the session notes tracking feature works.

  ## Changes
  - Add SELECT, INSERT, UPDATE, DELETE policies on session_notes for authenticated users
*/

CREATE POLICY "Authenticated users can read session_notes"
  ON session_notes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert session_notes"
  ON session_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update session_notes"
  ON session_notes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete session_notes"
  ON session_notes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
