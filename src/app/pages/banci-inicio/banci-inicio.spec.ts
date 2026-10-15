import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BanciInicio } from './banci-inicio';
import { routes } from '../../app.routes';

describe('Preparación mensual BANCI', () =>
{
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
    afterEach(() => TestBed.inject(HttpTestingController).verify());
    it('muestra que falta preparar el ambiente y no ofrece cargas antiguas', () =>
    {
        const fixture = TestBed.createComponent(BanciInicio);
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/banci/modelo'))
            .flush({ instalado: false });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('pendiente completar');
        expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    });
    it('informa un error de disponibilidad sin habilitar operaciones', () =>
    {
        const fixture = TestBed.createComponent(BanciInicio);
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/banci/modelo'))
            .flush({}, { status: 500, statusText: 'Error' });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No fue posible');
    });
    it('retira las rutas de carga, actualización y consulta sustituidas', () =>
    {
        expect(
            routes
                .find((r) => r.path === 'banci')
                ?.children?.map((r) => r.path)
                .sort(),
        ).toEqual(['', 'usuarios']);
    });
});
