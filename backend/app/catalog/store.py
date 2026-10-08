"""Tenant-scoped catalog of projects and their applications/services."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from app.core.db import finish


_MAX_NAME = 200
_DEFAULT_LIMIT = 50
_MAX_LIMIT = 200


class CatalogError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass(frozen=True)
class BoundTarget:
    project_id: str
    project_name: str
    application_id: str
    application_name: str


def ensure_organization(db, organization_id: str) -> str:
    """Create the organization row and return its id."""
    organization_id = (organization_id or "").strip()
    if not organization_id:
        raise CatalogError("INVALID_INPUT", "organization is required", 400)
    db.execute(
        "INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
        (organization_id, organization_id),
    )
    finish(db)
    return organization_id


def ensure_security_scans(db, organization_id: str) -> str:
    """Ensure the organization exists. Scans belong to the organization directly."""
    return ensure_organization(db, organization_id)


def ensure_software_inventory(db, organization_id: str) -> str:
    """Ensure the organization exists. Inventory components belong to an application."""
    return ensure_organization(db, organization_id)


class CatalogRepo:
    def __init__(self, db) -> None:
        self.db = db

    def list_projects(self, organization_id: str, *, q: str = "", limit: int = _DEFAULT_LIMIT, cursor: str | None = None) -> dict[str, Any]:
        page_size = _page_limit(limit)
        query = (q or "").strip()[:_MAX_NAME]
        params: list[Any] = [organization_id]
        filters = "organization_id = ?"
        if query:
            filters += " AND name ILIKE ? ESCAPE '#'"
            params.append(_ilike_contains(query))
        if cursor:
            name, record_id = _decode_cursor(cursor)
            filters += " AND (name, id) > (?, ?)"
            params.extend([name, record_id])
        params.append(page_size + 1)
        rows = self.db.execute(
            f"""SELECT id, name FROM projects
               WHERE {filters}
               ORDER BY name ASC, id ASC
               LIMIT ?""",
            params,
        ).fetchall()
        return _page(rows, page_size, lambda row: {"id": row["id"], "name": row["name"]})

    def list_applications(
        self,
        organization_id: str,
        project_id: str,
        *,
        q: str = "",
        limit: int = _DEFAULT_LIMIT,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        project = self.get_project(organization_id, project_id)
        if project is None:
            raise CatalogError("PROJECT_NOT_FOUND", "the requested project does not exist", 404)
        page_size = _page_limit(limit)
        query = (q or "").strip()[:_MAX_NAME]
        params: list[Any] = [organization_id, project["id"]]
        filters = "organization_id = ? AND project_id = ?"
        if query:
            filters += " AND name ILIKE ? ESCAPE '#'"
            params.append(_ilike_contains(query))
        if cursor:
            name, record_id = _decode_cursor(cursor)
            filters += " AND (name, id) > (?, ?)"
            params.extend([name, record_id])
        params.append(page_size + 1)
        rows = self.db.execute(
            f"""SELECT id, name, project_id FROM applications
               WHERE {filters}
               ORDER BY name ASC, id ASC
               LIMIT ?""",
            params,
        ).fetchall()
        return _page(
            rows,
            page_size,
            lambda row: {"id": row["id"], "name": row["name"], "project_id": row["project_id"]},
        )

    def get_project(self, organization_id: str, project_id: str) -> dict[str, Any] | None:
        record_id = (project_id or "").strip()
        if not record_id:
            return None
        row = self.db.execute(
            "SELECT id, name FROM projects WHERE organization_id = ? AND id = ?",
            (organization_id, record_id),
        ).fetchone()
        return {"id": row["id"], "name": row["name"]} if row else None

    def get_application(self, organization_id: str, application_id: str) -> dict[str, Any] | None:
        record_id = (application_id or "").strip()
        if not record_id:
            return None
        row = self.db.execute(
            """SELECT id, name, project_id FROM applications
               WHERE organization_id = ? AND id = ?""",
            (organization_id, record_id),
        ).fetchone()
        return {"id": row["id"], "name": row["name"], "project_id": row["project_id"]} if row else None

    def find_project_by_name(self, organization_id: str, name: str) -> dict[str, Any] | None:
        label = (name or "").strip()
        if not label:
            return None
        row = self.db.execute(
            "SELECT id, name FROM projects WHERE organization_id = ? AND name = ?",
            (organization_id, label),
        ).fetchone()
        return {"id": row["id"], "name": row["name"]} if row else None

    def find_application(self, organization_id: str, project_id: str, name: str) -> dict[str, Any] | None:
        label = (name or "").strip()
        if not project_id or not label:
            return None
        row = self.db.execute(
            """SELECT id, name, project_id FROM applications
               WHERE organization_id = ? AND project_id = ? AND name = ?""",
            (organization_id, project_id, label),
        ).fetchone()
        return {"id": row["id"], "name": row["name"], "project_id": row["project_id"]} if row else None

    def ensure_project(self, organization_id: str, name: str) -> dict[str, Any]:
        label = _require_name(name, "project name")
        existing = self.find_project_by_name(organization_id, label)
        if existing:
            return existing
        ensure_organization(self.db, organization_id)
        self.db.execute(
            """INSERT INTO projects (id, organization_id, name)
               VALUES (?,?,?) ON CONFLICT (organization_id, name) DO NOTHING""",
            (str(uuid.uuid4()), organization_id, label),
        )
        finish(self.db)
        found = self.find_project_by_name(organization_id, label)
        if found is None:
            raise CatalogError("CREATE_FAILED", "project could not be saved", 500)
        return found

    def ensure_application(self, organization_id: str, project_id: str, name: str) -> dict[str, Any]:
        label = _require_name(name, "application/service name")
        project = self.get_project(organization_id, project_id)
        if project is None:
            raise CatalogError("PROJECT_NOT_FOUND", "the requested project does not exist", 404)
        existing = self.find_application(organization_id, project["id"], label)
        if existing:
            return existing
        self.db.execute(
            """INSERT INTO applications (id, project_id, organization_id, name)
               VALUES (?,?,?,?) ON CONFLICT (organization_id, project_id, name) DO NOTHING""",
            (str(uuid.uuid4()), project["id"], organization_id, label),
        )
        finish(self.db)
        found = self.find_application(organization_id, project["id"], label)
        if found is None:
            raise CatalogError("CREATE_FAILED", "application/service could not be saved", 500)
        return found

    def create_project(self, organization_id: str, name: str, applications: list[str] | None = None) -> dict[str, Any]:
        project = self.ensure_project(organization_id, name)
        app_names = []
        seen = set()
        for raw in applications or []:
            label = (raw or "").strip()[:_MAX_NAME]
            if not label or label.lower() in seen:
                continue
            seen.add(label.lower())
            app_names.append(label)
        items = [self.ensure_application(organization_id, project["id"], label) for label in app_names]
        return {
            "id": project["id"],
            "name": project["name"],
            "applications": items,
        }

    def ensure_named(self, organization_id: str, project_name: str, application_name: str) -> BoundTarget:
        project = self.ensure_project(organization_id, project_name)
        application = self.ensure_application(organization_id, project["id"], application_name)
        return BoundTarget(project["id"], project["name"], application["id"], application["name"])

    def bind(
        self,
        organization_id: str,
        *,
        project_id: str = "",
        application_id: str = "",
        project_name: str = "",
        application_name: str = "",
        persist_missing: bool = False,
    ) -> BoundTarget:
        """Resolve a Project + Application/Service pair using IDs first, then names."""
        project_id = (project_id or "").strip()
        application_id = (application_id or "").strip()
        project_name = (project_name or "").strip()[:_MAX_NAME]
        application_name = (application_name or "").strip()[:_MAX_NAME]
        if not project_id and not application_id and persist_missing and project_name and application_name:
            return self.ensure_named(organization_id, project_name, application_name)
        if project_id or application_id:
            persist_missing = False

        project = self.get_project(organization_id, project_id) if project_id else None
        if project_id and project is None:
            raise CatalogError("PROJECT_NOT_FOUND", "the requested project does not exist", 404)
        if project is None and project_name:
            project = self.find_project_by_name(organization_id, project_name)

        application = self.get_application(organization_id, application_id) if application_id else None
        if application_id and application is None:
            raise CatalogError("APPLICATION_NOT_FOUND", "the requested application/service does not exist", 404)
        if application and project and application["project_id"] != project["id"]:
            raise CatalogError(
                "APPLICATION_PROJECT_MISMATCH",
                "application/service does not belong to the selected project",
                400,
            )
        if application and project is None:
            project = self.get_project(organization_id, application["project_id"])
        if application is None and application_name and project:
            application = self.find_application(organization_id, project["id"], application_name)
            if application is None and not persist_missing and (project_id or application_id):
                raise CatalogError(
                    "APPLICATION_NOT_FOUND",
                    "no application/service with that name belongs to the selected project",
                    404,
                )

        if persist_missing:
            if project is None and project_name:
                project = self.ensure_project(organization_id, project_name)
            if application is None and project is not None and application_name:
                application = self.ensure_application(organization_id, project["id"], application_name)

        if project is None:
            raise CatalogError("INVALID_INPUT", "project is required", 400)
        if application is None:
            raise CatalogError("INVALID_INPUT", "application_name is required", 400)
        if application["project_id"] != project["id"]:
            raise CatalogError(
                "APPLICATION_PROJECT_MISMATCH",
                "application/service does not belong to the selected project",
                400,
            )
        return BoundTarget(project["id"], project["name"], application["id"], application["name"])


def _require_name(value: str, label: str) -> str:
    name = (value or "").strip()[:_MAX_NAME]
    if not name:
        raise CatalogError("INVALID_INPUT", f"{label} is required", 400)
    return name


def _page_limit(limit: int) -> int:
    try:
        value = int(limit)
    except (TypeError, ValueError):
        value = _DEFAULT_LIMIT
    return min(max(value, 1), _MAX_LIMIT)


def _ilike_contains(query: str) -> str:
    escaped = query.replace("#", "##").replace("%", "#%").replace("_", "#_")
    return f"%{escaped}%"


def _decode_cursor(cursor: str) -> tuple[str, str]:
    name, separator, record_id = str(cursor or "").rpartition("|")
    if not separator or not name or not record_id:
        raise CatalogError("INVALID_INPUT", "cursor is invalid", 400)
    return name, record_id


def _encode_cursor(name: str, record_id: str) -> str:
    return f"{name}|{record_id}"


def _page(rows: list, page_size: int, mapper) -> dict[str, Any]:
    page = rows[:page_size]
    next_cursor = None
    if len(rows) > page_size and page:
        last = page[-1]
        next_cursor = _encode_cursor(last["name"], last["id"])
    return {"items": [mapper(row) for row in page], "next_cursor": next_cursor}
