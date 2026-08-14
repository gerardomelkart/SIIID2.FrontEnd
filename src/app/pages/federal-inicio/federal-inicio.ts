import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-federal-inicio',
  imports: [],
  templateUrl: './federal-inicio.html',
  styleUrl: './federal-inicio.css',
})
export class FederalInicio {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  nombreUsuario = computed(() => {
    return this.sessionService.usuario()?.nombreCompleto || this.sessionService.usuario()?.usuario;
  });

  puedeCambiarModulo = this.sessionService.tieneMultiplesModulos;

  regresarSeleccionModulo(): void {
    this.sessionService.limpiarModuloActivo();
    void this.router.navigateByUrl('/seleccionar-modulo');
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}