import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Swal from 'sweetalert2';
import { BanciAprobacion } from './banci-aprobacion';
import { BanciPendiente, BanciRevisionAdministracion } from '../../core/models/banci-mensual.models';

const pendiente: BanciPendiente = { id: 1, referencia: 'referencia-interna', entidad: 9, entidadNombre: 'Ciudad de México', anio: 2025, mes: 9, tipo: 'CARGA', estado: 'PENDIENTE_APROBACION', nombreUsuario: 'Enlace', fecha: '2026-10-19T18:00:00Z', motivo: null, manual: true, tieneOriginal: false, nombreOriginal: null, totalCarpetas: 1, totalDelitos: 1, totalVictimas: 2 };
const revision: BanciRevisionAdministracion = { totalCarpetas: 1, totalDelitos: 1, totalVictimas: 2, totalCambios: 101, victimasConCambios: 2, limiteMuestra: 100, libro: { entidad: 9, anio: 2025, mes: 9, actualizacion: false, manual: true, carpetas: [], delitos: [], victimas: [], cambios: [{ carpeta: 'ci', delito: 'del', victima: 'vic', campo: 'edad', anterior: '', nuevo: '42' }] } };

describe('Aprobación de cargas BANCI con esquema mensual', () =>
{
    beforeEach(() =>
    {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:original');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() => { TestBed.inject(HttpTestingController).verify(); Swal.close(); vi.restoreAllMocks(); });
    function crear(filas = [pendiente])
    {
        const f = TestBed.createComponent(BanciAprobacion);
        const req = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/administracion/pendientes'));
        expect(req.request.params.has('anio')).toBe(false);
        req.flush(filas); f.detectChanges(); return f;
    }
    function revisar(f: ReturnType<typeof crear>, fila = pendiente)
    {
        f.componentInstance.revisar(fila);
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/administracion/referencia-interna/revision')).flush(revision);
        f.detectChanges();
    }
    it('incluye pendientes anteriores, busca modalidad y pagina', () =>
    {
        const f = crear(Array.from({ length: 25 }, (_, i) => ({ ...pendiente, referencia: String(i), entidadNombre: `Entidad ${i}`, manual: i !== 24 })));
        expect(f.componentInstance.visibles().length).toBe(20);
        f.componentInstance.pagina.set(2);
        expect(f.componentInstance.visibles().length).toBe(5);
        f.componentInstance.buscar('masiva');
        expect(f.componentInstance.pagina()).toBe(1);
        expect(f.componentInstance.visibles().length).toBe(1);
    });
    it('presenta totales y muestra de diferencias bajo demanda, sin referencia interna ni original manual', () =>
    {
        const f = crear(); revisar(f);
        expect(f.nativeElement.textContent).toContain('Información propuesta');
        expect(f.nativeElement.textContent).toContain('101');
        expect(f.nativeElement.textContent).not.toContain('referencia-interna');
        expect(f.nativeElement.textContent).not.toContain('Descargar archivo original');
        expect(f.nativeElement.querySelector('.muestra-scroll')).toBeNull();
        f.componentInstance.mostrarCambios.set(true); f.detectChanges();
        expect(f.nativeElement.querySelector('.muestra-scroll')).not.toBeNull();
        f.componentInstance.original();
        TestBed.inject(HttpTestingController).expectNone(r => r.url.endsWith('/original'));
    });
    it('descarga todas las diferencias por el servicio administrativo existente', () =>
    {
        const f = crear(); revisar(f);
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true });
        f.componentInstance.descargarDiferencias();
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/administracion/diferencias/banci/referencia-interna/excel')).flush(new Blob(['excel']));
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
        expect(f.componentInstance.ocupado()).toBe(false);
    });
    it('conserva el nombre del archivo original masivo al descargar', () =>
    {
        const fila = { ...pendiente, manual: false, tieneOriginal: true, nombreOriginal: 'Mi archivo BANCI.xlsx' };
        const f = crear([fila]); revisar(f, fila);
        let nombre = '';
        vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function(this: HTMLAnchorElement) { nombre = this.download; });
        f.componentInstance.original();
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/envios/referencia-interna/original')).flush(new Blob(['original']));
        expect(nombre).toBe(fila.nombreOriginal);
    });
    it('aprobar requiere confirmación y actualiza la bandeja al terminar', async () =>
    {
        const f = crear(); revisar(f);
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
        await f.componentInstance.resolver(true);
        const http = TestBed.inject(HttpTestingController);
        const req = http.expectOne(r => r.url.endsWith('/envios/referencia-interna/resolver'));
        expect(req.request.body).toEqual({ aceptar: true, motivo: '' });
        req.flush({ estado: 'CONFIRMADO' });
        http.expectOne(r => r.url.endsWith('/administracion/pendientes')).flush([]);
        expect(f.componentInstance.seleccion()).toBeNull();
        expect(f.componentInstance.filas()).toEqual([]);
    });
    it('impide rechazar sin motivo suficiente y envía el motivo al resolver', async () =>
    {
        const f = crear(); revisar(f);
        const dialogo = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: '  ' });
        await f.componentInstance.resolver(false);
        const http = TestBed.inject(HttpTestingController);
        http.expectNone(r => r.url.endsWith('/resolver'));
        expect(f.componentInstance.ocupado()).toBe(false);
        dialogo.mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false, value: '  Corregir información  ' });
        await f.componentInstance.resolver(false);
        const req = http.expectOne(r => r.url.endsWith('/resolver'));
        expect(req.request.body).toEqual({ aceptar: false, motivo: 'Corregir información' });
        req.flush({ estado: 'RECHAZADO_ADMIN' });
        http.expectOne(r => r.url.endsWith('/administracion/pendientes')).flush([]);
    });
    it('conserva la solicitud ante un fallo de resolución para permitir reintento', async () =>
    {
        const f = crear(); revisar(f);
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
        await f.componentInstance.resolver(true);
        TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/resolver')).flush({ mensaje: 'La carga ya fue resuelta.' }, { status: 409, statusText: 'Conflict' });
        await Promise.resolve();
        expect(f.componentInstance.ocupado()).toBe(false);
        expect(f.componentInstance.seleccion()?.referencia).toBe(pendiente.referencia);
        expect(f.componentInstance.mensaje()).toContain('resuelta');
    });
});
