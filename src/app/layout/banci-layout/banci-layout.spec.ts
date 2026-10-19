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
});
