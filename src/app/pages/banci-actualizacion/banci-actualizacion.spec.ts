import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BanciActualizacion } from './banci-actualizacion';
import { BanciActualizacionService } from '../../core/services/banci-actualizacion.service';
import { SessionService } from '../../core/services/session.service';
import { BanciActualizacionResultado, BanciActualizacionVictima } from '../../core/models/banci-actualizacion.models';

const errorFecha = { archivo: 'actualizacion', hoja: null, valor: null, numeroFila: 5, campo: 'fecha_localizacion', codigo: 'BANCI_FECHA_LOCALIZACION', mensaje: 'Fecha posterior a hoy.' };
const respuesta = (estado = 'NO_VALIDADA'): BanciActualizacionResultado => ({ esValido: false, codigoReferencia: estado === 'PENDIENTE' ? 'referencia-prueba' : null, estado, huella: null, cambios: [], datosPropuestos: [], errores: [errorFecha], advertencias: [] });
const victima = { id_banci_victima: 1, no_banci: 'BANCI/14/2026/000001', id_delito: '1', id_vicf: '1', fha_de_ini: '2026-01-10', fha_de_hchos: '2026-01-01', folio_rnpdno: '123' } as BanciActualizacionVictima;

describe('Corrección y recuperación BANCI', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    localStorage.clear();
    api = { obtenerOpciones: vi.fn(() => of({ esSuperUsuario: false, idEntidadFederativa: 14, catalogos: [] })), obtenerPendientes: vi.fn(() => of([])), validarFormulario: vi.fn(() => throwError(() => ({ status: 400, error: respuesta() }))), confirmar: vi.fn(), obtenerEstado: vi.fn(), obtenerVistaPrevia: vi.fn() };
    TestBed.configureTestingModule({ imports: [BanciActualizacion], providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: { modalidad: 'manual' } } } }, { provide: BanciActualizacionService, useValue: api }, { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 1 }) } }] });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('oculta el formulario después de errores y exige volver a corregir', () => {
    const fixture = TestBed.createComponent(BanciActualizacion);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.seleccionar(victima);
    c.edicion = { fecha_localizacion: '2099-01-01' };
    c.validarFormulario();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('#resultado-actualizacion')).not.toBeNull();
    c.validarFormulario();
    expect(api['validarFormulario']).toHaveBeenCalledTimes(1);
    c.regresarAEdicion(errorFecha);
    fixture.detectChanges();
    expect(c.edicion['fecha_localizacion']).toBe('2099-01-01');
    expect(fixture.nativeElement.querySelector('#actualizar-fecha_localizacion')).not.toBeNull();
  });

  it('no libera la edición si falla el rechazo pendiente', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    c.resultado.set(respuesta('PENDIENTE'));
    c.referencia.set('referencia-prueba');
    c.edicion = { curp: 'DATOS' };
    api['confirmar'].mockReturnValue(throwError(() => ({ status: 0 })));
    c.regresarAEdicion();
    expect(c.necesitaActualizar()).toBe(true);
    expect(c.referencia()).toBe('referencia-prueba');
    expect(c.pendiente()).toBe(true);
    expect(c.edicion['curp']).toBe('DATOS');
  });

  it('rechaza antes de habilitar la edición y conserva lo capturado', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    const rechazo = new Subject<{ estado: string }>();
    c.seleccionar(victima);
    c.edicion = { obs: 'Conservar' };
    c.resultado.set(respuesta('PENDIENTE'));
    c.referencia.set('referencia-prueba');
    api['confirmar'].mockReturnValue(rechazo);
    c.regresarAEdicion();
    expect(c.puedeSalir()).toBe(false);
    expect(c.resultado()).not.toBeNull();
    rechazo.next({ estado: 'RECHAZADA' });
    expect(c.resultado()).toBeNull();
    expect(c.edicion['obs']).toBe('Conservar');
    expect(c.puedeSalir()).toBe(true);
  });

  it('conserva referencia recuperable cuando falla la consulta de estado', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    api['obtenerEstado'].mockReturnValue(throwError(() => ({ status: 0 })));
    c.recuperar('referencia-prueba');
    expect(c.referencia()).toBe('referencia-prueba');
    expect(c.necesitaActualizar()).toBe(true);
    expect(localStorage.getItem('siiid_banci_actualizacion_1')).toBe('referencia-prueba');
  });

  it('permite rechazar una revisión pendiente que ya incumple las fechas', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    api['obtenerEstado'].mockReturnValue(of([{ estado: 'PENDIENTE', origen: 'FORMULARIO', idEntidadFederativa: 14 }]));
    api['obtenerVistaPrevia'].mockReturnValue(throwError(() => ({ status: 400, error: { mensaje: 'Fecha incompatible' } })));
    c.recuperar('referencia-prueba');
    expect(c.pendiente()).toBe(true);
    expect(c.resultado()?.huella).toBeNull();
    expect(c.necesitaActualizar()).toBe(false);
    api['confirmar'].mockReturnValue(of({ estado: 'RECHAZADA' }));
    c.regresarAEdicion();
    expect(c.resultado()).toBeNull();
  });

  it('redirige una recuperación de Excel a su vista masiva', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    api['obtenerEstado'].mockReturnValue(of([{ estado: 'PENDIENTE', origen: 'EXCEL', idEntidadFederativa: 14 }]));
    c.recuperar('referencia-prueba');
    expect(navegar).toHaveBeenCalledWith('/banci/actualizacion/masiva');
    expect(api['obtenerVistaPrevia']).not.toHaveBeenCalled();
  });

  it('convierte CURP y RFC en el input y en los datos enviados', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    const input = document.createElement('input');
    input.value = 'abcd010101xxx';
    c.capturarTexto('rfc', { target: input } as unknown as Event);
    expect(input.value).toBe('ABCD010101XXX');
    expect(c.edicion['rfc']).toBe('ABCD010101XXX');
    c.capturarTexto('curp', { target: input } as unknown as Event);
    expect(c.edicion['curp']).toBe('ABCD010101XXX');
  });

  it('no vuelve a mostrar una actualización ya resuelta al entrar', () => {
    localStorage.setItem('siiid_banci_actualizacion_1', 'referencia-prueba');
    api['obtenerEstado'].mockReturnValue(of([{ estado: 'INTEGRADA', origen: 'EXCEL', idEntidadFederativa: 14 }]));
    const f = TestBed.createComponent(BanciActualizacion);
    f.detectChanges();
    expect(f.componentInstance.confirmacion()).toBeNull();
    expect(f.componentInstance.resultado()).toBeNull();
    expect(localStorage.getItem('siiid_banci_actualizacion_1')).toBeNull();
  });

  it('no repite la operación actual en pendientes ni muestra revisar sin observaciones', () => {
    const f = TestBed.createComponent(BanciActualizacion);
    f.detectChanges();
    const c = f.componentInstance;
    c.resultado.set({ ...respuesta('PENDIENTE'), esValido: true, errores: [], huella: 'prueba' });
    c.referencia.set('referencia-prueba');
    c.pendientes.set([{ codigoReferencia: 'referencia-prueba', estado: 'PENDIENTE', origen: 'FORMULARIO', idEntidadFederativa: 14, fechaRegistro: '2026-09-23', fechaDecision: null, totalCambios: 0 }]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.pendiente-item')).toBeNull();
    const botones = Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).map(b => b.textContent || '');
    expect(botones.some(t => /Revisar|Regresar y revisar/.test(t))).toBe(false);
    expect(f.nativeElement.textContent).toContain('Sin errores ni advertencias');
  });

  it('usa la tarjeta de arrastre de carga y el panel lateral de plantillas en masiva', () => {
    const f = TestBed.createComponent(BanciActualizacion);
    f.detectChanges();
    f.componentInstance.modalidad.set('masiva');
    f.detectChanges();
    expect(f.nativeElement.querySelector('.col-xl-8 .file-upload-card input.file-input')).not.toBeNull();
    expect(f.nativeElement.querySelector('aside.col-xl-4 .plantilla-link')).not.toBeNull();
    expect(f.nativeElement.querySelector('.zona-archivo-banci')).toBeNull();
  });

  it('rechaza arrastrar varios Excel en vez de seleccionar silenciosamente el primero', () => {
    const c = TestBed.createComponent(BanciActualizacion).componentInstance;
    const archivo = new File(['prueba'], 'actualizacion.xlsx');
    c.soltarArchivo({ preventDefault: vi.fn(), stopPropagation: vi.fn(), dataTransfer: { files: { length: 2, item: () => archivo } } } as unknown as DragEvent);
    expect(c.archivo).toBeNull();
    expect(c.mensaje()).toContain('un solo archivo');
  });
});
