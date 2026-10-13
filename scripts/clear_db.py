import os
import shutil
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

if not os.environ.get("CREDENTIAL_KEK"):
    import base64
    import secrets
    os.environ["CREDENTIAL_KEK"] = base64.b64encode(secrets.token_bytes(32)).decode()

from app.core.config import load
from app.core.db import connect

def clear_all():
    cfg = load()
    db = connect(cfg)
    
    tables = [
        'findings',
        'sbom_components',
        'sboms',
        'scans',
        'inventory_components',
        'applications',
        'projects',
        'vulnerability_triage',
        'vulnerabilities',
        'credentials'
    ]
    
    print("--- Truncating PostgreSQL tables ---")
    for t in tables:
        try:
            db.execute(f"TRUNCATE {t} CASCADE;")
            print(f"  [OK] Truncated {t}")
        except Exception as e:
            print(f"  [ERR] {t}: {e}")

    try:
        db.execute("INSERT INTO organizations (id, name) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING", ("default", "default"))
        print("  [OK] Ensured default organization exists")
    except Exception as e:
        print(f"  [ERR] organization: {e}")

    print("--- Clearing Object Storage ---")
    uploads_dir = backend_dir / "data" / "objects" / "uploads"
    if uploads_dir.exists():
        count = 0
        for root, dirs, files in os.walk(uploads_dir):
            for f in files:
                try:
                    os.remove(os.path.join(root, f))
                    count += 1
                except Exception as e:
                    print(f"  [ERR] file {f}: {e}")
        print(f"  [OK] Removed {count} uploaded object files")

    print("\nDatabase and object storage cleared successfully for fresh testing!")

if __name__ == "__main__":
    clear_all()
