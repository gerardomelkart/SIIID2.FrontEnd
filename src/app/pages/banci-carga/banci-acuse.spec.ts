import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BanciCarga } from './banci-carga';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { BanciCargaValidacionResponse } from '../../core/models/banci-carga.models';

describe('Acuses BANCI', () => {
  const descargarAcuse = vi.fn();
  const estado = (valor: string) => ({ codigoReferencia: 'BANCI-prueba', estado: valor, errores: [], advertencias: [] } as unknown as BanciCargaValidacionResponse);
  beforeEach(() => {
    descargarAcuse.mockReset().mockReturnValue(of(new HttpResponse({ body: new Blob(['%PDF'], { type: 'application/pdf' }) })));
    vi.stubGlobal('URL', class { static createObjectURL = vi.fn(() => 'blob:acuse'); static revokeObjectURL = vi.fn(); });
    TestBed.configureTestingModule({ imports: [BanciCarga], providers: [{ provide: BanciCargaService, useValue: { descargarAcuse } }, { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 1, entidadFederativa: 'México' }) } }] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
  it('pide el previo y renueva el PDF al confirmar, sin duplicar peticiones', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(estado('VALIDADO_PENDIENTE')); c.abrirAcuse(); c.abrirAcuse();
    expect(descargarAcuse).toHaveBeenCalledTimes(1); expect(c.acuseUrl()).not.toBeNull();
    c.resultado.set(estado('PROCESADO')); c.abrirAcuse();
    expect(descargarAcuse).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:acuse');
  });
  it('no emite PDF para validaciones rechazadas', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set(estado('RECHAZADO_VALIDACION')); c.abrirAcuse();
    expect(descargarAcuse).not.toHaveBeenCalled();
  });
  it('no confirma vistas previas antiguas que actualizan o reutilizan registros', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    c.resultado.set({ ...estado('VALIDADO_PENDIENTE'), vistaPrevia: { huella: 'x', totalCambios: 0, cambios: [], resumen: [{ tipo: 'CARPETA', altas: 0, actualizaciones: 0, sinCambio: 1 }] } });
    expect(c.contieneExistentes()).toBe(true);
    c.confirmar(true);
    expect(c.mensajeLocal()).toContain('sólo admite carpetas nuevas');
  });
  it('permite reintentar el PDF conservando la referencia y sin reenviar archivos', () => {
    const c = TestBed.createComponent(BanciCarga).componentInstance;
    descargarAcuse.mockReturnValueOnce(throwError(() => new Error('red')));
    c.resultado.set(estado('PROCESADO')); c.abrirAcuse();
    expect(c.errorAcuse()).toContain('no vuelva a subir');
    c.abrirAcuse(true); expect(c.acuseUrl()).not.toBeNull();
    expect(c.resultado()?.codigoReferencia).toBe('BANCI-prueba');
  });
});
