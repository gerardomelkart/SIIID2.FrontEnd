import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-semanal-inicio',
  imports: [],
  templateUrl: './semanal-inicio.html',
  styleUrl: './semanal-inicio.css',
})
export class SemanalInicio {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  usuario = this.sessionService.usuario;
  puedeCambiarModulo = computed(() => this.sessionService.modulos().length > 1);

  cambiarModulo(): void {
    this.sessionService.limpiarModuloActivo();
    void this.router.navigateByUrl('/seleccionar-modulo');
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}