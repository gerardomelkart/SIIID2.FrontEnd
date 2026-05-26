import { Component, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';

import { CargaService } from '../../core/services/carga.service';
import {
  CargaValidacionError,
  CargaValidacionResponse,
  CargaValidacionResumenItem
} from '../../core/models/carga.models';

type EstadoCarga =
  | 'INICIAL'
  | 'VALIDANDO'
  | 'VALIDADO_ERROR'
  | 'MOSTRANDO_ACUSE'
  | 'CONFIRMANDO'
  | 'CONFIRMADO'
  | 'RECHAZADO';

@Component({
  selector: 'app-carga-inicial',
  imports: [],
  templateUrl: './carga-inicial.html',
  styleUrl: './carga-inicial.css',
})
export class CargaInicial {
  carpetas = signal<File | null>(null);
  delitos = signal<File | null>(null);
  victimas = signal<File | null>(null);

  estado = signal<EstadoCarga>('INICIAL');
  respuesta = signal<CargaValidacionResponse | null>(null);
  mensaje = signal('');
  errorGeneral = signal('');

private acusePrevioObjectUrl: string | null = null;
private acuseConfirmadoObjectUrl: string | null = null;

acusePrevioUrl = signal<SafeResourceUrl | null>(null);
acuseConfirmadoUrl = signal<SafeResourceUrl | null>(null);

  resumenCarpetas = computed(() => this.resumenPorArchivo('carpetas'));
  resumenDelitos = computed(() => this.resumenPorArchivo('delitos'));
  resumenVictimas = computed(() => this.resumenPorArchivo('victimas'));

  errores = computed(() => this.respuesta()?.errores ?? []);
  codigoReferencia = computed(() => this.respuesta()?.codigoReferencia ?? '');

  puedeValidar = computed(() => {
    return !!this.carpetas() && !!this.delitos() && !!this.victimas() && this.estado() !== 'VALIDANDO';
  });

  mostrarTablasErrores = computed(() => {
    return this.estado() === 'VALIDADO_ERROR' && !!this.respuesta();
  });

constructor(
  private cargaService: CargaService,
  private sanitizer: DomSanitizer
) {} 

  seleccionarArchivo(event: Event, tipo: 'carpetas' | 'delitos' | 'victimas'): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (tipo === 'carpetas') {
      this.carpetas.set(archivo);
    }

    if (tipo === 'delitos') {
      this.delitos.set(archivo);
    }

    if (tipo === 'victimas') {
      this.victimas.set(archivo);
    }

    this.limpiarResultado();
  }

  validarArchivos(): void {
    const carpetas = this.carpetas();
    const delitos = this.delitos();
    const victimas = this.victimas();

    if (!carpetas || !delitos || !victimas) {
      this.errorGeneral.set('Debe seleccionar los tres archivos: expedientes, delitos y víctimas.');
      return;
    }

    this.estado.set('VALIDANDO');
    this.errorGeneral.set('');
    this.mensaje.set('Procesando...');
    this.respuesta.set(null);
    this.limpiarUrlsPdf();

    this.cargaService.validarArchivos(carpetas, delitos, victimas).subscribe({
      next: (response) => {
        this.respuesta.set(response);
        this.mensaje.set(response.mensaje || '');

        if (!response.esValido) {
          this.estado.set('VALIDADO_ERROR');
          return;
        }

        this.abrirAcusePrevio(response.codigoReferencia);
      },
      error: (error) => {
        const response = error?.error as CargaValidacionResponse | undefined;

        if (response?.resumenValidacion || response?.errores) {
          this.respuesta.set(response);
          this.mensaje.set(response.mensaje || 'Se encontraron inconsistencias en los archivos.');
          this.estado.set('VALIDADO_ERROR');
          return;
        }

        this.estado.set('INICIAL');
        this.errorGeneral.set(error?.error?.mensaje || 'No fue posible validar los archivos.');
        this.mensaje.set('');
      }
    });
  }

  aceptarCarga(): void {
    const codigoReferencia = this.codigoReferencia();

    if (!codigoReferencia) {
      return;
    }

    this.estado.set('CONFIRMANDO');

    this.cargaService.confirmarCarga({
      codigoReferencia,
      aceptar: true
    }).subscribe({
      next: () => {
        this.cargaService.descargarAcuseConfirmado(codigoReferencia).subscribe({
          next: (blob) => {
            this.reemplazarAcuseConfirmado(blob);
            this.estado.set('CONFIRMADO');

            Swal.fire({
              icon: 'success',
              title: '¡Carga completada!',
              confirmButtonText: 'OK',
              confirmButtonColor: '#2f80d0'
            });
          },
          error: () => {
            this.estado.set('CONFIRMADO');

            Swal.fire({
              icon: 'success',
              title: '¡Carga completada!',
              text: 'La carga fue confirmada, pero no fue posible cargar el acuse confirmado.',
              confirmButtonText: 'OK',
              confirmButtonColor: '#2f80d0'
            });
          }
        });
      },
      error: (error) => {
        this.estado.set('MOSTRANDO_ACUSE');

        Swal.fire({
          icon: 'error',
          title: 'No fue posible confirmar la carga',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  rechazarCarga(): void {
    const codigoReferencia = this.codigoReferencia();

    if (!codigoReferencia) {
      return;
    }

    this.estado.set('CONFIRMANDO');

    this.cargaService.confirmarCarga({
      codigoReferencia,
      aceptar: false
    }).subscribe({
      next: () => {
        this.estado.set('RECHAZADO');
        this.cerrarAcuse();
        this.reiniciarFormulario();

        Swal.fire({
          icon: 'success',
          title: 'Carga rechazada',
          text: 'La carga fue rechazada correctamente.',
          confirmButtonColor: '#691C32'
        });
      },
      error: (error) => {
        this.estado.set('MOSTRANDO_ACUSE');

        Swal.fire({
          icon: 'error',
          title: 'No fue posible rechazar la carga',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  cerrarAcuse(): void {
    this.estado.set(this.estado() === 'CONFIRMADO' ? 'CONFIRMADO' : 'INICIAL');
    this.limpiarUrlsPdf();
  }

  cerrarProcesoConfirmado(): void {
    this.cerrarAcuse();
    this.reiniciarFormulario();
  }

  private abrirAcusePrevio(codigoReferencia: string): void {
    this.cargaService.descargarAcusePrevio(codigoReferencia).subscribe({
      next: (blob) => {
        this.reemplazarAcusePrevio(blob);
        this.estado.set('MOSTRANDO_ACUSE');
      },
      error: () => {
        this.estado.set('INICIAL');
        this.errorGeneral.set('La validación fue correcta, pero no fue posible generar el acuse previo.');
      }
    });
  }

private reemplazarAcusePrevio(blob: Blob): void {
  if (this.acusePrevioObjectUrl) {
    window.URL.revokeObjectURL(this.acusePrevioObjectUrl);
  }

  this.acusePrevioObjectUrl = window.URL.createObjectURL(blob);
  this.acusePrevioUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.acusePrevioObjectUrl));
}

private reemplazarAcuseConfirmado(blob: Blob): void {
  if (this.acuseConfirmadoObjectUrl) {
    window.URL.revokeObjectURL(this.acuseConfirmadoObjectUrl);
  }

  this.acuseConfirmadoObjectUrl = window.URL.createObjectURL(blob);
  this.acuseConfirmadoUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.acuseConfirmadoObjectUrl));
}

  private limpiarResultado(): void {
    this.estado.set('INICIAL');
    this.respuesta.set(null);
    this.mensaje.set('');
    this.errorGeneral.set('');
    this.limpiarUrlsPdf();
  }

  private reiniciarFormulario(): void {
    this.carpetas.set(null);
    this.delitos.set(null);
    this.victimas.set(null);
    this.respuesta.set(null);
    this.mensaje.set('');
    this.errorGeneral.set('');
  }

private limpiarUrlsPdf(): void {
  if (this.acusePrevioObjectUrl) {
    window.URL.revokeObjectURL(this.acusePrevioObjectUrl);
  }

  if (this.acuseConfirmadoObjectUrl) {
    window.URL.revokeObjectURL(this.acuseConfirmadoObjectUrl);
  }

  this.acusePrevioObjectUrl = null;
  this.acuseConfirmadoObjectUrl = null;

  this.acusePrevioUrl.set(null);
  this.acuseConfirmadoUrl.set(null);
}

  private resumenPorArchivo(archivo: string): CargaValidacionResumenItem[] {
    return (this.respuesta()?.resumenValidacion ?? [])
      .filter(item => item.archivo?.toLowerCase() === archivo.toLowerCase());
  }
}