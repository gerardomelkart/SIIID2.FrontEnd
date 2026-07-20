const esLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

export const API_BASE_URL = esLocal ? 'api' : '/beta/api';

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/auth`,
  cargas: `${API_BASE_URL}/cargas`,
  actualizaciones: `${API_BASE_URL}/actualizaciones`,
  informes: `${API_BASE_URL}/informes`,
  usuarios: `${API_BASE_URL}/usuarios`,
  catalogos: `${API_BASE_URL}/catalogos`,
  administracionCargas: `${API_BASE_URL}/administracion/cargas-pendientes`,
  semanalDelitos: `${API_BASE_URL}/semanal/delitos`,
} as const;