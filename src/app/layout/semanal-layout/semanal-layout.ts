import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, exhaustMap, filter, of, timer } from 'rxjs';
import { ROLES } from '../../core/constants/roles.constants';
import { AuthService } from '../../core/services/auth.service';
import { NotificacionesRechazosService } from '../../core/services/notificaciones-rechazos.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarNotificacionRechazo } from '../../core/utils/alert.utils';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-semanal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Topbar],
  templateUrl: './semanal-layout.html',
  styleUrls: ['../main-layout/main-layout.css', '../sidebar/sidebar.css', './semanal-layout.css'],
})
export class SemanalLayout implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly notificacionesService = inject(NotificacionesRechazosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private notificacionAbierta = false;

  menuAbierto = signal(false);
  cargaAbierta = signal(false);
  administracionAbierta = signal(false);
  informesAbiertos = signal(false);
  informesIncidenciaAbierta = signal(false);
  sesionAbierta = signal(false);

  usuario = this.sessionService.usuario;

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);

  puedeConsultarEnvios = computed(
    () =>
      this.usuario()?.rol === ROLES.SUPER_USUARIO ||
      this.usuario()?.rol === ROLES.ENLACE_ESTATAL ||
      this.usuario()?.rol === ROLES.CONSULTA,
  );

  puedeCargar = computed(
    () =>
      (this.usuario()?.rol === ROLES.SUPER_USUARIO ||
        this.usuario()?.rol === ROLES.ENLACE_ESTATAL) &&
      this.sessionService.habilitaCarga(),
  );

  puedeAdministrarDelitos = computed(
    () => this.esSuperUsuario() && this.sessionService.administraDelitos(),
  );

  puedeRegresarSeleccionModulo = this.sessionService.tieneMultiplesModulos;

  ngOnInit(): void {
    if (this.usuario()?.rol !== ROLES.ENLACE_ESTATAL) return;

    timer(0, 60000)
      .pipe(
        filter(() => !this.notificacionAbierta),
        exhaustMap(() =>
          this.notificacionesService
            .consumirSemanal()
            .pipe(catchError(() => of({ hayNotificacion: false, cantidad: 0 }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (!response.hayNotificacion) return;

        this.notificacionAbierta = true;

        void mostrarNotificacionRechazo(response.cantidad).then((resultado) => {
          this.notificacionAbierta = false;

          if (resultado.isConfirmed) {
            void this.router.navigateByUrl('/semanal/informes/envios');
          }
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

  toggleCarga(): void {
    this.cargaAbierta.update((valor) => !valor);
  }

  toggleInformes(): void {
    this.informesAbiertos.update((valor) => !valor);

    if (!this.informesAbiertos()) this.informesIncidenciaAbierta.set(false);
  }

  toggleInformesIncidencia(): void {
    this.informesIncidenciaAbierta.update((valor) => !valor);
  }

  toggleAdministracion(): void {
    this.administracionAbierta.update((valor) => !valor);
  }

  toggleSesion(): void {
    this.sesionAbierta.update((valor) => !valor);
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
