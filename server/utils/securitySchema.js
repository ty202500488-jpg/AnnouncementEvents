/**
 * Idempotent non-destructive security schema migrations for authentication,
 * OTP attempt tracking, cooldown enforcement, account lockouts, and JWT revocation.
 */
let securitySchemaPromise = null;

function ensureSecuritySchema(pool) {
    if (!securitySchemaPromise) {
        securitySchemaPromise = (async () => {
            await pool.query(`
                ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1 NOT NULL,
                    ADD COLUMN IF NOT EXISTS failed_login_attempts SMALLINT DEFAULT 0 NOT NULL,
                    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
            `);

            await pool.query(`
                ALTER TABLE pending_registrations
                    ADD COLUMN IF NOT EXISTS otp_attempts SMALLINT DEFAULT 0 NOT NULL,
                    ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
            `);

            await pool.query(`
                ALTER TABLE auth_tokens
                    ADD COLUMN IF NOT EXISTS otp_attempts SMALLINT DEFAULT 0 NOT NULL,
                    ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
            `);

            await pool.query(`
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'auth_tokens_token_type_check'
                    ) THEN
                        ALTER TABLE auth_tokens DROP CONSTRAINT auth_tokens_token_type_check;
                    END IF;
                    ALTER TABLE auth_tokens
                        ADD CONSTRAINT auth_tokens_token_type_check
                        CHECK (token_type IN ('email_verification', 'password_reset', 'revoked_jwt'));
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END $$;
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_auth_tokens_lookup
                    ON auth_tokens (token_hash, token_type, expires_at);
            `);
        })().catch((err) => {
            securitySchemaPromise = null;
            throw err;
        });
    }
    return securitySchemaPromise;
}

module.exports = {
    ensureSecuritySchema
};
