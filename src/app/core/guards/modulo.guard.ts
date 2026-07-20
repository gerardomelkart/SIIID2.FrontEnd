import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ClaveModulo } from '../models/auth.models';
import { SessionService } from '../services/session.service';

interface ModuloRouteData {
  modulo?: ClaveModulo;
}

export const moduloGuard: CanActivateFn = (route) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const moduloRequerido = (route.data as ModuloRouteData).modulo;

  if (!moduloRequerido) {
    return true;
  }

  const modulos = sessionService.modulos();

  if (modulos.length === 0) {
    sessionService.limpiarSesion();
    return router.parseUrl('/login');
  }

  let moduloActivo = sessionService.moduloActivo();

  if (!moduloActivo && modulos.length === 1) {
    sessionService.seleccionarModulo(modulos[0].clave);
    moduloActivo = sessionService.moduloActivo();
  }

  if (!moduloActivo) {
    return router.parseUrl('/seleccionar-modulo');
  }

  if (moduloActivo.clave !== moduloRequerido) {
    return router.parseUrl(sessionService.obtenerRutaModulo(moduloActivo.clave));
  }

  return true;
};