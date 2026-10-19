import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { App } from './app';
import { InactivityService } from './core/services/inactivity.service';

describe('Recarga de BANCI al dashboard del módulo', () =>
{
    let navegar: ReturnType<typeof vi.fn>;
    let base: HTMLBaseElement;
    beforeEach(() =>
    {
        navegar = vi.fn().mockResolvedValue(true);
        base = document.createElement('base'); base.href = '/'; document.head.prepend(base);
        TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: Router, useValue: { navigateByUrl: navegar } }, { provide: InactivityService, useValue: { iniciar: vi.fn() } }] });
        vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'reload' }] as unknown as PerformanceEntry[]);
    });
    afterEach(() => { window.history.replaceState({}, '', '/'); base.remove(); vi.restoreAllMocks(); });
    for(const ruta of ['/banci/informes/envios', '/banci/administracion/configuracion', '/banci/formulario'])
        it(`F5 en ${ruta} vuelve a BANCI`, () =>
        {
            window.history.replaceState({}, '', ruta);
            TestBed.createComponent(App).componentInstance.ngOnInit();
            expect(navegar).toHaveBeenCalledWith('/banci');
        });
    it('mantiene el dashboard BANCI al recargarlo', () =>
    {
        window.history.replaceState({}, '', '/banci');
        TestBed.createComponent(App).componentInstance.ngOnInit();
        expect(navegar).not.toHaveBeenCalled();
    });
    it('conserva el retorno al inicio del consolidado', () =>
    {
        window.history.replaceState({}, '', '/informes/envios');
        TestBed.createComponent(App).componentInstance.ngOnInit();
        expect(navegar).toHaveBeenCalledWith('/');
    });
});
