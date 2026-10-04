"""PostgreSQL connection and schema migration."""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

from psycopg.pq import TransactionStatus

from .config import Config

_SCHEMA = Path(__file__).resolve().parents[1] / "migrations" / "001_initial.up.sql"


class Row:
    """Sequence plus column-name lookup."""

    def __init__(self, values: tuple, columns: list[str]) -> None:
        self._values = values
        self._index = {name: i for i, name in enumerate(columns)}

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return self._values[self._index[key]]

    def __len__(self) -> int:
        return len(self._values)

    def keys(self):
        """Column names, so dict(row) uses the mapping protocol."""
        return list(self._index)


class Result:
    def __init__(self, rows: list) -> None:
        self._rows = rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


def _cell(value):
    if isinstance(value, memoryview):
        return bytes(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return value


class Database:
    """One connection shared by worker threads. The lock covers each statement and any explicit transaction."""

    def __init__(self, conn) -> None:
        self.raw = conn
        self.lock = threading.RLock()

    def execute(self, sql: str, params: tuple | list = ()) -> Result:
        with self.lock:
            cursor = self.raw.execute(sql.replace("?", "%s"), params)
            if cursor.description is None:
                return Result([])
            columns = [item[0] for item in cursor.description]
            rows = [Row(tuple(_cell(value) for value in record), columns) for record in cursor.fetchall()]
            return Result(rows)

    def script(self, sql: str) -> None:
        with self.lock:
            for statement in _statements(sql):
                self.raw.execute(statement)

    def begin(self) -> None:
        with self.lock:
            self.raw.execute("BEGIN")

    def commit(self) -> None:
        with self.lock:
            self.raw.execute("COMMIT")

    def rollback(self) -> None:
        with self.lock:
            self.raw.execute("ROLLBACK")

    @property
    def in_transaction(self) -> bool:
        return self.raw.info.transaction_status != TransactionStatus.IDLE


def connect(cfg: Config) -> Database:
    import psycopg

    conn = psycopg.connect(cfg.postgres_dsn, autocommit=True)
    return Database(conn)


def finish(db: Database) -> None:
    """Commit an open transaction. Autocommit mode has nothing to commit."""
    with db.lock:
        if db.in_transaction:
            db.raw.execute("COMMIT")


def migrate(db: Database) -> None:
    db.script(_SCHEMA.read_text(encoding="utf-8"))
    finish(db)


def _statements(sql: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        if line.strip().startswith("--"):
            continue
        buf.append(line)
        if line.strip().endswith(";"):
            statement = "\n".join(buf).strip().rstrip(";").strip()
            if statement:
                parts.append(statement)
            buf = []
    tail = "\n".join(buf).strip().rstrip(";").strip()
    if tail:
        parts.append(tail)
    return parts
