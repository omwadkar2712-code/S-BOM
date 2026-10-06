import type { ComponentFieldType, Ecosystem, LicenseType, SBOMComponent, Severity } from '../../types';

export type UploadedInventoryComponent = Pick<
  SBOMComponent,
  | 'name'
  | 'packageName'
  | 'version'
  | 'project'
  | 'projectApplication'
  | 'fieldType'
  | 'license'
  | 'cves'
  | 'purl'
  | 'risk'
  | 'ecosystem'
  | 'directDependency'
  | 'supplier'
>;

export type ParsedSbomUpload = {
  format: 'CycloneDX' | 'SPDX';
  rows: UploadedInventoryComponent[];
};

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function fileStem(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || 'Uploaded SBOM';
  return base.replace(/\.(cdx|spdx)\.(json|xml|ya?ml)$/i, '').replace(/\.(json|xml|spdx|ya?ml)$/i, '') || 'Uploaded SBOM';
}

function cleanLicense(value: unknown): LicenseType {
  const text = asText(value);
  if (!text || text === 'NOASSERTION' || text === 'NONE') return 'Unknown';
  return text as LicenseType;
}

function cleanVersion(value: unknown): string {
  const text = asText(value);
  if (!text || text === 'NOASSERTION' || text === 'NONE') return '—';
  return text;
}

function fieldTypeFrom(value: unknown): ComponentFieldType {
  const key = asText(value).toLowerCase().replace(/[_\s]+/g, '-');
  switch (key) {
    case 'application':
      return 'Application';
    case 'framework':
      return 'Framework';
    case 'container':
      return 'Container';
    case 'file':
    case 'source':
    case 'archive':
      return 'File';
    case 'operating-system':
      return 'Operating System';
    case 'device':
    case 'firmware':
    case 'device-driver':
      return 'Device / Firmware';
    case 'service':
      return 'Service';
    default:
      return 'Library';
  }
}

function ecosystemFromPurl(purl: string): Ecosystem {
  const type = (purl.match(/^pkg:([^/]+)\//i)?.[1] || '').toLowerCase();
  switch (type) {
    case 'npm':
      return 'npm';
    case 'pypi':
      return 'PyPI';
    case 'maven':
      return 'Maven';
    case 'golang':
      return 'Go';
    case 'cargo':
      return 'Cargo';
    case 'gem':
      return 'RubyGems';
    case 'nuget':
      return 'NuGet';
    case 'composer':
      return 'Packagist';
    default:
      return 'npm';
  }
}

function packageNameFromPurl(purl: string, fallback: string): string {
  const body = purl.split('?')[0].replace(/^pkg:[^/]+\//i, '');
  const at = body.lastIndexOf('@');
  const path = at > 0 ? body.slice(0, at) : body;
  if (!path) return fallback;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function fallbackPurl(name: string, version: string): string {
  const safeName = encodeURIComponent(name || 'component');
  const safeVersion = version && version !== '—' ? `@${version}` : '';
  return `pkg:generic/${safeName}${safeVersion}`;
}

function riskFromRank(rank: number): Severity | 'Safe' {
  if (rank >= 4) return 'Critical';
  if (rank >= 3) return 'High';
  if (rank >= 2) return 'Medium';
  if (rank >= 1) return 'Low';
  return 'Safe';
}

function severityRank(severity: string, score: number): number {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      break;
  }
  if (score >= 9) return 4;
  if (score >= 7) return 3;
  if (score >= 4) return 2;
  if (score > 0) return 1;
  return 2;
}

function flattenComponents(items: unknown): AnyRecord[] {
  if (!Array.isArray(items)) return [];
  const out: AnyRecord[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    out.push(item);
    out.push(...flattenComponents(item.components));
  }
  return out;
}

function cycloneLicense(component: AnyRecord): LicenseType {
  const licenses = component.licenses;
  if (!Array.isArray(licenses) || licenses.length === 0) return 'Unknown';
  const first = licenses[0];
  if (typeof first === 'string') return cleanLicense(first);
  if (!isRecord(first)) return 'Unknown';
  if (asText(first.expression)) return cleanLicense(first.expression);
  const license = isRecord(first.license) ? first.license : first;
  return cleanLicense(asText(license.id) || asText(license.name));
}

function cycloneSupplier(component: AnyRecord): string {
  const supplier = isRecord(component.supplier) ? component.supplier : null;
  return asText(supplier?.name) || asText(component.author) || 'Uploaded SBOM';
}

function indexCycloneVulns(doc: AnyRecord): Map<string, { count: number; rank: number }> {
  const stats = new Map<string, { count: number; rank: number }>();
  const vulns = Array.isArray(doc.vulnerabilities) ? doc.vulnerabilities : [];
  for (const vuln of vulns) {
    if (!isRecord(vuln)) continue;
    const rating = Array.isArray(vuln.ratings) && isRecord(vuln.ratings[0]) ? vuln.ratings[0] : {};
    const rank = severityRank(asText(rating.severity), Number(rating.score) || 0);
    const affects = Array.isArray(vuln.affects) ? vuln.affects : [];
    for (const affect of affects) {
      if (!isRecord(affect)) continue;
      const ref = asText(affect.ref);
      if (!ref) continue;
      const current = stats.get(ref) || { count: 0, rank: 0 };
      current.count += 1;
      current.rank = Math.max(current.rank, rank);
      stats.set(ref, current);
    }
  }
  return stats;
}

function directCycloneRefs(doc: AnyRecord, rootRef: string): Set<string> | null {
  const dependencies = Array.isArray(doc.dependencies) ? doc.dependencies : [];
  if (dependencies.length === 0) return null;
  const match = dependencies.find((item) => isRecord(item) && asText(item.ref) === rootRef);
  const entry = isRecord(match) ? match : dependencies.find(isRecord);
  if (!entry || !isRecord(entry)) return null;
  const refs = Array.isArray(entry.dependsOn) ? entry.dependsOn.map(asText).filter(Boolean) : [];
  return new Set(refs);
}

function toInventoryRow(input: {
  name: string;
  packageName?: string;
  version: string;
  project: string;
  projectApplication: string;
  fieldType: ComponentFieldType;
  license: LicenseType;
  cves: number;
  purl: string;
  risk: Severity | 'Safe';
  directDependency: boolean;
  supplier: string;
}): UploadedInventoryComponent {
  const name = input.name || 'component';
  const version = input.version || '—';
  const purl = input.purl || fallbackPurl(name, version);
  return {
    name,
    packageName: input.packageName || packageNameFromPurl(purl, name),
    version,
    project: input.project || 'Uploaded SBOM',
    projectApplication: input.projectApplication || input.project || 'Uploaded SBOM',
    fieldType: input.fieldType,
    license: input.license,
    cves: input.cves,
    purl,
    risk: input.risk,
    ecosystem: ecosystemFromPurl(purl),
    directDependency: input.directDependency,
    supplier: input.supplier || 'Uploaded SBOM',
  };
}

function dedupeRows(rows: UploadedInventoryComponent[]): UploadedInventoryComponent[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.purl}|${row.name}|${row.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseCycloneDx(doc: AnyRecord, fileName: string): ParsedSbomUpload {
  const metadata = isRecord(doc.metadata) ? doc.metadata : {};
  const root = isRecord(metadata.component) ? metadata.component : {};
  const stem = fileStem(fileName);
  const project = asText(root.name) || stem;
  const projectApplication = asText(root.name) || project;
  const vulns = indexCycloneVulns(doc);
  const rootRef = asText(root['bom-ref']) || asText(root.purl);
  const directRefs = directCycloneRefs(doc, rootRef);

  const components = flattenComponents(doc.components);
  if (asText(root.name)) {
    const rootPurl = asText(root.purl);
    const already = components.some((item) => {
      const purl = asText(item.purl);
      return (rootPurl && purl === rootPurl) || (asText(item.name) === asText(root.name) && asText(item.version) === asText(root.version));
    });
    if (!already) components.unshift(root);
  }

  const rows = components
    .map((component) => {
      const name = asText(component.name);
      if (!name) return null;
      const version = cleanVersion(component.version);
      const purl = asText(component.purl);
      const group = asText(component.group);
      const bomRef = asText(component['bom-ref']);
      const stat = vulns.get(bomRef) || vulns.get(purl) || { count: 0, rank: 0 };
      const isRoot = Boolean(rootRef) && (bomRef === rootRef || purl === rootRef);
      const directDependency = directRefs ? isRoot || directRefs.has(bomRef) || directRefs.has(purl) : true;
      return toInventoryRow({
        name,
        packageName: group ? `${group}/${name}` : undefined,
        version,
        project,
        projectApplication,
        fieldType: fieldTypeFrom(component.type),
        license: cycloneLicense(component),
        cves: stat.count,
        purl,
        risk: stat.count > 0 ? riskFromRank(stat.rank) : 'Safe',
        directDependency,
        supplier: cycloneSupplier(component),
      });
    })
    .filter((row): row is UploadedInventoryComponent => Boolean(row));

  return { format: 'CycloneDX', rows: dedupeRows(rows) };
}

function spdxLicense(pkg: AnyRecord): LicenseType {
  const concluded = cleanLicense(pkg.licenseConcluded);
  if (concluded !== 'Unknown') return concluded;
  return cleanLicense(pkg.licenseDeclared);
}

function spdxPurl(pkg: AnyRecord): string {
  const refs = Array.isArray(pkg.externalRefs) ? pkg.externalRefs : [];
  for (const ref of refs) {
    if (!isRecord(ref)) continue;
    const type = asText(ref.referenceType).toLowerCase();
    const locator = asText(ref.referenceLocator);
    if (type === 'purl' && locator) return locator;
  }
  return '';
}

function spdxSupplier(pkg: AnyRecord): string {
  const raw = asText(pkg.supplier) || asText(pkg.originator);
  return raw.replace(/^(Organization|Person):\s*/i, '') || 'Uploaded SBOM';
}

function parseSpdx(doc: AnyRecord, fileName: string): ParsedSbomUpload {
  const packages = Array.isArray(doc.packages) ? doc.packages.filter(isRecord) : [];
  const relationships = Array.isArray(doc.relationships) ? doc.relationships.filter(isRecord) : [];
  const described = Array.isArray(doc.documentDescribes) ? doc.documentDescribes.map(asText).filter(Boolean) : [];
  const describesRel = relationships.find((rel) => asText(rel.relationshipType).toUpperCase() === 'DESCRIBES');
  const rootId = described[0] || asText(describesRel?.relatedSpdxElement);
  const rootPkg = packages.find((pkg) => asText(pkg.SPDXID) === rootId) || packages[0];
  const stem = fileStem(fileName);
  const project = asText(doc.name) || asText(rootPkg?.name) || stem;
  const projectApplication = asText(rootPkg?.name) || project;

  const directIds = new Set(
    relationships
      .filter((rel) => {
        const type = asText(rel.relationshipType).toUpperCase();
        return asText(rel.spdxElementId) === rootId && (type === 'DEPENDS_ON' || type === 'CONTAINS');
      })
      .map((rel) => asText(rel.relatedSpdxElement))
      .filter(Boolean),
  );
  const hasGraph = relationships.length > 0;

  const rows = packages
    .map((pkg) => {
      const name = asText(pkg.name);
      if (!name) return null;
      const spdxId = asText(pkg.SPDXID);
      const purl = spdxPurl(pkg);
      const isRoot = Boolean(rootId) && spdxId === rootId;
      return toInventoryRow({
        name,
        version: cleanVersion(pkg.versionInfo),
        project,
        projectApplication,
        fieldType: fieldTypeFrom(pkg.primaryPackagePurpose || (isRoot ? 'application' : 'library')),
        license: spdxLicense(pkg),
        cves: 0,
        purl,
        risk: 'Safe',
        directDependency: hasGraph ? isRoot || directIds.has(spdxId) : true,
        supplier: spdxSupplier(pkg),
      });
    })
    .filter((row): row is UploadedInventoryComponent => Boolean(row));

  return { format: 'SPDX', rows: dedupeRows(rows) };
}

function childElements(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((el) => el.localName === name);
}

function firstText(parent: Element, name: string): string {
  const el = childElements(parent, name)[0];
  return (el?.textContent || '').trim();
}

function parseCycloneXml(xml: string, fileName: string): ParsedSbomUpload {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('This XML file could not be read as CycloneDX.');
  }
  const bom = doc.documentElement;
  if (!bom || bom.localName.toLowerCase() !== 'bom') {
    throw new Error('This file is not a CycloneDX or SPDX document.');
  }

  const metadata = childElements(bom, 'metadata')[0];
  const rootEl = metadata ? childElements(metadata, 'component')[0] : undefined;
  const componentEls = childElements(bom, 'components').flatMap((group) => childElements(group, 'component'));
  const components = rootEl ? [rootEl, ...componentEls.filter((el) => el !== rootEl)] : componentEls;

  const vulns = new Map<string, { count: number; rank: number }>();
  for (const vuln of childElements(bom, 'vulnerabilities').flatMap((group) => childElements(group, 'vulnerability'))) {
    const rating = childElements(vuln, 'ratings').flatMap((group) => childElements(group, 'rating'))[0];
    const rank = severityRank(
      rating ? firstText(rating, 'severity') : '',
      rating ? Number(firstText(rating, 'score')) || 0 : 0,
    );
    const refs = childElements(vuln, 'affects').flatMap((group) =>
      childElements(group, 'target').map((target) => firstText(target, 'ref')),
    );
    for (const ref of refs) {
      if (!ref) continue;
      const current = vulns.get(ref) || { count: 0, rank: 0 };
      current.count += 1;
      current.rank = Math.max(current.rank, rank);
      vulns.set(ref, current);
    }
  }

  const dependencyGroups = childElements(bom, 'dependencies');
  const rootRef = rootEl?.getAttribute('bom-ref') || '';
  let directRefs: Set<string> | null = null;
  if (dependencyGroups.length) {
    const entries = dependencyGroups.flatMap((group) => childElements(group, 'dependency'));
    const rootEntry = entries.find((entry) => entry.getAttribute('ref') === rootRef) || entries[0];
    if (rootEntry) {
      directRefs = new Set(
        childElements(rootEntry, 'dependency')
          .map((entry) => entry.getAttribute('ref') || '')
          .filter(Boolean),
      );
    }
  }

  const stem = fileStem(fileName);
  const project = (rootEl ? firstText(rootEl, 'name') : '') || stem;
  const rows = components
    .map((component) => {
      const name = firstText(component, 'name');
      if (!name) return null;
      const version = cleanVersion(firstText(component, 'version'));
      const purl = firstText(component, 'purl');
      const group = firstText(component, 'group');
      const bomRef = component.getAttribute('bom-ref') || '';
      const licenseEl = childElements(component, 'licenses').flatMap((group) => childElements(group, 'license'))[0];
      const license = licenseEl
        ? cleanLicense(firstText(licenseEl, 'id') || firstText(licenseEl, 'name') || licenseEl.textContent || '')
        : cleanLicense(childElements(component, 'licenses').map((group) => firstText(group, 'expression'))[0]);
      const stat = vulns.get(bomRef) || vulns.get(purl) || { count: 0, rank: 0 };
      const supplierEl = childElements(component, 'supplier')[0];
      return toInventoryRow({
        name,
        packageName: group ? `${group}/${name}` : undefined,
        version,
        project,
        projectApplication: project,
        fieldType: fieldTypeFrom(component.getAttribute('type')),
        license,
        cves: stat.count,
        purl,
        risk: stat.count > 0 ? riskFromRank(stat.rank) : 'Safe',
        directDependency: directRefs ? bomRef === rootRef || directRefs.has(bomRef) || directRefs.has(purl) : true,
        supplier: supplierEl ? firstText(supplierEl, 'name') : 'Uploaded SBOM',
      });
    })
    .filter((row): row is UploadedInventoryComponent => Boolean(row));

  return { format: 'CycloneDX', rows: dedupeRows(rows) };
}

type TagPackage = {
  name: string;
  version: string;
  license: string;
  purl: string;
  purpose: string;
  spdxId: string;
  supplier: string;
};

function parseSpdxTagValue(text: string, fileName: string): ParsedSbomUpload {
  const packages: TagPackage[] = [];
  let current: TagPackage | null = null;
  let documentName = '';
  const relationships: { from: string; type: string; to: string }[] = [];

  const flush = () => {
    if (current?.name) packages.push(current);
    current = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const splitAt = line.indexOf(':');
    if (splitAt < 0) continue;
    const key = line.slice(0, splitAt).trim();
    const value = line.slice(splitAt + 1).trim();

    if (key === 'DocumentName') {
      documentName = value;
      continue;
    }
    if (key === 'PackageName') {
      flush();
      current = { name: value, version: '', license: '', purl: '', purpose: '', spdxId: '', supplier: '' };
      continue;
    }
    if (key === 'Relationship') {
      const match = value.match(/^(\S+)\s+(\S+)\s+(\S+)/);
      if (match) relationships.push({ from: match[1], type: match[2].toUpperCase(), to: match[3] });
      continue;
    }
    if (!current) continue;
    if (key === 'SPDXID') current.spdxId = value;
    else if (key === 'PackageVersion') current.version = value;
    else if (key === 'PackageLicenseConcluded' && cleanLicense(value) !== 'Unknown') current.license = value;
    else if (key === 'PackageLicenseDeclared' && !current.license && cleanLicense(value) !== 'Unknown') current.license = value;
    else if (key === 'PrimaryPackagePurpose') current.purpose = value;
    else if ((key === 'PackageSupplier' || key === 'PackageOriginator') && !current.supplier) current.supplier = value;
    else if (key === 'ExternalRef' && /purl/i.test(value)) {
      const purl = value.split(/\s+/).find((part) => part.startsWith('pkg:'));
      if (purl) current.purl = purl;
    }
  }
  flush();

  const describes = relationships.find((rel) => rel.type === 'DESCRIBES');
  const rootId = describes?.to || packages[0]?.spdxId || '';
  const rootPkg = packages.find((pkg) => pkg.spdxId === rootId) || packages[0];
  const stem = fileStem(fileName);
  const project = documentName || rootPkg?.name || stem;
  const projectApplication = rootPkg?.name || project;
  const directIds = new Set(
    relationships.filter((rel) => rel.from === rootId && (rel.type === 'DEPENDS_ON' || rel.type === 'CONTAINS')).map((rel) => rel.to),
  );

  const rows = packages.map((pkg) => {
    const isRoot = Boolean(rootId) && pkg.spdxId === rootId;
    return toInventoryRow({
      name: pkg.name,
      version: cleanVersion(pkg.version),
      project,
      projectApplication,
      fieldType: fieldTypeFrom(pkg.purpose || (isRoot ? 'application' : 'library')),
      license: cleanLicense(pkg.license),
      cves: 0,
      purl: pkg.purl,
      risk: 'Safe',
      directDependency: relationships.length ? isRoot || directIds.has(pkg.spdxId) : true,
      supplier: pkg.supplier.replace(/^(Organization|Person):\s*/i, '') || 'Uploaded SBOM',
    });
  });

  return { format: 'SPDX', rows: dedupeRows(rows) };
}

function isCycloneDx(doc: AnyRecord): boolean {
  return asText(doc.bomFormat).toLowerCase() === 'cyclonedx' || (Array.isArray(doc.components) && !asText(doc.spdxVersion));
}

function isSpdx(doc: AnyRecord): boolean {
  return Boolean(asText(doc.spdxVersion)) || asText(doc.SPDXID).startsWith('SPDXRef-');
}

export function parseUploadedSbom(text: string, fileName: string): ParsedSbomUpload {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('The selected file is empty.');
  }

  if (trimmed.startsWith('<')) {
    return parseCycloneXml(trimmed, fileName);
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let doc: unknown;
    try {
      doc = JSON.parse(trimmed);
    } catch {
      throw new Error('This JSON file could not be read. Use a CycloneDX or SPDX document.');
    }
    if (!isRecord(doc)) {
      throw new Error('This file is not a CycloneDX or SPDX document.');
    }
    if (isSpdx(doc)) return parseSpdx(doc, fileName);
    if (isCycloneDx(doc)) return parseCycloneDx(doc, fileName);
    throw new Error('This file is not a CycloneDX or SPDX document.');
  }

  if (/^SPDXVersion\s*:/im.test(trimmed)) {
    return parseSpdxTagValue(trimmed, fileName);
  }

  throw new Error('Supported file formats are CycloneDX and SPDX.');
}
