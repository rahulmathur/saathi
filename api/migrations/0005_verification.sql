-- Identity checks. A traveller must be verified before their family can ask
-- for, or accept, an introduction. Only the result is kept, never documents.

CREATE TABLE verifications (
  id              TEXT PRIMARY KEY,
  traveller_id    TEXT NOT NULL REFERENCES travellers(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,             -- mock | the provider plugged in later
  provider_ref    TEXT,                      -- the provider's id for this check
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'verified', 'failed', 'cancelled')),
  method          TEXT,                      -- e.g. digilocker, passport, drivers_licence
  country         TEXT,                      -- issuing country of the document, ISO code
  failure_reason  TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX verifications_provider_ref ON verifications(provider, provider_ref);
CREATE INDEX verifications_traveller ON verifications(traveller_id, created_at);

ALTER TABLE travellers ADD COLUMN id_verified_at TEXT;
ALTER TABLE travellers ADD COLUMN id_verified_method TEXT;

-- The sample travellers showed "ID verified" and "Community vouched" for
-- demonstration. Now that the badge means a real check, clear them.
UPDATE travellers SET id_verified = 0, vouched_by = NULL WHERE id LIKE 'sample-%';
