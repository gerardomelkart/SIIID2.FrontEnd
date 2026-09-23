import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BanciCarga } from './banci-carga';
import { BanciFormulario } from '../banci-formulario/banci-formulario';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { BanciCargaValidacionResponse } from '../../core/models/banci-carga.models';

const carga = (estado = 'VALIDADO_PENDIENTE'): BanciCargaValidacionResponse => ({ idBanciCarga: 1, estado, fechaCarga: null, aceptadaUsuario: null, idUsuarioConfirmacion: null, fechaConfirmacion: null, yaResuelta: false, totalAltas: 3, totalActualizaciones: 0, totalSinCambio: 0, totalAdvertencias: 0, esValido: true, codigoReferencia: 'BANCI-prueba', modalidadIngreso: 'LIBRO', totalCarpetas: 1, totalDelitos: 1, totalVictimas: 1, mensaje: 'Validada', errores: [], advertencias: [], vistaPrevia: { huella: 'huella', puedeAceptar: true, totalCambios: 0, resumen: [{ tipo: 'CARPETA', altas: 1, actualizaciones: 0, sinCambio: 0 }], cambios: [] } });

for (const [componente, tipo] of [[BanciCarga, 'carga'], [BanciFormulario, 'formulario']] as const) {
  describe(`Presentación y recuperación de ${tipo} BANCI`, () => {
    let api: Record<string, ReturnType<typeof vi.fn>>;
    const clave = `siiid_banci_${tipo}_1`;
    const crear = () => TestBed.createComponent(componente as Type<BanciCarga | BanciFormulario>);

    beforeEach(() => {
      localStorage.clear();
      api = { obtenerFormularioOpciones: vi.fn(() => of({ esSuperUsuario: false, idEntidadFederativa: 14, catalogos: [] })), obtenerCarga: vi.fn(() => of(carga())), confirmar: vi.fn(() => of(carga('PROCESADO'))), obtenerResumen: vi.fn(() => of([])) };
      TestBed.configureTestingModule({ imports: [componente], providers: [provideRouter([]), { provide: BanciCargaService, useValue: api }, { provide: SessionService, useValue: { usuario: () => ({ idUsuario: 1, rol: 'ENLACE_ESTATAL' }) } }] });
      Element.prototype.scrollIntoView = vi.fn();
    });

    it('no reabre una referencia antigua que ya fue integrada', () => {
      localStorage.setItem(clave, 'BANCI-prueba');
      api['obtenerCarga'].mockReturnValue(of(carga('PROCESADO')));
      const f = crear();
      f.detectChanges();
      expect(f.componentInstance.resultado()).toBeNull();
      expect(localStorage.getItem(clave)).toBeNull();
    });

    it('elimina la referencia al confirmar sin perder el resumen visible', () => {
      localStorage.setItem(clave, 'BANCI-prueba');
      const f = crear();
      f.detectChanges();
      f.componentInstance.confirmar(true);
      expect(f.componentInstance.resultado()?.estado).toBe('PROCESADO');
      expect(localStorage.getItem(clave)).toBeNull();
    });

    it('conserva la referencia pendiente si falla la recuperación', () => {
      localStorage.setItem(clave, 'BANCI-prueba');
      api['obtenerCarga'].mockReturnValue(throwError(() => ({ status: 0 })));
      const f = crear();
      f.detectChanges();
      expect(localStorage.getItem(clave)).toBe('BANCI-prueba');
      expect(f.componentInstance.necesitaActualizar()).toBe(true);
    });

    it('muestra confirmación limpia sin botones para advertencias inexistentes', () => {
      const f = crear();
      f.detectChanges();
      f.componentInstance.resultado.set(carga());
      f.detectChanges();
      const botones = Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).map(b => b.textContent?.trim() || '');
      expect(botones.some(t => /Revisar y decidir|Ver advertencias|Volver a las advertencias|Regresar y revisar/.test(t))).toBe(false);
      expect(botones.some(t => /Aceptar/.test(t))).toBe(true);
      expect(f.nativeElement.textContent).toContain('Sin errores ni advertencias');
    });
  });
}

describe('Distribución de plantillas BANCI', () => {
  it('coloca las plantillas fuera del formulario en el panel lateral 8/4', () => {
    TestBed.configureTestingModule({ imports: [BanciCarga], providers: [{ provide: SessionService, useValue: { usuario: () => ({ idUsuario: 1 }) } }, { provide: BanciCargaService, useValue: { obtenerFormularioOpciones: () => of({ esSuperUsuario: false, idEntidadFederativa: 14, catalogos: [] }) } }] });
    localStorage.clear();
    const f = TestBed.createComponent(BanciCarga);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.row > .col-xl-8 .carga-form')).not.toBeNull();
    expect(f.nativeElement.querySelectorAll('.row > aside.col-xl-4 .plantilla-link').length).toBe(4);
    expect(f.nativeElement.querySelector('.carga-form .plantillas-body')).toBeNull();
  });
});
