'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowBackIosNewRounded,
  ExpandMoreRounded,
  LocationOnOutlined,
  PersonOutlineRounded,
  PhoneOutlined,
  Print as PrintIcon,
  SearchRounded,
  ArrowForwardIos,
  MessageOutlined,
  LogoutOutlined,
  VpnKeyOutlined,
  SmsOutlined,
  WhatsApp,
  CalendarMonthOutlined,
} from '@mui/icons-material';
import {
  ensureUserProfileReady,
  getAssemblyCode,
  getUserInfoFromStorage,
  mobileApi,
  parseVoterSearchResponse,
} from '../../lib/mobileApi';
import { subtabStorageKey, usePersistedSubtab } from '../../lib/persistedSubtab';
import {
  FAMILY_AVAILABILITY_OPTIONS,
  formatFamilyAvailabilityLabel,
  maskFamilySensitiveValue,
  maskFamilyNameLeading,
  canViewFullFamilySensitiveData,
  shouldMaskAvailableFamilyForRole,
  displayPendingFamilyListName,
  maskMemberNameForDisplay,
  maskMemberEpicForDisplay,
  maskMemberPhoneForDisplay,
  FAMILY_POINT_OPTIONS,
  FAMILY_ANALYSIS_AVAILABILITY_KEYS,
  FAMILY_MAP_AVAILABILITY_LEGEND,
  formatFamilyDateTime,
  formatFamilyMapMemberLine,
  getNextFamilyNumber,
  familiesForNextNumber,
  getFamilyNumberPrefix,
  parseWardCodeFromWardRecord,
  hasHouseMarkingFields,
  getFamilyAvailabilityMapColor,
  normalizeFamilyMapPoint,
  normalizeFamilyMapMember,
  sortFamiliesByNumber,
  getVoterRelationDisplay,
  getVoterPhoneDisplay,
  getVoterPhoneRaw,
  getVoterHouseDisplay,
  getFamilyMemberRelationName,
  resolveFamilyCreateBoothId,
  isMemberBoothInWard,
  formatApiError,
} from '../../lib/familyFormHelpers';
import { downloadCsvFile, downloadXlsFile } from '../../lib/spreadsheetExport';
import {
  buildClickableOsmMap,
  buildDraggableOsmMap,
  buildFamilyOsmMap,
  buildPointsOsmMap,
  destroyOsmMap,
  getGoogleEmbedUrl,
  getGoogleExternalUrl,
  getOsmEmbedUrl,
  getOsmExternalUrl,
} from '../../lib/osmMap';

const BOOTH_CACHE_KEY = 'boothSnapshotLite';
const BOOTH_CACHE_SCOPE_KEY = 'boothSnapshotScopeKey';

function collectScopeIds(userInfo, keys, assignmentType) {
  const ids = [];
  keys.forEach((key) => {
    if (Array.isArray(userInfo?.[key])) ids.push(...userInfo[key]);
  });
  if ((userInfo?.assignmentType || '').toUpperCase() === assignmentType && userInfo?.assignmentId != null) {
    String(userInfo.assignmentId)
      .split(',')
      .map((val) => val.trim())
      .filter(Boolean)
      .forEach((val) => ids.push(val));
  }
  return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
}

function boothMatchesUserScope(booth, accessBoothIds, accessWardIds) {
  if (accessBoothIds.length) {
    const keys = [
      String(booth.boothId ?? ''),
      String(booth.boothNo ?? ''),
      String(booth.id ?? ''),
      String(booth.booth_id ?? ''),
    ].filter(Boolean);
    return accessBoothIds.some((id) => keys.includes(String(id)));
  }
  if (accessWardIds.length) {
    const wardKeys = [
      String(booth.wardId ?? ''),
      String(booth.wardCode ?? booth.ward_code ?? ''),
    ].filter(Boolean);
    return accessWardIds.some((id) => wardKeys.includes(String(id)));
  }
  return true;
}
const PAGE_SIZE = 50;

const MASTER_ROLL_PHASE_LABELS = {
  starting: 'Starting import…',
  assembly: 'Loading assembly…',
  wards: 'Loading wards…',
  booths: 'Loading booths…',
  voters: 'Loading voters…',
  done: 'Import complete',
  error: 'Import failed',
};

const MASTER_ROLL_TABLE_ROWS = [
  { key: 'assembly', label: 'assembly' },
  { key: 'wards', label: 'wards' },
  { key: 'booths', label: 'booths' },
  { key: 'voters', label: 'voters' },
];

function parseMasterRollUploadError(err) {
  if (!err) return 'Master roll upload failed.';
  if (typeof err === 'string') return err;
  const nested = err?.raw?.data?.error ?? err?.data?.error ?? err?.error ?? err?.detail;
  if (typeof nested === 'string') return nested;
  if (err?.message) return String(err.message);
  return 'Master roll upload failed.';
}

function formatMasterRollUploadSuccess(res) {
  const payload = res?.data?.result ?? res?.data ?? res ?? {};
  const inserted = payload?.inserted || {};
  const assemblyNo = payload?.assembly_no ?? '';
  const baseMessage = res?.message || 'Master roll imported successfully';
  return `${baseMessage} Assembly ${assemblyNo}: ${inserted.assembly ?? 1} assembly, ${inserted.wards ?? 0} wards, ${inserted.booths ?? 0} booths, ${inserted.voters ?? 0} voters.`;
}

function applyMasterRollStatus(setter, status) {
  if (!status) return;
  setter({
    phase: status.phase || 'idle',
    progress: status.progress ?? 0,
    assemblyNo: status.assembly_no ?? null,
    assemblyName: status.assembly_name_en ?? '',
    inserted: {
      assembly: status.inserted?.assembly ?? 0,
      wards: status.inserted?.wards ?? 0,
      booths: status.inserted?.booths ?? 0,
      voters: status.inserted?.voters ?? 0,
    },
    error: status.error || null,
    active: Boolean(status.active),
  });
}
const FAMILY_ANALYSIS_LAZY_STEP = 20;
const FAMILY_DETAIL_PAGE_SIZE = 30;
const PENDING_FAMILY_LIST_LAZY_STEP = 25;

function FamilyAvailabilityMapLegend({ compact = false }) {
  return (
    <div className={`mobile-web-map-legend mobile-web-family-map-legend ${compact ? 'compact' : ''}`}>
      {FAMILY_MAP_AVAILABILITY_LEGEND.map((item) => (
        <span key={item.label}>
          <i className="legend-dot" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function hasValidFamilyMapLocation(family = {}) {
  const lat = Number(family?.latitude);
  const lng = Number(family?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function FamilyAvailabilityFilterChips({ selected, onChange }) {
  const toggle = (label) => {
    if (selected.includes(label)) {
      const next = selected.filter((item) => item !== label);
      onChange(next.length ? next : [...FAMILY_AVAILABILITY_OPTIONS]);
    } else {
      onChange([...selected, label]);
    }
  };
  return (
    <div className="mobile-web-availability-filter" role="group" aria-label="Filter by family availability">
      <span className="mobile-web-muted" style={{ fontSize: '0.8rem', marginRight: '6px' }}>Status filter:</span>
      {FAMILY_AVAILABILITY_OPTIONS.map((label) => {
        const active = selected.includes(label);
        const color = getFamilyAvailabilityMapColor(label);
        return (
          <button
            key={label}
            type="button"
            className={`mobile-web-availability-chip ${active ? 'active' : ''}`}
            onClick={() => toggle(label)}
            style={{ borderColor: color, background: active ? `${color}22` : 'transparent' }}
          >
            <i className="legend-dot" style={{ background: color }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FamilyMapSection({
  wardId,
  wardCode,
  boothId,
  assemblyCode,
  mapHeight = '420px',
  title = 'Family map',
  showRefresh = true,
  availabilityFilter = null,
  onFamilyEdit = null,
  updatedFrom = '',
  updatedTo = '',
  emptyHint = '',
  infoMessage = '',
  showMemberDetails = false,
  allowMapEdit = true,
  onMapEditBlocked = null,
  refreshToken = 0,
  maskAvailableSensitive = true,
}) {
  const mapRef = useRef(null);
  const osmMapRef = useRef(null);
  const onFamilyEditRef = useRef(onFamilyEdit);
  const onMapEditBlockedRef = useRef(onMapEditBlocked);
  const showMemberDetailsRef = useRef(showMemberDetails);
  const showEditButtonRef = useRef(Boolean(onFamilyEdit));
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [pointCount, setPointCount] = useState(0);
  const availabilityFilterKey = useMemo(
    () => (Array.isArray(availabilityFilter)
      ? availabilityFilter.map((v) => String(v).trim()).sort().join('|')
      : ''),
    [availabilityFilter],
  );

  useEffect(() => {
    onFamilyEditRef.current = onFamilyEdit;
    showEditButtonRef.current = Boolean(onFamilyEdit);
  }, [onFamilyEdit]);

  useEffect(() => {
    onMapEditBlockedRef.current = onMapEditBlocked;
  }, [onMapEditBlocked]);

  useEffect(() => {
    showMemberDetailsRef.current = showMemberDetails;
  }, [showMemberDetails]);

  const cleanupMapInstances = () => {
    if (osmMapRef.current) {
      destroyOsmMap(osmMapRef.current);
      osmMapRef.current = null;
    }
  };

  const buildMap = async (points) => {
    if (!mapRef.current) return;
    cleanupMapInstances();
    osmMapRef.current = await buildFamilyOsmMap(mapRef.current, points, {
      showMemberDetails: showMemberDetailsRef.current,
      showEditButton: showEditButtonRef.current,
    });
  };

  const loadMapPoints = useCallback(async () => {
    setMapLoading(true);
    setMapError('');
    try {
      const res = await mobileApi.fetchFamilyLocationPoints(
        wardId || undefined,
        boothId || undefined,
        wardCode,
        assemblyCode || undefined,
        updatedFrom || undefined,
        updatedTo || undefined,
      );
      const payload = res?.data?.result || res?.result || [];
      let points = (Array.isArray(payload) ? payload : [])
        .map(normalizeFamilyMapPoint)
        .map((p) => ({ ...p, __maskAvailable: maskAvailableSensitive }))
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
      if (Array.isArray(availabilityFilter) && availabilityFilter.length) {
        const allowed = new Set(availabilityFilter.map((v) => String(v).trim()));
        points = points.filter((p) => allowed.has(String(p.familyAvailability || '').trim()));
      }
      setPointCount(points.length);
      if (points.length === 0) {
        cleanupMapInstances();
        if (mapRef.current) mapRef.current.innerHTML = '';
        return;
      }
      await buildMap(points);
    } catch (err) {
      cleanupMapInstances();
      setMapError(err?.message || 'Unable to load family map.');
      setPointCount(0);
    } finally {
      setMapLoading(false);
    }
  }, [
    wardId,
    wardCode,
    boothId,
    assemblyCode,
    updatedFrom,
    updatedTo,
    availabilityFilterKey,
    refreshToken,
    maskAvailableSensitive,
  ]);

  useEffect(() => {
    loadMapPoints();
    return () => {
      cleanupMapInstances();
    };
  }, [loadMapPoints]);

  useEffect(() => {
    const container = mapRef.current;
    if (!container || !onFamilyEdit) return undefined;
    const onMapClick = (event) => {
      const button = event.target?.closest?.('[data-family-edit-id]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const familyId = Number(button.getAttribute('data-family-edit-id'));
      if (!familyId) return;
      if (allowMapEdit) {
        onFamilyEditRef.current?.({ familyId });
      } else {
        onMapEditBlockedRef.current?.();
      }
    };
    container.addEventListener('click', onMapClick);
    return () => container.removeEventListener('click', onMapClick);
  }, [pointCount, onFamilyEdit, allowMapEdit]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof window === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      osmMapRef.current?.invalidateSize?.();
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pointCount]);

  return (
    <div className="mobile-web-family-map-block">
      <div className="mobile-web-family-map-block-head">
        <span className="mobile-web-section-title">{title}</span>
        {showRefresh ? (
          <button type="button" className="mobile-web-secondary-btn" onClick={loadMapPoints} disabled={mapLoading}>
            {mapLoading ? 'Loading...' : 'Refresh map'}
          </button>
        ) : null}
      </div>
      {infoMessage ? <p className="mobile-web-info-pill">{infoMessage}</p> : null}
      <FamilyAvailabilityMapLegend compact={mapHeight !== '420px'} />
      {mapError ? <div className="mobile-web-error">{mapError}</div> : null}
      {mapLoading && pointCount === 0 ? <div className="mobile-web-empty">Loading map...</div> : null}
      {!mapLoading && pointCount === 0 && !mapError ? (
        <div className="mobile-web-empty">
          {emptyHint
            || (wardId || wardCode ? 'No families with GPS on the map for this ward.' : 'No families with GPS on the map for the current filters.')}
        </div>
      ) : null}
      <div className="mobile-web-map-container" ref={mapRef} style={{ height: mapHeight, minHeight: mapHeight }} />
      {!mapLoading && pointCount > 0 ? (
        <div className="mobile-web-muted" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
          {pointCount} families on map
        </div>
      ) : null}
    </div>
  );
}

const labels = {
  'search-voter': {
    title: 'Search Voter',
    description: 'Search with voter name, phone, EPIC, booth, and household filters.',
  },
  'search-booth': {
    title: 'Search Booth',
    description: 'Browse booth-level voters and booth stats in a web-first layout.',
  },
  'voters-family': {
    title: "Voter's Family",
    description: 'Household-based view for outreach planning and relationship tracking.',
  },
  meetings: {
    title: 'Meetings',
    description: 'Create meetings, assign volunteers, and follow up on notes.',
  },
  'poll-day': {
    title: 'Poll Day',
    description: 'Track turnout, booth readiness, and field issues on election day.',
  },
  print: {
    title: 'Print',
    description: 'Generate printable slips and export lists for field use.',
  },
  'add-volunteer': {
    title: 'Add Volunteer',
    description: 'Create a volunteer profile and assign a working level.',
  },
  'my-volunteers': {
    title: 'Manage Volunteers',
    description: 'Search, manage, and block volunteers in a web-first layout.',
  },
  'volunteer-analysis': {
    title: 'Volunteer Analysis',
    description: 'Track volunteer data collection coverage.',
  },
  extract: {
    title: 'Extract',
    description: 'Upload voter list PDFs and export structured Excel sheets.',
  },
  promotions: {
    title: 'Promotions',
    description: 'Configure WhatsApp and SMS message templates for voter outreach.',
  },
};

const dropdownOptions = {
  community: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Others'],
  caste: ['Lingayat', 'Vokkaliga', 'Brahmin', 'Yadava / Golla', 'Kuruba', 'Idiga / Billava', 'Vishwakarma', 'Devanga', 'Nayaka / Naik', 'Kumbara', 'Madivala / Dhobi', 'Uppara', 'Besta', 'Bhovi', 'Holeya', 'Madiga', 'Adi Karnataka', 'Lambani / Banjara', 'Soliga', 'Jenukuruba', 'Kadu Kuruba', 'Iruliga', 'Muslim', 'Christian', 'Jain', 'Bunt', 'Kodava', 'Maratha', 'Mogaveera', 'Tuluva', 'Others'],
  motherTongue: ['Kannada', 'Telugu', 'Tamil', 'Hindi', 'Urdu', 'Tulu', 'Malayalam', 'Konkani', 'Marathi', 'Lambani', 'Kodava', 'Sanskrit', 'Gujarati', 'Sindhi', 'Punjabi', 'Bengali', 'Odia', 'Others'],
  education: ['Illiterate', 'Primary School (1–5)', 'Middle School (6–8)', 'SSLC (10th Pass)', 'PUC (12th Pass)', 'Diploma', 'ITI', 'Undergraduate Degree', 'Postgraduate Degree', 'Professional Degree (BE, MBBS, CA, etc.)', 'PhD / Research', 'Others'],
  residenceType: ['Layout', 'Apartment', 'Villa', 'Independent House', 'Slum Area', 'Gated Community', 'Chawl / Line House', 'Row House', 'Quarters (Govt / Company)', 'Farm House', 'Others'],
  ownership: ['Own House', 'Rented House', 'Leased House', 'Relative’s House', 'Hostel / PG', 'Quarters (Government / Company)', 'Slum / Informal Housing', 'Homeless', 'Others'],
  status: ['None', 'Available', 'Shifted in the ward', 'Shifted outside the ward', 'Recommend shift to the new ward', 'Not available'],
  civicIssue: ['Road Damage / Potholes', 'Traffic Congestion', 'Water Supply Issues', 'Drinking Water Quality', 'Sewage / Drainage Problems', 'Stormwater Drain Overflow', 'Garbage Collection Issues', 'Waste Management / Dumping', 'Streetlight Not Working', 'Public Safety Issues', 'Law and Order Problems', 'Electricity Supply Issues', 'Lack of Public Transport', 'Bus Stop / Metro Issues', 'Park and Playground Issues', 'Health Facility Issues', 'Hospital / Primary Health Centre Issues', 'School / Education Issues', 'Encroachment Problems', 'Flooding During Rain', 'Pollution (Air / Water / Noise)', 'Mosquito Menace', 'Stray Dogs Issue', 'Property Tax / Documentation Issues', 'Lack of Government Services Access', 'Housing Problems / Slum Issues', 'Employment Issues', 'Price Rise / Inflation Issues', 'Corruption in Local Offices', 'Drain Cleaning Required', 'Footpath Encroachment / Bad Footpaths', 'Lake Pollution / Lake Encroachment', 'Ration Card Issues', 'Aadhaar / ID Documentation Issues', "Women's Safety Issues", 'Senior Citizens Issues', 'Welfare Scheme Issues (Pension / Subsidy Delay)', 'Public Toilet Issues', 'Tree Fall / Tree Cutting Issues', 'Street Vendors Management Issue', 'Parking Problems', 'Borewell Issues', 'Road Widening / Infrastructure Issues', 'Others'],
  natureOfVoter: ['A', 'B', 'C', 'NA', 'Others'],
  voterPoints: ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', 'Others'],
  govtSchemeTracking: ['Gruha Lakshmi (Household Cash Transfer)', 'Griha Jyothi (Electricity Subsidy)', 'Annabhagya (Food / Ration Support)', 'Shakti (Free / Concessional Bus Travel for Women)', 'Yuva Nidhi (Unemployed Youth Stipend & Skilling)', 'CM Kaushalya / Kaushalya Karnataka Yojane (Skill Training)', 'Nanna Guruthu (SC/ST Document Digitization)', 'ELEVATE (Startup Grant / Seed Funding)', 'Arogya Karnataka (State Health Scheme)', 'Grama Vikasa / Gramabhivruddi Programmes (Rural Development)', 'Soura Belaku (Rooftop Solar Subsidy)', 'Thayi Bhagya (Mother & Child / Girl Child Welfare)', 'Yuvanidhi / Youth Employment Schemes', 'Local District-Level Schemes', 'Pradhan Mantri Awas Yojana (PMAY – Urban / Gramin)', 'Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)', 'Ayushman Bharat / PM-JAY (Health Insurance)', 'Jal Jeevan Mission (Piped Drinking Water)', 'Swachh Bharat Mission (Sanitation)', 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)', 'Pradhan Mantri Fasal Bima Yojana (Crop Insurance)', 'Ujjwala Yojana (LPG Connections)', 'PM Surya / Rooftop Solar Subsidy', 'PM SVANidhi (Street Vendor Micro-Credit)', 'PM Kaushal Vikas Yojana (PMKVY / Skill India)', 'National Social Assistance Programme (Pensions)', 'Beti Bachao Beti Padhao', 'Atal Pension Yojana', 'National Scholarship / Scholarship Schemes', 'Others'],
  engagementPotential: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Others'],
};
const JSON_MULTI_FIELDS = new Set(['govtSchemeTracking']);

const fieldGroups = {
  PRIMARY: ['mobile', 'dob', 'caste', 'community', 'civicIssue', 'natureOfVoter'],
  ADDITIONAL: ['education', 'motherTongue', 'residenceType', 'ownership', 'voterPoints', 'govtSchemeTracking', 'engagementPotential', 'ifShifted'],
};
const fieldLabels = { mobile: 'Mobile Number (10 Digits)', dob: 'Date of Birth', caste: 'Caste', community: 'Community', civicIssue: 'Civic Issues', natureOfVoter: 'Nature (A/B/C/NA)', education: 'Education', motherTongue: 'Mother Tongue', residenceType: 'Residence Type', ownership: 'Ownership', voterPoints: 'Voter Points', govtSchemeTracking: 'Govt Scheme Tracking', engagementPotential: 'Engagement Potential', ifShifted: 'If shifted - Transport & Booth Details' };

function getDefaultVoterForm(voter = {}) { const parseList = (value) => { if (!value) return []; if (Array.isArray(value)) return value; return String(value).split(',').map((item) => item.trim()).filter(Boolean); }; return { mobile: voter.mobile || '', dob: voter.dob || '', community: voter.community || '', caste: voter.caste || '', motherTongue: voter.motherTongue || '', education: voter.education || '', residenceType: voter.residenceType || '', ownership: voter.ownership || '', voterPoints: voter.voterPoints || '', govtSchemeTracking: Array.isArray(voter.govtSchemeTracking) ? voter.govtSchemeTracking : voter.govtSchemeTracking ? [voter.govtSchemeTracking] : [], engagementPotential: voter.engagementPotential || '', ifShifted: voter.ifShifted || '', status: voter.status || '', civicIssue: voter.civicIssue || '', natureOfVoter: voter.natureOfVoter || '', notes: voter.notes || '', presentAddress: voter.presentAddress || '', newWard: parseList(voter.newWard), newBoothNo: parseList(voter.newBoothNo), newSerialNo: voter.newSerialNo || '', notAvailableReason: voter.notAvailableReason || '' }; }
async function resolveSnapshot(payload) { const result = payload?.data?.result; if (!result) throw new Error('No snapshot found'); if (typeof result === 'string') { const raw = await fetch(result); if (!raw.ok) throw new Error(`Snapshot link fetch failed: ${raw.status}`); return raw.json(); } return result; }
function ScreenFrame({ children, accent = 'blue' }) { return <div className={`mobile-web-screen mobile-web-screen-${accent}`}>{children}</div>; }
function useInfiniteTrigger(enabled, onLoadMore) { const sentinelRef = useRef(null); useEffect(() => { if (!enabled || !sentinelRef.current) return undefined; const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) onLoadMore(); }, { rootMargin: '240px 0px' }); observer.observe(sentinelRef.current); return () => observer.disconnect(); }, [enabled, onLoadMore]); return sentinelRef; }
function boothStats(booth) { const stats = booth?.voterStats || {}; const voters = booth?.voters || []; return { total: Number.isFinite(stats.total) ? stats.total : voters.length, male: Number.isFinite(stats.male) ? stats.male : voters.filter((v) => (v.gender || '').toUpperCase().startsWith('M')).length, female: Number.isFinite(stats.female) ? stats.female : voters.filter((v) => (v.gender || '').toUpperCase().startsWith('F')).length }; }
function formatBoothTitle(no, label) {
  const sNo = String(no || '').trim();
  const sLabel = String(label || '').trim();
  if (!sNo) return sLabel;
  if (!sLabel || sLabel === '-') return sNo;
  const prefixPatterns = [`${sNo} -`, `${sNo}-`, `${sNo} `];
  if (prefixPatterns.some(p => sLabel.startsWith(p))) return sLabel;
  return `${sNo} - ${sLabel}`;
}
function normalizeVoter(voter, fallbackBooth) { const boothInfo = voter?.boothInfo || {}; const gender = voter?.gender || voter?.sex || '-'; const genderUpper = String(gender).toUpperCase(); return { ...voter, voterId: voter?.voterId ?? voter?.id ?? voter?.epicNo, serialNo: voter?.sl ?? voter?.srNo ?? voter?.serialNo ?? voter?.slNo ?? '-', epicNo: voter?.epicNo ?? voter?.epic ?? '-', name: voter?.firstMiddleNameEn || voter?.name || voter?.voterName || '-', relationLabel: voter?.relationType || voter?.rel_type || 'Father', relationName: voter?.relationFirstMiddleNameEn || voter?.relationNameEn || voter?.fatherName || voter?.motherName || voter?.relation_name_en || '', houseNo: voter?.houseNoEn ?? voter?.house ?? voter?.house_no_en ?? '-', age: voter?.age ?? '-', gender, genderClass: genderUpper.startsWith('M') ? 'male' : genderUpper.startsWith('F') ? 'female' : 'other', boothLabel: fallbackBooth?.boothLabel || boothInfo?.boothNameEn || voter?.boothNameEn || '', boothId: fallbackBooth?.boothId || boothInfo?.boothId || voter?.boothId || '', boothNo: voter?.boothNo || boothInfo?.boothNo || '', wardCode: (voter?.wardCode ?? fallbackBooth?.wardCode) || boothInfo?.wardCode || '', volunteerMet: voterWasMetByVolunteer(voter) }; }

function triggerVoterSlipPrint(voter, booth, template) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Print Voter Slip - ${voter.epicNo}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; padding: 10px; font-family: sans-serif; width: 80mm; }
          .slip { width: 100%; border: 1px dashed #ccc; padding: 10px; box-sizing: border-box; }
          .header { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 5px; }
          .title { text-align: center; font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; }
          .label { font-weight: bold; }
          .info-block { margin-top: 10px; font-size: 12px; }
          .cut { text-align: center; margin-top: 15px; font-size: 10px; color: #666; border-top: 1px dashed #999; padding-top: 5px; }
          .candidate { text-align: center; margin-top: 10px; font-weight: bold; border: 1px solid #000; padding: 5px; }
          .valuable-vote { text-align: center; font-size: 11px; margin-top: 5px; color: #444; }
        </style>
      </head>
      <body>
        <div class="slip">
          <div class="header">${template?.electionName || 'Election-2026'}</div>
          <div class="title">VOTER SLIP</div>
          <div class="row"><span class="label">Name:</span> <span>${voter.firstMiddleNameEn || voter.name}</span></div>
          <div class="row"><span class="label">${voter.relationLabel || 'Father'}:</span> <span>${voter.relationName}</span></div>
          <div class="row"><span class="label">EPIC ID:</span> <span>${voter.epicNo}</span></div>
          <div class="row"><span class="label">Booth#:</span> <span>${voter.boothNo || booth?.boothNo || '-'}</span></div>
          <div class="row"><span class="label">Sl#:</span> <span>${voter.serialNo || '-'}</span></div>
          <div class="info-block">
            <div class="label">Poll Booth:</div>
            <div>${booth?.boothNameEn || voter.boothLabel || '-'}</div>
            <div style="font-size: 10px; color: #444;">${booth?.address || ''}</div>
          </div>
          <div class="info-block">
            <div class="row"><span class="label">Vote On:</span> <span>${template?.voteDate || '13-MAY-2024'}</span></div>
            <div class="row"><span class="label">Time:</span> <span>${template?.voteTime || '7.00AM-6.00PM'}</span></div>
          </div>
          <div class="valuable-vote">Kindly Cast Your Valuable Vote for ${template?.candidateParty || '-'}</div>
          <div class="candidate">
            <div style="font-size: 11px; opacity: 0.8;">${template?.candidateParty || '-'} CANDIDATE</div>
            <div style="font-size: 14px;">${template?.candidateName || '-'}</div>
            <div style="font-size: 10px; font-weight: normal;">${template?.candidateWardLabel || template?.wardLabel || ''}</div>
          </div>
          <div class="cut">------- Please cut here -------</div>
        </div>
        <script>
          setTimeout(() => {
            window.print();
            setTimeout(() => { window.frameElement.remove(); }, 1000);
          }, 500);
        </script>
      </body>
    </html>
  `);
  doc.close();
}
function normalizeMobileValue(value) { return String(value || '').replace(/\D/g, '').slice(0, 10); }
function maskTrailingValue(value) {
  return maskFamilySensitiveValue(value);
}

function MaskedFamilyField({
  label,
  value,
  onChange,
  mask = false,
  maskMode = 'trailing',
  placeholder = '',
  inputMode,
  type = 'text',
  readOnly = false,
}) {
  const [focused, setFocused] = useState(false);
  const maskFn = maskMode === 'leading' ? maskFamilyNameLeading : maskFamilySensitiveValue;
  const displayValue = mask && !focused ? maskFn(value) : value;
  return (
    <label className="mobile-web-field">
      <span>{label}</span>
      <input
        className="mobile-web-input"
        type={type}
        placeholder={placeholder}
        value={displayValue}
        readOnly={readOnly || (mask && !focused)}
        inputMode={inputMode}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          if (mask && !focused) return;
          onChange(e.target.value);
        }}
      />
    </label>
  );
}
function hiddenDobDisplay(value) {
  return String(value || '').trim() ? '' : '';
}
const LOCATION_CACHE_KEY = 'lastKnownLocation';
const LOCATION_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  return hasHydrated;
}
function getCachedLocation() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.latitude || !parsed?.longitude || !parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > LOCATION_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function setCachedLocation(location) {
  if (typeof window === 'undefined') return;
  if (!location?.latitude || !location?.longitude) return;
  const payload = { ...location, timestamp: Date.now() };
  localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(payload));
}
function formatLocationError(err) {
  if (!err) return 'Location permission is required to continue.';
  if (err.code === 1) return 'Location permission denied. Please allow it in both your browser and device settings, then retry.';
  if (err.code === 2) return 'Position unavailable. Please ensure your device\'s Location/GPS is turned ON and you have a clear view of the sky or a stable data connection.';
  if (err.code === 3) return 'Location request timed out. This often happens indoors; please try moving near a window or outdoors and retry.';
  return err?.message || 'Location access is required.';
}
function requestLocation({ allowCached = true } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Location access is unavailable.'));
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      reject(new Error('Location requires HTTPS (or localhost).'));
      return;
    }
    if (!navigator?.geolocation) {
      reject(new Error('Location access is not supported in this browser.'));
      return;
    }
    const runGeo = (options) =>
      new Promise((geoResolve, geoReject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => geoResolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => geoReject(err),
          options
        );
      });
    const cached = allowCached ? getCachedLocation() : null;
    const attempt = async () => {
      try {
        // Higher timeout for initial acquisition
        const position = await runGeo({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
        setCachedLocation(position);
        resolve(position);
      } catch (err) {
        if (err?.code === 2 || err?.code === 3) {
          try {
            // Fallback: low accuracy with significantly longer timeout
            const position = await runGeo({ enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
            setCachedLocation(position);
            resolve(position);
            return;
          } catch (retryErr) {
            if (allowCached && cached) {
              resolve({ latitude: cached.latitude, longitude: cached.longitude, cached: true });
              return;
            }
            reject(new Error(formatLocationError(retryErr)));
            return;
          }
        }
        if (allowCached && cached) {
          resolve({ latitude: cached.latitude, longitude: cached.longitude, cached: true });
          return;
        }
        reject(new Error(formatLocationError(err)));
      }
    };
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((res) => {
          if (res.state === 'denied') {
            reject(new Error('Location permission denied. Please allow it in browser settings and retry.'));
            return;
          }
          attempt();
        })
        .catch(attempt);
      return;
    }
    attempt();
  });
}
function buildVoterPayload(form, customValues) {
  const payload = {};
  Object.entries(form).forEach(([key, value]) => {
    const custom = String(customValues[key] ?? '').trim();
    if (Array.isArray(value)) {
      const baseList = value.filter((item) => item !== 'Others');
      const list = custom ? Array.from(new Set(baseList.concat(custom))) : baseList;
      payload[key] = JSON_MULTI_FIELDS.has(key) ? list : list.join(', ');
    } else payload[key] = value === 'Others' || custom ? custom : value;
  });
  payload.mobile = normalizeMobileValue(payload.mobile);
  return payload;
}
function voterFieldChanged(left, right) { if (Array.isArray(left) || Array.isArray(right)) { const a = (Array.isArray(left) ? left : left ? [left] : []).map(String).sort().join('|'); const b = (Array.isArray(right) ? right : right ? [right] : []).map(String).sort().join('|'); return a !== b; } return String(left ?? '').trim() !== String(right ?? '').trim(); }

const VISITED_VOTER_STORAGE_PREFIX = 'voterVisited:';

function getVoterEpicKey(voter) {
  return String(voter?.epicNo || voter?.epic || voter?.voterId || '').trim();
}

function isVoterMarkedVisitedLocally(epic) {
  if (!epic || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`${VISITED_VOTER_STORAGE_PREFIX}${epic}`) === '1';
  } catch {
    return false;
  }
}

/** Only platform super-admin logins are read-only in Manage/Add Volunteer (all other levels are editable). */
function isProtectedVolunteerLogin(volunteer = {}) {
  const level = String(volunteer.workingLevel || volunteer.assignmentType || '').toUpperCase();
  const role = String(volunteer.role || '').replace(/^ROLE_/, '').toUpperCase();
  return level === 'SUPER_ADMIN' || role === 'SUPER_ADMIN';
}

const isAssemblyOrWardVolunteerLogin = isProtectedVolunteerLogin;

function markVoterVisitedLocally(epic) {
  if (!epic || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${VISITED_VOTER_STORAGE_PREFIX}${epic}`, '1');
  } catch {
    /* ignore quota errors */
  }
}

function voterWasMetByVolunteer(voter) {
  if (!voter) return false;
  const epic = getVoterEpicKey(voter);
  if (isVoterMarkedVisitedLocally(epic)) return true;
  if (voter.volunteerMet) return true;
  const fields = voter.updatedFields;
  if (Array.isArray(fields) && fields.length > 0) return true;
  if (typeof fields === 'string' && fields.trim()) {
    try {
      const parsed = JSON.parse(fields);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    } catch {
      return true;
    }
  }
  if (voter.updatedByName || voter.updatedByPhone) return true;
  return false;
}

function emptyVoterForm() {
  return getDefaultVoterForm({});
}
function normalizeBoothLocationLink(booth, templateLink) {
  if (templateLink) return templateLink;
  const lat = booth?.latitude ?? booth?.lat ?? booth?.boothLat ?? booth?.booth_lat;
  const lng = booth?.longitude ?? booth?.lng ?? booth?.boothLng ?? booth?.booth_long;
  if (!lat || !lng) return '';
  return getGoogleExternalUrl(lat, lng);
}
function buildWhatsAppMessage(voter, booth, template) {
  const authority = template?.authorityName || 'Greater Bengaluru Authority';
  const election = template?.electionName || 'Election-2026';
  const assembly = template?.assemblyLabel || 'Assembly:';
  const ward = template?.wardLabel || 'Ward:';
  const candidateName = template?.candidateName || '';
  const candidateParty = template?.candidateParty || '';
  const candidateWard = template?.candidateWardLabel || '';
  const voteDate = template?.voteDate || '';
  const voteTime = template?.voteTime || '';
  const socialLink = template?.socialLink || '';
  const locationLink = normalizeBoothLocationLink(booth, template?.boothLocationLink);
  const voterName = voter?.firstMiddleNameEn || voter?.name || '-';
  const relationLabel = voter?.relationLabel || voter?.relationType || 'Father';
  const relationName = voter?.relationName || voter?.relationFirstMiddleNameEn || voter?.fatherName || voter?.motherName || '';
  const epic = voter?.epicNo || '-';
  const boothNo = booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '-';
  const serial = voter?.serialNo || voter?.sl || voter?.srNo || '-';
  const boothName = booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-';
  const boothAddress = booth?.address || booth?.boothAddress || '';

  const lines = [
    authority,
    election,
    assembly,
    ward,
    '***************************',
    'Voter details:',
    `Name: ${voterName}`,
    `${relationLabel} : ${relationName || '-'}`,
    `EPIC ID: ${epic}`,
    `BOOTH #: ${boothNo}`,
    `SERIAL #: ${serial}`,
    '***************************',
    'Booth Address:',
    boothName,
    boothAddress,
    voteDate ? `Vote On: ${voteDate}` : '',
    voteTime ? `Voting Time: ${voteTime}` : '',
    locationLink ? `Polling booth Location: ${locationLink}` : 'Polling booth Location:',
    '***************************',
    candidateParty ? `Kindly do Cast Your Valuable Vote for ${candidateParty}` : 'Kindly do Cast Your Valuable Vote',
    candidateName,
    candidateParty,
    candidateWard,
    socialLink ? `Follow us: ${socialLink}` : '',
    template?.bannerUrl && template.bannerUrl.startsWith('http') ? `Banner: ${template.bannerUrl}` : '',
  ];
  return lines.filter((item) => item !== '').join('\n').trim();
}
function buildSMSMessage(voter, booth, template) {
  const authority = template?.authorityName || 'Greater Bengaluru Authority';
  const election = template?.electionName || 'Election-2026';
  const assembly = template?.assemblyLabel || 'Assembly:';
  const ward = template?.wardLabel || 'Ward:';
  const candidateName = template?.candidateName || '';
  const candidateParty = template?.candidateParty || '';
  const candidateWard = template?.candidateWardLabel || '';
  const voteDate = template?.voteDate || '';
  const voteTime = template?.voteTime || '';
  const socialLink = template?.socialLink || '';
  const locationLink = normalizeBoothLocationLink(booth, template?.boothLocationLink);
  const voterName = voter?.firstMiddleNameEn || voter?.name || '-';
  const relationLabel = voter?.relationLabel || voter?.relationType || 'Father';
  const relationName = voter?.relationName || voter?.relationFirstMiddleNameEn || voter?.fatherName || voter?.motherName || '';
  const epic = voter?.epicNo || '-';
  const boothNo = booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '-';
  const serial = voter?.serialNo || voter?.sl || voter?.srNo || '-';
  const boothName = booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-';
  const boothAddress = booth?.address || booth?.boothAddress || '';

  const lines = [
    authority,
    election,
    assembly,
    ward,
    '***************************',
    'Voter details:',
    `Name: ${voterName}`,
    `${relationLabel} : ${relationName || '-'}`,
    `EPIC ID: ${epic}`,
    `BOOTH #: ${boothNo}`,
    `SERIAL #: ${serial}`,
    '***************************',
    'Booth Address:',
    boothName,
    boothAddress,
    voteDate ? `Vote On: ${voteDate}` : '',
    voteTime ? `Voting Time: ${voteTime}` : '',
    locationLink ? `Polling booth Location: ${locationLink}` : '',
    '***************************',
    candidateParty ? `Kindly do Cast Your Valuable Vote for ${candidateParty}` : 'Kindly do Cast Your Valuable Vote',
    candidateName,
    candidateParty,
    candidateWard,
    socialLink,
    template?.bannerUrl && template.bannerUrl.startsWith('http') ? `Banner: ${template.bannerUrl}` : '',
  ];
  return lines.filter((item) => item !== '').join('\n').trim();
}
function getWardOptionsFromCache() { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; const labels = wards.map((ward) => ward.wardNameEn || `Ward ${ward.wardId}`); const unique = Array.from(new Set(labels.filter(Boolean))); if (!unique.includes('Others')) unique.push('Others'); return unique; } catch { return ['Others']; } }
function getBoothOptionsFromCache() { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; const booths = wards.flatMap((ward) => (ward.booths || []).map((booth) => booth.boothNameEn || booth.nameEn || booth.booth_add_en || `Booth ${booth.boothId ?? booth.id ?? booth.booth_no ?? ''}`)); const unique = Array.from(new Set(booths.filter(Boolean))); if (!unique.includes('Others')) unique.push('Others'); return unique; } catch { return ['Others']; } }
function MobileHeader({ title, subtitle, onBack, hideAvatar = false }) { return <div className={`mobile-web-list-topbar ${hideAvatar ? 'no-avatar' : ''}`}><button className="mobile-web-back-btn" onClick={onBack} type="button"><ArrowBackIosNewRounded fontSize="small" /></button><div className="mobile-web-header-copy"><h2>{title}</h2>{subtitle ? <div className="mobile-web-header-subtitle">{subtitle}</div> : null}</div>{hideAvatar ? <div /> : <div className="mobile-web-avatar"><PersonOutlineRounded /></div>}</div>; }

const MOBILE_WEB_CLOSE_DROPDOWNS_EVENT = 'mobile-web-close-dropdowns';

function closeAllMobileWebDropdowns() {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event(MOBILE_WEB_CLOSE_DROPDOWNS_EVENT));
  }
}

function openNativeDatePicker(input) {
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch {
      /* fall through */
    }
  }
  input.focus();
  input.click();
}

function useDropdownDismiss(rootRef, onClose, panelRef) {
  useEffect(() => {
    const handleOutside = (event) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      const root = rootRef.current;
      const panel = panelRef?.current;
      if (root?.contains(target) || panel?.contains(target)) return;
      onClose();
    };
    const handleGlobalClose = () => onClose();
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('pointerdown', handleOutside, true);
    document.addEventListener(MOBILE_WEB_CLOSE_DROPDOWNS_EVENT, handleGlobalClose);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('pointerdown', handleOutside, true);
      document.removeEventListener(MOBILE_WEB_CLOSE_DROPDOWNS_EVENT, handleGlobalClose);
    };
  }, [rootRef, panelRef, onClose]);
}

/** Open dropdown upward when there is not enough viewport space below the trigger. */
function useDropdownDropUp(rootRef, open, panelRef, maxPanelHeight = 260) {
  const [dropUp, setDropUp] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setDropUp(false);
      return undefined;
    }
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const panel = panelRef?.current;
      const panelHeight = panel
        ? Math.min(panel.scrollHeight, maxPanelHeight)
        : maxPanelHeight;
      const margin = 12;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      setDropUp(spaceBelow < panelHeight && spaceAbove > spaceBelow);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, rootRef, panelRef, maxPanelHeight]);

  return dropUp;
}

const DROPDOWN_TOUCH_MOVE_THRESHOLD_PX = 14;

/** Prevent accidental option selection while scrolling dropdown panels on touch devices. */
function useDropdownPanelScrollGuard(open) {
  const guardRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });

  useEffect(() => {
    if (!open) {
      guardRef.current = { active: false, moved: false, startX: 0, startY: 0 };
    }
  }, [open]);

  const panelTouchHandlers = useMemo(() => ({
    onTouchStart: (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      guardRef.current = {
        active: true,
        moved: false,
        startX: touch.clientX,
        startY: touch.clientY,
      };
    },
    onTouchMove: (event) => {
      if (!guardRef.current.active) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - guardRef.current.startX);
      const dy = Math.abs(touch.clientY - guardRef.current.startY);
      if (dx > DROPDOWN_TOUCH_MOVE_THRESHOLD_PX || dy > DROPDOWN_TOUCH_MOVE_THRESHOLD_PX) {
        guardRef.current.moved = true;
      }
    },
    onTouchEnd: () => {
      if (guardRef.current.moved) {
        window.setTimeout(() => {
          guardRef.current = { active: false, moved: false, startX: 0, startY: 0 };
        }, 100);
        return;
      }
      guardRef.current = { active: false, moved: false, startX: 0, startY: 0 };
    },
    onTouchCancel: () => {
      guardRef.current = { active: false, moved: false, startX: 0, startY: 0 };
    },
  }), []);

  const shouldIgnoreOptionActivation = useCallback(() => guardRef.current.moved, []);

  return { panelTouchHandlers, shouldIgnoreOptionActivation };
}

function activateDropdownOption(event, shouldIgnore, onActivate) {
  if (shouldIgnore()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  onActivate();
}

function FeatureUnavailableScreen({ message = 'This feature will be available soon.' }) {
  const router = useRouter();
  return (
    <ScreenFrame accent="light">
      <div className="mobile-web-feature-unavailable">
        <p>{message}</p>
        <button
          type="button"
          className="mobile-web-feature-unavailable__btn"
          onClick={() => router.push('/mobile/search-voter')}
        >
          Check again
        </button>
      </div>
    </ScreenFrame>
  );
}

function filterNameSuggestions(suggestions, query, limit = 8) {
  const list = Array.isArray(suggestions) ? suggestions.filter(Boolean) : [];
  const q = String(query || '').trim().toLowerCase();
  const filtered = q
    ? list.filter((item) => String(item).toLowerCase().includes(q))
    : list;
  return filtered.slice(0, limit);
}

function FamilySuggestInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const dropUp = useDropdownDropUp(rootRef, open, panelRef, 200);
  const { panelTouchHandlers, shouldIgnoreOptionActivation } = useDropdownPanelScrollGuard(open);
  useDropdownDismiss(rootRef, () => setOpen(false), panelRef);
  const filtered = useMemo(
    () => filterNameSuggestions(suggestions, value),
    [suggestions, value],
  );

  return (
    <label
      className={`mobile-web-field mobile-web-suggest-field ${open && dropUp ? 'drop-up' : ''}`}
      ref={rootRef}
    >
      <span>{label}{required ? '' : ''}</span>
      <input
        ref={inputRef}
        className="mobile-web-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
      />
      {open && filtered.length > 0 ? (
        <div
          ref={panelRef}
          className="mobile-web-suggestion-panel mobile-web-field-suggestions"
          role="listbox"
          {...panelTouchHandlers}
        >
          <div className="mobile-web-suggestion-list">
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                role="option"
                className="mobile-web-suggestion-item"
                onPointerUp={(event) => {
                  activateDropdownOption(event, shouldIgnoreOptionActivation, () => {
                    onChange(item);
                    setOpen(false);
                    inputRef.current?.blur();
                  });
                }}
              >
                <div className="mobile-web-suggestion-name">{item}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </label>
  );
}
function SingleOptionSelect({ label, options, value, customValue, onSelect, onCustomValueChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const { panelTouchHandlers, shouldIgnoreOptionActivation } = useDropdownPanelScrollGuard(open);
  useDropdownDismiss(rootRef, () => setOpen(false), panelRef);
  const optionSet = new Set(options);
  const isUnknown = !!value && value !== 'Others' && !optionSet.has(value);
  const showOther = value === 'Others' || isUnknown || !!customValue;
  const summaryValue = showOther ? 'Others' : value;
  const otherValue = customValue || (isUnknown ? value : '');

  return (
    <div className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      <button
        className="mobile-web-multiselect-trigger"
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className={summaryValue ? 'has-value' : 'is-placeholder'}>{summaryValue || `Select ${label}`}</span>
        <ExpandMoreRounded className="mobile-web-select-icon" />
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="mobile-web-multiselect-panel mobile-web-premium-select-panel"
          role="listbox"
          {...panelTouchHandlers}
        >
          {options.map((option) => {
            const checked = option === 'Others' ? showOther : value === option;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={checked}
                className={`mobile-web-single-select-option ${checked ? 'checked' : ''}`}
                onPointerUp={(event) => {
                  activateDropdownOption(event, shouldIgnoreOptionActivation, () => {
                    onSelect(option);
                    setOpen(false);
                  });
                }}
                onClick={(event) => {
                  activateDropdownOption(event, shouldIgnoreOptionActivation, () => {
                    onSelect(option);
                    setOpen(false);
                  });
                }}
              >
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {showOther ? (
        <input
          className="mobile-web-input mobile-web-other-input"
          placeholder={`Enter ${label.toLowerCase()}`}
          value={otherValue}
          onChange={(e) => onCustomValueChange(e.target.value)}
          onBlur={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function PremiumSelect({ label, options = [], value, onChange, disabled = false, placeholder = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const dropUp = useDropdownDropUp(rootRef, open, panelRef, 240);
  const { panelTouchHandlers, shouldIgnoreOptionActivation } = useDropdownPanelScrollGuard(open);
  useDropdownDismiss(rootRef, () => setOpen(false), panelRef);

  const normalized = options.map((option) => (
    typeof option === 'string' ? { value: option, label: option } : option
  ));
  const selected = normalized.find((option) => String(option.value) === String(value));
  const display = selected?.label || placeholder || `Select ${label}`;

  return (
    <div
      className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${dropUp ? 'drop-up' : ''} ${disabled ? 'is-disabled' : ''}`}
      ref={rootRef}
    >
      <button
        className="mobile-web-multiselect-trigger"
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className={selected ? 'has-value' : 'is-placeholder'}>{display}</span>
        <ExpandMoreRounded className="mobile-web-select-icon" />
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="mobile-web-multiselect-panel mobile-web-premium-select-panel"
          role="listbox"
          {...panelTouchHandlers}
        >
          {normalized.map((option) => {
            const checked = String(option.value) === String(value);
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={checked}
                className={`mobile-web-single-select-option ${checked ? 'checked' : ''}`}
                onPointerUp={(event) => {
                  activateDropdownOption(event, shouldIgnoreOptionActivation, () => {
                    onChange(option.value);
                    setOpen(false);
                  });
                }}
                onClick={(event) => {
                  activateDropdownOption(event, shouldIgnoreOptionActivation, () => {
                    onChange(option.value);
                    setOpen(false);
                  });
                }}
              >
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
function MultiCheckboxSelect({ label, options, value, customValue, onToggle, onCustomValueChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const dropUp = useDropdownDropUp(rootRef, open, panelRef, 300);
  const { panelTouchHandlers, shouldIgnoreOptionActivation } = useDropdownPanelScrollGuard(open);
  useDropdownDismiss(rootRef, () => {
    setOpen(false);
    setSearch('');
  }, panelRef);
  const safeValue = Array.isArray(value) ? value : [];
  const optionSet = new Set(options);
  const selectedLabels = safeValue.filter((item) => item !== 'Others' && optionSet.has(item));
  const unknownLabels = safeValue.filter((item) => item !== 'Others' && !optionSet.has(item));
  const otherValue = customValue || unknownLabels.join(', ');
  const showOther = safeValue.includes('Others') || unknownLabels.length > 0 || !!customValue;
  const summaryItems = selectedLabels.length ? selectedLabels.slice() : [];
  if (showOther) summaryItems.push('Others');
  const summary = summaryItems.length ? `${summaryItems[0]}${summaryItems.length > 1 ? ` +${summaryItems.length - 1}` : ''}` : `Select ${label}`;

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  const activateToggle = (option, event, shouldIgnore) => {
    activateDropdownOption(event, shouldIgnore, () => onToggle(option));
  };

  return (
    <div
      className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${dropUp ? 'drop-up' : ''} ${disabled ? 'is-disabled' : ''}`}
      ref={rootRef}
    >
      <button
        className="mobile-web-multiselect-trigger"
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className={summaryItems.length ? 'has-value' : 'is-placeholder'}>{summary}</span>
        <ExpandMoreRounded className="mobile-web-select-icon" />
      </button>
      {open ? (
        <div ref={panelRef} className="mobile-web-multiselect-panel mobile-web-multiselect-panel--checkbox">
          {options.length > 5 ? (
            <div
              className="mobile-web-multiselect-search"
              onPointerDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
            >
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schemes..."
                className="mobile-web-input"
                style={{ minHeight: '40px', padding: '8px 12px' }}
              />
            </div>
          ) : null}
          <div className="mobile-web-multiselect-options" {...panelTouchHandlers}>
            {filteredOptions.length === 0 ? (
              <div className="mobile-web-multiselect-empty">No matches found</div>
            ) : null}
            {filteredOptions.map((option) => {
              const checked = option === 'Others' ? showOther : safeValue.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={`mobile-web-multiselect-option mobile-web-multiselect-option-btn ${checked ? 'checked' : ''}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => {
                    activateToggle(option, event, shouldIgnoreOptionActivation);
                  }}
                  onClick={(event) => {
                    activateToggle(option, event, shouldIgnoreOptionActivation);
                  }}
                >
                  <span className="mobile-web-multiselect-check" aria-hidden="true">
                    {checked ? '✓' : ''}
                  </span>
                  <span className="mobile-web-multiselect-option-label">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {showOther ? (
        <input
          className="mobile-web-input mobile-web-other-input"
          placeholder={`Enter ${label.toLowerCase()}`}
          value={otherValue}
          onChange={(e) => onCustomValueChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}
function PrintableVoterSlip({ voter, booth, template, isPreview = false }) {
  const election = template?.electionName || 'Election-2024';
  const voterName = voter?.name || '-';
  const relationLabel = voter?.relationLabel || voter?.relationType || 'Relation';
  const relationName = voter?.relationName || '-';
  const epic = voter?.epicNo || '-';
  const boothNo = booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '-';
  const serial = voter?.serialNo || voter?.sl || voter?.srNo || '-';
  const boothName = booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-';
  const boothAddress = booth?.address || booth?.boothAddress || '';
  const voteDate = template?.voteDate || '';
  const voteTime = template?.voteTime || '';
  const printedOn = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className={`printable-voter-slip-container ${isPreview ? 'is-preview' : ''}`}>
      <div className="voter-slip-header">{election}</div>
      <div className="voter-slip-title">VOTER-SLIP</div>
      <div className="voter-slip-body">
        <p><strong>Name:</strong> {voterName}</p>
        <p><strong>{relationLabel}:</strong> {relationName}</p>
        <p><strong>EPIC ID:</strong> {epic}</p>
        
        <div className="booth-serial-row">
          <div className="booth-cell">Booth#: {boothNo}</div>
          <div className="serial-cell">Sl#: {serial}</div>
        </div>

        <div className="booth-info-block">
          <p><strong>Poll Booth:</strong> {boothName}</p>
          <p className="indent">{boothAddress}</p>
        </div>

        <div className="vote-time-block">
          <p><strong>Vote On:</strong> {voteDate}</p>
          <p className="time-only">{voteTime}</p>
        </div>

        <div className="printed-on">Printed On: {printedOn}</div>
      </div>
      
      <div className="cut-line">*******Please cut here*******</div>
      
      {template?.showLogo && template?.bannerUrl && (
        <div className="logo-section">
          <img src={template.bannerUrl} alt="Candidate Logo" className="voter-slip-logo" />
        </div>
      )}
      
      <div className="voter-slip-footer">
        <p className="valuable-vote">Kindly do Cast Your Valuable<br/>Vote for {template?.candidateParty || 'BJP'}</p>
        
        <div className="candidate-info">
          <div className="candidate-name">{template?.candidateName}</div>
          <div className="candidate-party">{template?.candidateParty} CANDIDATE</div>
          <div className="candidate-ward">{template?.candidateWardLabel}</div>
        </div>
      </div>
    </div>
  );
}

function VoterInfoScreen({ voter, booth, onBack, onSave }) {
  const voterSubtabKey = useMemo(
    () => subtabStorageKey('voter-info', voter?.epicNo || voter?.epic || voter?.voterId || 'unknown'),
    [voter?.epicNo, voter?.epic, voter?.voterId],
  );
  const [activeTab, setActiveTab] = usePersistedSubtab(voterSubtabKey, 'PRIMARY', [
    'PRIMARY',
    'ADDITIONAL',
    'NOTES',
  ]);
  const [form, setForm] = useState(() => getDefaultVoterForm(voter));
  const [customValues, setCustomValues] = useState({});
  const [location, setLocation] = useState(
    voter?.latitude && voter?.longitude ? { latitude: voter.latitude, longitude: voter.longitude } : null
  );
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const [mobileFocused, setMobileFocused] = useState(false);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState(null);
  const [smsTemplate, setSmsTemplate] = useState(null);
  const [templateChannel, setTemplateChannel] = useState('WHATSAPP');
  const [templateDraft, setTemplateDraft] = useState({});
  const [templateStatus, setTemplateStatus] = useState({ loading: false, error: '', success: '' });
  const [bannerUpload, setBannerUpload] = useState({ loading: false, error: '' });
  const lastEpicRef = useRef(null);
  const skipScrollRef = useRef(false);
  const [visitDisplayMode, setVisitDisplayMode] = useState(() => voterWasMetByVolunteer(voter));
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('role') || '' : '';
  const isAdminUser = ['SUPER_ADMIN', 'ADMIN'].includes(userRole.replace('ROLE_', '').toUpperCase());

  const [activatedWards, setActivatedWards] = useState({ whatsapp: [], sms: [], print: [] });
  const [voterActivation, setVoterActivation] = useState({ whatsapp: false, sms: false, print: false });
  useEffect(() => {
    mobileApi.fetchActivatedWards().then(res => {
      const list = res?.data?.result || [];
      const grouped = { whatsapp: [], sms: [], print: [] };
      if (Array.isArray(list)) {
        list.forEach(item => {
          const chan = String(item.channel || '').toLowerCase();
          if (grouped[chan]) grouped[chan].push(item);
        });
      }
      setActivatedWards(grouped);
    }).catch(e => console.error('Failed to load activated wards:', e));
  }, []);

  const baseForm = useMemo(
    () => (isAdminUser ? getDefaultVoterForm(voter) : emptyVoterForm()),
    [voter, isAdminUser]
  );
  const basePayload = useMemo(() => buildVoterPayload(baseForm, {}), [baseForm]);
  const currentPayload = useMemo(() => buildVoterPayload(form, customValues), [form, customValues]);
  const hasChanges = useMemo(
    () => Object.keys(currentPayload).some((key) => voterFieldChanged(currentPayload[key], basePayload[key])),
    [currentPayload, basePayload]
  );

  useEffect(() => {
    const currentEpic = voter?.epicNo || voter?.epic || voter?.voterId || '';
    const isSameVoter = lastEpicRef.current && lastEpicRef.current === currentEpic;
    const visited = voterWasMetByVolunteer(voter);
    if (isAdminUser) {
      setForm(getDefaultVoterForm(voter));
      setVisitDisplayMode(false);
    } else if (visited) {
      setForm(emptyVoterForm());
      setVisitDisplayMode(true);
    } else {
      setForm(emptyVoterForm());
      setVisitDisplayMode(false);
    }
    setCustomValues({});
    setMobileFocused(false);
    if (!isSameVoter) {
      setBanner({ type: '', text: '' });
      setVoterActivation({ whatsapp: false, sms: false, print: false });
      if (currentEpic) {
        mobileApi.verifyVoterActivation(currentEpic).then(res => {
          const d = res?.data?.result || {};
          setVoterActivation({
            whatsapp: !!d.whatsapp,
            sms: !!d.sms,
            print: !!d.print
          });
        }).catch(() => { });
      }
    }
    lastEpicRef.current = currentEpic;
    if (typeof window !== 'undefined') {
      if (skipScrollRef.current) {
        skipScrollRef.current = false;
      } else if (!isSameVoter) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  }, [voter, isAdminUser]);

  const boothNumber = booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '';
  const boothTitle = formatBoothTitle(boothNumber, booth?.boothLabel || voter?.boothLabel);
  const wardId = booth?.wardId || voter?.wardId || voter?.ward_id || voter?.wardCode || '';
  const wardLabel = booth?.wardNameEn || voter?.wardNameEn || voter?.wardLabel || '';

  // Smart ward-activation lookup
  const isWardNameActivated = (channel) => {
    const list = activatedWards[channel.toLowerCase()] || [];
    if (!list || list.length === 0) return false;

    // Aggregate all possible textual identifiers for the voter's location
    const searchText = [
      wardLabel,
      boothTitle,
      voter?.pollingStationAdrEn,
      voter?.pollingStationAdrLocal,
      voter?.wardNameEn,
      voter?.wardLabel,
      voter?.wardName,
      voter?.boothLabel,
      voter?.boothNameEn
    ].filter(Boolean).join(' ').toLowerCase();

    const normalizedWardId = String(wardId || '').replace(/^W0*/i, '').trim();

    // 1. Precise ID/Number match
    const hasDirectMatch = list.some(w => (
      (w.wardId && String(w.wardId).trim() === normalizedWardId) ||
      (w.wardId && String(w.wardId).trim() === String(wardId).trim()) ||
      (w.wardNo && String(w.wardNo).trim() === normalizedWardId)
    ));
    if (hasDirectMatch) return true;

    // 2. Fuzzy matching based on keywords and labels
    return list.some(w => {
      const label = String(w.wardLabel || '').toLowerCase(); // e.g. "1 - k narayanapura"
      const name = String(w.wardNameEn || w.wardName || '').toLowerCase(); // e.g. "k narayanapura"

      // Extract ward number from label if missing (e.g. from "1 - ...")
      const wNo = String(w.wardNo || '').toLowerCase() || (label.match(/^(\d+)/) || [])[1];
      const nameKeywords = label.split(/[^a-z0-9]+/i).filter(p => p.length > 3 && !/^\d+$/.test(p));

      // Prefix match (e.g. "1 - " in booth title)
      if (wNo && (searchText.includes(wNo + ' -') || searchText.includes(wNo + '-'))) return true;

      // Exact number match
      if (wNo && normalizedWardId === wNo) return true;

      // Keyword match (e.g. "narayanapura")
      if (nameKeywords.some(k => searchText.includes(k))) return true;

      // Direct phrase match
      if (label && searchText.includes(label)) return true;
      if (name && searchText.includes(name)) return true;

      return false;
    });
  };

  const activeTemplate = templateChannel === 'SMS' ? smsTemplate : whatsAppTemplate;

  // Use a memo for discovery to avoid thrashing
  const discoveryStatus = useMemo(() => {
    return {
      whatsapp: (whatsAppTemplate?.enabled) || isWardNameActivated('WHATSAPP') || !!voterActivation.whatsapp,
      sms: (smsTemplate?.enabled) || isWardNameActivated('SMS') || !!voterActivation.sms,
      print: isWardNameActivated('PRINT') || !!voterActivation.print
    };
  }, [whatsAppTemplate, smsTemplate, activatedWards, voterActivation, wardLabel, boothTitle, wardId, voter]);

  const canSendWhatsApp = discoveryStatus.whatsapp;
  const canSendSms = discoveryStatus.sms;
  const resolvedPhone = normalizeMobileValue(currentPayload.mobile || voter?.mobile);
  const mapTarget = useMemo(() => {
    const lat = location?.latitude ?? voter?.latitude;
    const lng = location?.longitude ?? voter?.longitude;
    if (!lat || !lng) return null;
    return { latitude: lat, longitude: lng };
  }, [location, voter]);
  const mapSrc = mapTarget ? getGoogleEmbedUrl(mapTarget.latitude, mapTarget.longitude) : '';

  const handleFieldChange = (key, value) => {
    closeAllMobileWebDropdowns();
    const nextValue = key === 'mobile' ? normalizeMobileValue(value) : value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
    if (nextValue !== 'Others') setCustomValues((prev) => ({ ...prev, [key]: prev[key] || '' }));
  };

  const toggleGovtScheme = (option) => {
    setForm((prev) => ({
      ...prev,
      govtSchemeTracking: prev.govtSchemeTracking.includes(option)
        ? prev.govtSchemeTracking.filter((item) => item !== option)
        : prev.govtSchemeTracking.concat(option),
    }));
    if (option === 'Others') setCustomValues((prev) => ({ ...prev, govtSchemeTracking: prev.govtSchemeTracking || '' }));
  };

  const resetForm = () => {
    if (visitDisplayMode || voterWasMetByVolunteer(voter)) {
      setForm(emptyVoterForm());
      setVisitDisplayMode(true);
    } else {
      setForm(getDefaultVoterForm(voter));
      setVisitDisplayMode(false);
    }
    setCustomValues({});
    setBanner({ type: '', text: '' });
    setMobileFocused(false);
  };

  const getLocation = () => {
    requestLocation({ allowCached: false })
      .then((pos) => {
        setLocation({ latitude: pos.latitude, longitude: pos.longitude });
        setBanner({ type: 'success', text: 'Location captured successfully.' });
      })
      .catch((err) => setBanner({ type: 'error', text: err?.message || 'Unable to fetch current location.' }));
  };

  const saveVoter = async () => {
    if (!hasChanges) return;
    setSaving(true);
    setBanner({ type: '', text: '' });
    try {
      const updateRequest = {};
      Object.keys(currentPayload).forEach((key) => {
        if (voterFieldChanged(currentPayload[key], basePayload[key])) {
          updateRequest[key] = currentPayload[key];
        }
      });
      if (location?.latitude && location?.longitude) {
        updateRequest.latitude = location.latitude;
        updateRequest.longitude = location.longitude;
      }
      const res = await mobileApi.updateVoter(
        voter.epicNo,
        { updateRequest },
        { boothNo: voter?.boothNo, wardCode: voter?.wardCode || booth?.wardCode }
      );
      const saved = res?.data?.result || res?.result || {};
      setBanner({ type: 'success', text: 'Voter updated successfully.' });
      skipScrollRef.current = true;
      markVoterVisitedLocally(getVoterEpicKey(voter));
      setVisitDisplayMode(true);
      setForm(emptyVoterForm());
      setCustomValues({});
      setMobileFocused(false);
      onSave?.({
        ...voter,
        ...saved,
        ...currentPayload,
        volunteerMet: true,
        updatedFields: saved.updatedFields || Object.keys(currentPayload),
        latitude: location?.latitude ?? saved.latitude ?? voter?.latitude,
        longitude: location?.longitude ?? saved.longitude ?? voter?.longitude,
      });
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || error?.detail || 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  const openSms = () => {
    if (resolvedPhone.length < 10) {
      setBanner({ type: 'error', text: `Invalid phone number (${resolvedPhone.length} digits). Please enter a 10-digit number for SMS.` });
      return;
    }
    const encodedMessage = encodeURIComponent(buildSMSMessage({ ...voter, ...currentPayload }, booth, smsTemplate));
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${resolvedPhone}${separator}body=${encodedMessage}`;
  };

  const openWhatsApp = () => {
    if (resolvedPhone.length < 10) {
      setBanner({ type: 'error', text: `Invalid phone number (${resolvedPhone.length} digits). Please enter a 10-digit number for WhatsApp.` });
      return;
    }
    const encodedMessage = encodeURIComponent(buildWhatsAppMessage({ ...voter, ...currentPayload }, booth, whatsAppTemplate));
    window.open(`https://wa.me/91${resolvedPhone}?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
  };

  const openCall = () => {
    if (resolvedPhone.length < 10) {
      setBanner({ type: 'error', text: `Invalid phone number (${resolvedPhone.length} digits).` });
      return;
    }
    window.location.href = `tel:${resolvedPhone}`;
  };


  const showVisitedBadge = voterWasMetByVolunteer(voter) || visitDisplayMode;

  const getFormDisplayValue = (key) => {
    if (isAdminUser) return form[key];
    if (visitDisplayMode) {
      if (key === 'govtSchemeTracking') return [];
      return form[key] || '';
    }
    return form[key];
  };

  const resolveSensitiveFieldValue = (key) => {
    const formValue = String(form[key] || '').trim();
    if (formValue) return form[key];
    if (!isAdminUser && visitDisplayMode) return voter?.[key] || '';
    return '';
  };

  const renderSelect = (key, placeholder, multiple = false) => {
    const options = dropdownOptions[key] || [];
    const displayValue = getFormDisplayValue(key);
    const displayCustom = visitDisplayMode && !isAdminUser ? '' : customValues[key];
    if (multiple) {
      const multiValue = Array.isArray(displayValue)
        ? displayValue
        : (displayValue ? String(displayValue).split(',').map((item) => item.trim()).filter(Boolean) : []);
      return (
        <MultiCheckboxSelect
          label={placeholder}
          options={options}
          value={multiValue}
          customValue={displayCustom}
          disabled={visitDisplayMode && !isAdminUser}
          onToggle={toggleGovtScheme}
          onCustomValueChange={(nextValue) => setCustomValues((prev) => ({ ...prev, [key]: nextValue }))}
        />
      );
    }
    return (
      <SingleOptionSelect
        label={placeholder}
        options={options}
        value={displayValue}
        customValue={displayCustom}
        onSelect={(option) => handleFieldChange(key, option)}
        onCustomValueChange={(nextValue) => setCustomValues((prev) => ({ ...prev, [key]: nextValue }))}
      />
    );
  };

  const renderField = (key) => {
    if (key === 'mobile') {
      const storedMobile = resolveSensitiveFieldValue('mobile');
      return (
        <input
          className="mobile-web-input"
          inputMode="numeric"
          maxLength={10}
          value={mobileFocused ? (form.mobile || storedMobile) : maskTrailingValue(storedMobile)}
          placeholder={fieldLabels[key]}
          onFocus={() => {
            if (!form.mobile && storedMobile) {
              setForm((prev) => ({ ...prev, mobile: normalizeMobileValue(storedMobile) }));
            }
            setMobileFocused(true);
          }}
          onBlur={() => setMobileFocused(false)}
          onChange={(e) => handleFieldChange(key, e.target.value)}
        />
      );
    }
    if (key === 'dob') {
      const storedDob = resolveSensitiveFieldValue('dob');
      const showHiddenPlaceholder = visitDisplayMode && storedDob && !form.dob;
      const dateValue = form.dob || (!showHiddenPlaceholder ? storedDob : '') || '';
      return (
        <div className={`mobile-web-date-field ${showHiddenPlaceholder ? 'is-masked' : ''}`}>
          {showHiddenPlaceholder ? (
            <span className="mobile-web-date-placeholder" aria-hidden="true">
              On file — tap calendar to pick date
            </span>
          ) : null}
          <input
            ref={dobInputRef}
            className="mobile-web-input mobile-web-date-input"
            type="date"
            value={dateValue}
            max={new Date().toISOString().slice(0, 10)}
            aria-label={fieldLabels[key]}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            onClick={(e) => {
              closeAllMobileWebDropdowns();
              openNativeDatePicker(e.currentTarget);
            }}
          />
          <button
            type="button"
            className="mobile-web-date-picker-btn"
            aria-label="Open date of birth picker"
            onClick={() => {
              closeAllMobileWebDropdowns();
              openNativeDatePicker(dobInputRef.current);
            }}
          >
            <CalendarMonthOutlined fontSize="small" />
          </button>
        </div>
      );
    }
    if (key === 'ifShifted') {
      return (
        <input
          className="mobile-web-input"
          value={form[key]}
          placeholder={fieldLabels[key]}
          onChange={(e) => handleFieldChange(key, e.target.value)}
        />
      );
    }
    if (key === 'govtSchemeTracking') return renderSelect(key, fieldLabels[key], true);
    return renderSelect(key, fieldLabels[key], false);
  };

  const handleTabChange = (tab) => {
    closeAllMobileWebDropdowns();
    setActiveTab(tab);
  };

  const dobInputRef = useRef(null);

  const [printTemplate, setPrintTemplate] = useState(null);
  useEffect(() => {
    let active = true;
    const toDraft = (tpl) => ({
      authorityName: tpl?.authorityName || 'Greater Bengaluru Authority',
      electionName: tpl?.electionName || 'Election-2026',
      assemblyLabel: tpl?.assemblyLabel || '',
      wardLabel: tpl?.wardLabel || wardLabel || '',
      candidateName: tpl?.candidateName || '',
      candidateParty: tpl?.candidateParty || '',
      candidateWardLabel: tpl?.candidateWardLabel || '',
      voteDate: tpl?.voteDate || '',
      voteTime: tpl?.voteTime || '',
      socialLink: tpl?.socialLink || '',
      boothLocationLink: tpl?.boothLocationLink || '',
      enabled: tpl?.enabled || false,
      bannerUrl: tpl?.bannerUrl || '',
      showLogo: tpl?.showLogo !== undefined ? tpl.showLogo : true,
    });
    const fetchChannel = async (channel) => {
      const effectiveWardId = wardId || voter?.wardId || voter?.ward_id || voter?.wardNo || '';
      const voterEpic = voter?.epicNo || voter?.epic || voter?.voterId;
      const wardRes = await mobileApi.fetchMessageTemplate(effectiveWardId || null, channel, voterEpic);
      const wardTpl = wardRes?.data?.result || null;
      if (wardTpl) return wardTpl;

      const globalRes = await mobileApi.fetchMessageTemplate(null, channel);
      return globalRes?.data?.result || null;
    };
    const loadTemplate = async () => {
      setTemplateStatus({ loading: true, error: '', success: '' });
      try {
        const [waTpl, smsTpl, prnTpl] = await Promise.all([
          fetchChannel('WHATSAPP'),
          fetchChannel('SMS'),
          fetchChannel('PRINT')
        ]);
        if (!active) return;
        setWhatsAppTemplate(waTpl);
        setSmsTemplate(smsTpl);
        setPrintTemplate(prnTpl);
        setTemplateDraft(toDraft(templateChannel === 'SMS' ? smsTpl : (templateChannel === 'PRINT' ? prnTpl : waTpl)));
      } catch (error) {
        if (!active) return;
        setTemplateStatus({ loading: false, error: error?.message || 'Unable to load message template.', success: '' });
      } finally {
        if (active) setTemplateStatus((prev) => ({ ...prev, loading: false }));
      }
    };
    loadTemplate();
    return () => { active = false; };
  }, [wardId, wardLabel, templateChannel]);

  const handleTemplateChange = (key, value) => {
    setTemplateDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleTemplateSave = async () => {
    setTemplateStatus({ loading: true, error: '', success: '' });
    try {
      const payload = {
        wardId: wardId || null,
        channel: templateChannel,
        authorityName: templateDraft.authorityName,
        electionName: templateDraft.electionName,
        assemblyLabel: templateDraft.assemblyLabel,
        wardLabel: templateDraft.wardLabel,
        candidateName: templateDraft.candidateName,
        candidateParty: templateDraft.candidateParty,
        candidateWardLabel: templateDraft.candidateWardLabel,
        voteDate: templateDraft.voteDate,
        voteTime: templateDraft.voteTime,
        socialLink: templateDraft.socialLink,
        boothLocationLink: templateDraft.boothLocationLink,
        bannerUrl: templateDraft.bannerUrl,
        showLogo: templateDraft.showLogo,
        enabled: templateDraft.enabled,
      };
      const res = await mobileApi.saveMessageTemplate(payload);
      const tpl = res?.data?.result || null;
      if (templateChannel === 'SMS') setSmsTemplate(tpl);
      else if (templateChannel === 'PRINT') setPrintTemplate(tpl);
      else setWhatsAppTemplate(tpl);
      setTemplateStatus({ loading: false, error: '', success: 'Template saved.' });
    } catch (error) {
      setTemplateStatus({ loading: false, error: error?.message || 'Unable to save template.', success: '' });
    }
  };

  const handleBannerUpload = async (file) => {
    if (!file) return;
    setBannerUpload({ loading: true, error: '' });
    try {
      const res = await mobileApi.uploadMessageTemplateBanner({ wardId, channel: 'WHATSAPP', file });
      const tpl = res?.data?.result || null;
      setWhatsAppTemplate(tpl);
      setTemplateDraft((prev) => ({
        ...prev,
        bannerUrl: tpl?.bannerUrl || prev.bannerUrl,
        showLogo: tpl?.showLogo !== undefined ? tpl.showLogo : prev.showLogo
      }));
      setBannerUpload({ loading: false, error: '' });
    } catch (error) {
      setBannerUpload({ loading: false, error: error?.message || 'Unable to upload banner.' });
    }
  };

  return (
    <div className="mobile-web-stack mobile-web-voter-info-shell">
      <MobileHeader title="Voter Info" onBack={onBack} />
      {banner.text && banner.type === 'error' ? <div className="mobile-web-error">{banner.text}</div> : null}
      <section className="mobile-web-detail-card">
        <div className="mobile-web-detail-meta p-5">
          {showVisitedBadge ? (
            <div className="mobile-web-visited-premium" title="This voter was updated by a volunteer">
              <span className="mobile-web-visited-premium-icon" aria-hidden="true">
                ✓
              </span>
              <div className="mobile-web-visited-premium-copy">
                <span className="mobile-web-visited-premium-label">Visited</span>
                <span className="mobile-web-visited-premium-sub">Survey saved · details hidden for privacy</span>
              </div>
            </div>
          ) : null}
          {!isAdminUser && visitDisplayMode && resolveSensitiveFieldValue('mobile') ? (
            <div className="mobile-web-masked-mobile-card">
              <span className="mobile-web-masked-mobile-label">Mobile Number</span>
              <span className="mobile-web-masked-mobile-value">
                {maskTrailingValue(resolveSensitiveFieldValue('mobile'))}
              </span>
            </div>
          ) : null}
          <p>
            <strong>Name</strong>
            <span>{voter?.name || '-'}</span>
          </p>
          <p>
            <strong>EPIC / Voter ID</strong>
            <span>{voter?.epicNo || '-'}</span>
          </p>
          <p>
            <strong>Polling Booth</strong>
            <span>{boothTitle || '-'}</span>
          </p>
          <p>
            <strong>Ward</strong>
            <span>{wardLabel || voter?.wardNameEn || '-'}</span>
          </p>
          {resolveSensitiveFieldValue('dob') && !visitDisplayMode ? (
            <p>
              <strong>Date of Birth</strong>
              <span>{resolveSensitiveFieldValue('dob')}</span>
            </p>
          ) : null}
        </div>
        <div className="mobile-web-map-card">
          {mapTarget ? (
            <iframe
              className="mobile-web-map-frame"
              title="Voter location map"
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="mobile-web-map-placeholder">Location optional — capture to preview map.</div>
          )}
        </div>
        <button
          className="mobile-web-location-btn"
          onClick={() => {
            closeAllMobileWebDropdowns();
            getLocation();
          }}
          type="button"
        >
          <LocationOnOutlined />
          <span>{location ? 'Location Captured' : 'Get Location (optional)'}</span>
        </button>
        <div className="mobile-web-contact-actions">
          <button
            className={`mobile-web-contact-btn ${!canSendSms ? 'is-disabled' : ''}`}
            onClick={() => {
              closeAllMobileWebDropdowns();
              openSms();
            }}
            type="button"
            disabled={!canSendSms}
          >
            <SmsOutlined />
            <span>SMS</span>
          </button>
          <button
            className={`mobile-web-contact-btn ${!canSendWhatsApp ? 'is-disabled' : ''}`}
            onClick={() => {
              closeAllMobileWebDropdowns();
              openWhatsApp();
            }}
            type="button"
            disabled={!canSendWhatsApp}
          >
            <WhatsApp />
            <span>WhatsApp</span>
          </button>
          <button
            className="mobile-web-contact-btn"
            onClick={() => {
              closeAllMobileWebDropdowns();
              openCall();
            }}
            type="button"
          >
            <PhoneOutlined />
            <span>Call</span>
          </button>
        </div>
      </section>

      <section className="mobile-web-tab-shell">
        <div className="mobile-web-tab-strip">
          {['PRIMARY', 'ADDITIONAL', 'NOTES'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`mobile-web-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab !== 'NOTES' &&
          fieldGroups[activeTab].map((key) => (
            <div key={key} className="mobile-web-field">
              <label>{fieldLabels[key]}</label>
              {renderField(key)}
            </div>
          ))}
        {activeTab === 'NOTES' && (
          <>
            <div className="mobile-web-field">
              <label>Available</label>
              {renderSelect('status', 'Availability')}
            </div>
            {(getFormDisplayValue('status') === 'Shifted in the ward' || getFormDisplayValue('status') === 'Shifted outside the ward') && (
              <div className="mobile-web-field">
                <label>Enter present address</label>
                <textarea
                  className="mobile-web-input mobile-web-textarea"
                  value={getFormDisplayValue('presentAddress')}
                  onChange={(e) => handleFieldChange('presentAddress', e.target.value)}
                  placeholder="Enter present address"
                />
              </div>
            )}
            {getFormDisplayValue('status') === 'Recommend shift to the new ward' && (
              <>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <input
                    className="mobile-web-input"
                    value={getFormDisplayValue('newWard')}
                    onChange={(e) => handleFieldChange('newWard', e.target.value)}
                    placeholder="Enter ward"
                  />
                </div>
                <div className="mobile-web-field">
                  <label>Booth No</label>
                  <input
                    className="mobile-web-input"
                    value={getFormDisplayValue('newBoothNo')}
                    onChange={(e) => handleFieldChange('newBoothNo', e.target.value)}
                    placeholder="Enter booth number"
                  />
                </div>
                <div className="mobile-web-field">
                  <label>Serial No</label>
                  <input
                    className="mobile-web-input"
                    value={getFormDisplayValue('newSerialNo')}
                    onChange={(e) => handleFieldChange('newSerialNo', e.target.value)}
                    placeholder="Enter serial number"
                  />
                </div>
              </>
            )}
            {getFormDisplayValue('status') === 'Not available' && (
              <div className="mobile-web-field">
                <label>Enter the reason</label>
                <textarea
                  className="mobile-web-input mobile-web-textarea"
                  value={getFormDisplayValue('notAvailableReason')}
                  onChange={(e) => handleFieldChange('notAvailableReason', e.target.value)}
                  placeholder="Enter the reason"
                />
              </div>
            )}
            <div className="mobile-web-field">
              <label>ENTER NOTES</label>
              <textarea
                className="mobile-web-input mobile-web-textarea"
                value={getFormDisplayValue('notes')}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Enter notes"
              />
            </div>
          </>
        )}
        <div className="mobile-web-form-actions">
          <button className="mobile-web-reset-btn" onClick={resetForm} type="button">
            Reset
          </button>
          <button className="mobile-web-update-btn" onClick={saveVoter} disabled={saving || !hasChanges} type="button">
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
        {banner.text && banner.type === 'success' ? <div className="mobile-web-success">{banner.text}</div> : null}
        <button
          className={`mobile-web-slip-btn ${!discoveryStatus.print ? 'is-disabled' : ''}`}
          onClick={() => window.print()}
          type="button"
          disabled={!discoveryStatus.print}
        >
          Voter Slip Print
        </button>
      </section>
      <PrintableVoterSlip
        voter={{ ...voter, ...currentPayload }}
        booth={booth}
        template={printTemplate || whatsAppTemplate}
      />
    </div>
  );
}
function VoterListScreen({
  heading,
  voters,
  booth,
  loading,
  isLocating,
  errorText,
  onBack,
  onLoadMore,
  hasMore,
  summary,
  mode = 'local',
  onSelectVoter,
  onRetryLocation,
}) {
  const [query, setQuery] = useState('');
  const [localVisibleCount, setLocalVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setQuery('');
    setLocalVisibleCount(PAGE_SIZE);
  }, [heading, booth?.boothId]);

  const normalizedVoters = useMemo(
    () =>
      voters
        .map((voter) => normalizeVoter(voter, booth))
        .sort((a, b) => {
          const aNum = Number.parseInt(String(a.serialNo ?? '').replace(/[^\d]/g, ''), 10);
          const bNum = Number.parseInt(String(b.serialNo ?? '').replace(/[^\d]/g, ''), 10);
          const aVal = Number.isFinite(aNum) ? aNum : Number.POSITIVE_INFINITY;
          const bVal = Number.isFinite(bNum) ? bNum : Number.POSITIVE_INFINITY;
          return aVal - bVal;
        }),
    [voters, booth]
  );

  const filteredVoters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedVoters;
    return normalizedVoters.filter((voter) =>
      [voter.name, voter.epicNo, voter.relationName, voter.houseNo, voter.gender, voter.boothId, voter.boothLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [normalizedVoters, query]);

  const displayedVoters = mode === 'local' ? filteredVoters.slice(0, localVisibleCount) : filteredVoters;

  const resolvedSummary = booth
    ? boothStats(booth)
    : {
      total: Number(summary?.total ?? filteredVoters.length),
      male: Number(summary?.male ?? filteredVoters.filter((v) => String(v.gender).toUpperCase().startsWith('M')).length),
      female:
        Number(summary?.female ?? filteredVoters.filter((v) => String(v.gender).toUpperCase().startsWith('F')).length),
    };

  const canLoadMoreLocal = mode === 'local' && displayedVoters.length < filteredVoters.length;
  const sentinelRef = useInfiniteTrigger(canLoadMoreLocal || (!!hasMore && mode === 'remote'), () => {
    if (canLoadMoreLocal) setLocalVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredVoters.length));
    else if (hasMore && onLoadMore) onLoadMore();
  });

  const headerTitle =
    booth?.boothNo || booth?.boothId ? formatBoothTitle(booth?.boothNo ?? booth?.boothId, booth?.boothLabel) : heading;

  const headerSubtitle = (
    <>
      <span className="mobile-web-stat-pill total">
        Total Voters: <strong>{resolvedSummary.total}</strong>
      </span>
      <span className="mobile-web-stat-pill male">
        Male: <strong>{resolvedSummary.male}</strong>
      </span>
      <span className="mobile-web-stat-pill female">
        Female: <strong>{resolvedSummary.female}</strong>
      </span>
    </>
  );

  return (
    <div className="mobile-web-stack">
      {isLocating && (
        <div className="mobile-web-locating-overlay">
          <div className="mobile-web-locating-spinner" />
          <div className="mobile-web-locating-text">Verifying Location...</div>
          <div className="mobile-web-locating-subtext">Please wait while we capture your position</div>
        </div>
      )}
      <MobileHeader title={headerTitle} subtitle={headerSubtitle} onBack={onBack} hideAvatar={true} />
      <section className="mobile-web-search-card mobile-web-card">
        <div className="mobile-web-search-input-wrap">
          <SearchRounded className="mobile-web-search-icon" />
          <input
            className="mobile-web-input"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>
      {errorText ? (
        <div className="mobile-web-error">
          <div>{errorText}</div>
          {onRetryLocation ? (
            <button type="button" className="mobile-web-secondary-btn" onClick={onRetryLocation}>
              Retry Location
            </button>
          ) : null}
        </div>
      ) : null}
      {loading && displayedVoters.length === 0 ? <div className="mobile-web-empty">Loading voters...</div> : null}
      <section className="mobile-web-voter-list">
        {displayedVoters.map((voter) => (
          <button
            key={`${voter.boothId}-${voter.voterId}-${voter.epicNo}`}
            type="button"
            className="mobile-web-voter-card mobile-web-voter-button"
            onClick={() => onSelectVoter?.(voter, booth)}
          >
            <div className="mobile-web-voter-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>{voter.serialNo ?? '-'}</span>
                <strong>{voter.epicNo}</strong>
                {voterWasMetByVolunteer(voter) ? (
                  <span className="mobile-web-voter-met-badge" title="This voter was updated by a volunteer">
                    Visited
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mobile-web-voter-grid">
              <div className="mobile-web-voter-row">
                <span className="mobile-web-voter-label">Name</span>
                <span className="mobile-web-voter-value">{voter.name}</span>
              </div>
              <div className="mobile-web-voter-row">
                <span className="mobile-web-voter-label">{voter.relationLabel}</span>
                <span className="mobile-web-voter-value">{voter.relationName || '-'}</span>
              </div>
              <div className="mobile-web-voter-row">
                <span className="mobile-web-voter-label">House No.</span>
                <span className="mobile-web-voter-value">{voter.houseNo}</span>
              </div>
              <div className="mobile-web-voter-row">
                <span className="mobile-web-voter-label">Age</span>
                <span className="mobile-web-voter-value">{voter.age}</span>
              </div>
              <div className="mobile-web-voter-row">
                <span className="mobile-web-voter-label">Sex</span>
                <span className={`mobile-web-voter-value mobile-web-gender-chip ${voter.genderClass}`}>
                  {voter.gender}
                </span>
              </div>
              <div className="mobile-web-voter-row">
                <span className="mobile-web-voter-label">Booth</span>
                <span className="mobile-web-voter-value">
                  {formatBoothTitle(voter.boothNo || voter.boothId, voter.boothLabel)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </section>
      {!loading && displayedVoters.length === 0 ? <div className="mobile-web-empty">No voters found.</div> : null}
      {canLoadMoreLocal || hasMore ? (
        <div ref={sentinelRef} className="mobile-web-load-note">
          Loading more...
        </div>
      ) : null}
    </div>
  );
}
function SearchVoterScreen({ assemblyCodeProp }) {
  const hasHydrated = useHasHydrated();
  const [sessionReady, setSessionReady] = useState(false);
  const assemblyCode = useMemo(() => {
    const fromProp = assemblyCodeProp ? String(assemblyCodeProp).trim() : '';
    if (fromProp) return fromProp;
    if (typeof window === 'undefined') return '';
    return getAssemblyCode() || '';
  }, [assemblyCodeProp, hasHydrated]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [wardItems, setWardItems] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [form, setForm] = useState({
    searchQuery: '',
    wards: '',
    epicId: '',
    boothNumber: '',
    mobileNumber: '',
    relationName: '',
    houseNumber: '',
  });
  const searchVoterSubtabKey = useMemo(
    () => subtabStorageKey('search-voter', assemblyCodeProp || 'default'),
    [assemblyCodeProp],
  );
  const [view, setView] = usePersistedSubtab(searchVoterSubtabKey, 'search', ['search', 'list']);
  const [voterResults, setVoterResults] = useState([]);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [resultMeta, setResultMeta] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const userInfo = useMemo(
    () => (sessionReady || hasHydrated ? getUserInfoFromStorage() : {}),
    [sessionReady, hasHydrated]
  );
  const lastWardLoadRef = useRef('');
  const lastSelectionRef = useRef(null);
  const clearedStaleListViewRef = useRef(false);

  useEffect(() => {
    let active = true;
    ensureUserProfileReady().then(() => {
      if (active) setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (clearedStaleListViewRef.current) return;
    if (view === 'list' && voterResults.length === 0 && !searching) {
      setView('search');
    }
    clearedStaleListViewRef.current = true;
  }, [view, voterResults.length, searching, setView]);

  const accessWardIds = useMemo(() => {
    const ids = [];
    if (Array.isArray(userInfo?.wardIds)) ids.push(...userInfo.wardIds);
    if (Array.isArray(userInfo?.wards)) ids.push(...userInfo.wards);
    if (userInfo?.wardId) ids.push(userInfo.wardId);
    if (userInfo?.ward_id) ids.push(userInfo.ward_id);
    if ((userInfo?.assignmentType || '').toUpperCase() === 'WARD' && userInfo?.assignmentId) {
      String(userInfo.assignmentId)
        .split(',')
        .map((val) => val.trim())
        .filter(Boolean)
        .forEach((val) => ids.push(val));
    }
    return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
  }, [userInfo]);

  const accessBoothIds = useMemo(() => {
    const ids = [];
    if (Array.isArray(userInfo?.boothIds)) ids.push(...userInfo.boothIds);
    if (userInfo?.boothId) ids.push(userInfo.boothId);
    if (userInfo?.booth_id) ids.push(userInfo.booth_id);
    if ((userInfo?.assignmentType || '').toUpperCase() === 'BOOTH' && userInfo?.assignmentId) {
      String(userInfo.assignmentId)
        .split(',')
        .map((val) => val.trim())
        .filter(Boolean)
        .forEach((val) => ids.push(val));
    }
    return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
  }, [userInfo]);

  useEffect(() => {
    if (accessBoothIds.length === 1 && !form.boothNumber) {
      handleChange('boothNumber', accessBoothIds[0]);
    }
  }, [accessBoothIds, form.boothNumber]);

  useEffect(() => {
    if (!assemblyCode) return undefined;
    const key = `${String(assemblyCode)}|${sessionReady ? 'ready' : 'pending'}`;
    if (lastWardLoadRef.current === key && wardItems.length > 0) return undefined;
    let active = true;
    setErrorText('');
    const assemblyId = assemblyCode || getAssemblyCode();
    mobileApi.fetchWards(assemblyId).then((res) => {
      if (!active) return;
      const wards = Array.isArray(res)
        ? res
        : Array.isArray(res?.data?.result)
          ? res.data.result
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.result)
              ? res.result
              : Array.isArray(res?.wards)
                ? res.wards
                : Array.isArray(res?.data?.data)
                  ? res.data.data
                  : [];
      const list = (wards || [])
        .map((ward, index) => {
          const id = ward?.wardId ?? ward?.ward_id ?? ward?.id ?? ward?.ward_no ?? index + 1;
          const name = ward?.wardNameEn ?? ward?.ward_name_en ?? ward?.ward_name_local ?? ward?.name_en ?? ward?.name ?? '';
          return { label: name || `Ward ${id}`, value: String(id) };
        })
        .filter((item) => item.label)
        .sort((a, b) => Number(a.value) - Number(b.value));

      const filtered = accessWardIds.length
        ? list.filter((item) => accessWardIds.includes(item.value))
        : list;

      setWardItems(filtered);
      if (filtered.length > 0) lastWardLoadRef.current = key;
      if (!filtered.length) setErrorText('No wards found for this user.');
    }).catch((error) => {
      setWardItems([]);
      setErrorText(error?.message || error?.detail || 'Unable to load wards.');
    });
    return () => {
      active = false;
    };
  }, [assemblyCode, sessionReady, accessWardIds.length]);

  useEffect(() => {
    if (accessWardIds.length > 0 && !form.wards && wardItems.length > 0) {
      handleChange('wards', wardItems[0].value);
    }
  }, [accessWardIds, wardItems.length, form.wards]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const handleReset = () => {
    setForm({
      searchQuery: '',
      wards: '',
      epicId: '',
      boothNumber: '',
      mobileNumber: '',
      relationName: '',
      houseNumber: '',
    });
    setErrorText('');
    setSuccessText('');
    setVoterResults([]);
    setPage(0);
    setHasMore(false);
    setResultMeta(null);
    setView('search');
    setSelectedVoter(null);
  };

  const runSearch = async (nextPage = 0) => {
    await ensureUserProfileReady();
    const resolvedAssembly = assemblyCode || getAssemblyCode();
    const response = await mobileApi.searchVoters({
      assemblyCode: resolvedAssembly,
      searchQuery: form.searchQuery,
      wardId: form.wards || undefined,
      boothNumber: form.boothNumber,
      mobileNumber: form.mobileNumber,
      epicId: form.epicId,
      relationName: form.relationName,
      houseNumber: form.houseNumber,
      page: nextPage,
      size: PAGE_SIZE,
    });
    const { results: nextResults, meta } = parseVoterSearchResponse(response);
    setResultMeta(meta);
    setHasMore(Boolean(meta?.hasMore));
    setPage(nextPage);
    setVoterResults((current) => (nextPage === 0 ? nextResults : [...current, ...nextResults]));
    setView('list');
  };

  const handleSearch = async () => {
    setSearching(true);
    setErrorText('');
    setSuccessText('');
    try {
      await ensureUserProfileReady();
      setSessionReady(true);
    } catch {
      // continue with cached profile
    }
    const resolvedAssembly = assemblyCode || getAssemblyCode();
    if (!resolvedAssembly) {
      setErrorText('No assembly code is configured for this user/environment.');
      setSearching(false);
      return;
    }
    try {
      await runSearch(0);
    } catch (error) {
      setErrorText(error?.message || error?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || searching || !hasMore) return;
    setLoadingMore(true);
    try {
      await runSearch(page + 1);
    } catch (error) {
      setErrorText(error?.message || error?.detail || 'Failed to load more voters');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSaveVoter = (updatedVoter) => {
    setSelectedVoter((current) => (
      current && (current.voterId === updatedVoter.voterId || current.epicNo === updatedVoter.epicNo)
        ? { ...current, ...updatedVoter, volunteerMet: true }
        : current
    ));
    setVoterResults((current) =>
      current.map((item) => (
        item.voterId === updatedVoter.voterId || item.epicNo === updatedVoter.epicNo
          ? { ...item, ...updatedVoter, volunteerMet: true }
          : item
      ))
    );
  };

  const handleSelectVoter = async (voter) => {
    lastSelectionRef.current = { voter };
    setIsLocating(true);
    setErrorText('');
    try {
      const loc = await requestLocation({ allowCached: true });
      setSelectedVoter({ ...voter, ...loc });
    } catch (error) {
      setErrorText(error?.message || 'Location is required to view voter info.');
    } finally {
      setIsLocating(false);
    }
  };
  const retryLocation = async () => {
    if (!lastSelectionRef.current?.voter) return;
    try {
      const loc = await requestLocation({ allowCached: false });
      setSelectedVoter({ ...lastSelectionRef.current.voter, ...loc });
      setErrorText('');
    } catch (error) {
      setErrorText(error?.message || error?.detail || 'Unable to capture location.');
    }
  };

  const selectedWardLabel = wardItems.find((item) => item.value === form.wards)?.label || '';

  if (selectedVoter) {
    return (
      <ScreenFrame accent="blue">
        <VoterInfoScreen
          voter={selectedVoter}
          booth={{ boothId: selectedVoter.boothId, boothLabel: selectedVoter.boothLabel }}
          onBack={() => setSelectedVoter(null)}
          onSave={handleSaveVoter}
        />
      </ScreenFrame>
    );
  }

  if (view === 'list') {
    return (
      <ScreenFrame accent="blue">
        <VoterListScreen
          heading={resultMeta?.total ? `${resultMeta.total} voters found` : 'Voters List'}
          voters={voterResults}
          loading={searching || loadingMore}
          isLocating={isLocating}
          errorText={errorText}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onBack={() => setView('search')}
          onSelectVoter={handleSelectVoter}
          onRetryLocation={retryLocation}
          summary={{ total: resultMeta?.total, male: resultMeta?.male, female: resultMeta?.female }}
          mode="remote"
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="blue">
      <section className="mobile-web-card mobile-web-search-card">
        <div className="mobile-web-search-row">
          <div className="mobile-web-search-input-wrap">
            <SearchRounded className="mobile-web-search-icon" />
            <input
              className="mobile-web-input"
              placeholder="Name / EPIC / Mobile / Serial"
              value={form.searchQuery}
              onChange={(e) => handleChange('searchQuery', e.target.value)}
            />
          </div>
        </div>
        {showMoreFilters ? (
          <div className="mobile-web-form-grid">
            <SingleOptionSelect
              label="Ward"
              options={wardItems.map((item) => item.label)}
              value={selectedWardLabel}
              customValue=""
              onSelect={(option) => handleChange('wards', wardItems.find((item) => item.label === option)?.value || '')}
              onCustomValueChange={() => { }}
            />
            <input className="mobile-web-input" placeholder="Booth Number" value={form.boothNumber} onChange={(e) => handleChange('boothNumber', e.target.value)} />
            <input className="mobile-web-input" placeholder="Mobile" value={form.mobileNumber} onChange={(e) => handleChange('mobileNumber', e.target.value)} />
            <input className="mobile-web-input" placeholder="EPIC / Voter ID" value={form.epicId} onChange={(e) => handleChange('epicId', e.target.value)} />
            <input className="mobile-web-input" placeholder="Relation Name" value={form.relationName} onChange={(e) => handleChange('relationName', e.target.value)} />
            <input className="mobile-web-input" placeholder="House No" value={form.houseNumber} onChange={(e) => handleChange('houseNumber', e.target.value)} />
          </div>
        ) : null}
        <div className="mobile-web-actions">
          <button className="mobile-web-secondary-btn" onClick={() => setShowMoreFilters((value) => !value)} type="button">
            {showMoreFilters ? 'Hide Filters' : 'More Filters'}
          </button>
          <button className="mobile-web-secondary-btn" onClick={handleReset} type="button">Reset</button>
          <button className="mobile-web-primary-btn" onClick={handleSearch} disabled={searching} type="button">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {errorText ? <p className="mobile-web-error">{errorText}</p> : null}
        {successText ? <p className="mobile-web-success">{successText}</p> : null}
      </section>
    </ScreenFrame>
  );
}

function SearchBoothScreen({ assemblyCodeProp }) {
  const hasHydrated = useHasHydrated();
  const [sessionReady, setSessionReady] = useState(false);
  const assemblyCode = useMemo(() => {
    const fromProp = assemblyCodeProp ? String(assemblyCodeProp).trim() : '';
    if (fromProp) return fromProp;
    if (typeof window === 'undefined') return '';
    return getAssemblyCode() || '';
  }, [assemblyCodeProp, hasHydrated]);
  const [search, setSearch] = useState('');
  const [assemblyData, setAssemblyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [visibleBooths, setVisibleBooths] = useState(PAGE_SIZE);
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [selectedBoothPayload, setSelectedBoothPayload] = useState(null);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [selectedWardFilter, setSelectedWardFilter] = useState('ALL');
  const [boothLoading, setBoothLoading] = useState(false);
  const [boothError, setBoothError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const lastSelectionRef = useRef(null);

  const userInfo = useMemo(
    () => (sessionReady || hasHydrated ? getUserInfoFromStorage() : {}),
    [sessionReady, hasHydrated]
  );
  const accessBoothIds = useMemo(
    () => collectScopeIds(userInfo, ['boothIds', 'boothId', 'booth_id'], 'BOOTH'),
    [userInfo]
  );
  const accessWardIds = useMemo(
    () => collectScopeIds(userInfo, ['wardIds', 'wardId', 'ward_id', 'wards'], 'WARD'),
    [userInfo]
  );
  const boothCacheScopeKey = useMemo(
    () => JSON.stringify({
      user: userInfo?.userName || '',
      booths: accessBoothIds,
      wards: accessWardIds,
      assembly: assemblyCode,
    }),
    [userInfo?.userName, accessBoothIds, accessWardIds, assemblyCode]
  );

  useEffect(() => {
    let active = true;
    ensureUserProfileReady().then(() => {
      if (active) setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return undefined;
    const run = async () => {
      setLoading(true);
      setLoadError('');
      const resolvedAssembly = assemblyCode || getAssemblyCode();
      if (!resolvedAssembly) {
        setLoadError('No assembly code is configured for this user/environment.');
        setLoading(false);
        return;
      }
      try {
        const priorScope = localStorage.getItem(BOOTH_CACHE_SCOPE_KEY);
        if (priorScope && priorScope !== boothCacheScopeKey) {
          localStorage.removeItem(BOOTH_CACHE_KEY);
        }
        const response = await mobileApi.loadDataLite(resolvedAssembly);
        const snapshot = await resolveSnapshot(response);
        setAssemblyData(snapshot);
        localStorage.setItem(BOOTH_CACHE_KEY, JSON.stringify(snapshot));
        localStorage.setItem(BOOTH_CACHE_SCOPE_KEY, boothCacheScopeKey);
      } catch (error) {
        const fallbackScope = localStorage.getItem(BOOTH_CACHE_SCOPE_KEY);
        const fallback = localStorage.getItem(BOOTH_CACHE_KEY);
        if (fallback && fallbackScope === boothCacheScopeKey) {
          setAssemblyData(JSON.parse(fallback));
          setLoadError('Showing cached booth data.');
        } else {
          localStorage.removeItem(BOOTH_CACHE_KEY);
          const detail = error?.data?.error || error?.message || 'Unable to load booths';
          setLoadError(detail);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sessionReady, assemblyCode, boothCacheScopeKey]);

  const booths = useMemo(() => {
    const wards = assemblyData?.assembly?.wards || [];
    let list = wards.flatMap((ward) =>
      (ward.booths || []).map((booth) => ({
        ...booth,
        boothId: booth.boothId ?? booth.id ?? booth.booth_id,
        boothNo: booth.boothNo ?? booth.booth_no,
        boothNameEn: booth.boothNameEn ?? booth.nameEn ?? booth.booth_add_en ?? booth.pollingStationAdrEn ?? '',
        boothLabel: booth.boothNameEn ?? booth.nameEn ?? booth.booth_add_en ?? booth.pollingStationAdrEn ?? '',
        voters: booth.voters || [],
        voterStats: booth.voterStats || {},
        wardId: ward.wardId,
        wardNameEn: ward.wardNameEn,
      }))
    );
    if (accessBoothIds.length || accessWardIds.length) {
      list = list.filter((booth) => boothMatchesUserScope(booth, accessBoothIds, accessWardIds));
    }
    return list.sort((a, b) => {
      const aNum = Number.parseInt(String(a.boothNo ?? '').replace(/[^\d]/g, ''), 10);
      const bNum = Number.parseInt(String(b.boothNo ?? '').replace(/[^\d]/g, ''), 10);
      const aVal = Number.isFinite(aNum) ? aNum : Number.POSITIVE_INFINITY;
      const bVal = Number.isFinite(bNum) ? bNum : Number.POSITIVE_INFINITY;
      return aVal - bVal;
    });
  }, [assemblyData, accessBoothIds, accessWardIds]);

  const wardOptions = useMemo(() => {
    const wards = assemblyData?.assembly?.wards || [];
    const list = wards.map((w) => w.wardNameEn || `Ward ${w.wardId}`);
    if (list.length <= 1) return list;
    return ['ALL', ...list];
  }, [assemblyData]);

  useEffect(() => {
    if (!wardOptions.length) {
      if (selectedWardFilter !== 'ALL') setSelectedWardFilter('ALL');
      return;
    }
    if (!wardOptions.includes(selectedWardFilter)) {
      setSelectedWardFilter(wardOptions.includes('ALL') ? 'ALL' : wardOptions[0]);
    } else if (wardOptions.length === 1 && selectedWardFilter === 'ALL') {
      setSelectedWardFilter(wardOptions[0]);
    }
  }, [wardOptions, selectedWardFilter]);

  const filteredBooths = useMemo(() => {
    let result = booths;
    if (selectedWardFilter !== 'ALL') {
      result = result.filter((b) => b.wardNameEn === selectedWardFilter || `Ward ${b.wardId}` === selectedWardFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((item) =>
        `${item.boothNo ?? ''} ${item.boothId ?? ''} ${item.boothNameEn} ${item.wardNameEn || ''}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [booths, search, selectedWardFilter]);

  const assemblyStats = useMemo(() => {
    let totalVoters = 0;
    let maleVoters = 0;
    let femaleVoters = 0;

    // We use filteredBooths for dynamic ward-level stats
    filteredBooths.forEach(b => {
      const stats = boothStats(b);
      totalVoters += stats.total;
      maleVoters += stats.male;
      femaleVoters += stats.female;
    });

    const wardCount = new Set(filteredBooths.map(b => b.wardId)).size;

    return {
      totalBooths: filteredBooths.length,
      totalWards: wardCount,
      totalVoters,
      maleVoters,
      femaleVoters
    };
  }, [filteredBooths]);

  useEffect(() => {
    setVisibleBooths(PAGE_SIZE);
  }, [search]);

  const visibleBoothCards = filteredBooths.slice(0, visibleBooths);
  const boothSentinelRef = useInfiniteTrigger(
    visibleBoothCards.length < filteredBooths.length,
    () => setVisibleBooths((current) => Math.min(current + PAGE_SIZE, filteredBooths.length))
  );

  const openBooth = async (booth) => {
    if ((booth?.voters || []).length > 0) {
      setSelectedBooth(booth);
      setSelectedBoothPayload(booth);
      return;
    }
    setBoothLoading(true);
    setBoothError('');
    setSelectedBooth(booth);
    try {
      const boothNo = booth.boothNo ?? (booth.boothId >= 10000 ? booth.boothId % 10000 : undefined);
      const response = await mobileApi.fetchBoothVoters(booth.boothId, booth.wardId, boothNo);
      setSelectedBoothPayload(response?.data?.result || { ...booth, voters: [] });
    } catch (error) {
      setSelectedBoothPayload({ ...booth, voters: booth.voters || [] });
      setBoothError(error?.message || 'Unable to fetch booth voters. Showing cached data.');
    } finally {
      setBoothLoading(false);
    }
  };

  const handleSaveVoter = (updatedVoter) => {
    setSelectedVoter((current) => (
      current && (current.voterId === updatedVoter.voterId || current.epicNo === updatedVoter.epicNo)
        ? { ...current, ...updatedVoter, volunteerMet: true }
        : current
    ));
    setSelectedBoothPayload((current) => ({
      ...(current || {}),
      voters: (current?.voters || []).map((item) => (
        item.voterId === updatedVoter.voterId || item.epicNo === updatedVoter.epicNo
          ? { ...item, ...updatedVoter, volunteerMet: true }
          : item
      )),
    }));
  };

  const handleSelectBoothVoter = async (voter) => {
    lastSelectionRef.current = { voter };
    setIsLocating(true);
    setBoothError('');
    try {
      const loc = await requestLocation({ allowCached: true });
      setSelectedVoter({ ...voter, ...loc });
    } catch (error) {
      setBoothError(error?.message || 'Location is required to view voter info.');
    } finally {
      setIsLocating(false);
    }
  };
  const retryLocation = async () => {
    if (!lastSelectionRef.current?.voter) return;
    try {
      const loc = await requestLocation({ allowCached: false });
      setSelectedVoter({ ...lastSelectionRef.current.voter, ...loc });
      setBoothError('');
    } catch (error) {
      setBoothError(error?.message || error?.detail || 'Unable to capture location.');
    }
  };

  if (selectedVoter) {
    return (
      <ScreenFrame accent="light">
        <VoterInfoScreen
          voter={selectedVoter}
          booth={{ boothId: selectedBoothPayload?.boothId ?? selectedBooth?.boothId, boothNo: selectedBoothPayload?.boothNo ?? selectedBooth?.boothNo, boothLabel: selectedBoothPayload?.boothNameEn ?? selectedBooth?.boothLabel }}
          onBack={() => setSelectedVoter(null)}
          onSave={handleSaveVoter}
        />
      </ScreenFrame>
    );
  }

  if (selectedBooth) {
    const payload = selectedBoothPayload || { ...selectedBooth, voters: selectedBooth.voters || [], boothLabel: selectedBooth.boothLabel };
    return (
      <ScreenFrame accent="light">
        <VoterListScreen
          heading="Voters List"
          booth={{
            boothId: payload.boothId ?? selectedBooth.boothId,
            boothNo: payload.boothNo ?? selectedBooth.boothNo,
            boothLabel: payload.boothNameEn ?? selectedBooth.boothLabel,
            voters: payload.voters || [],
            voterStats: payload.voterStats || selectedBooth.voterStats || {},
          }}
          voters={payload.voters || []}
          loading={boothLoading}
          isLocating={isLocating}
          errorText={boothError}
          onBack={() => {
            setSelectedBooth(null);
            setSelectedBoothPayload(null);
            setBoothError('');
          }}
          onSelectVoter={handleSelectBoothVoter}
          onRetryLocation={retryLocation}
          mode="local"
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-search-card">
        <div className="mobile-web-search-row">
          <div className="mobile-web-search-input-wrap">
            <SearchRounded className="mobile-web-search-icon" />
            <input className="mobile-web-input" placeholder="Search booth name or booth number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="mobile-web-select-wrap">
            <SingleOptionSelect
              label="Filter by Ward"
              options={wardOptions}
              value={selectedWardFilter}
              onSelect={setSelectedWardFilter}
            />
          </div>
        </div>
      </section>

      {!loading && (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="mobile-web-card text-center py-4 bg-blue-50/50">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Wards</div>
            <div className="text-xl font-black text-blue-700">{assemblyStats.totalWards}</div>
          </div>
          <div className="mobile-web-card text-center py-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Booths</div>
            <div className="text-xl font-black text-slate-900">{assemblyStats.totalBooths}</div>
          </div>
          <div className="mobile-web-card text-center py-4 bg-slate-50/50">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Voters</div>
            <div className="text-xl font-black text-slate-900">{assemblyStats.totalVoters.toLocaleString()}</div>
          </div>
          <div className="mobile-web-card text-center py-4 bg-sky-50/50">
            <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">Male Voters</div>
            <div className="text-xl font-black text-sky-700">{assemblyStats.maleVoters.toLocaleString()}</div>
          </div>
          <div className="mobile-web-card text-center py-4 bg-pink-50/50">
            <div className="text-[10px] font-bold text-pink-600 uppercase tracking-wider mb-1">Female Voters</div>
            <div className="text-xl font-black text-pink-700">{assemblyStats.femaleVoters.toLocaleString()}</div>
          </div>
        </section>
      )}

      <section className="mobile-web-booth-grid">
        {loading ? <div className="mobile-web-empty">Loading booths...</div> : null}
        {!loading && loadError ? <div className="mobile-web-error light">{loadError}</div> : null}
        {!loading &&
          visibleBoothCards.map((booth) => {
            const stats = boothStats(booth);
            return (
              <button key={String(booth.boothId)} className="mobile-web-booth-card mobile-web-booth-button" onClick={() => openBooth(booth)} type="button">
                <h3>{formatBoothTitle(booth.boothNo ?? booth.boothId, booth.boothNameEn)}</h3>
                <div className="mobile-web-stats">
                  <span className="mobile-web-stat-pill total">Total Voters <strong>{stats.total}</strong></span>
                  <span className="mobile-web-stat-pill male">Male <strong>{stats.male}</strong></span>
                  <span className="mobile-web-stat-pill female">Female <strong>{stats.female}</strong></span>
                </div>
              </button>
            );
          })}
        {!loading && visibleBoothCards.length === 0 ? <div className="mobile-web-empty">No booths found.</div> : null}
        {visibleBoothCards.length < filteredBooths.length ? <div ref={boothSentinelRef} className="mobile-web-load-note">Loading more booths...</div> : null}
      </section>
    </ScreenFrame>
  );
}
function PromotionsScreen({ assemblyCodeProp }) {
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activatedWards, setActivatedWards] = useState([]);
  const [form, setForm] = useState({
    authorityName: '',
    electionName: '',
    assemblyLabel: '',
    wardLabel: '',
    candidateName: '',
    candidateParty: '',
    candidateWardLabel: '',
    voteDate: '13-MAY-2024',
    voteTime: '7.00AM-6.00PM',
    socialLink: '',
    boothLocationLink: '',
    enabled: false,
    bannerUrl: '',
    showLogo: true,
    channel: 'WHATSAPP',
    assemblyId: '',
  });

  const [assemblies, setAssemblies] = useState([]);

  const [userInfo, setUserInfo] = useState({});
  const [role, setRole] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const info = getUserInfoSafe();
    setUserInfo(info);
    const raw = info?.role || '';
    const r = raw.replace('ROLE_', '').toUpperCase();
    setRole(r);
    setIsAdmin(r === 'SUPER_ADMIN' || r === 'ADMIN');
  }, []);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const mapRef = useRef(null);
  const osmMapRef = useRef(null);

  const parseLatLng = (link) => {
    if (!link) return null;
    const googleQ = link.match(/[?&]q=([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)/);
    if (googleQ) return { lat: parseFloat(googleQ[1]), lng: parseFloat(googleQ[2]) };
    const osmMatch = link.match(/mlat=([-+]?\d*\.?\d+)[^&]*(?:&|&amp;)mlon=([-+]?\d*\.?\d+)/);
    if (osmMatch) return { lat: parseFloat(osmMatch[1]), lng: parseFloat(osmMatch[2]) };
    const match = link.match(/query=([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    const centerMatch = link.match(/center=([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)/);
    if (centerMatch) return { lat: parseFloat(centerMatch[1]), lng: parseFloat(centerMatch[2]) };
    const hashMatch = link.match(/#map=\d+\/([-+]?\d*\.?\d+)\/([-+]?\d*\.?\d+)/);
    if (hashMatch) return { lat: parseFloat(hashMatch[1]), lng: parseFloat(hashMatch[2]) };
    const simple = link.match(/([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)/);
    if (simple) return { lat: parseFloat(simple[1]), lng: parseFloat(simple[2]) };
    return null;
  };

  const initMap = async () => {
    if (!mapRef.current) return;
    try {
      if (osmMapRef.current) {
        destroyOsmMap(osmMapRef.current);
        osmMapRef.current = null;
      }
      const existingPos = parseLatLng(form.boothLocationLink) || { lat: 12.9716, lng: 77.5946 };
      const { map } = await buildDraggableOsmMap(mapRef.current, {
        lat: existingPos.lat,
        lng: existingPos.lng,
        zoom: 15,
        onPositionChange: (lat, lng) => {
          setForm((prev) => ({
            ...prev,
            boothLocationLink: getGoogleExternalUrl(lat, lng),
          }));
        },
      });
      osmMapRef.current = map;
    } catch (err) {
      console.warn('Map init failed:', err);
    }
  };

  useEffect(() => {
    if (selectedWard) {
      initMap();
    }
    return () => {
      if (osmMapRef.current) {
        destroyOsmMap(osmMapRef.current);
        osmMapRef.current = null;
      }
    };
  }, [selectedWard]);

  useEffect(() => {
    const asm = assemblyCodeProp || getAssemblyCode();
    if (asm) {
      setForm((prev) => ({ ...prev, assemblyId: String(asm) }));
    }
  }, [assemblyCodeProp]);

  useEffect(() => {
    if (role && isAdmin && !assemblyCodeProp) {
      mobileApi.fetchVolunteerDropdown('ASSEMBLY').then((res) => {
        const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
        const formatted = raw.map((item) => ({
          id: item.id,
          label: (item.name && !item.name.includes(String(item.id))) ? `${item.name} (${item.id})` : (item.name || `Assembly ${item.id}`)
        }));
        setAssemblies(formatted);
        if (formatted.length > 0 && !form.assemblyId) {
          const initial = getAssemblyCode();
          const match = formatted.find(a => String(a.id) === String(initial)) || formatted[0];
          setForm(prev => ({ ...prev, assemblyId: String(match.id) }));
        }
      });
    }
  }, [role, isAdmin, assemblyCodeProp, form.assemblyId]);

  const loadWardsForCurrentAssembly = async () => {
    if (!form.assemblyId) return;
    try {
      const res = await mobileApi.fetchWards(form.assemblyId);
      let list = (res || []).map((w) => {
        const id = w.wardId || w.id;
        const name = w.wardNameEn || w.name || '';
        const code = w.wardCode || w.wardNo || '';
        const label = code && name ? `${code} - ${name}` : (name || code || `Ward ${id}`);
        return { id, label };
      });

      const ids = [];
      if (Array.isArray(userInfo?.wardIds)) ids.push(...userInfo.wardIds);
      if (Array.isArray(userInfo?.wards)) ids.push(...userInfo.wards);
      if (userInfo?.wardId) ids.push(userInfo.wardId);
      if (userInfo?.ward_id) ids.push(userInfo.ward_id);
      if ((userInfo?.assignmentType || '').toUpperCase() === 'WARD' && userInfo?.assignmentId) {
        String(userInfo.assignmentId)
          .split(',')
          .map((val) => val.trim())
          .filter(Boolean)
          .forEach((val) => ids.push(val));
      }
      const accessWardIds = Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));

      if (accessWardIds.length) {
        list = list.filter(item => accessWardIds.includes(String(item.id)));
      }

      if (isAdmin) {
        setWards([{ id: 'GLOBAL', label: 'All Wards (Global)' }, ...list]);
      } else {
        setWards(list);
      }
    } catch (err) {
      setFeedback({ error: 'Failed to load wards.', success: '' });
    }
  };

  // Load activated wards for the selected assembly, filtering out any entries that lack a label (dummy/irrelevant wards)
  const loadActivatedWards = async () => {
    try {
      const res = await mobileApi.fetchActivatedWards(form.assemblyId);
      const raw = res?.data?.result || res?.result || [];
      setActivatedWards(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load activated wards');
    }
  };

  const activatedWardDisplayLabel = (aw) => {
    if (aw.wardId == null || aw.wardId === '') return aw.wardLabel || aw.wardNameEn || 'Global';
    const fromList = wards.find((w) => String(w.id) === String(aw.wardId));
    return (
      aw.wardLabel ||
      aw.wardNameEn ||
      fromList?.label ||
      (aw.wardId != null ? `Ward ${aw.wardId}` : 'Ward')
    );
  };

  useEffect(() => {
    if (form.assemblyId) loadWardsForCurrentAssembly();
    loadActivatedWards();
  }, [form.assemblyId, isAdmin]);

  const loadTemplate = async (wardId) => {
    setLoading(true);
    setFeedback({ error: '', success: '' });
    try {
      const res = await mobileApi.fetchMessageTemplate(wardId, form.channel);
      const data = res?.data?.result;
      if (data) {
        setForm(prev => ({
          ...prev,
          ...data,
          socialLink: data.socialLink || '',
          boothLocationLink: data.boothLocationLink || '',
          bannerUrl: data.bannerUrl || '',
        }));
      } else {
        setForm(prev => ({
          ...prev,
          authorityName: '',
          electionName: '',
          assemblyLabel: '',
          wardLabel: '',
          candidateName: '',
          candidateParty: '',
          candidateWardLabel: '',
          voteDate: '13-MAY-2024',
          voteTime: '7.00AM-6.00PM',
          socialLink: '',
          boothLocationLink: '',
          enabled: false,
          bannerUrl: '',
        }));
      }
    } catch (err) {
      setFeedback({ error: 'Failed to load template.', success: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWard) {
      loadTemplate(selectedWard.id);
      setSelectedFile(null);
      setPreviewUrl('');
    }
  }, [selectedWard, form.channel]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setFeedback({ error: 'Only admin can customize WhatsApp/SMS templates.', success: '' });
      return;
    }
    if (!selectedWard) {
      setFeedback({ error: 'Please select a ward first.', success: '' });
      return;
    }
    setSaving(true);
    setFeedback({ error: '', success: '' });
    try {
      let currentBannerUrl = form.bannerUrl;
      const wardIdForApi = selectedWard.id === 'GLOBAL' ? null : selectedWard.id;

      if (selectedFile) {
        setFeedback({ error: '', success: 'Uploading photo...' });
        const uploadRes = await mobileApi.uploadMessageTemplateBanner({
          wardId: wardIdForApi,
          channel: form.channel,
          file: selectedFile
        });
        currentBannerUrl = uploadRes?.data?.result?.bannerUrl;
      }

      const assemblyLabel =
        form.assemblyLabel ||
        assemblies.find((a) => String(a.id) === String(form.assemblyId))?.label ||
        `Assembly ${form.assemblyId}`;
      const wardLabel =
        selectedWard.id === 'GLOBAL'
          ? 'All Wards (Global)'
          : (form.wardLabel || selectedWard?.label || '');

      await mobileApi.saveMessageTemplate({
        ...form,
        wardId: wardIdForApi,
        bannerUrl: currentBannerUrl,
        assemblyLabel,
        wardLabel,
        enabled: form.enabled,
      });
      const channelLabel = form.channel === 'WHATSAPP' ? 'WhatsApp' : form.channel === 'SMS' ? 'SMS' : 'Print';
      setFeedback({
        error: '',
        success: form.enabled
          ? `${channelLabel} template saved for ${wardLabel || 'selected ward'}. Enable WhatsApp, SMS, and Print separately (one save per channel).`
          : `Template saved (${channelLabel} disabled for this ward).`,
      });
      setSelectedFile(null);
      // Refresh current ward list to show updated status
      loadWardsForCurrentAssembly();
      loadActivatedWards();
    } catch (err) {
      setFeedback({ error: err?.message || 'Failed to save template. (Check AWS credentials for photo)', success: '' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedWard) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card">
        <h2 className="text-xl font-bold mb-2">WhatsApp / SMS Promotions</h2>
        <p className="mobile-web-subtitle mb-6">
          Configure ward-wise message templates. WhatsApp/SMS should be enabled only after latest voter data upload.
        </p>

        {!isAdmin ? (
          <div className="mobile-web-warning">Only admin login can customize promotional message templates.</div>
        ) : null}

        <p className="text-sm text-slate-500 mb-4">
          Assembly is chosen in the <strong>Context</strong> bar at the top. Each channel (WhatsApp, SMS, Print) is saved separately with <strong>Enable</strong> checked.
        </p>

        <div className="mobile-web-form-grid mb-6">
          <div className="mobile-web-field">
            <label>Select Ward</label>
            <SingleOptionSelect
              label="Ward"
              options={wards.map(w => w.label)}
              value={selectedWard?.label || ''}
              onSelect={(label) => {
                const w = wards.find(item => item.label === label);
                if (w) setSelectedWard(w);
              }}
            />
          </div>
          <div className="mobile-web-field">
            <label>Channel</label>
            <SingleOptionSelect
              label="Channel"
              options={role === 'SUPER_ADMIN' ? ['WhatsApp', 'SMS', 'Print'] : ['WhatsApp', 'SMS']}
              value={form.channel === 'WHATSAPP' ? 'WhatsApp' : form.channel === 'SMS' ? 'SMS' : 'Print'}
              onSelect={(opt) => handleChange('channel', opt.toUpperCase())}
              disabled={!isAdmin}
            />
          </div>
        </div>

        {/* Global Master Switches */}
        {isAdmin && !selectedWard && (
          <div className="mt-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <VpnKeyOutlined />
              Assembly Master Control
            </h3>
            <p className="text-sm text-blue-700/80 mb-6">Quickly enable or disable messaging for all wards in this assembly.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-blue-200 shadow-sm hover:border-blue-400 transition-colors"
                  onClick={() => {
                    setSelectedWard({ id: 'GLOBAL', label: 'All Wards (Global)' });
                    handleChange('channel', 'WHATSAPP');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <WhatsApp className="text-green-600" />
                    <span className="font-bold">WhatsApp Global</span>
                  </div>
                  <ArrowForwardIos style={{ fontSize: 12 }} />
                </button>
                <button
                  type="button"
                  className="text-xs text-red-600 font-bold hover:underline self-end px-2"
                  onClick={async () => {
                    if (confirm('Deactivate WhatsApp GLOBALLY for EVERY single ward in this assembly?')) {
                      setSaving(true);
                      try {
                        const res = await mobileApi.deactivateAllTemplates('WHATSAPP');
                        setFeedback({ error: '', success: res?.data?.message || 'WhatsApp deactivated for all wards.' });
                        loadActivatedWards();
                        if (selectedWard) loadTemplate(selectedWard.id);
                      } catch (err) {
                        setFeedback({ error: `Failed to deactivate WhatsApp: ${err?.message || 'Server error'}`, success: '' });
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                >
                  Deactivate Global WhatsApp
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-blue-200 shadow-sm hover:border-blue-400 transition-colors"
                  onClick={() => {
                    setSelectedWard({ id: 'GLOBAL', label: 'All Wards (Global)' });
                    handleChange('channel', 'SMS');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <MessageOutlined className="text-blue-600" />
                    <span className="font-bold">SMS Global</span>
                  </div>
                  <ArrowForwardIos style={{ fontSize: 12 }} />
                </button>
                <button
                  type="button"
                  className="text-xs text-red-600 font-bold hover:underline self-end px-2"
                  onClick={async () => {
                    if (confirm('Deactivate SMS GLOBALLY for EVERY single ward in this assembly?')) {
                      setSaving(true);
                      try {
                        const res = await mobileApi.deactivateAllTemplates('SMS');
                        setFeedback({ error: '', success: res?.data?.message || 'SMS deactivated for all wards.' });
                        loadActivatedWards();
                        if (selectedWard) loadTemplate(selectedWard.id);
                      } catch (err) {
                        setFeedback({ error: `Failed to deactivate SMS: ${err?.message || 'Server error'}`, success: '' });
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                >
                  Deactivate Global SMS
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedWard ? (
          <>
            <div className="mobile-web-form-grid">
              <div className="mobile-web-field">
                <label>Authority Name</label>
                <input className="mobile-web-input" placeholder="Greater Bengaluru Authority" value={form.authorityName} onChange={e => handleChange('authorityName', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Election Name</label>
                <input className="mobile-web-input" placeholder="Election-2026" value={form.electionName} onChange={e => handleChange('electionName', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Assembly</label>
                <input className="mobile-web-input" placeholder="Assembly: 151 - KR Puram" value={form.assemblyLabel} onChange={e => handleChange('assemblyLabel', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Ward</label>
                <input className="mobile-web-input" placeholder="Ward: 2-Horamavu" value={form.wardLabel} onChange={e => handleChange('wardLabel', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Candidate Name</label>
                <input className="mobile-web-input" value={form.candidateName} onChange={e => handleChange('candidateName', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Candidate Party</label>
                <input className="mobile-web-input" value={form.candidateParty} onChange={e => handleChange('candidateParty', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Candidate Ward Label</label>
                <input className="mobile-web-input" value={form.candidateWardLabel} onChange={e => handleChange('candidateWardLabel', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Vote Date</label>
                <input className="mobile-web-input" value={form.voteDate} onChange={e => handleChange('voteDate', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Vote Time</label>
                <input className="mobile-web-input" value={form.voteTime} onChange={e => handleChange('voteTime', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field">
                <label>Social Media Link</label>
                <input className="mobile-web-input" value={form.socialLink} onChange={e => handleChange('socialLink', e.target.value)} disabled={!isAdmin} />
              </div>
              <div className="mobile-web-field" style={{ gridColumn: 'span 2' }}>
                <label>Booth Location Link (Generated from map)</label>
                <input className="mobile-web-input" value={form.boothLocationLink} onChange={e => handleChange('boothLocationLink', e.target.value)} placeholder="Drag marker on map or paste link" disabled={!isAdmin} />
              </div>
            </div>

            {selectedWard && (
              <div className="my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <label className="text-sm font-bold text-slate-700 block flex items-center gap-2">
                    <WhatsApp className="text-green-600 scale-75" />
                    {form.channel} Message
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Review the configured variables for this ward.</p>
                </div>
                <button
                  type="button"
                  className="mobile-web-secondary-btn py-2 px-4 shadow-sm"
                  onClick={() => setShowPreviewModal(true)}
                >
                  Preview Message
                </button>
              </div>
            )}

            {showPreviewModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">{form.channel} Template Preview</h3>
                    <button type="button" onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                  </div>
                  <div className="p-4 bg-white overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    {form.channel === 'PRINT' ? (
                      <PrintableVoterSlip
                        isPreview={true}
                        voter={{ name: 'Suresh Kumar', epicNo: 'EPIC123456', serialNo: '42', relationLabel: 'Father', relationName: '-' }}
                        booth={{ boothNo: '154', boothNameEn: 'Govt Higher Primary School', address: 'Main Road, Sample Layout' }}
                        template={form}
                      />
                    ) : (
                      <>
                        {form.bannerUrl && (
                          <div className="mb-4">
                            <img src={form.bannerUrl} alt="Banner Preview" className="w-full h-auto rounded-lg border border-slate-200" />
                          </div>
                        )}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm whitespace-pre-wrap font-mono text-slate-600 shadow-inner">
                          {buildWhatsAppMessage(
                            { firstMiddleNameEn: 'Suresh Kumar', epicNo: 'EPIC123456', serialNo: '42' },
                            { boothNo: '154', boothNo: '154', boothNameEn: 'Govt Higher Primary School', address: 'Main Road, Sample Layout' },
                            form
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-4 border-t border-slate-100 flex justify-end">
                    <button type="button" className="mobile-web-primary-btn" onClick={() => setShowPreviewModal(false)}>Close Preview</button>
                  </div>
                </div>
              </div>
            )}

            <div className="my-4">
              <label className="text-sm font-semibold text-slate-600 mb-2 block">Set Location on Map (Drag to position)</label>
              <div ref={mapRef} style={{ width: '100%', height: '240px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
            </div>

            <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => handleChange('enabled', e.target.checked)}
                  disabled={!isAdmin}
                  style={{ width: '20px', height: '20px' }}
                />
                <span className="text-sm font-bold text-slate-700">Enable {form.channel}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={form.showLogo}
                  onChange={(e) => handleChange('showLogo', e.target.checked)}
                  disabled={!isAdmin}
                  style={{ width: '20px', height: '20px' }}
                />
                <span className="text-sm font-bold text-slate-700">Show Candidate Logo on Print</span>
              </label>
            </div>

            {form.channel !== 'SMS' && (
              <div className="mobile-web-field mb-6">
                <label>Upload Banner / Candidate Photo</label>
                <div className="flex flex-col gap-4">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-sm" disabled={!isAdmin} />
                  {(previewUrl || form.bannerUrl) && (
                    <div className="relative w-[120px] h-[120px]">
                      <img src={previewUrl || form.bannerUrl} alt="Banner" className="w-full h-full object-cover rounded-xl border border-slate-200" />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md border-2 border-white"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl('');
                          handleChange('bannerUrl', '');
                        }}
                        title="Remove Photo"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {form.bannerUrl && form.bannerUrl.startsWith('data:') && (
                    <p className="text-[10px] text-amber-600 font-medium leading-tight">
                      Note: Image is stored in Base64 format. It will NOT be attached automatically to WhatsApp/SMS messages. 
                      You must manually attach the photo in WhatsApp after the text is pre-filled.
                    </p>
                  )}
                </div>
              </div>
            )}
            {form.channel === 'SMS' ? <p className="mobile-web-subtitle mb-4">SMS uses link/text only. Photo upload is disabled for SMS.</p> : null}

            <div className="mobile-web-actions">
              <button className="mobile-web-primary-btn" onClick={handleSave} disabled={saving || loading || !isAdmin}>
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </>
        ) : (
          <div className="mobile-web-empty">Please select a ward to configure its templates.</div>
        )}

        {feedback.error ? <p className="mobile-web-error mt-4">{feedback.error}</p> : null}
        {feedback.success ? <p className="mobile-web-success mt-4">{feedback.success}</p> : null}

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-lg font-bold mb-4">Activated Wards</h3>
          <div className="flex flex-col gap-6">
            <div>
              <h4 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                <WhatsApp style={{ fontSize: 18 }} /> WhatsApp Activated
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {activatedWards.filter(aw => aw.channel === 'WHATSAPP').length === 0 ? (
                  <div className="text-slate-400 italic">No wards activated for WhatsApp yet.</div>
                ) : (
                  activatedWards.filter(aw => aw.channel === 'WHATSAPP').map(aw => (
                      <div key={`wp-${aw.wardId}-${aw.channel}`} className="px-3 py-1.5 rounded-full border bg-green-50 border-green-200 text-green-700 font-bold">
                        {activatedWardDisplayLabel(aw)}
                      </div>
                    ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                <SmsOutlined style={{ fontSize: 18 }} /> SMS Activated
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {activatedWards.filter(aw => aw.channel === 'SMS').length === 0 ? (
                  <div className="text-slate-400 italic">No wards activated for SMS yet.</div>
                ) : (
                  activatedWards.filter(aw => aw.channel === 'SMS').map(aw => (
                      <div key={`sms-${aw.wardId}-${aw.channel}`} className="px-3 py-1.5 rounded-full border bg-blue-50 border-blue-200 text-blue-700 font-bold">
                        {activatedWardDisplayLabel(aw)}
                      </div>
                    ))
                )}
              </div>
            </div>

            {role === 'SUPER_ADMIN' && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <PrintIcon style={{ fontSize: 18 }} /> Print Activated
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {activatedWards.filter(aw => aw.channel === 'PRINT').length === 0 ? (
                    <div className="text-slate-400 italic">No wards activated for Print yet.</div>
                  ) : (
                    activatedWards.filter(aw => aw.channel === 'PRINT').map(aw => (
                        <div key={`print-${aw.wardId}-${aw.channel}`} className="px-3 py-1.5 rounded-full border bg-slate-50 border-slate-200 text-slate-700 font-bold">
                          {activatedWardDisplayLabel(aw)}
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </ScreenFrame>
  );
}

function getUserInfoSafe() { if (typeof window === 'undefined') return {}; try { return JSON.parse(localStorage.getItem('userInfo') || '{}'); } catch { return {}; } }

function normalizeAssemblyKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return String(parseInt(raw, 10));
  return raw;
}

function assemblyIdVariants(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const variants = new Set([raw, normalizeAssemblyKey(raw)]);
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      variants.add(String(n));
      variants.add(String(n).padStart(12, '0'));
    }
  }
  return [...variants];
}

function assemblyIdsMatch(a, b) {
  const setB = new Set(assemblyIdVariants(b));
  return assemblyIdVariants(a).some((key) => setB.has(key));
}

function findAssemblyOption(options, assemblyId) {
  if (!assemblyId) return null;
  return options.find((item) => (
    assemblyIdsMatch(item.value, assemblyId)
    || assemblyIdsMatch(item.id, assemblyId)
    || assemblyIdsMatch(item.code, assemblyId)
  )) || null;
}

function toSnapshotAssemblyCode(assemblyId) {
  const raw = String(assemblyId ?? '').trim();
  if (!raw) return '';
  if (/^\d{12}$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return String(n).padStart(12, '0');
  }
  return raw;
}

function isGenericAssemblyName(name, code) {
  const n = String(name || '').trim();
  if (!n) return true;
  if (/^assembly\s*\d+$/i.test(n)) return true;
  const c = String(code || '').trim();
  if (c && (n === c || n === `Assembly ${c}`)) return true;
  return false;
}

function formatAssemblyDropdownItem(item) {
  const code = item.code != null && String(item.code).trim() !== '' ? String(item.code).trim() : String(item.id);
  const rawName = (item.name || item.assemblyNameEn || item.assembly_name_en || '').trim();
  const name = isGenericAssemblyName(rawName, code) ? '' : rawName;
  const displayName = name || `Assembly ${code}`;
  return {
    value: code,
    id: String(item.id),
    code,
    name: name || displayName,
    label: name || displayName,
  };
}

function pickAssemblyLabel(option) {
  if (!option) return '';
  const code = option.code || option.value;
  const name = String(option.name || '').trim();
  if (name && !isGenericAssemblyName(name, code)) return name;
  const label = String(option.label || '').trim();
  if (label && !isGenericAssemblyName(label, code)) return label;
  return '';
}

function assemblyNameFromSnapshot(snapshot) {
  const asm = snapshot?.assembly || snapshot;
  return String(
    asm?.assemblyNameEn
    || asm?.assembly_name_en
    || snapshot?.assemblyNameEn
    || snapshot?.assembly_name_en
    || '',
  ).trim();
}

async function fetchAssemblyDisplayName(assemblyId) {
  const id = String(assemblyId || '').trim();
  if (!id) return '';

  try {
    const res = await mobileApi.resolveAssemblyName(id);
    const payload = res?.data?.result || res?.result || res?.data || {};
    const resolved = String(payload.nameEn || payload.name || '').trim();
    if (resolved && !isGenericAssemblyName(resolved, id)) return resolved;
  } catch {
    // try fallbacks below
  }

  const snapshotCodes = [...new Set([
    toSnapshotAssemblyCode(id),
    id,
    normalizeAssemblyKey(id),
  ].filter(Boolean))];

  for (const code of snapshotCodes) {
    try {
      const response = await mobileApi.loadDataLite(code);
      const snapshot = await resolveSnapshot(response);
      const name = assemblyNameFromSnapshot(snapshot);
      if (name && !isGenericAssemblyName(name, id)) return name;
    } catch {
      // try next code variant
    }
  }

  try {
    const res = await mobileApi.fetchVolunteerDropdown('ASSEMBLY');
    const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
    const formatted = raw.map((item) => formatAssemblyDropdownItem(item));
    const match = findAssemblyOption(formatted, id);
    const picked = pickAssemblyLabel(match);
    if (picked) return picked;
    const rawMatch = findAssemblyOption(raw, id);
    const directName = String(rawMatch?.name || rawMatch?.assemblyNameEn || '').trim();
    if (directName && !isGenericAssemblyName(directName, id)) return directName;
  } catch {
    // ignore
  }

  return '';
}

function AddVolunteerScreen({ assemblyCodeProp }) {
  const [form, setForm] = useState({
    firstName: '',
    phone: '',
    workingLevel: 'ASSEMBLY',
    assemblyId: '',
    wardIds: [],
    boothIds: [],
  });
  const [assemblies, setAssemblies] = useState([]);
  const [wards, setWards] = useState([]);
  const [booths, setBooths] = useState([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const pendingEditRef = useRef(null);
  const hasHydrated = useHasHydrated();
  const userInfo = useMemo(() => (hasHydrated ? getUserInfoSafe() : {}), [hasHydrated]);
  const role = userInfo?.role || 'ADMIN';
  const creatorRole = useMemo(() => {
    const r = String(role || '').replace('ROLE_', '').toUpperCase();
    const assignmentType = String(userInfo?.assignmentType || userInfo?.assignment_type || '').toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'ADMIN') return r;
    if (assignmentType === 'ASSEMBLY' || assignmentType === 'WARD') return assignmentType;
    return r;
  }, [role, userInfo]);
  const prevWorkingLevelRef = useRef(null);
  const prevAssemblyRef = useRef(null);
  const accessWardIds = useMemo(() => {
    const ids = [];
    if (Array.isArray(userInfo?.wardIds)) {
      userInfo.wardIds.forEach((id) => {
        if (id != null && String(id).trim() !== '') ids.push(String(id).trim());
      });
    }
    if (Array.isArray(userInfo?.wards)) {
      userInfo.wards.forEach((id) => {
        if (id != null && String(id).trim() !== '') ids.push(String(id).trim());
      });
    }
    const assignmentType = String(userInfo?.assignmentType || userInfo?.assignment_type || '').toUpperCase();
    if (assignmentType === 'WARD' && userInfo?.assignmentId) {
      String(userInfo.assignmentId)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => ids.push(id));
    }
    return Array.from(new Set(ids));
  }, [userInfo]);

  const [resolvedAssemblyId, setResolvedAssemblyId] = useState('');
  const [lockedAssemblyLabel, setLockedAssemblyLabel] = useState('');

  const creatorAssemblyId = useMemo(() => {
    if (resolvedAssemblyId) return resolvedAssemblyId;
    const fromList = userInfo?.assemblyIds?.[0] ?? userInfo?.assemblyId ?? userInfo?.assembly_id;
    if (fromList != null && String(fromList).trim() !== '') return String(fromList);
    if (creatorRole === 'ASSEMBLY' && userInfo?.assignmentId) {
      return String(userInfo.assignmentId).split(',')[0].trim();
    }
    return '';
  }, [userInfo, creatorRole, resolvedAssemblyId]);


  useEffect(() => {
    if (!hasHydrated || !userInfo?.token) return undefined;
    if (userInfo.wardIds?.length || userInfo.assemblyIds?.length) return undefined;
    let cancelled = false;
    mobileApi.fetchMe().then((res) => {
      if (cancelled) return;
      const updated = res?.data?.result || res?.result || res;
      if (updated && typeof window !== 'undefined') {
        const merged = { ...userInfo, ...updated };
        localStorage.setItem('userInfo', JSON.stringify(merged));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [hasHydrated, userInfo?.token]);

  // Load volunteerEdit from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('volunteerEdit');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      pendingEditRef.current = parsed;
      setForm((prev) => ({
        ...prev,
        firstName: parsed.firstName || '',
        phone: parsed.phone || '',
        workingLevel: parsed.workingLevel || 'ASSEMBLY',
        assemblyId: parsed.assemblyId || '',
        wardIds: [],
        boothIds: [],
      }));
      setIsEditing(true);
      setEditPhone(parsed.phone || '');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (pendingEditRef.current || isEditing) return;
    if (creatorRole === 'WARD' && form.workingLevel !== 'BOOTH') {
      setForm((prev) => ({ ...prev, workingLevel: 'BOOTH', wardIds: [], boothIds: [] }));
    } else if (creatorRole === 'ASSEMBLY' && form.workingLevel === 'ASSEMBLY') {
      setForm((prev) => ({ ...prev, workingLevel: 'WARD', wardIds: [], boothIds: [] }));
    }
  }, [creatorRole, isEditing, form.workingLevel]);

  useEffect(() => {
    if (!hasHydrated || pendingEditRef.current) return undefined;
    if (creatorRole !== 'WARD' && creatorRole !== 'ASSEMBLY') return undefined;

    const resolveFromWards = () => {
      if (!accessWardIds.length) return Promise.resolve(null);
      return mobileApi.fetchWards().then((res) => {
        const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || res?.wards || []);
        const wardSet = new Set(accessWardIds.map(String));
        const match = raw.find((item) => {
          const wardId = item.wardId ?? item.ward_id ?? item.id;
          return wardSet.has(String(wardId));
        });
        const asm = match?.assemblyId ?? match?.assembly_id ?? match?.assemblyNo ?? match?.assembly_no;
        return asm != null && String(asm).trim() !== '' ? String(asm) : null;
      }).catch(() => null);
    };

    let cancelled = false;

    // Ward volunteers: assembly id from their ward row (profile assemblyIds are often internal ids).
    if (creatorRole === 'WARD' && accessWardIds.length) {
      resolveFromWards().then((asm) => {
        if (!cancelled && asm) setResolvedAssemblyId(asm);
      });
      return () => { cancelled = true; };
    }

    const fromProfile = userInfo?.assemblyIds?.[0] ?? userInfo?.assemblyId ?? userInfo?.assembly_id;
    if (fromProfile != null && String(fromProfile).trim() !== '') {
      setResolvedAssemblyId(String(fromProfile));
      return () => { cancelled = true; };
    }

    if (!accessWardIds.length) return undefined;

    resolveFromWards().then((asm) => {
      if (!cancelled && asm) setResolvedAssemblyId(asm);
    });
    return () => { cancelled = true; };
  }, [hasHydrated, userInfo, creatorRole, accessWardIds]);

  useEffect(() => {
    if (!creatorAssemblyId || pendingEditRef.current) return;
    if (creatorRole === 'ASSEMBLY' || creatorRole === 'WARD') {
      setForm((prev) => (
        prev.assemblyId && String(prev.assemblyId) === String(creatorAssemblyId)
          ? prev
          : { ...prev, assemblyId: String(creatorAssemblyId) }
      ));
    }
  }, [creatorRole, creatorAssemblyId]);

  const handleChange = (key, value) => {
    const nextValue = key === 'phone' ? String(value || '').replace(/\D/g, '').slice(0, 10) : value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  };
  const handleReset = (preserveFeedback = false) => {
    const defaultLevel = creatorRole === 'WARD' ? 'BOOTH' : creatorRole === 'ASSEMBLY' ? 'WARD' : 'ASSEMBLY';
    setForm({
      firstName: '',
      phone: '',
      workingLevel: defaultLevel,
      assemblyId: (creatorRole === 'ASSEMBLY' || creatorRole === 'WARD') && creatorAssemblyId
        ? String(creatorAssemblyId)
        : '',
      wardIds: [],
      boothIds: [],
    });
    if (!preserveFeedback) setFeedback({ error: '', success: '' });
    setIsEditing(false);
    setEditPhone('');
    if (typeof window !== 'undefined') sessionStorage.removeItem('volunteerEdit');
  };

  const resolveAssignment = () => {
    if (form.workingLevel === 'ASSEMBLY') {
      if (form.boothIds.length && !form.boothIds.includes('ALL')) return { assignmentType: 'BOOTH', assignmentId: form.boothIds.join(',') };
      if (form.wardIds.length) return { assignmentType: 'WARD', assignmentId: form.wardIds.join(',') };
      if (form.assemblyId) return { assignmentType: 'ASSEMBLY', assignmentId: form.assemblyId };
    }
    if (form.workingLevel === 'WARD') {
      if (form.boothIds.length && !form.boothIds.includes('ALL')) return { assignmentType: 'BOOTH', assignmentId: form.boothIds.join(',') };
      if (form.wardIds.length) return { assignmentType: 'WARD', assignmentId: form.wardIds.join(',') };
    }
    if (form.workingLevel === 'BOOTH') {
      if (form.boothIds.length) return { assignmentType: 'BOOTH', assignmentId: form.boothIds.join(',') };
    }
    return null;
  };

  useEffect(() => {
    let active = true;
    mobileApi.fetchVolunteerDropdown('ASSEMBLY').then((res) => {
      if (!active) return;
      const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
      const formatted = raw.map((item) => formatAssemblyDropdownItem(item));
      setAssemblies(formatted);
      if (creatorRole === 'ASSEMBLY' || creatorRole === 'WARD') {
        const asmId = String(form.assemblyId || resolvedAssemblyId || creatorAssemblyId || '').trim();
        const fromList = pickAssemblyLabel(findAssemblyOption(formatted, asmId));
        if (fromList) {
          setLockedAssemblyLabel(fromList);
        } else if (asmId) {
          fetchAssemblyDisplayName(asmId).then((name) => {
            if (active && name) setLockedAssemblyLabel(name);
          });
        }
      }
    }).catch(() => setAssemblies([]));
    return () => { active = false; };
  }, [creatorRole, form.assemblyId, resolvedAssemblyId, creatorAssemblyId]);

  // When workingLevel changes by user (not from edit), reset selections
  useEffect(() => {
    if (pendingEditRef.current) return; // skip reset during edit prefill
    if (prevWorkingLevelRef.current !== null && prevWorkingLevelRef.current !== form.workingLevel) {
      const keepAssembly = (creatorRole === 'ASSEMBLY' || creatorRole === 'WARD') && creatorAssemblyId;
      setForm((prev) => ({
        ...prev,
        assemblyId: keepAssembly ? String(creatorAssemblyId) : '',
        wardIds: [],
        boothIds: [],
      }));
      setWards([]);
      setBooths([]);
      prevAssemblyRef.current = keepAssembly ? String(creatorAssemblyId) : null;
    }
    prevWorkingLevelRef.current = form.workingLevel;
  }, [form.workingLevel]);

  // Load wards when assemblyId changes
  useEffect(() => {
    if (!['ASSEMBLY', 'WARD', 'BOOTH'].includes(form.workingLevel)) return;
    if (!form.assemblyId) {
      setWards([]);
      if (!pendingEditRef.current) setForm((prev) => ({ ...prev, wardIds: [], boothIds: [] }));
      return;
    }
    if (prevAssemblyRef.current === form.assemblyId && wards.length > 0) return;
    prevAssemblyRef.current = form.assemblyId;
    mobileApi.fetchWards(form.assemblyId).then((res) => {
      const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || res?.wards || []);
      let list = raw.map((item) => {
        const id = item.wardId ?? item.ward_id ?? item.id;
        const name = item.wardNameEn ?? item.ward_name_en ?? item.wardNameLocal ?? item.ward_name_local ?? item.name_en ?? item.name ?? `Ward ${id}`;
        return { value: id, label: name };
      });

      if (accessWardIds.length) {
        list = list.filter(item => accessWardIds.includes(String(item.value)));
      }

      setWards(list);
      // Apply pending edit ward/booth selection after wards are loaded
      if (pendingEditRef.current) {
        const pending = pendingEditRef.current;
        const pendingWardIds = pending.wardIds || [];
        setForm((prev) => ({ ...prev, wardIds: pendingWardIds, boothIds: [] }));
        if (pendingWardIds.length) {
          Promise.all(pendingWardIds.map((wardId) => mobileApi.fetchBooths(null, wardId).catch(() => []))).then((responses) => {
            const merged = responses.flat().map((item) => {
              const obj = item?.data?.result || item?.result || item;
              return Array.isArray(obj) ? obj : [obj];
            }).flat().filter(Boolean).map((item) => {
              const boothNo = item.boothNo || item.booth_no || '';
              const address = item.pollingStationAdrEn || item.boothNameEn || item.booth_add_en || `Booth ${item.boothId}`;
              const bId = item.boothId ?? item.booth_id ?? item.id;
              return {
                value: bId,
                label: `${boothNo ? `${boothNo} - ` : ''}${address}`
              };
            });
            const unique = Array.from(new Map(merged.map((item) => [String(item.value), item])).values());
            setBooths(unique);
            setForm((prev) => ({ ...prev, boothIds: pending.boothIds || [] }));
            pendingEditRef.current = null; // done prefilling
          }).catch(() => { pendingEditRef.current = null; });
        } else {
          pendingEditRef.current = null;
        }
      } else if (creatorRole === 'WARD' && accessWardIds.length) {
        const validWardIds = accessWardIds.filter((id) => list.some((item) => String(item.value) === String(id)));
        if (validWardIds.length) {
          setForm((prev) => ({ ...prev, wardIds: validWardIds, boothIds: [] }));
        } else {
          setForm((prev) => ({ ...prev, wardIds: [], boothIds: [] }));
        }
      } else {
        setForm((prev) => ({ ...prev, wardIds: [], boothIds: [] }));
      }
    }).catch(() => setWards([]));
  }, [form.workingLevel, form.assemblyId, creatorRole, accessWardIds]);

  // Load booths when wardIds change (non-edit path only)
  useEffect(() => {
    if (pendingEditRef.current) return; // handled in assembly effect above
    if (!['ASSEMBLY', 'WARD', 'BOOTH'].includes(form.workingLevel)) return;
    if (!form.wardIds.length) {
      setBooths([]);
      setForm((prev) => ({ ...prev, boothIds: [] }));
      return;
    }
    Promise.all(form.wardIds.map((wardId) => mobileApi.fetchBooths(null, wardId))).then((responses) => {
      const merged = responses.map((res) => {
        const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
        return raw;
      }).flat().filter(Boolean).map((item) => {
        const boothNo = item.boothNo || item.booth_no || '';
        const address = item.pollingStationAdrEn || item.boothNameEn || item.booth_add_en || `Booth ${item.boothId}`;
        return {
          value: item.boothId,
          label: `${boothNo ? `${boothNo} - ` : ''}${address}`
        };
      });
      const unique = Array.from(new Map(merged.map((item) => [String(item.value), item])).values());
      setBooths(unique);
    }).catch(() => setBooths([]));
  }, [form.workingLevel, form.wardIds]);

  useEffect(() => {
    if (creatorRole !== 'WARD' || form.workingLevel !== 'BOOTH' || pendingEditRef.current) return;
    if (form.wardIds.length === 0 && accessWardIds.length && wards.length) {
      const validWardIds = accessWardIds.filter((id) => wards.some((w) => String(w.value) === String(id)));
      if (validWardIds.length) {
        setForm((prev) => ({ ...prev, wardIds: validWardIds }));
      }
    }
  }, [creatorRole, form.workingLevel, accessWardIds, form.wardIds.length, wards]);

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback({ error: '', success: '' });
    try {
      if (isEditing && isProtectedVolunteerLogin(form)) {
        setFeedback({
          error: 'Super Admin logins cannot be updated here. Contact a platform administrator.',
          success: '',
        });
        setSaving(false);
        return;
      }
      const assignment = resolveAssignment();
      if (!assignment) {
        setFeedback({ error: 'Please complete the assignment selection.', success: '' });
        setSaving(false);
        return;
      }
      const payload = {
        firstName: form.firstName.trim(),
        phone: (isEditing ? editPhone : form.phone).trim(),
        workingLevel: form.workingLevel,
        assemblyIds: form.assemblyId ? [Number(form.assemblyId)] : [],
        wardIds: form.wardIds.map((id) => Number(id)),
        boothIds: form.boothIds.map((id) => Number(id)),
      };
      const res = isEditing ? await mobileApi.updateVolunteer(payload) : await mobileApi.addVolunteer(payload);
      if (res?.success) {
        handleReset(true);
        setFeedback({ error: '', success: res?.message || (isEditing ? 'Volunteer updated successfully.' : 'Volunteer added successfully.') });
      } else {
        setFeedback({ error: res?.detail || res?.message || 'Unable to add volunteer.', success: '' });
      }
    } catch (error) {
      console.error('Save volunteer error:', error);
      let msg = error?.message || error?.detail || 'Unable to save volunteer.';
      if (error?.data?.error) {
        const details = Object.entries(error.data.error)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        if (details) msg = `${msg} (${details})`;
      }
      setFeedback({ error: msg, success: '' });
    } finally {
      setSaving(false);
    }
  };

  const levelOptions = useMemo(() => {
    const all = [
      { label: 'Assembly', value: 'ASSEMBLY' },
      { label: 'Ward', value: 'WARD' },
      { label: 'Booth', value: 'BOOTH' },
    ];
    if (creatorRole === 'ASSEMBLY') return all.filter((item) => item.value !== 'ASSEMBLY');
    if (creatorRole === 'WARD') return all.filter((item) => item.value === 'BOOTH');
    return all;
  }, [creatorRole]);
  const selectedLevelLabel = levelOptions.find((item) => item.value === form.workingLevel)?.label || '';
  const lockAssemblyPicker = creatorRole === 'ASSEMBLY' || creatorRole === 'WARD';
  const wardOptions = wards.map((item) => item.label);
  const boothOptions = booths.map((item) => item.label);
  const allWardLabels = wards.map((item) => String(item.value));
  const allBoothLabels = booths.map((item) => String(item.value));
  const allWardsSelected = allWardLabels.length > 0 && allWardLabels.every((id) => form.wardIds.includes(id));
  const allBoothsSelected = allBoothLabels.length > 0 && allBoothLabels.every((id) => form.boothIds.includes(id));
  const selectedWardLabels = wards.filter((item) => form.wardIds.includes(String(item.value))).map((item) => item.label);
  const selectedBoothLabels = booths.filter((item) => form.boothIds.includes(String(item.value))).map((item) => item.label);

  useEffect(() => {
    if (!lockAssemblyPicker) {
      setLockedAssemblyLabel('');
      return undefined;
    }
    const profileName = String(
      userInfo?.assemblyNameEn ?? userInfo?.assemblyName ?? userInfo?.assembly_name_en ?? '',
    ).trim();
    const asmId = String(form.assemblyId || creatorAssemblyId || resolvedAssemblyId || '').trim();
    if (!asmId) {
      setLockedAssemblyLabel('');
      return undefined;
    }
    if (profileName && !isGenericAssemblyName(profileName, asmId)) {
      setLockedAssemblyLabel(profileName);
      return undefined;
    }
    const fromListLabel = pickAssemblyLabel(findAssemblyOption(assemblies, asmId));
    if (fromListLabel) {
      setLockedAssemblyLabel(fromListLabel);
      return undefined;
    }
    let cancelled = false;
    setLockedAssemblyLabel('Loading…');
    fetchAssemblyDisplayName(asmId).then((name) => {
      if (cancelled) return;
      setLockedAssemblyLabel(name || 'Loading…');
    });
    return () => { cancelled = true; };
  }, [lockAssemblyPicker, form.assemblyId, creatorAssemblyId, resolvedAssemblyId, assemblies, userInfo]);

  const renderAssemblyField = () => (
    <div className="mobile-web-field">
      <label>Assembly</label>
      {lockAssemblyPicker ? (
        <input className="mobile-web-input" value={lockedAssemblyLabel || 'Loading…'} readOnly />
      ) : (
        <PremiumSelect
          label="Assembly"
          options={assemblies}
          value={form.assemblyId}
          onChange={(v) => handleChange('assemblyId', String(v))}
          placeholder="Select assembly"
        />
      )}
    </div>
  );
  const renderWardField = () => (
    <div className="mobile-web-field">
      <label>Ward</label>
      {creatorRole === 'WARD' && wardOptions.length <= 1 && selectedWardLabels.length ? (
        <input className="mobile-web-input" value={selectedWardLabels[0] || 'Ward'} readOnly />
      ) : (
        <MultiCheckboxSelect
          label="Ward"
          options={creatorRole === 'WARD' ? wardOptions : ['All Wards', ...wardOptions]}
          value={creatorRole === 'WARD' ? selectedWardLabels : (allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels)}
          customValue=""
          onToggle={(option) => {
            if (creatorRole !== 'WARD' && option === 'All Wards') {
              const nextIds = allWardsSelected ? [] : allWardLabels;
              handleChange('wardIds', nextIds);
              return;
            }
            const wardValue = String(wards.find((item) => item.label === option)?.value || '');
            const nextIds = selectedWardLabels.includes(option)
              ? form.wardIds.filter((id) => String(id) !== wardValue)
              : form.wardIds.concat(wardValue);
            handleChange('wardIds', nextIds.filter(Boolean));
          }}
          onCustomValueChange={() => {}}
          disabled={!form.assemblyId || (creatorRole === 'WARD' && wardOptions.length <= 1)}
        />
      )}
    </div>
  );
  const renderBoothField = () => (
    <div className="mobile-web-field">
      <label>Booth</label>
      <MultiCheckboxSelect
        label="Booth"
        options={['All Booths', ...boothOptions]}
        value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels}
        customValue=""
        onToggle={(option) => {
          if (option === 'All Booths') {
            const nextIds = allBoothsSelected ? [] : allBoothLabels;
            handleChange('boothIds', nextIds);
            return;
          }
          const boothValue = String(booths.find((item) => item.label === option)?.value || '');
          const nextIds = selectedBoothLabels.includes(option)
            ? form.boothIds.filter((id) => String(id) !== boothValue)
            : form.boothIds.concat(boothValue);
          handleChange('boothIds', nextIds.filter(Boolean));
        }}
        onCustomValueChange={() => {}}
        disabled={!form.wardIds.length}
      />
    </div>
  );

  return (
    <ScreenFrame accent="blue">
      <section className="mobile-web-card mobile-web-add-volunteer-card">
        <div className="mobile-web-stack">
          <div className="mobile-web-form-grid mobile-web-add-volunteer-grid">
            <div className="mobile-web-field">
              <label>First Name *</label>
              <input className="mobile-web-input" placeholder="First Name" value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Phone * </label>
              <input className="mobile-web-input" placeholder="Phone" value={form.phone} maxLength={10} inputMode="numeric" onChange={(e) => handleChange('phone', e.target.value)} disabled={isEditing} />
            </div>
            <div className={`mobile-web-field ${creatorRole === 'ASSEMBLY' || creatorRole === 'WARD' ? 'mobile-web-field-span-2' : ''}`}>
              <label>
                Working Level *
                {creatorRole === 'ASSEMBLY' ? (
                  <span className="mobile-web-label-hint"> (You can assign Ward or Booth volunteers only)</span>
                ) : null}
                {creatorRole === 'WARD' ? (
                  <span className="mobile-web-label-hint"> (You can assign Booth volunteers only)</span>
                ) : null}
              </label>
              <SingleOptionSelect label="Working Level" options={levelOptions.map((item) => item.label)} value={selectedLevelLabel} customValue="" onSelect={(option) => handleChange('workingLevel', levelOptions.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => { }} disabled={creatorRole === 'WARD' && levelOptions.length === 1} />
            </div>
            {['ASSEMBLY', 'WARD', 'BOOTH'].includes(form.workingLevel) ? (
              <>
                {renderAssemblyField()}
                {renderWardField()}
                {renderBoothField()}
                {!form.assemblyId && lockAssemblyPicker ? (
                  <p className="mobile-web-form-hint-row">Loading your assembly…</p>
                ) : null}
                {!form.assemblyId && !lockAssemblyPicker ? (
                  <p className="mobile-web-form-hint-row">Select an assembly to load wards.</p>
                ) : null}
                {form.assemblyId && !wardOptions.length && !lockAssemblyPicker ? (
                  <p className="mobile-web-form-hint-row">Select wards for this assembly.</p>
                ) : null}
                {form.wardIds.length === 0 && form.assemblyId ? (
                  <p className="mobile-web-form-hint-row">Select a ward to load booths.</p>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="mobile-web-actions">
            <button className="mobile-web-secondary-btn" type="button" onClick={handleReset}>Reset</button>
            <button
              className="mobile-web-primary-btn"
              type="button"
              onClick={handleSubmit}
              disabled={saving || (isEditing && isProtectedVolunteerLogin(form))}
              title={isEditing && isProtectedVolunteerLogin(form) ? 'Super Admin logins cannot be updated here' : undefined}
            >
              {saving ? (isEditing ? 'Updating...' : 'Submitting...') : (isEditing ? 'Update' : 'Submit')}
            </button>
          {isEditing && isProtectedVolunteerLogin(form) ? (
            <p className="mobile-web-form-hint-row">Super Admin logins are read-only here. Contact a platform administrator to change these accounts.</p>
          ) : null}
          </div>
          {feedback.error ? <div className="mobile-web-error">{feedback.error}</div> : null}
          {feedback.success ? <div className="mobile-web-success">{feedback.success}</div> : null}
        </div>
      </section>
    </ScreenFrame>
  );
}
function MyVolunteersScreen({ assemblyCodeProp }) {
  const [volunteers, setVolunteers] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const selectedAssembly = assemblyCodeProp || getAssemblyCode() || '';
  const [search, setSearch] = useState('');
  const [workingLevel, setWorkingLevel] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [wardLookup, setWardLookup] = useState({});
  const [boothLookup, setBoothLookup] = useState({});
  const hasHydrated = useHasHydrated();
  const userInfo = useMemo(() => (hasHydrated ? getUserInfoSafe() : {}), [hasHydrated]);
  const role = userInfo?.role || 'ADMIN';
  const managerLevel = useMemo(() => {
    const r = String(role || '').replace('ROLE_', '').toUpperCase();
    const assignmentType = String(userInfo?.assignmentType || userInfo?.assignment_type || '').toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'ADMIN') return r;
    if (assignmentType === 'ASSEMBLY' || assignmentType === 'WARD') return assignmentType;
    return r;
  }, [role, userInfo]);

  useEffect(() => {
    let active = true;
    const buildLookupsFromWards = (wards = []) => {
      const wardMap = {};
      const boothMap = {};
      wards.forEach((ward) => {
        const wardId = String(ward?.wardId ?? ward?.ward_id ?? ward?.id ?? ward?.ward_no ?? '');
        const wardLabel = ward?.wardNameEn ?? ward?.ward_name_en ?? ward?.ward_name_local ?? ward?.name ?? wardId;
        if (wardId) wardMap[wardId] = wardLabel;
      });
      if (!active) return;
      setWardLookup(wardMap);
      setBoothLookup(boothMap);
    };

    const loadLookups = async () => {
      if (typeof window === 'undefined' || !selectedAssembly) return;
      try {
        const wardsRes = await mobileApi.fetchWards(selectedAssembly);
        const wards = Array.isArray(wardsRes)
          ? wardsRes
          : Array.isArray(wardsRes?.data?.result)
            ? wardsRes.data.result
            : Array.isArray(wardsRes?.data)
              ? wardsRes.data
              : Array.isArray(wardsRes?.result)
                ? wardsRes.result
                : [];
        
        const wardMap = {};
        wards.forEach((ward) => {
          const wardId = String(ward?.wardId ?? ward?.ward_id ?? ward?.id ?? ward?.ward_no ?? '');
          const wardLabel = ward?.wardNameEn ?? ward?.ward_name_en ?? ward?.ward_name_local ?? ward?.name ?? wardId;
          if (wardId) wardMap[wardId] = wardLabel;
        });

        const boothsRes = await mobileApi.fetchPublicBooths(null, selectedAssembly);
        const publicBooths = Array.isArray(boothsRes) ? boothsRes : (boothsRes?.data?.result || boothsRes?.result || []);
        
        const boothMap = {};
        publicBooths.forEach((booth) => {
          const boothId = String(booth?.id ?? booth?.boothId ?? booth?.booth_id ?? '');
          const boothNo = booth?.boothNo ?? booth?.booth_no;
          const basicLabel = booth?.boothNameEn ?? booth?.booth_name_en ?? booth?.pollingStationAdrEn ?? booth?.polling_station_adr_en ?? booth?.booth_add_en;
          const boothLabel = (boothNo && basicLabel && !basicLabel.startsWith(String(boothNo)))
            ? `${boothNo} - ${basicLabel}`
            : (basicLabel || (boothNo ? `Booth ${boothNo}` : boothId));

          if (boothId) boothMap[boothId] = boothLabel;
          if (boothNo !== undefined && boothNo !== null && boothLabel) {
            boothMap[String(boothNo)] = boothLabel;
          }
        });

        if (!active) return;
        setWardLookup(wardMap);
        setBoothLookup(boothMap);
      } catch (err) {
        console.error('Lookup load error:', err);
      }
    };

    loadLookups();
    return () => {
      active = false;
    };
  }, [selectedAssembly]);

  useEffect(() => {
    mobileApi.fetchVolunteerDropdown('ASSEMBLY').then((res) => {
      const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
      const formatted = raw.map((item) => ({
        value: String(item.id),
        label: (item.name && !item.name.toLowerCase().includes('assembly') && !item.name.includes(String(item.id)))
          ? `${item.name} (${item.id})`
          : (item.name || `Assembly ${item.id}`),
      }));
      setAssemblies(formatted);
      if (!selectedAssembly && formatted.length > 0) {
        setSelectedAssembly(formatted[0].value);
      }
    }).catch(() => setAssemblies([]));
  }, []);

  const resolveSort = () => {
    switch (sortMode) {
      case 'name-asc':
        return { sortBy: 'firstName', direction: 'asc' };
      case 'name-desc':
        return { sortBy: 'firstName', direction: 'desc' };
      case 'oldest':
        return { sortBy: 'id', direction: 'asc' };
      case 'latest':
      default:
        return { sortBy: 'id', direction: 'desc' };
    }
  };

  const loadVolunteers = async () => {
    setLoading(true);
    setFeedback({ error: '', success: '' });
    try {
      const sortConfig = resolveSort();
      const res = await mobileApi.getVolunteerList(
        role,
        0,
        50,
        search,
        '',
        sortConfig.sortBy,
        sortConfig.direction,
        workingLevel,
        'false',
        selectedAssembly
      );
      const list = res?.content ?? [];
      setVolunteers(list);
    } catch (error) {
      setFeedback({ error: error?.message || 'Unable to load volunteers.', success: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVolunteers();
  }, [search, workingLevel, sortMode, selectedAssembly]);

  const toggleSelect = (email) => {
    setSelected((prev) => (prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]));
  };

  const handleBlock = async (email, block) => {
    setActionLoading((prev) => ({ ...prev, [`block-${email}`]: true }));
    try {
      await mobileApi.blockVolunteer({ userEmail: email, block });
      await loadVolunteers();
    } catch {
      setFeedback({ error: 'Unable to update volunteer.', success: '' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`block-${email}`]: false }));
    }
  };

  const handleDelete = async (email, del) => {
    setActionLoading((prev) => ({ ...prev, [`delete-${email}`]: true }));
    try {
      if (!window.confirm(del ? 'Restore this volunteer?' : 'Delete this volunteer?')) {
        setActionLoading((prev) => ({ ...prev, [`delete-${email}`]: false }));
        return;
      }
      await mobileApi.removeVolunteer({ userEmail: email, delete: del });
      await loadVolunteers();
      setFeedback({ error: '', success: del ? 'Volunteer deleted.' : 'Volunteer restored.' });
    } catch {
      setFeedback({ error: 'Unable to update volunteer.', success: '' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`delete-${email}`]: false }));
    }
  };

  const handleEdit = (v) => {
    if (typeof window === 'undefined') return;
    if (isProtectedVolunteerLogin(v)) {
      setFeedback({
        error: 'Super Admin logins cannot be edited here. Contact a platform administrator.',
        success: '',
      });
      return;
    }
    const assignmentType = (v.workingLevel || v.assignmentType || 'ASSEMBLY').toUpperCase();
    const assignmentIds = String(v.assignmentId || '').split(',').map((val) => val.trim()).filter(Boolean);
    const payload = {
      firstName: v.firstName || v.userName || '',
      phone: v.phone || '',
      workingLevel: assignmentType,
      assemblyId: (v.assemblyIds && v.assemblyIds[0]) ? String(v.assemblyIds[0]) : (v.assemblyId ? String(v.assemblyId) : (v.assembly_id ? String(v.assembly_id) : '')),
      wardIds: (v.wardIds && v.wardIds.length)
        ? v.wardIds.map((id) => String(id))
        : (assignmentType === 'WARD' ? assignmentIds : []),
      boothIds: (v.boothIds && v.boothIds.length)
        ? v.boothIds.map((id) => String(id))
        : (assignmentType === 'BOOTH' ? assignmentIds : []),
    };
    sessionStorage.setItem('volunteerEdit', JSON.stringify(payload));
    window.location.href = '/ui/mobile/add-volunteer';
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    setActionLoading((prev) => ({ ...prev, bulkDelete: true }));
    try {
      await mobileApi.bulkRemoveVolunteer({ userEmails: selected, action: true });
      setSelected([]);
      await loadVolunteers();
    } catch {
      setFeedback({ error: 'Unable to delete volunteers.', success: '' });
    } finally {
      setActionLoading((prev) => ({ ...prev, bulkDelete: false }));
    }
  };

  const handleBulkBlock = async () => {
    if (selected.length === 0) return;
    setActionLoading((prev) => ({ ...prev, bulkBlock: true }));
    try {
      await mobileApi.bulkBlockVolunteer({ userEmails: selected, action: true });
      setSelected([]);
      await loadVolunteers();
    } catch {
      setFeedback({ error: 'Unable to block volunteers.', success: '' });
    } finally {
      setActionLoading((prev) => ({ ...prev, bulkBlock: false }));
    }
  };

  const levelOptions = useMemo(() => {
    const all = [
      { label: 'All Levels', value: '' },
      { label: 'Assembly', value: 'ASSEMBLY' },
      { label: 'Ward', value: 'WARD' },
      { label: 'Booth', value: 'BOOTH' },
    ];
    if (managerLevel === 'WARD') return all.filter((item) => item.value === '' || item.value === 'BOOTH');
    if (managerLevel === 'ASSEMBLY') return all.filter((item) => item.value !== 'ASSEMBLY');
    return all;
  }, [managerLevel]);
  const selectedLevelLabel = levelOptions.find((item) => item.value === workingLevel)?.label || '';
  const sortOptions = [
    { label: 'Latest Created', value: 'latest' },
    { label: 'Oldest Created', value: 'oldest' },
    { label: 'Name A-Z', value: 'name-asc' },
    { label: 'Name Z-A', value: 'name-desc' },
  ];
  const selectedSortLabel = sortOptions.find((item) => item.value === sortMode)?.label || '';

  const isVolunteerDeleted = (v) => v.deleted === true || v.deleted === 'true' || v.deleted === 1;
  const visibleVolunteers = volunteers.filter((v) => !isVolunteerDeleted(v));
  const stats = visibleVolunteers.reduce(
    (acc, v) => {
      const blocked = v.blocked === true || v.blocked === 'true' || v.blocked === 1;
      acc.total += 1;
      if (blocked) acc.blocked += 1;
      else acc.active += 1;
      return acc;
    },
    { total: 0, active: 0, blocked: 0 }
  );

  const renderDropdownList = (items, placeholder) => {
    if (!items || items.length === 0) return <strong>{placeholder || '-'}</strong>;
    const formatName = (name) => name.length > 25 ? name.substring(0, 25) + '...' : name;
    if (items.length === 1) return <strong title={items[0]} className="cursor-help">{formatName(items[0])}</strong>;
    return (
      <div className="relative group inline-block">
        <strong className="cursor-help text-blue-700 decoration-dotted underline underline-offset-2 break-all sm:break-normal">
          {formatName(items[0])} <span className="text-gray-500 font-medium text-xs ml-1 whitespace-nowrap">(+ {items.length - 1} more)</span>
        </strong>
        <div className="hidden group-hover:block absolute z-50 left-0 top-full mt-1 p-3 bg-white rounded-lg shadow-xl border border-gray-200 text-sm max-h-48 overflow-y-auto w-max min-w-[200px] max-w-xs md:max-w-md">
          <ul className="list-disc pl-4 whitespace-normal text-gray-700 m-0">
            {items.map((item, idx) => (
              <li key={idx} className="py-1 border-b border-gray-50 last:border-0">{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-volunteer-shell">
        <div className="mobile-web-stack">
          <div className="mobile-web-volunteer-toolbar">
            <div className="mobile-web-form-grid">
              <div className="mobile-web-field">
                <label>Search</label>
                <input className="mobile-web-input" placeholder="Search by name / phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="mobile-web-field">
                <label>Working Level</label>
                <SingleOptionSelect label="Working Level" options={levelOptions.map((item) => item.label)} value={selectedLevelLabel} customValue="" onSelect={(option) => setWorkingLevel(levelOptions.find((item) => item.label === option)?.value ?? '')} onCustomValueChange={() => { }} />
              </div>
              <div className="mobile-web-field">
                <label>Sort By</label>
                <SingleOptionSelect label="Sort By" options={sortOptions.map((item) => item.label)} value={selectedSortLabel} customValue="" onSelect={(option) => setSortMode(sortOptions.find((item) => item.label === option)?.value ?? 'latest')} onCustomValueChange={() => { }} />
              </div>
            </div>
            <div className="mobile-web-volunteer-stats">
              <div className="mobile-web-volunteer-pill total">Total <strong>{stats.total}</strong></div>
              <div className="mobile-web-volunteer-pill active">Active <strong>{stats.active}</strong></div>
              <div className="mobile-web-volunteer-pill blocked">Blocked <strong>{stats.blocked}</strong></div>
            </div>
          </div>

          {loading ? <div className="mobile-web-empty">Loading volunteers...</div> : null}
          {!loading && visibleVolunteers.length === 0 ? <div className="mobile-web-empty">No volunteers found.</div> : null}
          {!loading && visibleVolunteers.length > 0 ? (
            <div className="mobile-web-stack">
              {visibleVolunteers.map((v) => {
                const blocked = v.blocked === true || v.blocked === 'true' || v.blocked === 1;
                const name = `${v.firstName || ''} ${v.lastName || ''}`.trim() || v.userName || 'Volunteer';
                const levelLabel = (v.assignmentType || v.workingLevel || '-').toUpperCase();
                const statusLabel = blocked ? 'Blocked' : 'Active';
                const assignmentType = String(v.assignmentType || v.workingLevel || '').toUpperCase();
                const assignmentIds = String(v.assignmentId || '')
                  .split(',')
                  .map((val) => val.trim())
                  .filter(Boolean);
                const wardIds = (v.wardIds && v.wardIds.length)
                  ? v.wardIds.map((id) => String(id))
                  : (assignmentType === 'WARD' ? assignmentIds : []);
                const boothIds = (v.boothIds && v.boothIds.length)
                  ? v.boothIds.map((id) => String(id))
                  : (assignmentType === 'BOOTH' ? assignmentIds : []);
                const wardLabels = (Array.isArray(v.wardNames) && v.wardNames.length)
                  ? v.wardNames
                  : wardIds.map((id) => wardLookup[String(id)] || `Ward ${id}`).filter(Boolean);
                const boothLabels = (Array.isArray(v.boothNames) && v.boothNames.length)
                  ? v.boothNames
                  : boothIds.map((id) => boothLookup[String(id)] || `Booth ${id}`).filter(Boolean);
                return (
                  <div key={v.userName || v.phone || name} className="mobile-web-volunteer-card" style={{ opacity: blocked ? 0.5 : 1 }}>
                    <div className="mobile-web-volunteer-head">
                      <div className="mobile-web-volunteer-avatar">{name.slice(0, 1).toUpperCase()}</div>
                      <div className="mobile-web-volunteer-meta">
                        <h3>{name}</h3>
                        <div className="mobile-web-volunteer-tags">
                          <span className="mobile-web-volunteer-tag level">{levelLabel}</span>
                          <span className={`mobile-web-volunteer-tag status ${statusLabel.toLowerCase()}`}>{statusLabel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mobile-web-volunteer-details-row">
                      <div className="mobile-web-volunteer-checkbox">
                        <input
                          type="checkbox"
                          checked={selected.includes(v.userName)}
                          onChange={() => toggleSelect(v.userName)}
                        />
                      </div>
                      <div className="mobile-web-volunteer-inline">
                        <div>
                          <span>Phone : </span>
                          <strong>{v.phone || '-'}</strong>
                        </div>
                        <div>
                          <span>User ID : </span>
                          <strong>{v.userName || '-'}</strong>
                        </div>
                        <div>
                          <span>Wards : </span>
                          {renderDropdownList(wardLabels, '-')}
                        </div>
                        <div>
                          <span>Booths : </span>
                          {renderDropdownList(boothLabels, '-')}
                        </div>
                      </div>
                      <div className="mobile-web-volunteer-inline-actions">
                        {!isProtectedVolunteerLogin(v) ? (
                          <button
                            type="button"
                            onClick={() => handleEdit(v)}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                          >
                            Edit
                          </button>
                        ) : (
                          <span
                            className="px-4 py-2 text-sm font-medium text-slate-500 rounded-lg border border-slate-200 bg-slate-50 cursor-not-allowed"
                            title="Super Admin logins cannot be edited"
                          >
                            Edit disabled
                          </span>
                        )}
                        {/* <button className="mobile-web-secondary-btn" type="button" onClick={() => handleDelete(v.userName, !deleted)} disabled={actionLoading[`delete-${v.userName}`]}>
                          {actionLoading[`delete-${v.userName}`] ? <span className="mobile-web-spinner" /> : null}
                          {deleted ? 'Undelete' : 'Delete'}
                        </button> */}
                        <button
                          type="button"
                          onClick={() => handleDelete(v.userName, false)}
                          disabled={actionLoading[`delete-${v.userName}`]}
                          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition bg-gray-600 hover:bg-gray-700 active:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading[`delete-${v.userName}`] && (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                          )}
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBlock(v.userName, !blocked)}
                          disabled={actionLoading[`block-${v.userName}`]}
                          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition
                              ${blocked
                              ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
                              : "bg-red-600 hover:bg-red-700 active:bg-red-800"}
                              disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {actionLoading[`block-${v.userName}`] && (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                          )}
                          {blocked ? "Unblock" : "Block"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex gap-3">
            {/* Delete Selected (Gray) */}
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selected.length === 0 || actionLoading.bulkDelete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading.bulkDelete && (
                <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></span>
              )}
              Delete Selected
            </button>

            {/* Block Selected (Red) */}
            <button
              type="button"
              onClick={handleBulkBlock}
              disabled={selected.length === 0 || actionLoading.bulkBlock}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 active:bg-red-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading.bulkBlock && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              )}
              Block Selected
            </button>
          </div>

          {feedback.error ? <p className="mobile-web-error">{feedback.error}</p> : null}
          {feedback.success ? <p className="mobile-web-success">{feedback.success}</p> : null}
        </div>
      </section>
    </ScreenFrame>
  );
}

function VotersFamilyScreen({ assemblyCodeProp }) {
  const [familyName, setFamilyName] = useState('');
  const [roadName, setRoadName] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [familyNumber, setFamilyNumber] = useState('');
  const [tagLeader, setTagLeader] = useState('');
  const [familyAvailability, setFamilyAvailability] = useState('Available');
  const [memberQuery, setMemberQuery] = useState('');
  const [relationQuery, setRelationQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [economicStatus, setEconomicStatus] = useState('NA');
  const [headOfFamily, setHeadOfFamily] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [familyNature, setFamilyNature] = useState('NA');
  const [familyPoints, setFamilyPoints] = useState('5');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [hasAssociation, setHasAssociation] = useState(false);
  const [associationName, setAssociationName] = useState('');
  const [associationHeadName, setAssociationHeadName] = useState('');
  const [associationHeadPhone, setAssociationHeadPhone] = useState('');
  const [familyNameSuggestions, setFamilyNameSuggestions] = useState([]);
  const [roadSuggestions, setRoadSuggestions] = useState([]);
  const [leaderSuggestions, setLeaderSuggestions] = useState([]);
  const [buildingSuggestions, setBuildingSuggestions] = useState([]);
  const [buildingNumberSuggestions, setBuildingNumberSuggestions] = useState([]);
  const [flatSuggestions, setFlatSuggestions] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [associationSuggestions, setAssociationSuggestions] = useState([]);
  const [associationHeadSuggestions, setAssociationHeadSuggestions] = useState([]);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const lastMemberSelectionRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [location, setLocation] = useState(null);
  const [families, setFamilies] = useState([]);
  const searchTimerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [wardItems, setWardItems] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [boothItems, setBoothItems] = useState([]);
  const [pendingAvailabilityFilter, setPendingAvailabilityFilter] = useState(() => [...FAMILY_AVAILABILITY_OPTIONS]);
  const [analysisAvailabilityFilter, setAnalysisAvailabilityFilter] = useState(() => [...FAMILY_AVAILABILITY_OPTIONS]);
  const [mapAvailabilityFilter, setMapAvailabilityFilter] = useState(() => [...FAMILY_AVAILABILITY_OPTIONS]);
  const [analysisRows, setAnalysisRows] = useState([]);
  const [analysisFields, setAnalysisFields] = useState(FAMILY_ANALYSIS_AVAILABILITY_KEYS);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisViewMode, setAnalysisViewMode] = useState('agent');
  const [analysisSortMode, setAnalysisSortMode] = useState('name-asc');
  const [expandedDetailFamilyId, setExpandedDetailFamilyId] = useState(null);
  const [familyDetailRows, setFamilyDetailRows] = useState([]);
  const [familyDetailFields, setFamilyDetailFields] = useState([]);
  const [familyDetailLoading, setFamilyDetailLoading] = useState(false);
  const [familyDetailError, setFamilyDetailError] = useState('');
  const [familyDetailFrom, setFamilyDetailFrom] = useState('');
  const [familyDetailTo, setFamilyDetailTo] = useState('');
  const [analysisVisibleCount, setAnalysisVisibleCount] = useState(FAMILY_ANALYSIS_LAZY_STEP);
  const [pendingListVisibleCount, setPendingListVisibleCount] = useState(PENDING_FAMILY_LIST_LAZY_STEP);
  const [familyDataRefreshToken, setFamilyDataRefreshToken] = useState(0);
  const [familyDetailPage, setFamilyDetailPage] = useState(0);
  const [familyDetailHasMore, setFamilyDetailHasMore] = useState(false);
  const [familyDetailLoadingMore, setFamilyDetailLoadingMore] = useState(false);
  const [familyDetailTotal, setFamilyDetailTotal] = useState(0);
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const [editingFamilyMeta, setEditingFamilyMeta] = useState(null);
  const [editFamilyLoading, setEditFamilyLoading] = useState(false);
  const [editFamilySourceTab, setEditFamilySourceTab] = useState('PENDING_MAP');
  const userInfo = useMemo(() => (mounted ? getUserInfoSafe() : {}), [mounted]);

  const familyAvailabilitySelectOptions = useMemo(
    () => FAMILY_AVAILABILITY_OPTIONS.map((item) => ({
      value: item,
      label: formatFamilyAvailabilityLabel(item),
    })),
    [],
  );

  const accessWardIds = useMemo(() => {
    const ids = [];
    if (Array.isArray(userInfo?.wardIds)) ids.push(...userInfo.wardIds);
    if (Array.isArray(userInfo?.wards)) ids.push(...userInfo.wards);
    if (userInfo?.wardId) ids.push(userInfo.wardId);
    if (userInfo?.ward_id) ids.push(userInfo.ward_id);
    if ((userInfo?.assignmentType || '').toUpperCase() === 'WARD' && userInfo?.assignmentId) {
      String(userInfo.assignmentId)
        .split(',')
        .map((val) => val.trim())
        .filter(Boolean)
        .forEach((val) => ids.push(val));
    }
    return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
  }, [userInfo]);

  const role = useMemo(() => String(userInfo?.role || '').replace('ROLE_', '').toUpperCase(), [userInfo]);

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdminUser = ['SUPER_ADMIN', 'ADMIN'].includes(role);
  const canViewFamiliesList = ['SUPER_ADMIN', 'ADMIN', 'ASSEMBLY', 'WARD', 'BOOTH'].includes(role);
  // Assembly / Ward volunteers; admins with assembly context in premium console can view maps too.
  const canViewFamilyMapTab =
    ['ASSEMBLY', 'WARD'].includes(role) ||
    (Boolean(assemblyCodeProp) && isAdminUser);

  const canViewFamilyMapMemberDetails = canViewFullFamilySensitiveData(role);

  const familySectionTabs = useMemo(() => {
    const tabs = [
      { id: 'NEW', label: 'New Family' },
      { id: 'PENDING_MAP', label: 'Pending Family' },
    ];
    if (canViewFamiliesList) tabs.push({ id: 'LIST', label: 'Family Analysis - Table' });
    if (canViewFamilyMapTab) tabs.push({ id: 'MAP', label: 'Family Analysis - Map' });
    return tabs;
  }, [canViewFamiliesList, canViewFamilyMapTab]);

  const familyTabIds = useMemo(() => familySectionTabs.map((tab) => tab.id), [familySectionTabs]);
  const familySubtabKey = useMemo(
    () => subtabStorageKey('voters-family', assemblyCodeProp || 'default'),
    [assemblyCodeProp],
  );
  const [activeTab, setActiveTab] = usePersistedSubtab(familySubtabKey, 'NEW', familyTabIds);

  const isFamilyEditMode = Boolean(editingFamilyId) && activeTab === 'NEW';

  const canEditFamilyRecord = role === 'BOOTH';
  const canViewFullFamilyData = canViewFullFamilySensitiveData(role);
  const maskAvailableSensitive = !canViewFullFamilyData;

  const shouldMaskAvailableInEdit = isFamilyEditMode
    && shouldMaskAvailableFamilyForRole(role, familyAvailability);

  const FAMILY_EDIT_DENIED_MSG = 'Access denied. Editable by booth level users only.';
  const FAMILY_VIEW_DENIED_MSG = 'Voter details are hidden for Available families to protect data.';

  const handleFamilyEditBlocked = useCallback(() => {
    setError(FAMILY_EDIT_DENIED_MSG);
    setSuccess('');
  }, []);

  const tryOpenFamilyEdit = useCallback((familyId, sourceTab = 'PENDING_MAP') => {
    if (!canEditFamilyRecord) {
      handleFamilyEditBlocked();
      return;
    }
    openFamilyEditRef.current?.(familyId, sourceTab);
  }, [canEditFamilyRecord, handleFamilyEditBlocked]);

  const selectedWard = useMemo(() => {
    if (selectedWardId) {
      return wardItems.find((w) => String(w.value) === String(selectedWardId)) || null;
    }
    // Only New Family defaults to first ward; map/analysis tabs honour "All Wards".
    if (activeTab === 'NEW') {
      return wardItems[0] || null;
    }
    return null;
  }, [wardItems, selectedWardId, activeTab]);

  const mapWardCode = selectedWardId ? selectedWard?.wardCode : undefined;

  const familyWardSelectOptions = useMemo(
    () => [{ value: '', label: 'All Wards' }, ...wardItems],
    [wardItems]
  );

  const newFamilyWardSelectOptions = useMemo(() => {
    const base = wardItems.map((ward) => ({ value: ward.value, label: ward.label }));
    if (!editingFamilyId || !editingFamilyMeta?.wardId) return base;
    const wardIdStr = String(editingFamilyMeta.wardId);
    if (base.some((item) => item.value === wardIdStr)) return base;
    const fromList = wardItems.find((w) => w.value === wardIdStr);
    const label = fromList?.label
      || editingFamilyMeta.wardLabel
      || (editingFamilyMeta.wardCode ? `Ward ${editingFamilyMeta.wardCode}` : `Ward ${wardIdStr}`);
    return [{ value: wardIdStr, label }, ...base];
  }, [wardItems, editingFamilyId, editingFamilyMeta]);

  const effectiveAnalysisWardId =
    selectedWardId !== '' && selectedWardId != null ? selectedWardId : undefined;

  const assemblyCodeForFamily = useMemo(
    () => assemblyCodeProp || (mounted ? getAssemblyCode() : ''),
    [assemblyCodeProp, mounted]
  );

  const wardNumberPrefix = useMemo(
    () => getFamilyNumberPrefix(selectedWard, assemblyCodeForFamily),
    [selectedWard, assemblyCodeForFamily]
  );

  const wardFamilies = useMemo(
    () => familiesForNextNumber(families, selectedWard?.value, selectedWard?.wardCode, wardNumberPrefix),
    [families, selectedWard, wardNumberPrefix]
  );

  const headOfFamilyOptions = useMemo(
    () => [
      { value: '', label: 'Pick head of family' },
      ...members.map((member) => ({
        value: member.id,
        label: shouldMaskAvailableInEdit
          ? `${maskMemberNameForDisplay(role, familyAvailability, member.name)} · ${maskMemberEpicForDisplay(role, familyAvailability, member.epic)}`
          : (member.name || member.epic || 'Member'),
      })),
    ],
    [members, shouldMaskAvailableInEdit, role, familyAvailability]
  );

  const familyPointSelectOptions = useMemo(
    () => FAMILY_POINT_OPTIONS.map((item) => ({ value: item, label: item })),
    []
  );

  const loadSuggestions = async () => {
    try {
      const empty = { data: { result: [] } };
      const [
        familyRes,
        roadRes,
        leaderRes,
        bRes,
        bNumRes,
        flatRes,
        addrRes,
        aRes,
        aHeadRes,
      ] = await Promise.all([
        mobileApi.fetchFamilySuggestions('family').catch(() => empty),
        mobileApi.fetchFamilySuggestions('road').catch(() => empty),
        mobileApi.fetchFamilySuggestions('leader').catch(() => empty),
        mobileApi.fetchFamilySuggestions('building').catch(() => empty),
        mobileApi.fetchFamilySuggestions('buildingnumber').catch(() => empty),
        mobileApi.fetchFamilySuggestions('flat').catch(() => empty),
        mobileApi.fetchFamilySuggestions('address').catch(() => empty),
        mobileApi.fetchFamilySuggestions('association').catch(() => empty),
        mobileApi.fetchFamilySuggestions('associationhead').catch(() => empty),
      ]);
      const pick = (res) => res?.data?.result || res?.result || [];
      setFamilyNameSuggestions(pick(familyRes));
      setRoadSuggestions(pick(roadRes));
      setLeaderSuggestions(pick(leaderRes));
      setBuildingSuggestions(pick(bRes));
      setBuildingNumberSuggestions(pick(bNumRes));
      setFlatSuggestions(pick(flatRes));
      setAddressSuggestions(pick(addrRes));
      setAssociationSuggestions(pick(aRes));
      setAssociationHeadSuggestions(pick(aHeadRes));
    } catch {
      setFamilyNameSuggestions([]);
      setRoadSuggestions([]);
      setLeaderSuggestions([]);
      setBuildingSuggestions([]);
      setBuildingNumberSuggestions([]);
      setFlatSuggestions([]);
      setAddressSuggestions([]);
      setAssociationSuggestions([]);
      setAssociationHeadSuggestions([]);
    }
  };

  useEffect(() => {
    if (!wardNumberPrefix) {
      setFamilyNumber('');
      return;
    }
    setFamilyNumber(getNextFamilyNumber(wardFamilies, wardNumberPrefix));
  }, [wardFamilies, wardNumberPrefix, selectedWardId]);

  useEffect(() => {
    if (!mounted || !assemblyCodeProp) return undefined;
    let active = true;
    mobileApi.fetchWards(assemblyCodeProp).then((res) => {
      if (!active) return;
      const wards = Array.isArray(res)
        ? res
        : Array.isArray(res?.data?.result)
          ? res.data.result
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.result)
              ? res.result
              : [];
      const list = (wards || [])
        .map((ward, index) => {
          const id = ward?.wardId ?? ward?.ward_id ?? ward?.id ?? index + 1;
          const name = ward?.wardNameEn ?? ward?.ward_name_en ?? ward?.name_en ?? ward?.name ?? '';
          const wardCode = parseWardCodeFromWardRecord({ ...ward, label: name });
          return {
            value: String(id),
            label: name || `Ward ${wardCode || id}`,
            wardCode,
          };
        })
        .filter((item) => item.value);
      const filtered = accessWardIds.length
        ? list.filter((item) => accessWardIds.includes(item.value))
        : list;
      setWardItems(filtered);
    }).catch(() => {
      if (active) setWardItems([]);
    });
    return () => { active = false; };
  }, [mounted, assemblyCodeProp, accessWardIds.length]);

  useEffect(() => {
    if (!mounted) return;
    const wardIdForFetch =
      activeTab === 'NEW'
        ? (selectedWardId || wardItems[0]?.value)
        : (selectedWardId || undefined);
    if (!wardIdForFetch && activeTab === 'NEW') {
      setFamilies([]);
      return undefined;
    }
    if (activeTab !== 'NEW' && activeTab !== 'PENDING_MAP' && activeTab !== 'LIST' && activeTab !== 'MAP') {
      return undefined;
    }
    let cancelled = false;
    mobileApi.fetchAllFamilies(undefined, undefined, wardIdForFetch, assemblyCodeForFamily || undefined)
      .then((all) => {
        if (!cancelled) setFamilies(sortFamiliesByNumber(all));
      })
      .catch(() => {
        if (!cancelled) setFamilies([]);
      });
    return () => { cancelled = true; };
  }, [mounted, selectedWardId, wardItems, activeTab, assemblyCodeForFamily]);

  useEffect(() => {
    if (!wardItems.length) return;
    if (!selectedWardId && !editingFamilyId && !editFamilyLoading) {
      if (activeTab === 'NEW' || activeTab === 'LIST' || activeTab === 'MAP' || activeTab === 'PENDING_MAP') {
        setSelectedWardId(wardItems[0].value);
      }
    }
  }, [activeTab, wardItems, selectedWardId, editingFamilyId, editFamilyLoading]);

  useEffect(() => {
    setMounted(true);
    loadSuggestions();
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  const resetNewFamilyForm = () => {
    setEditingFamilyId(null);
    setEditingFamilyMeta(null);
    setFamilyName('');
    setRoadName('');
    setBuildingNumber('');
    setBuildingName('');
    setFlatNumber('');
    setFamilyNumber('');
    setTagLeader('');
    setFamilyAvailability('Available');
    setMembers([]);
    setHeadOfFamily('');
    setHeadPhone('');
    setEconomicStatus('NA');
    setFamilyNature('NA');
    setFamilyPoints('5');
    setBuildingAddress('');
    setHasAssociation(false);
    setAssociationName('');
    setAssociationHeadName('');
    setAssociationHeadPhone('');
    setLocation(null);
    setMemberQuery('');
    setRelationQuery('');
    setMemberSuggestions([]);
    setShowSuggestions(false);
    setError('');
    setSuccess('');
  };

  const handleFamilySubtabChange = useCallback((tabId) => {
    if (tabId === 'NEW' && activeTab === 'NEW' && editingFamilyId) {
      resetNewFamilyForm();
      if (wardItems[0]?.value) setSelectedWardId(wardItems[0].value);
      return;
    }
    if (tabId !== 'NEW' && editingFamilyId) {
      resetNewFamilyForm();
    }
    setActiveTab(tabId);
  }, [activeTab, editingFamilyId, setActiveTab, wardItems]);

  useEffect(() => {
    if (activeTab !== 'NEW' && editingFamilyId) {
      resetNewFamilyForm();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!mounted || !assemblyCodeProp) return undefined;
    if (activeTab !== 'NEW' && !editingFamilyId) return undefined;
    const wardId = selectedWardId || wardItems[0]?.value || '';
    if (!wardId) {
      setBoothItems([{ value: '', label: 'All Booths' }]);
      return undefined;
    }
    let active = true;
    mobileApi.fetchBooths(assemblyCodeProp, wardId).then((res) => {
      if (!active) return;
      const booths = Array.isArray(res) ? res : (res?.data?.result || res?.result || res?.booths || []);
      const list = (booths || [])
        .map((booth) => ({
          value: String(booth?.boothId ?? booth?.booth_id ?? booth?.id ?? ''),
          label: booth?.boothNo ?? booth?.booth_no ?? booth?.label ?? `Booth ${booth?.boothId ?? booth?.id ?? ''}`,
        }))
        .filter((item) => item.value);
      setBoothItems([{ value: '', label: 'All Booths' }, ...list]);
    }).catch(() => {
      if (active) setBoothItems([{ value: '', label: 'All Booths' }]);
    });
    return () => { active = false; };
  }, [mounted, assemblyCodeProp, selectedWardId, wardItems, activeTab, editingFamilyId]);

  const loadFamilyAnalysis = async () => {
    setAnalysisLoading(true);
    setError('');
    try {
      const res = await mobileApi.fetchFamilyAnalysis(
        effectiveAnalysisWardId,
        undefined,
        analysisViewMode,
        familyDetailFrom || undefined,
        familyDetailTo || undefined,
        assemblyCodeForFamily || undefined,
      );
      const payload = res?.data?.result ?? res?.result ?? res;
      setAnalysisFields(payload?.fields || FAMILY_ANALYSIS_AVAILABILITY_KEYS);
      setAnalysisRows(Array.isArray(payload?.rows) ? payload.rows : []);
      setAnalysisVisibleCount(FAMILY_ANALYSIS_LAZY_STEP);
    } catch (err) {
      console.error('Failed to load family analysis:', err);
      setAnalysisRows([]);
      setError('Failed to load family analysis.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const FAMILY_DETAIL_SUMMARY_KEYS = [
    'serialNumber',
    'familyName',
    'boothNo',
    'roadName',
    'familyNumber',
    'flatNumber',
    'headName',
    'headEpicNo',
    'memberCount',
    'familyAvailability',
    'updatedByName',
    'updatedByPhone',
  ];

  const normalizeDetailMembers = (members) =>
    (Array.isArray(members) ? members : []).map(normalizeFamilyMapMember);

  const mapFamilyDtoToDetailRow = (family, index) => ({
    familyId: family.familyId,
    serialNumber: index + 1,
    familyName: family.familyName,
    members: normalizeDetailMembers(family.members),
    boothNo: family.boothNo,
    roadName: family.roadName,
    familyNumber: family.familyNumber,
    flatNumber: family.flatNumber,
    buildingNumber: family.buildingNumber,
    buildingName: family.buildingName,
    buildingAddress: family.buildingAddress,
    tagLeader: family.tagLeader,
    familyAvailability: family.familyAvailability,
    economicStatus: family.economicStatus,
    familyNature: family.familyNature,
    points: family.points,
    phone: family.phone,
    hasAssociation: family.hasAssociation,
    associationName: family.associationName,
    associationHeadName: family.associationHeadName,
    associationHeadPhone: family.associationHeadPhone,
    headName: family.headName,
    headEpicNo: family.headEpicNo,
    memberCount: family.memberCount ?? family.members?.length ?? 0,
    latitude: family.latitude,
    longitude: family.longitude,
    lastUpdatedAt: family.lastUpdatedAt,
  });

  const loadFamilyDetails = async (reset = true) => {
    if (reset) {
      setFamilyDetailLoading(true);
      setFamilyDetailError('');
      setFamilyDetailPage(0);
      setFamilyDetailRows([]);
      setFamilyDetailHasMore(false);
      setFamilyDetailTotal(0);
    } else {
      if (familyDetailLoadingMore || familyDetailLoading || !familyDetailHasMore) return;
      setFamilyDetailLoadingMore(true);
    }

    const pageToLoad = reset ? 0 : familyDetailPage;

    try {
      const res = await mobileApi.fetchFamilyDetails(
        effectiveAnalysisWardId,
        undefined,
        familyDetailFrom || undefined,
        familyDetailTo || undefined,
        pageToLoad,
        FAMILY_DETAIL_PAGE_SIZE,
        assemblyCodeForFamily || undefined,
      );
      const payload = res?.data?.result ?? res?.result ?? res;
      if (Array.isArray(payload?.fields) && payload.fields.length) {
        setFamilyDetailFields(payload.fields);
      }
      const apiRows = Array.isArray(payload?.rows) ? payload.rows : [];
      const total = Number(payload?.total ?? 0);
      const mapped = apiRows.map((row, index) => ({
        ...row,
        serialNumber: row.serialNumber ?? pageToLoad * FAMILY_DETAIL_PAGE_SIZE + index + 1,
        members: normalizeDetailMembers(row.members),
      }));
      setFamilyDetailRows((current) => (reset ? mapped : [...current, ...mapped]));
      setFamilyDetailTotal(total);
      setFamilyDetailHasMore((pageToLoad + 1) * FAMILY_DETAIL_PAGE_SIZE < total);
      setFamilyDetailPage(pageToLoad + 1);
    } catch (err) {
      console.error('Failed to load family details:', err);
      if (reset) {
        setFamilyDetailRows([]);
        setFamilyDetailError(err?.message || 'Failed to load families.');
      }
    } finally {
      if (reset) setFamilyDetailLoading(false);
      setFamilyDetailLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (activeTab === 'LIST') {
      loadFamilyAnalysis();
      loadFamilyDetails(true);
    } else if (activeTab === 'PENDING_MAP') {
      loadFamilyDetails(true);
    }
  }, [activeTab, mounted, selectedWardId, analysisViewMode, familyDetailFrom, familyDetailTo, assemblyCodeForFamily, familyDataRefreshToken]);

  useEffect(() => {
    if (activeTab !== 'NEW') {
      setError('');
      setSuccess('');
    }
  }, [activeTab]);

  const analysisViewOptions = [
    { label: 'Agent wise', value: 'agent' },
    { label: 'Date wise', value: 'date' },
    { label: 'Ward wise', value: 'ward' },
    { label: 'Booth wise', value: 'booth' },
  ];
  const analysisSortOptions = [
    { label: 'Name A-Z', value: 'name-asc' },
    { label: 'Name Z-A', value: 'name-desc' },
    { label: 'Latest Updated', value: 'latest' },
    { label: 'Oldest Updated', value: 'oldest' },
  ];

  const sortedAnalysisRows = useMemo(() => {
    const items = [...analysisRows];
    if (analysisViewMode !== 'agent') {
      return items.sort((a, b) => {
        const aTime = new Date(a.lastUpdatedAt || 0).getTime();
        const bTime = new Date(b.lastUpdatedAt || 0).getTime();
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return bTime - aTime;
        return String(a.label || a.groupKey || '').localeCompare(String(b.label || b.groupKey || ''), 'en');
      });
    }
    if (analysisSortMode === 'name-desc') {
      return items.sort((a, b) => String(b.agentName || '').localeCompare(String(a.agentName || ''), 'en'));
    }
    if (analysisSortMode === 'latest') {
      return items.sort((a, b) => new Date(b.lastUpdatedAt || 0).getTime() - new Date(a.lastUpdatedAt || 0).getTime());
    }
    if (analysisSortMode === 'oldest') {
      return items.sort((a, b) => new Date(a.lastUpdatedAt || 0).getTime() - new Date(b.lastUpdatedAt || 0).getTime());
    }
    return items.sort((a, b) => String(a.agentName || '').localeCompare(String(b.agentName || ''), 'en'));
  }, [analysisRows, analysisSortMode, analysisViewMode]);

  const activeAnalysisAvailabilityFields = useMemo(() => {
    const fields = analysisFields.length ? analysisFields : FAMILY_ANALYSIS_AVAILABILITY_KEYS;
    const selected = new Set(analysisAvailabilityFilter);
    return fields.filter((field) => selected.has(field.label));
  }, [analysisFields, analysisAvailabilityFilter]);

  const filteredFamilyDetailRows = useMemo(() => {
    const allowed = new Set(analysisAvailabilityFilter.map((v) => String(v).trim()));
    if (!allowed.size || allowed.size >= FAMILY_AVAILABILITY_OPTIONS.length) return familyDetailRows;
    return familyDetailRows.filter((row) => allowed.has(String(row.familyAvailability || '').trim()));
  }, [familyDetailRows, analysisAvailabilityFilter]);

  const pendingFilteredDetailRows = useMemo(() => {
    const allowed = new Set(pendingAvailabilityFilter.map((v) => String(v).trim()));
    if (!allowed.size || allowed.size >= FAMILY_AVAILABILITY_OPTIONS.length) return familyDetailRows;
    return familyDetailRows.filter((row) => allowed.has(String(row.familyAvailability || '').trim()));
  }, [familyDetailRows, pendingAvailabilityFilter]);

  const pendingFilteredOnMapRows = useMemo(
    () => pendingFilteredDetailRows.filter((row) => hasValidFamilyMapLocation(row)),
    [pendingFilteredDetailRows],
  );

  const pendingFilteredNoMapRows = useMemo(
    () => pendingFilteredDetailRows.filter((row) => !hasValidFamilyMapLocation(row)),
    [pendingFilteredDetailRows],
  );

  const pendingListVisibleSections = useMemo(() => {
    const onMap = pendingFilteredOnMapRows;
    const noMap = pendingFilteredNoMapRows;
    const onMapShown = onMap.slice(0, pendingListVisibleCount);
    const remaining = Math.max(0, pendingListVisibleCount - onMapShown.length);
    const noMapShown = remaining > 0 ? noMap.slice(0, remaining) : [];
    return { onMapShown, noMapShown, total: onMap.length + noMap.length };
  }, [pendingFilteredOnMapRows, pendingFilteredNoMapRows, pendingListVisibleCount]);

  const canLoadMorePendingList =
    pendingListVisibleSections.onMapShown.length + pendingListVisibleSections.noMapShown.length
    < pendingListVisibleSections.total;

  const loadMorePendingListRows = useCallback(() => {
    setPendingListVisibleCount((count) =>
      Math.min(count + PENDING_FAMILY_LIST_LAZY_STEP, pendingListVisibleSections.total),
    );
  }, [pendingListVisibleSections.total]);

  const pendingListLazySentinelRef = useInfiniteTrigger(
    canLoadMorePendingList && !familyDetailLoading,
    loadMorePendingListRows,
  );

  useEffect(() => {
    setPendingListVisibleCount(PENDING_FAMILY_LIST_LAZY_STEP);
  }, [selectedWardId, pendingAvailabilityFilter.join('|'), activeTab]);

  useEffect(() => {
    if (!editingFamilyId || editFamilyLoading || !wardItems.length || editingFamilyMeta?.wardId == null) {
      return;
    }
    const wardIdStr = String(editingFamilyMeta.wardId);
    const match = wardItems.find((w) => w.value === wardIdStr)
      || (editingFamilyMeta.wardCode
        ? wardItems.find((w) => String(w.wardCode) === String(editingFamilyMeta.wardCode))
        : null);
    const next = match?.value || wardIdStr;
    setSelectedWardId((current) => (current === next ? current : next));
  }, [editingFamilyId, editFamilyLoading, wardItems, editingFamilyMeta]);

  const pendingMapEmptyHint = useMemo(() => {
    if (pendingFilteredOnMapRows.length > 0) return '';
    if (pendingFilteredNoMapRows.length > 0) {
      const n = pendingFilteredNoMapRows.length;
      return `${n} famil${n === 1 ? 'y' : 'ies'} in this ward have no GPS yet — they appear in the list below. Tap Edit and capture household location to show on the map.`;
    }
    return '';
  }, [pendingFilteredOnMapRows.length, pendingFilteredNoMapRows.length]);

  const visibleAnalysisRows = useMemo(
    () => sortedAnalysisRows.slice(0, analysisVisibleCount),
    [sortedAnalysisRows, analysisVisibleCount],
  );

  const canLoadMoreAnalysis = visibleAnalysisRows.length < sortedAnalysisRows.length;

  const loadMoreAnalysisRows = () => {
    setAnalysisVisibleCount((count) => Math.min(count + FAMILY_ANALYSIS_LAZY_STEP, sortedAnalysisRows.length));
  };

  const analysisLazySentinelRef = useInfiniteTrigger(
    canLoadMoreAnalysis && !analysisLoading,
    loadMoreAnalysisRows,
  );

  const refreshFamilyAnalysisData = () => {
    setFamilyDataRefreshToken((token) => token + 1);
    loadFamilyAnalysis();
    loadFamilyDetails(true);
  };

  const familyDetailLazySentinelRef = useInfiniteTrigger(
    familyDetailHasMore && !familyDetailLoading && !familyDetailLoadingMore,
    () => loadFamilyDetails(false),
  );

  const familyDetailColumns = useMemo(() => {
    const keys = [...FAMILY_DETAIL_SUMMARY_KEYS];
    (familyDetailFields || []).forEach((field) => {
      if (field?.key && !keys.includes(field.key)) keys.push(field.key);
    });
    [
      'buildingNumber',
      'buildingName',
      'buildingAddress',
      'tagLeader',
      'economicStatus',
      'familyNature',
      'points',
      'phone',
      'hasAssociation',
      'associationName',
      'associationHeadName',
      'associationHeadPhone',
      'latitude',
      'longitude',
      'lastUpdatedAt',
    ].forEach((key) => {
      if (!keys.includes(key)) keys.push(key);
    });
    return keys;
  }, [familyDetailFields]);

  const familyDetailLabel = (key) => ({
    serialNumber: 'S No',
    familyName: 'Family Name',
    boothNo: 'Booth No',
    latitude: 'Latitude',
    longitude: 'Longitude',
    lastUpdatedAt: 'Last Updated At',
    updatedByName: 'Updated By Name',
    updatedByPhone: 'Updated By Number',
  }[key] || (familyDetailFields.find((f) => f.key === key)?.label) || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));

  const buildFamilyAnalysisExport = () => {
    const availabilityHeaders = (analysisFields.length ? analysisFields : FAMILY_ANALYSIS_AVAILABILITY_KEYS).map((f) => f.label);
    if (analysisViewMode === 'agent') {
      const headers = ['S No', 'Agent Name', 'Agent Mobile', 'Total Buildings visited', 'Total Families visited', ...availabilityHeaders, 'Last Updated At'];
      const dataRows = sortedAnalysisRows.map((row, index) => [
        index + 1,
        row.agentName || '',
        row.phone || '',
        row.totalBuildings ?? 0,
        row.totalFamilies ?? 0,
        ...(analysisFields.length ? analysisFields : FAMILY_ANALYSIS_AVAILABILITY_KEYS).map((f) => row.counts?.[f.key] ?? 0),
        formatFamilyDateTime(row.lastUpdatedAt),
      ]);
      return { headers, dataRows };
    }
    if (analysisViewMode === 'date') {
      const headers = ['S No', 'Date', 'Agents Worked', 'Booths Covered', 'Total Buildings visited', 'Total Families visited', ...availabilityHeaders, 'Last Updated At'];
      const dataRows = sortedAnalysisRows.map((row, index) => [
        index + 1,
        row.label || row.groupKey || '',
        row.agentsWorked ?? 0,
        row.boothsCovered ?? 0,
        row.totalBuildings ?? 0,
        row.totalFamilies ?? 0,
        ...(analysisFields.length ? analysisFields : FAMILY_ANALYSIS_AVAILABILITY_KEYS).map((f) => row.counts?.[f.key] ?? 0),
        formatFamilyDateTime(row.lastUpdatedAt),
      ]);
      return { headers, dataRows };
    }
    if (analysisViewMode === 'ward') {
      const headers = ['S No', 'Ward', 'Agents', 'Booths', 'Total Buildings visited', 'Total Families visited', ...availabilityHeaders, 'Last Updated At'];
      const dataRows = sortedAnalysisRows.map((row, index) => [
        index + 1,
        row.label || row.groupKey || '',
        row.agentsWorked ?? 0,
        row.boothsCovered ?? 0,
        row.totalBuildings ?? 0,
        row.totalFamilies ?? 0,
        ...(analysisFields.length ? analysisFields : FAMILY_ANALYSIS_AVAILABILITY_KEYS).map((f) => row.counts?.[f.key] ?? 0),
        formatFamilyDateTime(row.lastUpdatedAt),
      ]);
      return { headers, dataRows };
    }
    const headers = ['S No', 'Booth No.', 'Agents', 'Total Buildings visited', 'Total Families visited', ...availabilityHeaders, 'Last Updated At'];
    const dataRows = sortedAnalysisRows.map((row, index) => [
      index + 1,
      row.label || row.groupKey || '',
      row.agentsWorked ?? 0,
      row.totalBuildings ?? 0,
      row.totalFamilies ?? 0,
      ...(analysisFields.length ? analysisFields : FAMILY_ANALYSIS_AVAILABILITY_KEYS).map((f) => row.counts?.[f.key] ?? 0),
      formatFamilyDateTime(row.lastUpdatedAt),
    ]);
    return { headers, dataRows };
  };

  const formatMembersForExport = (members) => {
    const list = Array.isArray(members) ? members : [];
    if (!list.length) return '';
    return list.map((member, index) => formatFamilyMapMemberLine(member, index)).join('; ');
  };

  const buildFamilyDetailExport = () => {
    const headers = [...familyDetailColumns.map((key) => familyDetailLabel(key)), 'Family Members'];
    const dataRows = familyDetailRows.map((row, index) => [
      ...familyDetailColumns.map((key) => {
        if (key === 'serialNumber') return index + 1;
        if (key === 'lastUpdatedAt') return formatFamilyDateTime(row?.[key]);
        if (typeof row?.[key] === 'boolean') return row[key] ? 'Yes' : 'No';
        return row?.[key] ?? '';
      }),
      formatMembersForExport(row.members),
    ]);
    return { headers, dataRows };
  };

  const runFamilyExport = (buildExport, downloadFn, filename) => {
    try {
      const { headers, dataRows } = buildExport();
      if (!dataRows.length) {
        setError('No data to export. Click Get Latest Data first.');
        return;
      }
      downloadFn(filename, headers, dataRows);
      setSuccess(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      setError(err?.message || 'Export failed.');
    }
  };

  const downloadFamilyAnalysisCsv = () =>
    runFamilyExport(buildFamilyAnalysisExport, downloadCsvFile, 'families-analysis.csv');

  const downloadFamilyAnalysisXls = () =>
    runFamilyExport(buildFamilyAnalysisExport, downloadXlsFile, 'families-analysis.xls');

  const renderPendingFamilyMapFilters = (availabilityFilter, setAvailabilityFilter) => (
    <>
      <div className="mobile-web-form-grid mobile-web-pending-map-filters mobile-web-family-ward-row" style={{ marginBottom: '12px' }}>
        <label className="mobile-web-field">
          <span>Ward</span>
          <PremiumSelect
            label="Ward"
            options={familyWardSelectOptions}
            value={selectedWardId}
            onChange={setSelectedWardId}
          />
        </label>
      </div>
      <FamilyAvailabilityFilterChips
        selected={availabilityFilter}
        onChange={setAvailabilityFilter}
      />
    </>
  );

  const renderFamilyAnalysisFilters = (availabilityFilter, setAvailabilityFilter) => (
    <>
      <div className="mobile-web-form-grid" style={{ marginBottom: '12px' }}>
        <label className="mobile-web-field">
          <span>Ward</span>
          <PremiumSelect
            label="Ward"
            options={familyWardSelectOptions}
            value={selectedWardId}
            onChange={setSelectedWardId}
          />
        </label>
        <label className="mobile-web-field">
          <span>View</span>
          <PremiumSelect
            label="View"
            options={analysisViewOptions}
            value={analysisViewMode}
            onChange={setAnalysisViewMode}
          />
        </label>
        {analysisViewMode === 'agent' ? (
          <label className="mobile-web-field">
            <span>Sort By</span>
            <PremiumSelect
              label="Sort By"
              options={analysisSortOptions}
              value={analysisSortMode}
              onChange={setAnalysisSortMode}
            />
          </label>
        ) : null}
        <label className="mobile-web-field">
          <span>Updated From</span>
          <input className="mobile-web-input" type="date" value={familyDetailFrom} onChange={(e) => setFamilyDetailFrom(e.target.value)} />
        </label>
        <label className="mobile-web-field">
          <span>Updated To</span>
          <input className="mobile-web-input" type="date" value={familyDetailTo} onChange={(e) => setFamilyDetailTo(e.target.value)} />
        </label>
      </div>
      <FamilyAvailabilityFilterChips
        selected={availabilityFilter}
        onChange={setAvailabilityFilter}
      />
      <div className="mobile-web-action-row" style={{ marginBottom: '12px' }}>
        <button
          type="button"
          className="mobile-web-primary-btn"
          onClick={refreshFamilyAnalysisData}
          disabled={analysisLoading || familyDetailLoading}
        >
          {analysisLoading || familyDetailLoading ? 'Refreshing...' : 'Get Latest Data'}
        </button>
        <button type="button" className="mobile-web-secondary-btn" onClick={downloadFamilyAnalysisCsv} disabled={!sortedAnalysisRows.length}>
          Download CSV
        </button>
        <button type="button" className="mobile-web-secondary-btn" onClick={downloadFamilyAnalysisXls} disabled={!sortedAnalysisRows.length}>
          Download Excel
        </button>
      </div>
    </>
  );

  const renderFamilyAnalysisSummaryTable = (activeFields) => {
    if (analysisLoading) return <div className="mobile-web-empty">Loading family analysis...</div>;
    if (!sortedAnalysisRows.length) return <div className="mobile-web-empty">No family analysis data found.</div>;
    return (
      <div className="mobile-web-analysis-table-wrap mobile-web-analysis-table-scroll" style={{ marginBottom: '16px' }}>
        <table className="mobile-web-analysis-table">
          <thead>
            <tr>
              <th>S No</th>
              {analysisViewMode === 'agent' ? (
                <>
                  <th>Agent Name</th>
                  <th>Agent Mobile</th>
                </>
              ) : null}
              {analysisViewMode === 'date' ? (
                <>
                  <th>Date</th>
                  <th>Agents Worked</th>
                  <th>Booths Covered</th>
                </>
              ) : null}
              {analysisViewMode === 'ward' ? (
                <>
                  <th>Ward</th>
                  <th>Agents</th>
                  <th>Booths</th>
                </>
              ) : null}
              {analysisViewMode === 'booth' ? (
                <>
                  <th>Booth No.</th>
                  <th>Agents</th>
                </>
              ) : null}
              <th>Total Buildings visited</th>
              <th>Total Families visited</th>
              {activeFields.map((field) => (
                <th key={field.key}>{formatFamilyAvailabilityLabel(field.label)}</th>
              ))}
              <th>Last Updated At</th>
            </tr>
          </thead>
          <tbody>
            {visibleAnalysisRows.map((row, index) => (
              <tr key={row.userId || row.groupKey || row.label || `${index}-${row.agentName}`}>
                <td>{index + 1}</td>
                {analysisViewMode === 'agent' ? (
                  <>
                    <td>{row.agentName || '-'}</td>
                    <td>{row.phone || '-'}</td>
                  </>
                ) : null}
                {analysisViewMode === 'date' ? (
                  <>
                    <td>{row.label || row.groupKey || '-'}</td>
                    <td>{row.agentsWorked ?? 0}</td>
                    <td>{row.boothsCovered ?? 0}</td>
                  </>
                ) : null}
                {analysisViewMode === 'ward' ? (
                  <>
                    <td>{row.label || row.groupKey || '-'}</td>
                    <td>{row.agentsWorked ?? 0}</td>
                    <td>{row.boothsCovered ?? 0}</td>
                  </>
                ) : null}
                {analysisViewMode === 'booth' ? (
                  <>
                    <td>{row.label || row.groupKey || '-'}</td>
                    <td>{row.agentsWorked ?? 0}</td>
                  </>
                ) : null}
                <td>{row.totalBuildings ?? 0}</td>
                <td>{row.totalFamilies ?? 0}</td>
                {activeFields.map((field) => (
                  <td key={`${row.userId || row.groupKey}-${field.key}`}>{row.counts?.[field.key] ?? 0}</td>
                ))}
                <td>{formatFamilyDateTime(row.lastUpdatedAt)}</td>
              </tr>
            ))}
            {analysisViewMode === 'agent' ? (
              <tr className="mobile-web-analysis-total">
                <td>Total</td>
                <td>-</td>
                <td>-</td>
                <td>{sortedAnalysisRows.reduce((sum, row) => sum + (Number(row.totalBuildings) || 0), 0)}</td>
                <td>{sortedAnalysisRows.reduce((sum, row) => sum + (Number(row.totalFamilies) || 0), 0)}</td>
                {activeFields.map((field) => (
                  <td key={`total-${field.key}`}>
                    {sortedAnalysisRows.reduce((sum, row) => sum + (Number(row.counts?.[field.key]) || 0), 0)}
                  </td>
                ))}
                <td>-</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {canLoadMoreAnalysis ? (
          <div ref={analysisLazySentinelRef} className="mobile-web-lazy-load-sentinel">
            {analysisLoading ? null : (
              <span>Scroll for more ({visibleAnalysisRows.length} of {sortedAnalysisRows.length})</span>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const downloadFamilyDetailCsv = () =>
    runFamilyExport(buildFamilyDetailExport, downloadCsvFile, 'families-details.csv');

  const downloadFamilyDetailXls = () =>
    runFamilyExport(buildFamilyDetailExport, downloadXlsFile, 'families-details.xls');

  const renderFamilyDetailValue = (row, key) => {
    if (key === 'lastUpdatedAt') return formatFamilyDateTime(row?.[key]);
    if (typeof row?.[key] === 'boolean') return row[key] ? 'Yes' : 'No';
    return row?.[key] ?? '-';
  };

  const populateFormFromFamilyDto = (fam = {}) => {
    const headMember = (fam.members || []).find((m) => m.head || m.is_head) || (fam.members || [])[0];
    const mappedMembers = (fam.members || []).map((m, index) => ({
      id: `${m.epicNo || m.voterName || 'member'}-${index}`,
      name: m.voterName || m.epicNo || 'Member',
      epic: m.epicNo || '',
      relation: m.relationName || m.rel_eng || '',
      phone: '',
      houseNo: '',
      boothId: fam.boothId || '',
      rawVoter: { epicNo: m.epicNo, firstMiddleNameEn: m.voterName },
    }));
    setFamilyName(fam.familyName || '');
    setRoadName(fam.roadName || '');
    setBuildingNumber(fam.buildingNumber || '');
    setBuildingName(fam.buildingName || '');
    setFlatNumber(fam.flatNumber || '');
    setFamilyNumber(fam.familyNumber || '');
    setTagLeader(fam.tagLeader || '');
    setFamilyAvailability(fam.familyAvailability || 'Available');
    setBuildingAddress(fam.buildingAddress || fam.familyAddress || '');
    setHasAssociation(Boolean(fam.hasAssociation));
    setAssociationName(fam.associationName || '');
    setAssociationHeadName(fam.associationHeadName || '');
    setAssociationHeadPhone(fam.associationHeadPhone || '');
    setHeadPhone(fam.phone || '');
    setEconomicStatus(fam.economicStatus || 'NA');
    setFamilyNature(fam.familyNature || 'NA');
    setFamilyPoints(String(fam.points ?? '5'));
    setMembers(mappedMembers);
    const headId = mappedMembers.find((m) => m.epic === (fam.headEpicNo || headMember?.epicNo))?.id
      || mappedMembers[0]?.id
      || '';
    setHeadOfFamily(headId);
    if (fam.latitude != null && fam.longitude != null) {
      setLocation({ latitude: Number(fam.latitude), longitude: Number(fam.longitude) });
    } else {
      setLocation(null);
    }
    const wardIdFromFamily = fam.wardId ?? fam.ward_id;
    const wardCodeFromFamily = fam.wardCode ?? fam.ward_code;
    let resolvedWardId = wardIdFromFamily != null ? String(wardIdFromFamily) : '';
    if (!resolvedWardId && wardCodeFromFamily && wardItems.length) {
      const byCode = wardItems.find((w) => String(w.wardCode) === String(wardCodeFromFamily));
      if (byCode) resolvedWardId = byCode.value;
    }
    if (resolvedWardId) setSelectedWardId(resolvedWardId);
    const matchedWard = wardItems.find((w) => w.value === resolvedWardId);
    setEditingFamilyMeta({
      familyId: fam.familyId,
      boothId: fam.boothId,
      wardId: wardIdFromFamily ?? (resolvedWardId ? Number(resolvedWardId) : null),
      wardCode: wardCodeFromFamily || matchedWard?.wardCode,
      wardLabel: matchedWard?.label,
      familyNumber: fam.familyNumber,
    });
  };

  const openFamilyEditRef = useRef(null);

  const openFamilyEdit = async (familyId, sourceTab = 'PENDING_MAP') => {
    const id = Number(familyId);
    if (!id) return;
    if (!canEditFamilyRecord) {
      handleFamilyEditBlocked();
      return;
    }
    setEditFamilySourceTab(sourceTab);
    setActiveTab('NEW');
    setEditFamilyLoading(true);
    setError('');
    setSuccess('');
    setEditingFamilyId(id);
    try {
      const res = await mobileApi.fetchFamilyById(id);
      const fam = res?.data?.result || res?.data || res?.result || res;
      if (!fam?.familyId) throw new Error('Family not found.');
      populateFormFromFamilyDto(fam);
      setEditingFamilyId(fam.familyId);
    } catch (err) {
      setEditingFamilyId(null);
      setEditingFamilyMeta(null);
      setError(formatApiError(err, 'Unable to load family for edit.'));
    } finally {
      setEditFamilyLoading(false);
    }
  };
  openFamilyEditRef.current = openFamilyEdit;

  const handlePendingMapFamilyEdit = useCallback((point) => {
    tryOpenFamilyEdit(point?.familyId, 'PENDING_MAP');
  }, [tryOpenFamilyEdit]);

  const handleAnalysisMapFamilyEdit = useCallback((point) => {
    tryOpenFamilyEdit(point?.familyId, 'MAP');
  }, [tryOpenFamilyEdit]);

  const closeFamilyEdit = () => {
    const tab = editFamilySourceTab;
    resetNewFamilyForm();
    setActiveTab(tab);
  };

  const handleSaveFamilyEdit = async () => {
    if (!editingFamilyId || !editingFamilyMeta) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!location?.latitude || !location?.longitude) {
        throw new Error('Location is required. Please capture location before updating.');
      }
      if (!familyName.trim()) throw new Error('Family name is required');
      if (!roadName.trim()) throw new Error('Road name is required');
      if (members.length === 0) throw new Error('At least one family member is required');
      if (!headOfFamily) throw new Error('Please pick a head of family');
      const headMember = members.find((m) => m.id === headOfFamily);
      if (!headMember?.epic) throw new Error('Invalid head of family selected');
      if (!hasHouseMarkingFields(buildingNumber, buildingName, flatNumber)) {
        throw new Error('Building/Apartment Number, Building/Apartment Name, and Flat Number are required');
      }
      const wardIdForUpdate = editingFamilyMeta.wardId || selectedWardId || wardItems[0]?.value;
      const boothIdForUpdate = editingFamilyMeta.boothId
        || members.map((m) => m.boothId).find(Boolean)
        || resolveFamilyCreateBoothId(boothItems, '');
      if (!wardIdForUpdate || !boothIdForUpdate) {
        throw new Error('Ward and booth are required to update this family.');
      }
      const payload = {
        familyName: familyName.trim(),
        roadName: roadName.trim(),
        buildingNumber: buildingNumber.trim() || null,
        buildingName: buildingName.trim() || null,
        flatNumber: flatNumber.trim() || null,
        familyNumber: editingFamilyMeta.familyNumber || familyNumber.trim() || null,
        tagLeader: tagLeader.trim() || null,
        familyAvailability,
        buildingAddress: buildingAddress.trim() || null,
        hasAssociation,
        associationName: hasAssociation ? associationName.trim() || null : null,
        associationHeadName: hasAssociation ? associationHeadName.trim() || null : null,
        associationHeadPhone: hasAssociation ? associationHeadPhone.trim() || null : null,
        phone: headPhone || headMember.phone,
        points: parseInt(familyPoints, 10) || 0,
        pointsProvided: 0,
        latitude: location.latitude,
        longitude: location.longitude,
        boothId: parseInt(boothIdForUpdate, 10),
        wardId: parseInt(wardIdForUpdate, 10),
        headEpicNo: headMember.epic,
        memberEpicNos: members.map((m) => m.epic).filter(Boolean),
        economicStatus,
        familyNature,
      };
      await mobileApi.updateFamily(editingFamilyId, payload);
      setSuccess('Family updated successfully.');
      const wardIdForRefresh = selectedWardId || undefined;
      const all = await mobileApi.fetchAllFamilies(undefined, undefined, wardIdForRefresh, assemblyCodeForFamily || undefined);
      setFamilies(sortFamiliesByNumber(all));
      refreshFamilyAnalysisData();
      closeFamilyEdit();
    } catch (err) {
      setError(formatApiError(err, 'Failed to update family'));
    } finally {
      setSaving(false);
    }
  };

  const handleCaptureLocation = async () => {
    setError('');
    try {
      const pos = await requestLocation();
      setLocation(pos);
      setSuccess('Location captured successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to capture location.');
    }
  };

  const addMember = () => {
    if (memberSuggestions.length === 1) {
      handleAddSuggestion(memberSuggestions[0]);
    }
  };

  const handleAddSuggestion = (suggestion) => {
    if (!suggestion) return;
    const name = [suggestion.firstMiddleNameEn, suggestion.lastNameEn].filter(Boolean).join(' ').trim();
    const newMember = {
      id: `${suggestion.epicNo || name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: name || suggestion.epicNo || 'Unknown',
      epic: suggestion.epicNo || '',
      relation: getVoterRelationDisplay(suggestion),
      phone: getVoterPhoneRaw(suggestion),
      houseNo: getVoterHouseDisplay(suggestion),
      boothId: suggestion.boothInfo?.boothId || suggestion.boothId || suggestion.booth_id || '',
      rawVoter: suggestion,
    };
    setMembers((current) => current.concat(newMember));
    setMemberQuery('');
    setRelationQuery('');
    setMemberSuggestions([]);
    setShowSuggestions(false);
  };

  const openMemberVoterInfo = async (member) => {
    if (!member?.rawVoter) return;
    if (shouldMaskAvailableInEdit) {
      setError(FAMILY_VIEW_DENIED_MSG);
      setSuccess('');
      return;
    }
    lastMemberSelectionRef.current = { member };
    setIsLocating(true);
    setError('');
    try {
      const loc = await requestLocation({ allowCached: true });
      setSelectedVoter({
        ...member.rawVoter,
        epicNo: member.rawVoter.epicNo || member.epic,
        boothId: member.boothId || member.rawVoter.boothId,
        ...loc,
      });
    } catch (err) {
      setError(err?.message || 'Location is required to view voter info.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveVoter = (updatedVoter) => {
    setSelectedVoter(updatedVoter);
    setMembers((current) =>
      current.map((member) => {
        const epic = member.rawVoter?.epicNo || member.epic;
        const updatedEpic = updatedVoter?.epicNo || updatedVoter?.epic;
        if (epic !== updatedEpic) return member;
        const name = [updatedVoter.firstMiddleNameEn, updatedVoter.lastNameEn].filter(Boolean).join(' ').trim();
        return {
          ...member,
          name: name || member.name,
          phone: getVoterPhoneRaw(updatedVoter) || member.phone,
          relation: getVoterRelationDisplay(updatedVoter) || member.relation,
          houseNo: getVoterHouseDisplay(updatedVoter) || member.houseNo,
          rawVoter: { ...member.rawVoter, ...updatedVoter },
        };
      })
    );
  };

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const query = memberQuery.trim();
    if (!query) {
      setMemberSuggestions([]);
      setShowSuggestions(false);
      setMemberLoading(false);
      return undefined;
    }
    setShowSuggestions(true);
    setMemberLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const wardForSearch = selectedWardId || wardItems[0]?.value;
        const res = await mobileApi.searchVoters({
          searchQuery: query,
          relationName: relationQuery.trim() || undefined,
          wardId: wardForSearch || undefined,
          size: 20,
        });
        const payload = res?.data?.result || res?.result || res?.data || [];
        setMemberSuggestions(Array.isArray(payload) ? payload : []);
      } catch (error) {
        setMemberSuggestions([]);
      } finally {
        setMemberLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [memberQuery, relationQuery, selectedWardId, wardItems]);

  const handleGetLocation = async () => {
    setError('');
    try {
      const loc = await requestLocation();
      setLocation(loc);
      setSuccess(`Location captured: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
    } catch (err) {
      setError(err?.message || 'Unable to fetch location.');
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!location?.latitude || !location?.longitude) {
        throw new Error('Location is required. Please capture location before updating.');
      }
      if (!familyName.trim()) throw new Error('Family name is required');
      if (!roadName.trim()) throw new Error('Road name is required');
      if (members.length === 0) throw new Error('At least one family member is required');
      if (!headOfFamily) throw new Error('Please pick a head of family');

      const headMember = members.find((m) => m.id === headOfFamily);
      if (!headMember || !headMember.epic) throw new Error('Invalid head of family selected');

      const wardIdForCreate = selectedWardId || wardItems[0]?.value;
      if (!wardIdForCreate) throw new Error('Please select a ward.');
      const invalidMember = members.find((m) => m.boothId && !isMemberBoothInWard(m.boothId, boothItems));
      if (invalidMember) {
        throw new Error('A member belongs to a different ward. Remove them and search again within your selected ward.');
      }
      const memberBoothId = members.map((m) => m.boothId).find((id) => id && isMemberBoothInWard(id, boothItems));
      const resolvedBoothId = memberBoothId
        ? String(memberBoothId)
        : resolveFamilyCreateBoothId(boothItems, '');
      if (!resolvedBoothId) throw new Error('No booth found for the ward. Add a family member from this ward first.');

      if (!hasHouseMarkingFields(buildingNumber, buildingName, flatNumber)) {
        throw new Error('Building/Apartment Number, Building/Apartment Name, and Flat Number are required');
      }
      if (!wardNumberPrefix) throw new Error('Ward is required to generate a family number.');
      const generatedFamilyNumber = getNextFamilyNumber(wardFamilies, wardNumberPrefix);

      const payload = {
        familyName,
        roadName: roadName.trim(),
        buildingNumber: buildingNumber.trim() || null,
        buildingName: buildingName.trim() || null,
        flatNumber: flatNumber.trim() || null,
        familyNumber: generatedFamilyNumber || null,
        tagLeader: tagLeader.trim() || null,
        familyAvailability,
        buildingAddress: buildingAddress.trim() || null,
        hasAssociation,
        associationName: hasAssociation ? associationName.trim() || null : null,
        associationHeadName: hasAssociation ? associationHeadName.trim() || null : null,
        associationHeadPhone: hasAssociation ? associationHeadPhone.trim() || null : null,
        phone: headPhone || headMember.phone,
        points: parseInt(familyPoints, 10) || 0,
        pointsProvided: 0,
        latitude: location.latitude,
        longitude: location.longitude,
        boothId: parseInt(resolvedBoothId, 10),
        wardId: parseInt(wardIdForCreate, 10),
        headEpicNo: headMember.epic,
        memberEpicNos: members.map((m) => m.epic).filter(Boolean),
        economicStatus,
        familyNature,
      };

      await mobileApi.createFamily(payload);
      setSuccess('Family saved successfully!');
      loadSuggestions();
      const all = await mobileApi.fetchAllFamilies(undefined, undefined, wardIdForCreate, assemblyCodeForFamily || undefined);
      setFamilies(sortFamiliesByNumber(all));
      refreshFamilyAnalysisData();
      resetNewFamilyForm();
      setActiveTab('LIST');
    } catch (err) {
      setError(formatApiError(err, 'Failed to save family'));
    } finally {
      setSaving(false);
    }
  };

  if (selectedVoter) {
    return (
      <ScreenFrame accent="blue">
        <VoterInfoScreen
          voter={selectedVoter}
          booth={{ boothId: selectedVoter.boothId, boothLabel: selectedVoter.boothLabel }}
          onBack={() => setSelectedVoter(null)}
          onSave={handleSaveVoter}
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-family-shell">
        {isFamilyEditMode ? (
          <div className="mobile-web-family-edit-banner">
            <div className="mobile-web-section-title">Edit family</div>
            <button type="button" className="mobile-web-secondary-btn" onClick={closeFamilyEdit} disabled={editFamilyLoading || saving}>
              Back
            </button>
          </div>
        ) : null}
        <div className="mobile-web-subtabs mobile-web-family-subtabs mb-6" role="tablist" aria-label="Voters family sections">
          {familySectionTabs.map((tab) => {
            const tabLabel = tab.id === 'NEW' && isFamilyEditMode ? 'Edit family' : tab.label;
            return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`mobile-web-subtab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleFamilySubtabChange(tab.id)}
            >
              {tabLabel}
            </button>
            );
          })}
        </div>

        {activeTab === 'NEW' ? (
          <>
            {editFamilyLoading ? <div className="mobile-web-empty">Loading family...</div> : null}
            {!editFamilyLoading ? (
            <>
            <div className="mobile-web-family-grid mobile-web-family-ward-row mt-3">
              <label className="mobile-web-field">
                <span>Ward</span>
                {newFamilyWardSelectOptions.length > 1 ? (
                  <PremiumSelect
                    label="Ward"
                    options={newFamilyWardSelectOptions}
                    value={selectedWardId}
                    onChange={setSelectedWardId}
                  />
                ) : (
                  <input
                    className="mobile-web-input"
                    value={
                      selectedWard?.label
                      || editingFamilyMeta?.wardLabel
                      || (editingFamilyMeta?.wardCode ? `Ward ${editingFamilyMeta.wardCode}` : '')
                      || 'Ward'
                    }
                    readOnly
                  />
                )}
              </label>
            </div>

            <div className="mobile-web-family-grid mt-3">
              <FamilySuggestInput
                label="Road Name (Mandatory)"
                value={roadName}
                onChange={setRoadName}
                suggestions={roadSuggestions}
                placeholder="Road name"
                required
              />
            </div>

            <div className="mobile-web-family-grid mt-3">
              {shouldMaskAvailableInEdit ? (
                <MaskedFamilyField
                  label="Enter family name"
                  value={familyName}
                  onChange={setFamilyName}
                  mask
                  maskMode="leading"
                  readOnly
                  placeholder="Family name"
                />
              ) : (
                <FamilySuggestInput
                  label="Enter family name"
                  value={familyName}
                  onChange={setFamilyName}
                  suggestions={familyNameSuggestions}
                  placeholder="Family name"
                />
              )}
              <label className="mobile-web-field">
                <span>Family Number</span>
                <input
                  className="mobile-web-input"
                  placeholder={editingFamilyId ? '' : (wardNumberPrefix ? `${wardNumberPrefix}-1` : 'Ward required')}
                  value={familyNumber}
                  readOnly
                />
              </label>
            </div>

            <div className="mobile-web-family-grid mt-3">
              <FamilySuggestInput
                label="Building/Apartment Number"
                value={buildingNumber}
                onChange={setBuildingNumber}
                suggestions={buildingNumberSuggestions}
                placeholder="Building/Apartment Number"
              />
              <FamilySuggestInput
                label="Building/Apartment Name"
                value={buildingName}
                onChange={setBuildingName}
                suggestions={buildingSuggestions}
                placeholder="Building/Apartment Name"
              />
              <FamilySuggestInput
                label="Flat Number"
                value={flatNumber}
                onChange={setFlatNumber}
                suggestions={flatSuggestions}
                placeholder="Flat Number"
              />
            </div>

            <div className="mobile-web-family-grid mt-3">
              <FamilySuggestInput
                label="Building/Apartment Address"
                value={buildingAddress}
                onChange={setBuildingAddress}
                suggestions={addressSuggestions}
                placeholder="Building/Apartment Address"
              />
              <div className="mobile-web-field mobile-web-field-inline mobile-web-association-check">
                <input
                  type="checkbox"
                  id="has-association-check"
                  className="mobile-web-checkbox-large"
                  checked={hasAssociation}
                  onChange={(e) => setHasAssociation(e.target.checked)}
                />
                <label htmlFor="has-association-check" style={{ marginBottom: 0, fontWeight: 500 }}>If have association</label>
              </div>
            </div>

            {hasAssociation ? (
              <div className="mobile-web-family-grid mobile-web-tag-grid mt-3">
                <FamilySuggestInput
                  label="Association Name"
                  value={associationName}
                  onChange={setAssociationName}
                  suggestions={associationSuggestions}
                  placeholder="Association Name"
                />
                <FamilySuggestInput
                  label="Association Head Name"
                  value={associationHeadName}
                  onChange={setAssociationHeadName}
                  suggestions={associationHeadSuggestions}
                  placeholder="Association Head Name"
                />
                <label className="mobile-web-field">
                  <span>Association Head Phone number</span>
                  <input
                    className="mobile-web-input"
                    placeholder="Phone number"
                    value={associationHeadPhone}
                    onChange={(e) => setAssociationHeadPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                  />
                </label>
              </div>
            ) : null}

            <div className="mobile-web-family-grid mt-3">
              <FamilySuggestInput
                label="Tag a Leader"
                value={tagLeader}
                onChange={setTagLeader}
                suggestions={leaderSuggestions}
                placeholder="Leader name"
              />
              <label className="mobile-web-field">
                <span>Family Availability</span>
                <PremiumSelect
                  label="Family Availability"
                  options={familyAvailabilitySelectOptions}
                  value={familyAvailability}
                  onChange={setFamilyAvailability}
                />
              </label>
            </div>

            <div className="my-4">
              <div className="mobile-web-map-card mb-3">
                {location ? (
                  <iframe
                    className="mobile-web-map-frame"
                    title="Family location map"
                    src={getGoogleEmbedUrl(location.latitude, location.longitude)}
                    loading="lazy"
                  />
                ) : (
                  <div className="mobile-web-map-placeholder">Capture location to preview household map.</div>
                )}
              </div>
              <button className="mobile-web-location-btn w-full" onClick={handleGetLocation} type="button">
                <LocationOnOutlined />
                <span>{location ? 'Location Captured' : 'Capture Household Location'}</span>
              </button>
            </div>

            <div className="mobile-web-family-members">
              <div className="mobile-web-section-title">Family Members</div>
              <div className="mobile-web-member-row">
                <div className="mobile-web-member-search">
                  <input
                    className="mobile-web-input"
                    placeholder="Search voter by EPIC or name"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    onFocus={() => {
                      if (memberQuery.trim()) setShowSuggestions(true);
                    }}
                  />
                  {showSuggestions ? (
                    <div className="mobile-web-suggestion-panel">
                      <div className="mobile-web-suggestion-search">
                        <input
                          className="mobile-web-input"
                          placeholder="Search by relation"
                          value={relationQuery}
                          onChange={(e) => setRelationQuery(e.target.value)}
                        />
                      </div>
                      {memberLoading ? <div className="mobile-web-suggestion-empty">Searching...</div> : null}
                      {!memberLoading && memberSuggestions.length === 0 ? (
                        <div className="mobile-web-suggestion-empty">No voters found.</div>
                      ) : null}
                      {!memberLoading && memberSuggestions.length > 0 ? (
                        <div className="mobile-web-suggestion-list">
                          {memberSuggestions.map((item) => {
                            const name = [item.firstMiddleNameEn, item.lastNameEn].filter(Boolean).join(' ').trim();
                            return (
                              <button
                                key={`${item.epicNo}-${item.voterId}`}
                                type="button"
                                className="mobile-web-suggestion-item"
                                onClick={() => handleAddSuggestion(item)}
                              >
                                <div>
                                  <div className="mobile-web-suggestion-name">{name || item.epicNo || 'Unknown'}</div>
                                  <div className="mobile-web-suggestion-meta">
                                    {item.epicNo || '-'} · {getVoterRelationDisplay(item) || 'Relation -'} · {getVoterPhoneDisplay(item) || 'No phone'}
                                  </div>
                                </div>
                                <span className="mobile-web-suggestion-action">Add</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button className="mobile-web-primary-btn" type="button" onClick={addMember}>Add</button>
              </div>
              <div className="mobile-web-table">
                <div className="mobile-web-table-head">
                  <span>Name</span>
                  <span>EPIC</span>
                  <span>Relation name</span>
                  <span>Phone</span>
                  <span>House No</span>
                  <span>Actions</span>
                </div>
                {members.length === 0 ? (
                  <div className="mobile-web-table-empty">No family members yet</div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="mobile-web-table-row">
                      <span>{shouldMaskAvailableInEdit ? maskMemberNameForDisplay(role, familyAvailability, member.name) : (member.name || '-')}</span>
                      <span>{shouldMaskAvailableInEdit ? maskMemberEpicForDisplay(role, familyAvailability, member.epic) : (member.epic || '-')}</span>
                      <span>{shouldMaskAvailableInEdit ? maskMemberEpicForDisplay(role, familyAvailability, member.relation) : (member.relation || '-')}</span>
                      <span>{shouldMaskAvailableInEdit ? maskMemberPhoneForDisplay(role, familyAvailability, member.phone) : (member.phone || '-')}</span>
                      <span>{shouldMaskAvailableInEdit ? maskMemberEpicForDisplay(role, familyAvailability, member.houseNo) : (member.houseNo || '-')}</span>
                      <span className="mobile-web-row-actions">
                        {!shouldMaskAvailableInEdit ? (
                          <button type="button" className="mobile-web-secondary-btn" onClick={() => openMemberVoterInfo(member)}>View</button>
                        ) : null}
                        <button type="button" className="mobile-web-secondary-btn" onClick={() => setMembers((m) => m.filter((x) => x.id !== member.id))}>Remove</button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mobile-web-family-grid">
              <label className="mobile-web-field">
                <span>Economic status</span>
                <PremiumSelect
                  label="Economic status"
                  options={['NA', 'Low', 'Medium', 'High']}
                  value={economicStatus}
                  onChange={setEconomicStatus}
                />
              </label>
              <label className="mobile-web-field">
                <span>Head of Family</span>
                <PremiumSelect
                  label="Head of Family"
                  options={headOfFamilyOptions}
                  value={headOfFamily}
                  onChange={setHeadOfFamily}
                  placeholder="Pick head of family"
                />
              </label>
              <MaskedFamilyField
                label="Family Head Phone Number"
                placeholder="Phone number"
                value={headPhone}
                onChange={(val) => setHeadPhone(String(val).replace(/\D/g, '').slice(0, 10))}
                mask={shouldMaskAvailableInEdit}
                maskMode="trailing"
                readOnly={shouldMaskAvailableInEdit}
                inputMode="numeric"
              />
              <label className="mobile-web-field">
                <span>Family Nature</span>
                <PremiumSelect
                  label="Family Nature"
                  options={['A', 'B', 'C', 'NA']}
                  value={familyNature}
                  onChange={setFamilyNature}
                />
              </label>
              <label className="mobile-web-field">
                <span>Points to the family</span>
                <PremiumSelect
                  label="Points to the family"
                  options={familyPointSelectOptions}
                  value={familyPoints}
                  onChange={setFamilyPoints}
                />
              </label>
            </div>
            {shouldMaskAvailableInEdit ? (
              <div className="mobile-web-muted" style={{ margin: '10px 0', fontSize: '0.85rem' }}>
                Available family: names show first 4 letters and EPIC/phone show last 4 digits only. Ward and Assembly users see full data.
              </div>
            ) : null}
            {success ? <div className="mobile-web-success" style={{ margin: '10px 0' }}>{success}</div> : null}
            {error ? <div className="mobile-web-error" style={{ margin: '10px 0' }}>{error}</div> : null}
            <div className="mobile-web-actions">
              <button
                className="mobile-web-primary-btn"
                type="button"
                onClick={editingFamilyId ? handleSaveFamilyEdit : handleUpdate}
                disabled={saving}
              >
                {saving ? 'Saving...' : (editingFamilyId ? 'Save Changes' : 'Save Family')}
              </button>
            </div>
            </>
            ) : null}
          </>
        ) : activeTab === 'PENDING_MAP' ? (
          <div className="mobile-web-family-pending-map-tab">
            {renderPendingFamilyMapFilters(pendingAvailabilityFilter, setPendingAvailabilityFilter)}
            {error ? <div className="mobile-web-error">{error}</div> : null}
            <div className="mobile-web-family-pending-map mt-3">
              <FamilyMapSection
                key={`pending-map-${selectedWardId || 'all'}-${pendingAvailabilityFilter.join('|')}-${familyDataRefreshToken}`}
                refreshToken={familyDataRefreshToken}
                title="Pending work map"
                wardId={effectiveAnalysisWardId}
                wardCode={mapWardCode}
                assemblyCode={assemblyCodeForFamily}
                showMemberDetails={canViewFullFamilyData}
                maskAvailableSensitive={maskAvailableSensitive}
                mapHeight="420px"
                availabilityFilter={pendingAvailabilityFilter}
                infoMessage={
                  canViewFullFamilyData
                    ? 'Pending work map: full family details for Ward / Assembly. Tap a dot to view or edit.'
                    : 'Pending work map: Available families show masked names (first 4 letters) and EPIC (last 4 digits). Tap Edit to update.'
                }
                emptyHint={pendingMapEmptyHint}
                allowMapEdit={canEditFamilyRecord}
                onMapEditBlocked={handleFamilyEditBlocked}
                onFamilyEdit={handlePendingMapFamilyEdit}
              />
            </div>
            <div className="mobile-web-stack" style={{ marginTop: '16px' }}>
              <div className="mobile-web-section-title">Edit family</div>
              {familyDetailError ? <div className="mobile-web-error">{familyDetailError}</div> : null}
              {familyDetailLoading ? <div className="mobile-web-empty">Loading families...</div> : null}
              {!familyDetailLoading && pendingFilteredDetailRows.length === 0 ? (
                <div className="mobile-web-empty">No families match the selected filters.</div>
              ) : null}
              {!familyDetailLoading && pendingFilteredDetailRows.length > 0 ? (
                <div className="mobile-web-family-pending-list">
                  {pendingFilteredOnMapRows.length > 0 ? (
                    <>
                      <div className="mobile-web-muted" style={{ fontSize: '0.8rem', marginBottom: '6px', fontWeight: 600 }}>
                        On map ({pendingFilteredOnMapRows.length})
                      </div>
                      {pendingListVisibleSections.onMapShown.map((family) => (
                        <div key={family.familyId} className="mobile-web-family-pending-row">
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {displayPendingFamilyListName(family, role)}
                            </div>
                            <div className="mobile-web-muted" style={{ fontSize: '0.8rem' }}>
                              {formatFamilyAvailabilityLabel(family.familyAvailability || 'Available')}
                              {family.roadName ? ` · ${family.roadName}` : ''}
                              {family.familyNumber ? ` · ${family.familyNumber}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="mobile-web-secondary-btn"
                            onClick={() => tryOpenFamilyEdit(family.familyId, 'PENDING_MAP')}
                            disabled={editFamilyLoading}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </>
                  ) : null}
                  {pendingFilteredNoMapRows.length > 0 ? (
                    <>
                      <div className="mobile-web-muted" style={{ fontSize: '0.8rem', margin: '12px 0 6px', fontWeight: 600 }}>
                        No map pin — capture location ({pendingFilteredNoMapRows.length})
                      </div>
                      {pendingListVisibleSections.noMapShown.map((family) => (
                        <div key={family.familyId} className="mobile-web-family-pending-row mobile-web-family-pending-row--no-gps">
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {displayPendingFamilyListName(family, role)}
                            </div>
                            <div className="mobile-web-muted" style={{ fontSize: '0.8rem' }}>
                              {formatFamilyAvailabilityLabel(family.familyAvailability || 'Available')}
                              {family.roadName ? ` · ${family.roadName}` : ''}
                              {family.familyNumber ? ` · ${family.familyNumber}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="mobile-web-primary-btn"
                            onClick={() => tryOpenFamilyEdit(family.familyId, 'PENDING_MAP')}
                            disabled={editFamilyLoading}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </>
                  ) : null}
                  {canLoadMorePendingList ? (
                    <div ref={pendingListLazySentinelRef} className="mobile-web-lazy-load-sentinel">
                      <span>
                        Scroll for more families (
                        {pendingListVisibleSections.onMapShown.length + pendingListVisibleSections.noMapShown.length}
                        {' '}
                        of {pendingListVisibleSections.total})
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : activeTab === 'MAP' ? (
          <div className="mobile-web-families-map-tab">
            <div className="mobile-web-family-grid mobile-web-family-ward-row mt-3">
              <label className="mobile-web-field">
                <span>Ward</span>
                <PremiumSelect
                  label="Ward"
                  options={familyWardSelectOptions}
                  value={selectedWardId}
                  onChange={setSelectedWardId}
                />
              </label>
            </div>
            <FamilyAvailabilityFilterChips
              selected={mapAvailabilityFilter}
              onChange={setMapAvailabilityFilter}
            />
            <FamilyMapSection
              key={`family-map-${selectedWardId || 'all'}-${mapAvailabilityFilter.join('|')}-${familyDataRefreshToken}`}
              refreshToken={familyDataRefreshToken}
              title="Family map"
              wardId={effectiveAnalysisWardId}
              wardCode={mapWardCode}
              assemblyCode={assemblyCodeForFamily}
              showMemberDetails={canViewFamilyMapMemberDetails}
              maskAvailableSensitive={maskAvailableSensitive}
              mapHeight="480px"
              availabilityFilter={mapAvailabilityFilter}
              infoMessage="Family map (assembly / ward): tap a dot for address and member lines — Voter name | EPIC | Relation name | Relation type."
              allowMapEdit={canEditFamilyRecord}
              onMapEditBlocked={handleFamilyEditBlocked}
              onFamilyEdit={handleAnalysisMapFamilyEdit}
            />
          </div>
        ) : (
          <div className="mobile-web-families-list">
            {renderFamilyAnalysisFilters(analysisAvailabilityFilter, setAnalysisAvailabilityFilter)}
            {error ? <div className="mobile-web-error">{error}</div> : null}
            {renderFamilyAnalysisSummaryTable(activeAnalysisAvailabilityFields)}

            <div className="mobile-web-stack" style={{ marginTop: '16px' }}>
              <div className="mobile-web-field">
                <label>Families</label>
              </div>
              <div className="mobile-web-action-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <button type="button" className="mobile-web-secondary-btn" onClick={downloadFamilyDetailCsv} disabled={!familyDetailRows.length}>
                  Download Detailed CSV
                </button>
                <button type="button" className="mobile-web-secondary-btn" onClick={downloadFamilyDetailXls} disabled={!familyDetailRows.length}>
                  Download Detailed Excel
                </button>
              </div>
              {familyDetailError ? <div className="mobile-web-error">{familyDetailError}</div> : null}
              {familyDetailLoading ? <div className="mobile-web-empty">Loading families...</div> : null}
              {familyDetailLoadingMore ? <div className="mobile-web-empty">Loading more families...</div> : null}
              {!familyDetailLoading && filteredFamilyDetailRows.length === 0 ? (
                <div className="mobile-web-empty">No families found for this ward and status filter.</div>
              ) : null}
              {!familyDetailLoading && filteredFamilyDetailRows.length > 0 ? (
                <div className="mobile-web-analysis-table-wrap mobile-web-analysis-detail mobile-web-analysis-table-scroll">
                  <table className="mobile-web-analysis-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }} />
                        {familyDetailColumns.map((key) => (
                          <th key={key}>{familyDetailLabel(key)}</th>
                        ))}
                        <th style={{ width: '72px' }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFamilyDetailRows.map((row, idx) => {
                        const rowKey = row.familyId || `${row.familyName || 'row'}-${idx}`;
                        const isExpanded = expandedDetailFamilyId === rowKey;
                        return (
                          <React.Fragment key={rowKey}>
                            <tr
                              className={isExpanded ? 'mobile-web-analysis-total' : ''}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setExpandedDetailFamilyId(isExpanded ? null : rowKey)}
                            >
                              <td>
                                <ExpandMoreRounded
                                  fontSize="small"
                                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', color: '#94a3b8' }}
                                />
                              </td>
                              {familyDetailColumns.map((key) => (
                                <td key={`${rowKey}-${key}`}>
                                  {key === 'familyName' ? (
                                    <strong>{row.familyName || '-'}</strong>
                                  ) : (
                                    key === 'serialNumber' ? idx + 1 : renderFamilyDetailValue(row, key)
                                  )}
                                </td>
                              ))}
                              <td>
                                <button
                                  type="button"
                                  className="mobile-web-secondary-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    tryOpenFamilyEdit(row.familyId, 'LIST');
                                  }}
                                  disabled={editFamilyLoading}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr>
                                <td colSpan={familyDetailColumns.length + 2} style={{ background: '#f8fafc', padding: '12px 16px' }}>
                                  {row.members?.length ? (
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Family Members</div>
                                      {row.members.map((m, memberIndex) => (
                                        <div key={m.memberId || `${rowKey}-member-${memberIndex}`} style={{ fontSize: '0.85rem', padding: '4px 0' }}>
                                          {memberIndex + 1}. {m.voterName || '-'} · {m.epicNo || '-'} · {getFamilyMemberRelationName(m)} · {m.relationType || '-'}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No member details available</div>
                                  )}
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {familyDetailHasMore ? (
                    <div ref={familyDetailLazySentinelRef} className="mobile-web-lazy-load-sentinel">
                      <span>
                        Scroll for more families ({familyDetailRows.length}
                        {familyDetailTotal ? ` of ${familyDetailTotal}` : ''})
                      </span>
                    </div>
                  ) : null}
                  <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                    {familyDetailRows.length}
                    {familyDetailTotal ? ` of ${familyDetailTotal}` : ''} families loaded · click a row to expand member details
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </ScreenFrame>
  );
}

function MeetingsScreen({ userRole, assemblyCodeProp }) {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(meetings[0]);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    start: '',
    end: '',
    latitude: '',
    longitude: '',
    radius: 100,
  });
  const [newMeetingRecipients, setNewMeetingRecipients] = useState({
    assembly: false,
    ward: false,
    booth: false,
  });
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [meetingMessage, setMeetingMessage] = useState('');
  const [newMeetingChannels, setNewMeetingChannels] = useState({ appAlert: true, whatsapp: false });
  const meetingsMainSubtabKey = useMemo(
    () => subtabStorageKey('meetings', assemblyCodeProp || 'default'),
    [assemblyCodeProp],
  );
  const meetingsListSubtabKey = useMemo(
    () => subtabStorageKey('meetings-list', assemblyCodeProp || 'default'),
    [assemblyCodeProp],
  );
  const [activeMeetingTab, setActiveMeetingTab] = usePersistedSubtab(meetingsMainSubtabKey, 'list', ['list', 'new']);
  const [activeSubTab, setActiveSubTab] = usePersistedSubtab(meetingsListSubtabKey, 'details', ['details', 'attendance']);
  const [mounted, setMounted] = useState(false);

  const role = useMemo(() => {
    if (!mounted) return '';
    return String(userRole || '').replace('ROLE_', '').toUpperCase();
  }, [userRole, mounted]);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(role);
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const rec = String(m.recipients || '').toLowerCase();
      if (!rec) return true; // Default to public if no recipients specified
      const list = rec.split(',').map(s => s.trim());

      // If "assembly" is checked, only admins see it
      if (list.includes('assembly')) {
        return isAdmin;
      }

      // If "ward" is checked, only ward upwards see it
      if (list.includes('ward')) {
        return isAdmin || role === 'WARD';
      }

      // If "booth" is checked, everyone can see it (or booth upwards)
      if (list.includes('booth')) {
        return true;
      }

      return true;
    });
  }, [meetings, role, isAdmin]);
  const mapRef = useRef(null);
  const osmMapRef = useRef(null);
  const newMapRef = useRef(null);
  const newOsmMapRef = useRef(null);
  const newOsmMarkerRef = useRef(null);
  const newMeetingLocInitRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    fetchMeetingsList();
  }, []);

  const fetchMeetingsList = async () => {
    try {
      const res = await mobileApi.fetchMeetings();
      const list = Array.isArray(res) ? res : res?.data || res?.result || [];
      setMeetings(list);
    } catch (err) {
      console.log('Failed to fetch meetings');
    }
  };

  const handleSaveMeeting = async () => {
    try {
      setMeetingMessage('Saving meeting...');
      const recipients = Object.keys(newMeetingRecipients).filter((k) => newMeetingRecipients[k]).join(',');
      const channels = Object.keys(newMeetingChannels).filter((k) => newMeetingChannels[k]).join(',');
      const payload = {
        title: newMeeting.title,
        start_time: newMeeting.start,
        end_time: newMeeting.end,
        latitude: parseFloat(newMeeting.latitude) || 0,
        longitude: parseFloat(newMeeting.longitude) || 0,
        radius: parseInt(newMeeting.radius) || 100,
        recipients,
        channels
      };
      await mobileApi.createMeeting(payload);
      setMeetingMessage('Meeting saved successfully!');
      setTimeout(() => {
        setMeetingMessage('');
        setActiveMeetingTab('list');
        fetchMeetingsList();
      }, 1500);
    } catch (err) {
      setMeetingMessage(err?.message || err?.detail || 'Failed to save meeting.');
    }
  };

  const handleRecordAttendance = async () => {
    if (!selectedMeeting?.id) return;
    try {
      setAttendanceLoading(true);
      const res = await mobileApi.recordMeetingAttendance(selectedMeeting.id);
      const added = res?.added || res?.data?.added || res?.data?.result?.added || 0;
      setMeetingMessage(`Success: ${added} voters discovered within radius.`);
      loadAttendance(selectedMeeting.id);
      setTimeout(() => setMeetingMessage(''), 4000);
    } catch (err) {
      setMeetingMessage('Failed to record attendance. Ensure map settings and voter locations are correct.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleAttendSelf = async () => {
    if (!selectedMeeting?.id) return;
    try {
      setAttendanceLoading(true);
      setMeetingMessage('Capturing location...');
      let lat = null;
      let lng = null;
      try {
        const pos = await requestLocation({ allowCached: false });
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (err) {
        console.warn('Location access denied or failed. Attendance will be recorded without distance.');
      }
      await mobileApi.attendMeetingSelf(selectedMeeting.id, lat, lng);
      setMeetingMessage('Success: You have marked your attendance.');
      loadAttendance(selectedMeeting.id);
      setTimeout(() => setMeetingMessage(''), 3000);
    } catch (err) {
      setMeetingMessage('Failed to mark attendance.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadAttendance = async (id) => {
    try {
      setAttendanceLoading(true);
      const res = await mobileApi.fetchMeetingAttendance(id);
      const list = Array.isArray(res) ? res : res?.data || res?.result || [];
      setAttendanceList(list);
    } catch (err) {
      console.log('Failed to list attendance');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const syncMap = async (meeting) => {
    if (!mapRef.current) return;
    try {
      if (osmMapRef.current) {
        destroyOsmMap(osmMapRef.current);
        osmMapRef.current = null;
      }
      const lat = Number(meeting?.latitude) || 12.9716;
      const lng = Number(meeting?.longitude) || 77.5946;
      const { map } = await buildClickableOsmMap(mapRef.current, {
        lat,
        lng,
        zoom: 14,
        draggable: false,
        onPositionChange: (clickLat, clickLng) => {
          setSelectedMeeting((prev) => (prev ? { ...prev, latitude: clickLat, longitude: clickLng } : prev));
        },
      });
      osmMapRef.current = map;
    } catch {
      // ignore map errors
    }
  };

  useEffect(() => {
    if (selectedMeeting) syncMap(selectedMeeting);
    return () => {
      if (osmMapRef.current) {
        destroyOsmMap(osmMapRef.current);
        osmMapRef.current = null;
      }
    };
  }, [selectedMeeting]);

  const initNewMeetingMap = async () => {
    if (!newMapRef.current || newOsmMapRef.current) return;
    try {
      const lat = Number(newMeeting.latitude) || 12.9716;
      const lng = Number(newMeeting.longitude) || 77.5946;
      const { map, marker } = await buildDraggableOsmMap(newMapRef.current, {
        lat,
        lng,
        zoom: 14,
        onPositionChange: (dragLat, dragLng) => {
          setNewMeeting((prev) => ({
            ...prev,
            latitude: dragLat.toFixed(6),
            longitude: dragLng.toFixed(6),
          }));
        },
      });
      newOsmMapRef.current = map;
      newOsmMarkerRef.current = marker;
    } catch {
      // ignore map errors
    }
  };

  useEffect(() => {
    initNewMeetingMap();
    return () => {
      if (newOsmMapRef.current) {
        destroyOsmMap(newOsmMapRef.current);
        newOsmMapRef.current = null;
        newOsmMarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!newOsmMarkerRef.current) return;
    const lat = Number(newMeeting.latitude) || 12.9716;
    const lng = Number(newMeeting.longitude) || 77.5946;
    newOsmMarkerRef.current.setPosition({ lat, lng });
    newOsmMapRef.current?.panTo({ lat, lng });
  }, [newMeeting.latitude, newMeeting.longitude]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setNewMeeting((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      },
      () => { }
    );
  };

  useEffect(() => {
    if (activeMeetingTab !== 'new') return;
    if (newMeetingLocInitRef.current) return;
    newMeetingLocInitRef.current = true;
    requestLocation({ allowCached: true })
      .then((pos) => {
        setNewMeeting((prev) => ({
          ...prev,
          latitude: prev.latitude || Number(pos.latitude).toFixed(6),
          longitude: prev.longitude || Number(pos.longitude).toFixed(6),
        }));
      })
      .catch(() => { });
  }, [activeMeetingTab]);

  useEffect(() => {
    setMeetings((prev) => prev.map((m) => (m.id === selectedMeeting?.id ? selectedMeeting : m)));
  }, [selectedMeeting]);

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-meetings-shell">
        <div className="mobile-web-subtabs">
          {[
            { key: 'list', label: 'Meetings' },
            { key: 'new', label: 'New Meeting' },
          ].filter(t => t.key !== 'new' || ['SUPER_ADMIN', 'ADMIN'].includes(userRole)).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`mobile-web-subtab ${activeMeetingTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveMeetingTab(tab.key);
                if (tab.key === 'new') {
                  handleUseMyLocation();
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeMeetingTab === 'list' ? (
          <div className="mobile-web-meeting-grid">
            {filteredMeetings.map((meeting) => (
              <div key={meeting.id} className="mobile-web-meeting-card">
                <div>
                  <h3>{meeting.title}</h3>
                  <p>{meeting.dateTime}</p>
                  <p className="mobile-web-muted">{meeting.description}</p>
                  <div className="mobile-web-role-list">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter mr-1">Invited:</span>
                    {(meeting.recipients || 'All').split(',').map(r => (
                      <span key={r} className="mobile-web-tag-mini">{r}</span>
                    ))}
                  </div>
                  <p className="mobile-web-muted">Location: {(meeting.latitude || 0).toFixed(4)}, {(meeting.longitude || 0).toFixed(4)} · Radius: {meeting.radius} m</p>
                </div>
                <button
                  className="mobile-web-secondary-btn"
                  type="button"
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {activeMeetingTab === 'new' ? (
          <div className="mobile-web-meeting-detail">
            <h3>New meeting</h3>
            <div className="mobile-web-meeting-detail-card">
              <div className="mobile-web-field">
                <label>Meeting Name</label>
                <input
                  className="mobile-web-input"
                  placeholder="Meeting Name"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="mobile-web-form-grid">
                <div className="mobile-web-field">
                  <label>Start (local)</label>
                  <input
                    className="mobile-web-input"
                    type="datetime-local"
                    value={newMeeting.start}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="mobile-web-field">
                  <label>End (optional)</label>
                  <input
                    className="mobile-web-input"
                    type="datetime-local"
                    value={newMeeting.end}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mobile-web-form-grid">
                <div className="mobile-web-field">
                  <label>Latitude</label>
                  <input
                    className="mobile-web-input"
                    placeholder="Latitude"
                    value={newMeeting.latitude}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, latitude: e.target.value }))}
                  />
                </div>
                <div className="mobile-web-field">
                  <label>Longitude</label>
                  <input
                    className="mobile-web-input"
                    placeholder="Longitude"
                    value={newMeeting.longitude}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, longitude: e.target.value }))}
                  />
                </div>
                <div className="mobile-web-field">
                  <label>Radius (m)</label>
                  <input
                    className="mobile-web-input"
                    type="number"
                    value={newMeeting.radius}
                    onChange={(e) => setNewMeeting((prev) => ({ ...prev, radius: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="mobile-web-meeting-recipient">
                <h4>Recipients</h4>
                <div className="mobile-web-checkbox-grid">
                  {[
                    ['assembly', 'Assembly'],
                    ['ward', 'Ward'],
                    ['booth', 'Booth'],
                  ].map(([key, label]) => (
                    <label key={key} className="mobile-web-checkbox">
                      <input
                        type="checkbox"
                        checked={newMeetingRecipients[key]}
                        onChange={() => setNewMeetingRecipients((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mobile-web-meeting-recipient">
                <h4>Channels</h4>
                <div className="mobile-web-checkbox-grid mobile-web-checkbox-grid-tight">
                  {[
                    ['whatsapp', 'WhatsApp'],
                  ].map(([key, label]) => (
                    <label key={key} className="mobile-web-checkbox">
                      <input
                        type="checkbox"
                        checked={newMeetingChannels[key]}
                        onChange={() => setNewMeetingChannels((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mobile-web-meeting-map" ref={newMapRef} />
              <div className="mobile-web-meeting-footer">
                <button type="button" className="mobile-web-secondary-btn" onClick={handleUseMyLocation}>
                  Use my location
                </button>
                <button type="button" className="mobile-web-primary-btn" onClick={handleSaveMeeting}>
                  Save Meeting
                </button>
              </div>
              {meetingMessage && <div className="mobile-web-success" style={{ marginTop: '12px' }}>{meetingMessage}</div>}
            </div>
          </div>
        ) : null}
        {activeMeetingTab !== 'new' && meetingMessage && (
          <div className="mobile-web-success" style={{ marginBottom: '16px' }}>{meetingMessage}</div>
        )}
        {activeMeetingTab === 'list' && (
          <div className="mobile-web-meeting-detail">
          {selectedMeeting ? (
            <div className="mobile-web-meeting-detail-card" style={{ borderTop: '2px solid var(--accent-light)', paddingTop: '24px' }}>
              <div className="mobile-web-subtabs" style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`mobile-web-subtab ${!activeSubTab || activeSubTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('details')}
                >
                  Details
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className={`mobile-web-subtab ${activeSubTab === 'attendance' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSubTab('attendance');
                      loadAttendance(selectedMeeting.id);
                    }}
                  >
                    Attendance
                  </button>
                )}
              </div>

              {!activeSubTab || activeSubTab === 'details' ? (
                <>
                  <h4>{selectedMeeting.title}</h4>
                  <p>{selectedMeeting.dateTime}</p>
                  <p className="mobile-web-muted">{selectedMeeting.description}</p>
                  <div className="mobile-web-role-list mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter mr-1">Invited:</span>
                    {(selectedMeeting.recipients || 'All').split(',').map(r => (
                      <span key={r} className="mobile-web-tag-mini">{r}</span>
                    ))}
                  </div>
                  <p className="mobile-web-muted">
                    Location: {(selectedMeeting.latitude || 0).toFixed(4)}, {(selectedMeeting.longitude || 0).toFixed(4)} · Radius: {selectedMeeting.radius} m
                  </p>
                  <div className="mobile-web-meeting-map" ref={mapRef} style={{ height: '200px', margin: '16px 0', borderRadius: '12px', background: '#f8fafc' }} />
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      className="mobile-web-primary-btn flex-1"
                      type="button"
                      onClick={handleAttendSelf}
                      disabled={attendanceLoading}
                    >
                      Record my Attendance
                    </button>
                    {isSuperAdmin && (
                      <button
                        className="mobile-web-secondary-btn flex-1"
                        type="button"
                        onClick={handleRecordAttendance}
                        disabled={attendanceLoading}
                      >
                        Scan Radius (Admins)
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="mobile-web-meeting-attendance">
                  {attendanceLoading ? (
                    <div className="mobile-web-empty">Loading attendance...</div>
                  ) : attendanceList.length === 0 ? (
                    <div className="mobile-web-empty">No attendance recorded yet. Ensure voters have location setup.</div>
                  ) : (
              <div className="mobile-web-analysis-table-wrap mobile-web-analysis-table-scroll">
                <table className="mobile-web-analysis-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Distance</th>
                            <th>Marked At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceList.map((a) => {
                            const dateObj = a.at ? new Date(a.at) : null;
                            const timeStr = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
                            const dateStr = dateObj ? dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '';
                            return (
                              <tr key={a.id}>
                                <td className="font-medium text-slate-800">{a.name}</td>
                                <td className="text-slate-600">{a.phone || '-'}</td>
                                <td className="text-slate-500 italic">
                                  {a.distance !== null && a.distance !== undefined ? (
                                    <span className="text-blue-600 font-bold not-italic">{a.distance.toFixed(1)} m</span>
                                  ) : (
                                    'No GPS'
                                  )}
                                </td>
                                <td className="text-[10px] text-slate-500">
                                  <div className="font-bold text-slate-700">{timeStr}</div>
                                  <div>{dateStr}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
        )}
      </section>
    </ScreenFrame>
  );
}

const POLL_PAGE_SIZE = 100;

function isPollVotedStatus(status) {
  const s = String(status || '').toUpperCase();
  return s.includes('VOTED') && !s.includes('NOT');
}

function isPollNotVotedStatus(status) {
  return String(status || '').toUpperCase().includes('NOT');
}

function PollDayScreen({ assemblyCodeProp, isSuperAdmin }) {
  const pollDaySubtabKey = useMemo(
    () => subtabStorageKey('poll-day', assemblyCodeProp || 'default'),
    [assemblyCodeProp],
  );
  const [tab, setTab] = usePersistedSubtab(pollDaySubtabKey, 'ALL', ['ALL', 'VOTED', 'NOT VOTED']);
  const [natureFilter, setNatureFilter] = useState('');
  const [pollQuery, setPollQuery] = useState('');
  const [pollRelationQuery, setPollRelationQuery] = useState('');
  const [pollSuggestions, setPollSuggestions] = useState([]);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollLoadingMore, setPollLoadingMore] = useState(false);
  const [showPollSuggestions, setShowPollSuggestions] = useState(false);
  const [pollVoters, setPollVoters] = useState([]);
  const [pollPage, setPollPage] = useState(0);
  const [pollHasMore, setPollHasMore] = useState(false);
  const [pollMeta, setPollMeta] = useState(null);
  const [pollError, setPollError] = useState('');
  const [pollDayEnabled, setPollDayEnabled] = useState(false);
  const [globalPollDayEnabled, setGlobalPollDayEnabled] = useState(false);
  const pollSearchTimerRef = useRef(null);

  useEffect(() => {
    const checkActivation = async () => {
      try {
        const globalConfig = await mobileApi.fetchPollDayConfig(null, null);
        setGlobalPollDayEnabled(globalConfig.enabled);

        const config = await mobileApi.fetchPollDayConfig(assemblyCodeProp);
        setPollDayEnabled(config.enabled);
      } catch (err) {
        setPollDayEnabled(false);
        setGlobalPollDayEnabled(false);
      }
    };
    checkActivation();
  }, [assemblyCodeProp]);

  const handleToggleActivation = async (val) => {
    try {
      await mobileApi.updatePollDayConfig(assemblyCodeProp, null, val);
      setPollDayEnabled(val);
    } catch (err) {
      setPollError('Failed to update activation.');
    }
  };

  const handleToggleGlobalActivation = async (val) => {
    try {
      await mobileApi.updatePollDayConfig(null, null, val);
      setGlobalPollDayEnabled(val);
      // Sync the assembly-specific toggle as well
      await mobileApi.updatePollDayConfig(assemblyCodeProp, null, val);
      setPollDayEnabled(val);
    } catch (err) {
      setPollError('Failed to update global activation.');
    }
  };

  const buildPollDisplay = (item) => {
    const name = [item.firstMiddleNameEn, item.lastNameEn].filter(Boolean).join(' ').trim();
    const rawStatus = item.votingStatus || item.voteStatus || item.status || item.votedStatus || '';
    const normalizedStatus = String(rawStatus).toUpperCase();
    return {
      id: item.epicNo || item.voterId || `${name}-${Date.now()}`,
      name: name || item.name || item.voterName || item.epicNo || 'Unknown',
      epic: item.epicNo || item.epic || '',
      phone: item.mobile || item.phone || '',
      houseNo: item.houseNoEn || item.houseNoLocal || '',
      natureOfVoter: item.natureOfVoter || item.nature || '',
      boothNo: item.boothNo || item.boothNumber || item.booth || '',
      wardCode: item.wardCode || '',
      votedStatus: normalizedStatus || '',
    };
  };

  const handleToggleVoted = async (voter, newStatus) => {
    if (!pollDayEnabled && !globalPollDayEnabled) {
      setPollError('Poll Day is currently not active. Please enable activation using the checkbox above.');
      return;
    }
    try {
      await mobileApi.updateVoterStatus(voter.epic, newStatus, voter.wardCode, voter.boothNo);
      setPollVoters((prev) =>
        prev.map((v) => (v.id === voter.id ? { ...v, votedStatus: newStatus } : v))
      );
    } catch (err) {
      setPollError('Failed to update status.');
    }
  };

  const parsePollSearchResponse = (res) => {
    const result = res?.data?.result || res?.result || [];
    const meta = res?.data?.meta || res?.meta || {};
    const list = Array.isArray(result) ? result : (Array.isArray(res?.data) ? res.data : []);
    return { list, meta };
  };

  const runPollVoterFetch = async (nextPage = 0, queryValue = pollQuery, append = false) => {
    const isFirstPage = nextPage === 0 && !append;
    if (isFirstPage) {
      setPollLoading(true);
    } else {
      setPollLoadingMore(true);
    }
    setPollError('');
    try {
      const res = await mobileApi.searchVoters({
        assemblyCode: assemblyCodeProp,
        searchQuery: queryValue.trim() || undefined,
        relationName: pollRelationQuery.trim() || undefined,
        page: nextPage,
        size: POLL_PAGE_SIZE,
      });
      const { list, meta } = parsePollSearchResponse(res);
      setPollMeta(meta);
      setPollHasMore(Boolean(meta?.hasMore));
      setPollPage(nextPage);
      const mapped = list.map(buildPollDisplay);
      setPollVoters((prev) => {
        if (!append) return mapped;
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...mapped.filter((v) => !seen.has(v.id))];
      });
      return list;
    } catch (error) {
      if (!append) {
        setPollError('Unable to load voters. Please try again.');
        setPollVoters([]);
        setPollMeta(null);
        setPollHasMore(false);
      }
      return [];
    } finally {
      if (isFirstPage) setPollLoading(false);
      else setPollLoadingMore(false);
    }
  };

  const fetchPollSuggestions = async (queryValue) => {
    if (!queryValue.trim()) {
      setPollSuggestions([]);
      return;
    }
    try {
      const res = await mobileApi.searchVoters({
        assemblyCode: assemblyCodeProp,
        searchQuery: queryValue.trim(),
        relationName: pollRelationQuery.trim() || undefined,
        page: 0,
        size: 20,
      });
      const { list } = parsePollSearchResponse(res);
      setPollSuggestions(list);
    } catch (error) {
      setPollSuggestions([]);
    }
  };

  const loadMorePollVoters = async () => {
    if (pollLoading || pollLoadingMore || !pollHasMore) return;
    await runPollVoterFetch(pollPage + 1, pollQuery, true);
  };

  useEffect(() => {
    if (pollSearchTimerRef.current) {
      clearTimeout(pollSearchTimerRef.current);
    }
    pollSearchTimerRef.current = setTimeout(() => {
      const query = pollQuery.trim();
      if (query) {
        setShowPollSuggestions(true);
        fetchPollSuggestions(query);
      } else {
        setPollSuggestions([]);
        setShowPollSuggestions(false);
      }
      runPollVoterFetch(0, pollQuery, false);
    }, 400);
    return () => {
      if (pollSearchTimerRef.current) {
        clearTimeout(pollSearchTimerRef.current);
      }
    };
  }, [pollQuery, pollRelationQuery, assemblyCodeProp]);

  const pollTabCounts = useMemo(() => {
    const all = Number(pollMeta?.total ?? pollVoters.length) || 0;
    const voted = pollVoters.filter((v) => isPollVotedStatus(v.votedStatus)).length;
    const notVoted = pollVoters.filter((v) => isPollNotVotedStatus(v.votedStatus)).length;
    return { all, voted, notVoted };
  }, [pollVoters, pollMeta]);

  const pollSentinelRef = useInfiniteTrigger(Boolean(pollHasMore) && !pollLoading && !pollLoadingMore, loadMorePollVoters);

  const handlePollSuggestion = (item) => {
    const name = [item.firstMiddleNameEn, item.lastNameEn].filter(Boolean).join(' ').trim();
    setPollQuery(name || item.epicNo || '');
    setShowPollSuggestions(false);
    setPollSuggestions([]);
  };

  const filteredPollVoters = useMemo(() => {
    let list = [...pollVoters];
    if (natureFilter) {
      list = list.filter((v) => String(v.natureOfVoter || '').toUpperCase() === natureFilter);
    }
    if (tab === 'VOTED') {
      list = list.filter((v) => isPollVotedStatus(v.votedStatus));
    } else if (tab === 'NOT VOTED') {
      list = list.filter((v) => isPollNotVotedStatus(v.votedStatus));
    }
    return list;
  }, [pollVoters, natureFilter, tab]);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-pollday-shell">
        
        {isSuperAdmin && (
          <div className="mobile-web-action-row" style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--accent-light)', marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', width: 'fit-content' }}>
              <input 
                type="checkbox" 
                style={{ width: '20px', height: '20px', cursor: 'pointer', margin: 0 }}
                checked={globalPollDayEnabled} 
                onChange={(e) => handleToggleGlobalActivation(e.target.checked)}
              />
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent-dark)', whiteSpace: 'nowrap' }}>
                Enable Poll Day Globally (All Constituencies)
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', width: 'fit-content' }}>
              <input 
                type="checkbox" 
                style={{ width: '20px', height: '20px', cursor: 'pointer', margin: 0 }}
                checked={pollDayEnabled} 
                onChange={(e) => handleToggleActivation(e.target.checked)}
              />
              <span style={{ fontSize: '15px', fontWeight: '500', color: '#374151', whiteSpace: 'nowrap' }}>
                Enable Poll Day for this Assembly only
              </span>
            </label>
          </div>
        )}

        {(!pollDayEnabled && !globalPollDayEnabled) && (
          <div className="mobile-web-info-pill" style={{ margin: '0 24px 20px', background: '#fffbeb', color: '#92400e', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
            Poll Day is currently not active. Please contact Admin for activation.
          </div>
        )}

        <div className="mobile-web-pollday-top">
          <div className="mobile-web-search-input-wrap mobile-web-member-search">
            <SearchRounded className="mobile-web-search-icon" />
            <input
              className="mobile-web-input"
              placeholder="Search voter by EPIC or name"
              value={pollQuery}
              onChange={(e) => setPollQuery(e.target.value)}
              onFocus={() => {
                if (pollQuery.trim()) setShowPollSuggestions(true);
              }}
            />
            {showPollSuggestions ? (
              <div className="mobile-web-suggestion-panel">
                <div className="mobile-web-suggestion-search">
                  <input
                    className="mobile-web-input"
                    placeholder="Search by relation"
                    value={pollRelationQuery}
                    onChange={(e) => setPollRelationQuery(e.target.value)}
                  />
                </div>
                {pollLoading ? <div className="mobile-web-suggestion-empty">Searching...</div> : null}
                {!pollLoading && pollSuggestions.length === 0 ? (
                  <div className="mobile-web-suggestion-empty">No voters found.</div>
                ) : null}
                {!pollLoading && pollSuggestions.length > 0 ? (
                  <div className="mobile-web-suggestion-list">
                    {pollSuggestions.map((item) => {
                      const name = [item.firstMiddleNameEn, item.lastNameEn].filter(Boolean).join(' ').trim();
                      return (
                        <button
                          key={`${item.epicNo}-${item.voterId}`}
                          type="button"
                          className="mobile-web-suggestion-item"
                          onClick={() => handlePollSuggestion(item)}
                        >
                          <div>
                            <div className="mobile-web-suggestion-name">{name || item.epicNo || 'Unknown'}</div>
                            <div className="mobile-web-suggestion-meta">
                              {item.epicNo || '-'} · {item.houseNoEn || item.houseNoLocal || 'House -'} · {item.mobile || 'No phone'}
                            </div>
                          </div>
                          <span className="mobile-web-suggestion-action">Open</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mobile-web-pollday-grid">
          <div className="mobile-web-pollday-left">
            <div className="mobile-web-tabs">
              {['ALL', 'VOTED', 'NOT VOTED'].map((item) => {
                const count =
                  item === 'ALL' ? pollTabCounts.all :
                  item === 'VOTED' ? pollTabCounts.voted :
                  pollTabCounts.notVoted;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`mobile-web-tab-pill ${tab === item ? 'active' : ''}`}
                    onClick={() => setTab(item)}
                  >
                    {item} ({count})
                  </button>
                );
              })}
              <div
                className="mobile-web-select-wrap mobile-web-nature-select"
                ref={dropdownRef}
                style={{ position: 'relative' }}
              >
                {/* Trigger */}
                <div
                  className="mobile-web-input mobile-web-small-select"
                  onClick={() => setIsOpen((prev) => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',        // vertically centers both children
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    minHeight: '44px',           // ensure consistent height
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{natureFilter || 'Nature'}</span>
                  <ExpandMoreRounded
                    className="mobile-web-select-icon"
                    style={{
                      display: 'flex',
                      alignSelf: 'center',       // force icon to center regardless of parent
                      transform: isOpen ? 'rotate(180deg)' : '',
                      transition: 'transform 0.2s',
                      flexShrink: 0,
                    }}
                  />
                </div>

                {/* Dropdown list — rendered inside the wrapper */}
                {isOpen && (
                  <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 999,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    marginTop: '4px',
                    padding: '4px 0',
                    listStyle: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}>
                    <li
                      onClick={() => { setNatureFilter(''); setIsOpen(false); }}
                      style={{ padding: '8px 16px', cursor: 'pointer' }}
                    >
                      Nature
                    </li>
                    {['A', 'B', 'C', 'NA'].map((item) => (
                      <li
                        key={item}
                        onClick={() => { setNatureFilter(item); setIsOpen(false); }}
                        style={{ padding: '8px 16px', cursor: 'pointer' }}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {pollError ? <div className="mobile-web-error">{pollError}</div> : null}
            <div className="mobile-web-pollday-list">
              {pollLoading && pollVoters.length === 0 ? (
                <div className="mobile-web-table-empty">Loading voters...</div>
              ) : null}
              {!pollLoading && filteredPollVoters.length === 0 ? (
                <div className="mobile-web-table-empty">No voters found.</div>
              ) : null}
              {!pollLoading && pollVoters.length > 0 && pollMeta?.total ? (
                <div className="mobile-web-table-empty" style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: '#64748b' }}>
                  Showing {pollVoters.length} of {pollMeta.total} voters
                  {pollHasMore ? ' — scroll for more' : ''}
                </div>
              ) : null}
              {filteredPollVoters.map((voter) => {
                const phoneValue = normalizeMobileValue(voter.phone);
                const statusRaw = String(voter.votedStatus || '');
                const isVoted = isPollVotedStatus(statusRaw);
                const isNotVoted = isPollNotVotedStatus(statusRaw);
                return (
                  <div key={voter.id} className="mobile-web-pollday-card">
                    <div className="mobile-web-avatar-circle">{(voter.name || 'V')[0]}</div>
                    <div className="mobile-web-pollday-info">
                      <h4>{voter.name}</h4>
                      <p>{voter.epic || '-'}</p>
                      <p className="mobile-web-pollday-phone">{voter.phone || '-'}</p>
                      <div className="mobile-web-chip-row">
                        <span className="mobile-web-chip neutral">{voter.natureOfVoter || 'NA'}</span>
                        {voter.boothNo ? (
                          <span className="mobile-web-chip neutral">{voter.boothNo}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mobile-web-pollday-card-actions">
                      <div className="mobile-web-pollday-status">
                        <button 
                          className={`mobile-web-pill ${isVoted ? 'success' : ''} ${(!pollDayEnabled && !globalPollDayEnabled && !isSuperAdmin) ? 'disabled' : ''}`} 
                          type="button"
                          onClick={() => handleToggleVoted(voter, 'VOTED')}
                        >
                          VOTED
                        </button>
                        <button 
                          className={`mobile-web-pill ${isNotVoted ? 'danger' : ''} ${(!pollDayEnabled && !globalPollDayEnabled && !isSuperAdmin) ? 'disabled' : ''}`} 
                          type="button"
                          onClick={() => handleToggleVoted(voter, 'NOT VOTED')}
                        >
                          NOT VOTED
                        </button>
                      </div>
                      <a
                        className={`mobile-web-call-btn ${phoneValue ? '' : 'disabled'}`}
                        href={phoneValue ? `tel:${phoneValue}` : undefined}
                        onClick={(e) => {
                          if (!phoneValue) e.preventDefault();
                        }}
                        title={phoneValue ? `Call ${phoneValue}` : 'No phone number'}
                      >
                        <PhoneOutlined fontSize="small" />
                      </a>
                    </div>
                  </div>
                );
              })}
              {pollHasMore ? (
                <div ref={pollSentinelRef} className="mobile-web-table-empty" style={{ gridColumn: '1 / -1' }}>
                  {pollLoadingMore ? 'Loading more voters...' : 'Scroll to load more'}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </ScreenFrame>
  );
}

function getApiToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('X_INIT_TOKEN') || localStorage.getItem('token') || '';
}

function ExtractScreen({ assemblyCodeProp }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ phase: '', percent: 0 });
  const [includeDebug, setIncludeDebug] = useState(false);
  const processingTimerRef = useRef(null);

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose a PDF file.');
      return;
    }
    setStatus('Uploading and extracting...');
    setProgress({ phase: 'upload', percent: 0 });
    setError('');
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const contextPath = process.env.NEXT_PUBLIC_CONTEXT_PATH || '/votebase/v1';
    const url = `${apiBase}${contextPath}/api/extract/pdf-to-excel${includeDebug ? '?debug=true' : ''}`;
    try {
      const form = new FormData();
      form.append('file', file);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.responseType = 'blob';
        const token = getApiToken();
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const pct = Math.round((event.loaded / event.total) * 40);
          setProgress({ phase: 'upload', percent: pct });
        };
        xhr.upload.onload = () => {
          if (processingTimerRef.current) {
            clearInterval(processingTimerRef.current);
          }
          setStatus('Processing PDF (Textract / OCR if needed)...');
          setProgress({ phase: 'processing', percent: 40 });
          processingTimerRef.current = setInterval(() => {
            setProgress((prev) => {
              if (prev.phase !== 'processing') return prev;
              const next = Math.min(prev.percent + 2, 90);
              return { phase: 'processing', percent: next };
            });
          }, 1200);
        };
        xhr.onprogress = (event) => {
          if (!event.lengthComputable) return;
          if (processingTimerRef.current) {
            clearInterval(processingTimerRef.current);
          }
          const pct = 90 + Math.round((event.loaded / event.total) * 10);
          setProgress({ phase: 'download', percent: Math.min(pct, 100) });
        };
        xhr.onload = () => {
          const parseErrorBlob = async (blob) => {
            try {
              const text = await blob.text();
              try {
                const j = JSON.parse(text);
                return j.message || j.detail || j.error || text;
              } catch {
                return text || 'Extraction failed.';
              }
            } catch {
              return 'Extraction failed.';
            }
          };
          if (xhr.status >= 200 && xhr.status < 300) {
            const blob = xhr.response;
            const ctype = xhr.getResponseHeader('content-type') || '';
            if (ctype.includes('application/json')) {
              parseErrorBlob(blob).then((msg) => reject(new Error(msg)));
              return;
            }
            const urlObj = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlObj;
            link.download = 'extract.xlsx';
            link.click();
            window.URL.revokeObjectURL(urlObj);
            resolve();
          } else {
            parseErrorBlob(xhr.response).then((msg) => reject(new Error(msg)));
          }
        };
        xhr.onerror = () => reject(new Error('Network error — check API base URL and CORS.'));
        xhr.send(form);
      });
      setStatus('Download finished — check your extract.xlsx file.');
    } catch (err) {
      setError(err?.message || 'Extraction failed.');
      setStatus('');
    } finally {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
        processingTimerRef.current = null;
      }
      setProgress({ phase: '', percent: 0 });
    }
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-extract-shell">
        <div className="mobile-web-stack">
          <div className="mobile-web-field">
            <label>PDF File</label>
            <input
              className="mobile-web-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <label className="mobile-web-field mobile-web-checkbox-row">
            <input
              type="checkbox"
              checked={includeDebug}
              onChange={(e) => setIncludeDebug(e.target.checked)}
            />
            <span>Include DEBUG sheet (larger file)</span>
          </label>
          <button type="button" className="mobile-web-primary-btn" onClick={handleUpload}>
            Extract to Excel
          </button>
          {progress.phase ? (
            <div className="mobile-web-progress">
              <div className="mobile-web-progress-label">
                {progress.phase === 'upload'
                  ? `Uploading: ${progress.percent}%`
                  : progress.phase === 'processing'
                    ? `Processing with Textract: ${progress.percent}%`
                    : `Downloading: ${progress.percent}%`}
              </div>
              <div className="mobile-web-progress-bar">
                <span style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          ) : null}
          {status ? <div className="mobile-web-info-pill">{status}</div> : null}
          {error ? <div className="mobile-web-error">{error}</div> : null}
          <div className="mobile-web-extract-note">
            Upload your PDF (e.g. <code>4_9_14_EPUB.pdf</code>). Set <code>NEXT_PUBLIC_API_BASE_URL</code> to your API
            origin; optional <code>NEXT_PUBLIC_CONTEXT_PATH</code> defaults to <code>/votebase/v1</code>. Scanned PDFs need
            AWS Textract (<code>EXTRACT_S3_BUCKET</code> + credentials) or local <code>tesseract</code> + <code>pdftoppm</code>.
          </div>
        </div>
      </section>
    </ScreenFrame>
  );
}

function PrintScreen({ assemblyCodeProp }) {
  const [printers, setPrinters] = useState([]);
  const [connectedPrinter, setConnectedPrinter] = useState(null);
  const [scanStatus, setScanStatus] = useState('');
  const [scanError, setScanError] = useState('');
  const [writeChar, setWriteChar] = useState(null);

  // Ward / Booth / Voter state
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [booths, setBooths] = useState([]);
  const [selectedBooth, setSelectedBooth] = useState('');
  const [voters, setVoters] = useState([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [printingIdx, setPrintingIdx] = useState(-1);
  const [pHydrated, setPHydrated] = useState(false);
  const [assemblySnapshot, setAssemblySnapshot] = useState(null);
  const [printTemplate, setPrintTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => { setPHydrated(true); }, []);

  // Load assembly data (same as BoothSearch)
  useEffect(() => {
    if (!pHydrated) return;
    const assemblyId = assemblyCodeProp || getAssemblyCode();
    if (!assemblyId) return;
    (async () => {
      try {
        const response = await mobileApi.loadDataLite(assemblyId);
        const snapshot = await resolveSnapshot(response);
        setAssemblySnapshot(snapshot);
        const wardList = (snapshot?.assembly?.wards || []).map(w => ({
          label: w.wardNameEn || `Ward ${w.wardId}`,
          value: String(w.wardId),
        })).sort((a, b) => a.label.localeCompare(b.label));
        setWards(wardList);
      } catch (err) {
        console.error('Failed to load assembly data for print:', err);
      }
    })();
  }, [pHydrated, assemblyCodeProp]);

  // Fetch print template when ward changes
  useEffect(() => {
    if (!selectedWard) { setPrintTemplate(null); return; }
    try { localStorage.setItem('printWard', selectedWard); } catch {}
    setTemplateLoading(true);
    mobileApi.fetchMessageTemplate(selectedWard, 'PRINT').then((res) => {
      const tpl = res?.data?.result || res?.result || res?.data || res || {};
      setPrintTemplate(tpl);
    }).catch(() => setPrintTemplate(null)).finally(() => setTemplateLoading(false));
  }, [selectedWard]);

  // Extract booths when ward changes
  useEffect(() => {
    if (!selectedWard || !assemblySnapshot) { setBooths([]); return; }
    const ward = (assemblySnapshot?.assembly?.wards || []).find(w => String(w.wardId) === selectedWard);
    if (!ward) { setBooths([]); return; }
    const list = (ward.booths || []).map(b => {
      const id = b.boothId ?? b.id ?? b.booth_id;
      const no = b.boothNo ?? b.booth_no ?? id;
      const name = b.boothNameEn ?? b.nameEn ?? b.booth_add_en ?? b.pollingStationAdrEn ?? `Booth ${no}`;
      return { label: `#${no} - ${name}`, value: String(id), boothNo: String(no), boothNameEn: name, boothId: id, address: b.pollingStationAdrEn || b.boothNameEn || '', wardId: ward.wardId, wardNameEn: ward.wardNameEn };
    });
    setBooths(list);
    setSelectedBooth('');
    setVoters([]);
  }, [selectedWard, assemblySnapshot]);

  // Fetch voters when booth changes
  useEffect(() => {
    if (!selectedBooth) { setVoters([]); return; }
    setLoadingVoters(true);
    mobileApi.fetchBoothVoters(selectedBooth).then((res) => {
      const data = res?.data?.result || res?.result || res?.data || {};
      setVoters(data?.voters || []);
    }).catch((err) => { console.error('fetchBoothVoters error:', err); setVoters([]); }).finally(() => setLoadingVoters(false));
  }, [selectedBooth]);

  const addPrinter = (device) => {
    if (!device) return;
    setPrinters((prev) => {
      if (prev.some((p) => p.id === device.id)) return prev;
      return prev.concat([{ id: device.id, name: device.name || 'Thermal Printer', device }]);
    });
  };

  // Known BLE printer service UUIDs
  const PRINTER_SERVICES = [
    '49535343-fe7d-4158-b296-146716be5a94',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
  ];

  // Manual trigger to refresh paired devices list
  const refreshPairedPrinters = async () => {
    if (typeof navigator === 'undefined' || !navigator.bluetooth?.getDevices) return;
    try {
      const devices = await navigator.bluetooth.getDevices();
      devices.forEach(d => addPrinter(d));
      if (devices.length > 0) setScanStatus('Found ' + devices.length + ' previously paired printers.');
      else setScanStatus('No previously paired printers found. Click Search Printers to add one.');
    } catch (err) {
      setScanError('Failed to load paired devices: ' + err.message);
    }
  };

  useEffect(() => {
    if (!pHydrated) return;
    const savedWard = localStorage.getItem('printWard');
    if (savedWard) setSelectedWard(savedWard);
    refreshPairedPrinters();
  }, [pHydrated]);

  const handleScanPrinters = async () => {
    setScanError('');
    setScanStatus('Searching for thermal printers...');
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      setScanError('Bluetooth is not supported in this browser.');
      setScanStatus('');
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });
      addPrinter(device);
      setScanStatus('Printer found. Click Connect to set up printing.');
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        setScanStatus('No printers selected.');
      } else {
        setScanError(error?.message || 'Unable to scan for printers.');
        setScanStatus('');
      }
    }
  };

  const handleConnect = async (printer) => {
    if (!printer) return;
    setConnectedPrinter(printer);
    setWriteChar(null);
    setScanError('');
    setScanStatus('Connecting...');

    try {
      const device = printer.device;
      const server = await device.gatt.connect();
      await new Promise(r => setTimeout(r, 500));

      setScanStatus('Finding print channel...');

      // Try each known printer service specifically
      let foundChar = null;
      for (const svcUuid of PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(svcUuid);
          const chars = await service.getCharacteristics();
          // Find the TX/write characteristic
          foundChar = chars.find(c => c.properties.writeWithoutResponse)
                   || chars.find(c => c.properties.write);
          if (foundChar) {
            setScanStatus(`Connected! Print channel found (${svcUuid.substring(0, 8)}...)`);
            break;
          }
        } catch { continue; }
      }

      if (foundChar) {
        setWriteChar(foundChar);
        try { localStorage.setItem('printerId', printer.id); } catch {}
      } else {
        setScanError('Could not find a print-data service on this device. It may only support Bluetooth Classic.');
        setScanStatus('');
      }
    } catch (err) {
      setScanError('Connection failed: ' + err.message);
      setScanStatus('');
    }
  };

  const handleDisconnect = () => {
    if (connectedPrinter?.device?.gatt?.connected) {
      try { connectedPrinter.device.gatt.disconnect(); } catch {}
    }
    setConnectedPrinter(null);
    setWriteChar(null);
    setScanStatus('');
    try { localStorage.removeItem('printerId'); } catch {}
  };

  // Format voter slip using Promotions Print template
  const formatVoterSlip = (voter, boothInfo) => {
    const tpl = printTemplate || {};
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const voterName = voter?.firstMiddleNameEn || voter?.name || voter?.nameEn || voter?.voterName || '-';
    const boothNo = voter?.boothNo || boothInfo?.boothNo || '-';
    const serial = voter?.serialNo || voter?.sl || voter?.srNo || '-';
    const boothName = boothInfo?.boothNameEn || voter?.boothLabel || '-';
    const boothAddr = boothInfo?.address || '';
    const relLabel = voter?.relationType || 'Father';
    const relName = voter?.relationFirstMiddleNameEn || voter?.relationNameEn || voter?.fatherName || voter?.husbandName || voter?.relationName || '-';
    const election = tpl.electionName || 'Election-2026';
    const voteDate = tpl.voteDate || '13-MAY-2026';
    const voteTime = tpl.voteTime || '7.00AM-6.00PM';
    const candidate = tpl.candidateName || '';
    const party = tpl.candidateParty || '';
    const wardLabel = tpl.candidateWardLabel || tpl.wardLabel || '';

    let slip =
      `${election}\n` +
      '       VOTER-SLIP\n' +
      `Name: ${voterName}\n` +
      `${relLabel}: ${relName}\n` +
      `EPIC ID: ${voter?.epicNo || voter?.epic || voter?.voterId || '-'}\n` +
      `Booth#: ${boothNo}  Sl#: ${serial}\n` +
      `Poll Booth: ${boothName}\n` +
      (boothAddr ? `${boothAddr}\n` : '') +
      `Vote On: ${voteDate}\n` +
      `Voting Time: ${voteTime}\n` +
      `Printed On: ${now}\n` +
      '-----Please cut here------\n';

    if (candidate || party) {
      slip += `Vote for ${party}\n`;
      slip += `${candidate}\n`;
      if (wardLabel) slip += `${wardLabel}\n`;
    }
    slip += '\n\n\n';
    return slip;
  };

  const sendToPrinter = async (text) => {
    if (!writeChar) throw new Error('Printer not connected');

    try {
      if (connectedPrinter?.device?.gatt && !connectedPrinter.device.gatt.connected) {
        await connectedPrinter.device.gatt.connect();
        await new Promise(r => setTimeout(r, 1000));
      }

      // ESC @ (Initialize printer)
      const initCmd = new Uint8Array([0x1b, 0x40]);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(initCmd);
      } else {
        await writeChar.writeValueWithResponse(initCmd);
      }
      await new Promise(r => setTimeout(r, 200));

      const bytes = new TextEncoder().encode(text);
      // Standard BLE MTU is usually 20 bytes. 
      // Sending in 20-byte chunks is more efficient than 5.
      for (let i = 0; i < bytes.length; i += 20) {
        const chunk = bytes.slice(i, Math.min(i + 20, bytes.length));
        if (writeChar.properties.writeWithoutResponse) {
          await writeChar.writeValueWithoutResponse(chunk);
        } else {
          await writeChar.writeValueWithResponse(chunk);
        }
        // Small delay to allow printer to process
        await new Promise(r => setTimeout(r, 100));
      }
      
      // Feed some lines at the end
      const feedCmd = new Uint8Array([0x0a, 0x0a, 0x0a]);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(feedCmd);
      } else {
        await writeChar.writeValueWithResponse(feedCmd);
      }
    } catch (err) {
      console.error('sendToPrinter error:', err);
      throw err;
    }
  };

  // End-to-end reliable print handler
  const performFullPrint = async (device, text) => {
    if (!device) throw new Error('No device selected');
    
    setScanStatus('Connecting...');
    let server = await device.gatt.connect();
    // 3s stabilization
    await new Promise(r => setTimeout(r, 3000));

    setScanStatus('Finding channel...');
    let char = null;
    // Only try known services to reduce scanning load
    for (const svcUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(svcUuid);
        // Delay after service discovery
        await new Promise(r => setTimeout(r, 800));
        const chars = await service.getCharacteristics();
        char = chars.find(c => c.properties.write) || chars.find(c => c.properties.writeWithoutResponse);
        if (char) break;
      } catch { continue; }
    }

    if (!char) throw new Error('No print service found. Turn printer OFF/ON and try again.');

    setScanStatus('Streaming (Super Safe Mode)...');
    const bytes = new TextEncoder().encode(text + '\n\n\n\n');
    
    // 5 bytes per chunk with heavy 400ms delay
    // This is to avoid overloading the printer's tiny buffer
    for (let i = 0; i < bytes.length; i += 5) {
      const chunk = bytes.slice(i, Math.min(i + 5, bytes.length));
      try {
        if (!server.connected) {
          await server.connect();
          await new Promise(r => setTimeout(r, 1500));
        }

        try {
          if (char.properties.write) {
            await char.writeValueWithResponse(chunk);
          } else {
            await char.writeValueWithoutResponse(chunk);
          }
        } catch (e) {
          await char.writeValueWithoutResponse(chunk);
        }

        await new Promise(r => setTimeout(r, 400)); 
      } catch (err) {
        if (err.message.includes('disconnected')) {
          throw new Error('Printer hardware rebooted due to buffer limit.');
        }
        throw err;
      }
    }
    setScanStatus('Print complete!');
  };

  // Web Serial Print (Stable alternative for Bluetooth SPP)
  const performSerialPrint = async (text) => {
    if (typeof navigator === 'undefined' || !navigator.serial) {
      throw new Error('Web Serial not supported in this browser. Use Chrome/Edge.');
    }
    try {
      setScanStatus('Waiting for port selection...');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setScanStatus('Sending to Serial port...');
      const writer = port.writable.getWriter();
      const bytes = new TextEncoder().encode(text + '\n\n\n\n');
      await writer.write(bytes);
      writer.releaseLock();
      await port.close();
      setScanStatus('Serial Print complete!');
    } catch (err) {
      setScanError('Serial failed: ' + err.message);
      setScanStatus('');
    }
  };

  const handlePrintVoter = async (voter, index) => {
    const boothInfo = booths.find(b => String(b.value) === selectedBooth) || {};
    setPrintingIdx(index);
    setScanError('');
    try {
      // Use the slip text
      const slip = formatVoterSlip(voter, boothInfo);
      // Default to Serial for stability if possible
      if (navigator.serial) {
        await performSerialPrint(slip);
      } else {
        await performFullPrint(connectedPrinter.device, slip);
      }
      setPrintingIdx(-1);
    } catch (err) {
      setScanError('Print failed: ' + err.message);
      setPrintingIdx(-1);
      setScanStatus('');
    }
  };

  const handlePrintAll = async () => {
    if (!connectedPrinter) { setScanError('Select a printer first.'); return; }
    if (voters.length === 0) { setScanError('No voters to print.'); return; }
    const boothInfo = booths.find(b => String(b.value) === selectedBooth) || {};
    setScanError('');
    for (let i = 0; i < voters.length; i++) {
      setPrintingIdx(i);
      setScanStatus(`Printing ${i + 1} of ${voters.length}...`);
      try {
        await performFullPrint(connectedPrinter.device, formatVoterSlip(voters[i], boothInfo));
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        setScanError(`Print failed at voter ${i + 1}: ${err.message}`);
        setPrintingIdx(-1);
        setScanStatus('');
        return;
      }
    }
    setPrintingIdx(-1);
    setScanStatus(`All ${voters.length} voter slips printed!`);
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-print-shell">
        <div className="mobile-web-printer-status">
          <div>
            <div className="mobile-web-status-title">{writeChar ? 'Ready to Print' : connectedPrinter ? 'Connected' : 'Not Connected'}</div>
            <div className="mobile-web-muted">
              {writeChar ? connectedPrinter?.name + ' — print channel active' : connectedPrinter ? 'Setting up...' : 'Search for nearby thermal printers.'}
            </div>
          </div>
          <button className="mobile-web-gradient-btn" type="button" onClick={handleScanPrinters}>
            Search Printers
          </button>
        </div>

        {scanStatus ? <div className="mobile-web-info-pill">{scanStatus}</div> : null}
        {scanError ? <div className="mobile-web-error">{scanError}</div> : null}
        <div className="mobile-web-printer-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Available Thermal Printers</h4>
            <button 
              type="button" 
              onClick={refreshPairedPrinters}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 4 }}
            >
              🔄 Refresh List
            </button>
          </div>
          {printers.length === 0 ? (
            <div className="mobile-web-table-empty" style={{ fontSize: '0.8rem', color: '#64748b' }}>
              No paired printers found.<br/>
              Click <b>Search Printers</b> to pair a new one.
            </div>
          ) : (
            printers.map((printer) => (
              <div key={printer.id} className="mobile-web-printer-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="mobile-web-printer-icon">🖨️</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{printer.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{printer.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`mobile-web-connect-btn ${connectedPrinter?.id === printer.id ? 'connected' : ''}`}
                    onClick={() => handleConnect(printer)}
                  >
                    {connectedPrinter?.id === printer.id ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>Ward / Election Template</h4>
          <div className="mobile-web-form-group">
            <select
              className="mobile-web-input"
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
            >
              <option value="">Select Ward...</option>
              {wards.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>

          {templateLoading && <div className="mobile-web-muted">Loading template...</div>}
          {printTemplate && (
            <div style={{ padding: '8px', background: '#f0fdf4', borderRadius: '4px', fontSize: '0.75rem', color: '#166534', marginBottom: 16 }}>
              ✓ <b>{printTemplate.electionName || 'Election'}</b> Template Loaded
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 12, fontStyle: 'italic' }}>
          Note: BLE Print is experimental. If your printer reboots, use <b>System Print</b> instead (requires pairing printer in OS settings).
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            className="mobile-web-gradient-btn"
            type="button"
            disabled={!connectedPrinter}
            style={{ flex: 1, padding: '12px 6px', fontSize: '0.85rem' }}
            onClick={async () => {
              if (!connectedPrinter) { setScanError('Select printer first.'); return; }
              setScanError('');
              try {
                const slip = formatVoterSlip(
                  { firstMiddleNameEn: 'Sample Voter', epicNo: 'TEST123456', serialNo: '1', relationType: 'Father', relationFirstMiddleNameEn: 'Sample Parent', boothNo: '1' },
                  { boothNo: '1', boothNameEn: 'Sample Polling Station', address: 'Test Address' }
                );
                await performFullPrint(connectedPrinter.device, slip);
              } catch (err) {
                setScanError('Print failed: ' + err.message);
                setScanStatus('');
              }
            }}
          >
            🖨️ BLE Print
          </button>

          <button
            className="mobile-web-secondary-btn"
            type="button"
            disabled={!connectedPrinter}
            style={{ flex: 1, padding: '12px 6px', fontSize: '0.85rem' }}
            onClick={async () => {
              if (!connectedPrinter) { setScanError('Select printer first.'); return; }
              setScanError('');
              try {
                await performFullPrint(connectedPrinter.device, 'TEST PRINT SUCCESSFUL\n');
              } catch (err) {
                setScanError('Test failed: ' + err.message);
                setScanStatus('');
              }
            }}
          >
            🧪 Test 1 Line
          </button>
        </div>
      </section>
    </ScreenFrame>
  );
}

const volunteerAnalysisSummaryFieldLabel = (field = {}) => {
  const key = String(field?.key || '').trim();
  const label = String(field?.label || '').trim();
  if (label) return label;
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
};

const volunteerEnrichmentColumnLabel = (key) => ({
  serialNumber: 'Sr No',
  wardName: 'Ward Name',
  name: 'Voter Name',
  epicNo: 'Voter EPIC No',
  boothNo: 'Booth No',
  voterSerialNo: 'Voter Serial No.',
  mobile: 'Voter Mobile',
  updatedByName: 'Agent Name',
  updatedByPhone: 'Agent Number',
  lastUpdatedAt: 'Last Updated At',
  wardCode: 'Ward Code',
}[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));

function VolunteerAnalysisScreen({ assemblyCodeProp }) {
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState('name-asc');
  const [viewMode, setViewMode] = useState('agent');
  const volunteerAnalysisSubtabKey = useMemo(
    () => subtabStorageKey('volunteer-analysis', assemblyCodeProp || 'default'),
    [assemblyCodeProp],
  );
  const [activeTab, setActiveTab] = usePersistedSubtab(volunteerAnalysisSubtabKey, 'table', ['table', 'map']);
  const [tableDataMode, setTableDataMode] = useState('families');
  const [mapDataMode, setMapDataMode] = useState('families');
  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [dbDumpProgress, setDbDumpProgress] = useState(-1);
  const [dbDumpLoading, setDbDumpLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(0);
  const [hasMoreDetails, setHasMoreDetails] = useState(true);
  const [detailFrom, setDetailFrom] = useState('');
  const [detailTo, setDetailTo] = useState('');
  const [mapPoints, setMapPoints] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [masterUploadLoading, setMasterUploadLoading] = useState(false);
  const [masterUploadProgress, setMasterUploadProgress] = useState(0);
  const [masterUploadPhase, setMasterUploadPhase] = useState('');
  const [masterImportLive, setMasterImportLive] = useState({
    phase: 'idle',
    progress: 0,
    assemblyNo: null,
    assemblyName: '',
    inserted: { assembly: 0, wards: 0, booths: 0, voters: 0 },
    error: null,
    active: false,
  });
  const [masterUploadBanner, setMasterUploadBanner] = useState({ type: '', text: '' });
  const masterFileInputRef = useRef(null);
  const resumeFileInputRef = useRef(null);
  const masterUploadPollRef = useRef(null);
  const hasHydrated = useHasHydrated();
  const userInfo = useMemo(() => (hasHydrated ? getUserInfoSafe() : {}), [hasHydrated]);
  const [role, setRole] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [wardItems, setWardItems] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [assemblies, setAssemblies] = useState([]);
  const mapRef = useRef(null);
  const osmMapRef = useRef(null);

  useEffect(() => {
    if (assemblyCodeProp) {
      const fromParent = String(parseInt(String(assemblyCodeProp), 10));
      if (fromParent) setSelectedAssembly(fromParent);
    }
  }, [assemblyCodeProp]);

  useEffect(() => {
    setRole((userInfo?.role || '').toUpperCase());
    const rawAssembly = assemblyCodeProp || getAssemblyCode();
    const initialAssembly = rawAssembly ? String(parseInt(String(rawAssembly), 10)) : '';
    setSelectedAssembly(initialAssembly);
    setHydrated(true);

    if (userInfo?.role === 'SUPER_ADMIN' || userInfo?.role === 'ADMIN') {
      mobileApi.fetchVolunteerDropdown('ASSEMBLY').then(res => {
        const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
        const formatted = raw.map(item => ({
          value: String(item.id),
          label: (item.name && !item.name.toLowerCase().includes('assembly') && !item.name.includes(String(item.id)))
            ? `${item.name} (${item.id})`
            : (item.name || `Assembly ${item.id}`),
        }));
        setAssemblies(formatted);
        setSelectedAssembly(prev => {
          const normalizedPrev = prev ? String(parseInt(prev)) : '';
          if (!normalizedPrev) return formatted.length > 0 ? formatted[0].value : '';
          return formatted.some(a => String(a.value) === normalizedPrev) ? normalizedPrev : (formatted.length > 0 ? formatted[0].value : '');
        });
      });
    }
  }, [userInfo]);

  const accessWardIds = useMemo(() => {
    const ids = [];
    if (!hydrated) return ids;
    if (Array.isArray(userInfo?.wardIds)) ids.push(...userInfo.wardIds);
    if (Array.isArray(userInfo?.wards)) ids.push(...userInfo.wards);
    if (userInfo?.wardId) ids.push(userInfo.wardId);
    if (userInfo?.ward_id) ids.push(userInfo.ward_id);
    if ((userInfo?.assignmentType || '').toUpperCase() === 'WARD' && userInfo?.assignmentId) {
      String(userInfo.assignmentId)
        .split(',')
        .map((val) => val.trim())
        .filter(Boolean)
        .forEach((val) => ids.push(val));
    }
    return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  }, [userInfo, hydrated]);

  const effectiveWard = useMemo(() => {
    if (role === 'WARD' && accessWardIds.length === 1) {
      return accessWardIds[0];
    }
    return selectedWard;
  }, [role, accessWardIds, selectedWard]);

  const effectiveAssemblyCode = useMemo(() => {
    const code = selectedAssembly || assemblyCodeProp || (hydrated ? getAssemblyCode() : '');
    return code ? String(code).trim() : '';
  }, [selectedAssembly, assemblyCodeProp, hydrated]);

  useEffect(() => {
    setSelectedWard('');
  }, [selectedAssembly]);

  useEffect(() => {
    let active = true;
    const assemblyId = selectedAssembly || getAssemblyCode();
    setWardItems([]);
    mobileApi.fetchWards(assemblyId).then((res) => {
      if (!active) return;
      const wards = Array.isArray(res) ? res : (res?.data?.result || res?.result || res?.wards || []);
      const list = (wards || [])
        .map((ward) => ({
          value: String(ward?.wardId ?? ward?.ward_id ?? ward?.id ?? ''),
          label: ward?.wardNameEn ?? ward?.ward_name_en ?? ward?.ward_name_local ?? ward?.name_en ?? ward?.name ?? '',
        }))
        .filter((item) => item.value && item.label);
      const filtered = accessWardIds.length
        ? list.filter((item) => accessWardIds.includes(item.value))
        : list;
      setWardItems(filtered);
      if (accessWardIds.length && filtered.length && !filtered.some((item) => item.value === selectedWard)) {
        setSelectedWard(filtered[0].value);
      }
    }).catch(() => setWardItems([]));
    return () => {
      active = false;
    };
  }, [accessWardIds, selectedWard, selectedAssembly]);

  const sortOptions = [
    { label: 'Name A-Z', value: 'name-asc' },
    { label: 'Name Z-A', value: 'name-desc' },
    { label: 'Latest Created', value: 'latest' },
    { label: 'Oldest Created', value: 'oldest' },
  ];
  const selectedSortLabel = sortOptions.find((item) => item.value === sortMode)?.label || '';
  const viewOptions = [
    { label: 'Agent wise', value: 'agent' },
    { label: 'Date wise', value: 'date' },
    { label: 'Ward wise', value: 'ward' },
    { label: 'Booth wise', value: 'booth' },
  ];
  const selectedViewLabel = viewOptions.find((item) => item.value === viewMode)?.label || '';

  const sortedRows = useMemo(() => {
    const items = [...rows];
    if (viewMode !== 'agent') {
      return items.sort((a, b) => {
        const aTime = new Date(a.lastUpdatedAt || 0).getTime();
        const bTime = new Date(b.lastUpdatedAt || 0).getTime();
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
          return bTime - aTime;
        }
        return String(a.label || a.groupKey || '').localeCompare(String(b.label || b.groupKey || ''), 'en');
      });
    }
    if (sortMode === 'name-desc') {
      return items.sort((a, b) => String(b.agentName || '').localeCompare(String(a.agentName || ''), 'en'));
    }
    if (sortMode === 'latest') {
      return items.sort((a, b) => {
        const aTime = new Date(a.lastUpdatedAt || 0).getTime();
        const bTime = new Date(b.lastUpdatedAt || 0).getTime();
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
          return bTime - aTime;
        }
        return Number(b.userId || 0) - Number(a.userId || 0);
      });
    }
    if (sortMode === 'oldest') {
      return items.sort((a, b) => Number(a.userId || 0) - Number(b.userId || 0));
    }
    return items.sort((a, b) => String(a.agentName || '').localeCompare(String(a.agentName || ''), 'en'));
  }, [rows, sortMode, viewMode]);

  const summaryTotals = useMemo(() => {
    if (viewMode === 'agent') return null;
    const visitKey = tableDataMode === 'families' ? 'totalFamilies' : 'total';
    return {
      agentsWorked: sortedRows.reduce((sum, row) => sum + (Number(row.agentsWorked) || 0), 0),
      boothsCovered: sortedRows.reduce((sum, row) => sum + (Number(row.boothsCovered) || 0), 0),
      votersMet: sortedRows.reduce((sum, row) => sum + (Number(row[visitKey]) || 0), 0),
    };
  }, [sortedRows, viewMode, tableDataMode]);

  const groupedVisitCount = (row) => (
    tableDataMode === 'families' ? (row.totalFamilies ?? 0) : (row.total ?? 0)
  );

  const analysisFieldLabel = (field) => (
    tableDataMode === 'families'
      ? formatFamilyAvailabilityLabel(field.label)
      : volunteerAnalysisSummaryFieldLabel(field)
  );

  const formatDateTime = (value) => {
    if (!value) return '-';
    const raw = typeof value === 'string' ? value.trim() : value;
    const needsTz = typeof raw === 'string' && raw !== '' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
    const normalized = needsTz ? `${raw}Z` : raw;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  const buildExportRows = () => {
    const baseHeaders = fields.map((f) => volunteerAnalysisSummaryFieldLabel(f));
    const getRowTotalUpdates = (row) => fields.reduce((sum, f) => sum + (Number(row.counts?.[f.key]) || 0), 0);

    if (viewMode === 'agent') {
      const headers = ['Agent Name', 'Agent Number', ...baseHeaders, 'Last Updated At'];
      const dataRows = sortedRows.map((row) => [
        row.agentName || '',
        row.phone || '',
        ...fields.map((f) => row.counts?.[f.key] ?? 0),
        row.lastUpdatedAt || '',
      ]);
      return { headers, dataRows };
    }
    if (viewMode === 'date') {
      const headers = ['Date', 'Agents Worked', 'Booths Covered', 'Voters Met', ...baseHeaders, 'Total Updates', 'Last Updated At'];
      const dataRows = sortedRows.map((row) => [
        row.label || row.groupKey || '',
        row.agentsWorked ?? 0,
        row.boothsCovered ?? 0,
        row.total ?? 0,
        ...fields.map((f) => row.counts?.[f.key] ?? 0),
        getRowTotalUpdates(row),
        row.lastUpdatedAt || '',
      ]);
      return { headers, dataRows };
    }
    if (viewMode === 'ward') {
      const headers = ['Ward', 'Agents', 'Booths', 'Voters Met', ...baseHeaders, 'Total Updates', 'Last Updated At'];
      const dataRows = sortedRows.map((row) => [
        row.label || row.groupKey || '',
        row.agentsWorked ?? 0,
        row.boothsCovered ?? 0,
        row.total ?? 0,
        ...fields.map((f) => row.counts?.[f.key] ?? 0),
        getRowTotalUpdates(row),
        row.lastUpdatedAt || '',
      ]);
      return { headers, dataRows };
    }
    const headers = ['Booth No.', 'Agents', 'Voters Met', ...baseHeaders, 'Total Updates', 'Last Updated At'];
    const dataRows = sortedRows.map((row) => [
      row.label || row.groupKey || '',
      row.agentsWorked ?? 0,
      row.total ?? 0,
      ...fields.map((f) => row.counts?.[f.key] ?? 0),
      getRowTotalUpdates(row),
      row.lastUpdatedAt || '',
    ]);
    return { headers, dataRows };
  };

  const downloadCsv = () => {
    const { headers, dataRows } = buildExportRows();
    downloadCsvFile('volunteer-analysis.csv', headers, dataRows);
  };

  const downloadXls = () => {
    const { headers, dataRows } = buildExportRows();
    downloadXlsFile('volunteer-analysis.xls', headers, dataRows);
  };

  const fetchAllDetailsForExport = async () => {
    try {
      const res = await mobileApi.fetchVolunteerEnrichmentDetails(effectiveWard || undefined, undefined, undefined, undefined, undefined, effectiveAssemblyCode || undefined);
      return Array.isArray(res?.data?.result || res?.result) ? (res?.data?.result || res?.result) : [];
    } catch (err) {
      console.warn('Failed to fetch full data for export.', err);
      return detailRows; // Fallback
    }
  };

  const downloadDbDump = async () => {
    if (dbDumpLoading) return;
    setDbDumpLoading(true);
    setDbDumpProgress(0);
    try {
      const response = await mobileApi.downloadDbDump();
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Server error while generating dump.' }));
        throw new Error(errorData.detail || 'Download failed');
      }
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          setDbDumpProgress(Math.round((loaded / total) * 100));
        } else {
          setDbDumpProgress(loaded);
        }
      }
      const blob = new Blob(chunks, { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `votabase_dump_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download DB dump', err);
      alert('Failed to download Complete DB Dump.');
    } finally {
      setDbDumpLoading(false);
      setDbDumpProgress(-1);
    }
  };

  const stopMasterUploadPoll = () => {
    if (masterUploadPollRef.current) {
      clearInterval(masterUploadPollRef.current);
      masterUploadPollRef.current = null;
    }
  };

  const reloadAssembliesDropdown = () => {
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return;
    mobileApi.fetchVolunteerDropdown('ASSEMBLY').then((res) => {
      const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
      const formatted = raw.map((item) => ({
        value: String(item.id),
        label:
          item.name && !item.name.toLowerCase().includes('assembly') && !item.name.includes(String(item.id))
            ? `${item.name} (${item.id})`
            : item.name || `Assembly ${item.id}`,
      }));
      setAssemblies(formatted);
    }).catch(() => {});
  };

  const pollMasterRollImportStatus = () => {
    stopMasterUploadPoll();
    masterUploadPollRef.current = setInterval(async () => {
      try {
        const res = await mobileApi.fetchMasterRollImportStatus();
        const status = res?.data?.result ?? res?.data ?? {};
        applyMasterRollStatus(setMasterImportLive, status);
        setMasterUploadPhase(status.phase || '');
        if (typeof status.progress === 'number') {
          setMasterUploadProgress(status.progress);
        }
        if (status.assembly_no && ['assembly', 'wards', 'booths', 'voters', 'done'].includes(status.phase)) {
          reloadAssembliesDropdown();
          setSelectedAssembly(String(status.assembly_no));
        }
        if (status.phase === 'error') {
          setMasterUploadBanner({ type: 'error', text: status.error || 'Import failed' });
          stopMasterUploadPoll();
        }
        if (!status.active && status.phase === 'done') {
          stopMasterUploadPoll();
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 1200);
  };

  const handleMasterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopMasterUploadPoll();
    setMasterUploadLoading(true);
    setMasterUploadProgress(0);
    setMasterUploadPhase('starting');
    setMasterImportLive({
      phase: 'starting',
      progress: 0,
      assemblyNo: null,
      assemblyName: '',
      inserted: { assembly: 0, wards: 0, booths: 0, voters: 0 },
      error: null,
      active: true,
    });
    setMasterUploadBanner({ type: '', text: '' });
    pollMasterRollImportStatus();
    try {
      const res = await mobileApi.uploadMasterRoll(file, {
        onUploadProgress: (percent) => {
          setMasterUploadPhase('uploading');
          setMasterUploadProgress(Math.min(15, Math.max(2, Math.round(percent * 0.15))));
        },
        onProcessingStart: () => {
          setMasterUploadPhase('processing');
        },
      });
      const finalStatus = res?.data?.result ?? {};
      applyMasterRollStatus(setMasterImportLive, {
        phase: 'done',
        progress: 100,
        active: false,
        assembly_no: finalStatus.assembly_no,
        assembly_name_en: null,
        inserted: {
          assembly: finalStatus.inserted?.assembly ?? 1,
          wards: finalStatus.inserted?.wards ?? 0,
          booths: finalStatus.inserted?.booths ?? 0,
          voters: finalStatus.inserted?.voters ?? 0,
        },
      });
      setMasterUploadProgress(100);
      setMasterUploadPhase('done');
      setMasterUploadBanner({ type: 'success', text: formatMasterRollUploadSuccess(res) });
      reloadAssembliesDropdown();
      if (finalStatus.assembly_no) setSelectedAssembly(String(finalStatus.assembly_no));
      if (masterFileInputRef.current) masterFileInputRef.current.value = '';
      try {
        localStorage.removeItem('masterRollLastProgress');
        localStorage.removeItem('masterRollCanResume');
      } catch { }
      if (showDetails) await loadDetails(effectiveWard || undefined);
    } catch (err) {
      setMasterUploadBanner({ type: 'error', text: parseMasterRollUploadError(err) });
      setMasterUploadPhase('error');
      try {
        localStorage.setItem('masterRollLastProgress', String(masterUploadProgress || masterImportLive.progress || 0));
        localStorage.setItem('masterRollCanResume', '1');
      } catch { }
    } finally {
      stopMasterUploadPoll();
      setMasterUploadLoading(false);
    }
  };

  const handleResumeMasterRoll = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopMasterUploadPoll();
    setMasterUploadLoading(true);
    const startAt = (() => {
      try {
        return Number(localStorage.getItem('masterRollLastProgress') || '0') || 0;
      } catch {
        return 0;
      }
    })();
    setMasterUploadProgress(Math.max(0, Math.min(99, startAt)));
    setMasterUploadPhase('starting');
    setMasterUploadBanner({ type: '', text: '' });
    pollMasterRollImportStatus();
    try {
      const res = await mobileApi.resumeMasterRoll(file, {
        onUploadProgress: (percent) => {
          setMasterUploadPhase('uploading');
          const uploadPct = Math.min(15, Math.max(2, Math.round(percent * 0.15)));
          setMasterUploadProgress((prev) => Math.max(prev, uploadPct));
        },
        onProcessingStart: () => setMasterUploadPhase('processing'),
      });
      const finalStatus = res?.data?.result ?? {};
      applyMasterRollStatus(setMasterImportLive, {
        phase: 'done',
        progress: 100,
        active: false,
        assembly_no: finalStatus.assembly_no,
        assembly_name_en: null,
        inserted: {
          assembly: finalStatus.inserted?.assembly ?? 1,
          wards: finalStatus.inserted?.wards ?? 0,
          booths: finalStatus.inserted?.booths ?? 0,
          voters: finalStatus.inserted?.voters ?? 0,
        },
      });
      setMasterUploadProgress(100);
      setMasterUploadPhase('done');
      setMasterUploadBanner({ type: 'success', text: formatMasterRollUploadSuccess(res) });
      reloadAssembliesDropdown();
      if (finalStatus.assembly_no) setSelectedAssembly(String(finalStatus.assembly_no));
      if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
      try {
        localStorage.removeItem('masterRollLastProgress');
        localStorage.removeItem('masterRollCanResume');
      } catch { }
    } catch (err) {
      setMasterUploadBanner({ type: 'error', text: parseMasterRollUploadError(err) });
      setMasterUploadPhase('error');
      try {
        localStorage.setItem('masterRollLastProgress', String(masterUploadProgress || masterImportLive.progress || 0));
        localStorage.setItem('masterRollCanResume', '1');
      } catch { }
    } finally {
      stopMasterUploadPoll();
      setMasterUploadLoading(false);
    }
  };

  const canResumeMasterRoll = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('masterRollCanResume') === '1';
    } catch {
      return false;
    }
  })();

  useEffect(() => () => stopMasterUploadPoll(), []);

  const loadDetails = async (wardId) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await mobileApi.fetchVolunteerEnrichmentDetails(wardId, undefined, undefined, 0, 50, effectiveAssemblyCode || undefined);
      const payload = res?.data?.result || res?.result || [];
      const newRows = Array.isArray(payload) ? payload : [];
      setDetailRows(newRows);
      setDetailPage(1);
      setHasMoreDetails(newRows.length === 50);
    } catch (err) {
      setDetailError(err?.message || 'Unable to load enrichment details.');
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadMoreDetails = async () => {
    if (detailLoading || !hasMoreDetails) return;
    setDetailLoading(true);
    try {
      const res = await mobileApi.fetchVolunteerEnrichmentDetails(effectiveWard || undefined, undefined, undefined, detailPage, 50, effectiveAssemblyCode || undefined);
      const payload = res?.data?.result || res?.result || [];
      const newRows = Array.isArray(payload) ? payload : [];
      setDetailRows((prev) => {
        const existing = new Set(prev.map(r => r.serialNumber || r.epicNo || r.epic));
        const filtered = newRows.filter(r => !existing.has(r.serialNumber || r.epicNo || r.epic));
        return [...prev, ...filtered];
      });
      setDetailPage((prev) => prev + 1);
      setHasMoreDetails(newRows.length === 50);
    } catch (err) {
      setDetailError(err?.message || 'Unable to load more enrichment details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetailScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      loadMoreDetails();
    }
  };

  const toggleDetails = async () => {
    const next = !showDetails;
    setShowDetails(next);
    if (next && detailRows.length === 0) {
      await loadDetails(effectiveWard || undefined);
    }
  };

  useEffect(() => {
    if (showDetails) {
      loadDetails(effectiveWard || undefined);
    }
  }, [effectiveWard, showDetails]);

  const downloadDetailCsv = async () => {
    const fullData = await fetchAllDetailsForExport();
    const { headers, dataRows } = buildDetailExport(fullData);
    if (!headers.length) return;
    downloadCsvFile('volunteer-enrichment-details.csv', headers, dataRows);
  };

  const downloadDetailXls = async () => {
    const fullData = await fetchAllDetailsForExport();
    const { headers, dataRows } = buildDetailExport(fullData);
    if (!headers.length) return;
    downloadXlsFile('volunteer-enrichment-details.xls', headers, dataRows);
  };

  const currentFetchId = useRef(0);

  const loadAnalysis = async () => {
    const fetchId = ++currentFetchId.current;
    setLoading(true);
    setError('');
    try {
      const res = tableDataMode === 'families'
        ? await mobileApi.fetchFamilyAnalysis(
          effectiveWard || undefined,
          undefined,
          viewMode,
          undefined,
          undefined,
          effectiveAssemblyCode || undefined,
        )
        : await mobileApi.fetchVolunteerAnalysis(effectiveWard || undefined, viewMode, effectiveAssemblyCode || undefined);
      if (fetchId !== currentFetchId.current) return;
      const payload = res?.data?.result || res?.result || {};
      setRows(payload?.rows || []);
      setFields(payload?.fields || []);
    } catch (err) {
      if (fetchId !== currentFetchId.current) return;
      setError(err?.message || 'Unable to load analysis.');
    } finally {
      if (fetchId === currentFetchId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!role || role === 'BOOTH') return;
    if (wardItems.length === 0) return;
    if (accessWardIds.length > 0 && !effectiveWard) return;
    loadAnalysis();
  }, [role, effectiveWard, viewMode, wardItems.length, accessWardIds.length, effectiveAssemblyCode, tableDataMode]);

  const buildMap = async (points) => {
    if (!mapRef.current) return;
    try {
      if (osmMapRef.current) {
        destroyOsmMap(osmMapRef.current);
        osmMapRef.current = null;
      }
      const getColor = (point) => {
        const gender = String(point.gender || '').toUpperCase();
        if (gender.startsWith('M')) return '#DDA0DD';
        if (gender.startsWith('F')) return '#FFA6C9';
        return '#64748b';
      };
      const getPopupHtml = (point) => `
        <div style="padding: 12px; color: #1e293b; font-family: sans-serif; min-width: 220px;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${point.name || 'Voter Details'}</h3>
          <div style="display: grid; gap: 8px; font-size: 13px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b; font-weight: 500;">Relation:</span>
              <span style="color: #334155; font-weight: 600; text-align: right;">${point.relationName || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b; font-weight: 500;">EPIC:</span>
              <span style="color: #334155; font-weight: 600; text-align: right;">${point.epic || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b; font-weight: 500;">Mobile:</span>
              <span style="color: #334155; font-weight: 600; text-align: right;">${point.mobile || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b; font-weight: 500;">Gender:</span>
              <span style="color: #334155; font-weight: 600; text-align: right;">${point.gender || '-'}</span>
            </div>
          </div>
        </div>
      `;
      osmMapRef.current = await buildPointsOsmMap(mapRef.current, points, { getColor, getPopupHtml });
    } catch (err) {
      setMapError(err?.message || 'Unable to load map.');
    }
  };

  const loadMapPoints = async () => {
    setMapLoading(true);
    setMapError('');
    try {
      const res = mapDataMode === 'families'
        ? await mobileApi.fetchFamilyLocationPoints(
          effectiveWard || undefined,
          undefined,
          undefined,
          effectiveAssemblyCode || undefined,
        )
        : await mobileApi.fetchVolunteerLocationPoints(effectiveWard || undefined, effectiveAssemblyCode || undefined);
      const payload = res?.data?.result || res?.result || [];
      const points = Array.isArray(payload) ? payload : [];
      const normalized = points
        .map((item) => ({
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          gender: item.gender || item.sex || '',
          name: item.name || item.familyName || '',
          epic: item.epic || item.epicNo || '',
          relationName: item.relationName || '',
          mobile: item.mobile || item.phone || '',
          familyName: item.familyName || item.name || '',
          familyAvailability: item.familyAvailability || '',
          familyAddress: item.familyAddress || item.addressEn || item.address || '',
          roadName: item.roadName || '',
          familyNumber: item.familyNumber || '',
          flatNumber: item.flatNumber || '',
          buildingNumber: item.buildingNumber || '',
          buildingName: item.buildingName || '',
          headOfFamily: item.headOfFamily || item.headName || '',
          phone: item.phone || item.mobile || '',
          members: item.members || [],
          membersCount: item.membersCount ?? item.members?.length ?? item.memberCount ?? '-',
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      setMapPoints(normalized);
      if (mapDataMode === 'families') {
        if (osmMapRef.current) {
          destroyOsmMap(osmMapRef.current);
          osmMapRef.current = null;
        }
        if (mapRef.current) {
          osmMapRef.current = await buildFamilyOsmMap(
            mapRef.current,
            normalized.map(normalizeFamilyMapPoint),
            { showMemberDetails: true, showEditButton: false },
          );
        }
      } else {
        await buildMap(normalized);
      }
    } catch (err) {
      setMapError(err?.message || 'Unable to load map points.');
      setMapPoints([]);
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'map') return;
    loadMapPoints();
    return () => {
      if (osmMapRef.current) {
        destroyOsmMap(osmMapRef.current);
        osmMapRef.current = null;
      }
    };
  }, [activeTab, effectiveWard, mapDataMode, effectiveAssemblyCode]);

  const detailColumns = useMemo(() => {
    const excluded = new Set([
      'firstMiddleNameEn',
      'lastNameEn',
      'firstMiddleNameLocal',
      'lastNameLocal',
      'relationType',
      'relationFirstMiddleNameEn',
      'relationLastNameEn',
      'relationFirstMiddleNameLocal',
      'relationLastNameLocal',
      'houseNoEn',
      'houseNoLocal',
      'addressEn',
      'addressLocal',
      'team',
      'updatedFields',
    ]);
    const keysFromRows = detailRows.length
      ? Object.keys(detailRows[0] || {}).filter((key) => !excluded.has(key))
      : [];
    const preferredOrder = [
      'serialNumber',
      'wardName',
      'name',
      'epicNo',
      'boothNo',
      'voterSerialNo',
      'mobile',
      'updatedByName',
      'updatedByPhone',
      'lastUpdatedAt',
    ];
    const alwaysShowKeys = new Set(['updatedByName', 'updatedByPhone', 'voterSerialNo', 'mobile']);
    const ordered = preferredOrder.filter((key) => keysFromRows.includes(key) || alwaysShowKeys.has(key));
    keysFromRows.forEach((key) => {
      if (key === 'mobile') return;
      if (!ordered.includes(key)) ordered.push(key);
    });
    if (ordered.includes('lastUpdatedAt')) {
      const idx = ordered.indexOf('lastUpdatedAt');
      ordered.splice(idx, 1);
      ordered.push('lastUpdatedAt');
    }
    return ordered;
  }, [detailRows]);

  const getSortedRows = (rowsData) => {
    return [...rowsData].sort((a, b) => {
      const aTime = new Date(a?.lastUpdatedAt || 0).getTime();
      const bTime = new Date(b?.lastUpdatedAt || 0).getTime();
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
        return bTime - aTime;
      }
      return 0;
    });
  };

  const sortedDetailRows = useMemo(() => {
    return getSortedRows(detailRows).map((row, index) => ({
      ...row,
      serialNumber: index + 1
    }));
  }, [detailRows]);

  const renderDetailValue = (row, key) => {
    if (key === 'lastUpdatedAt') return formatDateTime(row?.[key]);
    if (key === 'name' && !row?.[key]) {
      const fallback = [row?.firstMiddleNameEn, row?.lastNameEn].filter(Boolean).join(' ').trim();
      return fallback || '-';
    }
    return row?.[key] ?? '-';
  };

  const buildDetailExport = (exportRows) => {
    if (!exportRows.length) return { headers: [], dataRows: [] };
    const columnKeys = detailColumns;
    const headers = columnKeys.map((key) => volunteerEnrichmentColumnLabel(key));
    const sortedExportRows = getSortedRows(exportRows).map((row, index) => ({
      ...row,
      serialNumber: index + 1
    }));
    const dataRows = sortedExportRows.map((row) => columnKeys.map((key) => {
      if (key === 'lastUpdatedAt') return formatDateTime(row?.[key]);
      if (key === 'name' && !row?.[key]) {
        const fallback = [row?.firstMiddleNameEn, row?.lastNameEn].filter(Boolean).join(' ').trim();
        return fallback || '';
      }
      return row?.[key] ?? '';
    }));
    return { headers, dataRows };
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-volunteer-shell">
        <div className="mobile-web-stack">
        {hydrated && role === 'WARD' ? <div className="mobile-web-info-pill">Showing volunteer enrichment locations for your ward access.</div> : null}
        <div className="mobile-web-form-grid" style={{ marginBottom: '12px' }}>
          {role === 'SUPER_ADMIN' && assemblies.length > 0 && (
            <div className="mobile-web-field">
              <label>Assembly</label>
              <SingleOptionSelect
                label="Assembly"
                options={assemblies.map((a) => a.label)}
                value={assemblies.find((a) => a.value === selectedAssembly)?.label || ''}
                customValue=""
                onSelect={(label) => {
                  const match = assemblies.find((a) => a.label === label);
                  if (match) setSelectedAssembly(match.value);
                }}
                onCustomValueChange={() => { }}
              />
            </div>
          )}
          <div className="mobile-web-field">
            <label>Ward</label>
            <SingleOptionSelect
              label="Ward"
              options={accessWardIds.length ? wardItems.map((item) => item.label) : ['All Wards', ...wardItems.map((item) => item.label)]}
              value={effectiveWard ? (wardItems.find((item) => item.value === effectiveWard)?.label || '') : (accessWardIds.length ? (wardItems[0]?.label || '') : 'All Wards')}
              customValue=""
              onSelect={(option) => {
                if (option === 'All Wards') {
                  setSelectedWard('');
                  return;
                }
                const match = wardItems.find((item) => item.label === option);
                setSelectedWard(match?.value || '');
              }}
              onCustomValueChange={() => { }}
            />
          </div>
          <div className="mobile-web-field">
            <label>View</label>
            <SingleOptionSelect
              label="View"
              options={viewOptions.map((item) => item.label)}
              value={selectedViewLabel}
              customValue=""
              onSelect={(option) => setViewMode(viewOptions.find((item) => item.label === option)?.value ?? 'agent')}
              onCustomValueChange={() => { }}
            />
          </div>
          {viewMode === 'agent' ? (
            <div className="mobile-web-field">
              <label>Sort By</label>
              <SingleOptionSelect
                label="Sort By"
                options={sortOptions.map((item) => item.label)}
                value={selectedSortLabel}
                customValue=""
                onSelect={(option) => setSortMode(sortOptions.find((item) => item.label === option)?.value ?? 'name-asc')}
                onCustomValueChange={() => { }}
              />
            </div>
          ) : null}

        </div>
        {activeTab === 'table' ? (
          <div className="mobile-web-form-grid" style={{ marginBottom: '12px' }}>
            <div className="mobile-web-field mobile-web-field-span-2">
              <label>Data</label>
              <div className="mobile-web-chip-row">
                {[
                  { label: 'Family visits', value: 'families' },
                  { label: 'Voter updates', value: 'voters' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mobile-web-chip${tableDataMode === opt.value ? ' active' : ''}`}
                    onClick={() => setTableDataMode(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div className="mobile-web-tab-strip mobile-web-analysis-tabs">
          {['TABLE', 'MAP'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`mobile-web-tab-btn ${activeTab === tab.toLowerCase() ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.toLowerCase())}
            >
              {tab === 'TABLE' ? 'Table' : 'Map'}
            </button>
          ))}
        </div>
        <div className="mobile-web-action-row" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {activeTab === 'table' ? (
            <>
              <button type="button" className="mobile-web-secondary-btn" onClick={downloadCsv} disabled={!rows.length}>
                Download CSV
              </button>
              <button type="button" className="mobile-web-secondary-btn" onClick={downloadXls} disabled={!rows.length}>
                Download Excel
              </button>
            </>
          ) : (
            <div className="mobile-web-map-controls" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <div className="mobile-web-chip-row">
                {[
                  { label: 'Families', value: 'families' },
                  { label: 'Users', value: 'volunteers' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mobile-web-chip${mapDataMode === opt.value ? ' active' : ''}`}
                    onClick={() => setMapDataMode(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button type="button" className="mobile-web-primary-btn mobile-web-map-refresh-btn" onClick={loadMapPoints} disabled={mapLoading}>
                {mapLoading ? 'Loading Map...' : 'Refresh Map'}
              </button>
            </div>
          )}
        </div>
        {activeTab === 'table' ? (
          <>
            {error ? <div className="mobile-web-error">{error}</div> : null}
            {loading ? <div className="mobile-web-empty">Loading analysis...</div> : null}
            {!loading && sortedRows.length === 0 ? <div className="mobile-web-empty">No analysis data found.</div> : null}
            {!loading && sortedRows.length > 0 ? (
              <div className="mobile-web-analysis-table-wrap mobile-web-analysis-table-scroll">
                {summaryTotals ? (
                  <div className="mobile-web-analysis-summary">
                    {viewMode !== 'booth' ? (
                      <>
                        <span>Total Agents: <strong>{summaryTotals.agentsWorked}</strong></span>
                        <span>Total Booths: <strong>{summaryTotals.boothsCovered}</strong></span>
                      </>
                    ) : (
                      <span>Total Agents: <strong>{summaryTotals.agentsWorked}</strong></span>
                    )}
                    <span>Total {tableDataMode === 'families' ? 'Families' : 'Voters'} Met: <strong>{summaryTotals.votersMet}</strong></span>
                  </div>
                ) : null}
                <table className="mobile-web-analysis-table">
                  <thead>
                    <tr>
                      {viewMode === 'agent' ? (
                        <>
                          <th>Agent Name</th>
                          <th>Agent Number</th>
                          {tableDataMode === 'families' ? (
                            <>
                              <th>Total Buildings visited</th>
                              <th>Total Families visited</th>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {viewMode === 'date' ? (
                        <>
                          <th>Date</th>
                          <th>Agents Worked</th>
                          <th>Booths Covered</th>
                          <th>{tableDataMode === 'families' ? 'Families' : 'Voters'} Met</th>
                        </>
                      ) : null}
                      {viewMode === 'ward' ? (
                        <>
                          <th>Ward</th>
                          <th>Agents</th>
                          <th>Booths</th>
                          <th>{tableDataMode === 'families' ? 'Families' : 'Voters'} Met</th>
                        </>
                      ) : null}
                      {viewMode === 'booth' ? (
                        <>
                          <th>Booth No.</th>
                          <th>Agents</th>
                          <th>{tableDataMode === 'families' ? 'Families' : 'Voters'} Met</th>
                        </>
                      ) : null}
                      {fields.map((field) => (
                        <th key={field.key}>{analysisFieldLabel(field)}</th>
                      ))}
                      {['date', 'booth', 'ward'].includes(viewMode) ? <th>Total Updates</th> : null}
                      <th>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.userId || row.groupKey || row.label}>
                        {viewMode === 'agent' ? (
                          <>
                            <td>{row.agentName || '-'}</td>
                            <td>{row.phone || '-'}</td>
                            {tableDataMode === 'families' ? (
                              <>
                                <td>{row.totalBuildings ?? 0}</td>
                                <td>{row.totalFamilies ?? 0}</td>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        {viewMode === 'date' ? (
                          <>
                            <td>{row.label || row.groupKey || '-'}</td>
                            <td>{row.agentsWorked ?? 0}</td>
                            <td>{row.boothsCovered ?? 0}</td>
                            <td>{groupedVisitCount(row)}</td>
                          </>
                        ) : null}
                        {viewMode === 'ward' ? (
                          <>
                            <td>{row.label || row.groupKey || '-'}</td>
                            <td>{row.agentsWorked ?? 0}</td>
                            <td>{row.boothsCovered ?? 0}</td>
                            <td>{groupedVisitCount(row)}</td>
                          </>
                        ) : null}
                        {viewMode === 'booth' ? (
                          <>
                            <td>{row.label || row.groupKey || '-'}</td>
                            <td>{row.agentsWorked ?? 0}</td>
                            <td>{groupedVisitCount(row)}</td>
                          </>
                        ) : null}
                        {fields.map((field) => (
                          <td key={`${row.userId || row.groupKey}-${field.key}`}>{row.counts?.[field.key] ?? 0}</td>
                        ))}
                        {['date', 'booth', 'ward'].includes(viewMode) ? (
                          <td>
                            <strong>{fields.reduce((sum, field) => sum + (Number(row.counts?.[field.key]) || 0), 0)}</strong>
                          </td>
                        ) : null}
                        <td>{formatDateTime(row.lastUpdatedAt)}</td>
                      </tr>
                    ))}
                    {viewMode === 'agent' ? (
                      <tr className="mobile-web-analysis-total">
                        <td>Total</td>
                        <td>-</td>
                        {tableDataMode === 'families' ? (
                          <>
                            <td>{sortedRows.reduce((sum, row) => sum + (Number(row.totalBuildings) || 0), 0)}</td>
                            <td>{sortedRows.reduce((sum, row) => sum + (Number(row.totalFamilies) || 0), 0)}</td>
                          </>
                        ) : null}
                        {fields.map((field) => (
                          <td key={`total-${field.key}`}>
                            {sortedRows.reduce((sum, row) => sum + (Number(row.counts?.[field.key]) || 0), 0)}
                          </td>
                        ))}
                        <td>-</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mobile-web-map-shell">
            {mapError ? <div className="mobile-web-error">{mapError}</div> : null}
            {mapLoading ? <div className="mobile-web-empty">Loading map points...</div> : null}
            {!mapLoading && mapPoints.length === 0 ? <div className="mobile-web-empty">No captured locations found.</div> : null}
            {mapDataMode === 'families' ? (
              <FamilyAvailabilityMapLegend compact />
            ) : (
              <div className="mobile-web-map-legend">
                <span><i className="legend-dot male" /> Male</span>
                <span><i className="legend-dot female" /> Female</span>
                <span><i className="legend-dot unknown" /> Other</span>
              </div>
            )}
            <div className="mobile-web-map-container" ref={mapRef} />
          </div>
        )}
        {activeTab === 'table' && hydrated && ['SUPER_ADMIN'].includes(role) ? (
          <div className="mobile-web-field">
            <label className="mt-5">Details</label>
            <button type="button" className="mobile-web-secondary-btn mobile-web-detail-toggle" onClick={toggleDetails} disabled={detailLoading}>
              {showDetails ? 'Hide Enrichment Details' : 'Show Enrichment Details'}
            </button>
          </div>
        ) : null}
        {activeTab === 'table' && hydrated && ['SUPER_ADMIN'].includes(role) && showDetails ? (
          <div className="mobile-web-stack">
            {role === 'SUPER_ADMIN' && (
              <div className="mobile-web-action-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <button type="button" className="mobile-web-secondary-btn" onClick={downloadDetailCsv} disabled={!detailRows.length}>
                  Download Detailed CSV
                </button>
                <button type="button" className="mobile-web-secondary-btn" onClick={downloadDetailXls} disabled={!detailRows.length}>
                  Download Detailed Excel
                </button>
                <button type="button" className="mobile-web-gradient-btn subtle" onClick={downloadDbDump} disabled={dbDumpLoading}>
                  {dbDumpLoading ? `Downloading Dump... ${dbDumpProgress >= 0 ? (dbDumpProgress > 100 ? `${Math.round(dbDumpProgress / 1024 / 1024)} MB` : `${dbDumpProgress}%`) : ''}` : 'DOWNLOAD COMPLETE DB DUMP'}
                </button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  ref={masterFileInputRef}
                  onChange={handleMasterUpload}
                />
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  ref={resumeFileInputRef}
                  onChange={handleResumeMasterRoll}
                />
                <button
                  type="button"
                  className="mobile-web-gradient-btn subtle"
                  disabled={masterUploadLoading}
                  onClick={() => masterFileInputRef.current?.click()}
                >
                  {masterUploadLoading ? 'Importing master roll…' : 'UPLOAD MASTER ROLL EXCEL'}
                </button>
                {(masterUploadPhase === 'error' || canResumeMasterRoll) && !masterUploadLoading ? (
                  <button
                    type="button"
                    className="mobile-web-secondary-btn"
                    onClick={() => resumeFileInputRef.current?.click()}
                    title="Re-upload the same Excel; continues from last progress (no delete)"
                  >
                    Resume
                    {(() => {
                      try {
                        const p = Number(localStorage.getItem('masterRollLastProgress') || '0');
                        return p > 0 ? ` (from ~${p}%)` : '';
                      } catch {
                        return '';
                      }
                    })()}
                  </button>
                ) : null}
                {masterUploadLoading ? (
                  <div className="mobile-web-master-import-status w-full">
                    <div className="mobile-web-progress">
                      <div className="mobile-web-progress-label">
                        {masterUploadPhase === 'uploading'
                          ? `Uploading Excel file… ${masterUploadProgress}%`
                          : `${MASTER_ROLL_PHASE_LABELS[masterImportLive.phase] || 'Processing…'} (${masterUploadProgress}%)`}
                      </div>
                      <div className="mobile-web-progress-bar" aria-valuenow={masterUploadProgress} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${masterUploadProgress}%` }} />
                      </div>
                    </div>
                    <table className="mobile-web-import-counts">
                      <thead>
                        <tr>
                          <th>Table</th>
                          <th>Loaded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MASTER_ROLL_TABLE_ROWS.map((row) => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td>{Number(masterImportLive.inserted[row.key] ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {masterImportLive.assemblyNo ? (
                      <p className="mobile-web-import-hint">
                        Assembly {masterImportLive.assemblyNo}
                        {masterImportLive.assemblyName ? ` — ${masterImportLive.assemblyName}` : ''} appears in the dropdown as each step commits.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {masterUploadBanner.type === 'success' ? (
                  <div className="mobile-web-success mobile-web-import-banner w-full" role="status">
                    {masterUploadBanner.text}
                  </div>
                ) : null}
                {masterUploadBanner.type === 'error' ? (
                  <div className="mobile-web-error mobile-web-import-banner w-full" role="alert">
                    {masterUploadBanner.text}
                  </div>
                ) : null}
              </div>
            )}
            {detailError ? <div className="mobile-web-error">{detailError}</div> : null}
            {detailLoading ? <div className="mobile-web-empty">Loading enrichment details...</div> : null}
            {!detailLoading && detailRows.length === 0 ? <div className="mobile-web-empty">No enrichment details found.</div> : null}
            {!detailLoading && detailRows.length > 0 ? (
              <div className="mobile-web-analysis-table-wrap mobile-web-analysis-detail mobile-web-analysis-table-scroll" onScroll={handleDetailScroll}>
                <table className="mobile-web-analysis-table">
                  <thead>
                    <tr>
                      {detailColumns.map((key) => {
                        return <th key={key}>{volunteerEnrichmentColumnLabel(key)}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDetailRows.map((row, idx) => (
                      <tr key={`${row.epicNo || row.epic || 'row'}-${idx}`}>
                        {detailColumns.map((key) => (
                          <td key={`${idx}-${key}`}>{renderDetailValue(row, key)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </section>
    </ScreenFrame>
  );
}
export default function MobileDetailPage({ params }) {
  const [userRole, setUserRole] = useState('');
  const [assemblies, setAssemblies] = useState([]);
  const [selectedAssembly, setSelectedAssembly] = useState(() => {
    if (typeof window === 'undefined') return '';
    const code = getAssemblyCode();
    if (!code) return '';
    const asNum = parseInt(String(code), 10);
    return Number.isFinite(asNum) ? String(asNum) : String(code);
  });
  const [assemblyKey, setAssemblyKey] = useState(0);
  const hasHydrated = useHasHydrated();
  const userInfo = useMemo(() => (hasHydrated ? getUserInfoSafe() : {}), [hasHydrated]);

  useEffect(() => {
    // Aggressive scroll reset for mobile experience
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      const contentArea = document.querySelector('.content-area');
      if (contentArea) contentArea.scrollTop = 0;
    }

    const info = getUserInfoSafe();
    setUserRole(info?.role || '');
    const initialAsm = getAssemblyCode();
    const normalizedInitial = initialAsm ? String(parseInt(String(initialAsm), 10)) : '';

    if (info?.userName === 'admin@iswot.io' || info?.role === 'SUPER_ADMIN') {
      mobileApi.fetchVolunteerDropdown('ASSEMBLY').then((res) => {
        const raw = Array.isArray(res) ? res : (res?.data?.result || res?.result || []);
        const formatted = raw.map((item) => ({
          value: String(item.id),
          label: (item.name && !item.name.toLowerCase().includes('assembly') && !item.name.includes(String(item.id)))
            ? `${item.name} (${item.id})`
            : (item.name || `Assembly ${item.id}`),
        }));
        setAssemblies(formatted);
        const validInitial = normalizedInitial && formatted.some((a) => String(a.value) === normalizedInitial);
        const nextAssembly = validInitial ? normalizedInitial : (formatted[0]?.value || '');
        setSelectedAssembly(nextAssembly);
        if (nextAssembly && typeof window !== 'undefined') {
          localStorage.setItem('assemblyCode', nextAssembly);
          if (!validInitial) setAssemblyKey((prev) => prev + 1);
        }
      }).catch(() => {
        setAssemblies([]);
        setSelectedAssembly(normalizedInitial);
      });
    } else {
      setSelectedAssembly(normalizedInitial || initialAsm);
    }

    // Refresh profile to sync ward/booth assignments if they are missing
    if (info?.token && !info.wardIds && !info.boothIds && info.role !== 'SUPER_ADMIN') {
      mobileApi.fetchMe().then(res => {
        const updated = res?.data?.result || res?.result || res;
        if (updated && updated.userName) {
          const merged = { ...info, ...updated };
          localStorage.setItem('userInfo', JSON.stringify(merged));
        }
      }).catch(err => console.warn('Failed to refresh user profile:', err));
    }
  }, [params.slug, userInfo?.token]);

  const handleAssemblyChange = (asmId) => {
    setSelectedAssembly(asmId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('assemblyCode', asmId);
      setAssemblyKey(prev => prev + 1);
    }
  };

  const slug = params.slug;
  const screen = labels[slug] || { title: 'Mobile Screen', description: 'This mobile module is being converted for the web experience.' };
  const isSuperAdmin = userInfo?.userName === 'admin@iswot.io' || userRole === 'SUPER_ADMIN';

  const globalAssemblySelector = isSuperAdmin && assemblies.length > 0 && slug !== 'add-volunteer' && (
    <div className="mobile-web-global-assembly-bar bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Context</label>
        <div className="flex-1">
          <SingleOptionSelect
            label="Assembly"
            options={assemblies.map(a => a.label)}
            value={
              assemblies.find((a) => String(a.value) === String(selectedAssembly))?.label
              || assemblies[0]?.label
              || ''
            }
            onSelect={(label) => handleAssemblyChange(assemblies.find(a => a.label === label)?.value || '')}
            customValue=""
            onCustomValueChange={() => {}}
          />
        </div>
      </div>
    </div>
  );

  if ((slug === 'voters-family' || slug === 'meetings') && userRole && !['SUPER_ADMIN', 'ADMIN', 'WARD', 'BOOTH', 'USER'].includes(userRole)) {
    return (
      <ScreenFrame>
        <section className="mobile-web-card text-center p-6 text-red-600 font-bold border border-red-200 bg-red-50 rounded-xl mt-6">
          Access Restricted: Proper Volunteer Level Required
        </section>
      </ScreenFrame>
    );
  }

  const renderScreen = () => {
    const commonProps = { assemblyCodeProp: selectedAssembly };
    if (slug === 'meetings' || slug === 'poll-day' || slug === 'print') {
      return <FeatureUnavailableScreen />;
    }
    if (slug === 'search-voter') return <SearchVoterScreen key={assemblyKey} {...commonProps} />;
    if (slug === 'search-booth') return <SearchBoothScreen key={assemblyKey} {...commonProps} />;
    if (slug === 'voters-family') return <VotersFamilyScreen key={assemblyKey} {...commonProps} />;
    if (slug === 'extract') return <ExtractScreen key={assemblyKey} {...commonProps} />;
    if (slug === 'add-volunteer') return <AddVolunteerScreen key={assemblyKey} />;
    if (slug === 'my-volunteers') return <MyVolunteersScreen key={assemblyKey} {...commonProps} />;
    if (slug === 'volunteer-analysis') {
      if (userRole === 'BOOTH') {
        return (
          <ScreenFrame accent="light">
            <section className="mobile-web-card">
              <div className="mobile-web-empty">Volunteer Analysis is not available for booth-level access.</div>
            </section>
          </ScreenFrame>
        );
      }
      return <VolunteerAnalysisScreen key={assemblyKey} {...commonProps} />;
    }
    if (slug === 'promotions') return <PromotionsScreen key={assemblyKey} {...commonProps} />;
    return (
      <section className="mobile-web-card">
        <p className="text-slate-600">{screen.description}</p>
        <p className="text-slate-500 mt-3">Search Booth and Search Voter now support booth list, voter list, and voter info drill-down.</p>
        <div className="mt-4">
          <Link href="/mobile/search-voter" className="mobile-web-primary-btn">Go to Search Voter</Link>
        </div>
      </section>
    );
  };

  return (
    <>
      {globalAssemblySelector}
      {renderScreen()}
    </>
  );
}
