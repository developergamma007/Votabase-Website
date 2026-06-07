const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const DEFAULT_ASSEMBLY_CODE = process.env.NEXT_PUBLIC_DEFAULT_ASSEMBLY_CODE || '000000000151';
const _apiCache = {};

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('X_INIT_TOKEN') || localStorage.getItem('token') || '';
}

export function getUserInfoFromStorage() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('userInfo') || '{}');
  } catch {
    return {};
  }
}

function userHasAssignmentScope(userInfo = {}) {
  const role = String(userInfo.role || '').replace('ROLE_', '').toUpperCase();
  if (['SUPER_ADMIN', 'ADMIN'].includes(role)) return true;
  if (Array.isArray(userInfo.wardIds) && userInfo.wardIds.length > 0) return true;
  if (Array.isArray(userInfo.boothIds) && userInfo.boothIds.length > 0) return true;
  if (Array.isArray(userInfo.assemblyIds) && userInfo.assemblyIds.length > 0) return true;
  if (userInfo.wardId != null && String(userInfo.wardId).trim() !== '') return true;
  if (userInfo.boothId != null && String(userInfo.boothId).trim() !== '') return true;
  if (userInfo.assignmentId != null && String(userInfo.assignmentId).trim() !== '') return true;
  return false;
}

let profileBootstrapPromise = null;

/** Load /me when login storage lacks ward/booth scope (first open after login). */
export async function ensureUserProfileReady() {
  if (typeof window === 'undefined') return getUserInfoFromStorage();
  const cached = getUserInfoFromStorage();
  if (!cached?.token) return cached;
  if (userHasAssignmentScope(cached)) return cached;
  if (!profileBootstrapPromise) {
    profileBootstrapPromise = request('/votebase/v1/api/me')
      .then((res) => {
        const updated = res?.data?.result || res?.result || res;
        if (updated && typeof updated === 'object') {
          const merged = { ...cached, ...updated };
          localStorage.setItem('userInfo', JSON.stringify(merged));
          return merged;
        }
        return cached;
      })
      .catch(() => cached)
      .finally(() => {
        profileBootstrapPromise = null;
      });
  }
  return profileBootstrapPromise;
}

export function parseVoterSearchResponse(payload) {
  const data = payload?.data ?? payload ?? {};
  const results = Array.isArray(data?.result)
    ? data.result
    : (Array.isArray(data) ? data : (Array.isArray(payload?.result) ? payload.result : []));
  const meta = data?.meta ?? payload?.meta ?? {};
  return { results, meta };
}

export function getAssemblyCode() {
  if (typeof window === 'undefined') return DEFAULT_ASSEMBLY_CODE;

  const explicit = localStorage.getItem('assemblyCode');
  if (explicit) return explicit;

  try {
    const userInfo = getUserInfoFromStorage();
    const assemblyIds = Array.isArray(userInfo.assemblyIds) ? userInfo.assemblyIds : [];
    if (assemblyIds.length > 0 && assemblyIds[0] != null && String(assemblyIds[0]).trim() !== '') {
      return String(assemblyIds[0]).trim();
    }
    const assignmentType = String(userInfo.assignmentType || '').toUpperCase();
    if (assignmentType === 'ASSEMBLY' && userInfo.assignmentId != null && String(userInfo.assignmentId).trim() !== '') {
      return String(userInfo.assignmentId).trim();
    }
    return (
      userInfo.assemblyCode ||
      userInfo.assemblyNo ||
      (assignmentType !== 'WARD' && assignmentType !== 'BOOTH' ? userInfo.assignmentId : null) ||
      DEFAULT_ASSEMBLY_CODE
    );
  } catch {
    return DEFAULT_ASSEMBLY_CODE;
  }
}

function buildHeaders(options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detailText = payload?.detail != null ? String(payload.detail) : '';
    const isAccountBlocked =
      detailText === 'Please contact Admin'
      || /blocked|contact admin/i.test(detailText);
    // Only force logout for account-level blocks — not feature 403s (e.g. family analysis).
    if (response.status === 403 && isAccountBlocked) {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        document.cookie = 'token=; path=/; max-age=0';
        window.location.href = '/ui/login?error=' + encodeURIComponent('Please contact Admin');
      }
    }
    throw payload;
  }

  if (payload && typeof payload === 'object' && payload.success === false) {
    if (payload.detail === 'Please contact Admin' && typeof window !== 'undefined') {
      localStorage.clear();
      document.cookie = 'token=; path=/; max-age=0';
      window.location.href = '/ui/login?error=' + encodeURIComponent('Please contact Admin');
    }
    throw payload;
  }

  return payload;
}

function qs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

const PUBLIC_VOTER_UPDATE_FIELDS = new Set([
  'mobile',
  'dob',
  'community',
  'caste',
  'motherTongue',
  'education',
  'residenceType',
  'ownership',
  'voterPoints',
  'govtSchemeTracking',
  'engagementPotential',
  'ifShifted',
  'status',
  'civicIssue',
  'natureOfVoter',
  'notes',
  'presentAddress',
  'newWard',
  'newBoothNo',
  'newSerialNo',
  'notAvailableReason',
  'latitude',
  'longitude',
  'gender',
  'age',
  'houseNoEn',
  'houseNoLocal',
  'firstMiddleNameEn',
  'lastNameEn',
  'firstMiddleNameLocal',
  'lastNameLocal',
  'addressEn',
  'addressLocal',
  'relationFirstMiddleNameEn',
  'relationLastNameEn',
  'relationFirstMiddleNameLocal',
  'relationLastNameLocal',
  'relationType',
  'team',
]);

function buildPublicVoterUpdatePayload(jsonReq = {}, options = {}) {
  const updateRequest = Object.entries(jsonReq?.updateRequest || {}).reduce((acc, [key, value]) => {
    if (PUBLIC_VOTER_UPDATE_FIELDS.has(key)) acc[key] = value;
    return acc;
  }, {});

  return {
    wardCode: options.wardCode || undefined,
    boothNo: options.boothNo != null ? String(options.boothNo) : undefined,
    updateRequest,
  };
}

export const mobileApi = {
  fetchMe: async () => {
    return await request('/votebase/v1/api/me');
  },
  getBoothList: async (assemblyCode = getAssemblyCode() || DEFAULT_ASSEMBLY_CODE) => {
    const res = await mobileApi.loadDataLite(assemblyCode);
    if (res?.snapshotMode === 'link' && typeof res?.data?.result === 'string') {
      const response = await fetch(res.data.result, { headers: buildHeaders({}) });
      const payload = await response.json();
      return payload;
    }
    return res;
  },
  loginApi: async (data) => {
    try {
      return await request('/votebase/v1/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      return error?.message ? error.message : error;
    }
  },

  loadData: async (assemblyCode = getAssemblyCode() || DEFAULT_ASSEMBLY_CODE) => {
    try {
      return await request(
        `/votebase/v1/api/voters/snapshot?assemblyCode=${encodeURIComponent(assemblyCode)}`
      );
    } catch (error) {
      console.log('Load data API Error:', error);
      throw error;
    }
  },

  loadDataLite: async (assemblyCode = getAssemblyCode() || DEFAULT_ASSEMBLY_CODE) => {
    try {
      return await request(
        `/votebase/v1/api/voters/snapshot?assemblyCode=${encodeURIComponent(assemblyCode)}&includeVoters=false`
      );
    } catch (error) {
      console.log('Load lite data API Error:', error);
      throw error;
    }
  },

  fetchBoothVoters: async (boothId, wardId = null, boothNo = null) => {
    try {
      const params = new URLSearchParams({ boothId: String(boothId) });
      if (wardId != null && wardId !== '') params.set('wardId', String(wardId));
      if (boothNo != null && boothNo !== '') params.set('boothNo', String(boothNo));
      return await request(`/votebase/v1/api/voters/by-booth?${params.toString()}`);
    } catch (error) {
      console.log('Fetch booth voters API Error:', error);
      throw error;
    }
  },

  searchVoters: async (params = {}) => {
    try {
      const query = {
        assemblyCode: params.assemblyCode || getAssemblyCode() || DEFAULT_ASSEMBLY_CODE,
        page: params.page ?? 0,
        size: params.size ?? 500,
      };

      if (params.searchQuery?.trim()) query.searchQuery = params.searchQuery.trim();
      if (params.wardId !== undefined && params.wardId !== null && String(params.wardId).trim() !== '') {
        query.wardId = Number(params.wardId);
      }
      if (params.boothNumber?.trim()) query.boothNumber = params.boothNumber.trim();
      if (params.mobileNumber?.trim()) query.mobileNumber = params.mobileNumber.trim();
      if (params.epicId?.trim()) query.epicId = params.epicId.trim();
      if (params.relationName?.trim()) query.relationName = params.relationName.trim();
      if (params.houseNumber?.trim()) query.houseNumber = params.houseNumber.trim();

      return await request(`/votebase/v1/api/voter-search${qs(query)}`);
    } catch (error) {
      console.log('Search voters API Error:', error);
      throw error;
    }
  },

  updateVoter: async (epicNo, jsonReq, options = {}) => {
    try {
      return await request(`/votebase/v1/api/voters/by-epic/${encodeURIComponent(epicNo)}`, {
        method: 'PUT',
        body: JSON.stringify(buildPublicVoterUpdatePayload(jsonReq, options)),
      });
    } catch (error) {
      console.log('Update Voter API Error:', error);
      throw error;
    }
  },

  getUserProfile: async () => {
    try {
      return await request('/votebase/v1/api/user/profile');
    } catch (error) {
      console.log('Error while fetching user profile data:', error);
      throw error;
    }
  },

  updateUserProfile: async (jsonReq) => {
    try {
      const payload = {
        firstName: jsonReq?.firstName,
        phone: jsonReq?.phone,
      };
      if (jsonReq?.profilePicUrl) payload.profilePicUrl = jsonReq.profilePicUrl;
      if (jsonReq?.tenantId != null) payload.tenantId = jsonReq.tenantId;
      if (jsonReq?.role) payload.role = jsonReq.role;
      return await request('/votebase/v1/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.log('Error while updating profile info:', error);
      throw error;
    }
  },

  uploadUserProfilePic: async (formData) => {
    try {
      return await request('/votebase/v1/api/user/profile/upload', {
        method: 'POST',
        body: formData,
      });
    } catch (error) {
      console.log('Error while uploading profile info:', error);
      throw error;
    }
  },

  getVolunteerList: async (role, page, size, search, blocked, sortBy, direction, assignmentType, deleted, assemblyId) => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      params.set('search', String(search || ''));
      params.set('blocked', String(blocked || ''));
      params.set('sortBy', String(sortBy));
      params.set('direction', String(direction));
      params.set('workingLevel', String(assignmentType || ''));
      params.set('deleted', String(deleted ?? ''));
      if (assemblyId) params.set('assemblyCode', String(assemblyId));
      return await request(`/votebase/v1/api/volunteers?${params.toString()}`);
    } catch (error) {
      console.log('Error while fetching volunteer data:', error);
      throw error;
    }
  },
  downloadDbDump: async () => {
    const response = await fetch(`${API_BASE_URL}/votebase/v1/api/admin/db-dump`, {
      headers: buildHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
    return response;
  },
  fetchVolunteerEnrichmentDetails: async (wardId, updatedFrom, updatedTo, page, size, assemblyCode) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (assemblyCode) params.set('assemblyCode', String(assemblyCode));
      if (updatedFrom) params.set('updatedFrom', String(updatedFrom));
      if (updatedTo) params.set('updatedTo', String(updatedTo));
      if (page !== undefined) params.set('page', String(page));
      if (size !== undefined) params.set('size', String(size));
      const qs = params.toString();
      return await request(`/votebase/v1/api/volunteers/analysis/enrichment${qs ? `?${qs}` : ''}`);
    } catch (error) {
      console.log('Error while fetching volunteer enrichment details:', error);
      throw error;
    }
  },

  addVolunteer: async (data) => {
    try {
      return await request('/votebase/v1/api/volunteers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.log('Error while adding volunteer:', error);
      throw error;
    }
  },
  updateVolunteer: async (data) => {
    try {
      return await request('/votebase/v1/api/volunteers', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.log('Error while updating volunteer:', error);
      throw error;
    }
  },

  blockVolunteer: async (jsonReq) => {
    try {
      return await request('/votebase/v1/api/user/block', {
        method: 'PUT',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while blocking volunteer:', error);
      throw error;
    }
  },

  removeVolunteer: async (jsonReq) => {
    try {
      return await request('/votebase/v1/api/user/delete', {
        method: 'PUT',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while deleting volunteer:', error);
      throw error;
    }
  },

  bulkRemoveVolunteer: async (jsonReq) => {
    try {
      return await request('/votebase/v1/api/user/delete/bulk', {
        method: 'PUT',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while updating bulk remove volunteer:', error);
      throw error;
    }
  },

  bulkBlockVolunteer: async (jsonReq) => {
    try {
      return await request('/votebase/v1/api/user/block/bulk', {
        method: 'PUT',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while blocking bulk volunteers:', error);
      throw error;
    }
  },

  fetchBoothIds: async () => {
    try {
      return await request('/votebase/v1/api/booth');
    } catch (error) {
      console.log('Error while fetching booth ids:', error);
      throw error;
    }
  },
  fetchAssignments: async (type) => {
    try {
      return await request(`/votebase/v1/api/assignments?type=${encodeURIComponent(type)}`);
    } catch (error) {
      console.log('Error while fetching assignments:', error);
      throw error;
    }
  },
  fetchVolunteerDropdown: async (level, parentId) => {
    try {
      const query = parentId ? `?level=${encodeURIComponent(level)}&parentId=${encodeURIComponent(parentId)}` : `?level=${encodeURIComponent(level)}`;
      return await request(`/votebase/v1/api/volunteers/dropdown${query}`);
    } catch (error) {
      console.log('Error while fetching volunteer dropdown:', error);
      throw error;
    }
  },
  resolveAssemblyName: async (assemblyId) => {
    const params = new URLSearchParams();
    if (assemblyId != null && String(assemblyId).trim() !== '') {
      params.set('assemblyId', String(assemblyId).trim());
    }
    const query = params.toString();
    return request(`/votebase/v1/api/assemblies/resolve-name${query ? `?${query}` : ''}`);
  },
  fetchVolunteerAnalysis: async (wardId, mode, assemblyCode) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (mode) params.set('mode', String(mode));
      if (assemblyCode) params.set('assemblyCode', String(assemblyCode));
      const query = params.toString();
      return await request(`/votebase/v1/api/volunteers/analysis${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching volunteer analysis:', error);
      throw error;
    }
  },
  fetchFamilyAnalysis: async (wardId, boothId, mode, updatedFrom, updatedTo, assemblyCode) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (boothId) params.set('boothId', String(boothId));
      if (mode) params.set('mode', String(mode));
      // Ward filter is enough; skip assembly when ward is set (matches backend list logic).
      if (assemblyCode && !wardId) params.set('assemblyCode', String(assemblyCode));
      if (updatedFrom) params.set('updatedFrom', String(updatedFrom));
      if (updatedTo) params.set('updatedTo', String(updatedTo));
      const query = params.toString();
      return await request(`/votebase/v1/api/families/analysis${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching family analysis:', error);
      throw error;
    }
  },
  fetchFamilyDetails: async (wardId, boothId, updatedFrom, updatedTo, page, size, assemblyCode) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (boothId) params.set('boothId', String(boothId));
      if (assemblyCode && !wardId) params.set('assemblyCode', String(assemblyCode));
      if (updatedFrom) params.set('updatedFrom', String(updatedFrom));
      if (updatedTo) params.set('updatedTo', String(updatedTo));
      if (page !== undefined) params.set('page', String(page));
      if (size !== undefined) params.set('size', String(size));
      const query = params.toString();
      return await request(`/votebase/v1/api/families/details${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching family details:', error);
      throw error;
    }
  },
  fetchVolunteerLocationPoints: async (wardId, assemblyCode) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (assemblyCode) params.set('assemblyCode', String(assemblyCode));
      const query = params.toString();
      return await request(`/votebase/v1/api/volunteers/analysis/locations${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching volunteer map locations:', error);
      throw error;
    }
  },
  fetchFamilyLocationPoints: async (wardId, boothId, wardCode, assemblyCode, updatedFrom, updatedTo) => {
    const wardIdStr = wardId != null && String(wardId).trim() !== '' ? String(wardId) : '';
    const wardCodeStr = wardCode != null && String(wardCode).trim() !== '' ? String(wardCode).trim() : '';
    const filterPoints = (rows, { trustServerWardScope = false } = {}) =>
      (Array.isArray(rows) ? rows : []).filter((item) => {
        const lat = Number(item?.latitude);
        const lng = Number(item?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return false;
        if (trustServerWardScope || (!wardIdStr && !wardCodeStr)) return true;
        const itemWardId = String(item?.wardId ?? item?.ward_id ?? '').trim();
        const itemWardCode = String(item?.wardCode ?? item?.ward_code ?? '').trim();
        if (wardIdStr && itemWardId === wardIdStr) return true;
        if (wardCodeStr && itemWardCode === wardCodeStr) return true;
        return false;
      });
    try {
      const params = new URLSearchParams();
      if (wardIdStr) params.set('wardId', wardIdStr);
      if (boothId != null && String(boothId).trim() !== '') params.set('boothId', String(boothId));
      if (assemblyCode != null && String(assemblyCode).trim() !== '' && !wardIdStr) {
        params.set('assemblyCode', String(assemblyCode));
      }
      if (updatedFrom) params.set('updatedFrom', String(updatedFrom));
      if (updatedTo) params.set('updatedTo', String(updatedTo));
      const query = params.toString();
      const res = await request(`/votebase/v1/api/families/map-points${query ? `?${query}` : ''}`);
      const payload = res?.data?.result ?? res?.result ?? [];
      return { data: { result: filterPoints(payload, { trustServerWardScope: Boolean(wardIdStr || boothId) }) } };
    } catch (apiErr) {
      console.warn('Family map-points API fallback to family list.', apiErr);
      try {
        const rows = await mobileApi.fetchAllFamilies(undefined, boothId, wardId, assemblyCode);
        return { data: { result: filterPoints(rows) } };
      } catch (error) {
        console.log('Error while fetching family map locations:', error);
        throw error;
      }
    }
  },
  fetchWards: async (assemblyId) => {
    const url = assemblyId ? `/votebase/v1/api/wards?assemblyId=${encodeURIComponent(assemblyId)}` : '/votebase/v1/api/wards';
    if (_apiCache[url]) return _apiCache[url];
    try {
      const res = await request(url);
      _apiCache[url] = res;
      return res;
    } catch (error) {
      console.log('Error while fetching wards:', error);
      throw error;
    }
  },
  fetchBooths: async (assemblyCode, wardId) => {
    const params = new URLSearchParams();
    if (assemblyCode) params.set('assemblyCode', String(assemblyCode));
    if (wardId) params.set('wardId', String(wardId));
    const qs = params.toString();
    const url = `/votebase/v1/api/booths${qs ? `?${qs}` : ''}`;
    if (_apiCache[url]) return _apiCache[url];
    try {
      const res = await request(url);
      _apiCache[url] = res;
      return res;
    } catch (error) {
      console.log('Error while fetching booths:', error);
      throw error;
    }
  },
  fetchPublicBooths: async (wardId, assemblyId) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (assemblyId) params.set('assemblyId', String(assemblyId));
      const query = params.toString();
      return await request(`/votebase/v1/api/booths/public${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching public booths:', error);
      throw error;
    }
  },

  fetchFamilies: async (hasAssociation, page, size, boothId, wardId, assemblyCode) => {
    try {
      const params = { page, size };
      if (boothId !== undefined && boothId !== null && String(boothId).trim() !== '') {
        params.boothId = boothId;
      }
      if (wardId !== undefined && wardId !== null && String(wardId).trim() !== '') {
        params.wardId = Number(wardId);
      }
      if (assemblyCode !== undefined && assemblyCode !== null && String(assemblyCode).trim() !== '') {
        params.assemblyCode = String(assemblyCode);
      }
      if (hasAssociation !== undefined && hasAssociation !== null && String(hasAssociation).trim() !== '') {
        params.association = hasAssociation;
      }
      return await request(`/votebase/v1/api/family${qs(params)}`);
    } catch (error) {
      console.log('Error while fetching families:', error);
      throw error;
    }
  },
  fetchAllFamilies: async (hasAssociation, boothId, wardId, assemblyCode) => {
    const size = 200;
    let page = 0;
    let all = [];
    while (page < 100) {
      const res = await mobileApi.fetchFamilies(hasAssociation, page, size, boothId, wardId, assemblyCode);
      const chunk =
        res?.content ||
        res?.data?.content ||
        res?.data?.result ||
        res?.result ||
        res?.data ||
        [];
      const list = Array.isArray(chunk) ? chunk : [];
      all = all.concat(list);
      if (list.length < size) break;
      page += 1;
    }
    return all;
  },
  fetchFamilySuggestions: async (type) => {
    try {
      return await request(`/votebase/v1/api/family/suggestions?type=${encodeURIComponent(type)}`);
    } catch (error) {
      console.log('Error while fetching family suggestions:', error);
      throw error;
    }
  },
  fetchMessageTemplate: async (wardId, channel, epicNo = null) => {
    try {
      const params = new URLSearchParams();
      if (wardId !== undefined && wardId !== null && wardId !== '') params.set('wardId', wardId);
      if (channel) params.set('channel', channel);
      if (epicNo) params.set('epicNo', epicNo);
      const query = params.toString();
      return await request(`/votebase/v1/api/message-template${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching message template:', error);
      throw error;
    }
  },
  verifyVoterActivation: async (epicNo) => {
    try {
      return await request(`/votebase/v1/api/voter-activation/verify?epicNo=${encodeURIComponent(epicNo)}`);
    } catch (error) {
      console.log('Error while verifying voter activation:', error);
      throw error;
    }
  },
  fetchActivatedWards: async (assemblyId) => {
    try {
      const query = assemblyId ? `?assemblyId=${encodeURIComponent(assemblyId)}` : '';
      return await request(`/votebase/v1/api/message-template/activated-wards${query}`);
    } catch (error) {
      console.log('Error while fetching activated wards:', error);
      throw error;
    }
  },
  saveMessageTemplate: async (payload) => {
    try {
      return await request('/votebase/v1/api/message-template', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.log('Error while saving message template:', error);
      throw error;
    }
  },
  uploadMessageTemplateBanner: async ({ wardId, channel, file }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams();
      if (wardId !== undefined && wardId !== null && wardId !== '') params.set('wardId', wardId);
      if (channel) params.set('channel', channel);
      const query = params.toString();
      return await request(`/votebase/v1/api/message-template/banner${query ? `?${query}` : ''}`, {
        method: 'POST',
        body: formData,
      });
    } catch (error) {
      console.log('Error while uploading message template banner:', error);
      throw error;
    }
  },

  fetchAssociations: async (boothId) => {
    try {
      return await request(`/votebase/v1/api/association?boothId=${encodeURIComponent(boothId)}`);
    } catch (error) {
      console.log('Error while fetching associations:', error);
      throw error;
    }
  },

  createFamily: async (jsonReq) => {
    try {
      return await request('/votebase/v1/api/family', {
        method: 'POST',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while creating family:', error);
      throw error;
    }
  },

  fetchFamilyById: async (id) => {
    try {
      return await request(`/votebase/v1/api/family/${encodeURIComponent(id)}`);
    } catch (error) {
      console.log('Error while fetching family:', error);
      throw error;
    }
  },

  updateFamily: async (id, jsonReq) => {
    try {
      return await request(`/votebase/v1/api/family/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while updating family:', error);
      throw error;
    }
  },

  createMeeting: async (jsonReq) => {
    try {
      return await request('/votebase/v1/api/meetings', {
        method: 'POST',
        body: JSON.stringify(jsonReq),
      });
    } catch (error) {
      console.log('Error while creating meeting:', error);
      throw error;
    }
  },

  fetchMeetings: async () => {
    try {
      return await request('/votebase/v1/api/meetings');
    } catch (error) {
      console.log('Error while fetching meetings:', error);
      throw error;
    }
  },

  recordMeetingAttendance: async (id) => {
    try {
      return await request(`/votebase/v1/api/meetings/${id}/attendance`, { method: 'POST' });
    } catch (error) {
      console.log('Error while recording meeting attendance:', error);
      throw error;
    }
  },
  attendMeetingSelf: async (id, lat, lng) => {
    try {
      let url = `/votebase/v1/api/meetings/${id}/attend-self`;
      if (lat !== null && lng !== null && lat !== undefined && lng !== undefined) {
        url += `?lat=${lat}&lng=${lng}`;
      }
      return await request(url, { method: 'POST' });
    } catch (error) {
      console.log('Error while recording self attendance:', error);
      throw error;
    }
  },

  fetchMeetingAttendance: async (id) => {
    try {
      return await request(`/votebase/v1/api/meetings/${encodeURIComponent(id)}/attendance`);
    } catch (error) {
      console.log('Error while fetching meeting attendance:', error);
      throw error;
    }
  },

  deleteFamily: async (id) => {
    try {
      return await request(`/votebase/v1/api/family/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.log('Error while deleting family:', error);
      throw error;
    }
  },
  deactivateAllTemplates: async (channel) => {
    const tenantId = typeof window !== 'undefined' ? (localStorage.getItem('tenantId') || localStorage.getItem('tenant_id')) : '';
    return await request(`/votebase/v1/api/message-template/deactivate-all?channel=${channel.toUpperCase()}&tenantId=${tenantId || ''}`, {
      method: 'POST'
    });
  },
  fetchMasterRollImportStatus: async () => {
    return await request('/votebase/v1/api/admin/master-roll/import-status');
  },
  uploadMasterRoll: async (file, callbacks = {}) => {
    const { onUploadProgress, onProcessingStart } = callbacks;
    const token = getToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/votebase/v1/api/admin/master-roll/upload`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 0;

      let processingStarted = false;
      const beginProcessing = () => {
        if (processingStarted) return;
        processingStarted = true;
        if (onProcessingStart) onProcessingStart();
      };

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          if (onUploadProgress) onUploadProgress(percent);
          if (percent >= 100) beginProcessing();
        } else if (onUploadProgress) {
          onUploadProgress(5);
        }
      };

      xhr.upload.onload = () => beginProcessing();

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
            return;
          }
          const errMsg =
            res?.data?.error ||
            res?.message ||
            res?.detail ||
            `Upload failed (HTTP ${xhr.status})`;
          reject({ message: errMsg, raw: res });
        } catch (err) {
          reject({ message: xhr.responseText || 'Server error while importing master roll' });
        }
      };

      xhr.onerror = () =>
        reject({
          message:
            'Network error — ensure votabase-backend is running (http://127.0.0.1:8000) and NEXT_PUBLIC_API_BASE_URL matches.',
        });

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  },

  resumeMasterRoll: async (file, callbacks = {}) => {
    const { onUploadProgress, onProcessingStart } = callbacks;
    const token = getToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/votebase/v1/api/admin/master-roll/upload?resume=true`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 0;

      let processingStarted = false;
      const beginProcessing = () => {
        if (processingStarted) return;
        processingStarted = true;
        if (onProcessingStart) onProcessingStart();
      };

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          if (onUploadProgress) onUploadProgress(percent);
          if (percent >= 100) beginProcessing();
        } else if (onUploadProgress) {
          onUploadProgress(5);
        }
      };

      xhr.upload.onload = () => beginProcessing();

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
            return;
          }
          const errMsg =
            res?.data?.error ||
            res?.message ||
            res?.detail ||
            `Resume failed (HTTP ${xhr.status})`;
          reject({ message: errMsg, raw: res });
        } catch {
          reject({ message: xhr.responseText || 'Server error while resuming master roll' });
        }
      };

      xhr.onerror = () =>
        reject({
          message:
            'Network error — ensure votabase-backend is running and NEXT_PUBLIC_API_BASE_URL matches.',
        });

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  },

  fetchPollDayConfig: async (assemblyId, wardId) => {
    try {
      const params = new URLSearchParams();
      if (assemblyId) params.set('assemblyId', assemblyId);
      if (wardId) params.set('wardId', wardId);
      return await request(`/votebase/v1/api/poll-day/config?${params.toString()}`);
    } catch (error) {
      console.log('Error while fetching poll day config:', error);
      throw error;
    }
  },

  updatePollDayConfig: async (assemblyId, wardId, enabled) => {
    try {
      return await request('/votebase/v1/api/poll-day/config', {
        method: 'POST',
        body: JSON.stringify({ assemblyId, wardId, enabled }),
      });
    } catch (error) {
      console.log('Error while updating poll day config:', error);
      throw error;
    }
  },

  updateVoterStatus: async (epic, status, wardCode, boothNo) => {
    try {
      return await request(`/votebase/v1/api/voters/by-epic/${encodeURIComponent(epic)}`, {
        method: 'PUT',
        body: JSON.stringify({
          wardCode,
          boothNo,
          updateRequest: { status }
        }),
      });
    } catch (error) {
      console.log('Error while updating voter status:', error);
      throw error;
    }
  },
};

export const CRUDAPI = mobileApi;
