CREATE TABLE IF NOT EXISTS zx_user_preferences (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES zx_auth_users(id),
 name text NOT NULL, criteria jsonb NOT NULL, wechat boolean NOT NULL DEFAULT false,
 enabled boolean NOT NULL DEFAULT true, revision uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zx_preferences_owner ON zx_user_preferences(user_id);
CREATE TABLE IF NOT EXISTS zx_user_messages (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES zx_auth_users(id),
 preference_id uuid REFERENCES zx_user_preferences(id) ON DELETE SET NULL,
 revision uuid NOT NULL, item_id text NOT NULL, price_cents bigint NOT NULL,
 payload jsonb NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 wechat_status text NOT NULL DEFAULT 'not-requested', delivery_at timestamptz,
 UNIQUE(user_id,preference_id,revision,item_id,price_cents)
);
CREATE INDEX IF NOT EXISTS zx_messages_owner ON zx_user_messages(user_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS zx_messages_pending ON zx_user_messages(wechat_status,created_at);
CREATE INDEX IF NOT EXISTS zx_messages_retention ON zx_user_messages(created_at);
CREATE TABLE IF NOT EXISTS zx_user_settings (
 user_id uuid PRIMARY KEY REFERENCES zx_auth_users(id), alerts_enabled boolean NOT NULL DEFAULT true,
 lottery_auto_refresh boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zx_user_favorites (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES zx_auth_users(id), item_id text NOT NULL,
 payload jsonb NOT NULL, remind boolean NOT NULL DEFAULT false, wechat boolean NOT NULL DEFAULT false,
 revision uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,item_id)
);
CREATE INDEX IF NOT EXISTS zx_favorites_owner ON zx_user_favorites(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS zx_favorites_reminders ON zx_user_favorites(item_id) WHERE remind=true;
