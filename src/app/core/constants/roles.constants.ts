export const ROLES = {
  SUPER_USUARIO: 'SUPER_USUARIO',
  ENLACE_ESTATAL: 'ENLACE_ESTATAL',
  CONSULTA: 'CONSULTA'
} as const;

export type RolSistema = typeof ROLES[keyof typeof ROLES];