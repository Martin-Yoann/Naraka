CREATE TABLE IF NOT EXISTS zx_inventory (
 id text PRIMARY KEY, type text NOT NULL, first_seen timestamptz NOT NULL,
 last_seen timestamptz NOT NULL, payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS zx_inventory_type_seen ON zx_inventory(type,last_seen DESC);
CREATE INDEX IF NOT EXISTS zx_inventory_price ON zx_inventory(((payload->>'priceCents')::bigint));
CREATE TABLE IF NOT EXISTS zx_scan(type text PRIMARY KEY,payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS zx_settings(key text PRIMARY KEY,payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS zx_batches(at timestamptz PRIMARY KEY,coverage text NOT NULL,payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS zx_media(id text PRIMARY KEY,payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS zx_leases(name text PRIMARY KEY,owner text NOT NULL,expires timestamptz NOT NULL);
