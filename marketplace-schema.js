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
 `CREATE TABLE IF NOT EXISTS purchase_notifications (session_id TEXT PRIMARY KEY REFERENCES purchases(session_id), sent_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS free_promo_redemptions (user_id TEXT PRIMARY KEY REFERENCES users(id), sku TEXT NOT NULL, session_id TEXT UNIQUE NOT NULL, created_at BIGINT NOT NULL, redeemed_at BIGINT)`,
 `CREATE TABLE IF NOT EXISTS order_feedback (session_id TEXT PRIMARY KEY REFERENCES purchases(session_id), user_id TEXT NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`
,
 ...zebraChatSchema
];
