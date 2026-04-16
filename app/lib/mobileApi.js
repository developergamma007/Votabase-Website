const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const DEFAULT_ASSEMBLY_CODE = process.env.NEXT_PUBLIC_DEFAULT_ASSEMBLY_CODE || '000000000151';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('X_INIT_TOKEN') || localStorage.getItem('token') || '';
}

export function getAssemblyCode() {
  if (typeof window === 'undefined') return DEFAULT_ASSEMBLY_CODE;

  const explicit = localStorage.getItem('assemblyCode');
  if (explicit) return explicit;

  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    return (
      userInfo.assemblyCode ||
      userInfo.assemblyNo ||
      userInfo.assignmentId ||
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
    // Check for blocked/deleted user status (403 or specific message)
    if (response.status === 403 || (payload && (payload.detail === 'Please contact Admin' || String(payload.detail).includes('blocked')))) {
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

  fetchBoothVoters: async (boothId) => {
    try {
      return await request(`/votebase/v1/api/voters/by-booth?boothId=${encodeURIComponent(boothId)}`);
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
      return await request('/votebase/v1/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(jsonReq),
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

  getVolunteerList: async (role, page, size, search, blocked, sortBy, direction, assignmentType, deleted) => {
    try {
      return await request(
        `/votebase/v1/api/volunteers?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}&search=${encodeURIComponent(search)}&blocked=${encodeURIComponent(blocked)}&sortBy=${encodeURIComponent(sortBy)}&direction=${encodeURIComponent(direction)}&workingLevel=${encodeURIComponent(assignmentType)}&deleted=${encodeURIComponent(deleted ?? '')}`
      );
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
  fetchVolunteerEnrichmentDetails: async (wardId, updatedFrom, updatedTo, page, size) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
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
      return error?.message ? error.message : error;
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
      return error?.message ? error.message : error;
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
  fetchVolunteerAnalysis: async (wardId, mode) => {
    try {
      const params = new URLSearchParams();
      if (wardId) params.set('wardId', String(wardId));
      if (mode) params.set('mode', String(mode));
      const query = params.toString();
      return await request(`/votebase/v1/api/volunteers/analysis${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching volunteer analysis:', error);
      throw error;
    }
  },
  fetchVolunteerLocationPoints: async (wardId) => {
    try {
      const query = wardId ? `?wardId=${encodeURIComponent(wardId)}` : '';
      return await request(`/votebase/v1/api/volunteers/analysis/locations${query}`);
    } catch (error) {
      console.log('Error while fetching volunteer map locations:', error);
      throw error;
    }
  },
  fetchWards: async (assemblyId) => {
    try {
      const query = assemblyId ? `?assemblyId=${encodeURIComponent(assemblyId)}` : '';
      return await request(`/votebase/v1/api/wards${query}`);
    } catch (error) {
      console.log('Error while fetching wards:', error);
      throw error;
    }
  },
  fetchBooths: async (assemblyCode, wardId) => {
    try {
      const params = new URLSearchParams();
      if (assemblyCode) params.set('assemblyCode', String(assemblyCode));
      if (wardId) params.set('wardId', String(wardId));
      const qs = params.toString();
      return await request(`/votebase/v1/api/booths${qs ? `?${qs}` : ''}`);
    } catch (error) {
      console.log('Error while fetching booths:', error);
      throw error;
    }
  },
  fetchPublicBooths: async (wardId) => {
    try {
      const query = wardId ? `?wardId=${encodeURIComponent(wardId)}` : '';
      return await request(`/votebase/v1/api/booths/public${query}`);
    } catch (error) {
      console.log('Error while fetching public booths:', error);
      throw error;
    }
  },

  fetchFamilies: async (hasAssociation, page, size, boothId) => {
    try {
      return await request(
        `/votebase/v1/api/family?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}&boothId=${encodeURIComponent(boothId)}&association=${encodeURIComponent(hasAssociation)}`
      );
    } catch (error) {
      console.log('Error while fetching families:', error);
      throw error;
    }
  },
  fetchFamilySuggestions: async (type) => {
    try {
      return await request(`/votebase/v1/api/family/suggestions?type=${encodeURIComponent(type)}`);
    } catch (error) {
      console.log('Error while fetching family suggestions:', error);
      throw error;
    }
  },
  fetchMessageTemplate: async (wardId, channel) => {
    try {
      const params = new URLSearchParams();
      if (wardId !== undefined && wardId !== null && wardId !== '') params.set('wardId', wardId);
      if (channel) params.set('channel', channel);
      const query = params.toString();
      return await request(`/votebase/v1/api/message-template${query ? `?${query}` : ''}`);
    } catch (error) {
      console.log('Error while fetching message template:', error);
      throw error;
    }
  },
  fetchActivatedWards: async () => {
    try {
      return await request('/votebase/v1/api/message-template/activated-wards');
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
      return await request(`/votebase/v1/api/meetings/${encodeURIComponent(id)}/attendance`, {
        method: 'POST',
      });
    } catch (error) {
      console.log('Error while recording meeting attendance:', error);
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
};

export const CRUDAPI = mobileApi;
