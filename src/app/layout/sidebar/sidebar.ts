import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cargaAbierta = signal(false);
  incidenciaAbierta = signal(false);
  administracionAbierta = signal(false);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;

  toggleCarga(): void {
    this.cargaAbierta.update(valor => !valor);

    if (!this.cargaAbierta()) {
      this.incidenciaAbierta.set(false);
    }
  }

  toggleIncidencia(): void {
    this.incidenciaAbierta.update(valor => !valor);
  }

  toggleAdministracion(): void {
    this.administracionAbierta.update(valor => !valor);
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}