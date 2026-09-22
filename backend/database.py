"""MySQL access layer that mirrors the sqlite3 API surface this codebase used.

The pipeline and backend were written against ``sqlite3``: ``connection.execute()``
returning an iterable cursor, rows supporting both ``row[0]`` and
``row["column"]`` access, and ``dict(row)``. Raw pymysql breaks the positional
access and tuple-unpacking call sites silently, so this module keeps that shape
and only swaps the engine underneath.

Placeholders are MySQL-native ``%s`` (pymysql), not sqlite ``?``.
"""
from __future__ import annotations

from collections.abc import Iterable, Iterator, Sequence
from typing import Any

import pymysql
from pymysql.connections import Connection as _PyMySQLConnection

from . import config

Error = pymysql.MySQLError
ProgrammingError = pymysql.ProgrammingError
OperationalError = pymysql.OperationalError


class Row:
    """Result row addressable by index, by column name, or by unpacking."""

    __slots__ = ("_index", "_values")

    def __init__(self, index: dict[str, int], values: Sequence[Any]) -> None:
        self._index = index
        self._values = tuple(values)

    def _position(self, key: str) -> int:
        try:
            return self._index[key]
        except KeyError:
            raise KeyError(key) from None

    def __getitem__(self, key: object) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return self._values[self._position(str(key))]

    def __iter__(self) -> Iterator[Any]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)

    def __contains__(self, key: object) -> bool:
        return str(key) in self._index

    def __repr__(self) -> str:
        return f"Row({dict(zip(self._index, self._values))!r})"

    def keys(self) -> list[str]:
        return list(self._index)

    def get(self, key: str, default: Any = None) -> Any:
        position = self._index.get(key)
        return default if position is None else self._values[position]


class Cursor:
    """Wraps a pymysql cursor, yielding Row objects instead of tuples."""

    def __init__(self, connection: "Connection", cursor: Any) -> None:
        self._connection = connection
        self._cursor = cursor
        self._column_index: dict[str, int] | None = None

    def execute(self, sql: str, parameters: Sequence[Any] | None = None) -> "Cursor":
        self._column_index = None
        self._cursor.execute(sql, tuple(parameters) if parameters else None)
        return self

    def executemany(self, sql: str, seq: Iterable[Sequence[Any]]) -> "Cursor":
        self._column_index = None
        self._cursor.executemany(sql, [tuple(item) for item in seq])
        return self

    def fetchone(self) -> Row | None:
        row = self._cursor.fetchone()
        return None if row is None else self._to_row(row)

    def fetchmany(self, size: int | None = None) -> list[Row]:
        rows = self._cursor.fetchmany(size) if size else self._cursor.fetchmany()
        return [self._to_row(row) for row in rows]

    def fetchall(self) -> list[Row]:
        return [self._to_row(row) for row in self._cursor.fetchall()]

    def __iter__(self) -> Iterator[Row]:
        return iter([self._to_row(row) for row in self._cursor])

    def _columns(self) -> dict[str, int]:
        if self._column_index is None:
            index: dict[str, int] = {}
            for position, column in enumerate(self._cursor.description or ()):
                # Duplicate column names resolve to the first match, as sqlite3.Row does.
                index.setdefault(column[0], position)
            self._column_index = index
        return self._column_index

    def _to_row(self, row: Sequence[Any]) -> Row:
        return Row(self._columns(), row)

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    @property
    def lastrowid(self) -> int | None:
        return self._cursor.lastrowid

    @property
    def description(self) -> Any:
        return self._cursor.description

    def close(self) -> None:
        self._cursor.close()

    def __enter__(self) -> "Cursor":
        return self

    def __exit__(self, *exception: object) -> None:
        self.close()


class Connection:
    """sqlite3-shaped wrapper over a pymysql connection."""

    def __init__(self, raw: _PyMySQLConnection) -> None:
        self._raw = raw

    def execute(self, sql: str, parameters: Sequence[Any] | None = None) -> Cursor:
        return Cursor(self, self._raw.cursor()).execute(sql, parameters)

    def executemany(self, sql: str, seq: Iterable[Sequence[Any]]) -> Cursor:
        return Cursor(self, self._raw.cursor()).executemany(sql, seq)

    def cursor(self) -> Cursor:
        return Cursor(self, self._raw.cursor())

    def run(self, statements: Iterable[str]) -> None:
        """Execute DDL/statements that carry no parameters, one at a time."""
        cursor = self._raw.cursor()
        try:
            for statement in statements:
                if statement.strip():
                    cursor.execute(statement)
        finally:
            cursor.close()

    def commit(self) -> None:
        self._raw.commit()

    def rollback(self) -> None:
        self._raw.rollback()

    def close(self) -> None:
        self._raw.close()

    @property
    def raw(self) -> _PyMySQLConnection:
        return self._raw

    def __enter__(self) -> "Connection":
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        if exc_type is None:
            self.commit()
        else:
            self.rollback()
        self.close()


def connect(**overrides: Any) -> Connection:
    settings = {**config.MYSQL, **overrides}
    settings.setdefault("autocommit", False)
    settings.setdefault("connect_timeout", 10)
    return Connection(pymysql.connect(**settings))


def probe() -> str | None:
    """Return the server version, or None when the unified database is unreachable."""
    try:
        connection = connect()
    except Error:
        return None
    try:
        return str(connection.execute("SELECT VERSION()").fetchone()[0])
    except Error:
        return None
    finally:
        connection.close()


def ensure_database() -> None:
    """Create the schema's database when missing (used by the migration entry point)."""
    settings = {key: value for key, value in config.MYSQL.items() if key != "database"}
    database = config.MYSQL["database"]
    connection = pymysql.connect(**settings)
    try:
        cursor = connection.cursor()
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{database}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
        )
        # The database may predate the collation choice; ALTER aligns new
        # temporary tables and views with the binary comparison semantics.
        cursor.execute(
            f"ALTER DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
        )
        connection.commit()
    finally:
        connection.close()
