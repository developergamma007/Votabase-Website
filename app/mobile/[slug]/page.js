'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowBackIosNewRounded,
  ExpandMoreRounded,
  LocationOnOutlined,
  PersonOutlineRounded,
  PhoneOutlined,
  SearchRounded,
  SmsOutlined,
  WhatsApp,
} from '@mui/icons-material';
import { getAssemblyCode, mobileApi } from '../../lib/mobileApi';

const BOOTH_CACHE_KEY = 'boothSnapshotLite';
const PAGE_SIZE = 50;

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
    title: 'Voters Family',
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

const fieldGroups = { PRIMARY: ['mobile', 'dob', 'caste', 'community', 'civicIssue', 'natureOfVoter'], ADDITIONAL: ['education', 'motherTongue', 'residenceType', 'ownership', 'voterPoints', 'govtSchemeTracking', 'engagementPotential', 'ifShifted'] };
const fieldLabels = { mobile: 'Mobile Number (10 Digits)', dob: 'Date of Birth', caste: 'Caste', community: 'Community', civicIssue: 'Civic Issues', natureOfVoter: 'Nature (A/B/C/NA)', education: 'Education', motherTongue: 'Mother Tongue', residenceType: 'Residence Type', ownership: 'Ownership', voterPoints: 'Voter Points', govtSchemeTracking: 'Govt Scheme Tracking', engagementPotential: 'Engagement Potential', ifShifted: 'If shifted - Transport & Booth Details' };

function getDefaultVoterForm(voter = {}) { const parseList = (value) => { if (!value) return []; if (Array.isArray(value)) return value; return String(value).split(',').map((item) => item.trim()).filter(Boolean); }; return { mobile: voter.mobile || '', dob: voter.dob || '', community: voter.community || '', caste: voter.caste || '', motherTongue: voter.motherTongue || '', education: voter.education || '', residenceType: voter.residenceType || '', ownership: voter.ownership || '', voterPoints: voter.voterPoints || '', govtSchemeTracking: Array.isArray(voter.govtSchemeTracking) ? voter.govtSchemeTracking : voter.govtSchemeTracking ? [voter.govtSchemeTracking] : [], engagementPotential: voter.engagementPotential || '', ifShifted: voter.ifShifted || '', status: voter.status || '', civicIssue: voter.civicIssue || '', natureOfVoter: voter.natureOfVoter || '', notes: voter.notes || '', presentAddress: voter.presentAddress || '', newWard: parseList(voter.newWard), newBoothNo: parseList(voter.newBoothNo), newSerialNo: voter.newSerialNo || '', notAvailableReason: voter.notAvailableReason || '' }; }
async function resolveSnapshot(payload) { const result = payload?.data?.result; if (!result) throw new Error('No snapshot found'); if (typeof result === 'string') { const raw = await fetch(result); if (!raw.ok) throw new Error(`Snapshot link fetch failed: ${raw.status}`); return raw.json(); } return result; }
function ScreenFrame({ children, accent = 'blue' }) { return <div className={`mobile-web-screen mobile-web-screen-${accent}`}>{children}</div>; }
function useInfiniteTrigger(enabled, onLoadMore) { const sentinelRef = useRef(null); useEffect(() => { if (!enabled || !sentinelRef.current) return undefined; const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) onLoadMore(); }, { rootMargin: '240px 0px' }); observer.observe(sentinelRef.current); return () => observer.disconnect(); }, [enabled, onLoadMore]); return sentinelRef; }
function boothStats(booth) { const stats = booth?.voterStats || {}; const voters = booth?.voters || []; return { total: Number.isFinite(stats.total) ? stats.total : voters.length, male: Number.isFinite(stats.male) ? stats.male : voters.filter((v) => (v.gender || '').toUpperCase().startsWith('M')).length, female: Number.isFinite(stats.female) ? stats.female : voters.filter((v) => (v.gender || '').toUpperCase().startsWith('F')).length }; }
function normalizeVoter(voter, fallbackBooth) { const boothInfo = voter?.boothInfo || {}; const gender = voter?.gender || voter?.sex || '-'; const genderUpper = String(gender).toUpperCase(); return { ...voter, voterId: voter?.voterId ?? voter?.id ?? voter?.epicNo, serialNo: voter?.sl ?? voter?.srNo ?? voter?.serialNo ?? voter?.slNo ?? '-', epicNo: voter?.epicNo ?? voter?.epic ?? '-', name: voter?.firstMiddleNameEn || voter?.name || voter?.voterName || '-', relationLabel: voter?.relationType || voter?.rel_type || 'Father', relationName: voter?.relationFirstMiddleNameEn || voter?.relationNameEn || voter?.fatherName || voter?.motherName || voter?.relation_name_en || '', houseNo: voter?.houseNoEn ?? voter?.house ?? voter?.house_no_en ?? '-', age: voter?.age ?? '-', gender, genderClass: genderUpper.startsWith('M') ? 'male' : genderUpper.startsWith('F') ? 'female' : 'other', boothLabel: fallbackBooth?.boothLabel || boothInfo?.boothNameEn || voter?.boothNameEn || '', boothId: fallbackBooth?.boothId || boothInfo?.boothId || voter?.boothId || '', boothNo: voter?.boothNo || boothInfo?.boothNo || '', wardCode: (voter?.wardCode ?? fallbackBooth?.wardCode) || boothInfo?.wardCode || '' }; }
function normalizeMobileValue(value) { return String(value || '').replace(/\D/g, '').slice(0, 10); }
function maskTrailingValue(value) { const raw = String(value || ''); return raw.length > 4 ? `${'*'.repeat(raw.length - 4)}${raw.slice(-4)}` : raw; }
const LOCATION_CACHE_KEY = 'lastKnownLocation';
const LOCATION_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
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
  if (!err) return 'Location permission is required to open voter info.';
  if (err.code === 1) return 'Location permission denied. Please allow it in browser settings and retry.';
  if (err.code === 2) return 'Position update is unavailable. Turn on device location services and allow the browser to use it.';
  if (err.code === 3) return 'Location request timed out. Please retry.';
  return err?.message || 'Location permission is required to open voter info.';
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
        const position = await runGeo({ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
        setCachedLocation(position);
        resolve(position);
      } catch (err) {
        if (err?.code === 2 || err?.code === 3) {
          try {
            const position = await runGeo({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
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
function normalizeBoothLocationLink(booth, templateLink) {
  if (templateLink) return templateLink;
  const lat = booth?.latitude ?? booth?.lat ?? booth?.boothLat ?? booth?.booth_lat;
  const lng = booth?.longitude ?? booth?.lng ?? booth?.boothLng ?? booth?.booth_long;
  if (!lat || !lng) return '';
  return `https://maps.google.com/?q=${lat},${lng}`;
}
function buildWhatsAppMessage(voter, booth, template) {
  const authority = template?.authorityName || 'Greater Bengaluru Authority';
  const election = template?.electionName || 'Election-2026';
  const assembly = template?.assemblyLabel || 'Assembly';
  const ward = template?.wardLabel || 'Ward';
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
    `${assembly}`,
    `${ward}`,
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
    'Kindly do Cast Your Valuable Vote for INC',
    candidateName,
    candidateParty,
    candidateWard,
    socialLink,
  ];
  return lines.filter((item) => item !== '').join('\n').trim();
}
function buildSMSMessage(voter, booth, template) {
  const authority = template?.authorityName || 'Greater Bengaluru Authority';
  const election = template?.electionName || 'Election-2026';
  const assembly = template?.assemblyLabel || 'Assembly';
  const ward = template?.wardLabel || 'Ward';
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
    `${assembly}`,
    `${ward}`,
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
    'Kindly do Cast Your Valuable Vote for INC',
    candidateName,
    candidateParty,
    candidateWard,
    socialLink,
  ];
  return lines.filter((item) => item !== '').join('\n').trim();
}
function getWardOptionsFromCache() { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; const labels = wards.map((ward) => ward.wardNameEn || `Ward ${ward.wardId}`); const unique = Array.from(new Set(labels.filter(Boolean))); if (!unique.includes('Others')) unique.push('Others'); return unique; } catch { return ['Others']; } }
function getBoothOptionsFromCache() { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; const booths = wards.flatMap((ward) => (ward.booths || []).map((booth) => booth.boothNameEn || booth.nameEn || booth.booth_add_en || `Booth ${booth.boothId ?? booth.id ?? booth.booth_no ?? ''}`)); const unique = Array.from(new Set(booths.filter(Boolean))); if (!unique.includes('Others')) unique.push('Others'); return unique; } catch { return ['Others']; } }
function MobileHeader({ title, subtitle, onBack, hideAvatar = false }) { return <div className={`mobile-web-list-topbar ${hideAvatar ? 'no-avatar' : ''}`}><button className="mobile-web-back-btn" onClick={onBack} type="button"><ArrowBackIosNewRounded fontSize="small" /></button><div className="mobile-web-header-copy"><h2>{title}</h2>{subtitle ? <div className="mobile-web-header-subtitle">{subtitle}</div> : null}</div>{hideAvatar ? <div /> : <div className="mobile-web-avatar"><PersonOutlineRounded /></div>}</div>; }
function useDropdownDismiss(rootRef, onClose) { useEffect(() => { const handlePointerDown = (event) => { if (!rootRef.current?.contains(event.target)) onClose(); }; document.addEventListener('mousedown', handlePointerDown); return () => document.removeEventListener('mousedown', handlePointerDown); }, [rootRef, onClose]); }
function SingleOptionSelect({ label, options, value, customValue, onSelect, onCustomValueChange, disabled = false }) { const [open, setOpen] = useState(false); const rootRef = useRef(null); useDropdownDismiss(rootRef, () => setOpen(false)); const optionSet = new Set(options); const isUnknown = !!value && value !== 'Others' && !optionSet.has(value); const showOther = value === 'Others' || isUnknown || !!customValue; const summaryValue = showOther ? 'Others' : value; const otherValue = customValue || (isUnknown ? value : ''); return <div className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}><button className="mobile-web-multiselect-trigger" type="button" disabled={disabled} onClick={() => { if (disabled) return; setOpen((current) => !current); }}><span className={summaryValue ? 'has-value' : 'is-placeholder'}>{summaryValue || `Select ${label}`}</span><ExpandMoreRounded className="mobile-web-select-icon" /></button>{open ? <div className="mobile-web-multiselect-panel">{options.map((option) => { const checked = option === 'Others' ? showOther : value === option; return <button key={option} type="button" className={`mobile-web-single-select-option ${checked ? 'checked' : ''}`} onClick={() => { onSelect(option); setOpen(false); }}><span>{option}</span></button>; })}</div> : null}{showOther ? <input className="mobile-web-input mobile-web-other-input" placeholder={`Enter ${label.toLowerCase()}`} value={otherValue} onChange={(e) => onCustomValueChange(e.target.value)} /> : null}</div>; }
function MultiCheckboxSelect({ label, options, value, customValue, onToggle, onCustomValueChange, disabled = false }) { const [open, setOpen] = useState(false); const rootRef = useRef(null); useDropdownDismiss(rootRef, () => setOpen(false)); const optionSet = new Set(options); const selectedLabels = value.filter((item) => item !== 'Others' && optionSet.has(item)); const unknownLabels = value.filter((item) => item !== 'Others' && !optionSet.has(item)); const otherValue = customValue || unknownLabels.join(', '); const showOther = value.includes('Others') || unknownLabels.length > 0 || !!customValue; const summaryItems = selectedLabels.length ? selectedLabels.slice() : []; if (showOther) summaryItems.push('Others'); const summary = summaryItems.length ? `${summaryItems[0]}${summaryItems.length > 1 ? ` +${summaryItems.length - 1}` : ''}` : `Select ${label}`; return <div className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}><button className="mobile-web-multiselect-trigger" type="button" disabled={disabled} onClick={() => { if (disabled) return; setOpen((current) => !current); }}><span className={summaryItems.length ? 'has-value' : 'is-placeholder'}>{summary}</span><ExpandMoreRounded className="mobile-web-select-icon" /></button>{open ? <div className="mobile-web-multiselect-panel">{options.map((option) => { const checked = option === 'Others' ? showOther : value.includes(option); return <label key={option} className={`mobile-web-multiselect-option ${checked ? 'checked' : ''}`}><input type="checkbox" checked={checked} onChange={() => onToggle(option)} /><span>{option}</span></label>; })}</div> : null}{showOther ? <input className="mobile-web-input mobile-web-other-input" placeholder={`Enter ${label.toLowerCase()}`} value={otherValue} onChange={(e) => onCustomValueChange(e.target.value)} /> : null}</div>; }
function VoterInfoScreen({ voter, booth, onBack, onSave }) {
  const [activeTab, setActiveTab] = useState('PRIMARY');
  const [form, setForm] = useState(() => getDefaultVoterForm(voter));
  const [customValues, setCustomValues] = useState({});
  const [location, setLocation] = useState(
    voter?.latitude && voter?.longitude ? { latitude: voter.latitude, longitude: voter.longitude } : null
  );
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });
  const [mobileFocused, setMobileFocused] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(null);
  const [templateDraft, setTemplateDraft] = useState({});
  const [templateStatus, setTemplateStatus] = useState({ loading: false, error: '', success: '' });
  const [bannerUpload, setBannerUpload] = useState({ loading: false, error: '' });
  const lastEpicRef = useRef(null);
  const skipScrollRef = useRef(false);

  const baseForm = useMemo(() => getDefaultVoterForm(voter), [voter]);
  const basePayload = useMemo(() => buildVoterPayload(baseForm, {}), [baseForm]);
  const currentPayload = useMemo(() => buildVoterPayload(form, customValues), [form, customValues]);
  const hasChanges = useMemo(
    () => Object.keys(currentPayload).some((key) => voterFieldChanged(currentPayload[key], basePayload[key])),
    [currentPayload, basePayload]
  );

  useEffect(() => {
    const currentEpic = voter?.epicNo || voter?.epic || voter?.voterId || '';
    const isSameVoter = lastEpicRef.current && lastEpicRef.current === currentEpic;
    setForm(getDefaultVoterForm(voter));
    setCustomValues({});
    setMobileFocused(false);
    if (!isSameVoter) setBanner({ type: '', text: '' });
    lastEpicRef.current = currentEpic;
    if (typeof window !== 'undefined') {
      if (skipScrollRef.current) {
        skipScrollRef.current = false;
      } else if (!isSameVoter) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  }, [voter]);

  const boothNumber = booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '';
  const boothTitle = `${boothNumber}${booth?.boothLabel || voter?.boothLabel ? ' - ' : ''}${booth?.boothLabel || voter?.boothLabel || ''}`;
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('role') || '' : '';
  const userInfo = typeof window !== 'undefined' ? (() => {
    try { return JSON.parse(localStorage.getItem('userInfo') || '{}'); } catch { return {}; }
  })() : {};
  const isAdminUser = ['SUPER_ADMIN', 'ADMIN'].includes(userRole.replace('ROLE_', '').toUpperCase());
  const wardId = booth?.wardId || voter?.wardId || voter?.ward_id || '';
  const wardLabel = booth?.wardNameEn || voter?.wardNameEn || voter?.wardLabel || '';
  const resolvedPhone = normalizeMobileValue(currentPayload.mobile || voter?.mobile);
  const mapTarget = useMemo(() => {
    const lat = location?.latitude ?? voter?.latitude;
    const lng = location?.longitude ?? voter?.longitude;
    if (!lat || !lng) return null;
    return { latitude: lat, longitude: lng };
  }, [location, voter]);
  const mapSrc = mapTarget
    ? `https://maps.google.com/maps?q=${mapTarget.latitude},${mapTarget.longitude}&z=15&output=embed`
    : '';

  const handleFieldChange = (key, value) => {
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
    setForm(getDefaultVoterForm(voter));
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
    if (!location?.latitude || !location?.longitude) {
      setBanner({ type: 'error', text: 'Location is required before updating voter info.' });
      return;
    }
    setSaving(true);
    setBanner({ type: '', text: '' });
    try {
      await mobileApi.updateVoter(
        voter.epicNo,
        {
          updateLocationLat: location?.latitude || 0,
          updateLocationLng: location?.longitude || 0,
          updateRequest: {
            ...currentPayload,
            latitude: location?.latitude || voter?.latitude || 0,
            longitude: location?.longitude || voter?.longitude || 0,
          },
        },
        { boothNo: voter?.boothNo, wardCode: voter?.wardCode || booth?.wardCode }
      );
      setBanner({ type: 'success', text: 'Voter updated successfully.' });
      skipScrollRef.current = true;
      onSave?.({ ...voter, ...currentPayload, latitude: location?.latitude, longitude: location?.longitude });
    } catch (error) {
      setBanner({ type: 'error', text: error?.message || error?.detail || 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  const openSms = () => {
    if (resolvedPhone.length !== 10) {
      setBanner({ type: 'error', text: 'Invalid mobile number.' });
      return;
    }
    if (!messageTemplate?.enabled) {
      setBanner({ type: 'error', text: 'SMS is disabled until the latest data file is uploaded.' });
      return;
    }
    const encodedMessage = encodeURIComponent(buildSMSMessage({ ...voter, ...currentPayload }, booth, messageTemplate));
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${resolvedPhone}${separator}body=${encodedMessage}`;
  };

  const openWhatsApp = () => {
    if (resolvedPhone.length !== 10) {
      setBanner({ type: 'error', text: 'Invalid mobile number.' });
      return;
    }
    if (!messageTemplate?.enabled) {
      setBanner({ type: 'error', text: 'WhatsApp is disabled until the latest data file is uploaded.' });
      return;
    }
    const encodedMessage = encodeURIComponent(buildWhatsAppMessage({ ...voter, ...currentPayload }, booth, messageTemplate));
    window.open(`https://wa.me/91${resolvedPhone}?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
  };

  const openCall = () => {
    if (resolvedPhone.length !== 10) {
      setBanner({ type: 'error', text: 'Invalid mobile number.' });
      return;
    }
    window.location.href = `tel:${resolvedPhone}`;
  };


  const renderSelect = (key, placeholder, multiple = false) => {
    const options = dropdownOptions[key] || [];
    if (multiple) {
      return (
        <MultiCheckboxSelect
          label={placeholder}
          options={options}
          value={form[key]}
          customValue={customValues[key]}
          onToggle={toggleGovtScheme}
          onCustomValueChange={(nextValue) => setCustomValues((prev) => ({ ...prev, [key]: nextValue }))}
        />
      );
    }
    return (
      <SingleOptionSelect
        label={placeholder}
        options={options}
        value={form[key]}
        customValue={customValues[key]}
        onSelect={(option) => handleFieldChange(key, option)}
        onCustomValueChange={(nextValue) => setCustomValues((prev) => ({ ...prev, [key]: nextValue }))}
      />
    );
  };

  const renderField = (key) => {
    if (key === 'mobile') {
      return (
        <input
          className="mobile-web-input"
          inputMode="numeric"
          maxLength={10}
          value={mobileFocused ? form.mobile : maskTrailingValue(form.mobile)}
          placeholder={fieldLabels[key]}
          onFocus={() => setMobileFocused(true)}
          onBlur={() => setMobileFocused(false)}
          onChange={(e) => handleFieldChange(key, e.target.value)}
        />
      );
    }
    if (key === 'dob') {
      return (
        <input
          className="mobile-web-input"
          type="date"
          value={form[key]}
          placeholder={fieldLabels[key]}
          onChange={(e) => handleFieldChange(key, e.target.value)}
        />
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
    setActiveTab(tab);
  };

  useEffect(() => {
    let active = true;
    const loadTemplate = async () => {
      setTemplateStatus({ loading: true, error: '', success: '' });
      try {
        const res = await mobileApi.fetchMessageTemplate(wardId, 'WHATSAPP');
        if (!active) return;
        const tpl = res?.data?.result || null;
        setMessageTemplate(tpl);
        setTemplateDraft({
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
        });
      } catch (error) {
        if (!active) return;
        setTemplateStatus({ loading: false, error: error?.message || 'Unable to load message template.', success: '' });
      } finally {
        if (active) setTemplateStatus((prev) => ({ ...prev, loading: false }));
      }
    };
    if (wardId) loadTemplate();
    return () => { active = false; };
  }, [wardId, wardLabel]);

  const handleTemplateChange = (key, value) => {
    setTemplateDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleTemplateSave = async () => {
    setTemplateStatus({ loading: true, error: '', success: '' });
    try {
      const payload = {
        wardId: wardId || null,
        channel: 'WHATSAPP',
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
        enabled: templateDraft.enabled,
      };
      const res = await mobileApi.saveMessageTemplate(payload);
      const tpl = res?.data?.result || null;
      setMessageTemplate(tpl);
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
      setMessageTemplate(tpl);
      setTemplateDraft((prev) => ({ ...prev, bannerUrl: tpl?.bannerUrl || prev.bannerUrl }));
      setBannerUpload({ loading: false, error: '' });
    } catch (error) {
      setBannerUpload({ loading: false, error: error?.message || 'Unable to upload banner.' });
    }
  };

  return (
    <div className="mobile-web-stack">
      <MobileHeader title="Voter Info" onBack={onBack} />
      {banner.text && banner.type === 'error' ? <div className="mobile-web-error">{banner.text}</div> : null}
      <section className="mobile-web-detail-card">
        <div className="mobile-web-detail-meta">
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
            <div className="mobile-web-map-placeholder">Capture location to preview map.</div>
          )}
        </div>
        <button className="mobile-web-location-btn" onClick={getLocation} type="button">
          <LocationOnOutlined />
          <span>{location ? 'Location Captured' : 'Get Location'}</span>
        </button>
        <div className="mobile-web-contact-actions">
          <button className="mobile-web-contact-btn" onClick={openSms} type="button" disabled={!messageTemplate?.enabled}>
            <SmsOutlined />
            <span>SMS</span>
          </button>
          <button className="mobile-web-contact-btn" onClick={openWhatsApp} type="button" disabled={!messageTemplate?.enabled}>
            <WhatsApp />
            <span>WhatsApp</span>
          </button>
          <button className="mobile-web-contact-btn" onClick={openCall} type="button">
            <PhoneOutlined />
            <span>Call</span>
          </button>
        </div>
        {!messageTemplate?.enabled ? (
          <div className="mobile-web-warning">WhatsApp & SMS are disabled until the next data file upload.</div>
        ) : null}
      </section>
      {isAdminUser ? (
        <section className="mobile-web-detail-card mobile-web-template-card">
          <div className="mobile-web-section-title">WhatsApp / SMS Template (Admin)</div>
          {templateStatus.error ? <div className="mobile-web-error">{templateStatus.error}</div> : null}
          {templateStatus.success ? <div className="mobile-web-success">{templateStatus.success}</div> : null}
          <div className="mobile-web-form-grid two-cols">
            <div className="mobile-web-field">
              <label>Authority Name</label>
              <input className="mobile-web-input" value={templateDraft.authorityName || ''} onChange={(e) => handleTemplateChange('authorityName', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Election Name</label>
              <input className="mobile-web-input" value={templateDraft.electionName || ''} onChange={(e) => handleTemplateChange('electionName', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Assembly</label>
              <input className="mobile-web-input" value={templateDraft.assemblyLabel || ''} onChange={(e) => handleTemplateChange('assemblyLabel', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Ward</label>
              <input className="mobile-web-input" value={templateDraft.wardLabel || ''} onChange={(e) => handleTemplateChange('wardLabel', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Candidate Name</label>
              <input className="mobile-web-input" value={templateDraft.candidateName || ''} onChange={(e) => handleTemplateChange('candidateName', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Candidate Party</label>
              <input className="mobile-web-input" value={templateDraft.candidateParty || ''} onChange={(e) => handleTemplateChange('candidateParty', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Candidate Ward Label</label>
              <input className="mobile-web-input" value={templateDraft.candidateWardLabel || ''} onChange={(e) => handleTemplateChange('candidateWardLabel', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Vote Date</label>
              <input className="mobile-web-input" placeholder="13-MAY-2024" value={templateDraft.voteDate || ''} onChange={(e) => handleTemplateChange('voteDate', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Vote Time</label>
              <input className="mobile-web-input" placeholder="7.00AM-6.00PM" value={templateDraft.voteTime || ''} onChange={(e) => handleTemplateChange('voteTime', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Social Media Link</label>
              <input className="mobile-web-input" placeholder="https://www.facebook.com/..." value={templateDraft.socialLink || ''} onChange={(e) => handleTemplateChange('socialLink', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Booth Location Link</label>
              <input className="mobile-web-input" placeholder="https://maps.google.com/?q=lat,lng" value={templateDraft.boothLocationLink || ''} onChange={(e) => handleTemplateChange('boothLocationLink', e.target.value)} />
            </div>
          </div>
          <div className="mobile-web-inline-toggle">
            <input
              id="messageEnabled"
              type="checkbox"
              checked={!!templateDraft.enabled}
              onChange={(e) => handleTemplateChange('enabled', e.target.checked)}
            />
            <label htmlFor="messageEnabled">Enable WhatsApp/SMS for this ward (after latest data upload)</label>
          </div>
          <div className="mobile-web-upload-row">
            <div>
              <label className="mobile-web-upload-label">Upload Banner / Candidate Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleBannerUpload(e.target.files?.[0])}
                disabled={bannerUpload.loading}
              />
              {bannerUpload.error ? <div className="mobile-web-error">{bannerUpload.error}</div> : null}
              {templateDraft.bannerUrl ? <div className="mobile-web-upload-preview">Uploaded: {templateDraft.bannerUrl}</div> : null}
            </div>
            <button className="mobile-web-primary-btn" onClick={handleTemplateSave} type="button" disabled={templateStatus.loading}>
              {templateStatus.loading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </section>
      ) : null}
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
            {(form.status === 'Shifted in the ward' || form.status === 'Shifted outside the ward') && (
              <div className="mobile-web-field">
                <label>Enter present address</label>
                <textarea
                  className="mobile-web-input mobile-web-textarea"
                  value={form.presentAddress}
                  onChange={(e) => handleFieldChange('presentAddress', e.target.value)}
                  placeholder="Enter present address"
                />
              </div>
            )}
            {form.status === 'Recommend shift to the new ward' && (
              <>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <input
                    className="mobile-web-input"
                    value={form.newWard}
                    onChange={(e) => handleFieldChange('newWard', e.target.value)}
                    placeholder="Enter ward"
                  />
                </div>
                <div className="mobile-web-field">
                  <label>Booth No</label>
                  <input
                    className="mobile-web-input"
                    value={form.newBoothNo}
                    onChange={(e) => handleFieldChange('newBoothNo', e.target.value)}
                    placeholder="Enter booth number"
                  />
                </div>
                <div className="mobile-web-field">
                  <label>Serial No</label>
                  <input
                    className="mobile-web-input"
                    value={form.newSerialNo}
                    onChange={(e) => handleFieldChange('newSerialNo', e.target.value)}
                    placeholder="Enter serial number"
                  />
                </div>
              </>
            )}
            {form.status === 'Not available' && (
              <div className="mobile-web-field">
                <label>Enter the reason</label>
                <textarea
                  className="mobile-web-input mobile-web-textarea"
                  value={form.notAvailableReason}
                  onChange={(e) => handleFieldChange('notAvailableReason', e.target.value)}
                  placeholder="Enter the reason"
                />
              </div>
            )}
            <div className="mobile-web-field">
              <label>ENTER NOTES</label>
              <textarea
                className="mobile-web-input mobile-web-textarea"
                value={form.notes}
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
        <button className="mobile-web-slip-btn" onClick={() => window.print()} type="button">
          Voter Slip Print
        </button>
      </section>
    </div>
  );
}
function VoterListScreen({ heading, voters, booth, loading, errorText, onBack, onLoadMore, hasMore, summary, mode = 'local', onSelectVoter, onRetryLocation }) { const [query, setQuery] = useState(''); const [localVisibleCount, setLocalVisibleCount] = useState(PAGE_SIZE); useEffect(() => { setQuery(''); setLocalVisibleCount(PAGE_SIZE); }, [heading, booth?.boothId]); const normalizedVoters = useMemo(() => voters.map((voter) => normalizeVoter(voter, booth)).sort((a, b) => { const aNum = Number.parseInt(String(a.serialNo ?? '').replace(/[^\d]/g, ''), 10); const bNum = Number.parseInt(String(b.serialNo ?? '').replace(/[^\d]/g, ''), 10); const aVal = Number.isFinite(aNum) ? aNum : Number.POSITIVE_INFINITY; const bVal = Number.isFinite(bNum) ? bNum : Number.POSITIVE_INFINITY; return aVal - bVal; }), [voters, booth]); const filteredVoters = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return normalizedVoters; return normalizedVoters.filter((voter) => [voter.name, voter.epicNo, voter.relationName, voter.houseNo, voter.gender, voter.boothId, voter.boothLabel].filter(Boolean).join(' ').toLowerCase().includes(q)); }, [normalizedVoters, query]); const displayedVoters = mode === 'local' ? filteredVoters.slice(0, localVisibleCount) : filteredVoters; const resolvedSummary = booth ? boothStats(booth) : { total: Number(summary?.total ?? filteredVoters.length), male: Number(summary?.male ?? filteredVoters.filter((v) => String(v.gender).toUpperCase().startsWith('M')).length), female: Number(summary?.female ?? filteredVoters.filter((v) => String(v.gender).toUpperCase().startsWith('F')).length) }; const canLoadMoreLocal = mode === 'local' && displayedVoters.length < filteredVoters.length; const sentinelRef = useInfiniteTrigger(canLoadMoreLocal || (!!hasMore && mode === 'remote'), () => { if (canLoadMoreLocal) setLocalVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredVoters.length)); else if (hasMore && onLoadMore) onLoadMore(); }); const headerTitle = booth?.boothNo || booth?.boothId ? `${booth?.boothNo ?? booth?.boothId} - ${booth?.boothLabel || ''}` : heading; const headerSubtitle = <><span className="mobile-web-stat-pill total">Total Voters: <strong>{resolvedSummary.total}</strong></span><span className="mobile-web-stat-pill male">Male: <strong>{resolvedSummary.male}</strong></span><span className="mobile-web-stat-pill female">Female: <strong>{resolvedSummary.female}</strong></span></>; return <div className="mobile-web-stack"><MobileHeader title={headerTitle} subtitle={headerSubtitle} onBack={onBack} hideAvatar={true} /><section className="mobile-web-search-card mobile-web-card"><div className="mobile-web-search-input-wrap"><SearchRounded className="mobile-web-search-icon" /><input className="mobile-web-input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></div></section>{errorText ? <div className="mobile-web-error"><div>{errorText}</div>{onRetryLocation ? <button type="button" className="mobile-web-secondary-btn" onClick={onRetryLocation}>Retry Location</button> : null}</div> : null}{loading && displayedVoters.length === 0 ? <div className="mobile-web-empty">Loading voters...</div> : null}<section className="mobile-web-voter-list">{displayedVoters.map((voter) => <button key={`${voter.boothId}-${voter.voterId}-${voter.epicNo}`} type="button" className="mobile-web-voter-card mobile-web-voter-button" onClick={() => onSelectVoter?.(voter, booth)}><div className="mobile-web-voter-card-head"><span>{voter.voterId ?? '-'}</span><strong>{voter.epicNo}</strong></div><div className="mobile-web-voter-grid"><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Name</span><span className="mobile-web-voter-value">{voter.name}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">{voter.relationLabel}</span><span className="mobile-web-voter-value">{voter.relationName || '-'}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">House No.</span><span className="mobile-web-voter-value">{voter.houseNo}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Age</span><span className="mobile-web-voter-value">{voter.age}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Sex</span><span className={`mobile-web-voter-value mobile-web-gender-chip ${voter.genderClass}`}>{voter.gender}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Booth</span><span className="mobile-web-voter-value">{voter.boothNo ? `${voter.boothNo} - ` : voter.boothId ? `${voter.boothId} - ` : ''}{voter.boothLabel || '-'}</span></div></div></button>)}</section>{!loading && displayedVoters.length === 0 ? <div className="mobile-web-empty">No voters found.</div> : null}{(canLoadMoreLocal || hasMore) ? <div ref={sentinelRef} className="mobile-web-load-note">Loading more...</div> : null}</div>; }
function SearchVoterScreen() {
  const assemblyCode = getAssemblyCode();
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
  const [view, setView] = useState('search');
  const [voterResults, setVoterResults] = useState([]);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [resultMeta, setResultMeta] = useState(null);
  const lastWardLoadRef = useRef('');
  const lastSelectionRef = useRef(null);

  useEffect(() => {
    const key = String(assemblyCode || '');
    if (lastWardLoadRef.current === key && wardItems.length > 0) return;
    let active = true;
    setErrorText('');
    mobileApi.fetchWards().then((res) => {
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
      setWardItems(list);
      if (list.length > 0) lastWardLoadRef.current = key;
      if (!list.length) setErrorText('No wards found for this user.');
    }).catch((error) => {
      setWardItems([]);
      setErrorText(error?.message || error?.detail || 'Unable to load wards.');
    });
    return () => {
      active = false;
    };
  }, [assemblyCode, wardItems.length]);

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
    const response = await mobileApi.searchVoters({
      assemblyCode,
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
    const nextResults = response?.data?.result || [];
    const meta = response?.data?.meta || {};
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
    if (!assemblyCode) {
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
    setSelectedVoter(updatedVoter);
    setVoterResults((current) =>
      current.map((item) => (item.voterId === updatedVoter.voterId ? { ...item, ...updatedVoter } : item))
    );
  };

  const handleSelectVoter = async (voter) => {
    lastSelectionRef.current = { voter };
    try {
      const loc = await requestLocation();
      setSelectedVoter({ ...voter, ...loc });
      setErrorText('');
    } catch (error) {
      setErrorText(error?.message || error?.detail || 'Location permission is required.');
    }
  };
  const retryLocation = async () => {
    if (!lastSelectionRef.current?.voter) return;
    try {
      const loc = await requestLocation();
      setSelectedVoter({ ...lastSelectionRef.current.voter, ...loc });
      setErrorText('');
    } catch (error) {
      setErrorText(error?.message || error?.detail || 'Location permission is required.');
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

function SearchBoothScreen() {
  const assemblyCode = getAssemblyCode();
  const [search, setSearch] = useState('');
  const [assemblyData, setAssemblyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [visibleBooths, setVisibleBooths] = useState(PAGE_SIZE);
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [selectedBoothPayload, setSelectedBoothPayload] = useState(null);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [boothLoading, setBoothLoading] = useState(false);
  const [boothError, setBoothError] = useState('');
  const lastSelectionRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError('');
      if (!assemblyCode) {
        setLoadError('No assembly code is configured for this user/environment.');
        setLoading(false);
        return;
      }
      try {
        const response = await mobileApi.loadDataLite(assemblyCode);
        const snapshot = await resolveSnapshot(response);
        setAssemblyData(snapshot);
        localStorage.setItem(BOOTH_CACHE_KEY, JSON.stringify(snapshot));
      } catch (error) {
        const fallback = localStorage.getItem(BOOTH_CACHE_KEY);
        if (fallback) {
          setAssemblyData(JSON.parse(fallback));
          setLoadError('Showing cached booth data.');
        } else {
          setLoadError(error?.message || 'Unable to load booths');
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [assemblyCode]);

  const booths = useMemo(() => {
    const wards = assemblyData?.assembly?.wards || [];
    return wards.flatMap((ward) =>
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
    ).sort((a, b) => {
      const aNum = Number.parseInt(String(a.boothNo ?? '').replace(/[^\d]/g, ''), 10);
      const bNum = Number.parseInt(String(b.boothNo ?? '').replace(/[^\d]/g, ''), 10);
      const aVal = Number.isFinite(aNum) ? aNum : Number.POSITIVE_INFINITY;
      const bVal = Number.isFinite(bNum) ? bNum : Number.POSITIVE_INFINITY;
      return aVal - bVal;
    });
  }, [assemblyData]);

  const filteredBooths = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return booths;
    return booths.filter((item) =>
      `${item.boothNo ?? ''} ${item.boothId ?? ''} ${item.boothNameEn} ${item.wardNameEn || ''}`.toLowerCase().includes(q)
    );
  }, [booths, search]);

  useEffect(() => {
    setVisibleBooths(PAGE_SIZE);
  }, [search]);

  const visibleBoothCards = filteredBooths.slice(0, visibleBooths);
  const boothSentinelRef = useInfiniteTrigger(
    visibleBoothCards.length < filteredBooths.length,
    () => setVisibleBooths((current) => Math.min(current + PAGE_SIZE, filteredBooths.length))
  );

  const openBooth = async (booth) => {
    setBoothLoading(true);
    setBoothError('');
    setSelectedBooth(booth);
    try {
      const response = await mobileApi.fetchBoothVoters(booth.boothId);
      setSelectedBoothPayload(response?.data?.result || { ...booth, voters: [] });
    } catch (error) {
      setSelectedBoothPayload({ ...booth, voters: booth.voters || [] });
      setBoothError(error?.message || 'Unable to fetch booth voters. Showing cached data.');
    } finally {
      setBoothLoading(false);
    }
  };

  const handleSaveVoter = (updatedVoter) => {
    setSelectedVoter(updatedVoter);
    setSelectedBoothPayload((current) => ({
      ...(current || {}),
      voters: (current?.voters || []).map((item) =>
        item.voterId === updatedVoter.voterId ? { ...item, ...updatedVoter } : item
      ),
    }));
  };

  const handleSelectBoothVoter = async (voter) => {
    lastSelectionRef.current = { voter };
    try {
      const loc = await requestLocation();
      setSelectedVoter({ ...voter, ...loc });
      setBoothError('');
    } catch (error) {
      setBoothError(error?.message || error?.detail || 'Location permission is required.');
    }
  };
  const retryLocation = async () => {
    if (!lastSelectionRef.current?.voter) return;
    try {
      const loc = await requestLocation();
      setSelectedVoter({ ...lastSelectionRef.current.voter, ...loc });
      setBoothError('');
    } catch (error) {
      setBoothError(error?.message || error?.detail || 'Location permission is required.');
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
        <div className="mobile-web-search-input-wrap">
          <SearchRounded className="mobile-web-search-icon" />
          <input className="mobile-web-input" placeholder="Search booth name or booth number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </section>
      <section className="mobile-web-booth-grid">
        {loading ? <div className="mobile-web-empty">Loading booths...</div> : null}
        {!loading && loadError ? <div className="mobile-web-error light">{loadError}</div> : null}
        {!loading &&
          visibleBoothCards.map((booth) => {
            const stats = boothStats(booth);
            return (
              <button key={String(booth.boothId)} className="mobile-web-booth-card mobile-web-booth-button" onClick={() => openBooth(booth)} type="button">
                <h3>{booth.boothNo ?? booth.boothId} - {booth.boothNameEn}</h3>
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
function getUserInfoSafe() { if (typeof window === 'undefined') return {}; try { return JSON.parse(localStorage.getItem('userInfo') || '{}'); } catch { return {}; } }
function AddVolunteerScreen() {
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
  // pendingEditRef holds ward/booth IDs to apply after dropdowns are loaded
  const pendingEditRef = useRef(null);
  const prevWorkingLevelRef = useRef(null);
  const prevAssemblyRef = useRef(null);
  const userInfo = useMemo(() => getUserInfoSafe(), []);
  const role = userInfo?.role || 'ADMIN';

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

  const handleChange = (key, value) => {
    const nextValue = key === 'phone' ? String(value || '').replace(/\D/g, '').slice(0, 10) : value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  };
  const handleReset = (preserveFeedback = false) => {
    setForm({ firstName: '', phone: '', workingLevel: 'ASSEMBLY', assemblyId: '', wardIds: [], boothIds: [] });
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
      const formatted = (res || []).map((item) => ({
        value: item.id,
        label: item.name || `Assembly ${item.id}`,
      }));
      setAssemblies(formatted);
    }).catch(() => setAssemblies([]));
    return () => { active = false; };
  }, []);

  // When workingLevel changes by user (not from edit), reset selections
  useEffect(() => {
    if (pendingEditRef.current) return; // skip reset during edit prefill
    if (prevWorkingLevelRef.current !== null && prevWorkingLevelRef.current !== form.workingLevel) {
      setForm((prev) => ({ ...prev, assemblyId: '', wardIds: [], boothIds: [] }));
      setWards([]);
      setBooths([]);
      prevAssemblyRef.current = null;
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
      const formatted = (res || []).map((item) => ({ value: item.wardId, label: item.wardNameEn || `Ward ${item.wardId}` }));
      setWards(formatted);
      // Apply pending edit ward/booth selection after wards are loaded
      if (pendingEditRef.current) {
        const pending = pendingEditRef.current;
        const pendingWardIds = pending.wardIds || [];
        setForm((prev) => ({ ...prev, wardIds: pendingWardIds, boothIds: [] }));
        if (pendingWardIds.length) {
          Promise.all(pendingWardIds.map((wardId) => mobileApi.fetchBooths(null, wardId).catch(() => []))).then((responses) => {
            const merged = responses.flat().map((item) => ({ value: item.boothId, label: item.pollingStationAdrEn || `Booth ${item.boothId}` }));
            const unique = Array.from(new Map(merged.map((item) => [String(item.value), item])).values());
            setBooths(unique);
            setForm((prev) => ({ ...prev, boothIds: pending.boothIds || [] }));
            pendingEditRef.current = null; // done prefilling
          }).catch(() => { pendingEditRef.current = null; });
        } else {
          pendingEditRef.current = null;
        }
      } else {
        setForm((prev) => ({ ...prev, wardIds: [], boothIds: [] }));
      }
    }).catch(() => setWards([]));
  }, [form.workingLevel, form.assemblyId]);

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
      const merged = responses.flat().map((item) => ({ value: item.boothId, label: item.pollingStationAdrEn || `Booth ${item.boothId}` }));
      const unique = Array.from(new Map(merged.map((item) => [String(item.value), item])).values());
      setBooths(unique);
    }).catch(() => setBooths([]));
  }, [form.workingLevel, form.wardIds]);

  const handleSubmit = async () => {
    setSaving(true);
    setFeedback({ error: '', success: '' });
    try {
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
      setFeedback({ error: error?.detail || error?.message || 'Unable to add volunteer.', success: '' });
    } finally {
      setSaving(false);
    }
  };

  const levelOptions = [
    { label: 'Assembly', value: 'ASSEMBLY' },
    { label: 'Ward', value: 'WARD' },
    { label: 'Booth', value: 'BOOTH' },
  ];
  const selectedLevelLabel = levelOptions.find((item) => item.value === form.workingLevel)?.label || '';
  const selectedAssemblyLabel = assemblies.find((item) => String(item.value) === String(form.assemblyId))?.label || '';
  const wardOptions = wards.map((item) => item.label);
  const boothOptions = booths.map((item) => item.label);
  const allWardLabels = wards.map((item) => String(item.value));
  const allBoothLabels = booths.map((item) => String(item.value));
  const allWardsSelected = allWardLabels.length > 0 && allWardLabels.every((id) => form.wardIds.includes(id));
  const allBoothsSelected = allBoothLabels.length > 0 && allBoothLabels.every((id) => form.boothIds.includes(id));
  const selectedWardLabels = wards.filter((item) => form.wardIds.includes(String(item.value))).map((item) => item.label);
  const selectedBoothLabels = booths.filter((item) => form.boothIds.includes(String(item.value))).map((item) => item.label);

  return (
    <ScreenFrame accent="blue">
      <section className="mobile-web-card">
        <MobileHeader title="Add Volunteer" subtitle="Create a volunteer and assign a working level." onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        <div className="mobile-web-stack">
          <div className="mobile-web-form-grid">
            <div className="mobile-web-field">
              <label>First Name *</label>
              <input className="mobile-web-input" placeholder="First Name" value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Phone * </label>
              <input className="mobile-web-input" placeholder="Phone" value={form.phone} maxLength={10} inputMode="numeric" onChange={(e) => handleChange('phone', e.target.value)} disabled={isEditing} />
            </div>
            <div className="mobile-web-field">
              <label>Working Level *</label>
              <SingleOptionSelect label="Working Level" options={levelOptions.map((item) => item.label)} value={selectedLevelLabel} customValue="" onSelect={(option) => handleChange('workingLevel', levelOptions.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => { }} />
            </div>
            {form.workingLevel === 'ASSEMBLY' ? (
              <>
                <div className="mobile-web-field">
                  <label>Assembly</label>
                  <SingleOptionSelect label="Assembly" options={assemblies.map((item) => item.label)} value={selectedAssemblyLabel} customValue="" onSelect={(option) => handleChange('assemblyId', assemblies.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => { }} />
                </div>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <MultiCheckboxSelect label="Ward" options={['All Wards', ...wardOptions]} value={allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels} customValue="" onToggle={(option) => { if (option === 'All Wards') { const nextIds = allWardsSelected ? [] : allWardLabels; handleChange('wardIds', nextIds); return; } const wardValue = String(wards.find((item) => item.label === option)?.value || ''); const nextIds = selectedWardLabels.includes(option) ? form.wardIds.filter((id) => String(id) !== wardValue) : form.wardIds.concat(wardValue); handleChange('wardIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => { }} disabled={!form.assemblyId} />
                  {!form.assemblyId ? <p className="mobile-web-helper">Select an assembly to load wards.</p> : null}
                </div>
                <div className="mobile-web-field">
                  <label>Booth</label>
                  <MultiCheckboxSelect label="Booth" options={['All Booths', ...boothOptions]} value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels} customValue="" onToggle={(option) => { if (option === 'All Booths') { const nextIds = allBoothsSelected ? [] : allBoothLabels; handleChange('boothIds', nextIds); return; } const boothValue = String(booths.find((item) => item.label === option)?.value || ''); const nextIds = selectedBoothLabels.includes(option) ? form.boothIds.filter((id) => String(id) !== boothValue) : form.boothIds.concat(boothValue); handleChange('boothIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => { }} disabled={!form.wardIds.length} />
                  {!form.wardIds.length ? <p className="mobile-web-helper">Select a ward to load booths.</p> : null}
                </div>
              </>
            ) : null}
            {form.workingLevel === 'WARD' ? (
              <>
                <div className="mobile-web-field">
                  <label>Assembly</label>
                  <SingleOptionSelect label="Assembly" options={assemblies.map((item) => item.label)} value={selectedAssemblyLabel} customValue="" onSelect={(option) => handleChange('assemblyId', assemblies.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => { }} />
                </div>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <MultiCheckboxSelect label="Ward" options={['All Wards', ...wardOptions]} value={allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels} customValue="" onToggle={(option) => { if (option === 'All Wards') { const nextIds = allWardsSelected ? [] : allWardLabels; handleChange('wardIds', nextIds); return; } const wardValue = String(wards.find((item) => item.label === option)?.value || ''); const nextIds = selectedWardLabels.includes(option) ? form.wardIds.filter((id) => String(id) !== wardValue) : form.wardIds.concat(wardValue); handleChange('wardIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => { }} disabled={!form.assemblyId} />
                  {!form.assemblyId ? <p className="mobile-web-helper">Select an assembly to load wards.</p> : null}
                </div>
                <div className="mobile-web-field">
                  <label>Booth</label>
                  <MultiCheckboxSelect label="Booth" options={['All Booths', ...boothOptions]} value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels} customValue="" onToggle={(option) => { if (option === 'All Booths') { const nextIds = allBoothsSelected ? [] : allBoothLabels; handleChange('boothIds', nextIds); return; } const boothValue = String(booths.find((item) => item.label === option)?.value || ''); const nextIds = selectedBoothLabels.includes(option) ? form.boothIds.filter((id) => String(id) !== boothValue) : form.boothIds.concat(boothValue); handleChange('boothIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => { }} disabled={!form.wardIds.length} />
                  {!form.wardIds.length ? <p className="mobile-web-helper">Select a ward to load booths.</p> : null}
                </div>
              </>
            ) : null}
            {form.workingLevel === 'BOOTH' ? (
              <>
                <div className="mobile-web-field">
                  <label>Assembly</label>
                  <SingleOptionSelect label="Assembly" options={assemblies.map((item) => item.label)} value={selectedAssemblyLabel} customValue="" onSelect={(option) => handleChange('assemblyId', assemblies.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => { }} />
                </div>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <MultiCheckboxSelect label="Ward" options={['All Wards', ...wardOptions]} value={allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels} customValue="" onToggle={(option) => { if (option === 'All Wards') { const nextIds = allWardsSelected ? [] : allWardLabels; handleChange('wardIds', nextIds); return; } const wardValue = String(wards.find((item) => item.label === option)?.value || ''); const nextIds = selectedWardLabels.includes(option) ? form.wardIds.filter((id) => String(id) !== wardValue) : form.wardIds.concat(wardValue); handleChange('wardIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => { }} disabled={!form.assemblyId} />
                  {!form.assemblyId ? <p className="mobile-web-helper">Select an assembly to load wards.</p> : null}
                </div>
                <div className="mobile-web-field">
                  <label>Booth</label>
                  <MultiCheckboxSelect label="Booth" options={['All Booths', ...boothOptions]} value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels} customValue="" onToggle={(option) => { if (option === 'All Booths') { const nextIds = allBoothsSelected ? [] : allBoothLabels; handleChange('boothIds', nextIds); return; } const boothValue = String(booths.find((item) => item.label === option)?.value || ''); const nextIds = selectedBoothLabels.includes(option) ? form.boothIds.filter((id) => String(id) !== boothValue) : form.boothIds.concat(boothValue); handleChange('boothIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => { }} disabled={!form.wardIds.length} />
                  {!form.wardIds.length ? <p className="mobile-web-helper">Select a ward to load booths.</p> : null}
                </div>
              </>
            ) : null}
          </div>
          <div className="mobile-web-actions">
            <button className="mobile-web-secondary-btn" type="button" onClick={handleReset}>Reset</button>
            <button className="mobile-web-primary-btn" type="button" onClick={handleSubmit} disabled={saving}>{saving ? (isEditing ? 'Updating...' : 'Submitting...') : (isEditing ? 'Update' : 'Submit')}</button>
          </div>
          {feedback.error ? <div className="mobile-web-error">{feedback.error}</div> : null}
          {feedback.success ? <div className="mobile-web-success">{feedback.success}</div> : null}
        </div>
      </section>
    </ScreenFrame>
  );
}
function MyVolunteersScreen() {
  const [volunteers, setVolunteers] = useState([]);
  const [search, setSearch] = useState('');
  const [workingLevel, setWorkingLevel] = useState('');
  const [sortMode, setSortMode] = useState('latest');
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [wardLookup, setWardLookup] = useState({});
  const [boothLookup, setBoothLookup] = useState({});
  const userInfo = useMemo(() => getUserInfoSafe(), []);
  const role = userInfo?.role || 'ADMIN';

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
      if (typeof window === 'undefined') return;
      try {
        const wardsRes = await mobileApi.fetchWards();
        const wards = Array.isArray(wardsRes)
          ? wardsRes
          : Array.isArray(wardsRes?.data?.result)
            ? wardsRes.data.result
            : Array.isArray(wardsRes?.data)
              ? wardsRes.data
              : Array.isArray(wardsRes?.result)
                ? wardsRes.result
                : [];
        buildLookupsFromWards(wards);

        const wardIds = wards
          .map((ward) => ward?.wardId ?? ward?.ward_id ?? ward?.id)
          .filter((id) => id !== undefined && id !== null);
        if (!wardIds.length) return;
        const boothResponses = await Promise.all(
          wardIds.map((wardId) => mobileApi.fetchBooths(null, wardId).catch(() => []))
        );
        const publicBoothResponses = await Promise.all(
          wardIds.map((wardId) => mobileApi.fetchPublicBooths(wardId).catch(() => []))
        );
        const boothMap = {};
        boothResponses.flat().forEach((booth) => {
          const boothId = String(booth?.boothId ?? booth?.booth_id ?? booth?.id ?? '');
          const boothNo = booth?.boothNo ?? booth?.booth_no ?? booth?.boothNumber;
          const boothLabel = booth?.boothNameEn ?? booth?.booth_name_en ?? booth?.pollingStationAdrEn ?? booth?.polling_station_adr_en
            ?? (boothNo ? `Booth ${boothNo}` : boothId);
          if (boothId) boothMap[boothId] = boothLabel;
          if (boothNo !== undefined && boothNo !== null) boothMap[String(boothNo)] = boothLabel;
        });
        publicBoothResponses.flat().forEach((booth) => {
          const boothNo = booth?.boothNo ?? booth?.booth_no ?? booth?.id;
          const boothLabel = booth?.boothNameEn ?? booth?.booth_name_en ?? booth?.pollingStationAdrEn ?? booth?.polling_station_adr_en
            ?? (boothNo ? `Booth ${boothNo}` : '');
          if (boothNo !== undefined && boothNo !== null && boothLabel) {
            boothMap[String(boothNo)] = boothLabel;
          }
        });
        if (!active) return;
        setBoothLookup(boothMap);
      } catch { }
    };

    loadLookups();
    return () => {
      active = false;
    };
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
        showDeleted ? 'true' : 'false'
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
  }, [search, workingLevel, sortMode, showDeleted]);

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

  const levelOptions = [
    { label: 'All Levels', value: '' },
    { label: 'Assembly', value: 'ASSEMBLY' },
    { label: 'Ward', value: 'WARD' },
    { label: 'Booth', value: 'BOOTH' },
  ];
  const selectedLevelLabel = levelOptions.find((item) => item.value === workingLevel)?.label || '';
  const sortOptions = [
    { label: 'Latest Created', value: 'latest' },
    { label: 'Oldest Created', value: 'oldest' },
    { label: 'Name A-Z', value: 'name-asc' },
    { label: 'Name Z-A', value: 'name-desc' },
  ];
  const selectedSortLabel = sortOptions.find((item) => item.value === sortMode)?.label || '';

  const stats = volunteers.reduce(
    (acc, v) => {
      const deleted = v.deleted === true || v.deleted === 'true' || v.deleted === 1;
      const blocked = v.blocked === true || v.blocked === 'true' || v.blocked === 1;
      if (deleted) {
        acc.deleted += 1;
      } else {
        if (blocked) acc.blocked += 1;
        else acc.active += 1;
        acc.total += 1; // Total only counts non-deleted
      }
      return acc;
    },
    { total: 0, active: 0, blocked: 0, deleted: 0 }
  );
  const visibleVolunteers = showDeleted
    ? volunteers.filter((v) => v.deleted === true || v.deleted === 'true' || v.deleted === 1)
    : volunteers.filter((v) => !(v.deleted === true || v.deleted === 'true' || v.deleted === 1));

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
        <MobileHeader title="Manage Volunteers" subtitle="Search and manage volunteer profiles." onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
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
              <button
                type="button"
                className={`mobile-web-volunteer-pill deleted${showDeleted ? ' active-pill' : ''}`}
                onClick={() => setShowDeleted((current) => !current)}
                title={showDeleted ? 'Click to hide deleted volunteers' : 'Click to show deleted volunteers'}
                style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
              >
                Deleted <strong>{stats.deleted}</strong>
              </button>
            </div>
          </div>

          {loading ? <div className="mobile-web-empty">Loading volunteers...</div> : null}
          {!loading && visibleVolunteers.length === 0 ? <div className="mobile-web-empty">No volunteers found.</div> : null}
          {!loading && visibleVolunteers.length > 0 ? (
            <div className="mobile-web-stack">
              {visibleVolunteers.map((v) => {
                const deleted = v.deleted === true || v.deleted === 'true' || v.deleted === 1;
                const blocked = v.blocked === true || v.blocked === 'true' || v.blocked === 1;
                const name = `${v.firstName || ''} ${v.lastName || ''}`.trim() || v.userName || 'Volunteer';
                const levelLabel = (v.assignmentType || '-').toUpperCase();
                const statusLabel = deleted ? 'Deleted' : blocked ? 'Blocked' : 'Active';
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
                  <div key={v.userName || v.phone || name} className="mobile-web-volunteer-card" style={{ opacity: blocked || deleted ? 0.5 : 1 }}>
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
                        <button
                          type="button"
                          onClick={() => handleEdit(v)}
                          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                        >
                          Edit
                        </button>
                        {/* <button className="mobile-web-secondary-btn" type="button" onClick={() => handleDelete(v.userName, !deleted)} disabled={actionLoading[`delete-${v.userName}`]}>
                          {actionLoading[`delete-${v.userName}`] ? <span className="mobile-web-spinner" /> : null}
                          {deleted ? 'Undelete' : 'Delete'}
                        </button> */}
                        <button
                          type="button"
                          onClick={() => handleDelete(v.userName, !deleted)}
                          disabled={actionLoading[`delete-${v.userName}`]}
                          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition
                              ${deleted
                              ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                              : "bg-gray-600 hover:bg-gray-700 active:bg-gray-800"}
                              disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {actionLoading[`delete-${v.userName}`] && (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                          )}
                          {deleted ? (showDeleted ? "Restore" : "Delete") : "Delete"}
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

function VotersFamilyScreen() {
  const [familyName, setFamilyName] = useState('');
  const [familyAddress, setFamilyAddress] = useState('');
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
  const [showBuildingTag, setShowBuildingTag] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [hasAssociation, setHasAssociation] = useState(false);
  const [associationName, setAssociationName] = useState('');
  const [associationHeadName, setAssociationHeadName] = useState('');
  const [associationHeadPhone, setAssociationHeadPhone] = useState('');
  const [buildingSuggestions, setBuildingSuggestions] = useState([]);
  const [associationSuggestions, setAssociationSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [location, setLocation] = useState(null);
  const searchTimerRef = useRef(null);

  const loadSuggestions = async () => {
    try {
      const [bRes, aRes] = await Promise.all([
        mobileApi.fetchFamilySuggestions('building').catch(() => ({ data: { result: [] } })),
        mobileApi.fetchFamilySuggestions('association').catch(() => ({ data: { result: [] } })),
      ]);
      setBuildingSuggestions(bRes?.data?.result || []);
      setAssociationSuggestions(aRes?.data?.result || []);
    } catch {
      setBuildingSuggestions([]);
      setAssociationSuggestions([]);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const addMember = () => {
    if (memberSuggestions.length === 1) {
      handleAddSuggestion(memberSuggestions[0]);
    }
  };

  const handleAddSuggestion = (suggestion) => {
    if (!suggestion) return;
    const name = [suggestion.firstMiddleNameEn, suggestion.lastNameEn].filter(Boolean).join(' ').trim();
    const newMember = {
      id: suggestion.epicNo || `${name}-${Date.now()}`,
      name: name || suggestion.epicNo || 'Unknown',
      epic: suggestion.epicNo || '',
      phone: suggestion.mobile || '',
      houseNo: suggestion.houseNoEn || suggestion.houseNoLocal || '',
      boothId: suggestion.boothInfo?.boothId || suggestion.boothId || suggestion.booth_id || '',
    };
    setMembers((current) => {
      if (current.some((m) => m.epic && m.epic === newMember.epic)) {
        return current;
      }
      return current.concat(newMember);
    });
    setMemberQuery('');
    setRelationQuery('');
    setMemberSuggestions([]);
    setShowSuggestions(false);
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
        const res = await mobileApi.searchVoters({
          searchQuery: query,
          relationName: relationQuery.trim() || undefined,
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
  }, [memberQuery, relationQuery]);

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
      if (!familyName.trim()) throw new Error('Family name is required');
      if (members.length === 0) throw new Error('At least one family member is required');
      if (!headOfFamily) throw new Error('Please pick a head of family');

      const headMember = members.find((m) => m.id === headOfFamily);
      if (!headMember || !headMember.epic) throw new Error('Invalid head of family selected');

      const boothIdMember = members.find((m) => m.boothId);
      if (!boothIdMember) throw new Error('Member booth information missing. Please add members again.');

      const payload = {
        familyName,
        familyAddress,
        buildingName: showBuildingTag ? buildingName : null,
        buildingAddress: showBuildingTag ? buildingAddress : null,
        hasAssociation: showBuildingTag ? hasAssociation : false,
        associationName: (showBuildingTag && hasAssociation) ? associationName : null,
        associationHeadName: (showBuildingTag && hasAssociation) ? associationHeadName : null,
        associationHeadPhone: (showBuildingTag && hasAssociation) ? associationHeadPhone : null,
        phone: headPhone || headMember.phone,
        points: parseInt(familyPoints) || 0,
        pointsProvided: 0,
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
        boothId: parseInt(boothIdMember.boothId),
        headEpicNo: headMember.epic,
        memberEpicNos: members.map((m) => m.epic).filter(Boolean),
        economicStatus,
        familyNature,
      };

      await mobileApi.createFamily(payload);
      setSuccess('Family saved successfully!');
      
      // Refresh suggestions for the next entry
      loadSuggestions();

      // Reset form if success
      setTimeout(() => {
        setFamilyName('');
        setFamilyAddress('');
        setMembers([]);
        setHeadOfFamily('');
        setHeadPhone('');
        setBuildingName('');
        setBuildingAddress('');
        setAssociationName('');
        setAssociationHeadName('');
        setAssociationHeadPhone('');
        setShowBuildingTag(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err?.message || 'Failed to save family');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-family-shell">
        <MobileHeader title="New Family" onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        <div className="mobile-web-family-grid">
          <label className="mobile-web-field">
            <span>Enter family name</span>
            <input className="mobile-web-input" placeholder="Family name" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
          </label>
          <label className="mobile-web-field">
            <span>Family Address</span>
            <input className="mobile-web-input" placeholder="Family Address" value={familyAddress} onChange={(e) => setFamilyAddress(e.target.value)} />
          </label>
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
                                {item.epicNo || '-'} · {item.houseNoEn || item.houseNoLocal || 'House -'} · {item.mobile || 'No phone'}
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
              <span>Phone</span>
              <span>House No</span>
              <span>Actions</span>
            </div>
            {members.length === 0 ? (
              <div className="mobile-web-table-empty">No family members yet</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="mobile-web-table-row">
                  <span>{member.name}</span>
                  <span>{member.epic}</span>
                  <span>{member.phone}</span>
                  <span>{member.houseNo}</span>
                  <span className="mobile-web-row-actions">
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
            <select className="mobile-web-input" value={economicStatus} onChange={(e) => setEconomicStatus(e.target.value)}>
              {['NA', 'Low', 'Medium', 'High'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="mobile-web-field">
            <span>Head of Family</span>
            <select className="mobile-web-input" value={headOfFamily} onChange={(e) => setHeadOfFamily(e.target.value)}>
              <option value="">Pick head of family</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="mobile-web-field">
            <span>Family Head Phone Number (10 digits)</span>
            <input
              className="mobile-web-input"
              placeholder="Phone number"
              value={headPhone}
              onChange={(e) => setHeadPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
            />
          </label>
          <label className="mobile-web-field">
            <span>Family Nature</span>
            <select className="mobile-web-input" value={familyNature} onChange={(e) => setFamilyNature(e.target.value)}>
              {['NA', 'Supporter', 'Neutral', 'Opposition'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="mobile-web-field">
            <span>Points to the family</span>
            <select className="mobile-web-input" value={familyPoints} onChange={(e) => setFamilyPoints(e.target.value)}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="mobile-web-primary-btn mobile-web-tag-btn"
          onClick={() => setShowBuildingTag((prev) => !prev)}
        >
          Tag Building/ Apartment
        </button>
        {showBuildingTag ? (
          <div className="mobile-web-family-grid mobile-web-tag-grid">
            <label className="mobile-web-field">
              <span>Building/ Apartment Name</span>
              <input
                className="mobile-web-input"
                placeholder="Name"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                list="building-suggestions"
              />
              <datalist id="building-suggestions">
                {buildingSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="mobile-web-field">
              <span>Address</span>
              <input
                className="mobile-web-input"
                placeholder="Building Address"
                value={buildingAddress}
                onChange={(e) => setBuildingAddress(e.target.value)}
              />
            </label>
            
            <div className="mobile-web-field-inline" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="has-association-check"
                className="mobile-web-checkbox-large"
                checked={hasAssociation}
                onChange={(e) => setHasAssociation(e.target.checked)}
              />
              <label htmlFor="has-association-check" style={{ marginBottom: 0, fontWeight: 500 }}>If have association</label>
            </div>

            {hasAssociation && (
              <div className="mobile-web-association-details" style={{ gridColumn: '1 / -1' }}>
                <label className="mobile-web-field">
                  <span>Association Name</span>
                  <input
                    className="mobile-web-input"
                    placeholder="Association Name"
                    value={associationName}
                    onChange={(e) => setAssociationName(e.target.value)}
                    list="association-suggestions"
                  />
                  <datalist id="association-suggestions">
                    {associationSuggestions.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>
                <label className="mobile-web-field">
                  <span>Association Head Name</span>
                  <input
                    className="mobile-web-input"
                    placeholder="Association Head Name"
                    value={associationHeadName}
                    onChange={(e) => setAssociationHeadName(e.target.value)}
                  />
                </label>
                <label className="mobile-web-field">
                  <span>Association Head Phone number (10 digits)</span>
                  <input
                    className="mobile-web-input"
                    placeholder="Phone number"
                    value={associationHeadPhone}
                    onChange={(e) => setAssociationHeadPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                  />
                </label>
              </div>
            )}
          </div>
        ) : null}
        {success ? <div className="mobile-web-success" style={{ margin: '10px 0' }}>{success}</div> : null}
        {error ? <div className="mobile-web-error" style={{ margin: '10px 0' }}>{error}</div> : null}
        <div className="mobile-web-actions">
          <button className="mobile-web-secondary-btn" type="button">Preview Screen</button>
          <button className="mobile-web-primary-btn" type="button" onClick={handleUpdate} disabled={saving}>
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </section>
    </ScreenFrame>
  );
}

function MeetingsScreen() {
  const [meetings, setMeetings] = useState([
    {
      id: 1,
      title: 'Ward Coordination Meeting',
      dateTime: '11/15/2025, 1:48:42 AM',
      description: 'Discuss booth assignments and outreach',
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 150,
    },
    {
      id: 2,
      title: 'Booth Volunteer Training',
      dateTime: '11/16/2025, 12:48:42 AM',
      description: 'Training for booth volunteers',
      latitude: 12.9352,
      longitude: 77.6245,
      radius: 80,
    },
  ]);
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
    peers: false,
    parliament: false,
    assembly: false,
    ward: false,
    boothPresident: false,
    boothCommittee: false,
    karyakartas: false,
    supporter: false,
  });
  const [newMeetingChannels, setNewMeetingChannels] = useState({ appAlert: true, whatsapp: false });
  const [activeMeetingTab, setActiveMeetingTab] = useState('list');
  const [mapsKey, setMapsKey] = useState('');
  const [mapsKeyInput, setMapsKeyInput] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const newMapRef = useRef(null);
  const newMapInstanceRef = useRef(null);
  const newMarkerRef = useRef(null);
  const newMeetingLocInitRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    const storedKey = localStorage.getItem('gmapsKey') || '';
    const resolved = envKey || storedKey;
    setMapsKey(resolved);
    setMapsKeyInput(resolved);
  }, []);

  const saveMapsKey = () => {
    if (typeof window === 'undefined') return;
    const nextKey = String(mapsKeyInput || '').trim();
    if (!nextKey) {
      localStorage.removeItem('gmapsKey');
      setMapsKey('');
      return;
    }
    localStorage.setItem('gmapsKey', nextKey);
    setMapsKey(nextKey);
  };

  const loadGoogleMaps = () => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Maps not available.'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }
    if (!mapsKey) {
      reject(new Error('Google Maps key not configured.'));
      return;
    }
    const existing = document.querySelector('script[data-google-maps="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps.')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps.'));
    document.body.appendChild(script);
  });

  const syncMap = async (meeting) => {
    if (!mapRef.current) return;
    try {
      const google = await loadGoogleMaps();
      const center = {
        lat: meeting?.latitude ?? 12.9716,
        lng: meeting?.longitude ?? 77.5946,
      };
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          mapTypeId: 'roadmap',
        });
        mapInstanceRef.current.addListener('click', (event) => {
          if (!event?.latLng) return;
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          setSelectedMeeting((prev) => (prev ? { ...prev, latitude: lat, longitude: lng } : prev));
        });
      } else {
        mapInstanceRef.current.setCenter(center);
      }
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      markerRef.current = new google.maps.Marker({
        position: center,
        map: mapInstanceRef.current,
      });
    } catch {
      // ignore map errors here; UI will show key input
    }
  };

  useEffect(() => {
    if (selectedMeeting) syncMap(selectedMeeting);
  }, [selectedMeeting, mapsKey]);

  const syncNewMeetingMap = async () => {
    if (!newMapRef.current) return;
    try {
      const google = await loadGoogleMaps();
      const lat = Number(newMeeting.latitude) || 12.9716;
      const lng = Number(newMeeting.longitude) || 77.5946;
      const center = { lat, lng };
      if (!newMapInstanceRef.current) {
        newMapInstanceRef.current = new google.maps.Map(newMapRef.current, {
          center,
          zoom: 14,
          mapTypeId: 'roadmap',
        });
        newMapInstanceRef.current.addListener('click', (event) => {
          if (!event?.latLng) return;
          const clickLat = event.latLng.lat();
          const clickLng = event.latLng.lng();
          setNewMeeting((prev) => ({ ...prev, latitude: clickLat.toFixed(6), longitude: clickLng.toFixed(6) }));
        });
      } else {
        newMapInstanceRef.current.setCenter(center);
      }
      if (newMarkerRef.current) {
        newMarkerRef.current.setPosition(center);
      } else {
        newMarkerRef.current = new google.maps.Marker({
          position: center,
          map: newMapInstanceRef.current,
          draggable: true,
        });
        newMarkerRef.current.addListener('dragend', (event) => {
          if (!event?.latLng) return;
          const dragLat = event.latLng.lat();
          const dragLng = event.latLng.lng();
          setNewMeeting((prev) => ({ ...prev, latitude: dragLat.toFixed(6), longitude: dragLng.toFixed(6) }));
        });
      }
    } catch {
      // ignore map errors
    }
  };

  useEffect(() => {
    if (!mapsKey) return;
    syncNewMeetingMap();
  }, [mapsKey, newMeeting.latitude, newMeeting.longitude]);

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
        <div className="mobile-web-meetings-header">
          <h2>Meetings</h2>
        </div>
        <div className="mobile-web-subtabs">
          {[
            { key: 'list', label: 'Meetings' },
            { key: 'new', label: 'New Meeting' },
          ].map((tab) => (
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
            {meetings.map((meeting) => (
              <div key={meeting.id} className="mobile-web-meeting-card">
                <div>
                  <h3>{meeting.title}</h3>
                  <p>{meeting.dateTime}</p>
                  <p className="mobile-web-muted">{meeting.description}</p>
                  <p className="mobile-web-muted">Location: {meeting.latitude.toFixed(4)}, {meeting.longitude.toFixed(4)} · Radius: {meeting.radius} m</p>
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
                    ['peers', 'Peers'],
                    ['parliament', 'Parliament'],
                    ['assembly', 'Assembly'],
                    ['ward', 'Ward'],
                    ['boothPresident', 'Booth President'],
                    ['boothCommittee', 'Booth Committee'],
                    ['karyakartas', 'Karyakartas'],
                    ['supporter', 'Supporter'],
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
                    ['appAlert', 'App Alert'],
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
              {!mapsKey ? (
                <div className="mobile-web-map-key">
                  <label>Google Maps API Key</label>
                  <input
                    className="mobile-web-input"
                    placeholder="Paste API key"
                    value={mapsKeyInput}
                    onChange={(e) => setMapsKeyInput(e.target.value)}
                  />
                  <button type="button" className="mobile-web-secondary-btn" onClick={saveMapsKey}>
                    Save Key
                  </button>
                </div>
              ) : null}
              <div className="mobile-web-meeting-map" ref={newMapRef} />
              <div className="mobile-web-meeting-footer">
                <button type="button" className="mobile-web-secondary-btn" onClick={handleUseMyLocation}>
                  Use my location
                </button>
                <button type="button" className="mobile-web-primary-btn">
                  Save Meeting
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="mobile-web-meeting-detail">
          <h3>Open meeting detail (demo)</h3>
          {selectedMeeting ? (
            <div className="mobile-web-meeting-detail-card">
              <h4>{selectedMeeting.title}</h4>
              <p>{selectedMeeting.dateTime}</p>
              <p className="mobile-web-muted">{selectedMeeting.description}</p>
              <p className="mobile-web-muted">
                Location: {selectedMeeting.latitude.toFixed(4)}, {selectedMeeting.longitude.toFixed(4)} · Radius: {selectedMeeting.radius} m
              </p>
              {!mapsKey ? (
                <div className="mobile-web-map-key">
                  <label>Google Maps API Key</label>
                  <input
                    className="mobile-web-input"
                    placeholder="Paste API key"
                    value={mapsKeyInput}
                    onChange={(e) => setMapsKeyInput(e.target.value)}
                  />
                  <button type="button" className="mobile-web-secondary-btn" onClick={saveMapsKey}>
                    Save Key
                  </button>
                </div>
              ) : null}
              <div className="mobile-web-meeting-map" ref={mapRef} />
              <div className="mobile-web-form-grid">
                <div className="mobile-web-field">
                  <label>Radius (m)</label>
                  <input
                    className="mobile-web-input"
                    type="number"
                    value={selectedMeeting.radius}
                    onChange={(e) => setSelectedMeeting((prev) => ({ ...prev, radius: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <button className="mobile-web-primary-btn" type="button">Attended</button>
            </div>
          ) : null}
        </div>
      </section>
    </ScreenFrame>
  );
}

function PollDayScreen() {
  const [tab, setTab] = useState('ALL');
  const [natureFilter, setNatureFilter] = useState('');
  const [pollQuery, setPollQuery] = useState('');
  const [pollRelationQuery, setPollRelationQuery] = useState('');
  const [pollSuggestions, setPollSuggestions] = useState([]);
  const [pollLoading, setPollLoading] = useState(false);
  const [showPollSuggestions, setShowPollSuggestions] = useState(false);
  const [pollVoters, setPollVoters] = useState([]);
  const [pollError, setPollError] = useState('');
  const pollSearchTimerRef = useRef(null);

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
      votedStatus: normalizedStatus || '',
    };
  };

  const fetchPollVoters = async (queryValue = '') => {
    setPollLoading(true);
    setPollError('');
    try {
      const res = await mobileApi.searchVoters({
        searchQuery: queryValue.trim() || undefined,
        relationName: pollRelationQuery.trim() || undefined,
        size: 200,
      });
      const payload = res?.data?.result || res?.result || res?.data || [];
      const list = Array.isArray(payload) ? payload : [];
      setPollVoters(list.map(buildPollDisplay));
      return list;
    } catch (error) {
      setPollError('Unable to load voters. Please try again.');
      setPollVoters([]);
      return [];
    } finally {
      setPollLoading(false);
    }
  };

  useEffect(() => {
    fetchPollVoters('');
  }, []);

  useEffect(() => {
    if (pollSearchTimerRef.current) {
      clearTimeout(pollSearchTimerRef.current);
    }
    const query = pollQuery.trim();
    if (!query) {
      setPollSuggestions([]);
      setShowPollSuggestions(false);
      fetchPollVoters('');
      return undefined;
    }
    setShowPollSuggestions(true);
    setPollLoading(true);
    pollSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await mobileApi.searchVoters({
          searchQuery: query,
          relationName: pollRelationQuery.trim() || undefined,
          size: 20,
        });
        const payload = res?.data?.result || res?.result || res?.data || [];
        const list = Array.isArray(payload) ? payload : [];
        setPollSuggestions(list);
        setPollVoters(list.map(buildPollDisplay));
      } catch (error) {
        setPollSuggestions([]);
      } finally {
        setPollLoading(false);
      }
    }, 400);
    return () => {
      if (pollSearchTimerRef.current) {
        clearTimeout(pollSearchTimerRef.current);
      }
    };
  }, [pollQuery, pollRelationQuery]);

  const handlePollSuggestion = (item) => {
    const display = buildPollDisplay(item);
    setPollQuery(display.name);
    setShowPollSuggestions(false);
    setPollSuggestions([]);
    setPollVoters([display]);
  };

  const filteredPollVoters = useMemo(() => {
    let list = [...pollVoters];
    if (natureFilter) {
      list = list.filter((v) => String(v.natureOfVoter || '').toUpperCase() === natureFilter);
    }
    if (tab === 'VOTED') {
      list = list.filter((v) => String(v.votedStatus).includes('VOTED'));
    } else if (tab === 'NOT VOTED') {
      list = list.filter((v) => String(v.votedStatus).includes('NOT'));
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
        <MobileHeader title="Poll Day — Voters" subtitle="Ward: All · Booth: All" onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
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
              {['ALL', 'VOTED', 'NOT VOTED'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`mobile-web-tab-pill ${tab === item ? 'active' : ''}`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
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
              {filteredPollVoters.map((voter) => {
                const phoneValue = normalizeMobileValue(voter.phone);
                const statusRaw = String(voter.votedStatus || '');
                const isVoted = statusRaw.includes('VOTED') && !statusRaw.includes('NOT');
                const isNotVoted = statusRaw.includes('NOT');
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
                        <button className={`mobile-web-pill ${isVoted ? 'success' : ''}`} type="button">VOTED</button>
                        <button className={`mobile-web-pill ${isNotVoted ? 'danger' : ''}`} type="button">NOT VOTED</button>
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

function ExtractScreen() {
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
        <MobileHeader title="Extract" subtitle="Upload voter list PDFs and export structured Excel sheets." onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
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

function PrintScreen() {
  const [printers, setPrinters] = useState([]);
  const [connectedPrinter, setConnectedPrinter] = useState(null);
  const [scanStatus, setScanStatus] = useState('');
  const [scanError, setScanError] = useState('');

  const addPrinter = (device) => {
    if (!device) return;
    setPrinters((prev) => {
      if (prev.some((p) => p.id === device.id)) return prev;
      return prev.concat([{ id: device.id, name: device.name || 'Thermal Printer', device }]);
    });
  };

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
        filters: [
          { namePrefix: 'Thermal' },
          { namePrefix: 'Printer' },
          { namePrefix: 'BT' },
        ],
        optionalServices: [],
      });
      addPrinter(device);
      setScanStatus('Printer found. Select it to connect.');
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        setScanStatus('No printers selected.');
      } else {
        setScanError(error?.message || 'Unable to scan for printers.');
        setScanStatus('');
      }
    }
  };

  const handleConnect = (printer) => {
    if (!printer) return;
    setConnectedPrinter(printer);
  };

  const handleDisconnect = () => {
    setConnectedPrinter(null);
  };

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-print-shell">
        <MobileHeader title="Printer" onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        <div className="mobile-web-printer-status">
          <div>
            <div className="mobile-web-status-title">{connectedPrinter ? 'Connected' : 'Not Connected'}</div>
            <div className="mobile-web-muted">
              {connectedPrinter ? connectedPrinter.name : 'Search for nearby thermal printers.'}
            </div>
          </div>
          <button className="mobile-web-gradient-btn" type="button" onClick={handleScanPrinters}>
            Search Printers
          </button>
        </div>
        {scanStatus ? <div className="mobile-web-info-pill">{scanStatus}</div> : null}
        {scanError ? <div className="mobile-web-error">{scanError}</div> : null}
        <div className="mobile-web-printer-card">
          <h4>Available Thermal Printers</h4>
          {printers.length === 0 ? (
            <div className="mobile-web-table-empty">No printers found yet.</div>
          ) : (
            printers.map((printer) => (
              <div key={printer.id} className="mobile-web-printer-row">
                <div>
                  <div className="mobile-web-printer-name">{printer.name}</div>
                  <div className="mobile-web-muted">ID: {printer.id}</div>
                </div>
                <button
                  type="button"
                  className="mobile-web-secondary-btn"
                  onClick={() => handleConnect(printer)}
                >
                  {connectedPrinter?.id === printer.id ? 'Connected' : 'Connect'}
                </button>
              </div>
            ))
          )}
        </div>
        <button className="mobile-web-gradient-btn full" type="button" onClick={handleDisconnect}>
          Disconnect
        </button>
        <button className="mobile-web-gradient-btn subtle" type="button" disabled={!connectedPrinter}>
          Print Sample
        </button>
      </section>
    </ScreenFrame>
  );
}

function VolunteerAnalysisScreen() {
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState('name-asc');
  const [viewMode, setViewMode] = useState('agent');
  const [activeTab, setActiveTab] = useState('table');
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
  const [mapsKey, setMapsKey] = useState('');
  const [mapsKeyInput, setMapsKeyInput] = useState('');
  const userInfo = useMemo(() => getUserInfoSafe(), []);
  const [role, setRole] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [wardItems, setWardItems] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkersRef = useRef([]);

  useEffect(() => {
    setRole((userInfo?.role || '').toUpperCase());
    setHydrated(true);
  }, [userInfo]);

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

  const effectiveWard = useMemo(() => {
    if (role === 'WARD' && accessWardIds.length === 1) {
      return accessWardIds[0];
    }
    return selectedWard;
  }, [role, accessWardIds, selectedWard]);

  useEffect(() => {
    let active = true;
    mobileApi.fetchWards().then((res) => {
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
  }, [accessWardIds, selectedWard]);

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
    return {
      agentsWorked: sortedRows.reduce((sum, row) => sum + (Number(row.agentsWorked) || 0), 0),
      boothsCovered: sortedRows.reduce((sum, row) => sum + (Number(row.boothsCovered) || 0), 0),
      votersMet: sortedRows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    };
  }, [sortedRows, viewMode]);

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
    const baseHeaders = fields.map((f) => f.label);
    const getRowTotalUpdates = (row) => fields.reduce((sum, f) => sum + (Number(row.counts?.[f.key]) || 0), 0);

    if (viewMode === 'agent') {
      const headers = ['Agent Name', 'Mobile No', ...baseHeaders, 'Last Updated At'];
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
    const csv = [headers.join(','), ...dataRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'volunteer-analysis.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadXls = () => {
    const { headers, dataRows } = buildExportRows();
    const tableRows = [headers, ...dataRows]
      .map((r) => `<tr>${r.map((v) => `<td>${String(v)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<table>${tableRows}</table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'volunteer-analysis.xls';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const fetchAllDetailsForExport = async () => {
    try {
      const res = await mobileApi.fetchVolunteerEnrichmentDetails(effectiveWard || undefined, undefined, undefined);
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
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];
      while(true) {
        const {done, value} = await reader.read();
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

  const loadDetails = async (wardId) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await mobileApi.fetchVolunteerEnrichmentDetails(wardId, undefined, undefined, 0, 50);
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
      const res = await mobileApi.fetchVolunteerEnrichmentDetails(effectiveWard || undefined, undefined, undefined, detailPage, 50);
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
    const csv = [headers.join(','), ...dataRows.map((r) => r.map((v) => String(v)).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'volunteer-enrichment-details.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadDetailXls = async () => {
    const fullData = await fetchAllDetailsForExport();
    const { headers, dataRows } = buildDetailExport(fullData);
    if (!headers.length) return;
    const tableRows = [headers, ...dataRows]
      .map((r) => `<tr>${r.map((v) => `<td>${String(v)}</td>`).join('')}</tr>`)
      .join('');
    const html = `<table>${tableRows}</table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'volunteer-enrichment-details.xls';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const loadAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mobileApi.fetchVolunteerAnalysis(effectiveWard || undefined, viewMode);
      const payload = res?.data?.result || res?.result || {};
      setRows(payload?.rows || []);
      setFields(payload?.fields || []);
    } catch (err) {
      setError(err?.message || 'Unable to load volunteer analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'BOOTH') loadAnalysis();
  }, [role, effectiveWard, viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    const storedKey = localStorage.getItem('gmapsKey') || '';
    const resolved = envKey || storedKey;
    setMapsKey(resolved);
    setMapsKeyInput(resolved);
  }, []);

  const saveMapsKey = () => {
    if (typeof window === 'undefined') return;
    const nextKey = String(mapsKeyInput || '').trim();
    if (!nextKey) {
      localStorage.removeItem('gmapsKey');
      setMapsKey('');
      setMapError('Google Maps key not configured.');
      return;
    }
    localStorage.setItem('gmapsKey', nextKey);
    setMapsKey(nextKey);
    setMapError('');
  };

  const loadGoogleMaps = () => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Maps are not available on the server.'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }
    if (!mapsKey) {
      reject(new Error('Google Maps key not configured.'));
      return;
    }
    const existing = document.querySelector('script[data-google-maps="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps.')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Maps.'));
    document.body.appendChild(script);
  });

  const buildMap = async (points) => {
    if (!mapRef.current) return;
    try {
      const google = await loadGoogleMaps();
      const validPoints = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
      const center = validPoints.length
        ? { lat: validPoints[0].latitude, lng: validPoints[0].longitude }
        : { lat: 12.9716, lng: 77.5946 };
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: validPoints.length ? 13 : 11,
          mapTypeId: 'roadmap',
        });
      } else {
        mapInstanceRef.current.setCenter(center);
      }
      mapMarkersRef.current.forEach((marker) => marker.setMap(null));
      mapMarkersRef.current = [];
      const bounds = new google.maps.LatLngBounds();
      validPoints.forEach((point) => {
        const gender = String(point.gender || '').toUpperCase();
        const color = gender.startsWith('M') ? '#2563eb' : gender.startsWith('F') ? '#db2777' : '#64748b';
        const marker = new google.maps.Marker({
          position: { lat: point.latitude, lng: point.longitude },
          map: mapInstanceRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: color,
            fillOpacity: 0.85,
            strokeColor: '#ffffff',
            strokeWeight: 1,
          },
        });
        mapMarkersRef.current.push(marker);
        bounds.extend(marker.getPosition());
      });
      if (validPoints.length >= 2) {
        mapInstanceRef.current.fitBounds(bounds, 36);
      } else if (validPoints.length === 1) {
        mapInstanceRef.current.setZoom(15);
      }
    } catch (err) {
      setMapError(err?.message || 'Unable to load map.');
    }
  };

  const loadMapPoints = async () => {
    setMapLoading(true);
    setMapError('');
    try {
      if (!mapsKey) {
        setMapError('Google Maps key not configured.');
        setMapPoints([]);
        return;
      }
      const res = await mobileApi.fetchVolunteerLocationPoints(effectiveWard || undefined);
      const payload = res?.data?.result || res?.result || [];
      const points = Array.isArray(payload) ? payload : [];
      const normalized = points
        .map((item) => ({
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          gender: item.gender || item.sex || '',
        }))
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      setMapPoints(normalized);
      await buildMap(normalized);
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
  }, [activeTab, effectiveWard]);

  const detailColumns = useMemo(() => {
    if (!detailRows.length) return [];
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
    const keys = Object.keys(detailRows[0] || {}).filter((key) => !excluded.has(key));
    const preferredOrder = ['serialNumber', 'wardName', 'name', 'epicNo', 'boothNo', 'voterSerialNo', 'lastUpdatedAt'];
    const ordered = preferredOrder.filter((key) => keys.includes(key));
    keys.forEach((key) => {
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
    const headers = detailColumns;
    const sortedExportRows = getSortedRows(exportRows).map((row, index) => ({
      ...row,
      serialNumber: index + 1
    }));
    const dataRows = sortedExportRows.map((row) => headers.map((key) => {
      if (key === 'lastUpdatedAt') return formatDateTime(row?.[key]);
      if (key === 'name' && !row?.[key]) {
        const fallback = [row?.firstMiddleNameEn, row?.lastNameEn].filter(Boolean).join(' ').trim();
        return fallback || '';
      }
      return row?.[key] ?? '';
    }));
    return { headers, dataRows };
  };

  if (role === 'BOOTH') {
    return (
      <ScreenFrame accent="light">
        <section className="mobile-web-card mobile-web-volunteer-shell">
          <MobileHeader title="Volunteer Analysis" subtitle="Access restricted for booth users." onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
          <div className="mobile-web-empty">This section is available for Assembly and Ward roles only.</div>
        </section>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-volunteer-shell">
        <MobileHeader title="Volunteer Analysis" subtitle="Data collection coverage by volunteer." onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        {hydrated && role === 'WARD' ? <div className="mobile-web-info-pill">Showing data for your ward access.</div> : null}
        <div className="mobile-web-form-grid" style={{ marginBottom: '12px' }}>
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
              <button type="button" className="mobile-web-primary-btn" onClick={loadAnalysis} disabled={loading}>
                {loading ? 'Refreshing...' : 'Get Latest Data'}
              </button>
              <button type="button" className="mobile-web-secondary-btn" onClick={downloadCsv} disabled={!rows.length}>
                Download CSV
              </button>
              <button type="button" className="mobile-web-secondary-btn" onClick={downloadXls} disabled={!rows.length}>
                Download Excel
              </button>
            </>
          ) : (
            <button type="button" className="mobile-web-primary-btn" onClick={loadMapPoints} disabled={mapLoading}>
              {mapLoading ? 'Loading Map...' : 'Refresh Map'}
            </button>
          )}
        </div>
        {activeTab === 'table' ? (
          <>
            {error ? <div className="mobile-web-error">{error}</div> : null}
            {loading ? <div className="mobile-web-empty">Loading analysis...</div> : null}
            {!loading && sortedRows.length === 0 ? <div className="mobile-web-empty">No analysis data found.</div> : null}
            {!loading && sortedRows.length > 0 ? (
              <div className="mobile-web-analysis-table-wrap">
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
                    <span>Total Voters Met: <strong>{summaryTotals.votersMet}</strong></span>
                  </div>
                ) : null}
                <table className="mobile-web-analysis-table">
                  <thead>
                    <tr>
                      {viewMode === 'agent' ? (
                        <>
                          <th>Agent Name</th>
                          <th>Mobile No</th>
                        </>
                      ) : null}
                      {viewMode === 'date' ? (
                        <>
                          <th>Date</th>
                          <th>Agents Worked</th>
                          <th>Booths Covered</th>
                          <th>Voters Met</th>
                        </>
                      ) : null}
                      {viewMode === 'ward' ? (
                        <>
                          <th>Ward</th>
                          <th>Agents</th>
                          <th>Booths</th>
                          <th>Voters Met</th>
                        </>
                      ) : null}
                      {viewMode === 'booth' ? (
                        <>
                          <th>Booth No.</th>
                          <th>Agents</th>
                          <th>Voters Met</th>
                        </>
                      ) : null}
                      {fields.map((field) => (
                        <th key={field.key}>{field.label}</th>
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
                          </>
                        ) : null}
                        {viewMode === 'date' ? (
                          <>
                            <td>{row.label || row.groupKey || '-'}</td>
                            <td>{row.agentsWorked ?? 0}</td>
                            <td>{row.boothsCovered ?? 0}</td>
                            <td>{row.total ?? 0}</td>
                          </>
                        ) : null}
                        {viewMode === 'ward' ? (
                          <>
                            <td>{row.label || row.groupKey || '-'}</td>
                            <td>{row.agentsWorked ?? 0}</td>
                            <td>{row.boothsCovered ?? 0}</td>
                            <td>{row.total ?? 0}</td>
                          </>
                        ) : null}
                        {viewMode === 'booth' ? (
                          <>
                            <td>{row.label || row.groupKey || '-'}</td>
                            <td>{row.agentsWorked ?? 0}</td>
                            <td>{row.total ?? 0}</td>
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
                        <td>-</td>
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
            {!mapsKey ? (
              <div className="mobile-web-map-key">
                <label>Google Maps API Key</label>
                <input
                  className="mobile-web-input"
                  placeholder="Paste API key"
                  value={mapsKeyInput}
                  onChange={(e) => setMapsKeyInput(e.target.value)}
                />
                <button type="button" className="mobile-web-secondary-btn" onClick={saveMapsKey}>
                  Save Key
                </button>
              </div>
            ) : null}
            {mapLoading ? <div className="mobile-web-empty">Loading map points...</div> : null}
            {!mapLoading && mapPoints.length === 0 ? <div className="mobile-web-empty">No captured locations found.</div> : null}
            <div className="mobile-web-map-legend">
              <span><i className="legend-dot male" /> Male</span>
              <span><i className="legend-dot female" /> Female</span>
              <span><i className="legend-dot unknown" /> Other</span>
            </div>
            <div className="mobile-web-map-container" ref={mapRef} />
          </div>
        )}
        {activeTab === 'table' && hydrated && ['SUPER_ADMIN', 'ADMIN', 'WARD'].includes(role) ? (
          <div className="mobile-web-field">
            <label className="mt-5">Details</label>
            <button type="button" className="mobile-web-secondary-btn mobile-web-detail-toggle" onClick={toggleDetails} disabled={detailLoading}>
              {showDetails ? 'Hide Enrichment Details' : 'Show Enrichment Details'}
            </button>
          </div>
        ) : null}
        {activeTab === 'table' && hydrated && ['SUPER_ADMIN', 'ADMIN', 'WARD'].includes(role) && showDetails ? (
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
                  {dbDumpLoading ? `Downloading Dump... ${dbDumpProgress >= 0 ? (dbDumpProgress > 100 ? `${Math.round(dbDumpProgress/1024/1024)} MB` : `${dbDumpProgress}%`) : ''}` : 'DOWNLOAD COMPLETE DB DUMP'}
                </button>
              </div>
            )}
            {detailError ? <div className="mobile-web-error">{detailError}</div> : null}
            {detailLoading ? <div className="mobile-web-empty">Loading enrichment details...</div> : null}
            {!detailLoading && detailRows.length === 0 ? <div className="mobile-web-empty">No enrichment details found.</div> : null}
            {!detailLoading && detailRows.length > 0 ? (
              <div className="mobile-web-analysis-table-wrap mobile-web-analysis-detail" style={{ maxHeight: '60vh', overflowY: 'auto' }} onScroll={handleDetailScroll}>
                <table className="mobile-web-analysis-table">
                  <thead>
                    <tr>
                      {detailColumns.map((key) => {
                        const friendlyLabel = {
                          serialNumber: 'Sr No',
                          wardName: 'Ward Name',
                          name: 'Name',
                          epicNo: 'Epic No',
                          boothNo: 'Booth No',
                          voterSerialNo: 'Voter Serial No',
                          lastUpdatedAt: 'Last Updated At',
                          updatedByName: 'Updated By',
                          updatedByPhone: 'Agent Phone',
                          wardCode: 'Ward Code',
                        }[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
                        return <th key={key}>{friendlyLabel}</th>;
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
      </section>
    </ScreenFrame>
  );
}
export default function MobileDetailPage({ params }) {
  const slug = params.slug;
  const screen = labels[slug] || { title: 'Mobile Screen', description: 'This mobile module is being converted for the web experience.' };
  if (slug === 'search-voter') return <SearchVoterScreen />;
  if (slug === 'search-booth') return <SearchBoothScreen />;
  if (slug === 'voters-family') return <VotersFamilyScreen />;
  if (slug === 'meetings') return <MeetingsScreen />;
  if (slug === 'poll-day') return <PollDayScreen />;
  if (slug === 'print') return <PrintScreen />;
  if (slug === 'extract') return <ExtractScreen />;
  if (slug === 'add-volunteer') return <AddVolunteerScreen />;
  if (slug === 'my-volunteers') return <MyVolunteersScreen />;
  if (slug === 'volunteer-analysis') return <VolunteerAnalysisScreen />;
  return (
    <ScreenFrame>
      <section className="mobile-web-card">
        <p className="text-slate-600">{screen.description}</p>
        <p className="text-slate-500 mt-3">Search Booth and Search Voter now support booth list, voter list, and voter info drill-down.</p>
        <div className="mt-4">
          <Link href="/mobile/search-voter" className="mobile-web-primary-btn">Go to Search Voter</Link>
        </div>
      </section>
    </ScreenFrame>
  );
}
