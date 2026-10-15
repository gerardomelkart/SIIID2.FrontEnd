import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { BanciCaptura } from './banci-captura';
const opciones = {
    entidades: [{ id: 9, nombre: 'Ciudad de México' }],
    mes: 9,
    anio: 2026,
    cortesAnteriores: false,
    complementos: ['nomb', 'curp', 'localizado_o_no_localizado', 'constitutiva_delito', 'motivo_desaparicion'],
    columnas: { carpetas: [], delitos: [], victimas: [] },
    catalogos: {
        localizacion: [
            { clave: '45', codigo: 'LOCALIZADO' },
            { clave: '49', codigo: 'NO_LOCALIZADO' },
        ],
        motivos: [{ condicion: 17, clave: '4', descripcion: 'Motivo desde BD' }],
    },
};
describe('Carga BANCI por cortes', () =>
{
    beforeEach(() =>
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ActivatedRoute, useValue: { snapshot: { data: { manual: true, actualizacion: false } } } },
            ],
        }),
    );
    afterEach(() => TestBed.inject(HttpTestingController).verify());
    function crear()
    {
        const fixture = TestBed.createComponent(BanciCaptura);
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/opciones'))
            .flush(opciones);
        fixture.detectChanges();
        return fixture;
    }
    it('usa el corte del servidor y bloquea su selección al desactivar históricos', async () =>
    {
        const f = crear();
        expect(f.componentInstance.mes).toBe(9);
        expect(f.componentInstance.anio).toBe(2026);
        await f.whenStable();
        f.detectChanges();
        const numeros = f.nativeElement.querySelectorAll('input[type="number"]');
        expect(numeros[0].disabled).toBe(true);
        expect(numeros[1].disabled).toBe(true);
    });
    it('no muestra registros inventados cuando la precarga falla', () =>
    {
        const f = crear();
        f.componentInstance.precargar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga'))
            .flush({ mensaje: 'Sin consolidado aceptado' }, { status: 400, statusText: 'Bad Request' });
        expect(f.componentInstance.libro()).toBeNull();
        expect(f.componentInstance.mensaje()).toContain('Sin consolidado');
    });
    it('resuelve motivos y estados con claves de catálogo diferentes', () =>
    {
        const f = crear();
        const fila = {
            numeroFila: 2,
            columnas: { constitutiva_delito: '17', motivo_desaparicion: '4', fecha_localizacion: '2026-09-01' } as Record<string, string>,
        };
        expect(f.componentInstance.catalogo('motivo_desaparicion', fila)?.[0].descripcion).toBe('Motivo desde BD');
        f.componentInstance.editar('constitutiva_delito', fila, '18');
        expect(fila.columnas['motivo_desaparicion']).toBe('');
        f.componentInstance.editar('localizado_o_no_localizado', fila, '49');
        expect(fila.columnas['fecha_localizacion']).toBe('');
    });
    it('envía los datos por el endpoint manual y conserva los errores por fila', () =>
    {
        const f = crear();
        f.componentInstance.libro.set({ entidad: 9, mes: 9, anio: 2026, actualizacion: false, carpetas: [], delitos: [], victimas: [] });
        f.componentInstance.validar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/validar/manual'))
            .flush({ esValido: false, errores: [{ archivo: 'victimas', fila: 2, campo: 'curp', mensaje: 'CURP inválida' }] });
        expect(f.componentInstance.errores()[0].campo).toBe('curp');
        expect(f.componentInstance.validacion()).toBeNull();
    });
});
