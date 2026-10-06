"""PostgreSQL connection and schema migration."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from psycopg.pq import TransactionStatus

from app.core.config import Config

log = logging.getLogger("bom.db")

_MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"

# Connection-level failures that warrant a reconnect attempt.
_CONN_MARKERS = (
    "connection",
    "server closed",
    "broken pipe",
    "connection reset",
    "ssl",
    "terminating connection",
    "could not receive",
    "could not send",
    "admin_shutdown",
    "crash",
)


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


def _is_connection_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _CONN_MARKERS)


class Database:
    """One connection shared by worker threads. The lock covers each statement and any explicit transaction."""

    def __init__(self, conn, dsn: str = "") -> None:
        self.raw = conn
        self.dsn = dsn
        self.lock = threading.RLock()

    def execute(self, sql: str, params: tuple | list = ()) -> Result:
        with self.lock:
            try:
                return self._execute_unlocked(sql, params)
            except Exception as exc:
                if not self.dsn or not _is_connection_error(exc):
                    raise
                log.warning("database connection lost during execute; reconnecting")
                self._reconnect_unlocked()
                return self._execute_unlocked(sql, params)

    def _execute_unlocked(self, sql: str, params: tuple | list = ()) -> Result:
        cursor = self.raw.execute(sql.replace("?", "%s"), params)
        if cursor.description is None:
            return Result([])
        columns = [item[0] for item in cursor.description]
        rows = [Row(tuple(_cell(value) for value in record), columns) for record in cursor.fetchall()]
        return Result(rows)

    def executemany(self, sql: str, rows: list[tuple]) -> None:
        if not rows:
            return
        with self.lock:
            with self.raw.cursor() as cursor:
                cursor.executemany(sql.replace("?", "%s"), rows)

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
            try:
                self.raw.execute("ROLLBACK")
            except Exception as exc:
                if _is_connection_error(exc) and self.dsn:
                    log.warning("database connection lost during rollback; reconnecting")
                    self._reconnect_unlocked()
                    return
                raise

    @property
    def in_transaction(self) -> bool:
        try:
            return self.raw.info.transaction_status != TransactionStatus.IDLE
        except Exception:
            return False

    def _reconnect_unlocked(self) -> None:
        if not self.dsn:
            raise RuntimeError("cannot reconnect without a DSN")
        import psycopg

        try:
            self.raw.close()
        except Exception:
            pass
        self.raw = psycopg.connect(self.dsn, autocommit=True)

    def reconnect(self) -> None:
        """Drop the current socket and open a fresh connection using the stored DSN."""
        with self.lock:
            self._reconnect_unlocked()

    def ping(self) -> bool:
        """True when the database answers a trivial query."""
        try:
            row = self.execute("SELECT 1 AS ok").fetchone()
            return row is not None and int(row[0]) == 1
        except Exception:
            return False

    def ensure_alive(self) -> bool:
        """Ping, and reconnect once if the shared connection is dead."""
        if self.ping():
            return True
        if not self.dsn:
            return False
        try:
            self.reconnect()
            return self.ping()
        except Exception:
            log.exception("database reconnect failed")
            return False

    def close(self) -> None:
        with self.lock:
            try:
                self.raw.close()
            except Exception:
                pass


def connect(cfg: Config) -> Database:
    import psycopg

    conn = psycopg.connect(cfg.postgres_dsn, autocommit=True)
    return Database(conn, dsn=cfg.postgres_dsn)


def ping(db: Database) -> bool:
    """Module-level helper used by health checks."""
    return db.ping()


def ensure_alive(db: Database) -> bool:
    """Module-level helper: keep the shared connection usable across long uptimes."""
    return db.ensure_alive()


def finish(db: Database) -> None:
    """Commit an open transaction. Autocommit mode has nothing to commit."""
    with db.lock:
        if db.in_transaction:
            try:
                db.raw.execute("COMMIT")
            except Exception as exc:
                if _is_connection_error(exc) and db.dsn:
                    log.warning("database connection lost during finish; reconnecting")
                    db._reconnect_unlocked()
                    return
                raise


def migrate(db: Database) -> None:
    for path in sorted(_MIGRATIONS.glob("*.up.sql")):
        db.script(path.read_text(encoding="utf-8"))
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
