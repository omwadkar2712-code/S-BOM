import os
import shutil
import subprocess
import sys
from pathlib import Path

def find_pg_tool(tool_name: str) -> str:
    path_tool = shutil.which(tool_name)
    if path_tool:
        return path_tool
    pg_base = Path("C:/Program Files/PostgreSQL")
    if pg_base.exists():
        for ver_dir in sorted(pg_base.glob("*"), reverse=True):
            candidate = ver_dir / "bin" / f"{tool_name}.exe"
            if candidate.exists():
                return str(candidate)
    return tool_name

def import_db():
    backup_file = Path(__file__).resolve().parent.parent / "sbom_backup.sql"
    if not backup_file.exists():
        print(f"[ERR] Backup file not found: {backup_file}")
        print("Please place 'sbom_backup.sql' in the project root directory first.")
        sys.exit(1)

    psql = find_pg_tool("psql")
    print(f"Using {psql} to import database...")

    env = os.environ.copy()
    env["PGPASSWORD"] = os.environ.get("PGPASSWORD", "sbom")
    user = os.environ.get("PGUSER", "sbom")
    host = os.environ.get("PGHOST", "127.0.0.1")
    port = os.environ.get("PGPORT", "5432")
    dbname = os.environ.get("PGDATABASE", "sbom")

    cmd = [
        psql,
        "-U", user,
        "-h", host,
        "-p", port,
        "-d", dbname,
        "-f", str(backup_file),
    ]

    print(f"Restoring {backup_file.name} into database '{dbname}' on {host}:{port}...")
    res = subprocess.run(cmd, env=env)
    if res.returncode == 0:
        print("\n[OK] Database imported successfully!")
        print("Remember to also copy the 'backend/data/objects/' folder from your old PC to this PC.")
    else:
        print(f"\n[ERR] psql exited with code {res.returncode}")
        print("If the database or user does not exist yet, make sure to create the 'sbom' user and 'sbom' database first:")
        print("  psql -U postgres -c \"CREATE USER sbom WITH PASSWORD 'sbom';\"")
        print("  psql -U postgres -c \"CREATE DATABASE sbom OWNER sbom;\"")

if __name__ == "__main__":
    import_db()
