// Shared, migration-safe schema. Both the live service and migration apply
// exactly the same definitions; no raw customer data or keys belong here.
import {zebraChatSchema} from './zebra-chat-server.js';

export const MARKETPLACE_TABLES=Object.freeze([
 'email_codes','users','sessions','purchases','licenses',
 'purchase_notifications','free_promo_redemptions',
 'zebra_chat_threads','zebra_chat_messages'
]);

export const marketplaceSchema=[
 `CREATE TABLE IF NOT EXISTS email_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at BIGINT NOT NULL, sent_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS purchases (session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), sku TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', payment_intent TEXT, created_at BIGINT NOT NULL, paid_at BIGINT)`,
 `CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), sku TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL, revoked_at BIGINT, last_used_at BIGINT)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS licenses_one_active_per_product ON licenses (user_id,sku) WHERE revoked_at IS NULL`,
 // Created on existing Neon databases at startup. Excluded from the original one-time
 // Render->Neon migration manifest: it did not exist on the legacy source.
 `CREATE TABLE IF NOT EXISTS license_network_bindings (license_id TEXT PRIMARY KEY REFERENCES licenses(id), network_hash TEXT NOT NULL, first_seen_at BIGINT NOT NULL, last_seen_at BIGINT NOT NULL, blocked_attempts INTEGER NOT NULL DEFAULT 0)`,
 // Installation approval and runtime tickets intentionally excluded from one-time
 // legacy database transfer manifest; they are created on both DB engines at startup.
 `CREATE TABLE IF NOT EXISTS license_device_pairings (license_id TEXT NOT NULL REFERENCES licenses(id), device_hash TEXT NOT NULL, code_hash TEXT NOT NULL, requested_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, PRIMARY KEY(license_id,device_hash))`,
 `CREATE INDEX IF NOT EXISTS license_device_pairings_expiry ON license_device_pairings(expires_at)`,
 `CREATE TABLE IF NOT EXISTS license_device_bindings (license_id TEXT PRIMARY KEY REFERENCES licenses(id), device_hash TEXT NOT NULL, approved_at BIGINT NOT NULL, last_used_at BIGINT NOT NULL, blocked_attempts INTEGER NOT NULL DEFAULT 0)`,
 `CREATE TABLE IF NOT EXISTS license_execution_tickets (token_hash TEXT PRIMARY KEY, license_id TEXT NOT NULL REFERENCES licenses(id), sku TEXT NOT NULL, network_hash TEXT NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, consumed_at BIGINT)`,
 `CREATE INDEX IF NOT EXISTS license_execution_tickets_expiry ON license_execution_tickets(expires_at)`,
 `CREATE TABLE IF NOT EXISTS purchase_notifications (session_id TEXT PRIMARY KEY REFERENCES purchases(session_id), sent_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS free_promo_redemptions (user_id TEXT PRIMARY KEY REFERENCES users(id), sku TEXT NOT NULL, session_id TEXT UNIQUE NOT NULL, created_at BIGINT NOT NULL, redeemed_at BIGINT)`,
 `CREATE TABLE IF NOT EXISTS order_feedback (session_id TEXT PRIMARY KEY REFERENCES purchases(session_id), user_id TEXT NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`
,
 ...zebraChatSchema
];
