CREATE OR REPLACE FUNCTION xp_for_level(p_level int) RETURNS int
LANGUAGE sql IMMUTABLE AS $$ SELECT p_level * 150; $$;
