import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BanciEnvios } from './banci-envios';
import { BanciEnvio } from '../../core/models/banci-mensual.models';

const manual: BanciEnvio = { id: 1, referencia: 'manual', entidad: 9, entidadNombre: 'Ciudad de México', mes: 9, anio: 2026, tipo: 'CARGA', estado: 'CONFIRMADO', nombreUsuario: 'Usuario manual', fecha: '2026-10-19T18:00:00Z', motivo: null, manual: true, tieneOriginal: false };
const masiva: BanciEnvio = { ...manual, id: 2, referencia: 'masiva', tipo: 'ACTUALIZACION', nombreUsuario: 'Usuario masiva', manual: false, tieneOriginal: true, estado: 'CONFIRMADO_ACTUALIZACION' };

describe('Consulta de envíos BANCI con el esquema mensual', () =>
{
    beforeEach(() =>
    {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:acuse');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.restoreAllMocks(); });
    function crear(filas = [manual, masiva])
    {
        const f = TestBed.createComponent(BanciEnvios);
        const http = TestBed.inject(HttpTestingController);
        http.expectOne(r => r.url.endsWith('/envios/periodos')).flush([{ anio: 2026, mes: 9 }, { anio: 2026, mes: 8 }]);
        http.expectOne(r => r.url.endsWith('/envios') && r.params.get('anio') === '2026').flush(filas);
        f.detectChanges();
        return f;
    }
    it('selecciona el corte más reciente, permite buscar y muestra estados legibles', () =>
    {
        const f = crear([... [manual, masiva], { ...masiva, referencia: 'otro-corte', mes: 8 }]);
        const c = f.componentInstance;
        expect(c.corte()).toBe('2026-09');
        expect(c.filtradas().length).toBe(2);
        expect(f.nativeElement.textContent).toContain('Actualización confirmada');
        expect(f.nativeElement.textContent).toContain('septiembre de 2026');
        c.buscar('manual');
        expect(c.filtradas().map(f => f.referencia)).toEqual(['manual']);
    });
    it('mantiene los envíos manuales y ofrece original solo para las masivas', () =>
    {
        const f = crear();
        expect(f.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
        expect(f.nativeElement.querySelectorAll('button[aria-label="Descargar archivo enviado"]').length).toBe(1);
        expect(f.nativeElement.querySelectorAll('button[aria-label="Ver informe"]').length).toBe(2);
        f.componentInstance.original({ ...manual, tieneOriginal: true });
        TestBed.inject(HttpTestingController).expectNone(r => r.url.endsWith('/original'));
        f.componentInstance.original(masiva);
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/envios/masiva/original')).flush(new Blob(['xlsx']));
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    });
    it('descarga los acuses del corte seleccionado', () =>
    {
        const f = crear();
        f.componentInstance.acuses();
        const r = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/envios/acuses'));
        expect(r.request.params.get('anio')).toBe('2026');
        expect(r.request.params.get('mes')).toBe('9');
        r.flush(new Blob(['zip']));
        expect(f.componentInstance.ocupado()).toBe(false);
    });
    it('pagina y reinicia la página al cambiar la búsqueda', () =>
    {
        const f = crear(Array.from({ length: 25 }, (_, i) => ({ ...manual, referencia: String(i), nombreUsuario: 'Usuario ' + i })));
        const c = f.componentInstance;
        expect(c.visibles().length).toBe(20);
        expect(c.paginas()).toBe(2);
        c.pagina.set(2);
        expect(c.visibles().length).toBe(5);
        c.buscar('Usuario 24');
        expect(c.pagina()).toBe(1);
        expect(c.visibles().length).toBe(1);
    });
    it('muestra el motivo administrativo y no ofrece acuse para el rechazo', () =>
    {
        const f = crear([{ ...manual, estado: 'RECHAZADO_ADMIN', motivo: 'Corregir los datos.' }]);
        expect(f.nativeElement.textContent).toContain('Rechazado por administrador');
        expect(f.nativeElement.textContent).toContain('Corregir los datos.');
        expect(f.nativeElement.querySelector('button[aria-label="Ver informe"]')).toBeNull();
    });
    it('maneja un historial sin cortes sin consultar un año vacío', () =>
    {
        const f = TestBed.createComponent(BanciEnvios);
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/envios/periodos')).flush([]);
        f.detectChanges();
        expect(f.componentInstance.ocupado()).toBe(false);
        expect(f.nativeElement.textContent).toContain('Sin cortes disponibles');
    });
    it('aplica a la barra de herramientas la distribución de acciones compartida', () =>
    {
        const f = crear();
        const acciones = f.nativeElement.querySelector('.reporte-actions');
        expect(acciones).not.toBeNull();
        expect(acciones.querySelectorAll('button').length).toBe(3);
        expect(acciones.querySelector('.buscador')).not.toBeNull();
        expect(f.nativeElement.querySelector('.reporte-toolbar')).toBeNull();
    });

});
