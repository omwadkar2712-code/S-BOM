# S-BOM Known Issues, Security Analysis, & Architectural Risks

This document records confirmed technical gaps, potential security attack surfaces, performance considerations, and discrepancies identified during repository inspection.

---

## 1. Discrepancies & Confirmed Code Gaps

### 1. `Dashboard.tsx` Metric Calculations Are Hardcoded
- **Status**: **Confirmed**
- **Location**: [`frontend/src/pages/dashboard/Dashboard.tsx:50-70`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/dashboard/Dashboard.tsx#L50-L70)
- **Detail**: While `Dashboard.tsx` imports `projects` and `vulnerabilities` from `useAppState()`, the summary KPIs and chart variables are declared as static placeholders:
  ```typescript
  const overallRiskIndex = '0';
  const totalProjectsCount = '0';
  const totalScansCount = '0';
  const vulnerableLibrariesCount = '0';
  const uniqueCvesCount = '0';
  const severityDonutData: Array<{ name: string; value: number; color: string }> = [];
  const riskTrendData: Array<{ scan: string; date: string; riskIndex: number; vulns: number }> = [];
  const top5VulnerableProjects: Array<{ ... }> = [];
  ```
- **Consequence**: The dashboard always displays zeroes and empty charts regardless of how many completed scans and vulnerabilities exist in the database.
- **Remediation**: Wire `overallRiskIndex`, `totalProjectsCount`, `totalScansCount`, `vulnerableLibrariesCount`, and `severityDonutData` directly to dynamic calculations over `projects`, `components`, and `vulnerabilities`.

### 2. `Audit.record()` Is a No-Op Stub
- **Status**: **Confirmed**
- **Location**: [`backend/app/credentials/service.py:138-139`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/credentials/service.py#L138-L139)
- **Detail**: The `Audit` service class defines `def record(...): return`.
- **Consequence**: While `orchestrator.py` and `server.py` make calls to `audit.record("SCAN_CREATED")`, `audit.record("SCAN_COMPLETED")`, and `audit.record("CREDENTIAL_CREATED")`, no rows are inserted into the database. Audit logs were dropped in migration 006 and not yet re-introduced.
- **Remediation**: Either create an `audit_logs` table in a future migration or route audit events to structured logging (`log.info()`).

### 3. GitHub App Installation Tokens Are Not Minted
- **Status**: **Confirmed**
- **Location**: [`backend/app/sources/workspace.py:132-133`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/sources/workspace.py#L132-L133)
- **Detail**: In `prepare_github()`, when a `GITHUB_APP` credential is used, the backend throws an exception:
  ```python
  if token.startswith("APP_ID:"):
      raise RuntimeError("GitHub App credentials are stored, but installation tokens are not minted by this build")
  ```
- **Consequence**: GitHub Personal Access Tokens (`GITHUB_FINE_GRAINED_PAT`) work correctly, but GitHub App authentication is only half-implemented (private keys are encrypted and stored, but JWT generation and token exchange via `/app/installations/{id}/access_tokens` are not yet wired).

### 4. Remediation Tickets and Policies Are Ephemeral Local State
- **Status**: **Confirmed**
- **Location**: [`frontend/src/context/AppStateContext.tsx:172-173`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/context/AppStateContext.tsx#L172-L173)
- **Detail**: `tickets` and `policies` are maintained exclusively in React component state. There are no backend database tables or REST endpoints for tickets or security policies.
- **Consequence**: Refreshing the browser or opening the console on another machine resets any user-created tickets or policy toggles to their default empty states.

---

## 2. Security & Attack Surface Assessment

### 1. SSRF Guard on Outbound Network Requests
- **Status**: **Confirmed Secure**
- **Location**: [`backend/app/security/archives.py:49-86`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/security/archives.py#L49-L86)
- **Verification**: `assert_safe_host()` performs DNS resolution via `socket.getaddrinfo()` and rejects loopback (`127.0.0.1`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local addresses, and AWS/GCP instance metadata IPs (`169.254.169.254`, `metadata.google.internal`).
- **Residual Risk**: DNS Rebinding. `assert_safe_host()` resolves the host, but the subsequent HTTP request via `httpx.Client` executes another DNS resolution unless pinned to the verified IP. While low risk against `github.com` and `api.osv.dev`, production high-security deployments should bind client requests directly to pre-resolved IPs.

### 2. Zip-Slip & Path Traversal in Decompression
- **Status**: **Confirmed Secure**
- **Location**: [`backend/app/security/archives.py:103-111`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/security/archives.py#L103-L111)
- **Verification**: `safe_join()` cleanses backslashes, rejects leading slashes, Colons (`:`), and `..` segments, and verifies that `os.path.commonpath([root_abs, dest]) == root_abs`. It also verifies symlink flags (`0o120000`) and rejects symlinks within archives to prevent symlink-following attacks.

### 3. Decompression Bombs (Zip-Bombs)
- **Status**: **Confirmed Secure**
- **Location**: [`backend/app/security/archives.py:130-186`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/security/archives.py#L130-L186)
- **Verification**: Strictly enforces 4 independent bounds during streaming extraction:
  1. `max_files` (50,000 files).
  2. `max_entry` (1 GiB per entry).
  3. `max_total` (1 GiB total uncompressed bytes).
  4. `max_ratio` (100x uncompressed to compressed ratio).

### 4. Static Parsing vs Code Execution
- **Status**: **Confirmed Secure**
- **Location**: [`backend/app/scanner/parsers.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/scanner/parsers.py)
- **Verification**: Manifest parsing is purely static (JSON, TOML, XML, regex). No build systems (`npm install`, `pip`, `setup.py`, `mvn compile`, `gradle build`, `cargo build`) are invoked on target code. This protects the backend worker host from arbitrary code execution embedded in hostile dependencies or build scripts.

---

## 3. Concurrency & Performance Considerations

### 1. Database Connection Lock Serialization
- **Status**: **Inferred Bottleneck**
- **Location**: [`backend/app/core/db.py:80-97`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/core/db.py#L80-L97)
- **Detail**: The `Database` wrapper uses a single connection protected by `threading.RLock()`.
- **Impact**: All worker threads and API request handlers contend for this single lock. Under heavy load (e.g. bulk scanning hundreds of repositories simultaneously), statement execution will serialize, potentially causing HTTP latency spikes.
- **Recommendation**: Upgrade to `psycopg_pool.ConnectionPool` to allocate discrete connections per worker thread and HTTP request.

### 2. Database Queue Polling Overhead
- **Status**: **Inferred Minor Bottleneck**
- **Location**: [`backend/app/worker.py:32-47`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/worker.py#L32-L47)
- **Detail**: Worker threads poll `JobQueue.claim()` every `QUEUE_POLL_INTERVAL_MS` (default 500ms).
- **Impact**: With 4 worker threads, this generates ~8 `SELECT ... FOR UPDATE SKIP LOCKED` queries per second on the database even when idle.
- **Recommendation**: Utilize PostgreSQL `LISTEN / NOTIFY` to wake worker threads only when a new job is inserted into `scans`, falling back to a relaxed 10-second heartbeat poll.
