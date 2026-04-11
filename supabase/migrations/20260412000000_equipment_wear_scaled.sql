-- Desgaste de equipo escalado por rareza × slot.
--
-- La función antigua `reduce_equipment_durability` restaba `amount` plano a
-- todos los ítems equipados. Eso penalizaba a los legendarios (reparar un
-- legendario cuesta ~8× que un común, pero se rompía al mismo ritmo) y no
-- reflejaba la intuición del jugador de que un anillo no sufre como una
-- espada.
--
-- Esta nueva función aplica dos multiplicadores antes de restar:
--
--   Rareza: common 1.00 · uncommon 0.85 · rare 0.70 · epic 0.55 · legendary 0.40
--   Slot:   main_hand 1.20 · off_hand 1.10 · armor* 1.00 · accessory 0.70
--
-- * armor = helmet/chest/arms/legs/feet
--
-- Consecuencia: un legendary main_hand con max_durability 120 y amount=2
-- pierde round(2×0.4×1.2)=1 por combate → aguanta ~120 combates. Un common
-- main_hand con max_durability 50 pierde round(2×1.0×1.2)=2 → ~25 combates.
-- El legendary dura ~5× más, compensando su coste de reparación.
--
-- La función antigua se mantiene por si algo externo la llama.

create or replace function reduce_equipment_durability_scaled(p_hero_id uuid, amount integer)
returns void language sql security definer as $$
  update public.inventory_items ii
  set current_durability = greatest(0, ii.current_durability - round(
    amount::numeric *
    case ic.rarity
      when 'common'    then 1.00
      when 'uncommon'  then 0.85
      when 'rare'      then 0.70
      when 'epic'      then 0.55
      when 'legendary' then 0.40
      else 1.00
    end *
    case ic.slot
      when 'main_hand' then 1.20
      when 'off_hand'  then 1.10
      when 'helmet'    then 1.00
      when 'chest'     then 1.00
      when 'arms'      then 1.00
      when 'legs'      then 1.00
      when 'feet'      then 1.00
      when 'accessory' then 0.70
      else 1.00
    end
  )::integer)
  from public.item_catalog ic
  where ii.hero_id = p_hero_id
    and ii.equipped_slot is not null
    and ii.catalog_id = ic.id;
$$;
