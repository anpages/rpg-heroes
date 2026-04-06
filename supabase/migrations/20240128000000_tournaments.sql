-- Sistema de Torneos semanales PvE
-- Bracket por héroe, 3 rondas: cuartos → semifinal → final

CREATE TABLE tournament_brackets (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hero_id        uuid REFERENCES heroes(id) ON DELETE CASCADE,
  week_start     date NOT NULL,
  rivals         jsonb NOT NULL,      -- array de 3 rivales pre-generados
  current_round  integer DEFAULT 0,  -- 0=inscrito, 1=ronda1 superada, 2=ronda2, 3=campeón
  eliminated     boolean DEFAULT false,
  champion       boolean DEFAULT false,
  registered_at  timestamptz DEFAULT now(),
  UNIQUE(hero_id, week_start)
);

CREATE TABLE tournament_matches (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bracket_id  uuid REFERENCES tournament_brackets(id) ON DELETE CASCADE,
  round       integer NOT NULL,  -- 1, 2 o 3
  won         boolean NOT NULL,
  log         jsonb,
  rewards     jsonb,
  hero_max_hp integer,
  rival_max_hp integer,
  played_at   timestamptz DEFAULT now()
);

CREATE INDEX ON tournament_brackets(hero_id, week_start);
CREATE INDEX ON tournament_matches(bracket_id, round);
