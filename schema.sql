CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{2,32}$'),
  name text NOT NULL,
  password_hash text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edition text NOT NULL CHECK (edition ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  title text NOT NULL,
  body_md text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'published')),
  publish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'draft') = (publish_at IS NULL))
);

CREATE TABLE IF NOT EXISTS comments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_views (
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_views ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS posts_edition_publish_at_idx ON posts (edition, publish_at);
CREATE INDEX IF NOT EXISTS posts_publish_at_idx ON posts (publish_at);
CREATE INDEX IF NOT EXISTS posts_author_id_idx ON posts (author_id);
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments (post_id, created_at);

CREATE OR REPLACE VIEW visible_posts AS
  SELECT * FROM posts WHERE status <> 'draft' AND publish_at <= now();

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id integer NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS rota_slots (
  week_start date PRIMARY KEY CHECK (extract(isodow FROM week_start) = 1),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION unread_for(me integer)
RETURNS TABLE (post_id integer, is_new boolean, new_comment_count integer)
LANGUAGE sql STABLE AS $$
  SELECT p.id,
    (v.user_id IS NULL AND p.author_id <> me AND p.publish_at > now() - interval '30 days'),
    (SELECT count(*) FROM comments c
      WHERE c.post_id = p.id
        AND c.author_id <> me
        AND c.created_at > now() - interval '30 days'
        AND c.created_at > COALESCE(v.last_seen_at, CASE WHEN p.author_id = me THEN p.publish_at END))::int
  FROM visible_posts p
  LEFT JOIN post_views v ON v.post_id = p.id AND v.user_id = me
$$;

CREATE TABLE IF NOT EXISTS offices (
  office text PRIMARY KEY CHECK (office IN ('presidente', 'tesoureiro')),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL CONSTRAINT ledger_amount_check CHECK (amount <> 0),
  reason text NOT NULL,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_user_id_idx ON ledger (user_id);

CREATE TABLE IF NOT EXISTS decrees (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rota_slots ADD COLUMN IF NOT EXISTS pardoned boolean NOT NULL DEFAULT false;

ALTER TABLE decrees ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE OR REPLACE FUNCTION jornal_now()
RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT value::timestamptz FROM settings WHERE key = 'fake_now'), now())
$$;

CREATE TABLE IF NOT EXISTS secret_santa (
  year integer NOT NULL,
  giver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (year, giver_id),
  UNIQUE (year, receiver_id),
  CHECK (giver_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS santa_cards (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year integer NOT NULL,
  from_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advent_doors (
  year integer NOT NULL,
  door integer NOT NULL CHECK (door BETWEEN 1 AND 24),
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, door, user_id)
);

CREATE TABLE IF NOT EXISTS resolutions (
  year integer NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, user_id)
);

CREATE TABLE IF NOT EXISTS resolution_votes (
  year integer NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kept boolean NOT NULL,
  PRIMARY KEY (year, user_id, voter_id),
  CHECK (user_id <> voter_id)
);

CREATE TABLE IF NOT EXISTS carnival_masks (
  day date NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mask_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (day, user_id),
  UNIQUE (day, mask_id)
);

CREATE TABLE IF NOT EXISTS easter_eggs (
  year integer NOT NULL,
  egg integer NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  found_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, egg, user_id)
);

CREATE OR REPLACE FUNCTION member_label(uid integer)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT '🎭 ' || mu.name
      FROM carnival_masks m JOIN users mu ON mu.id = m.mask_id
      WHERE m.user_id = uid AND m.day = (jornal_now() AT TIME ZONE 'Europe/Lisbon')::date),
    (SELECT u.name || coalesce((
        SELECT CASE o.office WHEN 'presidente' THEN ' 👑' WHEN 'tesoureiro' THEN ' 💰' END
        FROM offices o WHERE o.user_id = u.id
        ORDER BY o.office LIMIT 1
      ), '')
      FROM users u WHERE u.id = uid)
  )
$$;

CREATE OR REPLACE FUNCTION jornal_simulating()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM settings WHERE key = 'fake_now')
$$;

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE secret_santa ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE santa_cards ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE advent_doors ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE resolutions ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE resolution_votes ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE carnival_masks ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();
ALTER TABLE easter_eggs ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT jornal_simulating();

ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_amount_check;
ALTER TABLE ledger ADD CONSTRAINT ledger_amount_check CHECK (amount <> 0);

UPDATE advent_doors
SET kind = 'graos', payload = replace(replace(payload, 'tremoços', 'grãos de café'), '🫘', '☕')
WHERE kind = 'tremocos';

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions (user_id);

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'notified_at') THEN ALTER TABLE posts ADD COLUMN notified_at timestamptz; UPDATE posts SET notified_at = now() WHERE status <> 'draft' AND publish_at <= now(); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rota_slots' AND column_name = 'notified_at') THEN ALTER TABLE rota_slots ADD COLUMN notified_at timestamptz; UPDATE rota_slots SET notified_at = now() WHERE week_start <= (now() AT TIME ZONE 'Europe/Lisbon')::date; END IF; END $$;

ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_office_check;
ALTER TABLE offices ADD CONSTRAINT offices_office_check CHECK (office IN ('presidente', 'tesoureiro', 'apostas'));

CREATE OR REPLACE FUNCTION member_label(uid integer)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT '🎭 ' || mu.name
      FROM carnival_masks m JOIN users mu ON mu.id = m.mask_id
      WHERE m.user_id = uid AND m.day = (jornal_now() AT TIME ZONE 'Europe/Lisbon')::date),
    (SELECT u.name || coalesce((
        SELECT ' ' || string_agg(CASE o.office WHEN 'presidente' THEN '👑' WHEN 'tesoureiro' THEN '💰' WHEN 'apostas' THEN '🎲' END, '' ORDER BY array_position(ARRAY['presidente', 'tesoureiro', 'apostas'], o.office))
        FROM offices o WHERE o.user_id = u.id
      ), '')
      FROM users u WHERE u.id = uid)
  )
$$;

CREATE TABLE IF NOT EXISTS bets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'void')),
  winning_option integer,
  resolved_at timestamptz,
  closing_notified_at timestamptz,
  closed_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  simulated boolean NOT NULL DEFAULT jornal_simulating()
);

CREATE TABLE IF NOT EXISTS bet_options (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bet_id integer NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  position integer NOT NULL,
  label text NOT NULL,
  UNIQUE (bet_id, position)
);

CREATE TABLE IF NOT EXISTS bet_wagers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bet_id integer NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  option_id integer NOT NULL REFERENCES bet_options(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  simulated boolean NOT NULL DEFAULT jornal_simulating()
);

CREATE INDEX IF NOT EXISTS bet_wagers_bet_id_idx ON bet_wagers (bet_id);
CREATE INDEX IF NOT EXISTS bet_options_bet_id_idx ON bet_options (bet_id);

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS bet_id integer REFERENCES bets(id) ON DELETE CASCADE;

DELETE FROM offices WHERE office = 'apostas';
ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_office_check;
ALTER TABLE offices ADD CONSTRAINT offices_office_check CHECK (office IN ('presidente', 'tesoureiro'));

CREATE TABLE IF NOT EXISTS slot_spins (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet integer NOT NULL CHECK (bet IN (1, 2, 5)),
  reels text NOT NULL,
  payout integer NOT NULL CHECK (payout >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  simulated boolean NOT NULL DEFAULT jornal_simulating()
);

CREATE INDEX IF NOT EXISTS slot_spins_user_id_idx ON slot_spins (user_id, created_at);

CREATE TABLE IF NOT EXISTS scratch_tickets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cost integer NOT NULL CHECK (cost > 0),
  cells text NOT NULL,
  prize integer NOT NULL CHECK (prize >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  scratched_at timestamptz,
  simulated boolean NOT NULL DEFAULT jornal_simulating()
);

CREATE INDEX IF NOT EXISTS scratch_tickets_user_id_idx ON scratch_tickets (user_id, created_at);

CREATE TABLE IF NOT EXISTS duck_races (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_at timestamptz NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finished')),
  winner integer CHECK (winner BETWEEN 1 AND 6),
  seed text,
  finished_at timestamptz,
  simulated boolean NOT NULL DEFAULT jornal_simulating()
);

CREATE TABLE IF NOT EXISTS duck_bets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id integer NOT NULL REFERENCES duck_races(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duck integer NOT NULL CHECK (duck BETWEEN 1 AND 6),
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  simulated boolean NOT NULL DEFAULT jornal_simulating()
);

CREATE INDEX IF NOT EXISTS duck_bets_race_id_idx ON duck_bets (race_id);

CREATE TABLE IF NOT EXISTS duels (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  challenger_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake integer NOT NULL CHECK (stake > 0),
  challenger_move text NOT NULL CHECK (challenger_move IN ('pedra', 'papel', 'tesoura')),
  opponent_move text CHECK (opponent_move IN ('pedra', 'papel', 'tesoura')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'declined', 'expired', 'cancelled')),
  winner_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  simulated boolean NOT NULL DEFAULT jornal_simulating(),
  CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS duels_opponent_idx ON duels (opponent_id, status);
