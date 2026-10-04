"""AES-GCM credential store and audit rows."""

from __future__ import annotations

import base64
import json
import os
import uuid
from datetime import datetime, timezone

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .db import finish
from .repos import iso, utcnow


class CredentialStore:
    def __init__(self, db, kek_b64: str) -> None:
        raw = base64.b64decode(kek_b64)
        if len(raw) != 32:
            raise RuntimeError("credential KEK must decode to 32 bytes")
        self.db = db
        self.aead = AESGCM(raw)

    def put(self, ref: str, material: bytes) -> None:
        nonce = os.urandom(12)
        ciphertext = self.aead.encrypt(nonce, material, ref.encode())
        self.db.execute(
            """INSERT INTO credential_secrets (reference, nonce, ciphertext) VALUES (?,?,?)
               ON CONFLICT(reference) DO UPDATE SET nonce=excluded.nonce, ciphertext=excluded.ciphertext""",
            (ref, nonce, ciphertext),
        )
        finish(self.db)

    def get(self, ref: str) -> bytes:
        row = self.db.execute("SELECT nonce, ciphertext FROM credential_secrets WHERE reference=?", (ref,)).fetchone()
        if row is None:
            raise LookupError("secret not found")
        return self.aead.decrypt(row["nonce"], row["ciphertext"], ref.encode())

    def delete(self, ref: str) -> None:
        self.db.execute("DELETE FROM credential_secrets WHERE reference=?", (ref,))
        finish(self.db)


class Credentials:
    def __init__(self, db, secrets: CredentialStore) -> None:
        self.db = db
        self.secrets = secrets

    def create_pat(self, org: str, name: str, token: str, scope: list[str] | None) -> dict:
        ref = "encdb:" + str(uuid.uuid4())
        self.secrets.put(ref, token.encode())
        cred = self._insert(org, name, "GITHUB_FINE_GRAINED_PAT", ref, scope)
        return cred

    def create_app(self, org: str, name: str, app_id: str, pem: str, scope: list[str] | None) -> dict:
        ref = "encdb:" + str(uuid.uuid4())
        self.secrets.put(ref, f"APP_ID:{app_id}\n{pem}".encode())
        return self._insert(org, name, "GITHUB_APP", ref, scope)

    def _insert(self, org: str, name: str, cred_type: str, ref: str, scope: list[str] | None) -> dict:
        now = iso(utcnow())
        cred = {
            "id": str(uuid.uuid4()),
            "organization_id": org,
            "provider": "GITHUB",
            "credential_type": cred_type,
            "name": name,
            "repository_scope": scope or ["*"],
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
        }
        self.db.execute(
            """INSERT INTO git_credentials (id, organization_id, provider, credential_type, name,
               secret_reference, repository_scope, status, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                cred["id"], org, "GITHUB", cred_type, name, ref,
                ",".join(scope) if scope else "*", "ACTIVE", now, now,
            ),
        )
        finish(self.db)
        return cred

    def list(self, org: str) -> list[dict]:
        rows = self.db.execute(
            """SELECT id, organization_id, provider, credential_type, name, repository_scope, status, created_at, updated_at
               FROM git_credentials WHERE organization_id=? ORDER BY created_at DESC""",
            (org,),
        ).fetchall()
        return [_public(row) for row in rows]

    def revoke(self, cred_id: str, org: str) -> None:
        row = self.db.execute(
            "SELECT secret_reference FROM git_credentials WHERE id=? AND organization_id=?",
            (cred_id, org),
        ).fetchone()
        if row is None:
            raise LookupError("not found")
        self.secrets.delete(row["secret_reference"])
        self.db.execute(
            "UPDATE git_credentials SET status='REVOKED', updated_at=? WHERE id=? AND organization_id=?",
            (iso(utcnow()), cred_id, org),
        )
        finish(self.db)

    def resolve(self, cred_id: str, org: str) -> bytes:
        row = self.db.execute(
            "SELECT secret_reference, status FROM git_credentials WHERE id=? AND organization_id=?",
            (cred_id, org),
        ).fetchone()
        if row is None:
            raise LookupError("credential not found")
        if row["status"] != "ACTIVE":
            raise RuntimeError("credential is not active")
        return self.secrets.get(row["secret_reference"])


def _public(row) -> dict:
    scope = row["repository_scope"] or "*"
    parts = ["*"] if scope == "*" else [part for part in scope.split(",") if part]
    return {
        "id": row["id"],
        "organization_id": row["organization_id"],
        "provider": row["provider"],
        "credential_type": row["credential_type"],
        "name": row["name"],
        "repository_scope": parts,
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


class Audit:
    def __init__(self, db) -> None:
        self.db = db

    def record(self, kind: str, organization_id: str = "", scan_id: str = "", credential_id: str = "", metadata: dict | None = None) -> None:
        self.db.execute(
            """INSERT INTO audit_logs (id, kind, organization_id, scan_id, credential_id, metadata, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), kind, organization_id or None, scan_id or None, credential_id or None, json.dumps(metadata or {}), iso(datetime.now(timezone.utc))),
        )
        finish(self.db)
