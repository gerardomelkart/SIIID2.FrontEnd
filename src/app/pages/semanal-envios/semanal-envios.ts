import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { SemanalEnvioItem } from '../../core/models/semanal-envios.models';
import { SemanalEnviosService } from '../../core/services/semanal-envios.service';
import { SessionService } from '../../core/services/session.service';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

interface SemanaEnvio {
  anioSemana: number;
  numeroSemana: number;
  semana: string;
}

type CampoOrden = 'entidad' | 'clave' | 'fecha' | 'semana' | 'usuario' | 'estado';

@Component({
  selector: 'app-semanal-envios',
  imports: [FormsModule],
  templateUrl: './semanal-envios.html',
  styleUrls: ['../informes/informes.css', './semanal-envios.css'],
})
export class SemanalEnvios implements OnInit, OnDestroy {
  private readonly semanalEnviosService = inject(SemanalEnviosService);
  private readonly sessionService = inject(SessionService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);

  envios = signal<SemanalEnvioItem[]>([]);
  cargando = signal(false);
  busqueda = signal('');

  semanasEnvio = signal<SemanaEnvio[]>([]);
  semanaEnvioSeleccionada = signal('');
  descargandoAcuses = signal(false);

  paginaActual = signal(1);
  tamanioPagina = 10;
  orden = signal<EstadoOrden<CampoOrden> | null>(null);

  descargandoAcuse = signal<string | null>(null);
  descargandoArchivos = signal<string | null>(null);
  exportandoExcel = signal(false);

  acuseUrl = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Informe semanal');
  private acuseObjectUrl: string | null = null;

  operacionEnCurso = computed(
    () =>
      this.descargandoAcuse() !== null ||
      this.descargandoArchivos() !== null ||
      this.descargandoAcuses() ||
      this.exportandoExcel(),
  );

  enviosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const semanaSeleccionada = this.semanaEnvioSeleccionada();

    const registros = this.envios().filter((envio) => {
      const keySemana = `${envio.anioSemana}-${envio.numeroSemana.toString().padStart(2, '0')}`;

      if (semanaSeleccionada && keySemana !== semanaSeleccionada) return false;
      if (!texto) return true;

      return (
        envio.entidadFederativa.toLowerCase().includes(texto) ||
        envio.claveEntidad.toLowerCase().includes(texto) ||
        envio.fechaEnvioTexto.toLowerCase().includes(texto) ||
        envio.semana.toLowerCase().includes(texto) ||
        envio.usuarioCarga.toLowerCase().includes(texto) ||
        envio.codigoReferencia.toLowerCase().includes(texto) ||
        envio.tipoCarga.toLowerCase().includes(texto) ||
        envio.estado.toLowerCase().includes(texto) ||
        envio.estadoTexto.toLowerCase().includes(texto)
      );
    });

    return ordenarPorEstado(registros, this.orden(), (envio, campo) =>
      this.obtenerValorOrden(envio, campo),
    );
  });

  enviosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanioPagina;
    return this.enviosFiltrados().slice(inicio, inicio + this.tamanioPagina);
  });

  totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.enviosFiltrados().length / this.tamanioPagina)),
  );

  ngOnInit(): void {
    this.cargarEnvios();
  }

  ngOnDestroy(): void {
    this.cerrarAcuse();
  }

  cargarEnvios(): void {
    this.cargando.set(true);

    this.semanalEnviosService.obtenerEnvios().subscribe({
      next: (response) => {
        const registros = response.registros ?? [];

        this.envios.set(registros);
        this.sincronizarSemanasEnvio(registros);
        this.paginaActual.set(1);
        this.cargando.set(false);
      },
      error: async (error: unknown) => {
        this.cargando.set(false);

        mostrarError(
          'No fue posible consultar los envíos semanales',
          await obtenerMensajeErrorHttpAsync(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  descargarAcusesSemana(): void {
    const semana = this.semanaEnvioSeleccionada();
    const [anioTexto, numeroTexto] = semana.split('-');
    const anioSemana = Number(anioTexto);
    const numeroSemana = Number(numeroTexto);

    if (
      !Number.isInteger(anioSemana) ||
      !Number.isInteger(numeroSemana) ||
      numeroSemana < 1 ||
      numeroSemana > 53
    ) {
      mostrarAdvertencia('Semana inválida', 'Seleccione una semana válida.');
      return;
    }

    this.descargandoAcuses.set(true);

    this.semanalEnviosService.crearTicketDescargaAcuses(anioSemana, numeroSemana).subscribe({
      next: (response) => {
        if (!response.ticket) {
          this.descargandoAcuses.set(false);
          mostrarAdvertencia('Descarga no disponible', 'La API no devolvió un ticket de descarga.');
          return;
        }

        const url = this.semanalEnviosService.obtenerUrlDescargaAcuses(response.ticket);
        const iframe = document.createElement('iframe');

        iframe.src = url;
        iframe.style.display = 'none';

        document.body.appendChild(iframe);
        this.descargandoAcuses.set(false);

        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 60000);
      },
      error: async (error: unknown) => {
        this.descargandoAcuses.set(false);

        mostrarError(
          'No fue posible descargar los acuses',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  buscarEnvios(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  cambiarSemanaEnvios(): void {
    this.paginaActual.set(1);
  }
  ordenarPor(campo: CampoOrden): void {
    this.orden.set(alternarOrden(this.orden(), campo));
    this.paginaActual.set(1);
  }

  iconoOrden(campo: CampoOrden): string {
    return obtenerIconoOrden(this.orden(), campo);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.paginaActual.set(pagina);
  }

  verAcuse(envio: SemanalEnvioItem): void {
    if (!envio.endpointAcuse) return;

    this.descargandoAcuse.set(envio.codigoReferencia);

    this.semanalEnviosService.descargarDesdeEndpoint(envio.endpointAcuse).subscribe({
      next: (response) => {
        this.descargandoAcuse.set(null);

        if (!response.body) {
          mostrarError('Informe vacío', 'La API no devolvió el informe semanal.');
          return;
        }

        const pdf = crearSafeBlobUrl(response.body, this.sanitizer, this.acuseObjectUrl);

        this.acuseObjectUrl = pdf.objectUrl;
        this.acuseUrl.set(pdf.safeUrl);
        this.acuseTitulo.set(
          `${envio.esConfirmado ? 'Acuse' : 'Informe previo'} — ${envio.entidadFederativa} — ${this.semanaTexto(envio)}`,
        );
      },
      error: async (error: unknown) => {
        this.descargandoAcuse.set(null);

        mostrarError(
          'No fue posible consultar el informe',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  descargarArchivos(envio: SemanalEnvioItem): void {
    this.descargandoArchivos.set(envio.codigoReferencia);

    this.semanalEnviosService.descargarArchivos(envio.codigoReferencia).subscribe({
      next: (response) => {
        this.descargandoArchivos.set(null);

        if (!response.body) {
          mostrarError('Archivo vacío', 'La API no devolvió archivos semanales.');
          return;
        }

        const nombre =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) ||
          `ARCHIVOS_${envio.codigoReferencia}.zip`;

        this.descargarBlob(response.body, nombre);
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

  resolverPendiente(envio: SemanalEnvioItem): void {
    if (!envio.puedeResolverPendiente) return;

    const ruta = envio.tipoCarga === 'ACTUALIZACION' ? '/semanal/actualizacion' : '/semanal/carga';

    void this.router.navigate([ruta], {
      queryParams: {
        resolver: envio.codigoReferencia,
      },
    });
  }

  async exportarExcel(): Promise<void> {
    this.exportandoExcel.set(true);

    try {
      const filas = this.enviosFiltrados().map((envio) => ({
        'Entidad federativa': envio.entidadFederativa,
        'Cve. entidad': envio.claveEntidad,
        'Fecha de envío': envio.fechaEnvioTexto,
        Semana: envio.semana,
        'Usuario envío': envio.usuarioCarga,
        Estatus: envio.estadoTexto,
      }));

      const exportado = await exportarFilasExcel(
        filas,
        'consulta_envios_semanales.xlsx',
        'Envios semanales',
      );

      if (!exportado) mostrarError('Sin registros', 'No existen envíos para exportar.');
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(false);
    }
  }

  cerrarAcuse(): void {
    revocarObjectUrl(this.acuseObjectUrl);
    this.acuseObjectUrl = null;
    this.acuseUrl.set(null);
  }

  tipoCargaTexto(tipoCarga: string): string {
    return tipoCarga === 'ACTUALIZACION' ? 'Actualización' : 'Carga inicial';
  }

  semanaTexto(envio: SemanalEnvioItem): string {
    return `Semana ${envio.numeroSemana}/${envio.anioSemana}`;
  }

  rangoSemanaTexto(envio: SemanalEnvioItem): string {
    return `${this.fechaCorta(envio.fechaInicioSemana)} al ${this.fechaCorta(envio.fechaFinSemana)}`;
  }

  fechaCorta(fecha: string | null): string {
    if (!fecha) return '-';

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return '-';

    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(valor);
  }

  fechaHoraTexto(fecha: string | null): string {
    if (!fecha) return '-';

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return '-';

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(valor);
  }

  totalRegistros(envio: SemanalEnvioItem): number {
    return (
      envio.totalCarpetasIncluidas + envio.totalDelitosIncluidos + envio.totalVictimasIncluidas
    );
  }

  esEstadoConfirmado(envio: SemanalEnvioItem): boolean {
    return envio.esConfirmado;
  }

  esEstadoPendiente(envio: SemanalEnvioItem): boolean {
    return envio.esPendiente;
  }

  private obtenerValorOrden(envio: SemanalEnvioItem, campo: CampoOrden): ValorOrden {
    switch (campo) {
      case 'entidad':
        return envio.entidadFederativa;
      case 'clave':
        return envio.claveEntidad;
      case 'fecha':
        return envio.fechaMovimiento;
      case 'semana':
        return envio.anioSemana * 100 + envio.numeroSemana;
      case 'usuario':
        return envio.usuarioCarga;
      case 'estado':
        return envio.estadoTexto;
    }
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

  private obtenerNombreArchivo(contentDisposition: string | null): string {
    if (!contentDisposition) return '';

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const normalMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return normalMatch?.[1] ?? '';
  }

  private sincronizarSemanasEnvio(registros: SemanalEnvioItem[]): void {
    const mapa = new Map<string, SemanaEnvio>();

    for (const registro of registros) {
      const key = `${registro.anioSemana}-${registro.numeroSemana.toString().padStart(2, '0')}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          anioSemana: registro.anioSemana,
          numeroSemana: registro.numeroSemana,
          semana: registro.semana,
        });
      }
    }

    const semanas = Array.from(mapa.values()).sort(
      (a, b) => b.anioSemana * 100 + b.numeroSemana - (a.anioSemana * 100 + a.numeroSemana),
    );

    this.semanasEnvio.set(semanas);

    if (semanas.length === 0) {
      this.semanaEnvioSeleccionada.set('');
      return;
    }

    const seleccionada = this.semanaEnvioSeleccionada();
    const existeSeleccionada = semanas.some(
      (semana) =>
        `${semana.anioSemana}-${semana.numeroSemana.toString().padStart(2, '0')}` === seleccionada,
    );

    if (!existeSeleccionada) {
      const primera = semanas[0];

      this.semanaEnvioSeleccionada.set(
        `${primera.anioSemana}-${primera.numeroSemana.toString().padStart(2, '0')}`,
      );
    }
  }
}
