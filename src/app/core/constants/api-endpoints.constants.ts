const API_BASE_URL = 'api';

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/auth`,
  cargas: `${API_BASE_URL}/cargas`,
  actualizaciones: `${API_BASE_URL}/actualizaciones`,
  informes: `${API_BASE_URL}/informes`,
  usuarios: `${API_BASE_URL}/usuarios`,
  catalogos: `${API_BASE_URL}/catalogos`,
} as const;
