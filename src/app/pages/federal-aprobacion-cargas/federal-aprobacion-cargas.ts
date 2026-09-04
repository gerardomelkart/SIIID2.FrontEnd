import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import {
  CargaPendienteAdministracionDetalle,
  CargaPendienteAdministracionItem,
} from '../../core/models/administracion-cargas.models';

import { FederalAdministracionCargasService } from '../../core/services/federal-administracion-cargas.service';
import { FederalCargaService } from '../../core/services/federal-carga.service';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { confirmarAccion, mostrarError, mostrarExitoInstitucional } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-federal-aprobacion-cargas',
  imports: [FormsModule],
  templateUrl: './federal-aprobacion-cargas.html',
  styleUrl: '../aprobacion-cargas/aprobacion-cargas.css',
})
export class FederalAprobacionCargas implements OnInit, OnDestroy {
  private readonly administracionService = inject(FederalAdministracionCargasService);
  private readonly federalCargaService = inject(FederalCargaService);
  private readonly sanitizer = inject(DomSanitizer);

  private acuseObjectUrl: string | null = null;

  pendientes = signal<CargaPendienteAdministracionItem[]>([]);
  detalle = signal<CargaPendienteAdministracionDetalle | null>(null);
  busqueda = signal('');

  cargando = signal(false);
  cargandoDetalle = signal<string | null>(null);
  descargandoAcuse = signal<string | null>(null);
  procesando = signal<string | null>(null);

  acuseUrl = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Informe previo Federal');

  pendientesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) return this.pendientes();

    return this.pendientes().filter(
      (carga) =>
        carga.codigoReferencia.toLowerCase().includes(texto) ||
        carga.usuarioCarga.toLowerCase().includes(texto) ||
        carga.nombreUsuarioCarga.toLowerCase().includes(texto) ||
        this.periodoTexto(carga.mesCorte, carga.anioCorte).toLowerCase().includes(texto),
    );
  });

  hayOperacionEnCurso = computed(
    () =>
      this.cargandoDetalle() !== null ||
      this.descargandoAcuse() !== null ||
      this.procesando() !== null,
  );

  ngOnInit(): void {
    this.cargarPendientes();
  }

  cargarPendientes(): void {
    this.cargando.set(true);

    this.administracionService.obtenerPendientes().subscribe({
      next: (response) => {
        this.pendientes.set(response.registros ?? []);

        const actual = this.detalle();

        if (actual && !this.pendientes().some((x) => x.idCarga === actual.idCarga))
          this.cerrarDetalle();

        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar las cargas federales pendientes',
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

        requestAnimationFrame(() =>
          document
            .getElementById('resolucion-carga-federal')
            ?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
        );
      },
      error: (error: unknown) => {
        this.cargandoDetalle.set(null);
        this.detalle.set(null);

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
    this.cerrarAcuse();
  }

  verAcuse(carga: CargaPendienteAdministracionItem): void {
    this.descargandoAcuse.set(carga.codigoReferencia);

    this.federalCargaService.descargarAcusePrevio(carga.codigoReferencia).subscribe({
      next: (blob) => {
        this.descargandoAcuse.set(null);

        const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl);

        this.acuseObjectUrl = pdf.objectUrl;
        this.acuseUrl.set(pdf.safeUrl);
        this.acuseTitulo.set(
          `Informe previo Federal — ${this.periodoTexto(carga.mesCorte, carga.anioCorte)}`,
        );
      },
      error: (error: unknown) => {
        this.descargandoAcuse.set(null);

        mostrarError(
          'No fue posible consultar el informe previo',
          obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  async aprobar(carga: CargaPendienteAdministracionItem): Promise<void> {
    const confirmacion = await confirmarAccion(
      'Aprobar carga Federal',
      `Se incorporará definitivamente la información Federal correspondiente a ${this.periodoTexto(carga.mesCorte, carga.anioCorte)}.`,
      'Aprobar carga',
    );

    if (!confirmacion.isConfirmed) return;

    this.procesando.set(carga.codigoReferencia);

    Swal.fire({
      title: 'Aprobando carga Federal',
      html: 'Se está incorporando definitivamente la información.<br>Espere un momento...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    this.administracionService.aprobar(carga.codigoReferencia).subscribe({
      next: (response) => {
        this.procesando.set(null);
        this.detalle.set(null);
        this.cerrarAcuse();
        Swal.close();

        mostrarExitoInstitucional(
          'Carga Federal aprobada',
          response.mensaje || 'La información fue incorporada correctamente.',
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);
        Swal.close();

        mostrarError(
          'No fue posible aprobar la carga Federal',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
  }

  async rechazar(carga: CargaPendienteAdministracionItem): Promise<void> {
    const resultado = await Swal.fire({
      icon: 'warning',
      title: 'Rechazar carga Federal',
      text: this.periodoTexto(carga.mesCorte, carga.anioCorte),
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Describa las correcciones que debe realizar FGR...',
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
        return motivo.length < 5 ? 'Capture un motivo de al menos 5 caracteres.' : undefined;
      },
    });

    const motivo = (resultado.value as string | undefined)?.trim() ?? '';

    if (!resultado.isConfirmed || !motivo) return;

    this.procesando.set(carga.codigoReferencia);

    this.administracionService.rechazar(carga.codigoReferencia, motivo).subscribe({
      next: (response) => {
        this.procesando.set(null);
        this.detalle.set(null);
        this.cerrarAcuse();

        mostrarExitoInstitucional(
          'Carga Federal rechazada',
          response.mensaje || 'La carga fue rechazada correctamente.',
        );

        this.cargarPendientes();
      },
      error: (error: unknown) => {
        this.procesando.set(null);

        mostrarError(
          'No fue posible rechazar la carga Federal',
          obtenerMensajeErrorHttp(error, 'La carga pudo haber sido resuelta por otro usuario.'),
        );

        this.cargarPendientes();
      },
    });
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
    if (!fecha) return '-';

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return '-';

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

  cerrarAcuse(): void {
    revocarObjectUrl(this.acuseObjectUrl);
    this.acuseObjectUrl = null;
    this.acuseUrl.set(null);
  }

  ngOnDestroy(): void {
    this.cerrarAcuse();
  }
}