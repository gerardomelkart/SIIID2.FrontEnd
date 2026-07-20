import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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