import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { BanciInicio } from './banci-inicio';
import { SessionService } from '../../core/services/session.service';
import { routes } from '../../app.routes';

describe('Inicio institucional BANCI', () =>
{
    beforeEach(() =>
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
                {
                    provide: SessionService,
                    useValue: {
                        usuario: signal({ rol: 'SUPER_USUARIO', nombre: 'Prueba' }),
                        habilitaCarga: signal(true),
                        habilitaModificacion: signal(true),
                    },
                },
            ],
        }),
    );
    it('conserva la bienvenida y accesos de carga y actualización', () =>
    {
        const fixture = TestBed.createComponent(BanciInicio);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Bienvenido, Prueba');
        expect(fixture.nativeElement.querySelector('a[href="/banci/carga-mensual"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('a[href="/banci/actualizacion-mensual"]')).not.toBeNull();
    });
    it('protege todas las rutas administrativas por rol', () =>
    {
        const hijas = routes.find((r) => r.path === 'banci')!.children!;
        for(const ruta of hijas.filter((r) => r.path?.startsWith('administracion/')))
        {
            expect(ruta.canActivate?.length).toBeGreaterThan(0);
            expect(ruta.data?.['roles']).toEqual(['SUPER_USUARIO']);
        }
        expect(hijas.find((r) => r.path === 'informes/cargas')?.data?.['roles']).toEqual(['SUPER_USUARIO']);
        expect(hijas.find((r) => r.path === 'informes/originales')?.data?.['roles']).toEqual(['SUPER_USUARIO']);
    });
    it('ofrece solo carga y actualización masivas', () =>
    {
        const hijas = routes.find((r) => r.path === 'banci')!.children!;
        for(const ruta of ['carga-mensual', 'actualizacion-mensual', 'carga-masiva', 'actualizacion/masiva'])
            expect(hijas.find((r) => r.path === ruta)?.loadComponent).toBeDefined();
    });
    it('redirige las antiguas rutas manuales al flujo masivo', () => {
        const hijas = routes.find(r => r.path === 'banci')!.children!;
        expect(hijas.find(r => r.path === 'formulario')?.redirectTo).toBe('carga-mensual');
        expect(hijas.find(r => r.path === 'actualizacion/manual')?.redirectTo).toBe('actualizacion-mensual');
    });
    it('muestra al enlace el recordatorio de carpetas pendientes de carga', () =>
    {
        (TestBed.inject(SessionService).usuario as ReturnType<typeof signal>).set({ rol: 'ENLACE_ESTATAL', nombre: 'Enlace' });
        const f = TestBed.createComponent(BanciInicio); f.detectChanges();
        const http = TestBed.inject(HttpTestingController);
        http.expectOne(r => r.url.endsWith('/banci/mensual/recordatorio')).flush({ hayPendiente: true, titulo: 'Carga BANCI pendiente', mensaje: 'Hay carpetas pendientes de enviar.', periodo: 'septiembre de 2026', delitos: [] });
        f.detectChanges();
        expect(f.nativeElement.textContent).toContain('Carga BANCI pendiente');
        expect(f.nativeElement.textContent).toContain('Hay carpetas pendientes');
        http.verify();
    });

    it('ofrece al administrador todos los accesos existentes del menú BANCI', () =>
    {
        const f = TestBed.createComponent(BanciInicio); f.detectChanges();
        for(const ruta of ['informes/cargas', 'informes/originales', 'administracion/cargas-pendientes', 'administracion/configuracion', 'administracion/usuarios'])
            expect(f.nativeElement.querySelector(`a[href="/banci/${ruta}"]`)).not.toBeNull();
    });

});
