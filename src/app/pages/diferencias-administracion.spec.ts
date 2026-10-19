import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AprobacionCargas } from './aprobacion-cargas/aprobacion-cargas';
import { FederalAprobacionCargas } from './federal-aprobacion-cargas/federal-aprobacion-cargas';
import { SemanalAprobacionCargas } from './semanal-aprobacion-cargas/semanal-aprobacion-cargas';
import { BanciReportes } from './banci-mensual/banci-reportes';
import { BanciMensualService } from '../core/services/banci-mensual.service';
import { BanciEnvio } from '../core/models/banci-mensual.models';

describe('Descarga completa de diferencias administrativas', () =>
{
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }));
    afterEach(() =>
    {
        TestBed.inject(HttpTestingController).verify();
        vi.restoreAllMocks();
    });

    for(const [modulo, Tipo] of [['mensual', AprobacionCargas], ['federal', FederalAprobacionCargas], ['semanal', SemanalAprobacionCargas]] as const)
    {
        it(`${modulo}: descarga el Excel sin cargar la muestra y bloquea solicitudes duplicadas`, () =>
        {
            const f = TestBed.createComponent<AprobacionCargas | FederalAprobacionCargas | SemanalAprobacionCargas>(Tipo);
            const componente = f.componentInstance;
            const descargar = vi.spyOn(componente as unknown as { descargarBlob: (archivo: Blob, nombre: string) => void }, 'descargarBlob').mockImplementation(() => {});
            componente.descargarTodasDiferencias('REF-PRUEBA');
            componente.descargarTodasDiferencias('REF-PRUEBA');
            expect(componente.descargandoDiferencias()).toBe(true);
            const peticion = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith(`/administracion/diferencias/${modulo}/REF-PRUEBA/excel`));
            expect(peticion.request.responseType).toBe('blob');
            const archivo = new Blob(['excel']);
            peticion.flush(archivo);
            expect(descargar).toHaveBeenCalledWith(archivo, `Diferencias_${modulo}.xlsx`);
            expect(componente.descargandoDiferencias()).toBe(false);
            expect(componente.diferenciasDetalle()).toBeNull();
        });
    }

    for(const reporte of ['pendientes', 'envios'])
    {
        it(`BANCI: el botón de descarga ${reporte === 'pendientes' ? 'aparece' : 'no aparece'} en ${reporte}`, () =>
        {
            TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { reporte } } } });
            TestBed.overrideProvider(BanciMensualService, { useValue: { listar: () => of([]) } });
            const f = TestBed.createComponent(BanciReportes);
            f.componentInstance.detalle.set({ entidad: 9, mes: 9, anio: 2026, actualizacion: true, carpetas: [], delitos: [], victimas: [], cambios: [{ carpeta: '1', delito: '2', victima: '3', campo: 'nomb', anterior: 'Antes', nuevo: 'Después' }] });
            f.componentInstance.seleccion.set({ referencia: 'REF-BANCI' } as BanciEnvio);
            f.detectChanges();
            const boton = [...f.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent.includes('Descargar todas las diferencias')) as HTMLButtonElement | undefined;
            expect(!!boton).toBe(reporte === 'pendientes');
            if(boton)
            {
                vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
                vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
                vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
                boton.click();
                TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/administracion/diferencias/banci/REF-BANCI/excel')).flush(new Blob(['excel']));
                expect(f.componentInstance.descargandoDiferencias()).toBe(false);
            }
        });
    }
});
