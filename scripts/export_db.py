import os
import shutil
import subprocess
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

if not os.environ.get("CREDENTIAL_KEK"):
    os.environ["CREDENTIAL_KEK"] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

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

def export_db():
    output_file = Path(__file__).resolve().parent.parent / "sbom_backup.sql"
    pg_dump = find_pg_tool("pg_dump")
    print(f"Using {pg_dump} to export database...")
    
    env = os.environ.copy()
    env["PGPASSWORD"] = "sbom"
    
    cmd = [
        pg_dump,
        "-U", "sbom",
        "-h", "127.0.0.1",
        "-p", "5432",
        "-d", "sbom",
        "--clean",
        "--if-exists",
        "-f", str(output_file),
    ]
    
    res = subprocess.run(cmd, env=env)
    if res.returncode == 0:
        size_kb = output_file.stat().st_size / 1024
        print(f"[OK] Database exported successfully to:\n     {output_file} ({size_kb:.1f} KB)")
        print("\nTo move to another PC, copy these two items:")
        print("  1. sbom_backup.sql")
        print("  2. backend/data/objects/ folder (uploaded scan files)")
    else:
        print(f"[ERR] pg_dump failed with exit code {res.returncode}")

if __name__ == "__main__":
    export_db()
