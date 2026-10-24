-- Sample travellers so a new account sees matches straight away.
-- All people here are fictional. Remove before launch:
--   DELETE FROM users WHERE email LIKE 'sample+%@saathi.example';

INSERT OR IGNORE INTO users (id, email, name, phone) VALUES
  ('sample-u1', 'sample+neha@saathi.example',  'Neha Joshi',  NULL),
  ('sample-u2', 'sample+vikram@saathi.example', 'Vikram Gupta', NULL),
  ('sample-u3', 'sample+arjun@saathi.example', 'Arjun Mehta', NULL),
  ('sample-u4', 'sample+priya@saathi.example', 'Priya Raman', NULL);

INSERT OR IGNORE INTO travellers (id, owner_user_id, name, relation, age, kind, home_city, visiting_city, languages, diet, mobility, about, id_verified, vouched_by) VALUES
  ('sample-t1', 'sample-u1', 'Meera Joshi', 'Aai', 66, 'senior', 'Pune', 'Edison, NJ', '["Hindi","Marathi","English"]', 'Vegetarian', 'Walks comfortably',
   'Has flown this route six times and knows JFK well.', 1, 'Maharashtra community association, NJ'),
  ('sample-t2', 'sample-u2', 'Ramesh Gupta', 'Papa', 71, 'senior', 'Jaipur', 'Queens, NY', '["Hindi","English"]', 'Vegetarian', 'Uses a wheelchair at airports',
   'Travelling with his wife Usha. Happy to have one more in the group.', 1, NULL),
  ('sample-t3', 'sample-u3', 'Arjun Mehta', 'Me', 27, 'helper', 'Delhi', 'New York, NY', '["Hindi","Punjabi","English"]', NULL, NULL,
   'Graduate student. Happy to help with bags, the arrival form and finding the exit.', 1, NULL),
  ('sample-t4', 'sample-u4', 'Lakshmi Raman', 'Amma', 69, 'senior', 'Chennai', 'Princeton, NJ', '["Tamil","English"]', 'Vegetarian', 'Walks slowly, no wheelchair',
   'First trip abroad on her own.', 1, NULL);

INSERT OR IGNORE INTO trips (id, traveller_id, airline, flight_number, flight_date, origin, destination, depart_time, arrive_time, arrive_date, seat, wheelchair, seeking) VALUES
  ('sample-trip1', 'sample-t1', 'AI', 'AI101', '2026-11-14', 'DEL', 'JFK', '02:10', '07:45', '2026-11-14', '34A', 0, 1),
  ('sample-trip2', 'sample-t2', 'AI', 'AI101', '2026-11-14', 'DEL', 'JFK', '02:10', '07:45', '2026-11-14', '41D', 1, 1),
  ('sample-trip3', 'sample-t3', 'AI', 'AI101', '2026-11-14', 'DEL', 'JFK', '02:10', '07:45', '2026-11-14', '30B', 0, 1),
  ('sample-trip4', 'sample-t4', 'EK', 'EK203', '2026-11-13', 'DXB', 'JFK', '22:05', '08:25', '2026-11-14', '52K', 0, 1),
  ('sample-trip5', 'sample-t1', 'AI', 'AI102', '2027-01-06', 'JFK', 'DEL', '10:30', '10:20', '2027-01-07', NULL, 0, 1),
  ('sample-trip6', 'sample-t2', 'UA', 'UA82',  '2026-12-02', 'EWR', 'DEL', '20:45', '21:20', '2026-12-03', NULL, 1, 1);
