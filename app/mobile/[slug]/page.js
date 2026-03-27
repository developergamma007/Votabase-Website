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
function buildWhatsAppMessage(voter, booth) { return `🗳️ *LOK SABHA ELECTION – 2024*\n\n*Assembly:* 160 – Sarvagnanagara\n\n*Voter Name:* ${voter?.firstMiddleNameEn || voter?.name || '-'}\n*EPIC ID:* ${voter?.epicNo || '-'}\n*Booth No:* ${booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '-'}\n*Serial No:* ${voter?.serialNo || '-'}\n\n*Polling Booth:*\n${booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-'}\n${booth?.address || ''}\n\n📅 *Date:* 26-Apr-2024\n⏰ *Time:* 7:00 AM – 6:00 PM\n\n🙏 Kindly cast your valuable vote.\n\n— Thank you`.trim(); }
function buildSMSMessage(voter, booth) { return `LOK SABHA ELECTION - 2024\n\nAssembly: 160 - SARVAGNANAGARA\n\nVoter Name: ${voter?.firstMiddleNameEn || voter?.name || '-'}\nMother: ${voter?.motherName || ''}\nEPIC ID: ${voter?.epicNo || '-'}\nBooth No: ${booth?.boothNo || voter?.boothNo || booth?.boothId || voter?.boothId || '-'} | Serial No: ${voter?.serialNo || '-'}\n\nPolling Booth:\n${booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-'}\n${booth?.address || ''}\nRoom No: ${booth?.roomNo || '1'}\n\nDate: 26-APR-2024\nTime: 7:00 AM - 6:00 PM\n\nKindly cast your valuable vote.\n\nP C Mohan - Sl. No 2\nBJP Candidate\nBengaluru Central Parliamentary Constituency`.trim(); }
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
  const resolvedPhone = normalizeMobileValue(currentPayload.mobile || voter?.mobile);

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
        setBanner({ type: 'success', text: 'Location fetched successfully.' });
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
    const encodedMessage = encodeURIComponent(buildSMSMessage({ ...voter, ...currentPayload }, booth));
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${resolvedPhone}${separator}body=${encodedMessage}`;
  };

  const openWhatsApp = () => {
    if (resolvedPhone.length !== 10) {
      setBanner({ type: 'error', text: 'Invalid mobile number.' });
      return;
    }
    const encodedMessage = encodeURIComponent(buildWhatsAppMessage({ ...voter, ...currentPayload }, booth));
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
        <button className="mobile-web-location-btn" onClick={getLocation} type="button">
          <LocationOnOutlined />
          <span>{location ? 'Location Fetched' : 'Get Location'}</span>
        </button>
        <div className="mobile-web-contact-actions">
          <button className="mobile-web-contact-btn" onClick={openSms} type="button" disabled>
            <SmsOutlined />
            <span>SMS</span>
          </button>
          <button className="mobile-web-contact-btn" onClick={openWhatsApp} type="button" disabled>
            <WhatsApp />
            <span>WhatsApp</span>
          </button>
          <button className="mobile-web-contact-btn" onClick={openCall} type="button">
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
  const userInfo = useMemo(() => getUserInfoSafe(), []);
  const role = userInfo?.role || 'ADMIN';

  const handleChange = (key, value) => {
    const nextValue = key === 'phone' ? String(value || '').replace(/\D/g, '').slice(0, 10) : value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  };
  const handleReset = (preserveFeedback = false) => {
    setForm({ firstName: '', phone: '', workingLevel: 'ASSEMBLY', assemblyId: '', wardIds: [], boothIds: [] });
    if (!preserveFeedback) setFeedback({ error: '', success: '' });
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

  useEffect(() => {
    setForm((prev) => ({ ...prev, assemblyId: '', wardIds: [], boothIds: [] }));
    setWards([]);
    setBooths([]);
  }, [form.workingLevel]);

  useEffect(() => {
    if (!['ASSEMBLY', 'WARD', 'BOOTH'].includes(form.workingLevel)) return;
    setForm((prev) => ({ ...prev, wardIds: [], boothIds: [] }));
    if (!form.assemblyId) {
      setWards([]);
      return;
    }
    mobileApi.fetchWards(form.assemblyId).then((res) => {
      const formatted = (res || []).map((item) => ({ value: item.wardId, label: item.wardNameEn || `Ward ${item.wardId}` }));
      setWards(formatted);
    }).catch(() => setWards([]));
  }, [form.workingLevel, form.assemblyId]);

  useEffect(() => {
    if (!['ASSEMBLY', 'WARD', 'BOOTH'].includes(form.workingLevel)) return;
    setForm((prev) => ({ ...prev, boothIds: [] }));
    if (!form.wardIds.length) {
      setBooths([]);
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
        phone: form.phone.trim(),
        workingLevel: form.workingLevel,
        assemblyIds: form.assemblyId ? [Number(form.assemblyId)] : [],
        wardIds: form.wardIds.map((id) => Number(id)),
        boothIds: form.boothIds.map((id) => Number(id)),
      };
      const res = await mobileApi.addVolunteer(payload);
      if (res?.success) {
        handleReset(true);
        setFeedback({ error: '', success: res?.message || 'Volunteer added successfully.' });
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
              <input className="mobile-web-input" placeholder="Phone" value={form.phone} maxLength={10} inputMode="numeric" onChange={(e) => handleChange('phone', e.target.value)} />
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
            <button className="mobile-web-primary-btn" type="button" onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting...' : 'Submit'}</button>
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
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const userInfo = useMemo(() => getUserInfoSafe(), []);
  const role = userInfo?.role || 'ADMIN';

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
      const res = await mobileApi.getVolunteerList(role, 0, 50, search, '', sortConfig.sortBy, sortConfig.direction, workingLevel);
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
  }, [search, workingLevel, sortMode]);

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
      await mobileApi.removeVolunteer({ userEmail: email, delete: del });
      await loadVolunteers();
    } catch {
      setFeedback({ error: 'Unable to update volunteer.', success: '' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`delete-${email}`]: false }));
    }
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
      if (deleted) acc.deleted += 1;
      else if (blocked) acc.blocked += 1;
      else acc.active += 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, active: 0, blocked: 0, deleted: 0 }
  );

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
              <div className="mobile-web-volunteer-pill deleted">Deleted <strong>{stats.deleted}</strong></div>
            </div>
          </div>

          {loading ? <div className="mobile-web-empty">Loading volunteers...</div> : null}
          {!loading && volunteers.length === 0 ? <div className="mobile-web-empty">No volunteers found.</div> : null}
          {!loading && volunteers.length > 0 ? (
            <div className="mobile-web-stack">
              {volunteers.map((v) => {
                const deleted = v.deleted === true || v.deleted === 'true' || v.deleted === 1;
                const blocked = v.blocked === true || v.blocked === 'true' || v.blocked === 1;
                const name = `${v.firstName || ''} ${v.lastName || ''}`.trim() || v.userName || 'Volunteer';
                const levelLabel = (v.assignmentType || '-').toUpperCase();
                const statusLabel = deleted ? 'Deleted' : blocked ? 'Blocked' : 'Active';
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
                      </div>
                      <div className="mobile-web-volunteer-inline-actions">
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
                          {deleted ? "Undelete" : "Delete"}
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
  const [members, setMembers] = useState([]);
  const [economicStatus, setEconomicStatus] = useState('NA');
  const [headOfFamily, setHeadOfFamily] = useState('');
  const [headPhone, setHeadPhone] = useState('');
  const [familyNature, setFamilyNature] = useState('NA');
  const [familyPoints, setFamilyPoints] = useState('5');
  const [locationStatus, setLocationStatus] = useState('');

  const addMember = () => {
    if (!memberQuery.trim()) return;
    const newMember = {
      id: `${memberQuery}-${Date.now()}`,
      name: memberQuery.trim(),
      epic: 'EPIC0001',
      phone: '9876543210',
      houseNo: '12A',
    };
    setMembers((current) => current.concat(newMember));
    setMemberQuery('');
  };

  const handleGetLocation = async () => {
    setLocationStatus('');
    try {
      const loc = await requestLocation();
      setLocationStatus(`Location captured: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
    } catch (error) {
      setLocationStatus(error?.message || 'Unable to fetch location.');
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
            <input className="mobile-web-input" placeholder="Search voter to add" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
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
                    <button type="button" className="mobile-web-secondary-btn">Remove</button>
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
                <option key={member.id} value={member.name}>{member.name}</option>
              ))}
            </select>
          </label>
          <label className="mobile-web-field">
            <span>Family Head Phone Number</span>
            <input className="mobile-web-input" placeholder="Family Head Phone Number" value={headPhone} onChange={(e) => setHeadPhone(e.target.value)} />
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
        <button type="button" className="mobile-web-secondary-btn mobile-web-location-pill" onClick={handleGetLocation}>
          Get location of the Family
        </button>
        {locationStatus ? <div className="mobile-web-info-pill">{locationStatus}</div> : null}
        <div className="mobile-web-actions">
          <button className="mobile-web-secondary-btn" type="button">Preview Screen</button>
          <button className="mobile-web-primary-btn" type="button">Update</button>
        </div>
      </section>
    </ScreenFrame>
  );
}

function MeetingsScreen() {
  const meetings = [
    { id: 1, title: 'Booth Volunteer Sync', time: '10:00 AM', location: 'Ward Office', date: 'Apr 26, 2024', status: 'Scheduled' },
    { id: 2, title: 'Voter Outreach Check-in', time: '4:30 PM', location: 'Community Hall', date: 'Apr 28, 2024', status: 'Pending' },
    { id: 3, title: 'Field Report Review', time: '6:00 PM', location: 'Campaign HQ', date: 'Apr 30, 2024', status: 'Completed' },
  ];

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-meetings-shell">
        <MobileHeader title="Meetings" onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        <div className="mobile-web-action-row">
          <button className="mobile-web-primary-btn" type="button">Create Meeting</button>
          <button className="mobile-web-secondary-btn" type="button">Filter</button>
        </div>
        <div className="mobile-web-meeting-list">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="mobile-web-meeting-card">
              <div>
                <h3>{meeting.title}</h3>
                <p>{meeting.date} · {meeting.time}</p>
                <p className="mobile-web-muted">{meeting.location}</p>
              </div>
              <span className={`mobile-web-tag ${meeting.status.toLowerCase()}`}>{meeting.status}</span>
            </div>
          ))}
        </div>
      </section>
    </ScreenFrame>
  );
}

function PollDayScreen() {
  const [tab, setTab] = useState('ALL');
  const voters = [
    { id: 1, name: 'Ravi Kumar', epic: 'EPIC001', phone: '9876543210', nature: 'Favour', booth: '12A', status: 'VOTED' },
    { id: 2, name: 'Suma R', epic: 'EPIC002', phone: '8765432109', nature: 'Neutral', booth: '12A', status: 'NOT VOTED' },
    { id: 3, name: 'Anil', epic: 'EPIC003', phone: '7654321098', nature: 'NonFavour', booth: '15', status: 'NOT VOTED' },
  ];
  const filtered = tab === 'ALL' ? voters : voters.filter((v) => v.status === tab);

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-pollday-shell">
        <MobileHeader title="Poll Day — Voters" subtitle="Ward: All · Booth: All" onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        <div className="mobile-web-pollday-top">
          <div className="mobile-web-search-input-wrap">
            <SearchRounded className="mobile-web-search-icon" />
            <input className="mobile-web-input" placeholder="Search name / EPIC / phone" />
          </div>
          <div className="mobile-web-pollday-actions">
            <button className="mobile-web-primary-btn" type="button">Search</button>
            <button className="mobile-web-secondary-btn" type="button">Reset</button>
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
              <select className="mobile-web-input mobile-web-small-select">
                <option>Nature</option>
                <option>Favour</option>
                <option>Neutral</option>
                <option>NonFavour</option>
              </select>
            </div>
            <div className="mobile-web-pollday-list">
              {filtered.map((voter) => (
                <div key={voter.id} className="mobile-web-pollday-card">
                  <div className="mobile-web-avatar-circle">{voter.name[0]}</div>
                  <div className="mobile-web-pollday-info">
                    <h4>{voter.name}</h4>
                    <p>{voter.epic} · {voter.phone}</p>
                    <div className="mobile-web-chip-row">
                      <span className={`mobile-web-chip ${voter.nature.toLowerCase()}`}>{voter.nature}</span>
                      <span className="mobile-web-chip neutral">{voter.booth}</span>
                    </div>
                  </div>
                  <div className="mobile-web-pollday-actions">
                    <button className={`mobile-web-pill ${voter.status === 'VOTED' ? 'success' : ''}`} type="button">VOTED</button>
                    <button className={`mobile-web-pill ${voter.status === 'NOT VOTED' ? 'danger' : ''}`} type="button">NOT VOTED</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mobile-web-pollday-right">
            <div className="mobile-web-quick-card">
              <h4>Quick Actions</h4>
              <button className="mobile-web-secondary-btn" type="button">Show Not Voted</button>
              <button className="mobile-web-secondary-btn" type="button">Show Voted</button>
              <button className="mobile-web-secondary-btn" type="button">Filter: Favour</button>
            </div>
            <div className="mobile-web-quick-card">
              <h4>Offline queue</h4>
              <p className="mobile-web-muted">Queued ops: 0</p>
              <button className="mobile-web-secondary-btn" type="button">Sync Now</button>
            </div>
          </div>
        </div>
      </section>
    </ScreenFrame>
  );
}

function PrintScreen() {
  const printers = ['Wireless Printer A', 'Wireless Printer B', 'Wireless Printer C'];

  return (
    <ScreenFrame accent="light">
      <section className="mobile-web-card mobile-web-print-shell">
        <MobileHeader title="Printer" onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} />
        <div className="mobile-web-printer-status">
          <div>
            <div className="mobile-web-status-title">Connected</div>
            <div className="mobile-web-muted">Battery: 85%</div>
          </div>
          <button className="mobile-web-gradient-btn" type="button">Connect</button>
        </div>
        <div className="mobile-web-printer-card">
          <h4>Available Devices</h4>
          {printers.map((printer) => (
            <div key={printer} className="mobile-web-printer-row">
              <span>{printer}</span>
              <span className="mobile-web-signal">︿︿︿</span>
            </div>
          ))}
        </div>
        <button className="mobile-web-gradient-btn full" type="button">Disconnect</button>
        <button className="mobile-web-gradient-btn subtle" type="button">Print Sample</button>
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
  const userInfo = useMemo(() => getUserInfoSafe(), []);
  const role = (userInfo?.role || '').toUpperCase();

  const sortOptions = [
    { label: 'Name A-Z', value: 'name-asc' },
    { label: 'Name Z-A', value: 'name-desc' },
    { label: 'Latest Created', value: 'latest' },
    { label: 'Oldest Created', value: 'oldest' },
  ];
  const selectedSortLabel = sortOptions.find((item) => item.value === sortMode)?.label || '';

  const sortedRows = useMemo(() => {
    const items = [...rows];
    if (sortMode === 'name-desc') {
      return items.sort((a, b) => String(b.agentName || '').localeCompare(String(a.agentName || ''), 'en'));
    }
    if (sortMode === 'latest') {
      return items.sort((a, b) => Number(b.userId || 0) - Number(a.userId || 0));
    }
    if (sortMode === 'oldest') {
      return items.sort((a, b) => Number(a.userId || 0) - Number(b.userId || 0));
    }
    return items.sort((a, b) => String(a.agentName || '').localeCompare(String(b.agentName || ''), 'en'));
  }, [rows, sortMode]);

  const buildExportRows = () => {
    const headers = ['Agent Name', 'Mobile No', ...fields.map((f) => f.label)];
    const dataRows = sortedRows.map((row) => [
      row.agentName || '',
      row.phone || '',
      ...fields.map((f) => row.counts?.[f.key] ?? 0),
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

  const loadAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mobileApi.fetchVolunteerAnalysis();
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
  }, [role]);

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
        {role === 'WARD' ? <div className="mobile-web-info-pill">Showing data for your ward access.</div> : null}
        <div className="mobile-web-action-row" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button type="button" className="mobile-web-primary-btn" onClick={loadAnalysis} disabled={loading}>
            {loading ? 'Refreshing...' : 'Get Latest Data'}
          </button>
          <button type="button" className="mobile-web-secondary-btn" onClick={downloadCsv} disabled={!rows.length}>
            Download CSV
          </button>
          <button type="button" className="mobile-web-secondary-btn" onClick={downloadXls} disabled={!rows.length}>
            Download Excel
          </button>
        </div>
        <div className="mobile-web-form-grid" style={{ marginBottom: '12px' }}>
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
        </div>
        {error ? <div className="mobile-web-error">{error}</div> : null}
        {loading ? <div className="mobile-web-empty">Loading analysis...</div> : null}
        {!loading && sortedRows.length === 0 ? <div className="mobile-web-empty">No analysis data found.</div> : null}
        {!loading && sortedRows.length > 0 ? (
          <div className="mobile-web-analysis-table-wrap">
            <table className="mobile-web-analysis-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Mobile No</th>
                  {fields.map((field) => (
                    <th key={field.key}>{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.userId}>
                    <td>{row.agentName || '-'}</td>
                    <td>{row.phone || '-'}</td>
                    {fields.map((field) => (
                      <td key={`${row.userId}-${field.key}`}>{row.counts?.[field.key] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
