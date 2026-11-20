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
  amount integer NOT NULL CHECK (amount <> 0 AND abs(amount) <= 100),
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

CREATE OR REPLACE FUNCTION member_label(uid integer)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT u.name || coalesce((
    SELECT CASE o.office WHEN 'presidente' THEN ' 👑' WHEN 'tesoureiro' THEN ' 💰' END
    FROM offices o WHERE o.user_id = u.id
    ORDER BY o.office LIMIT 1
  ), '')
  FROM users u WHERE u.id = uid
$$;

ALTER TABLE decrees ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
