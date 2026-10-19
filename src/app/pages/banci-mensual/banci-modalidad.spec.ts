import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BanciModalidad } from './banci-modalidad';
import { routes } from '../../app.routes';

describe('Selector mensual BANCI', () =>
{
    for(const actualizacion of [false, true])
    {
        it(`ofrece Manual y Masiva para ${actualizacion ? 'actualización' : 'carga'}`, () =>
        {
            TestBed.configureTestingModule({
                providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: { actualizacion } } } }],
            });
            const f = TestBed.createComponent(BanciModalidad);
            f.detectChanges();
            const enlaces = [...f.nativeElement.querySelectorAll('a')] as HTMLAnchorElement[];
            expect(enlaces.map((e) => e.textContent?.trim().split(' ').pop())).toEqual(['Manual', 'Masiva']);
            expect(enlaces[0].getAttribute('href')).toBe(actualizacion ? '/banci/actualizacion/manual' : '/banci/formulario');
            expect(enlaces[1].getAttribute('href')).toBe(actualizacion ? '/banci/actualizacion/masiva' : '/banci/carga-masiva');
        });
    }
    it('protege los dos selectores con los permisos de sus respectivos procesos', () =>
    {
        const banci = routes.find((r) => r.path === 'banci')!.children!;
        expect(banci.find((r) => r.path === 'carga-mensual')?.data?.['permiso']).toBe('CARGA');
        expect(banci.find((r) => r.path === 'actualizacion-mensual')?.data?.['permiso']).toBe('MODIFICACION');
        expect(banci.find((r) => r.path === 'carga-mensual')?.canActivate?.length).toBeGreaterThan(0);
    });
});
