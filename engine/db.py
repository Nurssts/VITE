from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "vite_matrix.sqlite3"

SCHEMA = """
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  style TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  event_code TEXT,
  match_no INTEGER,
  tournament_level TEXT,
  red_score INTEGER,
  blue_score INTEGER,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS scout_entries (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  event_code TEXT,
  match_no INTEGER,
  payload TEXT NOT NULL,
  FOREIGN KEY(team_id) REFERENCES teams(id)
);
CREATE TABLE IF NOT EXISTS biobuzz_metrics (
  team_id TEXT PRIMARY KEY,
  mean REAL, sd REAL, hive REAL, flower REAL, auto REAL, reliability REAL, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS alliance_simulations (
  id TEXT PRIMARY KEY,
  created_at TEXT,
  payload TEXT NOT NULL
);
"""


def init_db(path: Path | None = None) -> sqlite3.Connection:
    db_file = path or DB_PATH
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
