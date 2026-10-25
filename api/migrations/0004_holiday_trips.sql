-- Holiday trips registered on the website (Diwali, Thanksgiving, winter holidays) for the
-- hand-matched pilot that runs before the apps are in the stores. The team looks for trips on
-- the same flight or landing close together and emails both families; nothing is shared until
-- both agree.

CREATE TABLE holiday_trips (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,             -- family contact's first name
  email         TEXT NOT NULL,
  phone         TEXT,                      -- optional WhatsApp number
  travellers    TEXT NOT NULL,             -- e.g. "Maa (68) and Papa (72)"
  direction     TEXT NOT NULL,             -- to_us | to_india | other
  origin        TEXT NOT NULL,             -- airport code or city as typed
  destination   TEXT NOT NULL,
  travel_date   TEXT NOT NULL,             -- YYYY-MM-DD
  flight        TEXT,                      -- e.g. AI101, if booked
  occasion      TEXT NOT NULL,             -- diwali | thanksgiving | winter | other
  languages     TEXT,                      -- JSON array
  notes         TEXT,
  ip_hash       TEXT,
  handled       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX holiday_trips_date ON holiday_trips(travel_date);
CREATE INDEX holiday_trips_ip ON holiday_trips(ip_hash, created_at);
