import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '../services/session.service';

export const cambioPasswordGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (sessionService.requiereCambioPassword()) {
    return router.parseUrl('/cambiar-password');
  }

  return true;
};