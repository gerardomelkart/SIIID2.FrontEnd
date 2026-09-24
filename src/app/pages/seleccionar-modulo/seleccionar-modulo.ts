import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SistemaConfiguracionService } from '../../core/services/sistema-configuracion.service';

import { ModuloUsuarioInfo } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-seleccionar-modulo',
  imports: [RouterLink],
  templateUrl: './seleccionar-modulo.html',
  styleUrl: './seleccionar-modulo.css',
})
export class SeleccionarModulo {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly sistema = inject(SistemaConfiguracionService);
  private readonly destroy = inject(DestroyRef);
  administraSistema = this.sessionService.administraSistema;
  error = signal('');
  cargando = signal(false);
  constructor() { this.actualizar(); }
  actualizar(): void {
    if (this.cargando()) return;
    this.cargando.set(true); this.error.set('');
    this.sistema.refrescarSesion().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => this.cargando.set(false), error: () => { this.cargando.set(false); this.error.set('No se pudieron consultar sus accesos. Recargue la página para reintentar.'); } });
  }

  modulos = computed(() => {
    const orden = ['MENSUAL', 'FEDERAL', 'SEMANAL', 'BANCI'];
    return [...this.sessionService.modulos()].sort(
      (a, b) =>
        (orden.indexOf(a.clave) < 0 ? orden.length : orden.indexOf(a.clave)) -
        (orden.indexOf(b.clave) < 0 ? orden.length : orden.indexOf(b.clave)),
    );
  });

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
