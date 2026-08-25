import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-federal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Topbar],
  templateUrl: './federal-layout.html',
  styleUrls: ['../main-layout/main-layout.css', '../sidebar/sidebar.css', './federal-layout.css'],
})
export class FederalLayout {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  menuAbierto = signal(false);
  cargaAbierta = signal(false);
  sesionAbierta = signal(false);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  puedeRegresarSeleccionModulo = this.sessionService.tieneMultiplesModulos;

  toggleMenu(): void {
    this.menuAbierto.update((valor) => !valor);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarMenuSiEsNavegacion(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a')) this.cerrarMenu();
  }

  toggleSesion(): void {
    this.sesionAbierta.update((valor) => !valor);
  }

  toggleCarga(): void {
    this.cargaAbierta.update((valor) => !valor);
  }

  regresarInicio(): void {
    void this.router.navigateByUrl('/federal');
  }

  regresarSeleccionModulo(): void {
    this.sessionService.limpiarModuloActivo();
    void this.router.navigateByUrl('/seleccionar-modulo');
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
