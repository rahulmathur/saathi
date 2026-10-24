-- Saathi schema. Times are ISO-8601 text (UTC) unless noted; flight dates and
-- clock times are local to the departure/arrival airport, as printed on tickets.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  phone       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE login_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,          -- epoch ms
  attempts    INTEGER NOT NULL DEFAULT 0
);

-- A traveller is a person whose trips are tracked: usually a parent managed by
-- a family member, or the user themself when they offer to help others.
CREATE TABLE travellers (
  id               TEXT PRIMARY KEY,
  owner_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  relation         TEXT,                  -- how the owner refers to them: "Maa", "Papa", "Me"
  age              INTEGER,
  kind             TEXT NOT NULL DEFAULT 'senior' CHECK (kind IN ('senior', 'helper')),
  home_city        TEXT,
  visiting_city    TEXT,
  languages        TEXT NOT NULL DEFAULT '[]',   -- JSON array of language names
  diet             TEXT,
  mobility         TEXT,
  phone            TEXT,
  about            TEXT,
  id_verified      INTEGER NOT NULL DEFAULT 0,
  vouched_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX travellers_owner ON travellers(owner_user_id);

-- Sessions for both family members (user_id set) and paired parent devices
-- (traveller_id set as well, kind = 'parent').
CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  traveller_id  TEXT REFERENCES travellers(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('family', 'parent')),
  expires_at    INTEGER NOT NULL,         -- epoch ms
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pair_codes (
  code_hash     TEXT PRIMARY KEY,
  traveller_id  TEXT NOT NULL REFERENCES travellers(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL
);

CREATE TABLE trips (
  id             TEXT PRIMARY KEY,
  traveller_id   TEXT NOT NULL REFERENCES travellers(id) ON DELETE CASCADE,
  airline        TEXT NOT NULL,           -- IATA code, e.g. "AI"
  flight_number  TEXT NOT NULL,           -- normalised, e.g. "AI101"
  flight_date    TEXT NOT NULL,           -- YYYY-MM-DD, local departure date
  origin         TEXT NOT NULL,           -- IATA airport, e.g. "DEL"
  destination    TEXT NOT NULL,
  depart_time    TEXT,                    -- HH:MM local
  arrive_time    TEXT,                    -- HH:MM local
  arrive_date    TEXT,                    -- YYYY-MM-DD local arrival date
  seat           TEXT,
  wheelchair     INTEGER NOT NULL DEFAULT 0,
  seeking        INTEGER NOT NULL DEFAULT 1,   -- listed for companion matching
  journey_step   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX trips_flight ON trips(flight_number, flight_date);
CREATE INDEX trips_arrival ON trips(destination, arrive_date);
CREATE INDEX trips_departure ON trips(origin, flight_date);
CREATE INDEX trips_traveller ON trips(traveller_id);

-- Every change a user makes to a trip (requirement from the original brief).
CREATE TABLE trip_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changes    TEXT NOT NULL,               -- JSON {field: [before, after]}
  at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX trip_audit_trip ON trip_audit(trip_id);

CREATE TABLE intro_requests (
  id            TEXT PRIMARY KEY,
  from_trip_id  TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  to_trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  responded_at  TEXT,
  UNIQUE (from_trip_id, to_trip_id)
);
CREATE INDEX intro_to ON intro_requests(to_trip_id);

-- Timeline shown to the family on travel day.
CREATE TABLE trip_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id  TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind     TEXT NOT NULL,                 -- step | help | help_resolved | status | intro
  text     TEXT NOT NULL,
  at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX trip_events_trip ON trip_events(trip_id, id);

CREATE TABLE help_alerts (
  id           TEXT PRIMARY KEY,
  trip_id      TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  step         INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at  TEXT
);
