import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FederalInformesService } from '../../core/services/federal-informes.service';
import { InformeEnvioItem, PeriodoCorteInforme } from '../../core/models/informes.models';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import {
  obtenerMensajeErrorHttp,
  obtenerMensajeErrorHttpAsync,
} from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-federal-envios',
  imports: [FormsModule],
  templateUrl: './federal-envios.html',
  styleUrl: '../informes/informes.css',
})
export class FederalEnvios implements OnInit, OnDestroy {
  private readonly federalInformesService = inject(FederalInformesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private acuseObjectUrl: string | null = null;

  periodos = signal<PeriodoCorteInforme[]>([]);
  aniosDisponibles = computed(() => Array.from(new Set(
    this.periodos().map((periodo) => periodo.anioCorte),
  )).sort((a, b) => b - a));
  anioSeleccionado = signal<number | null>(null);
  envios = signal<InformeEnvioItem[]>([]);
  busqueda = signal('');
  pagina = signal(1);

  cargando = signal(false);
  descargandoAcuse = signal<string | null>(null);
  descargandoArchivos = signal<string | null>(null);
  descargandoAcuses = signal(false);
  exportandoExcel = signal(false);

  descargaEnProceso = computed(
    () =>
      this.descargandoAcuse() !== null ||
      this.descargandoArchivos() !== null ||
      this.descargandoAcuses(),
  );

  acuseUrl = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Informe Federal');

  readonly tamanioPagina = 10;

  enviosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) return this.envios();

    return this.envios().filter(
      (envio) =>
        envio.fechaEnvioTexto.toLowerCase().includes(texto) ||
        envio.corte.toLowerCase().includes(texto) ||
        envio.usuarioEnvio.toLowerCase().includes(texto) ||
        envio.codigoReferencia.toLowerCase().includes(texto) ||
        envio.tipoCarga.toLowerCase().includes(texto) ||
        envio.estadoTexto.toLowerCase().includes(texto) ||
        (envio.motivoRechazo ?? '').toLowerCase().includes(texto),
    );
  });

  enviosPaginados = computed(() => {
    const inicio = (this.pagina() - 1) * this.tamanioPagina;
    return this.enviosFiltrados().slice(inicio, inicio + this.tamanioPagina);
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.enviosFiltrados().length / this.tamanioPagina)),
  );

  ngOnInit(): void {
    this.cargarEnvios();
  }

  cargarEnvios(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.envios.set([]);
    this.pagina.set(1);

    this.federalInformesService.obtenerPeriodosEnvios().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);
        const anios = this.aniosDisponibles();
        const seleccionado = this.anioSeleccionado();

        if (seleccionado === null || !anios.includes(seleccionado)) {
          this.anioSeleccionado.set(anios[0] ?? null);
        }

        this.cargarAnio();
      },
      error: (error: unknown) => {
        this.periodos.set([]);
        this.anioSeleccionado.set(null);
        this.cargando.set(false);
        mostrarError(
          'No fue posible consultar los años de envíos federales',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cargarAnio(): void {
    const anioCorte = this.anioSeleccionado();
    this.envios.set([]);
    this.pagina.set(1);

    if (anioCorte === null) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);

    this.federalInformesService.obtenerEnvios(undefined, anioCorte).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (envios) => {
        this.envios.set(envios);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        mostrarError(
          'No fue posible consultar los envíos federales',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cambiarAnio(): void {
    this.cargarAnio();
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.pagina.set(1);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.pagina.set(pagina);
  }

  verAcuse(envio: InformeEnvioItem): void {
    if (!envio.endpointAcuse) return;

    this.descargandoAcuse.set(envio.codigoReferencia);

    this.federalInformesService.descargarDesdeEndpoint(envio.endpointAcuse).subscribe({
      next: (response) => {
        this.descargandoAcuse.set(null);

        if (!response.body) return;

        const pdf = crearSafeBlobUrl(response.body, this.sanitizer, this.acuseObjectUrl);

        this.acuseObjectUrl = pdf.objectUrl;
        this.acuseUrl.set(pdf.safeUrl);
        const tipo = envio.tipoCarga === 'ACTUALIZACION' ? ' de actualización' : '';
        this.acuseTitulo.set(
          envio.esConfirmado
            ? `Acuse${tipo} Federal — ${envio.corte}`
            : `Informe previo${tipo} Federal — ${envio.corte}`,
        );
      },
      error: (error: unknown) => {
        this.descargandoAcuse.set(null);
        mostrarError(
          'No fue posible consultar el informe Federal',
          obtenerMensajeErrorHttp(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  descargarArchivos(envio: InformeEnvioItem): void {
    if (!envio.endpointExcel) {
      mostrarAdvertencia(
        'Archivos no disponibles',
        'Este envío no tiene archivos disponibles para descarga.',
      );
      return;
    }

    this.descargandoArchivos.set(envio.codigoReferencia);

    this.federalInformesService.descargarDesdeEndpoint(envio.endpointExcel).subscribe({
      next: (response) => {
        this.descargandoArchivos.set(null);

        if (!response.body) {
          mostrarAdvertencia(
            'Archivos no disponibles',
            'La API no devolvió el archivo solicitado.',
          );
          return;
        }

        const url = URL.createObjectURL(response.body);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = `ARCHIVOS_FEDERAL_${envio.codigoReferencia}.zip`;
        enlace.style.display = 'none';

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: async (error) => {
        this.descargandoArchivos.set(null);

        mostrarError(
          'No fue posible descargar los archivos',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  descargarAcusesAnio(): void {
    if (this.cargando() || this.descargaEnProceso()) return;
    const anioCorte = this.anioSeleccionado();

    if (anioCorte === null || !Number.isInteger(anioCorte) || !this.aniosDisponibles().includes(anioCorte)) {
      mostrarAdvertencia('Año inválido', 'Seleccione un año válido.');
      return;
    }

    this.descargandoAcuses.set(true);

    this.federalInformesService.crearTicketDescargaAcuses(undefined, anioCorte).subscribe({
      next: (response) => {
        if (!response.ticket) {
          this.descargandoAcuses.set(false);
          mostrarAdvertencia('Descarga no disponible', 'La API no devolvió un ticket de descarga.');
          return;
        }

        const iframe = document.createElement('iframe');

        iframe.src = this.federalInformesService.obtenerUrlDescargaAcuses(response.ticket);
        iframe.style.display = 'none';

        document.body.appendChild(iframe);
        this.descargandoAcuses.set(false);

        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 60000);
      },
      error: async (error) => {
        this.descargandoAcuses.set(false);

        mostrarError(
          'No fue posible descargar los acuses federales',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  async exportarExcel(): Promise<void> {
    if (this.cargando() || this.exportandoExcel()) return;
    this.exportandoExcel.set(true);

    try {
      const filas = this.enviosFiltrados().map((envio) => ({
        'Fecha de envío': envio.fechaEnvioTexto,
        Corte: envio.corte,
        'Usuario envío': envio.usuarioEnvio,
        Estatus: envio.estadoTexto,
        'Código de referencia': envio.codigoReferencia,
        'Motivo de rechazo': envio.motivoRechazo ?? '',
      }));

      await exportarFilasExcel(filas, `reporte_envios_federal_${this.anioSeleccionado()}.xlsx`, 'Envíos Federal');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  ajustarPosicionMotivo(event: Event): void {
    const detalle = event.currentTarget as HTMLDetailsElement;

    if (!detalle.open) {
      detalle.classList.remove('motivo-rechazo-arriba');
      return;
    }

    const contenedor = detalle.closest('.envios-mensual-table-responsive');
    const panel = detalle.querySelector<HTMLElement>('.motivo-rechazo-mensual');

    if (!contenedor || !panel) return;

    const espacioInferior =
      contenedor.getBoundingClientRect().bottom - detalle.getBoundingClientRect().bottom;

    detalle.classList.toggle('motivo-rechazo-arriba', espacioInferior < panel.offsetHeight + 12);
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
