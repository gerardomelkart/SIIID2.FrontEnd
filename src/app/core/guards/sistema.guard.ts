import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SistemaConfiguracionService } from '../services/sistema-configuracion.service';

export const sistemaGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(SistemaConfiguracionService).refrescarSesion().pipe(map(s => s.administraSistema ? true : router.parseUrl('/seleccionar-modulo')), catchError(() => of(router.parseUrl('/seleccionar-modulo'))));
};
