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
    throw payload;
  }

  if (payload && typeof payload === 'object' && payload.success === false) {
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

  getVolunteerList: async (role, page, size, search, blocked, sortBy, direction, assignmentType) => {
    try {
      return await request(
        `/votebase/v1/api/user?role=${encodeURIComponent(role)}&page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}&search=${encodeURIComponent(search)}&blocked=${encodeURIComponent(blocked)}&sortBy=${encodeURIComponent(sortBy)}&direction=${encodeURIComponent(direction)}&assignmentType=${encodeURIComponent(assignmentType)}`
      );
    } catch (error) {
      console.log('Error while fetching volunteer data:', error);
      throw error;
    }
  },

  addVolunteer: async (data) => {
    try {
      return await request('/votebase/v1/api/user/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.log('Error while adding volunteer:', error);
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
};

export const CRUDAPI = mobileApi;
