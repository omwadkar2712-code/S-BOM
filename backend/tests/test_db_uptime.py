"""Database connection helpers used for uptime."""

from app.core.db import Database, _is_connection_error


def test_connection_error_detection():
    assert _is_connection_error(RuntimeError("server closed the connection unexpectedly"))
    assert _is_connection_error(RuntimeError("SSL SYSCALL error: Connection reset by peer"))
    assert not _is_connection_error(RuntimeError("duplicate key value violates unique constraint"))


def test_database_stores_dsn_for_reconnect():
    class FakeConn:
        def execute(self, *args, **kwargs):
            raise RuntimeError("connection already closed")

        def close(self):
            return None

        class info:
            transaction_status = 0

    db = Database(FakeConn(), dsn="postgresql://example")
    assert db.dsn == "postgresql://example"
    assert db.ping() is False
