import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BanciConsulta } from './banci-consulta';
import { BanciConsultaService } from '../../core/services/banci-consulta.service';
import { BanciConsultaDetalle, BanciConsultaResultado } from '../../core/models/banci-consulta.models';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';

const carpeta = { idBanciCarpetaInvestigacion: 7, idEntidadFederativa: 14, entidad: 'Jalisco',
  idCi: 'CI-7', ntraCi: 'NUC-7', fechaInicio: '2026-08-01', totalDelitos: 1, totalVictimas: 1 };
const resultado: BanciConsultaResultado = { totalCarpetas: 30, totalDelitos: 31, totalVictimas: 40,
  pagina: 1, tamanoPagina: 25, totalPaginas: 2, carpetas: [carpeta] };
const detalle: BanciConsultaDetalle = { carpeta: [{ nombre: 'ID_CI', valor: 'CI-7' }], delitos: [
  { id: 1, campos: [{ nombre: 'ID_DELITO', valor: 'D-1' }],
    victimas: [[{ nombre: 'ID_VICF', valor: 'V-1' }, { nombre: 'Nombre', valor: 'Prueba' }]] },
] };

describe('Consulta BANCI', () => {
  let service: { obtenerOpciones: ReturnType<typeof vi.fn>; consultar: ReturnType<typeof vi.fn>; obtenerDetalle: ReturnType<typeof vi.fn>; descargarExcel: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    service = {
      obtenerOpciones: vi.fn(() => of({ alcanceNacional: false, anios: [2026, 2025],
        entidades: [{ idEntidadFederativa: 14, nombre: 'Jalisco' }] })),
      consultar: vi.fn(() => of(resultado)), obtenerDetalle: vi.fn(() => of(detalle)),
      descargarExcel: vi.fn(() => of(new HttpResponse({ body: new Blob(['excel']), headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="BANCI_PRUEBA.xlsx"' }) }))),
    };
    TestBed.configureTestingModule({ imports: [BanciConsulta], providers: [{ provide: BanciConsultaService, useValue: service }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('al cambiar el mes consulta automáticamente y no muestra botón Consultar', () => {
    const f = TestBed.createComponent(BanciConsulta); f.detectChanges();
    f.debugElement.query(By.css('select[name="mes"]')).triggerEventHandler('ngModelChange', 8);
    expect(service.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ mes: 8, pagina: 1 }));
    f.detectChanges();
    expect([...f.nativeElement.querySelectorAll('button')].some((b: any) => b.textContent.trim() === 'Consultar')).toBe(false);
    expect(f.nativeElement.textContent).toContain('Descargar Excel del mes');
  });

  it('al cambiar año y entidad aplica de inmediato ambos filtros', () => {
    service.obtenerOpciones.mockReturnValue(of({ alcanceNacional: true, anios: [2026, 2025], entidades: [] }));
    const f = TestBed.createComponent(BanciConsulta); f.detectChanges();
    f.debugElement.query(By.css('select[name="anio"]')).triggerEventHandler('ngModelChange', 2025);
    f.debugElement.query(By.css('select[name="entidad"]')).triggerEventHandler('ngModelChange', 14);
    expect(service.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ anio: 2025, idEntidadFederativa: 14 }));
  });

  it('una respuesta de filtros anteriores no sobrescribe la selección actual', () => {
    const c = TestBed.createComponent(BanciConsulta).componentInstance; c.ngOnInit();
    const vieja = new Subject<BanciConsultaResultado>();
    service.consultar.mockReturnValueOnce(vieja);
    c.mes = 1; c.cambiarFiltros();
    c.mes = 2; c.cambiarFiltros();
    vieja.next({ ...resultado, totalCarpetas: 999 });
    expect(c.resultado()?.totalCarpetas).toBe(30);
    expect(c.periodoConsultado()).toBe('Febrero 2026');
  });

  it('no muestra búsqueda por carpeta ni entidad redundante a usuarios estatales', () => {
    const f = TestBed.createComponent(BanciConsulta); f.detectChanges();
    expect(f.nativeElement.querySelector('input[name="busqueda"]')).toBeNull();
    expect(f.nativeElement.querySelector('.entidad-fija')).toBeNull();
    expect([...f.nativeElement.querySelectorAll('th')].some((th: any) => th.textContent === 'Entidad')).toBe(false);
    expect(service.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ busqueda: '', idEntidadFederativa: 14 }));
  });

  it('descarga un solo Excel con los filtros aplicados y conserva el nombre del servidor', () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:prueba') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let nombre = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { nombre = this.download; });
    const c = TestBed.createComponent(BanciConsulta).componentInstance; c.ngOnInit();
    c.mes = 8; c.cambiarFiltros(); c.descargarExcel();
    expect(service.descargarExcel).toHaveBeenCalledWith(expect.objectContaining({ anio: 2026, mes: 8, idEntidadFederativa: 14 }));
    expect(nombre).toBe('BANCI_PRUEBA.xlsx');
    expect(c.exportando()).toBe(false);
  });

  it('bloquea doble descarga y cambios de filtro mientras se genera el archivo', () => {
    service.descargarExcel.mockReturnValue(new Subject());
    const c = TestBed.createComponent(BanciConsulta).componentInstance; c.ngOnInit();
    c.descargarExcel(); c.descargarExcel();
    service.consultar.mockClear(); c.cambiarFiltros();
    expect(service.descargarExcel).toHaveBeenCalledTimes(1);
    expect(service.consultar).not.toHaveBeenCalled();
    expect(c.exportando()).toBe(true);
  });

  it('un error de descarga mantiene la consulta y permite reintentar', async () => {
    service.descargarExcel.mockReturnValue(throwError(() => ({ error: { mensaje: 'No autorizado' } })));
    const c = TestBed.createComponent(BanciConsulta).componentInstance; c.ngOnInit();
    c.descargarExcel();
    expect(c.errorDescarga()).toBe('No autorizado');
    expect(c.resultado()).not.toBeNull();
    expect(c.exportando()).toBe(false);
  });

  it('consulta el último año con datos y restringe los filtros visibles al alcance recibido', () => {
    const f = TestBed.createComponent(BanciConsulta);
    f.detectChanges();
    expect(service.consultar).toHaveBeenCalledWith(expect.objectContaining({ anio: 2026, mes: null, idEntidadFederativa: 14, pagina: 1 }));
    expect(f.nativeElement.querySelector('select[name="entidad"]')).toBeNull();
    expect(f.nativeElement.querySelector('.entidad-fija')).toBeNull();
    expect(service.obtenerDetalle).not.toHaveBeenCalled();
  });

  it('permite elegir todas las entidades para alcance nacional', () => {
    service.obtenerOpciones.mockReturnValue(of({ alcanceNacional: true, anios: [2026], entidades: [] }));
    const f = TestBed.createComponent(BanciConsulta);
    f.detectChanges();
    expect(service.consultar).toHaveBeenCalledWith(expect.objectContaining({ idEntidadFederativa: null }));
    expect(f.nativeElement.querySelector('select[name="entidad"]')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('Todas las entidades');
  });

  it('filtra por mes y año y reinicia en la primera página', () => {
    const c = TestBed.createComponent(BanciConsulta).componentInstance;
    c.ngOnInit(); c.anio = 2025; c.mes = 10; c.consultar();
    expect(service.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ anio: 2025, mes: 10, busqueda: '', pagina: 1 }));
    expect(c.periodoConsultado()).toBe('Octubre 2025');
  });

  it('pagina con los filtros aplicados aunque se edite el formulario sin consultar', () => {
    const c = TestBed.createComponent(BanciConsulta).componentInstance;
    c.ngOnInit(); c.anio = 2024; c.mes = 1; c.cambiarPagina(2);
    expect(service.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ anio: 2026, mes: null, pagina: 2 }));
  });

  it('recupera el detalle sólo al solicitarlo', () => {
    const f = TestBed.createComponent(BanciConsulta);
    f.detectChanges(); f.componentInstance.abrirDetalle(carpeta); f.detectChanges();
    expect(service.obtenerDetalle).toHaveBeenCalledWith(7);
    expect(f.nativeElement.textContent).toContain('Datos de la carpeta');
    expect(f.nativeElement.textContent).toContain('Prueba');
  });

  it('cancelar un detalle impide que una respuesta tardía vuelva a mostrarlo', () => {
    const pendiente = new Subject<BanciConsultaDetalle>();
    service.obtenerDetalle.mockReturnValue(pendiente);
    const c = TestBed.createComponent(BanciConsulta).componentInstance;
    c.abrirDetalle(carpeta); c.cerrarDetalle(); pendiente.next(detalle);
    expect(c.detalle()).toBeNull(); expect(c.carpetaSeleccionada()).toBeNull();
  });

  it('una respuesta denegada no conserva información del detalle anterior', () => {
    const c = TestBed.createComponent(BanciConsulta).componentInstance;
    c.abrirDetalle(carpeta);
    service.obtenerDetalle.mockReturnValue(throwError(() => ({ status: 404, error: { mensaje: 'No disponible' } })));
    c.abrirDetalle({ ...carpeta, idBanciCarpetaInvestigacion: 99 });
    expect(c.detalle()).toBeNull(); expect(c.errorDetalle()).toBe('No disponible');
  });

  it('si la consulta falla limpia los resultados anteriores', () => {
    const c = TestBed.createComponent(BanciConsulta).componentInstance;
    c.ngOnInit(); service.consultar.mockReturnValue(throwError(() => ({ status: 403 })));
    c.consultar(); expect(c.resultado()).toBeNull(); expect(c.error()).not.toBe('');
  });

  it('distingue una consulta sin registros de un error', () => {
    service.consultar.mockReturnValue(of({ ...resultado, totalCarpetas: 0, totalDelitos: 0, totalVictimas: 0, totalPaginas: 0, carpetas: [] }));
    const f = TestBed.createComponent(BanciConsulta); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No hay carpetas');
    expect(f.componentInstance.error()).toBe('');
  });
});
