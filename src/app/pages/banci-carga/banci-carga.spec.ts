import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BanciCarga } from './banci-carga';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { BanciCargaValidacionResponse } from '../../core/models/banci-carga.models';

function carga(estado = 'VALIDADO_PENDIENTE', advertencias = 0): BanciCargaValidacionResponse {
  return {
    idBanciCarga: 7, codigoReferencia: 'BANCI_PRUEBA_7', modalidadIngreso: 'LIBRO_EXCEL',
    estado, fechaCarga: '2026-09-16T10:00:00', aceptadaUsuario: null,
    idUsuarioConfirmacion: null, fechaConfirmacion: null, yaResuelta: false,
    esValido: true, totalCarpetas: 210, totalDelitos: 210, totalVictimas: 249,
    totalAltas: 0, totalActualizaciones: 0, totalSinCambio: 0,
    totalAdvertencias: advertencias, mensaje: 'Resultado guardado', errores: [],
    advertencias: Array.from({ length: advertencias }, (_, i) => ({
      archivo: 'victimas', hoja: null, numeroFila: i + 2, campo: 'curp', valor: '',
      codigo: 'ADVERTENCIA_PRUEBA', mensaje: 'Revise este dato',
    })),
  };
}

describe('BANCI: decisión explícita de la propia carga', () => {
  let servicio: {
    validarLibro: ReturnType<typeof vi.fn>;
    validarArchivos: ReturnType<typeof vi.fn>;
    obtenerPendientes: ReturnType<typeof vi.fn>;
    obtenerCarga: ReturnType<typeof vi.fn>;
    confirmar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    servicio = {
      validarLibro: vi.fn(() => of(carga())), validarArchivos: vi.fn(() => of(carga())),
      obtenerPendientes: vi.fn(() => of([])), obtenerCarga: vi.fn(() => of(carga())),
      confirmar: vi.fn(() => of(carga('PROCESADO'))),
    };
    TestBed.configureTestingModule({
      imports: [BanciCarga],
      providers: [
        { provide: BanciCargaService, useValue: servicio },
        { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 20 }) } },
      ],
    });
  });

  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it.each([0, 641])('validar con %i advertencias no integra automáticamente', (advertencias) => {
    servicio.validarLibro.mockReturnValue(of(carga('VALIDADO_PENDIENTE', advertencias)));
    const fixture = TestBed.createComponent(BanciCarga);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.archivoLibro = new File(['ejemplo'], 'BANCI.xlsx');
    c.procesar();
    fixture.detectChanges();
    expect(c.pendiente()).toBe(true);
    expect(c.resultadoCorrecto()).toBeNull();
    expect(c.advertencias()).toHaveLength(advertencias);
    expect(servicio.confirmar).not.toHaveBeenCalled();
    const html = fixture.nativeElement.textContent;
    expect(html).toContain('Aceptar e integrar carga');
    expect(html).toContain('Rechazar carga');
    expect(html).not.toContain('Carga BANCI procesada');
    if (advertencias) expect(html).toContain('Revise este dato');
  });

  it('envía tres archivos por la misma validación pendiente', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.archivoCarpetas = new File([''], 'carpetas.csv');
    c.archivoDelitos = new File([''], 'delitos.csv');
    c.archivoVictimas = new File([''], 'victimas.csv');
    c.procesar();
    expect(servicio.validarArchivos).toHaveBeenCalledTimes(1);
    expect(servicio.validarLibro).not.toHaveBeenCalled();
    expect(c.pendiente()).toBe(true);
  });

  it('no permite confirmar una validación con errores', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set({ ...carga(), esValido: false, errores: [carga('', 1).advertencias[0]] });
    c.confirmar(true);
    expect(servicio.confirmar).not.toHaveBeenCalled();
  });

  it('aceptar conserva las advertencias y muestra los totales reales', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(carga('VALIDADO_PENDIENTE', 641));
    servicio.confirmar.mockReturnValue(of({ ...carga('PROCESADO_CON_ADVERTENCIAS'), totalSinCambio: 669 }));
    c.confirmar(true);
    expect(servicio.confirmar).toHaveBeenCalledWith('BANCI_PRUEBA_7', true);
    expect(c.resultadoCorrecto()?.totalSinCambio).toBe(669);
    expect(c.advertencias()).toHaveLength(641);
    expect(c.pendiente()).toBe(false);
  });

  it('rechazar no presenta una integración exitosa ni permite volver a decidir', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(carga());
    servicio.confirmar.mockReturnValue(of(carga('RECHAZADO_VALIDACION')));
    c.confirmar(false);
    expect(servicio.confirmar).toHaveBeenCalledWith('BANCI_PRUEBA_7', false);
    expect(c.rechazado()).toBe(true);
    expect(c.resultadoCorrecto()).toBeNull();
    c.confirmar(true);
    expect(servicio.confirmar).toHaveBeenCalledTimes(1);
  });

  it('bloquea doble clic durante confirmación', () => {
    const respuesta = new Subject<BanciCargaValidacionResponse>();
    servicio.confirmar.mockReturnValue(respuesta);
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(carga());
    c.confirmar(true);
    c.confirmar(true);
    c.confirmar(false);
    expect(servicio.confirmar).toHaveBeenCalledTimes(1);
    expect(c.cargando()).toBe(true);
    respuesta.next(carga('PROCESADO'));
    expect(c.cargando()).toBe(false);
  });

  it('ante respuesta perdida obliga a recuperar, sin reenviar archivos ni confirmar otra vez', () => {
    servicio.confirmar.mockReturnValue(throwError(() => ({ status: 0 })));
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(carga());
    c.confirmar(true);
    expect(c.necesitaActualizar()).toBe(true);
    expect(c.resultadoCorrecto()).toBeNull();
    c.confirmar(true);
    c.prepararNuevaValidacion();
    expect(c.pendiente()).toBe(true);
    expect(servicio.confirmar).toHaveBeenCalledTimes(1);
    servicio.obtenerCarga.mockReturnValue(of(carga('PROCESADO')));
    c.recuperarCarga('BANCI_PRUEBA_7');
    expect(c.resultadoCorrecto()).not.toBeNull();
    expect(c.necesitaActualizar()).toBe(false);
    expect(servicio.validarLibro).not.toHaveBeenCalled();
  });

  it('consulta al servidor al recargar; guarda sólo referencia y separada por usuario', () => {
    localStorage.setItem('siiid_banci_carga_20', 'BANCI_PRUEBA_7');
    localStorage.setItem('siiid_banci_carga_99', 'AJENA');
    const fixture = TestBed.createComponent(BanciCarga);
    fixture.detectChanges();
    expect(servicio.obtenerCarga).toHaveBeenCalledWith('BANCI_PRUEBA_7');
    expect(servicio.obtenerCarga).not.toHaveBeenCalledWith('AJENA');
    expect(localStorage.getItem('siiid_banci_carga_20')).toBe('BANCI_PRUEBA_7');
    expect(servicio.confirmar).not.toHaveBeenCalled();
  });

  it('recupera pendientes si se pierde la respuesta de validación', () => {
    servicio.validarLibro.mockReturnValue(throwError(() => ({ status: 0 })));
    servicio.obtenerPendientes.mockReturnValue(of([carga()]));
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.archivoLibro = new File([''], 'BANCI.xlsx');
    c.procesar();
    expect(c.pendientes()).toHaveLength(1);
    expect(servicio.validarLibro).toHaveBeenCalledTimes(1);
    expect(servicio.confirmar).not.toHaveBeenCalled();
  });

  it('recuperar otra referencia exige respuesta del servidor y conserva todas las advertencias', () => {
    servicio.obtenerCarga.mockReturnValue(of(carga('VALIDADO_PENDIENTE', 641)));
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.recuperarCarga('BANCI_PRUEBA_7');
    expect(c.advertencias()).toHaveLength(641);
    expect(c.pendiente()).toBe(true);
  });

  it('no permite nueva validación sobre una carga pendiente', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(carga());
    c.prepararNuevaValidacion();
    c.procesar();
    expect(c.pendiente()).toBe(true);
    expect(servicio.validarLibro).not.toHaveBeenCalled();
    expect(servicio.validarArchivos).not.toHaveBeenCalled();
  });
});
