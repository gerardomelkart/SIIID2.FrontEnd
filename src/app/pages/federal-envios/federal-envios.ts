import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

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
  private readonly sanitizer = inject(DomSanitizer);
  private acuseObjectUrl: string | null = null;

  periodos = signal<PeriodoCorteInforme[]>([]);
  periodoSeleccionado = signal('');
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
    this.cargando.set(true);

    this.federalInformesService.obtenerPeriodosEnvios().subscribe({
      next: (periodos) => {
        this.periodos.set(periodos);

        if (!periodos.length) {
          this.periodoSeleccionado.set('');
          this.envios.set([]);
          this.pagina.set(1);
          this.cargando.set(false);
          return;
        }

        const seleccionado = this.periodoSeleccionado();
        const existe = periodos.some(
          (periodo) =>
            `${periodo.anioCorte}-${periodo.mesCorte.toString().padStart(2, '0')}` === seleccionado,
        );

        if (!existe) {
          const periodo = periodos[0];
          this.periodoSeleccionado.set(
            `${periodo.anioCorte}-${periodo.mesCorte.toString().padStart(2, '0')}`,
          );
        }

        this.cargarPeriodo();
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        mostrarError(
          'No fue posible consultar los periodos de envíos federales',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cargarPeriodo(): void {
    const periodo = this.periodoSeleccionado();

    if (!periodo) {
      this.envios.set([]);
      this.cargando.set(false);
      return;
    }

    const [anioCorte, mesCorte] = periodo.split('-').map(Number);

    this.cargando.set(true);

    this.federalInformesService.obtenerEnvios(mesCorte, anioCorte).subscribe({
      next: (envios) => {
        this.envios.set(envios);
        this.pagina.set(1);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.envios.set([]);
        this.cargando.set(false);
        mostrarError(
          'No fue posible consultar los envíos federales',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cambiarPeriodo(): void {
    this.pagina.set(1);
    this.cargarPeriodo();
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
        this.acuseTitulo.set(
          envio.esRechazadoAdministrador
            ? `Informe previo Federal — ${envio.corte}`
            : `Acuse Federal — ${envio.corte}`,
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

  descargarAcusesCorte(): void {
    const periodo = this.periodoSeleccionado();
    const [anioTexto, mesTexto] = periodo.split('-');
    const anioCorte = Number(anioTexto);
    const mesCorte = Number(mesTexto);

    if (
      !Number.isInteger(mesCorte) ||
      mesCorte < 1 ||
      mesCorte > 12 ||
      !Number.isInteger(anioCorte)
    ) {
      mostrarAdvertencia('Corte inválido', 'Seleccione un corte válido.');
      return;
    }

    this.descargandoAcuses.set(true);

    this.federalInformesService.crearTicketDescargaAcuses(mesCorte, anioCorte).subscribe({
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
    this.exportandoExcel.set(true);

    try {
      const filas = this.enviosFiltrados().map((envio) => ({
        'Fecha de envío': envio.fechaEnvioTexto,
        Corte: envio.corte,
        'Usuario envío': envio.usuarioEnvio,
        'Tipo de carga': this.tipoCargaTexto(envio.tipoCarga),
        Estatus: envio.estadoTexto,
        'Código de referencia': envio.codigoReferencia,
        'Motivo de rechazo': envio.motivoRechazo ?? '',
      }));

      await exportarFilasExcel(filas, 'reporte_envios_federal.xlsx', 'Envíos Federal');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  tipoCargaTexto(tipoCarga: string): string {
    if (tipoCarga === 'CARGA_INICIAL') return 'Carga inicial';
    if (tipoCarga === 'ACTUALIZACION') return 'Actualización';
    return tipoCarga.replaceAll('_', ' ');
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
