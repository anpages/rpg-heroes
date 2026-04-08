-- Nuevos recursos: fragmentos (drops en dungeons físicos) y esencia (drops en dungeons mágicos)
-- Se usan para subir el tier de armas, en sustitución de hierro y maná

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS fragments integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS essence   integer DEFAULT 0 NOT NULL;
