# Workspace UI spec

Components for the redesigned sidebar on the BOM Platform. Ship the **Now** column against APIs that already exist. Park **Later** items until the matching workflow is needed.

| | Count |
| --- | ---: |
| Sidebar sections | 10 |
| Components to show now | 59 |
| Safe to add later | 60 |
| Scan sub-pages | 4 |

## How to use this with the screenshot

Dashboard stays the home page. **Security Scans** is the only collapsible item — expand it into New Scan, Live Jobs, History, and Schedules. Everything under **WORKSPACE** should be its own page so inventory, CVEs, tickets, and exports stop sharing one overloaded dashboard.

## Shared chrome (every page)

- Page title + short subtitle stating the job of the page.
- Project / application context filter in the header when the data is scoped.
- Primary action on the right (New scan, Export, Create ticket, Connect).
- Empty, loading, and error states with a single recovery action.

## Section map

| Section | Show now | Add later | Page shape |
| --- | ---: | ---: | --- |
| Dashboard | 8 | 4 | Single page |
| Security Scans | 11 | 5 | New Scan, Live Jobs, Scan History, Scheduled Scans |
| Software Inventory (SBOM) | 7 | 6 | Single page |
| Vulnerability Management | 5 | 7 | Single page |
| Remediation Tickets | 5 | 6 | Single page |
| Regulatory Compliance | 8 | 5 | Single page |
| Security Policies | 3 | 7 | Single page |
| Supply Chain & Provenance | 5 | 7 | Single page |
| Continuous Monitoring | 3 | 6 | Single page |
| Enterprise Integrations | 4 | 7 | Single page |

## Build order

Dashboard and Security Scans (already built) → split Inventory and Vulnerability Management out of the project dashboard / scan modal → Compliance as relocated Export Center → Remediation Tickets board → Policies, Provenance, Monitoring, Integrations.

---

## 1. Dashboard

**Purpose:** Org-level security posture for executives and operators. One screen should answer: how exposed are we, where, and what changed.

**Layout:** Top: risk gauge + 4 KPIs. Middle: severity donut + scan-coverage intel. Bottom: risk trend, top vulnerable projects, project table. Header: time-range and project filter.

**Already in the product:** `GET /dashboard/stats`, `GET /projects`, org and project dashboard views in `frontend/index.html`.

**Do not put on this page:** Full 21-column inventory, CVE triage, and export buttons. Those belong on Inventory, Vulnerability Management, and Compliance.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Overall risk gauge | 0–100 risk index with SECURE / AT RISK / CRITICAL status | `overall_risk_index` from `/dashboard/stats` |
| Now | KPI strip | Total projects, total scans, vulnerable libraries, unique CVEs | `total_projects`, `total_scans`, `vulnerable_libraries`, `total_vulnerabilities` |
| Now | Threat severity donut | Critical / High / Medium / Low share of CVEs | `severity_counts` |
| Now | Scan coverage panel | Which BOM engines ran: SBOM, CBOM, AIBOM, QBOM, HBOM, firmware, runtime | `scanned_types[]`, `risk_breakdown` |
| Now | Risk trend chart | Risk index and vuln count over last scans | `scan_history[{scan_id, submitted, risk_score, vuln_count}]` |
| Now | Top 5 vulnerable projects | Ranked list with risk score; click opens project view | `top_5_vulnerable_projects` |
| Now | Project repository table | Name, risk, apps, scans, vulns, Open action | `GET /projects` |
| Now | First-scan empty CTA | Start first scan when org has no jobs yet | `total_scans === 0` |
| Later | Period comparison | Delta vs last 7 / 30 / 90 days on every KPI | derived from `scan_history` windows |
| Later | License quota widget | Monthly scans used / remaining, storage, warnings | `GET /api/v1/license/dashboard` |
| Later | Executive snapshot | One-click PDF/PNG of the dashboard for audits | client render of current KPIs |
| Later | Business-unit heatmap | Risk by team, product line, or environment | needs org tags on projects |

---

## 2. Security Scans

**Purpose:** Create, watch, and audit scan jobs. This nav item should expand into four sub-pages: New Scan, Live Jobs, History, Schedules.

**Layout:** Collapsible sidebar children. New Scan is a form + live pipeline card. History is a filterable job table that opens a detail modal. Schedules is a calendar-style list.

**Already in the product:** `POST /scans`, `POST /api/v1/scan/remote`, `POST /scans/upload`, `GET /scans`, `GET /scans/{id}/stream`, `WS /scans/{id}/ws`, scheduled-scans CRUD, bulk Excel/CSV UI.

**Sidebar children (collapsible):** New Scan · Live Jobs · Scan History · Scheduled Scans

**Do not put on this page:** Component inspectors and org KPIs. After a job completes, deep-link to Inventory / Vulns instead of dumping the table here.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Target type tabs | Local directory, Remote URL, Bulk spreadsheet | `source_type` local \| git \| archive \| s3 \| bulk |
| Now | Project / app selectors | Pick existing or create new project and application | `GET /projects`, `POST /scans` body org/project/app_name |
| Now | Release tag input | Optional tag with pills of previous tags | `custom_tags`, `tags[]` from `GET /scans` |
| Now | Local drop zone | Drag folder/files, browse, path field, native folder picker | `POST /scans/pick-local`, `POST /scans/upload` |
| Now | Remote URL form | URL, optional branch/tag, optional access token | `POST /api/v1/scan/remote` `source_uri`, `branch`, `token` |
| Now | Bulk orchestrator | xlsx/csv upload, template download, preview table, sequential progress | parsed rows then one `POST /scans` per row |
| Now | Launch Scan button | Validates form, submits job, shows job_id | `POST /scans` → `job_id`, `status=PENDING` |
| Now | Live scan dashboard | Job ID, elapsed timer, status badge, target summary, % bar, live log line, 4 pipeline stages | `WS /scans/{id}/ws` or SSE `/stream`: init\|progress\|completed\|failed |
| Now | History table | Job ID, tag, source, status, submitted, completed, downloads, delete | `GET /scans` |
| Now | Scan detail modal | Summary KPIs, export bar, Components tab, Vulnerabilities tab | `GET /scans/{id}`, `GET /scans/{id}/summary` |
| Now | Schedule list + create | Frequency, run time, days, enable, Run now, delete | CRUD `/api/v1/scheduled-scans` |
| Later | BOM type checkboxes | Toggle SBOM / CBOM / AIBOM / QBOM / HBOM / firmware / runtime per job | `scan_types[]` already accepted by `POST /scans` |
| Later | Scan vs previous diff | New/removed components and new CVEs since last tag | compare two `/summary` payloads |
| Later | Cancel / retry job | Stop a hung run, re-queue failed jobs | needs job cancel API |
| Later | CI trigger tokens | Webhook URL + token for GitHub Actions / Jenkins | future `/integrations/webhooks` |
| Later | Container / image targets | Scan Docker image or registry tag as a source type | future `source_type=oci` |

---

## 3. Software Inventory (SBOM)

**Purpose:** Canonical component catalog across projects. This is the SBOM workspace, not a scan log. Operators search a library and see every place it is used.

**Layout:** Toolbar (search, ecosystem, license, EOL, scope) + KPI chips + inventory table. Row click opens a full-page component inspector. Optional right drawer for graph.

**Already in the product:** `GET /projects/{id}/components`, `GET /scans/{id}/summary` `components[]`, component-detail page, `GET /components/{purl}/impact` and `/history`.

**Do not put on this page:** Org risk gauge and ticket Kanban. Keep this a catalog; send CVE actions to Vulnerability Management.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Inventory view switch | Recent scan, all unique components, or a chosen scan | project components vs scan summary |
| Now | Scope filter | All / Direct / Transitive | dependency graph depth on component |
| Now | Search box | Filter by name, purl, version | client filter on `components[]` |
| Now | Inventory table | Name, version, scope, package manager, criticality, CVE count, risk, Inspect | `name`, `version`, `purl`, `package_manager`, `criticality`, `vuln_count`, `risk_score` |
| Now | Expandable CERT-In row | Supplier, license, EOL, patch status, file path, recommended version | 21 CERT-In attributes from `/summary` |
| Now | Component inspector page | Hero (purl, badges, risk), identity, evidence matrix, security posture, metadata, dep chain, CVE list | component dict + `GET /components/{purl}/impact` |
| Now | Pagination | Page controls for large inventories | client paging; later limit/offset on API |
| Later | Org-wide catalog | One table across all projects, with used-by count | aggregate purls from every project |
| Later | Facet filters | Ecosystem, license family, EOL within 90 days, has CVE, unsigned | `license`, `eol_date`, `package_manager` |
| Later | Version conflict finder | Same package, multiple versions in one org | group by purl name |
| Later | BOM type tabs | SBOM \| CBOM crypto assets \| AIBOM models \| HBOM firmware \| QBOM | `GET /scans/{id}/cbom`, crypto assets APIs, AIBOM fields |
| Later | Import SBOM | Upload CycloneDX/SPDX instead of scanning source | `POST /api/v1/enrich/sbom` |
| Later | Interactive dependency graph | Zoomable dependsOn tree with blast-radius highlight | `GET /api/v1/graph/dependents\|dependencies/{purl}` |

---

## 4. Vulnerability Management

**Purpose:** A dedicated CVE inbox. Today vulns live inside scan modals; this page should be the operational queue for triage.

**Layout:** KPI severity chips, filter bar, grouped table (by CVE or by component), side panel for CVE detail + VEX + blast radius. Bulk actions on selected rows.

**Already in the product:** `vulnerabilities[]` on `/summary`, NVD/OSV/GHSA/MITRE enrichment, VEX status, hidden risk-acceptances tab, remediate-cve.

**Do not put on this page:** Scan configuration and Excel downloads. Link out to Scans and Compliance.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Severity KPI chips | Counts for Critical / High / Medium / Low; click filters table | `severity_counts` + `vulnerabilities[].severity` |
| Now | Vuln table (per scan) | CVE ID, severity, CVSS, affected component, VEX status, Remediate | `vulnerabilities[] {id, severity, cvss, affected, vex_status}` |
| Now | CVE detail in inspector | Description, CWE, references, affected version, recommended version | `known_vulnerabilities`, `GET /api/v1/vuln/cve/{id}` |
| Now | VEX badge | affected / not_affected / fixed / under_investigation | `vex_status` |
| Now | Top vulnerable libraries | Libraries ranked by vuln count or risk | project `top_libraries[]` |
| Later | Org-wide vuln inbox | Deduped CVEs across all projects, not one scan at a time | rollup of vulnerabilities by `cve_id` |
| Later | Intel overlays | CISA KEV flag, EPSS exploit probability, published date | future enrichment fields |
| Later | Reachability filter | Show only reachable / runtime-confirmed CVEs | graph + future trace scans |
| Later | Blast-radius panel | How many apps/services depend on the vulnerable purl | `GET /components/{purl}/impact` `blast_radius_score` |
| Later | Group-by toggle | Group by CVE, component, project, or CWE | client grouping |
| Later | Exception workflow | Accept risk with expiry, approver, justification (restore hidden tab) | `POST/GET /api/v1/risk-acceptances` |
| Later | SLA clocks | Time-to-remediate by severity policy | policy thresholds + `first_seen` |

---

## 5. Remediation Tickets

**Purpose:** Turn a CVE into tracked work: AI plan, patch, verify, or accept risk. This is the workflow page, not the vuln catalog.

**Layout:** Kanban or table of tickets. Click opens a ticket drawer: AI plan, version picker, PR/status, verification proof, VEX justification.

**Already in the product:** `POST /api/v1/remediation/analyze`, `GET .../remediation-options`, `POST .../remediate-cve`, `POST .../component/rescan`, AI modal in UI.

**Do not put on this page:** The full CVE catalog. Tickets start from a vuln; they are not a second inbox of every CVE.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | AI remediation modal | Recommended version, strategy, risk reduction %, CVSS before/after, breaking changes, insight, alternatives, snippet | `ai_rationale` from `/remediation/analyze` |
| Now | Version options panel | Current vs recommended vs latest, with vuln counts on each | `GET /scans/{id}/remediation-options` |
| Now | Apply patch action | Execute upgrade, optional GitHub sync, regenerate Excel | `POST /scans/{id}/remediate-cve` |
| Now | Component re-scan | Refresh CERT-In row after a status override | `POST /scans/{id}/component/rescan` |
| Now | Risk acceptance form | VEX status, justification, approver, expiry | `POST /api/v1/risk-acceptances` |
| Later | Ticket board | Open, In progress, PR opened, Verified, Closed, Accepted risk | new tickets table keyed by cve+purl+project |
| Later | Ticket list columns | ID, CVE, component, project, owner, severity, SLA, source scan | ticket records + `scan_id` |
| Later | Batch remediation plan | One plan for all CVEs on a scan, copyleft warnings | `POST /api/v1/remediation/batch`, `GET /remediation/history/{scan_id}` |
| Later | Verification proof card | verified_safe, residual CVEs after upgrade | `verification_proof` from analyze |
| Later | Auto-PR status | Link to GitHub PR, CI check, merge state | GitHub sync flag on remediate-cve |
| Later | External ticket sync | Create/update Jira or ServiceNow from a row | Enterprise Integrations |

---

## 6. Regulatory Compliance

**Purpose:** Prove coverage to auditors. Move Export Center here and add a live coverage matrix, not only download buttons.

**Layout:** Framework scorecards on top. Coverage matrix in the middle. Export configurator (single project / multi / specific scan) and artifact cards at the bottom.

**Already in the product:** Export Center page, `GET /export/bundle`, `/scans/{id}/report|sbom|spdx|vex|csaf|tiers`, `POST /api/v1/report/compliance` (CLI).

**Do not put on this page:** Live scan progress and AI patch UI. This page is evidence and exports for auditors.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Export scope panel | Single project + apps, multiple projects, or one scan run | project/app/scan selectors |
| Now | Excel 28-column card | Download CERT-In workbook | `GET /scans/{id}/report` `.xlsx` |
| Now | CycloneDX card | Download enriched SBOM JSON | `GET /scans/{id}/sbom` |
| Now | SPDX 2.3 card | Download ISO/IEC 5962 JSON | `GET /scans/{id}/spdx` |
| Now | VEX card | Download exploitability document | `GET /scans/{id}/vex` |
| Now | CSAF 2.0 card | Download OASIS advisory | `GET /scans/{id}/csaf` |
| Now | Signed tiers card | ECDSA P-256 multi-tier package | `GET /scans/{id}/tiers` |
| Now | Bundle ZIP | One archive of selected artifacts for many scans | `GET /export/bundle?scan_ids=` |
| Later | Framework scorecards | CERT-In, NTIA minimum, EU CRA, NIST SSDF, ISO 27001 — % coverage | `POST /api/v1/report/compliance` |
| Later | Field-level matrix | Each required attribute green/amber/red with missing examples | `POST /api/v1/report/validate` 21-attribute check |
| Later | PQC / CARS scorecard | Quantum readiness and crypto risk for CBOM assets | `GET /api/v1/reports/compliance/pqc`, `/reports/risk/cars` |
| Later | Audit evidence pack | Timestamped ZIP: SBOM + signature + coverage JSON + Excel | bundle + `GET /api/v1/keys/verify` |
| Later | Public vs private split | Customer-facing SBOM without vuln details vs internal copy | `POST /api/v1/report/split` |

---

## 7. Security Policies

**Purpose:** Org rules that scans and tickets must obey: licenses, severity gates, VEX defaults, signing keys, retention.

**Layout:** Left: policy list. Right: editor with preview of what would fail on the latest scan. Publish + version history.

**Already in the product:** Notes & Methodology page (risk formula, criticality, license notes), org settings, license features, ECDSA key APIs, delete-all-data.

**Do not put on this page:** Per-scan Git tokens and connector setup. Tokens move to Enterprise Integrations.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Methodology reference | How risk, criticality, EOL proximity, and licenses are scored | static Notes & Methodology page |
| Now | Org settings form | Org name and basic workspace settings | `page-org-settings` |
| Now | License entitlements | Plan features that unlock scheduled scans, seats, storage | `GET /license/features`, `/api/v1/license/dashboard` |
| Later | License allow/deny list | Block GPL-3.0 / AGPL; warn on copyleft; allow MIT/Apache | license SPDX on each component |
| Later | Quality gate | Fail scan if Critical > 0 or risk > threshold | `policy_gate_result` from pipeline plans |
| Later | VEX defaults | Default justification text and allowed statuses | risk-acceptances schema |
| Later | Signing key manager | Init ECDSA key, show public PEM, rotate, verify SBOM signature | `POST /api/v1/keys/init`, `GET /keys/public`, `POST /keys/sign-sbom`, `/verify` |
| Later | Notification rules | Email/webhook when Critical CVE appears or scan fails | notifications page plus future channels |
| Later | Retention policy | Keep scans N days; confirm wipe of all scan data | `POST /license/delete-all-data` |
| Later | RBAC roles | Viewer, Analyst, Remediator, Auditor, Admin | `auth/me` tier + admin license APIs |

---

## 8. Supply Chain & Provenance

**Purpose:** Trust where a component came from: supplier, hashes, pedigree, signatures, blast radius. Distinct from the inventory list.

**Layout:** Search a purl. Show identity + hash evidence + supplier confidence. Graph canvas for dependents/dependencies. Signature and pedigree timeline on the right.

**Already in the product:** supplier/hash/EOL enrichment, `evidence_matrix`, graph impact/history/dependents/path/cycles, HBOM pedigree, signed SBOMs.

**Do not put on this page:** A second copy of the inventory table. This page is trust evidence for one component or path.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Evidence matrix | Declared vs installed vs resolved version from multiple scanners | `evidence_matrix` on component |
| Now | Supplier + hash fields | Maintainer, SPDX license, SHA, download location | enrich/supplier, registry metadata, hashes |
| Now | Impact summary | Direct dependents, transitive counts, blast_radius_score 0–100 | `GET /components/{purl}/impact` |
| Now | Version history | Installed vs latest vs recommended, EOL, vuln_count per version | `GET /components/{purl}/history` |
| Now | Signature badge on exports | NIST P-256 signed artifact indicator | `GET /scans/{id}/tiers`, keys/verify |
| Later | Path explorer | From app A to package B: hops and path[] | `GET /api/v1/graph/path` |
| Later | Cycle detector | List circular dependencies in a scan | `GET /api/v1/graph/cycles` |
| Later | Supplier risk map | Country, org, confidence, source of supplier field | `GET /api/v1/enrich/supplier` |
| Later | Tamper / hash mismatch | Lockfile hash vs downloaded artifact hash | registry digests vs local files |
| Later | SLSA / build provenance | Builder ID, commit SHA, CI run, materials | future attestation ingest |
| Later | Typosquat alerts | Near-name packages not in the manifest | future intel |
| Later | HBOM pedigree | Manufacturer, country of origin, serial, revision | HBOM CISA pedigree fields |

---

## 9. Continuous Monitoring

**Purpose:** Watch already-scanned inventories after the job finishes: new CVEs, drift, failed schedules, scanner health.

**Layout:** Watchlist of projects on the left. Alert stream in the center. Scanner/tool health and schedule calendar on the right.

**Already in the product:** Scheduled scans API, scan history trend, `GET /tools/status`, license warnings.

**Do not put on this page:** Manual Launch Scan. Monitoring is unattended; creation stays under Security Scans.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Schedule calendar | Next run, last run, frequency, enable/disable, Run now | `GET /api/v1/scheduled-scans` |
| Now | Historical risk curve | Same trend chart as dashboard, focused on drift | `scan_history` |
| Now | Scanner tools status | Installed scanners and versions (admin) | `GET /tools/status`, `POST /tools/update` |
| Later | Inventory watchlist | Projects/repos monitored even when no user is in the UI | scheduled-scans + project ids |
| Later | New-CVE drift alerts | CVE published against a known purl without a new source scan | periodic re-query of OSV/NVD against stored purls |
| Later | Alert inbox | Failed job, quota exceeded, Critical CVE, EOL in 30 days | notifications page + license warnings |
| Later | Channel routing | Email, Slack, webhook per rule | future integrations |
| Later | Runtime / trace jobs | Operator-privileged live trace scans | `POST /api/v1/scan/trace` |
| Later | Quota burn-down | Scans/day and storage against plan | license dashboard metrics |

---

## 10. Enterprise Integrations

**Purpose:** Connect the platform to the rest of the enterprise: VCS, tickets, CI, SSO, SIEM. Keep secrets here, not on the scan form.

**Layout:** Catalog of connectors as cards (Connected / Not connected). Each card opens a setup drawer. API keys and webhook log at the bottom.

**Already in the product:** Git token on remote scan form, S3 URIs, NVD/OSV/GHSA/registry calls in the engine, AI providers for remediation, scanner binary bootstrap.

**Do not put on this page:** One-off tokens on the scan form as the long-term model. Saved connections replace that.

### UI components

| When | Component | What the user sees | Backing data |
| --- | --- | --- | --- |
| Now | Per-scan Git token field | Optional PAT on remote scan (not a saved connection) | `POST /api/v1/scan/remote` token |
| Now | S3 / archive / web URL sources | Documented as scan targets, not connector cards | resolver providers git\|archive\|s3\|web |
| Now | Intel sources (read-only) | Status that NVD, OSV, GHSA, endoflife.date, registries are in use | engine outbound APIs |
| Now | AI remediator providers | Grok primary, Gemini/OpenAI fallback — no UI picker yet | xAI / Gemini / OpenAI in remediator |
| Later | GitHub / GitLab / Bitbucket apps | Install app, list repos, auto-scan on push | saved OAuth + webhooks |
| Later | Jira / ServiceNow | Map Remediation Tickets to external issues | ticket IDs on remediate flow |
| Later | CI plugins | GitHub Action / Jenkins / GitLab CI quality gate | CLI + `/license/validate-scan` |
| Later | SSO (SAML / OIDC) | Replace local username login for enterprise IdP | future auth |
| Later | SIEM export | Push CSAF/VEX or scan-failed events to Splunk/Sentinel | CSAF/VEX artifacts |
| Later | Cloud logs for shadow AI | AWS CloudTrail / Azure / GCP connectors for AIBOM | AIBOM cloud audit parsers already in engine |
| Later | Saved API keys for CLI | Generate scoped tokens; never show Git tokens on the scan form | future token vault |

---

## Source

Redesigned WORKSPACE sidebar, `frontend/index.html` pages (dashboard, scan, history, export-center, component-detail), and the BOM Platform API catalog (scans, dashboard, graph, remediation, scheduled-scans, reports, keys, CBOM).
