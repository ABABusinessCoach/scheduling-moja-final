
CREATE TABLE public.clinic_closures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date NOT NULL,
  name       text NOT NULL DEFAULT '',
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_closures_date_unique UNIQUE (date)
);

ALTER TABLE public.clinic_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_clinic_closures" ON public.clinic_closures
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert_clinic_closures" ON public.clinic_closures
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update_clinic_closures" ON public.clinic_closures
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "delete_clinic_closures" ON public.clinic_closures
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
