import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-semanal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Topbar],
  templateUrl: './semanal-layout.html',
  styleUrls: ['../main-layout/main-layout.css', '../sidebar/sidebar.css', './semanal-layout.css'],
})
export class SemanalLayout {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cargaAbierta = signal(false);
  incidenciaAbierta = signal(false);
  administracionAbierta = signal(false);
  sesionAbierta = signal(false);

  usuario = this.sessionService.usuario;

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);

  puedeCargar = computed(
    () =>
      (this.usuario()?.rol === ROLES.SUPER_USUARIO ||
        this.usuario()?.rol === ROLES.ENLACE_ESTATAL) &&
      this.sessionService.habilitaCarga(),
  );

  puedeAdministrarDelitos = computed(
    () => this.esSuperUsuario() && this.sessionService.administraDelitos(),
  );

  puedeCambiarAModuloConsolidado = computed(() =>
    this.sessionService.modulos().some(
      (modulo) => modulo.clave.toUpperCase() === 'MENSUAL',
    ),
  );

  toggleCarga(): void {
    this.cargaAbierta.update((valor) => !valor);

    if (!this.cargaAbierta()) {
      this.incidenciaAbierta.set(false);
    }
  }

  toggleIncidencia(): void {
    this.incidenciaAbierta.update((valor) => !valor);
  }

  toggleAdministracion(): void {
    this.administracionAbierta.update((valor) => !valor);
  }

  toggleSesion(): void {
    this.sesionAbierta.update((valor) => !valor);
  }

  cambiarAModuloConsolidado(): void {
    if (!this.sessionService.seleccionarModulo('MENSUAL')) return;
    void this.router.navigateByUrl('/');
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}