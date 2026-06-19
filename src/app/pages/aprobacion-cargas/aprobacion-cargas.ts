import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  CargaPendienteAdministracionDetalle,
  CargaPendienteAdministracionItem,
} from '../../core/models/administracion-cargas.models';
import { AdministracionCargasService } from '../../core/services/administracion-cargas.service';
import {
  confirmarAccion,
  mostrarError,
  mostrarExitoInstitucional,
} from '../../core/utils/alert.utils';
import {
  obtenerMensajeErrorHttp,
  obtenerMensajeErrorHttpAsync,
} from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-aprobacion-cargas',
  imports: [FormsModule],
  templateUrl: './aprobacion-cargas.html',
  styleUrl: './aprobacion-cargas.css',
})
export class AprobacionCargas implements OnInit, OnDestroy {
  private readonly administracionService = inject(AdministracionCargasService);

  private readonly sanitizer = inject(DomSanitizer);
  private acuseObjectUrl: string | null = null;

  pendientes = signal<CargaPendienteAdministracionItem[]>([]);
  detalle = signal<CargaPendienteAdministracionDetalle | null>(null);
  busqueda = signal('');

  cargando = signal(false);
  cargandoDetalle = signal<string | null>(null);
  descargandoArchivos = signal<string | null>(null);
  descargandoAcuse = signal<string | null>(null);
  procesando = signal<string | null>(null);

  acuseUrl = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Acuse previo de entrega de información');

  pendientesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) {
      return this.pendientes();
    }

    return this.pendientes().filter((carga) => {
      return (
        carga.entidadFederativa.toLowerCase().includes(texto) ||
        carga.codigoReferencia.toLowerCase().includes(texto) ||
        carga.usuarioCarga.toLowerCase().includes(texto) ||
        carga.nombreUsuarioCarga.toLowerCase().includes(texto) ||
        this.tipoCargaTexto(carga.tipoCarga).toLowerCase().includes(texto) ||
        this.periodoTexto(carga.mesCorte, carga.anioCorte).toLowerCase().includes(texto)
      );
    });
  });

  hayOperacionEnCurso = computed(() => {
    return (
      this.descargandoArchivos() !== null ||
      this.descargandoAcuse() !== null ||
      this.procesando() !== null
    );
  });

  ngOnInit(): void {
    this.cargarPendientes();
  }

  cargarPendientes(): void {
    this.cargando.set(true);

    this.administracionService.obtenerPendientes().subscribe({
      next: (response) => {
        this.pendientes.set(response.registros ?? []);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar las cargas pendientes',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  verDetalle(codigoReferencia: string): void {
    this.cargandoDetalle.set(codigoReferencia);

    this.administracionService.obtenerDetalle(codigoReferencia).subscribe({
      next: (response) => {
        this.detalle.set(response.detalle);
        this.cargandoDetalle.set(null);
      },
      error: (error: unknown) => {
        this.cargandoDetalle.set(null);

        mostrarError(
          'No fue posible consultar el detalle',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  descargarArchivos(carga: CargaPendienteAdministracionItem): void {
    this.descargandoArchivos.set(carga.codigoReferencia);

    this.administracionService.descargarArchivos(carga.codigoReferencia).subscribe({
      next: (response) => {
        this.descargandoArchivos.set(null);

        if (!response.body) {
          mostrarError('Archivo vacío', 'La API no devolvió los archivos de la carga.');
          return;
        }

        const nombreArchivo =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) ||
          `ARCHIVOS_REVISION_${carga.codigoReferencia}.zip`;

        this.descargarBlob(response.body, nombreArchivo);
      },
      error: async (error: unknown) => {
        this.descargandoArchivos.set(null);

        mostrarError(
          'No fue posible descargar los archivos',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  descargarAcuse(carga: CargaPendienteAdministracionItem): void {
    this.descargandoAcuse.set(carga.codigoReferencia);

    this.administracionService.descargarAcuse(carga.codigoReferencia, carga.tipoCarga).subscribe({
      next: (response) => {
        this.descargandoAcuse.set(null);

        if (!response.body) {
          mostrarError('Acuse vacío', 'La API no devolvió el acuse previo.');
          return;
        }

        this.mostrarAcuse(response.body, carga);
      },
      error: async (error: unknown) => {
        this.descargandoAcuse.set(null);

        mostrarError(
          'No fue posible consultar el acuse',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  async aprobar(carga: CargaPendienteAdministracionItem): Promise<void> {
    const confirmacion = await confirmarAccion(
      'Aprobar carga',
      `Se incorporará definitivamente la información de ${carga.entidadFederativa}, correspondiente a ${this.periodoTexto(carga.mesCorte, carga.anioCorte)}.`,
      'Aprobar carga',
    );

    if (!confirmacion.isConfirmed) {
      return;
    }

    this.procesando.set(carga.codigoReferencia);

    this.administracionService.aprobar(carga.codigoReferencia).subscribe({
      next: (response) => {
        this.procesando.set(null);
        this.detalle.set(null);

        mostrarExitoInstitucional(
          'Carga aprobada',
          response.mensaje || 'La información fue incorporada correctamente.',
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);

        mostrarError(
          'No fue posible aprobar la carga',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  async rechazar(carga: CargaPendienteAdministracionItem): Promise<void> {
    const resultado = await Swal.fire({
      icon: 'warning',
      title: 'Rechazar carga',
      text: `${carga.entidadFederativa} — ${this.periodoTexto(carga.mesCorte, carga.anioCorte)}`,
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Describa las correcciones que debe realizar el enlace estatal...',
      inputAttributes: {
        maxlength: '2000',
        'aria-label': 'Motivo del rechazo',
      },
      showCancelButton: true,
      confirmButtonText: 'Rechazar carga',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#691C32',
      inputValidator: (valor) => {
        const motivo = valor?.trim() ?? '';

        if (motivo.length < 5) {
          return 'Capture un motivo de al menos 5 caracteres.';
        }

        return undefined;
      },
    });

    const motivo = (resultado.value as string | undefined)?.trim() ?? '';

    if (!resultado.isConfirmed || !motivo) {
      return;
    }

    this.procesando.set(carga.codigoReferencia);

    this.administracionService.rechazar(carga.codigoReferencia, motivo).subscribe({
      next: (response) => {
        this.procesando.set(null);
        this.detalle.set(null);

        mostrarExitoInstitucional(
          'Carga rechazada',
          response.mensaje || 'La carga fue rechazada correctamente.',
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);

        mostrarError(
          'No fue posible rechazar la carga',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  tipoCargaTexto(tipoCarga: string): string {
    return tipoCarga === 'ACTUALIZACION' ? 'Actualización' : 'Carga inicial';
  }

  periodoTexto(mesCorte: number, anioCorte: number): string {
    const fecha = new Date(anioCorte, mesCorte - 1, 1);

    const texto = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(fecha);

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  fechaTexto(fecha: string | null | undefined): string {
    if (!fecha) {
      return '-';
    }

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(valor);
  }

  usuarioTexto(carga: CargaPendienteAdministracionItem): string {
    return carga.nombreUsuarioCarga || carga.usuarioCarga || '-';
  }

  archivoTexto(archivo: string): string {
    const texto = archivo.replaceAll('_', ' ').trim().toLowerCase();
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  totalRegistros(carga: CargaPendienteAdministracionItem): number {
    return carga.totalCarpetas + carga.totalDelitos + carga.totalVictimas;
  }

  private descargarBlob(blob: Blob, nombreArchivo: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = nombreArchivo;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }
  cerrarAcuse(): void {
    revocarObjectUrl(this.acuseObjectUrl);
    this.acuseObjectUrl = null;
    this.acuseUrl.set(null);
  }

  ngOnDestroy(): void {
    this.cerrarAcuse();
  }

  private mostrarAcuse(blob: Blob, carga: CargaPendienteAdministracionItem): void {
    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl);

    this.acuseObjectUrl = pdf.objectUrl;
    this.acuseUrl.set(pdf.safeUrl);
    this.acuseTitulo.set(
      `Acuse previo — ${carga.entidadFederativa} — ${this.periodoTexto(carga.mesCorte, carga.anioCorte)}`,
    );
  }

  private obtenerNombreArchivo(contentDisposition: string | null): string {
    if (!contentDisposition) {
      return '';
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const normalMatch = contentDisposition.match(/filename="?([^"]+)"?/i);

    return normalMatch?.[1] ?? '';
  }
}
