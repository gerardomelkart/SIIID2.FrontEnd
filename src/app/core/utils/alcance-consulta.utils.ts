import { ROLES } from '../constants/roles.constants';
import { UsuarioLoginInfo } from '../models/auth.models';

// Alcance de lectura; no sustituye el rol ni los permisos de operación.
export function tieneAlcanceNacionalConsulta(usuario: UsuarioLoginInfo | null): boolean {
  return usuario?.rol === ROLES.SUPER_USUARIO ||
    (usuario?.rol === ROLES.CONSULTA && usuario.idEntidadFederativa === null);
}
