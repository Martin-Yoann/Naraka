-- Authentication is independent of market-data retention. No access tokens are persisted.
CREATE TABLE IF NOT EXISTS zx_auth_users (
 id uuid PRIMARY KEY, appid text NOT NULL, openid text NOT NULL, unionid text,
 nickname text, avatar text, last_login timestamptz NOT NULL,
 UNIQUE(appid,openid)
);
CREATE TABLE IF NOT EXISTS zx_auth_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES zx_auth_users(id), expires timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS zx_auth_sessions_expiry ON zx_auth_sessions(expires);
CREATE TABLE IF NOT EXISTS zx_auth_tickets (
 id uuid PRIMARY KEY, secret_hash text NOT NULL, status text NOT NULL,
 user_id uuid REFERENCES zx_auth_users(id), confirm_hash text, expires timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS zx_auth_tickets_expiry ON zx_auth_tickets(expires);
CREATE TABLE IF NOT EXISTS zx_auth_flows (
 state_hash text PRIMARY KEY, mode text NOT NULL, ticket_id uuid, expires timestamptz NOT NULL
);
