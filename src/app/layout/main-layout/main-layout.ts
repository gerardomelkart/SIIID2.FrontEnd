import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';
import { catchError, exhaustMap, filter, of, timer } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);

  private notificacionAbierta = false;

  menuAbierto = signal(false);

  ngOnInit(): void {
    if (this.sessionService.usuario()?.rol !== ROLES.ENLACE_ESTATAL) return;

    timer(0, 60000)
      .pipe(
        filter(() => !this.notificacionAbierta),
        exhaustMap(() =>
          this.notificacionesService
            .consumirMensual()
            .pipe(catchError(() => of({ hayNotificacion: false, cantidad: 0 }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response.hayNotificacion) return;

        this.notificacionAbierta = true;

        void mostrarNotificacionRechazo(response.cantidad).then((resultado) => {
          this.notificacionAbierta = false;

          if (resultado.isConfirmed) void this.router.navigateByUrl('/informes/envios');
        });
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