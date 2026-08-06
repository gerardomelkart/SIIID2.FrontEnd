import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { NotificacionesRechazosService } from '../../core/services/notificaciones-rechazos.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarNotificacionRechazo } from '../../core/utils/alert.utils';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit {
  private readonly notificacionesService = inject(NotificacionesRechazosService);
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);

  menuAbierto = signal(false);

  ngOnInit(): void {
    if (this.sessionService.usuario()?.rol !== ROLES.ENLACE_ESTATAL) return;

    this.notificacionesService.consumirMensual().subscribe({
      next: (response) => {
        if (!response.hayNotificacion) return;

        void mostrarNotificacionRechazo(response.cantidad).then((resultado) => {
          if (resultado.isConfirmed) void this.router.navigateByUrl('/informes/envios');
        });
      },
      error: () => undefined,
    });
  }

  toggleMenu(): void {
    this.menuAbierto.update((valor) => !valor);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarMenuSiEsNavegacion(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a')) this.cerrarMenu();
  }
}