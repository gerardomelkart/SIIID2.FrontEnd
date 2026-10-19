import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { BanciInformes } from './banci-informes';
import { BanciArchivoOriginal } from '../../core/models/banci-mensual.models';

describe('Reportes administrativos BANCI', () =>
{
    function crear(reporte: string)
    {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { data: { reporte } } } }] });
        return TestBed.createComponent(BanciInformes);
    }
    afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.restoreAllMocks(); });
    it('conserva las 32 entidades, pagina y permite buscar las que no tienen carga', () =>
    {
        const f = crear('cargas');
        const http = TestBed.inject(HttpTestingController);
        http.expectOne(r => r.url.endsWith('/reportes/cargas/periodos')).flush([{ anio: 2026, mes: 9 }]);
        const req = http.expectOne(r => r.url.endsWith('/reportes/cargas'));
        expect(req.request.params.get('mes')).toBe('9');
        req.flush(Array.from({ length: 32 }, (_, i) => ({ entidad: i + 1, entidadNombre: `Entidad ${i + 1}`, ranking: i === 0 ? 1 : null, intentos: i === 0 ? 2 : 0, estado: i === 0 ? 'CONFIRMADO' : 'SIN_CARGA', fechaCarga: null, fechaAprobacion: null })));
        f.detectChanges();
        const c = f.componentInstance;
        expect(c.cargasVisibles().length).toBe(20);
        expect(c.paginas()).toBe(2);
        c.pagina.set(2);
        expect(c.cargasVisibles().length).toBe(12);
        c.buscar('Sin carga');
        expect(c.pagina()).toBe(1);
        expect(c.filtradas().length).toBe(31);
        expect(f.nativeElement.textContent).toContain('Reporte de cargas');
    });
    it('no consulta un periodo vacío cuando no hay cortes', () =>
    {
        const f = crear('cargas');
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/reportes/cargas/periodos')).flush([]);
        expect(f.componentInstance.ocupado()).toBe(false);
        expect(f.componentInstance.filas()).toEqual([]);
    });
    it('muestra originales masivos, ordena el periodo completo y descarga XLSX y ZIP', () =>
    {
        const f = crear('originales');
        const http = TestBed.inject(HttpTestingController);
        const original: BanciArchivoOriginal = { referencia: 'abc', entidad: 9, entidadNombre: 'Ciudad de México', mes: 9, anio: 2026, tipo: 'ACTUALIZACION', fecha: '2026-10-19T18:00:00Z', nombreOriginal: 'actualizacion.xlsx', tamanioBytes: 2048, sha256: 'hash' };
        http.expectOne(r => r.url.endsWith('/reportes/originales')).flush([original, { ...original, referencia: 'def', entidad: 1, entidadNombre: 'Aguascalientes', mes: 8 }]);
        f.detectChanges();
        expect(f.nativeElement.textContent).toContain('actualizacion.xlsx');
        expect(f.nativeElement.textContent).toContain('Las capturas manuales no generan archivo original');
        f.componentInstance.ordenar('periodo');
        expect(f.componentInstance.originalesVisibles()[0].mes).toBe(8);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:original');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        f.componentInstance.descargar(original, false);
        http.expectOne(r => r.url.endsWith('/envios/abc/original')).flush(new Blob(['original']));
        f.componentInstance.descargar(original, true);
        http.expectOne(r => r.url.endsWith('/reportes/originales/abc/zip')).flush(new Blob(['zip']));
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2);
        expect(f.componentInstance.ocupado()).toBe(false);
    });
});
