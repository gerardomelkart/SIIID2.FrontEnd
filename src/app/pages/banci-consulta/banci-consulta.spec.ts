import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BanciConsulta } from './banci-consulta';
import { BanciConsultaService } from '../../core/services/banci-consulta.service';
import { BanciConsultaDetalle, BanciConsultaResultado } from '../../core/models/banci-consulta.models';

const carpeta = { idBanciCarpetaInvestigacion: 7, idEntidadFederativa: 14, entidad: 'Jalisco',
  idCi: 'CI-7', ntraCi: 'NUC-7', fechaInicio: '2026-08-01', totalDelitos: 1, totalVictimas: 1 };
const resultado: BanciConsultaResultado = { totalCarpetas: 30, totalDelitos: 31, totalVictimas: 40,
  pagina: 1, tamanoPagina: 25, totalPaginas: 2, carpetas: [carpeta] };
const detalle: BanciConsultaDetalle = { carpeta: [{ nombre: 'ID_CI', valor: 'CI-7' }], delitos: [
  { id: 1, campos: [{ nombre: 'ID_DELITO', valor: 'D-1' }],
    victimas: [[{ nombre: 'ID_VICF', valor: 'V-1' }, { nombre: 'Nombre', valor: 'Prueba' }]] },
] };

describe('Consulta BANCI', () => {
  let service: { obtenerOpciones: ReturnType<typeof vi.fn>; consultar: ReturnType<typeof vi.fn>; obtenerDetalle: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    service = {
      obtenerOpciones: vi.fn(() => of({ alcanceNacional: false, anios: [2026, 2025],
        entidades: [{ idEntidadFederativa: 14, nombre: 'Jalisco' }] })),
      consultar: vi.fn(() => of(resultado)), obtenerDetalle: vi.fn(() => of(detalle)),
    };
    TestBed.configureTestingModule({ imports: [BanciConsulta], providers: [{ provide: BanciConsultaService, useValue: service }] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('consulta el último año con datos y restringe los filtros visibles al alcance recibido', () => {
    const f = TestBed.createComponent(BanciConsulta);
    f.detectChanges();
    expect(service.consultar).toHaveBeenCalledWith(expect.objectContaining({ anio: 2026, mes: null, idEntidadFederativa: 14, pagina: 1 }));
    expect(f.nativeElement.querySelector('select[name="entidad"]')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Jalisco');
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
    c.ngOnInit(); c.anio = 2025; c.mes = 10; c.busqueda = ' CI-7 '; c.consultar();
    expect(service.consultar).toHaveBeenLastCalledWith(expect.objectContaining({ anio: 2025, mes: 10, busqueda: 'CI-7', pagina: 1 }));
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
