-- OASI ADMIN V4 - piantina standard ripristinabile
CREATE TABLE IF NOT EXISTS floor_plan_templates (
  room_id INTEGER PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
