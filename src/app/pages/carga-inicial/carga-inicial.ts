import { Component, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { obtenerErrorPayload, obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { CargaService } from '../../core/services/carga.service';
import {
  CargaValidacionResponse,
  CargaValidacionResumenItem,
} from '../../core/models/carga.models';

import { ArchivoCargaTipo, ArchivosCargaSeleccionados } from '../../core/types/archivo-carga.types';

import {
  actualizarArchivoSeleccionado,
  crearArchivosCargaVacios,
  obtenerArchivoDesdeEvento,
  obtenerResumenPorArchivo,
  tieneTresArchivosSeleccionados,
} from '../../core/utils/archivo-carga.utils';

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
  archivos = signal<ArchivosCargaSeleccionados>(crearArchivosCargaVacios());

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

  codigoReferenciaPendiente = computed(() => {
    const textoErrores = this.errores()
      .map(
        (error) => `${error.valor ?? ''} ${error.mensaje ?? ''} ${error.descripcionResumen ?? ''}`,
      )
      .join(' ');

    const match = textoErrores.match(/Código de referencia pendiente:\s*([a-zA-Z0-9-]+)/i);

    return match?.[1] ?? '';
  });

  hayCargaPendiente = computed(() => {
    return this.codigoReferenciaPendiente() !== '';
  });

  codigoReferenciaOperacion = computed(() => {
    return this.codigoReferenciaPendiente() || this.codigoReferencia();
  });

  debeUsarActualizacion = computed(() => {
    const textoErrores = this.errores()
      .map((error) => `${error.mensaje ?? ''} ${error.descripcionResumen ?? ''}`)
      .join(' ')
      .toLowerCase();

    return (
      textoErrores.includes('flujo de actualización') ||
      textoErrores.includes('flujo de actualizacion') ||
      textoErrores.includes('información confirmada') ||
      textoErrores.includes('informacion confirmada')
    );
  });

  puedeValidar = computed(() => {
    return tieneTresArchivosSeleccionados(this.archivos()) && this.estado() !== 'VALIDANDO';
  });

  mostrarTablasErrores = computed(() => {
    return this.estado() === 'VALIDADO_ERROR' && !!this.respuesta();
  });

  constructor(
    private cargaService: CargaService,
    private sanitizer: DomSanitizer,
    private router: Router,
  ) {}

  seleccionarArchivo(event: Event, tipo: ArchivoCargaTipo): void {
    const archivo = obtenerArchivoDesdeEvento(event);

    this.archivos.set(actualizarArchivoSeleccionado(this.archivos(), tipo, archivo));

    this.limpiarResultado();
  }

  validarArchivos(): void {
    const archivos = this.archivos();

    if (!tieneTresArchivosSeleccionados(archivos)) {
      this.errorGeneral.set('Debe seleccionar los tres archivos: expedientes, delitos y víctimas.');
      return;
    }

    this.estado.set('VALIDANDO');
    this.errorGeneral.set('');
    this.mensaje.set('Procesando...');
    this.respuesta.set(null);
    this.limpiarUrlsPdf();

    this.cargaService
      .validarArchivos(archivos.carpetas!, archivos.delitos!, archivos.victimas!)
      .subscribe({
        next: (response) => {
          this.respuesta.set(response);
          this.mensaje.set(response.mensaje || '');

          if (!response.esValido) {
            this.estado.set('VALIDADO_ERROR');
            return;
          }

          this.abrirAcusePrevio(response.codigoReferencia);
        },
        error: (error: unknown) => {
          const response = obtenerErrorPayload<CargaValidacionResponse>(error);

          if (response?.resumenValidacion || response?.errores) {
            this.respuesta.set(response);
            this.mensaje.set(response.mensaje || 'Se encontraron inconsistencias en los archivos.');
            this.estado.set('VALIDADO_ERROR');
            return;
          }

          this.estado.set('INICIAL');
          this.errorGeneral.set(
            obtenerMensajeErrorHttp(error, 'Intente nuevamente.') ||
              'No fue posible validar los archivos.',
          );
          this.mensaje.set('');
        },
      });
  }

  aceptarCarga(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.estado.set('CONFIRMANDO');

    this.cargaService
      .confirmarCarga({
        codigoReferencia,
        aceptar: true,
      })
      .subscribe({
        next: () => {
          this.cargaService.descargarAcuseConfirmado(codigoReferencia).subscribe({
            next: (blob) => {
              this.reemplazarAcuseConfirmado(blob);
              this.estado.set('CONFIRMADO');

              Swal.fire({
                icon: 'success',
                title: '¡Carga completada!',
                confirmButtonText: 'OK',
                confirmButtonColor: '#2f80d0',
              });
            },
            error: () => {
              this.estado.set('CONFIRMADO');

              Swal.fire({
                icon: 'success',
                title: '¡Carga completada!',
                text: 'La carga fue confirmada, pero no fue posible cargar el acuse confirmado.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#2f80d0',
              });
            },
          });
        },
        error: (error) => {
          this.estado.set('MOSTRANDO_ACUSE');

          Swal.fire({
            icon: 'error',
            title: 'No fue posible confirmar la carga',
            text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
            confirmButtonColor: '#691C32',
          });
        },
      });
  }

  rechazarCarga(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.estado.set('CONFIRMANDO');

    this.cargaService
      .confirmarCarga({
        codigoReferencia,
        aceptar: false,
      })
      .subscribe({
        next: () => {
          this.estado.set('RECHAZADO');
          this.limpiarUrlsPdf();

          Swal.fire({
            icon: 'success',
            title: 'Carga rechazada',
            text: 'La carga fue rechazada correctamente.',
            confirmButtonColor: '#691C32',
          }).then(() => {
            this.router.navigateByUrl('/');
          });
        },
        error: (error) => {
          this.estado.set('MOSTRANDO_ACUSE');

          Swal.fire({
            icon: 'error',
            title: 'No fue posible rechazar la carga',
            text: obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
            confirmButtonColor: '#691C32',
          });
        },
      });
  }

  prepararNuevaValidacion(): void {
    this.reiniciarFormulario();
    this.limpiarUrlsPdf();
    this.estado.set('INICIAL');
  }

  cerrarAcuse(): void {
    this.estado.set('INICIAL');
    this.limpiarUrlsPdf();
  }

  cerrarProcesoConfirmado(): void {
    this.limpiarUrlsPdf();
    this.reiniciarFormulario();
    this.estado.set('INICIAL');
    this.router.navigateByUrl('/');
  }

  resolverCargaPendiente(): void {
    const codigoReferencia = this.codigoReferenciaPendiente();

    if (!codigoReferencia) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin referencia pendiente',
        text: 'No fue posible identificar el código de referencia pendiente.',
        confirmButtonColor: '#691C32',
      });

      return;
    }

    this.abrirAcusePrevio(codigoReferencia);
  }

  irAActualizacion(): void {
    this.router.navigateByUrl('/actualizacion');
  }

  private abrirAcusePrevio(codigoReferencia: string): void {
    this.cargaService.descargarAcusePrevio(codigoReferencia).subscribe({
      next: (blob) => {
        this.reemplazarAcusePrevio(blob);
        this.estado.set('MOSTRANDO_ACUSE');
      },
      error: () => {
        this.estado.set('INICIAL');
        this.errorGeneral.set(
          'La validación fue correcta, pero no fue posible generar el acuse previo.',
        );
      },
    });
  }

  private reemplazarAcusePrevio(blob: Blob): void {
    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acusePrevioObjectUrl);

    this.acusePrevioObjectUrl = pdf.objectUrl;
    this.acusePrevioUrl.set(pdf.safeUrl);
  }

  private reemplazarAcuseConfirmado(blob: Blob): void {
    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseConfirmadoObjectUrl);

    this.acuseConfirmadoObjectUrl = pdf.objectUrl;
    this.acuseConfirmadoUrl.set(pdf.safeUrl);
  }

  private limpiarResultado(): void {
    this.estado.set('INICIAL');
    this.respuesta.set(null);
    this.mensaje.set('');
    this.errorGeneral.set('');
    this.limpiarUrlsPdf();
  }

  private reiniciarFormulario(): void {
    this.archivos.set(crearArchivosCargaVacios());
    this.respuesta.set(null);
    this.mensaje.set('');
    this.errorGeneral.set('');
  }

  private limpiarUrlsPdf(): void {
    revocarObjectUrl(this.acusePrevioObjectUrl);
    revocarObjectUrl(this.acuseConfirmadoObjectUrl);

    this.acusePrevioObjectUrl = null;
    this.acuseConfirmadoObjectUrl = null;

    this.acusePrevioUrl.set(null);
    this.acuseConfirmadoUrl.set(null);
  }

  private resumenPorArchivo(archivo: ArchivoCargaTipo): CargaValidacionResumenItem[] {
    return obtenerResumenPorArchivo(this.respuesta()?.resumenValidacion ?? [], archivo);
  }
}
