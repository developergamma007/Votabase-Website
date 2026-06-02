export const FAMILY_AVAILABILITY_OPTIONS = [
  'Available',
  'Not Available',
  'Entry Denied',
  'Data not Given',
  'Door Closed',
];

/** Emoji suffixes for availability status chips and legends */
export const FAMILY_AVAILABILITY_EMOJI = {
  Available: '🔵',
  'Not Available': '🟠',
  'Entry Denied': '🟡',
  'Data not Given': '🟣',
  'Door Closed': '🔴',
};

export const formatFamilyAvailabilityLabel = (label) => {
  const key = String(label || '').trim();
  const emoji = FAMILY_AVAILABILITY_EMOJI[key];
  return emoji ? `${key} ${emoji}` : key;
};

/** Mask sensitive text: show only last 4 characters (letters or digits). */
export const maskFamilySensitiveValue = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return raw;
  return `${'*'.repeat(raw.length - 4)}${raw.slice(-4)}`;
};

export const maskEpicLastFour = maskFamilySensitiveValue;

/** Mask names: show only first 4 letters (booth / Available families). */
export const maskFamilyNameLeading = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, 4)}${'*'.repeat(raw.length - 4)}`;
};

export const normalizeFamilyRole = (role) => String(role || '').replace(/^ROLE_/, '').toUpperCase();

/** Ward / Assembly / Admin see full family data; booth volunteers get masking on Available families. */
export const canViewFullFamilySensitiveData = (role) => {
  const r = normalizeFamilyRole(role);
  return ['SUPER_ADMIN', 'ADMIN', 'ASSEMBLY', 'WARD'].includes(r);
};

export const isBoothFamilyRole = (role) => {
  const r = normalizeFamilyRole(role);
  return r === 'BOOTH' || r === 'USER';
};

export const shouldMaskAvailableFamilyForRole = (role, availability) => {
  if (canViewFullFamilySensitiveData(role)) return false;
  if (!isBoothFamilyRole(role)) return false;
  return String(availability || '').trim() === 'Available';
};

export const displayPendingFamilyListName = (family, role) => {
  const name = family?.familyName || 'Unnamed family';
  if (!shouldMaskAvailableFamilyForRole(role, family?.familyAvailability)) return name;
  return maskFamilyNameLeading(name);
};

export const maskMemberNameForDisplay = (role, availability, name) => {
  if (!shouldMaskAvailableFamilyForRole(role, availability)) return name || '-';
  return maskFamilyNameLeading(name || '');
};

export const maskMemberEpicForDisplay = (role, availability, epic) => {
  if (!shouldMaskAvailableFamilyForRole(role, availability)) return epic || '-';
  return maskEpicLastFour(epic || '');
};

export const maskMemberPhoneForDisplay = (role, availability, phone) => {
  if (!shouldMaskAvailableFamilyForRole(role, availability)) return phone || '-';
  return maskEpicLastFour(phone || '');
};

/** Map marker colours by family availability status */
export const FAMILY_AVAILABILITY_MAP_COLORS = {
  Available: '#2563eb',
  'Not Available': '#f97316',
  'Entry Denied': '#eab308',
  'Data not Given': '#9333ea',
  'Door Closed': '#ef4444',
};

export const FAMILY_MAP_AVAILABILITY_LEGEND = FAMILY_AVAILABILITY_OPTIONS.map((label) => ({
  label,
  color: FAMILY_AVAILABILITY_MAP_COLORS[label] || '#64748b',
}));

export const getFamilyAvailabilityMapColor = (availability) =>
  FAMILY_AVAILABILITY_MAP_COLORS[String(availability || '').trim()] || '#64748b';

/** Relation person name for a family member (map tooltip / tables). */
export const getFamilyMemberRelationName = (member = {}) => {
  const fromParts = [member.relationFirstMiddleNameEn, member.relationLastNameEn]
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .trim();
  const fromLocal = [member.relationFirstMiddleNameLocal, member.relationLastNameLocal]
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .trim();
  const name = String(
    member.relationName
    || member.relation_name
    || member.relName
    || member.rel_name
    || fromParts
    || fromLocal
    || member.relationNameEn
    || member.relation_name_en
    || member.rel_eng
    || member.relEng
    || member.fatherName
    || member.husbandName
    || member.motherName
    || ''
  ).trim();
  return name || '-';
};

export const getFamilyMapStatusLabel = (availability) =>
  String(availability || 'Available').trim() || 'Available';

export const normalizeFamilyMapMember = (member = {}) => ({
  ...member,
  voterName: member.voterName || member.name || '',
  epicNo: member.epicNo || member.epic || '',
  relationName: getFamilyMemberRelationName(member),
  relationType: String(member.relationType || member.relation_type || '').trim() || '-',
});

export const formatFamilyMapMemberLine = (member = {}, index = 0) => {
  const normalized = normalizeFamilyMapMember(member);
  const name = normalized.voterName || '-';
  const epic = normalized.epicNo || '-';
  const relationName = normalized.relationName || '-';
  const relationType = normalized.relationType || '-';
  return `${index + 1}. ${name} | ${epic} | ${relationName} | ${relationType}`;
};

export const normalizeFamilyMapPoint = (item = {}) => ({
  familyId: item.familyId,
  latitude: Number(item.latitude),
  longitude: Number(item.longitude),
  familyName: item.familyName || '',
  familyAvailability: item.familyAvailability || 'Available',
  roadName: item.roadName || '',
  buildingNumber: item.buildingNumber || '',
  buildingName: item.buildingName || '',
  familyNumber: item.familyNumber || '',
  flatNumber: item.flatNumber || '',
  boothNo: item.boothNo || '',
  wardId: item.wardId,
  wardCode: item.wardCode,
  members: (Array.isArray(item.members) ? item.members : []).map(normalizeFamilyMapMember),
});

const escapeFamilyMapHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isFamilyMapPointAvailable = (point = {}) =>
  String(point.familyAvailability || '').trim() === 'Available';

/** Display value in map popup; mask Available families for booth (name: first 4 letters, else last 4). */
export const familyMapDisplayValue = (point = {}, value, field = 'generic') => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const mask = point.__maskAvailable !== false && isFamilyMapPointAvailable(point);
  if (!mask) return escapeFamilyMapHtml(raw);
  if (field === 'name' || field === 'familyName') {
    return escapeFamilyMapHtml(maskFamilyNameLeading(raw));
  }
  if (field === 'epic') {
    return escapeFamilyMapHtml(maskEpicLastFour(raw));
  }
  return escapeFamilyMapHtml(maskEpicLastFour(raw));
};

export const formatFamilyMapMemberLineForPoint = (point = {}, member = {}, index = 0) => {
  if (!isFamilyMapPointAvailable(point) || point.__maskAvailable === false) {
    return escapeFamilyMapHtml(formatFamilyMapMemberLine(member, index));
  }
  const normalized = normalizeFamilyMapMember(member);
  const parts = [
    escapeFamilyMapHtml(maskFamilyNameLeading(String(normalized.voterName || '').trim()) || '-'),
    escapeFamilyMapHtml(maskEpicLastFour(String(normalized.epicNo || '').trim()) || '-'),
    escapeFamilyMapHtml(maskEpicLastFour(String(normalized.relationName || '').trim()) || '-'),
    escapeFamilyMapHtml(maskEpicLastFour(String(normalized.relationType || '').trim()) || '-'),
  ];
  return `${index + 1}. ${parts.join(' | ')}`;
};

const buildFamilyMapEditButtonHtml = (point = {}, showEditButton = false) => {
  if (!showEditButton || !point.familyId) return '';
  return `
    <div style="margin-top: 12px;">
      <button
        type="button"
        data-family-edit-id="${Number(point.familyId)}"
        style="width: 100%; padding: 8px 12px; background: #0f766e; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;"
      >Edit family</button>
    </div>
  `;
};

const buildFamilyMapAddressBlockHtml = (point = {}) => `
  <div style="font-size: 13px; line-height: 1.55;">
    <div><strong>Road name:</strong> ${familyMapDisplayValue(point, point.roadName)}</div>
    <div><strong>Building/Apartment Number:</strong> ${familyMapDisplayValue(point, point.buildingNumber)}</div>
    <div><strong>Building/Apartment Name:</strong> ${familyMapDisplayValue(point, point.buildingName)}</div>
    <div><strong>Family number:</strong> ${familyMapDisplayValue(point, point.familyNumber)}</div>
    <div><strong>Family Name:</strong> ${familyMapDisplayValue(point, point.familyName, 'name')}</div>
    <div><strong>Flat No:</strong> ${familyMapDisplayValue(point, point.flatNumber)}</div>
  </div>
`;

export const buildFamilyMapTooltipLimitedHtml = (point = {}, options = {}) => {
  const status = escapeFamilyMapHtml(getFamilyMapStatusLabel(point.familyAvailability));
  return `
    <div style="padding: 12px; color: #1e293b; font-family: sans-serif; min-width: 260px; max-width: 320px;">
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px; color: #0f172a;">${status}</div>
      ${buildFamilyMapAddressBlockHtml(point)}
      ${buildFamilyMapEditButtonHtml(point, options.showEditButton)}
    </div>
  `;
};

export const buildFamilyMapTooltipHtml = (point = {}, options = {}) => {
  const showMembers = options.showMemberDetails ?? (options.full !== false);
  if (!showMembers) return buildFamilyMapTooltipLimitedHtml(point, options);

  const members = Array.isArray(point.members) ? point.members : [];
  const memberLines = members.length
    ? members
      .map((m, index) => `<div style="margin: 4px 0;">${formatFamilyMapMemberLineForPoint(point, m, index)}</div>`)
      .join('')
    : '<div style="margin: 4px 0;">No members listed</div>';

  const status = escapeFamilyMapHtml(getFamilyMapStatusLabel(point.familyAvailability));

  return `
    <div style="padding: 12px; color: #1e293b; font-family: sans-serif; min-width: 300px; max-width: 400px;">
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px; color: #0f172a;">${status}</div>
      ${buildFamilyMapAddressBlockHtml(point)}
      <div style="margin-top: 8px; font-weight: 700;">Family members details:</div>
      ${memberLines}
      ${buildFamilyMapEditButtonHtml(point, options.showEditButton)}
    </div>
  `;
};

export const FAMILY_ANALYSIS_AVAILABILITY_KEYS = [
  { key: 'available', label: 'Available' },
  { key: 'notAvailable', label: 'Not Available' },
  { key: 'entryDenied', label: 'Entry Denied' },
  { key: 'dataNotGiven', label: 'Data not Given' },
  { key: 'doorClosed', label: 'Door Closed' },
];

export const formatFamilyDateTime = (value) => {
  if (!value) return '-';
  const raw = typeof value === 'string' ? value.trim() : value;
  const needsTz = typeof raw === 'string' && raw !== '' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = needsTz ? `${raw}Z` : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

export const FAMILY_POINT_OPTIONS = Array.from({ length: 100 }, (_, index) => String(index + 1));

export const parseFamilyNumber = (value) => {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Ward code from API row or label like "27 - Vibhootipura" (never the DB ward id). */
export const parseWardCodeFromWardRecord = (ward = {}) => {
  const name = String(
    ward?.wardNameEn ?? ward?.ward_name_en ?? ward?.ward_name ?? ward?.name_en ?? ward?.name ?? ward?.label ?? ''
  ).trim();
  const nameMatch = name.match(/^(\d+)\s*[-–]/);
  if (nameMatch) return nameMatch[1];
  const code = String(ward?.wardCode ?? ward?.ward_code ?? ward?.ward_no ?? ward?.code ?? '').trim();
  const id = String(ward?.wardId ?? ward?.ward_id ?? ward?.id ?? ward?.value ?? '').trim();
  if (code && (!id || code !== id)) return code.replace(/\s+/g, '');
  return '';
};

/** Assembly segment for family numbers, e.g. "000000000151" → "151". */
export const normalizeAssemblyCodeForFamily = (assemblyCode) => {
  const raw = String(assemblyCode ?? '').trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? String(n) : raw;
  }
  return raw.replace(/\s+/g, '');
};

/** Prefix for new family numbers: assembly-ward, e.g. "151-27" → next "151-27-2". */
export const getFamilyNumberPrefix = (ward = {}, assemblyCode = '') => {
  const wardPart = parseWardCodeFromWardRecord(ward);
  const asmPart = normalizeAssemblyCodeForFamily(assemblyCode);
  if (asmPart && wardPart) return `${asmPart}-${wardPart}`;
  return wardPart || asmPart || '';
};

/** @deprecated Use getFamilyNumberPrefix — ward-only prefix */
export const getWardFamilyNumberPrefix = (ward = {}) => parseWardCodeFromWardRecord(ward);

export const parseFamilyNumberSeq = (value, wardPrefix = '') => {
  const raw = String(value ?? '').trim();
  const prefix = String(wardPrefix ?? '').trim();
  if (!prefix) return parseFamilyNumber(raw);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`^${escaped}-(\\d+)$`, 'i'));
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const familyBelongsToWard = (family, wardId, wardCode) => {
  if (!wardId && !wardCode) return true;
  if (wardId != null && String(wardId).trim() !== '' && String(family?.wardId) === String(wardId)) return true;
  if (wardCode && String(family?.wardCode ?? '').trim() === String(wardCode).trim()) return true;
  const parts = String(family?.familyNumber ?? '').trim().split('-');
  if (parts.length >= 3 && wardCode) {
    const wardFromNumber = String(parts[1] ?? '').replace(/^0+/, '') || parts[1];
    const target = String(wardCode).trim().replace(/^0+/, '') || String(wardCode).trim();
    if (wardFromNumber === target) return true;
  }
  return false;
};

/** True when familyNumber is assembly-ward-seq for the given prefix (e.g. 151-12-3). */
export const familyNumberMatchesPrefix = (familyNumber, wardPrefix = '') => {
  const prefix = String(wardPrefix ?? '').trim();
  const raw = String(familyNumber ?? '').trim();
  if (!prefix || !raw) return false;
  return raw.toLowerCase().startsWith(`${prefix.toLowerCase()}-`);
};

/**
 * Next serial for assembly-ward prefix from DB rows (e.g. 151-12-1 exists → 151-12-2).
 * Only counts family numbers that match the exact prefix; ward 13 starts at 151-13-1.
 */
export const getNextFamilyNumber = (families = [], wardPrefix = '') => {
  const prefix = String(wardPrefix ?? '').trim();
  if (!prefix) {
    let max = 0;
    (families || []).forEach((family) => {
      const n = parseFamilyNumber(family?.familyNumber);
      if (n != null && n > max) max = n;
    });
    return String(max + 1);
  }
  let max = 0;
  const prefixKey = `${prefix}-`.toLowerCase();
  (families || []).forEach((family) => {
    const raw = String(family?.familyNumber ?? '').trim();
    if (!raw.toLowerCase().startsWith(prefixKey)) return;
    const n = parseFamilyNumberSeq(raw, prefix);
    if (n != null && n > max) max = n;
  });
  return `${prefix}-${max + 1}`;
};

/** Families to scan for numbering: ward-scoped rows and/or matching assembly-ward prefix. */
export const familiesForNextNumber = (families = [], wardId, wardCode, wardPrefix = '') => {
  const prefix = String(wardPrefix ?? '').trim();
  return (families || []).filter((family) => {
    if (prefix && familyNumberMatchesPrefix(family?.familyNumber, prefix)) return true;
    return familyBelongsToWard(family, wardId, wardCode);
  });
};

export const hasHouseMarkingFields = (buildingNumber, buildingName, flatNumber) =>
  [buildingNumber, buildingName, flatNumber].every((part) => String(part || '').trim());

/** Booth ids from ward booth dropdown (excludes "All Booths"). */
export const getWardBoothIdList = (boothItems = []) =>
  (boothItems || [])
    .map((item) => String(item?.value ?? '').trim())
    .filter((value) => value && value !== '');

/** Resolve booth for family create: explicit pick, else first booth in selected ward. */
export const resolveFamilyCreateBoothId = (boothItems = [], explicitBoothId = '') => {
  const booths = getWardBoothIdList(boothItems);
  const explicit = String(explicitBoothId ?? '').trim();
  if (explicit && booths.includes(explicit)) return explicit;
  return booths[0] || '';
};

export const isMemberBoothInWard = (memberBoothId, boothItems = []) => {
  const allowed = getWardBoothIdList(boothItems);
  if (!allowed.length) return true;
  const boothId = String(memberBoothId ?? '').trim();
  if (!boothId) return false;
  return allowed.includes(boothId);
};

/** Relation label for family member rows (API uses relationFirstMiddleNameEn, not relationNameEn). */
export const getVoterRelationDisplay = (voter = {}) => {
  const nameEn = [voter.relationFirstMiddleNameEn, voter.relationLastNameEn]
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .trim();
  const nameLocal = [voter.relationFirstMiddleNameLocal, voter.relationLastNameLocal]
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .trim();
  const name =
    nameEn ||
    nameLocal ||
    String(voter.relationNameEn || voter.relation_name_en || voter.rel_eng || voter.fatherName || voter.husbandName || voter.motherName || '').trim();
  const type = String(voter.relationType || voter.rel_type || '').trim();
  if (type && name) return `${type}: ${name}`;
  return name || type || '';
};

export const maskSensitiveLastFour = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  return raw.length > 4 ? `${'*'.repeat(raw.length - 4)}${raw.slice(-4)}` : raw;
};

export const getVoterPhoneRaw = (voter = {}) => {
  const raw = voter.mobile ?? voter.mobileNumber ?? voter.phone ?? '';
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
};

export const getVoterPhoneDisplay = (voter = {}) => maskSensitiveLastFour(getVoterPhoneRaw(voter));

export const getVoterHouseDisplay = (voter = {}) => {
  const raw = voter.houseNoEn ?? voter.houseNoLocal ?? voter.house ?? '';
  const s = String(raw).trim();
  if (!s || s === '0' || s === 'null') return '';
  return s;
};

const familyNumberSortKey = (family) => {
  const raw = String(family?.familyNumber ?? '').trim();
  const dash = raw.lastIndexOf('-');
  if (dash > 0) {
    const prefix = raw.slice(0, dash);
    const seq = parseInt(raw.slice(dash + 1), 10);
    return { prefix, seq: Number.isFinite(seq) ? seq : Number.MAX_SAFE_INTEGER, raw };
  }
  const n = parseFamilyNumber(raw);
  return { prefix: '', seq: n != null ? n : Number.MAX_SAFE_INTEGER, raw };
};

export const sortFamiliesByNumber = (families = []) =>
  [...families].sort((a, b) => {
    const ak = familyNumberSortKey(a);
    const bk = familyNumberSortKey(b);
    const prefixCmp = ak.prefix.localeCompare(bk.prefix, 'en', { sensitivity: 'base' });
    if (prefixCmp !== 0) return prefixCmp;
    if (ak.seq !== bk.seq) return ak.seq - bk.seq;
    return String(a?.familyName || '').localeCompare(String(b?.familyName || ''), 'en', { sensitivity: 'base' });
  });

/** @deprecated Use sortFamiliesByNumber */
export const sortFamiliesByName = sortFamiliesByNumber;

/** Turn API error payloads into a user-visible message (includes server validation details). */
export const formatApiError = (err, fallback = 'Request failed') => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const details = err?.data?.error?.details ?? err?.data?.error;
  if (typeof details === 'string' && details.trim()) {
    if (err?.message && err.message !== details) {
      return details;
    }
    return details;
  }
  if (typeof err?.detail === 'string' && err.detail.trim()) return err.detail;
  if (err?.message && String(err.message).trim()) return String(err.message);
  return fallback;
};
