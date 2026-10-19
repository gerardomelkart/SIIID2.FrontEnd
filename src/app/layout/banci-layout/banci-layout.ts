import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, filter, of, timer } from 'rxjs';
import { NotificacionesRechazosService } from '../../core/services/notificaciones-rechazos.service';
import { mostrarNotificacionRechazo } from '../../core/utils/alert.utils';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
export class BanciLayout implements OnInit
{
    private readonly sessionService = inject(SessionService);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    private readonly notificaciones = inject(NotificacionesRechazosService);
    private readonly destroyRef = inject(DestroyRef);
    private notificacionAbierta = false;
    ngOnInit(): void
    {
        if(this.usuario()?.rol !== 'ENLACE_ESTATAL') return;
        timer(0, 60000).pipe(
            filter(() => !this.notificacionAbierta),
            exhaustMap(() => this.notificaciones.consumirBanci().pipe(catchError(() => of({ hayNotificacion: false, cantidad: 0 })))),
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(response =>
        {
            if(!response.hayNotificacion) return;
            this.notificacionAbierta = true;
            void mostrarNotificacionRechazo(response.cantidad).then(resultado =>
            {
                this.notificacionAbierta = false;
                if(resultado.isConfirmed) void this.router.navigateByUrl('/banci/informes/envios');
            });
        });
    }

    menuAbierto = signal(false);
    cargaAbierta = signal(false);
    actualizacionAbierta = signal(false);
    informesAbierto = signal(false);
    administracionAbierta = signal(false);
    sesionAbierta = signal(false);

    usuario = this.sessionService.usuario;
    puedeCapturar = computed(
        () => this.usuario()?.rol === 'SUPER_USUARIO' || (this.usuario()?.rol === 'ENLACE_ESTATAL' && this.sessionService.habilitaCarga()),
    );
    puedeActualizar = computed(
        () =>
            this.usuario()?.rol === 'SUPER_USUARIO' ||
            (this.usuario()?.rol === 'ENLACE_ESTATAL' && this.sessionService.habilitaModificacion()),
    );
    puedeRegresarSeleccionModulo = this.sessionService.tieneMultiplesModulos;

    toggleMenu(): void
    {
        this.menuAbierto.update((valor) => !valor);
    }
    toggleCarga(): void
    {
        this.cargaAbierta.update((valor) => !valor);
    }
    toggleInformes(): void
    {
        this.informesAbierto.update((valor) => !valor);
    }
    toggleSesion(): void
    {
        this.sesionAbierta.update((valor) => !valor);
    }
    cerrarMenu(): void
    {
        this.menuAbierto.set(false);
    }
    cerrarMenuSiEsNavegacion(event: MouseEvent): void
    {
        if((event.target as HTMLElement).closest('a')) this.cerrarMenu();
    }
    regresarInicio(): void
    {
        void this.router.navigateByUrl('/banci');
    }

    regresarSeleccionModulo(): void
    {
        this.sessionService.limpiarModuloActivo();
        void this.router.navigateByUrl('/seleccionar-modulo');
    }

    cerrarSesion(): void
    {
        this.authService.logout();
        void this.router.navigateByUrl('/login');
    }
}
