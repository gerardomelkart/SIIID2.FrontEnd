import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ModuloUsuarioInfo } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-seleccionar-modulo',
  imports: [],
  templateUrl: './seleccionar-modulo.html',
  styleUrl: './seleccionar-modulo.css',
})
export class SeleccionarModulo {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  modulos = this.sessionService.modulos;

  nombreUsuario = computed(() => {
    return this.sessionService.usuario()?.nombreCompleto || this.sessionService.usuario()?.usuario;
  });

  seleccionar(modulo: ModuloUsuarioInfo): void {
    if (!this.sessionService.seleccionarModulo(modulo.clave)) {
      return;
    }

    void this.router.navigateByUrl(this.sessionService.obtenerRutaModulo(modulo.clave));
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}