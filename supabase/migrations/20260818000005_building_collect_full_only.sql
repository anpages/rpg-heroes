-- Actualiza collect_building_production y collect_all_buildings_production
-- para requerir que el almacén esté lleno antes de recolectar.
-- BUILDING_STORAGE_HOURS sube de 2 a 4h (ya gestionado en gameConstants.js).

CREATE OR REPLACE FUNCTION collect_building_production(
  p_player_id    uuid,
  p_building_type text,
  p_resource     text,
  p_rate         numeric,
  p_cap          int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bld          record;
  v_elapsed      numeric;
  v_produced     int;
  v_advance_secs numeric;
BEGIN
  SELECT * INTO v_bld FROM buildings
  WHERE player_id = p_player_id AND type = p_building_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edificio no encontrado';
  END IF;
  IF NOT v_bld.unlocked OR v_bld.level <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'collected', 0, 'resource', p_resource);
  END IF;

  v_elapsed  := GREATEST(0, EXTRACT(EPOCH FROM (clock_timestamp() - v_bld.production_collected_at)) / 3600.0);
  v_produced := LEAST(p_cap, floor(p_rate * v_elapsed)::int);

  -- Solo recolectar si el almacén está lleno
  IF v_produced < p_cap THEN
    RETURN jsonb_build_object('ok', false, 'not_full', true, 'collected', 0, 'resource', p_resource);
  END IF;

  v_advance_secs := (v_produced::numeric / p_rate) * 3600.0;
  UPDATE buildings
  SET production_collected_at = v_bld.production_collected_at + make_interval(secs => v_advance_secs)
  WHERE id = v_bld.id;

  EXECUTE format(
    'UPDATE resources SET %I = %I + $1 WHERE player_id = $2',
    p_resource, p_resource
  ) USING v_produced, p_player_id;

  RETURN jsonb_build_object('ok', true, 'collected', v_produced, 'resource', p_resource);
END;
$$;


CREATE OR REPLACE FUNCTION collect_all_buildings_production(
  p_player_id uuid,
  p_configs   jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cfg          jsonb;
  v_bld          record;
  v_elapsed      numeric;
  v_produced     int;
  v_advance_secs numeric;
  v_totals       jsonb := '{}'::jsonb;
  v_details      jsonb := '[]'::jsonb;
  v_btype        text;
  v_resource     text;
  v_rate         numeric;
  v_cap          int;
  v_prev         int;
BEGIN
  FOR v_cfg IN SELECT * FROM jsonb_array_elements(p_configs)
  LOOP
    v_btype    := v_cfg->>'type';
    v_resource := v_cfg->>'resource';
    v_rate     := (v_cfg->>'rate')::numeric;
    v_cap      := (v_cfg->>'cap')::int;

    SELECT * INTO v_bld FROM buildings
    WHERE player_id = p_player_id AND type = v_btype
    FOR UPDATE;

    IF NOT FOUND OR NOT v_bld.unlocked OR v_bld.level <= 0 THEN
      CONTINUE;
    END IF;

    v_elapsed  := GREATEST(0, EXTRACT(EPOCH FROM (clock_timestamp() - v_bld.production_collected_at)) / 3600.0);
    v_produced := LEAST(v_cap, floor(v_rate * v_elapsed)::int);

    -- Solo recolectar edificios llenos
    IF v_produced < v_cap THEN
      CONTINUE;
    END IF;

    v_advance_secs := (v_produced::numeric / v_rate) * 3600.0;
    UPDATE buildings
    SET production_collected_at = v_bld.production_collected_at + make_interval(secs => v_advance_secs)
    WHERE id = v_bld.id;

    v_prev := COALESCE((v_totals->>v_resource)::int, 0);
    v_totals := v_totals || jsonb_build_object(v_resource, v_prev + v_produced);

    v_details := v_details || jsonb_build_array(
      jsonb_build_object('type', v_btype, 'resource', v_resource, 'collected', v_produced)
    );
  END LOOP;

  UPDATE resources SET
    gold  = gold  + COALESCE((v_totals->>'gold')::int, 0),
    iron  = iron  + COALESCE((v_totals->>'iron')::int, 0),
    wood  = wood  + COALESCE((v_totals->>'wood')::int, 0),
    mana  = mana  + COALESCE((v_totals->>'mana')::int, 0),
    herbs = herbs + COALESCE((v_totals->>'herbs')::int, 0)
  WHERE player_id = p_player_id;

  RETURN jsonb_build_object('ok', true, 'collected', v_totals, 'details', v_details);
END;
$$;
