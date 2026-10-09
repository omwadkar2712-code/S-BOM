# S-BOM Complete File Inventory & Technical Catalog

This inventory records every source code file, script, configuration, migration, and test file within the repository, verified through actual code inspection.

---

## 1. Root & Infrastructure Files

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`package.json`](file:///d:/Work_Stuff/Projects/S-BOM/package.json) | Root project manifest and task runner | Script: `dev:all` | Node.js | Defines the root npm entry point for starting the full local development stack. | **Fully Inspected** |
| [`scripts/dev-all.mjs`](file:///d:/Work_Stuff/Projects/S-BOM/scripts/dev-all.mjs) | Local process supervisor and port conflict reclaimer | `reclaimStaleDevProcesses`, `start`, `stop`, `killTree`, `listeningPids` | `node:child_process`, `node:crypto`, `node:fs`, `node:path` | Identifies Python virtualenv, installs frontend & backend deps if missing, terminates leftover servers holding ports 8080 & 5173, spawns API (`app.main`), Worker (`app.worker`), and Vite UI concurrently with log prefixing and graceful shutdown. | **Fully Inspected** |

---

## 2. Backend Core & Configuration (`backend/app/core/`)

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`backend/app/core/config.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/core/config.py) | Strongly-typed immutable configuration loaded from environment | Class `Config`, `load()`, helper parsers `_env`, `_int`, `_csv` | `os`, `dataclasses.dataclass`, `urllib.parse` | Reads configuration variables with sensible defaults; validates limits, database DSN schemes (`postgresql://`), local object store URIs (`local://`), and MITRE endpoint hostnames. | **Fully Inspected** |
| [`backend/app/core/db.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/core/db.py) | Low-level PostgreSQL connection pool, script runner, and migration driver | Classes `Database`, `Row`, `Result`; Functions `connect`, `migrate`, `ping`, `ensure_alive`, `finish` | `psycopg`, `threading.RLock`, `pathlib.Path` | Manages single shared thread-safe PostgreSQL connection with auto-reconnect on socket drops; translates `?` parameter markers to `%s`; applies all ordered `.up.sql` schema files upon startup. | **Fully Inspected** |
| [`backend/app/core/metrics.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/core/metrics.py) | In-process thread-safe performance and telemetry counters | Class `Metrics`, singleton `METRICS` | `threading.Lock` | Maintains counters for total scans, successful/failed scans, scan durations, queue depth, GitHub API calls/rate-limits, discovered components, discovered CVEs, and bulk jobs. | **Fully Inspected** |

---

## 3. Backend Entry Points (`backend/app/`)

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`backend/app/main.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/main.py) | FastAPI HTTP server entry point | `create_app()`, `main()` | `uvicorn`, `app.api.build`, `app.core.config.load` | Initializes the FastAPI application factory, applies database migrations, binds host/port, and runs the Uvicorn ASGI server with live reloading enabled. | **Fully Inspected** |
| [`backend/app/worker.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/worker.py) | Asynchronous scan worker daemon | `main()` | `threading`, `signal`, `app.api.build`, `app.scans.orchestrator` | Launches `scanner_workers` worker threads that poll `JobQueue.claim()` using `SELECT ... FOR UPDATE SKIP LOCKED`, executes the scanner pipeline, records duration metrics, and handles retries or cancellation. | **Fully Inspected** |

---

## 4. Backend API Layer (`backend/app/api/`)

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`backend/app/api/__init__.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/api/__init__.py) | API package export | `build` | `app.api.server` | Exports the application builder function. | **Fully Inspected** |
| [`backend/app/api/server.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/api/server.py) | Comprehensive FastAPI REST API router & controller implementations | `build()`, `_envelope()`, `_error()`, `_org()`, `_submit_bulk()`, `_bind_scan_target()` | `fastapi`, `app.catalog`, `app.credentials`, `app.export`, `app.scans` | Implements 20+ endpoints: `/health/live`, `/health/ready`, `/metrics.json`, `/api/v1/scans/local`, `/api/v1/scans/github`, `/api/v1/scans/{id}`, `/api/v1/scans/{id}/status`, `/api/v1/scans/{id}/rescan`, `/api/v1/scans/{id}/cancel`, `/api/v1/scans/{id}/components`, `/api/v1/scans/{id}/vulnerabilities`, `/api/v1/scans/{id}/export`, `/api/v1/boms/{id}`, `/api/v1/projects`, `/api/v1/catalog/projects`, `/api/v1/catalog/projects/{id}/applications-services`, `/api/v1/inventory/components`, `/api/v1/scans/bulk`, `/api/v1/bulk-scans/{id}`, `/api/v1/credentials/github`, and GitHub webhook receiver. | **Fully Inspected** |

---

## 5. Backend Scanner & Analysis Engine (`backend/app/scanner/`)

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`backend/app/scanner/detector.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/scanner/detector.py) | Filesystem crawler that identifies manifest and lockfile locations | `detect()`, `match_file()`, `BY_FILENAME`, `ALWAYS_IGNORE`, `INSTALLED_IGNORE`, `Detected` | `pathlib.Path`, `dataclasses.dataclass` | Recursively walks project directory trees up to depth 30; skips `.git`, `.venv`, `node_modules`; identifies 46+ supported manifest types across 15 ecosystems; ignores oversized files (> 64MB). | **Fully Inspected** |
| [`backend/app/scanner/parsers.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/scanner/parsers.py) | Static AST / text parsers for package manifests and lockfiles (1528 lines) | `parse_manifest()`, `parse_package_json()`, `parse_npm_lock()`, `parse_yarn_lock()`, `parse_pnpm_lock()`, `parse_bun_lock()`, `parse_requirements()`, `parse_pyproject()`, `parse_poetry_lock()`, `parse_uv_or_pdm_lock()`, `parse_pipfile_lock()`, `parse_pom()`, `parse_gradle()`, `parse_go_mod()`, `parse_cargo_toml()`, `parse_cargo_lock()`, `parse_composer_lock()`, `parse_gemfile_lock()`, `parse_nuget()`, etc. | `json`, `re`, `xml.etree.ElementTree`, `tomllib`/`tomli` | Pure static text parsing of dependencies, versions, ecosystems, declared scopes (runtime vs dev), and direct vs transitive indicators with zero execution of untrusted scripts. | **Fully Inspected** |
| [`backend/app/scanner/pipeline.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/scanner/pipeline.py) | Core scan orchestration pipeline: detection, parsing, deduplication, graph assembly, and enrichment | `scan_tree()`, `dedupe()`, `apply_graph()`, `enrich_local()`, `audit_compliance()`, `normalize()` | `app.scanner.detector`, `app.scanner.parsers`, `app.vulnerabilities.provider` | Orchestrates the full lifecycle: crawls tree, runs parsers, dedupes packages favoring resolved lockfiles, computes dependency depth and root directness via DFS, infers licenses from `LICENSE` files, and audits NTIA minimum elements. | **Fully Inspected** |

---

## 6. Backend Vulnerability Intelligence (`backend/app/vulnerabilities/`)

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`backend/app/vulnerabilities/provider.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/vulnerabilities/provider.py) | Query engine for OSV and MITRE CVE feeds | Class `VulnProvider`, `query_version()`, `_parse_mitre()`, `_advisory_severity()` | `httpx`, `concurrent.futures.ThreadPoolExecutor`, `re` | Sends 500-query batch requests to OSV (`https://api.osv.dev/v1/querybatch`); extracts CVE IDs and advisories; concurrently fetches full MITRE CVE v5 records (`https://cveawg.mitre.org/api/cve/{id}`); parses CVSS 3.0/3.1/4.0 scores, vector strings, and fixed versions. | **Fully Inspected** |

---

## 7. Backend Domain Services & Repositories (`backend/app/`)

| File Path | Primary Purpose | Key Symbols / Exports | Key Dependencies | Core Responsibilities | Status |
|---|---|---|---|---|---|
| [`backend/app/scans/orchestrator.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/scans/orchestrator.py) | Scan state machine and job lifecycle management | Class `Orchestrator`, `idempotency_key()`, `backoff_seconds()`, `next_attempt()` | `app.scanner.pipeline`, `app.sources.workspace`, `app.repositories.store` | Handles scan creation with SHA-256 idempotency checking, workspace staging, pipeline execution, stage progression tracking, rescan resets, job retry scheduling, and cancellations. | **Fully Inspected** |
| [`backend/app/repositories/store.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/repositories/store.py) | Relational database data access objects for Scans, JobQueue, SBOMs, and Inventory (928 lines) | Classes `ScanRepo`, `JobQueue`, `BomRepo`; Functions `_scan_row`, `public_scan`, `iso`, `utcnow` | `app.core.db`, `app.catalog.store`, `app.repositories.facts` | Performs CRUD on `scans`, claims queue jobs with `SELECT ... FOR UPDATE SKIP LOCKED`, persists snapshots into `sboms` and `sbom_components`, and manages `inventory_components` with cursor-based pagination. | **Fully Inspected** |
| [`backend/app/repositories/facts.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/repositories/facts.py) | Normalization and retrieval of relational findings, NTIA compliance flags, and catalog links | `persist_snapshot_facts()`, `overlay_snapshot_facts()`, `resolve_catalog_ids()`, `_persist_findings()` | `app.core.db` | Maps scans and SBOMs to catalog project/application IDs; stores vulnerability findings in `findings` and `vulnerabilities` tables; stores NTIA booleans and dependency references on `sbom_components`. | **Fully Inspected** |
| [`backend/app/catalog/store.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/catalog/store.py) | Tenant catalog hierarchy management for Projects and Applications/Services | Class `CatalogRepo`, `ensure_organization()`, `BoundTarget`, `CatalogError` | `app.core.db` | Manages `organizations`, `projects`, and `applications` tables; provides search and cursor pagination for dependent dropdowns; validates and binds (project_id, application_id) pairs. | **Fully Inspected** |
| [`backend/app/credentials/service.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/credentials/service.py) | Authenticated Git credential storage using AES-256-GCM encryption | Classes `CredentialStore`, `Credentials`, `Audit` | `cryptography.hazmat.primitives.ciphers.aead.AESGCM`, `os.urandom` | Encrypts GitHub PATs and App private keys using AES-GCM with unique 12-byte random nonces and authenticated references; decrypts secrets on-demand during scan execution; supports revocation. | **Fully Inspected** |
| [`backend/app/projects/dashboard.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/projects/dashboard.py) | Aggregation engine for Projects & Microservices portfolio view | `list_projects()`, `_snapshot_stats()`, `_risk()` | `app.repositories.store` | Aggregates all scan runs across the tenant into unified project summaries, computing average compliance percentage, total scans, SBOM counts, and risk levels (Healthy, Needs Attention, High Risk). | **Fully Inspected** |
| [`backend/app/sources/workspace.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/sources/workspace.py) | Ingest source handlers: local unpacker, GitHub downloader, bulk CSV/XLSX parser | `prepare_local()`, `prepare_github()`, `parse_bulk()`, `pack_folder()`, `validate_repo_url()` | `openpyxl`, `httpx`, `tempfile`, `app.security.archives` | Extracts local uploaded archives into safe staging directories; pulls GitHub tarballs via authenticated API streams; validates CSV/Excel bulk spreadsheets and deduplicates duplicate rows. | **Fully Inspected** |
| [`backend/app/security/archives.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/security/archives.py) | High-security decompression guard and SSRF prevention | Classes `ExtractLimits`, `UnsafeArchive`, `UnsafeHost`; `extract_zip()`, `extract_tar_gz()`, `assert_safe_host()`, `safe_join()` | `ipaddress`, `socket`, `zipfile`, `tarfile` | Prevents Zip-Slip path traversal attacks via `safe_join`; enforces maximum uncompressed byte caps, entry counts, and compression ratio limits against zip bombs; resolves DNS and blocks private/loopback/cloud metadata IP ranges. | **Fully Inspected** |
| [`backend/app/storage/object_store.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/storage/object_store.py) | Local filesystem object store abstraction | Class `LocalStore`, `open_store()` | `shutil`, `pathlib.Path` | Implements bucket/key storage abstraction (`put`, `get_bytes`, `open`) with strict path traversal validation preventing directory escapes. | **Fully Inspected** |
| [`backend/app/export/formats.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/app/export/formats.py) | Standard SBOM document serialization | `export_snapshot()`, `_cyclonedx()`, `_spdx()`, `_csv()`, `_xlsx()`, `normalize_format()` | `openpyxl.Workbook`, `json`, `csv` | Serializes stored snapshot data into CycloneDX 1.5 JSON (with components & dependency graph), SPDX 2.3 JSON (with DESCRIBES & DEPENDS_ON relationships), flat CSV, and multi-column XLSX spreadsheets. | **Fully Inspected** |

---

## 8. Database Migrations (`backend/migrations/`)

| File Path | Primary Purpose | Key Contents | Core Responsibilities | Status |
|---|---|---|---|---|
| [`backend/migrations/001_initial.up.sql`](file:///d:/Work_Stuff/Projects/S-BOM/backend/migrations/001_initial.up.sql) | Initial scan pipeline schema | `tbl_organizations`, `tbl_security_scans`, `tbl_scan_runs`, `tbl_scan_jobs`, `tbl_bom_snapshots` | Sets up original scan queue, runs, events, snapshots, and credential tables. | **Fully Inspected** |
| [`backend/migrations/002_security_scans_move.up.sql`](file:///d:/Work_Stuff/Projects/S-BOM/backend/migrations/002_security_scans_move.up.sql) | Organization scoping restructuring | Organization cascade foreign keys | Unifies tenant-level ownership across security scans. | **Fully Inspected** |
| [`backend/migrations/004_software_inventory.up.sql`](file:///d:/Work_Stuff/Projects/S-BOM/backend/migrations/004_software_inventory.up.sql) | Software inventory module tables | `tbl_software_inventory`, `tbl_projects_and_microservices` | Adds tracking for registered software packages, risk levels, and licenses. | **Fully Inspected** |
| [`backend/migrations/005_relational_facts.up.sql`](file:///d:/Work_Stuff/Projects/S-BOM/backend/migrations/005_relational_facts.up.sql) | Normalized relational facts & findings | `tbl_vulnerabilities`, `tbl_findings`, NTIA check columns | Separates raw JSON metadata into queryable relational findings and compliance booleans. | **Fully Inspected** |
| [`backend/migrations/006_ten_tables.up.sql`](file:///d:/Work_Stuff/Projects/S-BOM/backend/migrations/006_ten_tables.up.sql) | Canonical ten-table consolidation | 10 final tables (`organizations`, `projects`, `applications`, `inventory_components`, `credentials`, `scans`, `sboms`, `sbom_components`, `vulnerabilities`, `findings`) | Drops all old `tbl_*` tables after data migration; enforces foreign keys, cascades, indexes, and check constraints. | **Fully Inspected** |

---

## 9. Backend Tests (`backend/tests/`)

| File Path | Primary Purpose | Test Cases Covered | Core Responsibilities | Status |
|---|---|---|---|---|
| [`backend/tests/test_bulk_rows.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_bulk_rows.py) | Unit tests for bulk spreadsheet validation | Duplicate row deduplication, invalid rows handling, missing column validation | Validates that duplicate projects in bulk imports are rejected with `DUPLICATE_PROJECT` while valid rows proceed. | **Fully Inspected** |
| [`backend/tests/test_catalog.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_catalog.py) | Integration tests for Catalog Project & Application APIs | Project creation, application binding, mismatch validation, cursor pagination | Tests tenant isolation and parent-child validation for `/api/v1/catalog/projects`. | **Fully Inspected** |
| [`backend/tests/test_db_uptime.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_db_uptime.py) | Database connection resilience tests | Auto-reconnect on dropped connections, dead socket recovery | Verifies `Database.ensure_alive()` recovers cleanly without crashing worker loops. | **Fully Inspected** |
| [`backend/tests/test_inventory.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_inventory.py) | Integration tests for Software Inventory APIs | Batch component insertion, cursor pagination, invalid input handling | Validates `/api/v1/inventory/components` pagination and project upserts. | **Fully Inspected** |
| [`backend/tests/test_local_scan.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_local_scan.py) | End-to-end integration scan tests | Single `package.json` upload, worker job claiming, pipeline execution, result querying | Verifies complete scan lifecycle from HTTP 202 to completed SBOM components and vulnerabilities. | **Fully Inspected** |
| [`backend/tests/test_projects.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_projects.py) | Integration tests for Projects Dashboard aggregation | Status filtering, KPI calculation, risk categorization | Tests `/api/v1/projects` metric rollups against completed scans. | **Fully Inspected** |
| [`backend/tests/test_relational_facts.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_relational_facts.py) | Relational facts persistence tests | Findings table upsert, NTIA compliance boolean verification, dependency edge mapping | Verifies `persist_snapshot_facts()` and `overlay_snapshot_facts()`. | **Fully Inspected** |
| [`backend/tests/test_single_manifest.py`](file:///d:/Work_Stuff/Projects/S-BOM/backend/tests/test_single_manifest.py) | Single manifest scan validation | `requirements.txt`, `pom.xml`, `go.mod` direct uploads | Verifies standalone manifest files can be scanned without archiving into `.zip`. | **Fully Inspected** |

---

## 10. Frontend Application Architecture (`frontend/src/`)

| File Path | Primary Purpose | Key Symbols / Exports | Core Responsibilities | Status |
|---|---|---|---|---|
| [`frontend/src/main.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/main.tsx) | React DOM mounting entry | Root render | Mounts `<App />` into `#root` with React StrictMode. | **Fully Inspected** |
| [`frontend/src/App.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/App.tsx) | Main router and layout shell | Component `App` | Configures React Router routes for Dashboard, Scans, Inventory, Vulnerabilities, Remediation, Compliance, Export, and Settings wrapped in Theme and AppState providers. | **Fully Inspected** |
| [`frontend/src/types/index.ts`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/types/index.ts) | TypeScript domain type definitions | `Project`, `Vulnerability`, `SBOMComponent`, `RemediationTicket`, `PolicyRule`, `ScanJob`, `Severity`, `Ecosystem` | Central type repository for all entity models and UI state objects. | **Fully Inspected** |
| [`frontend/src/api/client.ts`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/api/client.ts) | Typed backend API client (767 lines) | `listScans()`, `startLocalScan()`, `startGithubScan()`, `startBulkScan()`, `scanStatus()`, `scanComponents()`, `scanVulnerabilities()`, `listProjects()`, `listInventoryComponents()`, `addInventoryComponents()`, `healthReady()`, `mapScan()`, `mapComponent()`, `mapVulns()` | Handles HTTP communications with backend via `/api/` proxy; unwraps `{success, data, error}` JSON envelopes; maps backend snake_case records to frontend camelCase domain models. | **Fully Inspected** |
| [`frontend/src/context/AppStateContext.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/context/AppStateContext.tsx) | Central state store & server synchronization (1032 lines) | `AppStateProvider`, `useAppState()`, `startScan()`, `rescanScan()`, `cancelScan()`, `addProject()`, `addComponent()`, `addComponents()`, `exportSBOM()` | Manages live state across projects, scans, inventory components, tickets, and toasts; polls active scan status; hydrates state from backend upon startup. | **Fully Inspected** |
| [`frontend/src/context/ThemeContext.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/context/ThemeContext.tsx) | Theme management context | `ThemeProvider`, `useTheme()`, `theme`, `toggleTheme` | Toggles `'dark'` CSS class on `document.documentElement` and persists preference in `localStorage`. | **Fully Inspected** |
| [`frontend/src/data/mockData.ts`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/data/mockData.ts) | Initial baseline data fixtures | `initialProjects`, `initialVulnerabilities`, `initialComponents`, `initialIntegrations`, `initialUsers` | Defines empty arrays and default users/integrations serving as initial state before backend data sync. | **Fully Inspected** |

---

## 11. Frontend Pages & Views (`frontend/src/pages/`)

| File Path | Primary Purpose | Key Features & Responsibilities | Status |
|---|---|---|---|
| [`frontend/src/pages/dashboard/Dashboard.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/dashboard/Dashboard.tsx) | Executive security posture dashboard | Overall risk index gauge, threat severity donut chart (Recharts), risk trend over time, top vulnerable projects table. | **Fully Inspected** |
| [`frontend/src/pages/scans/SecurityScans.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/scans/SecurityScans.tsx) | Security Scans hub (2303 lines) | 5 sub-views: Scans table, New Scan multi-step wizard (Local folder/zip/manifest, GitHub repo with auth, Bulk CSV/XLSX), Live scan terminal & pipeline stage tracker, Scan history, and Schedules. | **Fully Inspected** |
| [`frontend/src/pages/scans/ScanResultDetails.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/scans/ScanResultDetails.tsx) | Scan details drawer / breakdown | Displays component count, CVE distribution, pipeline stage breakdown, and direct export actions. | **Fully Inspected** |
| [`frontend/src/pages/scans/localFolder.ts`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/scans/localFolder.ts) | Drag-and-drop folder parser | Processes HTML5 drag-and-drop webkitGetAsEntry trees; extracts only recognized manifest files for compact upload. | **Fully Inspected** |
| [`frontend/src/pages/scans/bulkRows.ts`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/scans/bulkRows.ts) | Client-side bulk scan CSV validator | Validates spreadsheet headers and identifies malformed repository URLs before upload. | **Fully Inspected** |
| [`frontend/src/pages/scans/scanProgress.ts`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/scans/scanProgress.ts) | Scan progress calculations | Maps backend `scan_stage` codes to human-readable steps and calculates progress percentage. | **Fully Inspected** |
| [`frontend/src/pages/inventory/SoftwareInventory.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/inventory/SoftwareInventory.tsx) | Registered software inventory table (1216 lines) | Multi-criteria filtering (Ecosystem, License, Risk, Source), CSV export, quick component additions, and SBOM file upload. | **Fully Inspected** |
| [`frontend/src/pages/inventory/AddInventoryComponent.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/inventory/AddInventoryComponent.tsx) | Single component registration form | Dependent Project & Application dropdowns, auto-generated canonical PURL generator, validation, and direct persistence. | **Fully Inspected** |
| [`frontend/src/pages/inventory/SBOMArtifacts.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/inventory/SBOMArtifacts.tsx) | Stored SBOM documents catalog | Displays generated CycloneDX/SPDX documents, file sizes, component counts, signature verification status, and downloads. | **Fully Inspected** |
| [`frontend/src/pages/inventory/UploadInventoryModal.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/inventory/UploadInventoryModal.tsx) | Bulk inventory modal | Ingests external CycloneDX or SPDX JSON documents into the software inventory. | **Fully Inspected** |
| [`frontend/src/pages/projects/ProjectsMicroservices.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/projects/ProjectsMicroservices.tsx) | Projects & Microservices portfolio view | Lists aggregated projects with compliance scores, risk badges, component counts, vulnerability rollups, and deep links. | **Fully Inspected** |
| [`frontend/src/pages/vulnerabilities/Vulnerabilities.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/vulnerabilities/Vulnerabilities.tsx) | Vulnerability management hub | Portfolio-wide vulnerability table with CVSS scores, EPSS probabilities, affected versions, VEX status filters, and remediation drawer. | **Fully Inspected** |
| [`frontend/src/pages/vulnerabilities/VulnerabilityDetail.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/vulnerabilities/VulnerabilityDetail.tsx) | Deep CVE dossier | Detailed breakdown of advisory descriptions, CVSS vectors, CWEs, affected package paths, and patch recommendations. | **Fully Inspected** |
| [`frontend/src/pages/vulnerabilities/Remediation.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/vulnerabilities/Remediation.tsx) | Remediation kanban & ticket board | Ticket SLA tracking (P0-P3), automated fix recommendations, patch upgrade version selectors, and risk acceptance waivers. | **Fully Inspected** |
| [`frontend/src/pages/compliance/Compliance.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/compliance/Compliance.tsx) | Regulatory compliance scorecard | Evaluates posture against CERT-In, NIST SP 800-218 (SSDF), ISO 27001, and NTIA minimum elements. | **Fully Inspected** |
| [`frontend/src/pages/compliance/Policies.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/compliance/Policies.tsx) | Policy enforcement rules engine | Configure security gating rules (e.g. block Critical CVEs, prohibit GPL licenses in distributed binaries). | **Fully Inspected** |
| [`frontend/src/pages/export/ExportCenter.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/export/ExportCenter.tsx) | Enterprise export center (1198 lines) | Export generator for CycloneDX 1.5, SPDX 2.3, CSV, and XLSX formats with live syntax-highlighted previews. | **Fully Inspected** |
| [`frontend/src/pages/supply-chain/SupplyChain.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/supply-chain/SupplyChain.tsx) | Supply chain security dashboard | Component dependency graph visualization, ecosystem distribution, and provenance pedigree. | **Fully Inspected** |
| [`frontend/src/pages/monitoring/Monitoring.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/monitoring/Monitoring.tsx) | Real-time security telemetry | Live scan throughput, queue depth, advisory sync status, and system event logs. | **Fully Inspected** |
| [`frontend/src/pages/monitoring/Integrations.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/monitoring/Integrations.tsx) | Third-party connector hub | Configuration cards for GitHub, GitLab, Bitbucket, Jenkins, Jira, and Slack. | **Fully Inspected** |
| [`frontend/src/pages/settings/Settings.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/settings/Settings.tsx) | Organization settings | Configure organization name, default scan timeouts, webhook secrets, and retention policies. | **Fully Inspected** |
| [`frontend/src/pages/settings/Users.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/settings/Users.tsx) | User & team access management | Manage team members, RBAC roles (Admin, Security Analyst, Developer), and 2FA status. | **Fully Inspected** |
| [`frontend/src/pages/settings/Profile.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/pages/settings/Profile.tsx) | User profile & personal settings | Manage operator display name, email, avatar, and active API tokens. | **Fully Inspected** |

---

## 12. Frontend Reusable Components (`frontend/src/components/`)

| File Path | Primary Purpose | Key Symbols / Exports | Core Responsibilities | Status |
|---|---|---|---|---|
| [`frontend/src/components/layout/Layout.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/layout/Layout.tsx) | App layout frame | Component `Layout` | Assembles Sidebar, TopHeader, main routing view, and floating status/toast containers. | **Fully Inspected** |
| [`frontend/src/components/layout/Sidebar.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/layout/Sidebar.tsx) | Main navigation sidebar | Component `Sidebar` | Navigation links with active route indicators, badge counters, and collapsible sections. | **Fully Inspected** |
| [`frontend/src/components/layout/TopHeader.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/layout/TopHeader.tsx) | Top application bar | Component `TopHeader` | Search shortcut (Cmd+K), quick scan CTA, notification bell, theme toggle, and user profile avatar. | **Fully Inspected** |
| [`frontend/src/components/common/ProjectApplicationSelect.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/ProjectApplicationSelect.tsx) | Dependent Project → Application dropdowns | Component `ProjectApplicationSelect` | Searchable remote-paginated dropdowns that query `/api/v1/catalog/projects` and enforce valid pairings. | **Fully Inspected** |
| [`frontend/src/components/common/SearchableSelect.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/SearchableSelect.tsx) | Generic combobox select | Component `SearchableSelect` | Typeahead select with fuzzy search, keyboard navigation, and custom record creation. | **Fully Inspected** |
| [`frontend/src/components/common/VulnerabilityDrawer.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/VulnerabilityDrawer.tsx) | Slide-out CVE quick view | Component `VulnerabilityDrawer` | Quick-inspection drawer displaying CVSS, EPSS, remediation steps, and direct ticket creation. | **Fully Inspected** |
| [`frontend/src/components/common/Toast.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/Toast.tsx) | Toast notification container | Component `ToastContainer` | Renders animated auto-dismissing notifications for system events and API errors. | **Fully Inspected** |
| [`frontend/src/components/common/StatCard.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/StatCard.tsx) | KPI metric card | Component `StatCard` | Card showing value, trend, subtitle, and severity-colored accent icons. | **Fully Inspected** |
| [`frontend/src/components/common/Badge.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/Badge.tsx) | Severity & status badge | Component `Badge` | Consistent styling for Critical, High, Medium, Low, Compliant, and Non-Compliant badges. | **Fully Inspected** |
| [`frontend/src/components/common/GlobalSearchModal.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/GlobalSearchModal.tsx) | Omnibox search modal (Cmd+K) | Component `GlobalSearchModal` | Instant search modal filtering across projects, components, vulnerabilities, and scans. | **Fully Inspected** |
| [`frontend/src/components/common/NotificationPanel.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/NotificationPanel.tsx) | Notification drawer | Component `NotificationPanel` | Displays real-time scan completions, policy alerts, and new high-severity CVE announcements. | **Fully Inspected** |
| [`frontend/src/components/common/UserMenuModal.tsx`](file:///d:/Work_Stuff/Projects/S-BOM/frontend/src/components/common/UserMenuModal.tsx) | User account dropdown | Component `UserMenuModal` | User switch, profile quick-links, and logout controls. | **Fully Inspected** |
