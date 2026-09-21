import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-banci-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Topbar],
  templateUrl: './banci-layout.html',
  styleUrls: ['../main-layout/main-layout.css', '../sidebar/sidebar.css', './banci-layout.css'],
})
export class BanciLayout {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  menuAbierto = signal(false);
  cargaAbierta = signal(true);
  informesAbierto = signal(true);
  administracionAbierta = signal(true);
  sesionAbierta = signal(false);

  usuario = this.sessionService.usuario;
  puedeCapturar = computed(() => this.usuario()?.rol === 'SUPER_USUARIO' || (this.usuario()?.rol === 'ENLACE_ESTATAL' && this.sessionService.habilitaCarga()));
  puedeRegresarSeleccionModulo = this.sessionService.tieneMultiplesModulos;

  toggleMenu(): void { this.menuAbierto.update((valor) => !valor); }
  toggleCarga(): void { this.cargaAbierta.update((valor) => !valor); }
  toggleInformes(): void { this.informesAbierto.update((valor) => !valor); }
  toggleSesion(): void { this.sesionAbierta.update((valor) => !valor); }
  cerrarMenu(): void { this.menuAbierto.set(false); }
  cerrarMenuSiEsNavegacion(event: MouseEvent): void { if ((event.target as HTMLElement).closest('a')) this.cerrarMenu(); }
  regresarInicio(): void { void this.router.navigateByUrl('/banci'); }

  regresarSeleccionModulo(): void {
    this.sessionService.limpiarModuloActivo();
    void this.router.navigateByUrl('/seleccionar-modulo');
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
