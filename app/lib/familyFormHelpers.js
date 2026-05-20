export const FAMILY_AVAILABILITY_OPTIONS = [
  'Available',
  'Not Available',
  'Entry Denied',
  'Data not Given',
  'Door Closed',
];

export const FAMILY_POINT_OPTIONS = Array.from({ length: 100 }, (_, index) => String(index + 1));

export const parseFamilyNumber = (value) => {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const getNextFamilyNumber = (families = []) => {
  let max = 0;
  (families || []).forEach((family) => {
    const n = parseFamilyNumber(family?.familyNumber);
    if (n != null && n > max) max = n;
  });
  return max + 1;
};

export const hasHouseMarkingFields = (buildingNumber, buildingName, flatNumber) =>
  [buildingNumber, buildingName, flatNumber].every((part) => String(part || '').trim());

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

export const getVoterPhoneDisplay = (voter = {}) => {
  const raw = voter.mobile ?? voter.mobileNumber ?? voter.phone ?? '';
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s;
};

export const getVoterHouseDisplay = (voter = {}) => {
  const raw = voter.houseNoEn ?? voter.houseNoLocal ?? voter.house ?? '';
  const s = String(raw).trim();
  if (!s || s === '0' || s === 'null') return '';
  return s;
};

export const buildFamilyMapTooltipHtml = (point = {}) => {
  const members = Array.isArray(point.members) ? point.members : [];
  const memberLines = members.length
    ? members.map((m, index) => {
      const name = m.voterName || m.name || '-';
      const relation = m.relationName || m.relation || '-';
      const epic = m.epicNo || m.epic || '-';
      return `<div style="margin: 4px 0;">${index + 1}. ${name} | ${relation} | ${epic}</div>`;
    }).join('')
    : '<div style="margin: 4px 0;">No members listed</div>';

  return `
    <div style="padding: 12px; color: #1e293b; font-family: sans-serif; min-width: 280px; max-width: 360px;">
      <div style="font-size: 13px; line-height: 1.5;">
        <div><strong>Road name:</strong> ${point.roadName || '-'}</div>
        <div><strong>Family number:</strong> ${point.familyNumber || '-'}</div>
        <div><strong>Family Name:</strong> ${point.familyName || '-'}</div>
        <div><strong>Flat No:</strong> ${point.flatNumber || '-'}</div>
        <div style="margin-top: 8px; font-weight: 700;">Family members details:</div>
        ${memberLines}
      </div>
    </div>
  `;
};

export const sortFamiliesByNumber = (families = []) =>
  [...families].sort((a, b) => {
    const aNum = parseFamilyNumber(a?.familyNumber);
    const bNum = parseFamilyNumber(b?.familyNumber);
    if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
    if (aNum != null && bNum == null) return -1;
    if (aNum == null && bNum != null) return 1;
    return String(a?.familyName || '').localeCompare(String(b?.familyName || ''), 'en', { sensitivity: 'base' });
  });

/** @deprecated Use sortFamiliesByNumber */
export const sortFamiliesByName = sortFamiliesByNumber;
