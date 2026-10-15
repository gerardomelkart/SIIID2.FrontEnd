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
                provideRouter([]),
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
        expect(fixture.nativeElement.querySelector('a[href="/banci/carga-masiva"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('a[href="/banci/actualizacion/manual"]')).not.toBeNull();
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
    it('ofrece los cuatro modos sin recuperar formularios del modelo anterior', () =>
    {
        const hijas = routes.find((r) => r.path === 'banci')!.children!;
        for(const ruta of ['carga-masiva', 'formulario', 'actualizacion/masiva', 'actualizacion/manual'])
            expect(hijas.find((r) => r.path === ruta)?.loadComponent).toBeDefined();
    });
});
