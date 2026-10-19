import { of } from 'rxjs';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { NotificacionesRechazosService } from '../../core/services/notificaciones-rechazos.service';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BanciLayout } from './banci-layout';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { routes } from '../../app.routes';

describe('Diseño institucional BANCI', () =>
{
    beforeEach(() =>
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: NotificacionesRechazosService, useValue: { consumirBanci: vi.fn(() => of({ hayNotificacion: false, cantidad: 0 })) } },
                {
                    provide: SessionService,
                    useValue: {
                        usuario: signal({ rol: 'SUPER_USUARIO', nombre: 'Prueba' }),
                        habilitaCarga: signal(true),
                        habilitaModificacion: signal(true),
                        tieneMultiplesModulos: signal(true),
                    },
                },
                { provide: AuthService, useValue: { logout()
                {} } },
            ],
        }),
    );
    it('conserva barra institucional, menú lateral, usuario y contenedor principal', () =>
    {
        const f = TestBed.createComponent(BanciLayout);
        f.detectChanges();
        expect(f.nativeElement.querySelector('app-topbar')).not.toBeNull();
        expect(f.nativeElement.querySelector('aside.sidebar .user-card')).not.toBeNull();
        expect(f.nativeElement.querySelector('main.siiid-main .siiid-content')).not.toBeNull();
    });
    it('todos los enlaces del menú tienen una ruta BANCI existente', () =>
    {
        const f = TestBed.createComponent(BanciLayout);
        const c = f.componentInstance;
        c.cargaAbierta.set(true);
        c.actualizacionAbierta.set(true);
        c.informesAbierto.set(true);
        c.administracionAbierta.set(true);
        f.detectChanges();
        const disponibles = routes.find((r) => r.path === 'banci')!.children!.map((r) => `/banci/${r.path}`);
        const enlaces = [...f.nativeElement.querySelectorAll('a[href]')] as HTMLAnchorElement[];
        expect(enlaces.length).toBe(8);
        for(const enlace of enlaces) expect(disponibles).toContain(enlace.getAttribute('href'));
    });
    it('el menú móvil se puede abrir y cerrar', () =>
    {
        const f = TestBed.createComponent(BanciLayout);
        f.detectChanges();
        f.componentInstance.toggleMenu();
        f.detectChanges();
        expect(f.nativeElement.querySelector('aside.mobile-open')).not.toBeNull();
        f.nativeElement.querySelector('.menu-backdrop').click();
        f.detectChanges();
        expect(f.nativeElement.querySelector('aside.mobile-open')).toBeNull();
    });
    it('avisa de rechazos al enlace y dirige a sus envíos', async () =>
    {
        vi.useFakeTimers();
        const sesion = TestBed.inject(SessionService);
        (sesion.usuario as ReturnType<typeof signal>).set({ rol: 'ENLACE_ESTATAL', nombre: 'Enlace' });
        const servicio = TestBed.inject(NotificacionesRechazosService);
        vi.mocked(servicio.consumirBanci).mockReturnValue(of({ hayNotificacion: true, cantidad: 1 }));
        const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
        const alerta = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
        const f = TestBed.createComponent(BanciLayout); f.detectChanges();
        await vi.advanceTimersByTimeAsync(0);
        expect(servicio.consumirBanci).toHaveBeenCalledOnce();
        expect(alerta).toHaveBeenCalled();
        expect(navegar).toHaveBeenCalledWith('/banci/informes/envios');
        f.destroy(); vi.useRealTimers(); vi.restoreAllMocks();
    });

});
