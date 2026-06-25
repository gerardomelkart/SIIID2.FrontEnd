import { Component, computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import {
  confirmarAccion,
  mostrarAdvertencia,
  mostrarError,
  mostrarExito,
  mostrarExitoInstitucional,
} from '../../core/utils/alert.utils';

import { obtenerErrorPayload, obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { CargaService } from '../../core/services/carga.service';
import { catchError, map, of, switchMap } from 'rxjs';
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
  | 'VALIDADO_ADVERTENCIA'
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
  advertencias = computed(() => this.respuesta()?.advertencias ?? []);

  detallesValidacion = computed(() => [...this.errores(), ...this.advertencias()]);

  hayAdvertenciasDeDecision = computed(() => {
    return this.advertencias().length > 0;
  });

  codigoReferencia = computed(() => this.respuesta()?.codigoReferencia ?? '');

  errorCargaPendiente = computed(() => {
    return (
      this.errores().find(
        (error) =>
          error.codigo === 'CARGA_PENDIENTE_EXISTENTE' ||
          error.codigo === 'CARGA_PENDIENTE_APROBACION',
      ) ?? null
    );
  });

  codigoReferenciaPendiente = computed(() => {
    const codigo = this.errorCargaPendiente()?.valor?.trim();

    if (codigo) {
      return codigo;
    }

    const textoErrores = this.errores()
      .map((error) => `${error.valor ?? ''} ${error.mensaje ?? ''}`)
      .join(' ');

    const match = textoErrores.match(/Código de referencia pendiente:\s*([a-zA-Z0-9-]+)/i);

    return match?.[1] ?? '';
  });

  hayCargaPendiente = computed(() => this.errorCargaPendiente() !== null);

  cargaPendientePorResolver = computed(() => {
    return this.errorCargaPendiente()?.codigo === 'CARGA_PENDIENTE_EXISTENTE';
  });

  cargaEnRevisionAdministrativa = computed(() => {
    return this.errorCargaPendiente()?.codigo === 'CARGA_PENDIENTE_APROBACION';
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
    return (
      (this.estado() === 'VALIDADO_ERROR' || this.estado() === 'VALIDADO_ADVERTENCIA') &&
      !!this.respuesta()
    );
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

          if (this.hayAdvertenciasDeDecision()) {
            this.estado.set('VALIDADO_ADVERTENCIA');
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

  continuarAAcusePrevio(): void {
    const codigoReferencia = this.codigoReferenciaOperacion();

    if (!codigoReferencia) {
      return;
    }

    this.abrirAcusePrevio(codigoReferencia);
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
      .pipe(
        switchMap((response) => {
          if (response.estado === 'PENDIENTE_APROBACION') {
            return of({
              response,
              acuseDescargado: false,
              blob: null as Blob | null,
            });
          }

          return this.cargaService.descargarAcuseConfirmado(codigoReferencia).pipe(
            map((blob: Blob) => ({
              response,
              acuseDescargado: true,
              blob,
            })),
            catchError(() =>
              of({
                response,
                acuseDescargado: false,
                blob: null as Blob | null,
              }),
            ),
          );
        }),
      )
      .subscribe({
        next: (resultado) => {
          if (resultado.response.estado === 'PENDIENTE_APROBACION') {
            this.limpiarUrlsPdf();

            mostrarExitoInstitucional(
              'Carga enviada a revision',
              resultado.response.mensaje ||
                'La carga quedo pendiente de aprobacion administrativa.',
            ).then(() => {
              this.reiniciarFormulario();
              this.estado.set('INICIAL');
              this.router.navigateByUrl('/');
            });

            return;
          }

          if (resultado.blob) {
            this.reemplazarAcuseConfirmado(resultado.blob);
          }

          this.estado.set('CONFIRMADO');

          mostrarExito(
            'Carga completada',
            resultado.acuseDescargado
              ? undefined
              : 'La carga fue confirmada, pero no fue posible cargar el acuse confirmado.',
          );
        },
        error: (error: unknown) => {
          this.estado.set('MOSTRANDO_ACUSE');

          mostrarError(
            'No fue posible procesar la carga',
            obtenerMensajeErrorHttp(error, 'Revise la conexion con la API.'),
          );
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

          mostrarExitoInstitucional(
            'Carga rechazada',
            'La carga fue rechazada correctamente.',
          ).then(() => {
            this.router.navigateByUrl('/');
          });
        },
        error: (error) => {
          this.estado.set('MOSTRANDO_ACUSE');

          mostrarError(
            'No fue posible rechazar la carga',
            obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
          );
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
    if (this.cargaEnRevisionAdministrativa()) {
      mostrarAdvertencia(
        'Carga en revisión administrativa',
        'La carga ya fue aceptada y se encuentra esperando la resolución del administrador.',
      );

      return;
    }

    const codigoReferencia = this.codigoReferenciaPendiente();

    if (!codigoReferencia) {
      mostrarAdvertencia(
        'Sin referencia pendiente',
        'No fue posible identificar el código de referencia pendiente.',
      );

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
        this.estado.set(this.hayAdvertenciasDeDecision() ? 'VALIDADO_ADVERTENCIA' : 'INICIAL');
        this.errorGeneral.set(
          'La validación fue correcta, pero no fue posible generar el informe previo.',
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
