import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BanciFormulario } from './banci-formulario';
import { BanciCampos } from './banci-campos';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { BanciCargaValidacionResponse } from '../../core/models/banci-carga.models';

const pendiente: BanciCargaValidacionResponse = { idBanciCarga: 1, estado: 'VALIDADO_PENDIENTE', esValido: true, codigoReferencia: 'BANCI-prueba', modalidadIngreso: 'FORMULARIO', fechaCarga: null, aceptadaUsuario: null, idUsuarioConfirmacion: null, fechaConfirmacion: null, yaResuelta: false, totalCarpetas: 1, totalDelitos: 1, totalVictimas: 1, totalAltas: 0, totalActualizaciones: 0, totalSinCambio: 0, totalAdvertencias: 0, mensaje: 'Pendiente', errores: [], advertencias: [] };

describe('Formulario BANCI', () => {
  let service: any;
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
    service = {
      obtenerFormularioOpciones: vi.fn(() => of({ esSuperUsuario: false, idEntidadFederativa: 14, catalogos: [] })),
      validarFormulario: vi.fn(() => of(pendiente)), confirmar: vi.fn(() => of({ ...pendiente, estado: 'PROCESADO', totalAltas: 3 })),
      obtenerCarga: vi.fn(() => of(pendiente)),
    };
    TestBed.configureTestingModule({ imports: [BanciFormulario], providers: [{ provide: BanciCargaService, useValue: service }, { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 7 }) } }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); vi.restoreAllMocks(); });

  it('no presenta entidad de reporte al estatal y no envía una entidad manipulada', () => {
    const f = TestBed.createComponent(BanciFormulario); f.detectChanges();
    expect(f.nativeElement.querySelector('[name="entidadReporte"]')).toBeNull();
    f.componentInstance.entidad = 32;
    f.componentInstance.validar();
    expect(service.validarFormulario).toHaveBeenCalledWith(expect.objectContaining({ idEntidadFederativa: null }));
  });

  it('requiere que el superusuario elija la entidad de reporte', () => {
    service.obtenerFormularioOpciones.mockReturnValue(of({ esSuperUsuario: true, idEntidadFederativa: null, catalogos: [] }));
    const f = TestBed.createComponent(BanciFormulario); f.detectChanges();
    expect(f.nativeElement.querySelector('[name="entidadReporte"]')).not.toBeNull();
    f.componentInstance.validar(); expect(service.validarFormulario).not.toHaveBeenCalled();
    f.componentInstance.entidad = 14; f.componentInstance.validar();
    expect(service.validarFormulario).toHaveBeenCalledWith(expect.objectContaining({ idEntidadFederativa: 14 }));
  });

  it('asocia varias víctimas a su delito sin pedir llaves redundantes', () => {
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit();
    c.carpeta = { id_ci: 'CI-1' };
    c.delitos[0].datos = { id_delito: 'D-1' }; c.agregarVictima(c.delitos[0]); c.agregarDelito();
    c.delitos[1].datos = { id_delito: 'D-2' };
    c.validar();
    const enviado = service.validarFormulario.mock.calls[0][0];
    expect(enviado.delitos).toHaveLength(2); expect(enviado.delitos[0].victimas).toHaveLength(2);
    expect(enviado.delitos[0].victimas[0]).not.toHaveProperty('id_ci');
    expect(enviado.delitos[0].victimas[0]).not.toHaveProperty('id_delito');
    expect(c.camposVictima.map(x => x.clave)).not.toContain('no_banci');
  });

  it('validar nunca integra automáticamente y bloquea cambios hasta la decisión', () => {
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit(); c.validar();
    expect(service.confirmar).not.toHaveBeenCalled(); expect(c.pendiente()).toBe(true);
    c.agregarDelito(); c.agregarVictima(c.delitos[0]); c.validar(); c.nuevaCaptura();
    expect(c.delitos).toHaveLength(1); expect(c.totalVictimas()).toBe(1);
    expect(service.validarFormulario).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('siiid_banci_formulario_7')).toBe('BANCI-prueba');
  });

  it('mantiene lo capturado ante errores de validación y permite corregir', () => {
    service.validarFormulario.mockReturnValue(throwError(() => ({ error: { ...pendiente, estado: '', esValido: false, errores: [{ mensaje: 'Duplicado' }] } })));
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit(); c.carpeta['id_ci'] = 'CI-1'; c.validar();
    expect(c.carpeta['id_ci']).toBe('CI-1'); expect(c.bloqueado()).toBe(false);
    expect(c.resultado()?.errores[0].mensaje).toBe('Duplicado');
  });

  it('no permite quitar el último delito o la última víctima', () => {
    const c = TestBed.createComponent(BanciFormulario).componentInstance;
    c.quitarVictima(c.delitos[0], 0); c.quitarDelito(0);
    expect(c.delitos).toHaveLength(1); expect(c.totalVictimas()).toBe(1);
  });

  it('una respuesta perdida en confirmación obliga a recuperar estado', () => {
    service.confirmar.mockReturnValue(throwError(() => ({ status: 0 })));
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit(); c.validar(); c.confirmar(true); c.confirmar(true);
    expect(c.necesitaActualizar()).toBe(true); expect(service.confirmar).toHaveBeenCalledTimes(1);
    c.actualizarEstado(); expect(c.necesitaActualizar()).toBe(false);
  });

  it('recupera sólo la referencia del formulario del usuario actual sin almacenar datos personales', () => {
    localStorage.setItem('siiid_banci_formulario_7', 'BANCI-prueba'); localStorage.setItem('siiid_banci_carga_7', 'OTRA-REFERENCIA');
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit();
    expect(service.obtenerCarga).toHaveBeenCalledWith('BANCI-prueba'); expect(c.pendiente()).toBe(true);
    expect(c.carpeta).toEqual({});
  });

  it('un duplicado detectado al confirmar permite rechazar la captura pendiente', () => {
    service.confirmar.mockReturnValueOnce(throwError(() => ({ error: { codigo: 'BANCI_52424', mensaje: 'Ya existe' } })));
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit(); c.validar(); c.confirmar(true);
    expect(c.necesitaActualizar()).toBe(false); expect(c.mensaje()).toBe('Ya existe'); c.confirmar(false);
    expect(service.confirmar).toHaveBeenLastCalledWith('BANCI-prueba', false);
  });

  it('un doble clic no duplica la validación ni la confirmación', () => {
    const validacion = new Subject<BanciCargaValidacionResponse>(); service.validarFormulario.mockReturnValue(validacion);
    const c = TestBed.createComponent(BanciFormulario).componentInstance; c.ngOnInit(); c.validar(); c.validar();
    expect(service.validarFormulario).toHaveBeenCalledTimes(1); validacion.next(pendiente);
    service.confirmar.mockReturnValue(new Subject()); c.confirmar(true); c.confirmar(true);
    expect(service.confirmar).toHaveBeenCalledTimes(1);
  });
});

describe('Catálogos del formulario BANCI', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('limpia municipio y nombres dependientes al cambiar la entidad de los hechos', () => {
    TestBed.configureTestingModule({ imports: [BanciCampos] });
    const f = TestBed.createComponent(BanciCampos);
    const datos = { id_ent_hchos: '14', id_mun_hchos: '001', nom_ent_hchos: 'Jalisco', nom_mun_hchos: 'Anterior' };
    f.componentRef.setInput('datos', datos); f.componentRef.setInput('campos', []);
    f.componentRef.setInput('catalogos', [
      { campo: 'id_ent_hchos', clave: '15', descripcion: 'México', idEntidadFederativa: 15 },
      { campo: 'id_mun_hchos', clave: '002', descripcion: 'Destino', idEntidadFederativa: 15 },
      { campo: 'id_mun_hchos', clave: '001', descripcion: 'Anterior', idEntidadFederativa: 14 },
    ]);
    f.componentInstance.cambiar('id_ent_hchos', '15');
    expect(datos.id_mun_hchos).toBe(''); expect(datos.nom_mun_hchos).toBe(''); expect(datos.nom_ent_hchos).toBe('México');
    expect(f.componentInstance.opciones('id_mun_hchos')).toHaveLength(1);
  });
});
