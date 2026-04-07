-- Añade campo description a item_catalog
ALTER TABLE public.item_catalog ADD COLUMN IF NOT EXISTS description text;

-- ─── Accesorios ───────────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Un sencillo anillo de cobre extraído de las minas del este. Poca magia, pero nunca falla.'
  WHERE name = 'Anillo de Cobre';

UPDATE public.item_catalog SET description = 'Anillo labrado en plata pura. Los herreros dicen que absorbe parte del daño antes de que llegue al portador.'
  WHERE name = 'Anillo de Plata';

UPDATE public.item_catalog SET description = 'Amuleto imbuido con energía arcana. Quienes lo llevan notan cómo sus pensamientos se agudzan en combate.'
  WHERE name = 'Amuleto Arcano';

-- ─── Brazos ───────────────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Guantes de cuero crudo cosidos a mano. Protegen lo justo para que el guerrero no pierda sensibilidad en los dedos.'
  WHERE name = 'Guantes de Cuero';

UPDATE public.item_catalog SET description = 'Guanteletes de hierro macizo. Pesados pero resistentes, capaces de aguantar golpes que destrozarían cualquier cuero.'
  WHERE name = 'Guanteletes de Hierro';

UPDATE public.item_catalog SET description = 'Forjados en acero templado al frío del norte. Sus placas articuladas permiten aferrar el arma sin perder protección.'
  WHERE name = 'Guanteletes de Acero';

-- ─── Pecho ────────────────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Peto de cuero endurecido con aceite de dragon. Ligero y flexible, ideal para quienes priorizan la velocidad sobre la armadura.'
  WHERE name = 'Peto de Cuero';

UPDATE public.item_catalog SET description = 'Peto de hierro remachado. Poco elegante, pero ha salvado la vida de más de un soldado raso en las fronteras del reino.'
  WHERE name = 'Peto de Hierro';

UPDATE public.item_catalog SET description = 'Armadura de placas de acero ensambladas por un maestro herrero. Símbolo de un guerrero que ha sobrevivido lo suficiente para costeársela.'
  WHERE name = 'Armadura de Acero';

-- ─── Pies ─────────────────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Botas de cuero curtido con suela gruesa. No hacen ruido al caminar, lo que las hace favoritas entre exploradores y ladrones.'
  WHERE name = 'Botas de Cuero';

UPDATE public.item_catalog SET description = 'Botas de hierro reforzadas en puntera y talón. Lentas pero implacables: un patada con estas botas deja huella.'
  WHERE name = 'Botas de Hierro';

UPDATE public.item_catalog SET description = 'Botas de acero articuladas en el tobillo. Permiten movimiento completo sin sacrificar la protección de las espinillas.'
  WHERE name = 'Botas de Acero';

-- ─── Casco ────────────────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Capucha de cuero con refuerzo en la coronilla. Discreta y funcional, no levanta sospechas pero absorbe los golpes más ligeros.'
  WHERE name = 'Capucha de Cuero';

UPDATE public.item_catalog SET description = 'Casco de hierro con visera abatible. Estándar en los ejércitos del reino, reconocible en mil batallas y en mil derrotas.'
  WHERE name = 'Casco de Hierro';

UPDATE public.item_catalog SET description = 'Yelmo de acero bruñido con cimera grabada. Su peso equilibrado lo convierte en el preferido de los caballeros veteranos.'
  WHERE name = 'Yelmo de Acero';

-- ─── Piernas ──────────────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Grebas de cuero cosidas a la rodillera. Protegen el muslo y la corva sin entorpecer el galope ni la carrera.'
  WHERE name = 'Grebas de Cuero';

UPDATE public.item_catalog SET description = 'Grebas de hierro con bisagras en la rodilla. Chirrian un poco, pero han parado más de una estocada baja.'
  WHERE name = 'Grebas de Hierro';

UPDATE public.item_catalog SET description = 'Grebas de acero forjadas en una sola pieza. Protección completa desde la cadera hasta el tobillo sin puntos débiles visibles.'
  WHERE name = 'Grebas de Acero';

-- ─── Armas mano principal ─────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Espada corta de doble filo. Primera arma de muchos aventureros: fácil de manejar, difícil de dominar de verdad.'
  WHERE name = 'Espada Corta';

UPDATE public.item_catalog SET description = 'Lanza de madera con punta de sílex. Arma primitiva pero efectiva en manos expertas: mantiene la distancia y sangra al enemigo.'
  WHERE name = 'Lanza de Madera';

UPDATE public.item_catalog SET description = 'Mazo fabricado con hueso de bestia. Rudo y contundente, no necesita filo para romper huesos.'
  WHERE name = 'Mazo de Hueso';

UPDATE public.item_catalog SET description = 'Arco corto tallado en madera de tejo. Rango limitado, pero en espacios cerrados es tan letal como cualquier espada.'
  WHERE name = 'Arco Corto';

UPDATE public.item_catalog SET description = 'Espada de hierro de hoja ancha. Fiable en las manos de cualquier soldado, no brilla pero tampoco decepciona.'
  WHERE name = 'Espada de Hierro';

UPDATE public.item_catalog SET description = 'Lanza de hierro de asta larga. Favorita en formaciones de infantería, mantiene al enemigo a distancia mientras los aliados flanquean.'
  WHERE name = 'Lanza de Hierro';

UPDATE public.item_catalog SET description = 'Mazo de hierro con cabeza hexagonal. Cada golpe hace vibrar el escudo del rival. Los que sobreviven recuerdan el sonido para siempre.'
  WHERE name = 'Mazo de Hierro';

UPDATE public.item_catalog SET description = 'Arco de caza con empuñadura envuelta en cuero. Diseñado para largas jornadas en el bosque, preciso y silencioso.'
  WHERE name = 'Arco de Caza';

UPDATE public.item_catalog SET description = 'Mandoble de hierro de dos manos. Requiere fuerza y espacio, pero quien lo maneja bien no necesita golpear dos veces.'
  WHERE name = 'Gran Espada de Hierro';

UPDATE public.item_catalog SET description = 'Gran mazo de hierro con mango de roble. Lento pero devastador: más que un arma, es una sentencia.'
  WHERE name = 'Gran Mazo de Hierro';

UPDATE public.item_catalog SET description = 'Espada de acero con filo doble reforzado. El equilibrio perfecto entre velocidad y daño que buscan los duelistas consumados.'
  WHERE name = 'Espada de Acero';

UPDATE public.item_catalog SET description = 'Lanza de acero con punta en hoja de diamante. Perfora armaduras de hierro sin apenas esfuerzo en manos entrenadas.'
  WHERE name = 'Lanza de Acero';

UPDATE public.item_catalog SET description = 'Mazo de guerra de acero forjado. Preferido por los paladines: contundente, justo y sin pretensiones de elegancia.'
  WHERE name = 'Mazo de Guerra';

UPDATE public.item_catalog SET description = 'Arco largo de madera de fresno. Su alcance supera con creces al de cualquier arco corto; en campo abierto, cambia el curso de la batalla.'
  WHERE name = 'Arco Largo';

UPDATE public.item_catalog SET description = 'Mandoble de acero de dos manos con hoja grabada. Requiere un guerrero de élite para blandirlo, pero en sus manos se convierte en leyenda.'
  WHERE name = 'Gran Espada de Acero';

UPDATE public.item_catalog SET description = 'Gran mazo de acero con cabeza de cuatro caras. Pensado para destrozar armaduras pesadas. Quienes lo usan no suelen necesitar una segunda oportunidad.'
  WHERE name = 'Gran Mazo de Acero';

-- ─── Mano secundaria ──────────────────────────────────────────────────────────
UPDATE public.item_catalog SET description = 'Escudo de tablas de madera unidas con flejes de hierro. No durará eternamente, pero aguantará lo suficiente para salvar el cuello.'
  WHERE name = 'Escudo de Madera';

UPDATE public.item_catalog SET description = 'Escudo de hierro con umbón central. Aguanta golpes que astillarían cualquier madera y devuelve empujones con autoridad.'
  WHERE name = 'Escudo de Hierro';

UPDATE public.item_catalog SET description = 'Escudo de acero templado con borde reforzado. La última línea de defensa de quien sabe que tarde o temprano alguien intentará atravesarle.'
  WHERE name = 'Escudo de Acero';
