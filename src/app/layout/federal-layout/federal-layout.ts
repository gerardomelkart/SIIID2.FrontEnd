import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, filter, of, timer } from 'rxjs';
import { NotificacionesRechazosService } from '../../core/services/notificaciones-rechazos.service';
import { mostrarNotificacionRechazo } from '../../core/utils/alert.utils';
import { ROLES } from '../../core/constants/roles.constants';
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
export class FederalLayout implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly notificacionesService = inject(NotificacionesRechazosService);
  private readonly destroyRef = inject(DestroyRef);
  private notificacionAbierta = false;

  menuAbierto = signal(false);
  cargaAbierta = signal(false);
  informesAbierto = signal(false);
  administracionAbierta = signal(false);
  sesionAbierta = signal(false);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;
  puedeRegresarSeleccionModulo = this.sessionService.tieneMultiplesModulos;

  ngOnInit(): void {
    if (this.sessionService.usuario()?.rol !== ROLES.ENLACE_ESTATAL) return;

    timer(0, 60000)
      .pipe(
        filter(() => !this.notificacionAbierta),
        exhaustMap(() =>
          this.notificacionesService
            .consumirFederal()
            .pipe(catchError(() => of({ hayNotificacion: false, cantidad: 0 }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response.hayNotificacion) return;

        this.notificacionAbierta = true;

        void mostrarNotificacionRechazo(response.cantidad).then((resultado) => {
          this.notificacionAbierta = false;

          if (resultado.isConfirmed) void this.router.navigateByUrl('/federal/informes/envios');
        });
      });
  }

  toggleMenu(): void {
    this.menuAbierto.update((valor) => !valor);
  }

  toggleAdministracion(): void {
    this.administracionAbierta.update((valor) => !valor);
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

  toggleInformes(): void {
    this.informesAbierto.update((valor) => !valor);
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
