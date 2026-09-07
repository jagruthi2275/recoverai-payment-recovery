"""SQLite connection and non-destructive initialization helpers."""

import os
import sqlite3


_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(_SRC_DIR, "..")
DEFAULT_DB_PATH = os.path.join(ROOT_DIR, "db", "recoverai.db")
SAFE_SCHEMA_PATH = os.path.join(ROOT_DIR, "db", "init.sql")


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    """Open a SQLite connection with foreign-key enforcement enabled."""
    conn = sqlite3.connect(db_path or DEFAULT_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_database(db_path: str | None = None) -> None:
    """Create missing tables/indexes without dropping or replacing existing data.

    This deliberately uses db/init.sql, never db/schema.sql. The latter is a
    generator/reset schema and contains DROP TABLE statements.
    """
    conn = get_connection(db_path)
    try:
        with open(SAFE_SCHEMA_PATH, encoding="utf-8") as schema_file:
            conn.executescript(schema_file.read())
        conn.commit()
    finally:
        conn.close()
