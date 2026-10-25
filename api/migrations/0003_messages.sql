-- Messages sent through the website's contact form (there is no public email address yet).

CREATE TABLE messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  topic       TEXT NOT NULL,             -- question | privacy | partnership | other
  message     TEXT NOT NULL,
  ip_hash     TEXT,
  handled     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX messages_created ON messages(created_at);
CREATE INDEX messages_ip ON messages(ip_hash, created_at);
