// API relativa al base href de Angular.
// Local: el proxy redirige /api hacia la API.
// Producción bajo /beta/: se resuelve como /beta/api.
export const API_BASE_URL = 'api';

export const API_ENDPOINTS = {
  auth: `${API_BASE_URL}/auth`,
  cargas: `${API_BASE_URL}/cargas`,
  actualizaciones: `${API_BASE_URL}/actualizaciones`,
  informes: `${API_BASE_URL}/informes`,
  usuarios: `${API_BASE_URL}/usuarios`,
  catalogos: `${API_BASE_URL}/catalogos`,
  administracionCargas: `${API_BASE_URL}/administracion/cargas-pendientes`,
} as const;