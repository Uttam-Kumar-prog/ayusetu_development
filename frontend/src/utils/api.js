import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

let refreshInFlight = null;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const isUnauthorized = error?.response?.status === 401;
    const requestUrl = String(originalRequest?.url || '');
    const nonRefreshableAuthEndpoints = [
      '/auth/login',
      '/auth/signup',
      '/auth/register',
      '/auth/google-login',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/forgot-password',
      '/auth/verify-forgot-password-otp',
      '/auth/reset-password',
      '/auth/refresh-token',
      '/auth/logout',
    ];
    const isNonRefreshableAuthEndpoint = nonRefreshableAuthEndpoints.some((endpoint) =>
      requestUrl.includes(endpoint)
    );

    if (isUnauthorized && !isNonRefreshableAuthEndpoint && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const storedRefreshToken = localStorage.getItem('refresh_token');

      if (!storedRefreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('ayur_user');
        return Promise.reject(error);
      }

      if (!refreshInFlight) {
        refreshInFlight = api.post('/auth/refresh-token', { refreshToken: storedRefreshToken })
          .finally(() => {
            refreshInFlight = null;
          });
      }

      try {
        const { data } = await refreshInFlight;
        localStorage.setItem('access_token', data?.accessToken || '');
        localStorage.setItem('refresh_token', data?.refreshToken || '');
        if (data?.user) {
          localStorage.setItem('ayur_user', JSON.stringify(data.user));
        }
        originalRequest.headers.Authorization = `Bearer ${data?.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('ayur_user');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  googleLogin: (data) => api.post('/auth/google-login', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (data) => api.post('/auth/resend-otp', data),
  refreshToken: (data) => api.post('/auth/refresh-token', data),
  logout: (data) => api.post('/auth/logout', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  verifyForgotPasswordOtp: (data) => api.post('/auth/verify-forgot-password-otp', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.patch('/auth/me', data),
};

export const symptomsAPI = {
  submit: (data) => api.post('/symptoms/submit', data),
  history: () => api.get('/symptoms/history'),
  getById: (id) => api.get(`/symptoms/${id}`),
};

export const doctorsAPI = {
  list: (params = {}) => api.get('/doctors', { params }),
  specialties: () => api.get('/doctors/specialties'),
  getById: (id) => api.get(`/doctors/${id}`),
  getAvailability: (id, params = {}) => api.get(`/doctors/${id}/availability`, { params }),
  updateMyProfile: (data) => api.patch('/doctors/me/profile', data),
  updateMyAvailability: (data) => api.put('/doctors/me/availability', data),
};

export const appointmentsAPI = {
  create: (data) => api.post('/appointments', data),
  mine: () => api.get('/appointments/mine'),
  roomAccess: (roomId) => api.get(`/appointments/room/${roomId}/access`),
  roomSignals: (roomId, params = {}) => api.get(`/appointments/room/${roomId}/signals`, { params }),
  publishRoomSignal: (roomId, data) => api.post(`/appointments/room/${roomId}/signal`, data),
  updateStatus: (id, data) => api.patch(`/appointments/${id}/status`, data),
  caseSummary: (id) => api.get(`/appointments/${id}/case-summary`),
  startConsultation: (id) => api.post(`/appointments/${id}/start`),
  remindPatient: (id) => api.post(`/appointments/${id}/remind-patient`),
  structureSymptoms: (id) => api.post(`/appointments/${id}/structure-symptoms`),
};

export const prescriptionsAPI = {
  create: (data) => api.post('/prescriptions', data),
  mine: () => api.get('/prescriptions/mine'),
  byQr: (token) => api.get(`/prescriptions/qr/${token}`),
  byAppointment: (appointmentId) => api.get(`/prescriptions/appointment/${appointmentId}`),
};

export const therapyAPI = {
  create: (data) => api.post('/therapy', data),
  mine: () => api.get('/therapy/mine'),
  updateSession: (id, data) => api.patch(`/therapy/${id}/session`, data),
};

export const pharmacyAPI = {
  inventory: () => api.get('/pharmacy/inventory'),
  updateInventory: (data) => api.put('/pharmacy/inventory', data),
  search: (query) => api.get('/pharmacy/search', { params: { query } }),
};

export const chatsAPI = {
  create: (data) => api.post('/chats', data),
  mine: () => api.get('/chats/mine'),
  memory: () => api.get('/chats/memory'),
  postPatientMessage: (id, data) => api.post(`/chats/${id}/patient-message`, data),
  analyzePrescription: ({ file, followupText = '', currentFeeling = '', generateReport = false }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (followupText) formData.append('followupText', followupText);
    if (currentFeeling) formData.append('currentFeeling', currentFeeling);
    formData.append('generateReport', String(Boolean(generateReport)));
    return api.post('/chats/prescription-analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  assignDoctor: (id, data) => api.patch(`/chats/${id}/assign-doctor`, data),
  postDoctorMessage: (id, data) => api.post(`/chats/${id}/doctor-message`, data),
};

export const adminAPI = {
  overview: () => api.get('/admin/overview'),
  pendingDoctors: () => api.get('/admin/pending-doctors'),
  verifyDoctor: (id) => api.patch(`/admin/verify-doctor/${id}`),
  systemHealth: () => api.get('/admin/system-health'),
};

export const analyticsAPI = {
  trends: () => api.get('/analytics/trends'),
  districtTrends: () => api.get('/analytics/district-trends'),
  dashboard: () => api.get('/analytics/dashboard'),
};

export default api;
