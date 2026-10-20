import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ActualizacionService } from '../../core/services/actualizacion.service';
import { CargaValidacionResponse } from '../../core/models/carga.models';
import { Actualizacion } from './actualizacion';

const resultado = (extra: Partial<CargaValidacionResponse> = {}): CargaValidacionResponse => ({
    esValido: true,
    codigoReferencia: 'referencia',
    totalErrores: 0,
    totalAdvertencias: 0,
    mensaje: '',
    resumenValidacion: [],
    errores: [],
    advertencias: [],
    ...extra,
});
const archivo = (name: string) =>
    ({ name, size: 1, slice: () => ({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) }) }) as unknown as File;

describe('Actualización mensual con complementos BANCI', () =>
{
    let fixture: ComponentFixture<Actualizacion>;
    let component: Actualizacion;
    let api: { obtenerPeriodosDisponibles: ReturnType<typeof vi.fn>; validarActualizacion: ReturnType<typeof vi.fn> };
    beforeEach(async () =>
    {
        api = { obtenerPeriodosDisponibles: vi.fn(() => of([])), validarActualizacion: vi.fn() };
        await TestBed.configureTestingModule({
            imports: [Actualizacion],
            providers: [{ provide: ActualizacionService, useValue: api }],
        }).compileComponents();
        fixture = TestBed.createComponent(Actualizacion);
        component = fixture.componentInstance;
        await fixture.whenStable();
        component.anioCorte.set('2026');
        component.mesCorte.set('5');
        component.estadoPeriodo.set('DISPONIBLE');
        component.archivos.set({
            carpetas: archivo('carpetas.xlsx'),
            delitos: archivo('delitos.xlsx'),
            victimas: archivo('victimas.xlsx'),
        });
    });
    afterEach(() => vi.restoreAllMocks());
    it('pide complementos sin abrir diferencias ni acuse antes de completar el envío', async () =>
    {
        api.validarActualizacion.mockReturnValue(
            of(resultado({ cruceBanci: true, complementosBanci: { plantillaBase64: 'ZXhjZWw=', victimas: 3 } })),
        );
        await component.validarActualizacion();
        fixture.detectChanges();
        expect(component.estadoPeriodo()).toBe('DISPONIBLE');
        expect(component.solicitudComplementosBanci()?.victimas).toBe(3);
        expect(fixture.nativeElement.querySelector('#complementos-banci').textContent).toContain('3 nueva(s)');
        expect(component.acusePrevioUrl()).toBeNull();
        expect(component.diferencias()).toBeNull();
    });
    it('adjunta el archivo complementario y conserva la captura al recibir errores por fila', async () =>
    {
        const captura = archivo('complementos.xlsx');
        component.solicitudComplementosBanci.set({ plantillaBase64: 'ZXhjZWw=', victimas: 1 });
        component.archivoComplementosBanci.set(captura);
        api.validarActualizacion.mockReturnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: resultado({
                            esValido: false,
                            errores: [
                                {
                                    archivo: 'victimas',
                                    fila: 2,
                                    campo: 'motivo_desaparicion',
                                    columna: 'motivo_desaparicion',
                                    valor: null,
                                    codigo: 'BANCI_VALIDACION',
                                    descripcionResumen: 'Motivo',
                                    mensaje: 'Revise el motivo',
                                    totalRegistrosAfectados: 1,
                                },
                            ],
                        }),
                    }),
            ),
        );
        await component.validarActualizacion();
        fixture.detectChanges();
        expect(api.validarActualizacion.mock.calls[0][6]).toBe(captura);
        expect(component.estadoPeriodo()).toBe('VALIDADO_ERROR');
        expect(component.solicitudComplementosBanci()).not.toBeNull();
        expect(fixture.nativeElement.querySelector('#complementos-banci')).not.toBeNull();
    });
    it('descarta complementos de otro corte al cambiar el periodo', () =>
    {
        component.solicitudComplementosBanci.set({ plantillaBase64: 'ZXhjZWw=', victimas: 1 });
        component.archivoComplementosBanci.set(archivo('anterior.xlsx'));
        component.onPeriodoChange();
        expect(component.solicitudComplementosBanci()).toBeNull();
        expect(component.archivoComplementosBanci()).toBeNull();
    });
    it('bloquea los controles de complementos durante la validación', async () =>
    {
        component.solicitudComplementosBanci.set({ plantillaBase64: 'ZXhjZWw=', victimas: 1 });
        component.archivoComplementosBanci.set(archivo('complementos.xlsx'));
        api.validarActualizacion.mockReturnValue(new Subject<CargaValidacionResponse>());
        await component.validarActualizacion();
        fixture.detectChanges();
        const panel = fixture.nativeElement.querySelector('#complementos-banci');
        expect(component.estadoPeriodo()).toBe('VALIDANDO');
        expect([...panel.querySelectorAll('button,input')].every((el: unknown) => (el as HTMLInputElement).disabled)).toBe(true);
    });
});
