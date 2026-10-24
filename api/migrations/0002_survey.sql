-- Website survey and waitlist, used to test demand before launching the apps.

CREATE TABLE survey_responses (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,             -- family | traveller | helper | other
  answers     TEXT NOT NULL,             -- JSON object of the full response
  email       TEXT,
  may_contact INTEGER NOT NULL DEFAULT 0,
  may_quote   INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX survey_created ON survey_responses(created_at);
CREATE INDEX survey_ip ON survey_responses(ip_hash, created_at);

CREATE TABLE waitlist (
  email       TEXT PRIMARY KEY,
  role        TEXT,
  platform    TEXT,                      -- ios | android | either
  source      TEXT,                      -- which page or button
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Stories submitted through the site; shown publicly only once approved.
CREATE TABLE stories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  story       TEXT NOT NULL,
  email       TEXT,
  approved    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
