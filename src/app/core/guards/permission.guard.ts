import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { RolSistema } from '../constants/roles.constants';
import { SessionService } from '../services/session.service';

interface PermissionRouteData {
  roles?: RolSistema[];
  permiso?: 'CARGA' | 'MODIFICACION';
}

export const permissionGuard: CanActivateFn = (route) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  const usuario = sessionService.usuario();

  if (!usuario) {
    router.navigateByUrl('/login');
    return false;
  }

  const data = route.data as PermissionRouteData;

  if (data.roles?.length && !data.roles.includes(usuario.rol as RolSistema)) {
    mostrarAccesoDenegado(
      router,
      'No cuenta con el perfil necesario para acceder a este módulo.'
    );

    return false;
  }

  if (data.permiso === 'CARGA' && !sessionService.habilitaCarga()) {
    mostrarAccesoDenegado(
      router,
      'No tiene habilitado el permiso de carga inicial.'
    );

    return false;
  }

  if (data.permiso === 'MODIFICACION' && !sessionService.habilitaModificacion()) {
    mostrarAccesoDenegado(
      router,
      'No tiene habilitado el permiso de actualización.'
    );

    return false;
  }

  return true;
};

function mostrarAccesoDenegado(router: Router, mensaje: string): void {
  router.navigateByUrl('/').then(() => {
    Swal.fire({
      icon: 'warning',
      title: 'Acceso no permitido',
      text: mensaje,
      confirmButtonColor: '#691C32'
    });
  });
}