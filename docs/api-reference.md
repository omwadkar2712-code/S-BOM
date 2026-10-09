# S-BOM Complete API Reference & Endpoint Inventory

All API endpoints are hosted on `http://127.0.0.1:8080` (proxied in local development via Vite on `http://127.0.0.1:5173/api`).

---

## 1. Global Request & Response Specifications

### Headers
| Header | Description | Default / Requirement |
|---|---|---|
| `X-Organization-Id` | Tenant scope for multi-tenant isolation. | `'default'` if omitted. |
| `X-Request-Id` | Distributed tracing correlation ID. | Auto-generated UUID if omitted; echoed back in response headers. |
| `Content-Type` | `application/json` or `multipart/form-data`. | Required for write requests. |

### Envelope Structures
All JSON responses follow a uniform envelope structure:

**Success (`200 OK`, `201 Created`, `202 Accepted`)**:
```json
{
  "success": true,
  "data": { ... },
  "request_id": "c138fbd8-86d3-4638-b7eb-851aa9dd6b26"
}
```

**Error (`400`, `401`, `404`, `409`, `500`)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "application_name is required"
  },
  "request_id": "c138fbd8-86d3-4638-b7eb-851aa9dd6b26"
}
```

---

## 2. Complete Endpoint Inventory

### System & Health Telemetry

#### `GET /health/live`
- **Description**: Liveness probe verifying the FastAPI server process is responsive.
- **Status Code**: `200 OK`
- **Response**: `{"status": "live"}`

#### `GET /health/ready`
- **Description**: Readiness probe verifying the PostgreSQL database is alive and can answer queries.
- **Status Codes**: `200 OK` (healthy) or `503 Service Unavailable` (`NOT_READY`)
- **Response**:
  ```json
  {
    "status": "ready",
    "database": "postgres",
    "database_ok": true,
    "metrics": { ... },
    "scanner": { "name": "bom-engine", "version": "sbom-engine-1.0.0" },
    "exporters": ["cyclonedx-json", "spdx-json", "csv", "xlsx"]
  }
  ```

#### `GET /metrics.json`
- **Description**: Live performance and throughput counters.
- **Status Code**: `200 OK`
- **Metrics Keys**: `scans_total`, `scans_successful`, `scans_failed`, `scan_duration_sum_ms`, `scan_duration_count`, `queue_depth`, `components_discovered`, `vulnerabilities_discover`, `bulk_scans_total`.

---

### Scan Operations (`/api/v1/scans`)

#### `POST /api/v1/scans/local`
- **Description**: Ingests a local project archive (`.zip`, `.tar.gz`), a folder manifest set, or a single manifest file (`package.json`, `pom.xml`, `requirements.txt`).
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Single `UploadFile` (archive or manifest).
  - `files`: List of `UploadFile`s (when uploading multi-file folder manifests).
  - `paths`: List of string relative paths corresponding to `files`.
  - `project_name` / `project_id`: Target project identifier.
  - `application_name` / `application_id`: Target application identifier.
  - `version`: Version string (defaults to `'UNKNOWN'`).
- **Status Code**: `202 Accepted`
- **Response**: `{"scan_id": "uuid", "status": "PENDING", "stage": "QUEUED"}`
- **Error Codes**: `INVALID_INPUT` (400), `UNSUPPORTED_FILE` (400), `PROJECT_NOT_FOUND` (404).

#### `POST /api/v1/scans/github`
- **Description**: Initiates an asynchronous scan of a remote GitHub repository.
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "repository_url": "https://github.com/expressjs/express",
    "branch": "master",
    "commit_sha": "optional-sha",
    "project_name": "Express",
    "application_name": "express-core",
    "version": "4.19.2",
    "authentication": {
      "credential_id": "optional-credential-uuid"
    }
  }
  ```
- **Status Code**: `202 Accepted`
- **Response**: `{"scan_id": "uuid", "status": "PENDING", "stage": "QUEUED"}`
- **Error Codes**: `INVALID_REPOSITORY` (400), `INVALID_INPUT` (400), `CREATE_SCAN_FAILED` (400).

#### `GET /api/v1/scans`
- **Description**: Lists recent scans for the tenant (up to 100 rows).
- **Status Code**: `200 OK`
- **Response**: List of scan objects with status, stage, timestamps, repository/file labels, and snapshot IDs.

#### `GET /api/v1/scans/{scan_id}`
- **Description**: Retrieves detailed metadata for a single scan.
- **Status Code**: `200 OK` or `404 Not Found` (`SCAN_NOT_FOUND`).

#### `GET /api/v1/scans/{scan_id}/status`
- **Description**: Fast status polling endpoint for UI progress bars and live terminals.
- **Status Code**: `200 OK`
- **Response**:
  ```json
  {
    "scan_id": "uuid",
    "status": "RUNNING",
    "stage": "DETECTING_MANIFESTS",
    "started_at": "2026-10-09T04:45:10Z",
    "source_type": "LOCAL",
    "file_name": "package.json"
  }
  ```

#### `POST /api/v1/scans/{scan_id}/rescan`
- **Description**: Resets a completed or failed scan and re-enqueues the original source job.
- **Status Code**: `202 Accepted`
- **Error Codes**: `SCAN_NOT_RESCANNABLE` (409), `SOURCE_UNAVAILABLE` (400).

#### `POST /api/v1/scans/{scan_id}/cancel`
- **Description**: Cancels an active queued or running scan.
- **Status Code**: `202 Accepted`
- **Error Codes**: `SCAN_NOT_CANCELLABLE` (409).

#### `GET /api/v1/scans/{scan_id}/events`
- **Description**: Retrieves the chronological event transition log of the scan.
- **Status Code**: `200 OK`
- **Response**: List of events with `id`, `stage`, `message`, `created_at`, `data`.

#### `GET /api/v1/scans/{scan_id}/sbom`
- **Description**: Retrieves the full stored SBOM document for a completed scan.
- **Status Code**: `200 OK` or `404 Not Found` (`SBOM_NOT_READY`).

#### `GET /api/v1/scans/{scan_id}/components`
- **Description**: Retrieves the list of discovered software components for a completed scan.
- **Status Code**: `200 OK`
- **Response**: Array of components with `id`, `name`, `version`, `ecosystem`, `purl`, `license`, `direct`.

#### `GET /api/v1/scans/{scan_id}/dependencies`
- **Description**: Retrieves the component dependency graph edges.
- **Status Code**: `200 OK`
- **Response**: Array of edges with `from_component_id`, `to_component_id`, `kind`.

#### `GET /api/v1/scans/{scan_id}/vulnerabilities`
- **Description**: Retrieves correlated CVE matches for the scan.
- **Status Code**: `200 OK`
- **Response**: Array of vulnerability match objects with `vulnerability_id`, `severity`, `cvss_score`, `fixed_version`.

#### `GET /api/v1/scans/{scan_id}/export?format={cyclonedx-json|spdx-json|csv|xlsx}`
- **Description**: Generates and downloads an exported SBOM artifact directly. Supports single scans or composite bulk scans.
- **Status Code**: `200 OK` (file download with `Content-Disposition`) or `302 Found` redirect.

---

### Software Inventory (`/api/v1/inventory/components`)

#### `GET /api/v1/inventory/components`
- **Description**: Retrieves registered software components with cursor-based pagination.
- **Query Parameters**: `limit` (default 200, max 500), `cursor` (encoded `created_at|id`).
- **Status Code**: `200 OK`
- **Response**: `{"items": [...], "next_cursor": "..."}`

#### `POST /api/v1/inventory/components`
- **Description**: Batch creates or registers software components into the tenant inventory.
- **Request Body**:
  ```json
  {
    "components": [
      {
        "project": "E-Commerce",
        "project_application": "Payment Gateway",
        "name": "stripe",
        "version": "14.1.0",
        "ecosystem": "npm",
        "license": "MIT",
        "risk": "Safe",
        "field_type": "Library"
      }
    ]
  }
  ```
- **Status Code**: `201 Created`

---

### Projects & Catalog (`/api/v1/projects` & `/api/v1/catalog`)

#### `GET /api/v1/projects`
- **Description**: Aggregated summary portfolio view of projects, active microservices, average compliance, and risk levels.
- **Query Parameters**: `q` (name search filter), `status` (risk filter).
- **Status Code**: `200 OK`

#### `GET /api/v1/catalog/projects`
- **Description**: Searchable project names for UI dropdown selectors.
- **Query Parameters**: `q`, `limit`, `cursor`.
- **Status Code**: `200 OK`

#### `POST /api/v1/catalog/projects`
- **Description**: Creates a new project in the catalog with optional initial application names.
- **Status Code**: `201 Created`

#### `GET /api/v1/catalog/projects/{project_id}/applications-services`
- **Description**: Retrieves applications/services belonging to the specified project.
- **Status Code**: `200 OK`

#### `POST /api/v1/catalog/projects/{project_id}/applications-services`
- **Description**: Adds an application/service to the specified project.
- **Status Code**: `201 Created`

---

### Bulk Scans (`/api/v1/scans/bulk` & `/api/v1/bulk-scans`)

#### `POST /api/v1/scans/bulk`
- **Description**: Uploads a CSV or XLSX spreadsheet containing up to 5,000 project scan definitions.
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `file` (`.csv` or `.xlsx`), `project_name` (optional fallback).
- **Status Code**: `202 Accepted`
- **Response**: Bulk aggregate object with `id`, `total_rows`, `queued_rows`, `invalid_rows`, `validation_errors`, and individual `items`.

#### `GET /api/v1/bulk-scans/{bulk_id}`
- **Description**: Retrieves the status rollup of a bulk scan batch.
- **Status Code**: `200 OK`

---

### Git Credentials (`/api/v1/credentials/github`)

#### `POST /api/v1/credentials/github`
- **Description**: Encrypts and saves a GitHub Personal Access Token or GitHub App PEM private key.
- **Status Code**: `201 Created`

#### `GET /api/v1/credentials/github`
- **Description**: Lists active credentials for the tenant (omitting encrypted secret material).
- **Status Code**: `200 OK`

#### `DELETE /api/v1/credentials/github/{cred_id}`
- **Description**: Revokes a credential and nulls out its encrypted ciphertext.
- **Status Code**: `200 OK`

---

### Webhooks (`/api/v1/github/webhooks`)

#### `POST /api/v1/github/webhooks`
- **Description**: Receives GitHub push or release events, verifies HMAC-SHA256 signatures using `GITHUB_WEBHOOK_SECRET`, and automatically queues scans for the pushed commit.
- **Headers**: `X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery`.
- **Status Code**: `200 OK` (`{"status": "queued", "scan_id": "..."}`) or `401 Unauthorized` (`SIGNATURE_INVALID`).
