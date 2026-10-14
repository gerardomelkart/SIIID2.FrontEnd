import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SistemaConfiguracionService } from '../services/sistema-configuracion.service';
import { SessionService } from '../services/session.service';

// Refresca los módulos autorizados antes de entrar para aplicar cambios de administración a la sesión vigente.
export const moduloGuard: CanActivateFn = (route) =>
{
    const session = inject(SessionService);
    const router = inject(Router);
    const servicio = inject(SistemaConfiguracionService);
    const modulo = [...route.pathFromRoot].reverse().find((r) => r.data['modulo'])?.data['modulo'];
    if(!modulo) return true;
    return servicio.refrescarSesion().pipe(
        map((s) =>
        {
            if(!s.modulos.some((m) => m.clave === modulo)) return router.parseUrl('/seleccionar-modulo');
            session.seleccionarModulo(modulo);
            return true;
        }),
        catchError(() => of(router.parseUrl('/seleccionar-modulo'))),
    );
};
