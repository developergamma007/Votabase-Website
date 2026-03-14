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
    title: 'My Volunteers',
    description: 'Search, manage, and block volunteers in a web-first layout.',
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
function normalizeVoter(voter, fallbackBooth) { const boothInfo = voter?.boothInfo || {}; const gender = voter?.gender || voter?.sex || '-'; const genderUpper = String(gender).toUpperCase(); return { ...voter, voterId: voter?.voterId ?? voter?.id ?? voter?.epicNo, serialNo: voter?.srNo ?? voter?.serialNo ?? voter?.slNo ?? '-', epicNo: voter?.epicNo ?? voter?.epic ?? '-', name: voter?.firstMiddleNameEn || voter?.name || voter?.voterName || '-', relationLabel: voter?.relationType || voter?.rel_type || 'Father', relationName: voter?.relationFirstMiddleNameEn || voter?.relationNameEn || voter?.fatherName || voter?.motherName || voter?.relation_name_en || '', houseNo: voter?.houseNoEn ?? voter?.house ?? voter?.house_no_en ?? '-', age: voter?.age ?? '-', gender, genderClass: genderUpper.startsWith('M') ? 'male' : genderUpper.startsWith('F') ? 'female' : 'other', boothLabel: fallbackBooth?.boothLabel || boothInfo?.boothNameEn || voter?.boothNameEn || '', boothId: fallbackBooth?.boothId || boothInfo?.boothId || voter?.boothId || '', boothNo: voter?.boothNo || boothInfo?.boothNo || '', wardCode: (voter?.wardCode ?? fallbackBooth?.wardCode) || boothInfo?.wardCode || '' }; }
function normalizeMobileValue(value) { return String(value || '').replace(/\D/g, '').slice(0, 10); }
function maskTrailingValue(value) { const raw = String(value || ''); return raw.length > 4 ? `${'*'.repeat(raw.length - 4)}${raw.slice(-4)}` : raw; }
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
function buildWhatsAppMessage(voter, booth) { return `🗳️ *LOK SABHA ELECTION – 2024*\n\n*Assembly:* 160 – Sarvagnanagara\n\n*Voter Name:* ${voter?.firstMiddleNameEn || voter?.name || '-'}\n*EPIC ID:* ${voter?.epicNo || '-'}\n*Booth No:* ${booth?.boothId || voter?.boothId || '-'}\n*Serial No:* ${voter?.serialNo || '-'}\n\n*Polling Booth:*\n${booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-'}\n${booth?.address || ''}\n\n📅 *Date:* 26-Apr-2024\n⏰ *Time:* 7:00 AM – 6:00 PM\n\n🙏 Kindly cast your valuable vote.\n\n— Thank you`.trim(); }
function buildSMSMessage(voter, booth) { return `LOK SABHA ELECTION - 2024\n\nAssembly: 160 - SARVAGNANAGARA\n\nVoter Name: ${voter?.firstMiddleNameEn || voter?.name || '-'}\nMother: ${voter?.motherName || ''}\nEPIC ID: ${voter?.epicNo || '-'}\nBooth No: ${booth?.boothId || voter?.boothId || '-'} | Serial No: ${voter?.serialNo || '-'}\n\nPolling Booth:\n${booth?.boothNameEn || booth?.boothLabel || voter?.boothLabel || '-'}\n${booth?.address || ''}\nRoom No: ${booth?.roomNo || '1'}\n\nDate: 26-APR-2024\nTime: 7:00 AM - 6:00 PM\n\nKindly cast your valuable vote.\n\nP C Mohan - Sl. No 2\nBJP Candidate\nBengaluru Central Parliamentary Constituency`.trim(); }
function getWardOptionsFromCache() { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; const labels = wards.map((ward) => ward.wardNameEn || `Ward ${ward.wardId}`); const unique = Array.from(new Set(labels.filter(Boolean))); if (!unique.includes('Others')) unique.push('Others'); return unique; } catch { return ['Others']; } }
function getBoothOptionsFromCache() { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; const booths = wards.flatMap((ward) => (ward.booths || []).map((booth) => booth.boothNameEn || booth.nameEn || booth.booth_add_en || `Booth ${booth.boothId ?? booth.id ?? booth.booth_no ?? ''}`)); const unique = Array.from(new Set(booths.filter(Boolean))); if (!unique.includes('Others')) unique.push('Others'); return unique; } catch { return ['Others']; } }
function MobileHeader({ title, subtitle, onBack, hideAvatar = false }) { return <div className={`mobile-web-list-topbar ${hideAvatar ? 'no-avatar' : ''}`}><button className="mobile-web-back-btn" onClick={onBack} type="button"><ArrowBackIosNewRounded fontSize="small" /></button><div className="mobile-web-header-copy"><h2>{title}</h2>{subtitle ? <div className="mobile-web-header-subtitle">{subtitle}</div> : null}</div>{hideAvatar ? <div /> : <div className="mobile-web-avatar"><PersonOutlineRounded /></div>}</div>; }
function useDropdownDismiss(rootRef, onClose) { useEffect(() => { const handlePointerDown = (event) => { if (!rootRef.current?.contains(event.target)) onClose(); }; document.addEventListener('mousedown', handlePointerDown); return () => document.removeEventListener('mousedown', handlePointerDown); }, [rootRef, onClose]); }
function SingleOptionSelect({ label, options, value, customValue, onSelect, onCustomValueChange, disabled = false }) { const [open, setOpen] = useState(false); const rootRef = useRef(null); useDropdownDismiss(rootRef, () => setOpen(false)); const optionSet = new Set(options); const isUnknown = !!value && value !== 'Others' && !optionSet.has(value); const showOther = value === 'Others' || isUnknown || !!customValue; const summaryValue = showOther ? 'Others' : value; const otherValue = customValue || (isUnknown ? value : ''); return <div className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}><button className="mobile-web-multiselect-trigger" type="button" disabled={disabled} onClick={() => { if (disabled) return; setOpen((current) => !current); }}><span className={summaryValue ? 'has-value' : 'is-placeholder'}>{summaryValue || `Select ${label}`}</span><ExpandMoreRounded className="mobile-web-select-icon" /></button>{open ? <div className="mobile-web-multiselect-panel">{options.map((option) => { const checked = option === 'Others' ? showOther : value === option; return <button key={option} type="button" className={`mobile-web-single-select-option ${checked ? 'checked' : ''}`} onClick={() => { onSelect(option); setOpen(false); }}><span>{option}</span></button>; })}</div> : null}{showOther ? <input className="mobile-web-input mobile-web-other-input" placeholder={`Enter ${label.toLowerCase()}`} value={otherValue} onChange={(e) => onCustomValueChange(e.target.value)} /> : null}</div>; }
function MultiCheckboxSelect({ label, options, value, customValue, onToggle, onCustomValueChange, disabled = false }) { const [open, setOpen] = useState(false); const rootRef = useRef(null); useDropdownDismiss(rootRef, () => setOpen(false)); const optionSet = new Set(options); const selectedLabels = value.filter((item) => item !== 'Others' && optionSet.has(item)); const unknownLabels = value.filter((item) => item !== 'Others' && !optionSet.has(item)); const otherValue = customValue || unknownLabels.join(', '); const showOther = value.includes('Others') || unknownLabels.length > 0 || !!customValue; const summaryItems = selectedLabels.length ? selectedLabels.slice() : []; if (showOther) summaryItems.push('Others'); const summary = summaryItems.length ? `${summaryItems[0]}${summaryItems.length > 1 ? ` +${summaryItems.length - 1}` : ''}` : `Select ${label}`; return <div className={`mobile-web-multiselect-wrap ${open ? 'open' : ''} ${disabled ? 'is-disabled' : ''}`} ref={rootRef}><button className="mobile-web-multiselect-trigger" type="button" disabled={disabled} onClick={() => { if (disabled) return; setOpen((current) => !current); }}><span className={summaryItems.length ? 'has-value' : 'is-placeholder'}>{summary}</span><ExpandMoreRounded className="mobile-web-select-icon" /></button>{open ? <div className="mobile-web-multiselect-panel">{options.map((option) => { const checked = option === 'Others' ? showOther : value.includes(option); return <label key={option} className={`mobile-web-multiselect-option ${checked ? 'checked' : ''}`}><input type="checkbox" checked={checked} onChange={() => onToggle(option)} /><span>{option}</span></label>; })}</div> : null}{showOther ? <input className="mobile-web-input mobile-web-other-input" placeholder={`Enter ${label.toLowerCase()}`} value={otherValue} onChange={(e) => onCustomValueChange(e.target.value)} /> : null}</div>; }
function VoterInfoScreen({ voter, booth, onBack, onSave }) { const [activeTab, setActiveTab] = useState('PRIMARY'); const [form, setForm] = useState(() => getDefaultVoterForm(voter)); const [customValues, setCustomValues] = useState({}); const [location, setLocation] = useState(voter?.latitude && voter?.longitude ? { latitude: voter.latitude, longitude: voter.longitude } : null); const [saving, setSaving] = useState(false); const [banner, setBanner] = useState({ type: '', text: '' }); const [mobileFocused, setMobileFocused] = useState(false); const baseForm = useMemo(() => getDefaultVoterForm(voter), [voter]); const basePayload = useMemo(() => buildVoterPayload(baseForm, {}), [baseForm]); const currentPayload = useMemo(() => buildVoterPayload(form, customValues), [form, customValues]); const hasChanges = useMemo(() => Object.keys(currentPayload).some((key) => voterFieldChanged(currentPayload[key], basePayload[key])), [currentPayload, basePayload]); useEffect(() => { setForm(getDefaultVoterForm(voter)); setCustomValues({}); setMobileFocused(false); }, [voter]); const boothTitle = `${booth?.boothId || voter?.boothId || ''}${booth?.boothLabel || voter?.boothLabel ? ' - ' : ''}${booth?.boothLabel || voter?.boothLabel || ''}`; const resolvedPhone = normalizeMobileValue(currentPayload.mobile || voter?.mobile); const handleFieldChange = (key, value) => { const nextValue = key === 'mobile' ? normalizeMobileValue(value) : value; setForm((prev) => ({ ...prev, [key]: nextValue })); if (nextValue !== 'Others') setCustomValues((prev) => ({ ...prev, [key]: prev[key] || '' })); }; const toggleGovtScheme = (option) => { setForm((prev) => ({ ...prev, govtSchemeTracking: prev.govtSchemeTracking.includes(option) ? prev.govtSchemeTracking.filter((item) => item !== option) : prev.govtSchemeTracking.concat(option) })); if (option === 'Others') setCustomValues((prev) => ({ ...prev, govtSchemeTracking: prev.govtSchemeTracking || '' })); }; const resetForm = () => { setForm(getDefaultVoterForm(voter)); setCustomValues({}); setBanner({ type: '', text: '' }); setMobileFocused(false); }; const getLocation = () => { if (typeof navigator === 'undefined' || !navigator.geolocation) { setBanner({ type: 'error', text: 'Geolocation is not supported in this browser.' }); return; } navigator.geolocation.getCurrentPosition((position) => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setBanner({ type: 'success', text: 'Location fetched successfully.' }); }, () => setBanner({ type: 'error', text: 'Unable to fetch current location.' }), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }); }; const saveVoter = async () => { if (!hasChanges) return; setSaving(true); setBanner({ type: '', text: '' }); try { await mobileApi.updateVoter(voter.epicNo, { updateLocationLat: location?.latitude || 0, updateLocationLng: location?.longitude || 0, updateRequest: { ...currentPayload, latitude: location?.latitude || voter?.latitude || 0, longitude: location?.longitude || voter?.longitude || 0 } }, { boothNo: voter?.boothNo, wardCode: voter?.wardCode || booth?.wardCode }); setBanner({ type: 'success', text: 'Voter updated successfully.' }); onSave?.({ ...voter, ...currentPayload, latitude: location?.latitude, longitude: location?.longitude }); } catch (error) { setBanner({ type: 'error', text: error?.message || error?.detail || 'Update failed' }); } finally { setSaving(false); } }; const openSms = () => { if (resolvedPhone.length !== 10) { setBanner({ type: 'error', text: 'Invalid mobile number.' }); return; } const encodedMessage = encodeURIComponent(buildSMSMessage({ ...voter, ...currentPayload }, booth)); const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'; window.location.href = `sms:${resolvedPhone}${separator}body=${encodedMessage}`; }; const openWhatsApp = () => { if (resolvedPhone.length !== 10) { setBanner({ type: 'error', text: 'Invalid mobile number.' }); return; } const encodedMessage = encodeURIComponent(buildWhatsAppMessage({ ...voter, ...currentPayload }, booth)); window.open(`https://wa.me/91${resolvedPhone}?text=${encodedMessage}`, '_blank', 'noopener,noreferrer'); }; const openCall = () => { if (resolvedPhone.length !== 10) { setBanner({ type: 'error', text: 'Invalid mobile number.' }); return; } window.location.href = `tel:${resolvedPhone}`; }; const renderSelect = (key, placeholder, multiple = false) => { const options = dropdownOptions[key] || []; if (multiple) return <MultiCheckboxSelect label={placeholder} options={options} value={form[key]} customValue={customValues[key]} onToggle={toggleGovtScheme} onCustomValueChange={(nextValue) => setCustomValues((prev) => ({ ...prev, [key]: nextValue }))} />; return <SingleOptionSelect label={placeholder} options={options} value={form[key]} customValue={customValues[key]} onSelect={(option) => handleFieldChange(key, option)} onCustomValueChange={(nextValue) => setCustomValues((prev) => ({ ...prev, [key]: nextValue }))} />; }; const renderField = (key) => { if (key === 'mobile') return <input className="mobile-web-input" inputMode="numeric" maxLength={10} value={mobileFocused ? form.mobile : maskTrailingValue(form.mobile)} placeholder={fieldLabels[key]} onFocus={() => setMobileFocused(true)} onBlur={() => setMobileFocused(false)} onChange={(e) => handleFieldChange(key, e.target.value)} />; if (key === 'dob') return <input className="mobile-web-input" type="date" value={form[key]} placeholder={fieldLabels[key]} onChange={(e) => handleFieldChange(key, e.target.value)} />; if (key === 'ifShifted') return <input className="mobile-web-input" value={form[key]} placeholder={fieldLabels[key]} onChange={(e) => handleFieldChange(key, e.target.value)} />; if (key === 'govtSchemeTracking') return renderSelect(key, fieldLabels[key], true); return renderSelect(key, fieldLabels[key], false); }; return <div className="mobile-web-stack"><MobileHeader title="Voter Info" onBack={onBack} />{banner.text ? <div className={banner.type === 'error' ? 'mobile-web-error' : 'mobile-web-success'}>{banner.text}</div> : null}<section className="mobile-web-detail-card"><div className="mobile-web-detail-meta"><p><strong>Name</strong><span>{voter?.name || '-'}</span></p><p><strong>EPIC / Voter ID</strong><span>{voter?.epicNo || '-'}</span></p><p><strong>Polling Booth</strong><span>{boothTitle || '-'}</span></p></div><button className="mobile-web-location-btn" onClick={getLocation} type="button"><LocationOnOutlined /><span>{location ? 'Location Fetched' : 'Get Location'}</span></button><div className="mobile-web-contact-actions"><button className="mobile-web-contact-btn" onClick={openSms} type="button"><SmsOutlined /><span>SMS</span></button><button className="mobile-web-contact-btn" onClick={openWhatsApp} type="button"><WhatsApp /><span>WhatsApp</span></button><button className="mobile-web-contact-btn" onClick={openCall} type="button"><PhoneOutlined /><span>Call</span></button></div></section><section className="mobile-web-tab-shell"><div className="mobile-web-tab-strip">{['PRIMARY', 'ADDITIONAL', 'NOTES'].map((tab) => <button key={tab} type="button" className={`mobile-web-tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>{activeTab !== 'NOTES' && fieldGroups[activeTab].map((key) => <div key={key} className="mobile-web-field"><label>{fieldLabels[key]}</label>{renderField(key)}</div>)}{activeTab === 'NOTES' && <><div className="mobile-web-field"><label>Available</label>{renderSelect('status', 'Availability')}</div>{(form.status === 'Shifted in the ward' || form.status === 'Shifted outside the ward') && <div className="mobile-web-field"><label>Enter present address</label><textarea className="mobile-web-input mobile-web-textarea" value={form.presentAddress} onChange={(e) => handleFieldChange('presentAddress', e.target.value)} placeholder="Enter present address" /></div>}{form.status === 'Recommend shift to the new ward' && <><div className="mobile-web-field"><label>Ward</label><input className="mobile-web-input" value={form.newWard} onChange={(e) => handleFieldChange('newWard', e.target.value)} placeholder="Enter ward" /></div><div className="mobile-web-field"><label>Booth No</label><input className="mobile-web-input" value={form.newBoothNo} onChange={(e) => handleFieldChange('newBoothNo', e.target.value)} placeholder="Enter booth number" /></div><div className="mobile-web-field"><label>Serial No</label><input className="mobile-web-input" value={form.newSerialNo} onChange={(e) => handleFieldChange('newSerialNo', e.target.value)} placeholder="Enter serial number" /></div></>}{form.status === 'Not available' && <div className="mobile-web-field"><label>Enter the reason</label><textarea className="mobile-web-input mobile-web-textarea" value={form.notAvailableReason} onChange={(e) => handleFieldChange('notAvailableReason', e.target.value)} placeholder="Enter the reason" /></div>}<div className="mobile-web-field"><label>ENTER NOTES</label><textarea className="mobile-web-input mobile-web-textarea" value={form.notes} onChange={(e) => handleFieldChange('notes', e.target.value)} placeholder="Enter notes" /></div></>}<div className="mobile-web-form-actions"><button className="mobile-web-reset-btn" onClick={resetForm} type="button">Reset</button><button className="mobile-web-update-btn" onClick={saveVoter} disabled={saving || !hasChanges} type="button">{saving ? 'Updating...' : 'Update'}</button></div><button className="mobile-web-slip-btn" onClick={() => window.print()} type="button">Voter Slip Print</button></section></div>; }
function VoterListScreen({ heading, voters, booth, loading, errorText, onBack, onLoadMore, hasMore, summary, mode = 'local', onSelectVoter }) { const [query, setQuery] = useState(''); const [localVisibleCount, setLocalVisibleCount] = useState(PAGE_SIZE); useEffect(() => { setQuery(''); setLocalVisibleCount(PAGE_SIZE); }, [heading, booth?.boothId]); const normalizedVoters = useMemo(() => voters.map((voter) => normalizeVoter(voter, booth)), [voters, booth]); const filteredVoters = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return normalizedVoters; return normalizedVoters.filter((voter) => [voter.name, voter.epicNo, voter.relationName, voter.houseNo, voter.gender, voter.boothId, voter.boothLabel].filter(Boolean).join(' ').toLowerCase().includes(q)); }, [normalizedVoters, query]); const displayedVoters = mode === 'local' ? filteredVoters.slice(0, localVisibleCount) : filteredVoters; const resolvedSummary = booth ? boothStats(booth) : { total: Number(summary?.total ?? filteredVoters.length), male: Number(summary?.male ?? filteredVoters.filter((v) => String(v.gender).toUpperCase().startsWith('M')).length), female: Number(summary?.female ?? filteredVoters.filter((v) => String(v.gender).toUpperCase().startsWith('F')).length) }; const canLoadMoreLocal = mode === 'local' && displayedVoters.length < filteredVoters.length; const sentinelRef = useInfiniteTrigger(canLoadMoreLocal || (!!hasMore && mode === 'remote'), () => { if (canLoadMoreLocal) setLocalVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredVoters.length)); else if (hasMore && onLoadMore) onLoadMore(); }); const headerTitle = booth?.boothId ? `${booth.boothId} - ${booth.boothLabel}` : heading; const headerSubtitle = <><span className="mobile-web-stat-pill total">Total Voters: <strong>{resolvedSummary.total}</strong></span><span className="mobile-web-stat-pill male">Male: <strong>{resolvedSummary.male}</strong></span><span className="mobile-web-stat-pill female">Female: <strong>{resolvedSummary.female}</strong></span></>; return <div className="mobile-web-stack"><MobileHeader title={headerTitle} subtitle={headerSubtitle} onBack={onBack} hideAvatar={true} /><section className="mobile-web-search-card mobile-web-card"><div className="mobile-web-search-input-wrap"><SearchRounded className="mobile-web-search-icon" /><input className="mobile-web-input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></div></section>{errorText ? <div className="mobile-web-error">{errorText}</div> : null}{loading && displayedVoters.length === 0 ? <div className="mobile-web-empty">Loading voters...</div> : null}<section className="mobile-web-voter-list">{displayedVoters.map((voter) => <button key={`${voter.boothId}-${voter.serialNo}-${voter.epicNo}`} type="button" className="mobile-web-voter-card mobile-web-voter-button" onClick={() => onSelectVoter?.(voter, booth)}><div className="mobile-web-voter-card-head"><span>{voter.serialNo}</span><strong>{voter.epicNo}</strong></div><div className="mobile-web-voter-grid"><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Name</span><span className="mobile-web-voter-value">{voter.name}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">{voter.relationLabel}</span><span className="mobile-web-voter-value">{voter.relationName || '-'}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">House No.</span><span className="mobile-web-voter-value">{voter.houseNo}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Age</span><span className="mobile-web-voter-value">{voter.age}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Sex</span><span className={`mobile-web-voter-value mobile-web-gender-chip ${voter.genderClass}`}>{voter.gender}</span></div><div className="mobile-web-voter-row"><span className="mobile-web-voter-label">Booth</span><span className="mobile-web-voter-value">{voter.boothId ? `${voter.boothId} - ` : ''}{voter.boothLabel || '-'}</span></div></div></button>)}</section>{!loading && displayedVoters.length === 0 ? <div className="mobile-web-empty">No voters found.</div> : null}{(canLoadMoreLocal || hasMore) ? <div ref={sentinelRef} className="mobile-web-load-note">Loading more...</div> : null}</div>; }
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
        boothId: booth.boothId ?? booth.id ?? booth.booth_no,
        boothNameEn: booth.boothNameEn ?? booth.nameEn ?? booth.booth_add_en ?? '',
        boothLabel: booth.boothNameEn ?? booth.nameEn ?? booth.booth_add_en ?? '',
        voters: booth.voters || [],
        voterStats: booth.voterStats || {},
        wardId: ward.wardId,
        wardNameEn: ward.wardNameEn,
      }))
    );
  }, [assemblyData]);

  const filteredBooths = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return booths;
    return booths.filter((item) =>
      `${item.boothId} ${item.boothNameEn} ${item.wardNameEn || ''}`.toLowerCase().includes(q)
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

  if (selectedVoter) {
    return (
      <ScreenFrame accent="light">
        <VoterInfoScreen
          voter={selectedVoter}
          booth={{ boothId: selectedBoothPayload?.boothId ?? selectedBooth?.boothId, boothLabel: selectedBoothPayload?.boothNameEn ?? selectedBooth?.boothLabel }}
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
          onSelectVoter={(voter) => setSelectedVoter(voter)}
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
                <h3>{booth.boothId} - {booth.boothNameEn}</h3>
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
function SearchVoterScreen() { const assemblyCode = getAssemblyCode(); const [showMoreFilters, setShowMoreFilters] = useState(false); const [wardItems, setWardItems] = useState([]); const [searching, setSearching] = useState(false); const [loadingMore, setLoadingMore] = useState(false); const [errorText, setErrorText] = useState(''); const [successText, setSuccessText] = useState(''); const [form, setForm] = useState({ searchQuery: '', wards: '', epicId: '', boothNumber: '', mobileNumber: '', relationName: '', houseNumber: '' }); const [view, setView] = useState('search'); const [voterResults, setVoterResults] = useState([]); const [selectedVoter, setSelectedVoter] = useState(null); const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false); const [resultMeta, setResultMeta] = useState(null); useEffect(() => { try { const raw = localStorage.getItem(BOOTH_CACHE_KEY); const parsed = JSON.parse(raw || '{}'); const wards = parsed?.assembly?.wards || []; setWardItems(wards.map((ward) => ({ label: ward.wardNameEn || `Ward ${ward.wardId}`, value: String(ward.wardId) }))); } catch { setWardItems([]); } }, []); const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value })); const handleReset = () => { setForm({ searchQuery: '', wards: '', epicId: '', boothNumber: '', mobileNumber: '', relationName: '', houseNumber: '' }); setErrorText(''); setSuccessText(''); setVoterResults([]); setPage(0); setHasMore(false); setResultMeta(null); setView('search'); setSelectedVoter(null); }; const runSearch = async (nextPage = 0) => { const response = await mobileApi.searchVoters({ assemblyCode, searchQuery: form.searchQuery, wardId: form.wards || undefined, boothNumber: form.boothNumber, mobileNumber: form.mobileNumber, epicId: form.epicId, relationName: form.relationName, houseNumber: form.houseNumber, page: nextPage, size: PAGE_SIZE }); const nextResults = response?.data?.result || []; const meta = response?.data?.meta || {}; setResultMeta(meta); setHasMore(Boolean(meta?.hasMore)); setPage(nextPage); setVoterResults((current) => (nextPage === 0 ? nextResults : [...current, ...nextResults])); setView('list'); }; const handleSearch = async () => { setSearching(true); setErrorText(''); setSuccessText(''); if (!assemblyCode) { setErrorText('No assembly code is configured for this user/environment.'); setSearching(false); return; } try { await runSearch(0); } catch (error) { setErrorText(error?.message || error?.detail || 'Search failed'); } finally { setSearching(false); } }; const loadMore = async () => { if (loadingMore || searching || !hasMore) return; setLoadingMore(true); try { await runSearch(page + 1); } catch (error) { setErrorText(error?.message || error?.detail || 'Failed to load more voters'); } finally { setLoadingMore(false); } }; const handleSaveVoter = (updatedVoter) => { setSelectedVoter(updatedVoter); setVoterResults((current) => current.map((item) => (item.voterId === updatedVoter.voterId ? { ...item, ...updatedVoter } : item))); }; const selectedWardLabel = wardItems.find((item) => item.value === form.wards)?.label || ''; if (selectedVoter) return <ScreenFrame accent="blue"><VoterInfoScreen voter={selectedVoter} booth={{ boothId: selectedVoter.boothId, boothLabel: selectedVoter.boothLabel }} onBack={() => setSelectedVoter(null)} onSave={handleSaveVoter} /></ScreenFrame>; if (view === 'list') return <ScreenFrame accent="blue"><VoterListScreen heading={resultMeta?.total ? `${resultMeta.total} voters found` : 'Voters List'} voters={voterResults} loading={searching || loadingMore} errorText={errorText} hasMore={hasMore} onLoadMore={loadMore} onBack={() => setView('search')} onSelectVoter={(voter) => setSelectedVoter(voter)} summary={{ total: resultMeta?.total, male: resultMeta?.male, female: resultMeta?.female }} mode="remote" /></ScreenFrame>; return <ScreenFrame accent="blue"><section className="mobile-web-card mobile-web-search-card"><div className="mobile-web-search-row"><div className="mobile-web-search-input-wrap"><SearchRounded className="mobile-web-search-icon" /><input className="mobile-web-input" placeholder="Name / EPIC / Mobile / Serial" value={form.searchQuery} onChange={(e) => handleChange('searchQuery', e.target.value)} /></div></div>{showMoreFilters && <div className="mobile-web-form-grid"><SingleOptionSelect label="Ward" options={wardItems.map((item) => item.label)} value={selectedWardLabel} customValue="" onSelect={(option) => handleChange('wards', wardItems.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => {}} /><input className="mobile-web-input" placeholder="Booth Number" value={form.boothNumber} onChange={(e) => handleChange('boothNumber', e.target.value)} /><input className="mobile-web-input" placeholder="Mobile" value={form.mobileNumber} onChange={(e) => handleChange('mobileNumber', e.target.value)} /><input className="mobile-web-input" placeholder="EPIC / Voter ID" value={form.epicId} onChange={(e) => handleChange('epicId', e.target.value)} /><input className="mobile-web-input" placeholder="Relation Name" value={form.relationName} onChange={(e) => handleChange('relationName', e.target.value)} /><input className="mobile-web-input" placeholder="House No" value={form.houseNumber} onChange={(e) => handleChange('houseNumber', e.target.value)} /></div>}<div className="mobile-web-actions"><button className="mobile-web-secondary-btn" onClick={() => setShowMoreFilters((value) => !value)} type="button">{showMoreFilters ? 'Hide Filters' : 'More Filters'}</button><button className="mobile-web-secondary-btn" onClick={handleReset} type="button">Reset</button><button className="mobile-web-primary-btn" onClick={handleSearch} disabled={searching} type="button">{searching ? 'Searching...' : 'Search'}</button></div>{errorText ? <p className="mobile-web-error">{errorText}</p> : null}{successText ? <p className="mobile-web-success">{successText}</p> : null}</section></ScreenFrame>; }
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
  const handleReset = () => {
    setForm({ firstName: '', phone: '', workingLevel: 'ASSEMBLY', assemblyId: '', wardIds: [], boothIds: [] });
    setFeedback({ error: '', success: '' });
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
        profilePicUrl: '',
        firstName: form.firstName.trim(),
        phone: form.phone.trim(),
        assignmentType: assignment.assignmentType,
        assignmentId: assignment.assignmentId,
        tenantId: userInfo?.tenantId || '',
        role: 'USER',
      };
      const res = await mobileApi.addVolunteer(payload);
      if (res?.success) {
        setFeedback({ error: '', success: 'Volunteer added successfully.' });
        handleReset();
      } else {
        setFeedback({ error: res?.message || 'Unable to add volunteer.', success: '' });
      }
    } catch (error) {
      setFeedback({ error: error?.message || 'Unable to add volunteer.', success: '' });
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
              <label>First Name</label>
              <input className="mobile-web-input" placeholder="First Name" value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Phone</label>
              <input className="mobile-web-input" placeholder="Phone" value={form.phone} maxLength={10} inputMode="numeric" onChange={(e) => handleChange('phone', e.target.value)} />
            </div>
            <div className="mobile-web-field">
              <label>Working Level</label>
              <SingleOptionSelect label="Working Level" options={levelOptions.map((item) => item.label)} value={selectedLevelLabel} customValue="" onSelect={(option) => handleChange('workingLevel', levelOptions.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => {}} />
            </div>
            {form.workingLevel === 'ASSEMBLY' ? (
              <>
                <div className="mobile-web-field">
                  <label>Assembly</label>
                  <SingleOptionSelect label="Assembly" options={assemblies.map((item) => item.label)} value={selectedAssemblyLabel} customValue="" onSelect={(option) => handleChange('assemblyId', assemblies.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => {}} />
                </div>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <MultiCheckboxSelect label="Ward" options={['All Wards', ...wardOptions]} value={allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels} customValue="" onToggle={(option) => { if (option === 'All Wards') { const nextIds = allWardsSelected ? [] : allWardLabels; handleChange('wardIds', nextIds); return; } const wardValue = String(wards.find((item) => item.label === option)?.value || ''); const nextIds = selectedWardLabels.includes(option) ? form.wardIds.filter((id) => String(id) !== wardValue) : form.wardIds.concat(wardValue); handleChange('wardIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => {}} disabled={!form.assemblyId} />
                  {!form.assemblyId ? <p className="mobile-web-helper">Select an assembly to load wards.</p> : null}
                </div>
                <div className="mobile-web-field">
                  <label>Booth</label>
                  <MultiCheckboxSelect label="Booth" options={['All Booths', ...boothOptions]} value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels} customValue="" onToggle={(option) => { if (option === 'All Booths') { const nextIds = allBoothsSelected ? [] : allBoothLabels; handleChange('boothIds', nextIds); return; } const boothValue = String(booths.find((item) => item.label === option)?.value || ''); const nextIds = selectedBoothLabels.includes(option) ? form.boothIds.filter((id) => String(id) !== boothValue) : form.boothIds.concat(boothValue); handleChange('boothIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => {}} disabled={!form.wardIds.length} />
                  {!form.wardIds.length ? <p className="mobile-web-helper">Select a ward to load booths.</p> : null}
                </div>
              </>
            ) : null}
            {form.workingLevel === 'WARD' ? (
              <>
                <div className="mobile-web-field">
                  <label>Assembly</label>
                  <SingleOptionSelect label="Assembly" options={assemblies.map((item) => item.label)} value={selectedAssemblyLabel} customValue="" onSelect={(option) => handleChange('assemblyId', assemblies.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => {}} />
                </div>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <MultiCheckboxSelect label="Ward" options={['All Wards', ...wardOptions]} value={allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels} customValue="" onToggle={(option) => { if (option === 'All Wards') { const nextIds = allWardsSelected ? [] : allWardLabels; handleChange('wardIds', nextIds); return; } const wardValue = String(wards.find((item) => item.label === option)?.value || ''); const nextIds = selectedWardLabels.includes(option) ? form.wardIds.filter((id) => String(id) !== wardValue) : form.wardIds.concat(wardValue); handleChange('wardIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => {}} disabled={!form.assemblyId} />
                  {!form.assemblyId ? <p className="mobile-web-helper">Select an assembly to load wards.</p> : null}
                </div>
                <div className="mobile-web-field">
                  <label>Booth</label>
                  <MultiCheckboxSelect label="Booth" options={['All Booths', ...boothOptions]} value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels} customValue="" onToggle={(option) => { if (option === 'All Booths') { const nextIds = allBoothsSelected ? [] : allBoothLabels; handleChange('boothIds', nextIds); return; } const boothValue = String(booths.find((item) => item.label === option)?.value || ''); const nextIds = selectedBoothLabels.includes(option) ? form.boothIds.filter((id) => String(id) !== boothValue) : form.boothIds.concat(boothValue); handleChange('boothIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => {}} disabled={!form.wardIds.length} />
                  {!form.wardIds.length ? <p className="mobile-web-helper">Select a ward to load booths.</p> : null}
                </div>
              </>
            ) : null}
            {form.workingLevel === 'BOOTH' ? (
              <>
                <div className="mobile-web-field">
                  <label>Assembly</label>
                  <SingleOptionSelect label="Assembly" options={assemblies.map((item) => item.label)} value={selectedAssemblyLabel} customValue="" onSelect={(option) => handleChange('assemblyId', assemblies.find((item) => item.label === option)?.value || '')} onCustomValueChange={() => {}} />
                </div>
                <div className="mobile-web-field">
                  <label>Ward</label>
                  <MultiCheckboxSelect label="Ward" options={['All Wards', ...wardOptions]} value={allWardsSelected ? selectedWardLabels.concat('All Wards') : selectedWardLabels} customValue="" onToggle={(option) => { if (option === 'All Wards') { const nextIds = allWardsSelected ? [] : allWardLabels; handleChange('wardIds', nextIds); return; } const wardValue = String(wards.find((item) => item.label === option)?.value || ''); const nextIds = selectedWardLabels.includes(option) ? form.wardIds.filter((id) => String(id) !== wardValue) : form.wardIds.concat(wardValue); handleChange('wardIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => {}} disabled={!form.assemblyId} />
                  {!form.assemblyId ? <p className="mobile-web-helper">Select an assembly to load wards.</p> : null}
                </div>
                <div className="mobile-web-field">
                  <label>Booth</label>
                  <MultiCheckboxSelect label="Booth" options={['All Booths', ...boothOptions]} value={allBoothsSelected ? selectedBoothLabels.concat('All Booths') : selectedBoothLabels} customValue="" onToggle={(option) => { if (option === 'All Booths') { const nextIds = allBoothsSelected ? [] : allBoothLabels; handleChange('boothIds', nextIds); return; } const boothValue = String(booths.find((item) => item.label === option)?.value || ''); const nextIds = selectedBoothLabels.includes(option) ? form.boothIds.filter((id) => String(id) !== boothValue) : form.boothIds.concat(boothValue); handleChange('boothIds', nextIds.filter(Boolean)); }} onCustomValueChange={() => {}} disabled={!form.wardIds.length} />
                  {!form.wardIds.length ? <p className="mobile-web-helper">Select a ward to load booths.</p> : null}
                </div>
              </>
            ) : null}
          </div>
          <div className="mobile-web-actions">
            <button className="mobile-web-secondary-btn" type="button" onClick={handleReset}>Reset</button>
            <button className="mobile-web-primary-btn" type="button" onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting...' : 'Submit'}</button>
          </div>
          {feedback.error ? <p className="mobile-web-error">{feedback.error}</p> : null}
          {feedback.success ? <p className="mobile-web-success">{feedback.success}</p> : null}
        </div>
      </section>
    </ScreenFrame>
  );
}
function MyVolunteersScreen() { const [volunteers, setVolunteers] = useState([]); const [search, setSearch] = useState(''); const [workingLevel, setWorkingLevel] = useState(''); const [loading, setLoading] = useState(false); const [selected, setSelected] = useState([]); const [feedback, setFeedback] = useState({ error: '', success: '' }); const userInfo = useMemo(() => getUserInfoSafe(), []); const role = userInfo?.role || 'ADMIN'; const loadVolunteers = async () => { setLoading(true); setFeedback({ error: '', success: '' }); try { const res = await mobileApi.getVolunteerList(role, 0, 50, search, '', 'firstName', 'desc', workingLevel); const list = res?.content ?? []; setVolunteers(list); } catch (error) { setFeedback({ error: error?.message || 'Unable to load volunteers.', success: '' }); } finally { setLoading(false); } }; useEffect(() => { loadVolunteers(); }, [search, workingLevel]); const toggleSelect = (email) => { setSelected((prev) => prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]); }; const handleBlock = async (email, block) => { try { await mobileApi.blockVolunteer({ userEmail: email, block }); await loadVolunteers(); } catch { setFeedback({ error: 'Unable to update volunteer.', success: '' }); } }; const handleDelete = async (email, del) => { try { await mobileApi.removeVolunteer({ userEmail: email, delete: del }); await loadVolunteers(); } catch { setFeedback({ error: 'Unable to update volunteer.', success: '' }); } }; const handleBulkDelete = async () => { if (selected.length === 0) return; try { await mobileApi.bulkRemoveVolunteer({ userEmails: selected, action: true }); setSelected([]); await loadVolunteers(); } catch { setFeedback({ error: 'Unable to delete volunteers.', success: '' }); } }; const handleBulkBlock = async () => { if (selected.length === 0) return; try { await mobileApi.bulkBlockVolunteer({ userEmails: selected, action: true }); setSelected([]); await loadVolunteers(); } catch { setFeedback({ error: 'Unable to block volunteers.', success: '' }); } }; const levelOptions = [{ label: 'All Levels', value: '' }, { label: 'Assembly', value: 'ASSEMBLY' }, { label: 'Ward', value: 'WARD' }, { label: 'Booth', value: 'BOOTH' }]; const selectedLevelLabel = levelOptions.find((item) => item.value === workingLevel)?.label || ''; return <ScreenFrame accent="light"><section className="mobile-web-card"><MobileHeader title="My Volunteers" subtitle="Search and manage volunteer profiles." onBack={() => { if (typeof window !== 'undefined') window.history.back(); }} /><div className="mobile-web-stack"><div className="mobile-web-form-grid"><div className="mobile-web-field"><label>Search</label><input className="mobile-web-input" placeholder="Search by name / phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="mobile-web-field"><label>Working Level</label><SingleOptionSelect label="Working Level" options={levelOptions.map((item) => item.label)} value={selectedLevelLabel} customValue="" onSelect={(option) => setWorkingLevel(levelOptions.find((item) => item.label === option)?.value ?? '')} onCustomValueChange={() => {}} /></div></div>{loading ? <div className="mobile-web-empty">Loading volunteers...</div> : null}{!loading && volunteers.length === 0 ? <div className="mobile-web-empty">No volunteers found.</div> : null}{!loading && volunteers.length > 0 ? <div className="mobile-web-stack">{volunteers.map((v) => { const deleted = v.deleted === true || v.deleted === 'true' || v.deleted === 1; const blocked = v.blocked === true || v.blocked === 'true' || v.blocked === 1; const name = `${v.firstName || ''} ${v.lastName || ''}`.trim() || v.userName || 'Volunteer'; return <div key={v.userName || v.phone || name} className="mobile-web-summary-card"><h3>{name}</h3><p><span>Phone: <strong>{v.phone || '-'}</strong></span><span>Level: <strong>{v.assignmentType || '-'}</strong></span><span>Status: <strong>{deleted ? 'Deleted' : blocked ? 'Blocked' : 'Active'}</strong></span></p><div className="mobile-web-actions"><label className="mobile-web-secondary-btn"><input type="checkbox" checked={selected.includes(v.userName)} onChange={() => toggleSelect(v.userName)} /> Select</label><button className="mobile-web-secondary-btn" type="button" onClick={() => handleDelete(v.userName, !deleted)}>{deleted ? 'Undelete' : 'Delete'}</button><button className="mobile-web-primary-btn" type="button" onClick={() => handleBlock(v.userName, !blocked)}>{blocked ? 'Unblock' : 'Block'}</button></div></div>; })}</div> : null}<div className="mobile-web-actions"><button className="mobile-web-secondary-btn" type="button" onClick={handleBulkDelete} disabled={selected.length === 0}>Delete Selected</button><button className="mobile-web-primary-btn" type="button" onClick={handleBulkBlock} disabled={selected.length === 0}>Block Selected</button></div>{feedback.error ? <p className="mobile-web-error">{feedback.error}</p> : null}{feedback.success ? <p className="mobile-web-success">{feedback.success}</p> : null}</div></section></ScreenFrame>; }
export default function MobileDetailPage({ params }) { const slug = params.slug; const screen = labels[slug] || { title: 'Mobile Screen', description: 'This mobile module is being converted for the web experience.' }; if (slug === 'search-voter') return <SearchVoterScreen />; if (slug === 'search-booth') return <SearchBoothScreen />; if (slug === 'add-volunteer') return <AddVolunteerScreen />; if (slug === 'my-volunteers') return <MyVolunteersScreen />; return <ScreenFrame><section className="mobile-web-card"><p className="text-slate-600">{screen.description}</p><p className="text-slate-500 mt-3">Search Booth and Search Voter now support booth list, voter list, and voter info drill-down.</p><div className="mt-4"><Link href="/mobile/search-voter" className="mobile-web-primary-btn">Go to Search Voter</Link></div></section></ScreenFrame>; }
