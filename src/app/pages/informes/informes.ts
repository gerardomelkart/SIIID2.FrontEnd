import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { mostrarAdvertencia, mostrarError, mostrarInfo } from '../../core/utils/alert.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { ROLES } from '../../core/constants/roles.constants';
import { SessionService } from '../../core/services/session.service';
import { InformesService, TipoSabanaDescarga } from '../../core/services/informes.service';

import {
  obtenerMensajeErrorHttp,
  obtenerMensajeErrorHttpAsync,
} from '../../core/utils/http-error.utils';

import {
  CorteOperativo,
  InformeEnvioItem,
  InformeReporteCargaItem,
  PeriodoCorteInforme,
  TipoReporte,
} from '../../core/models/informes.models';

import {
  EstadoOrden,
  ValorOrden,
  alternarOrden,
  obtenerIconoOrden,
  ordenarPorEstado,
} from '../../core/utils/sort.utils';

type CampoOrdenEnvios =
  | 'entidadFederativa'
  | 'claveEntidad'
  | 'fechaEnvioTexto'
  | 'corte'
  | 'usuarioEnvio'
  | 'estadoTexto';

type CampoOrdenCargas =
  | 'entidadFederativa'
  | 'claveEntidad'
  | 'corte'
  | 'intentos'
  | 'ordenCarga'
  | 'estatusUltimoIntento'
  | 'fechaUltimaCargaTexto';

@Component({
  selector: 'app-informes',
  imports: [FormsModule],
  templateUrl: './informes.html',
  styleUrl: './informes.css',
})
export class Informes implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly informesService = inject(InformesService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  usuario = this.sessionService.usuario;

  reporteActivo = signal<TipoReporte>('ENVIOS');
  busquedaEnvios = signal('');
  busquedaCargas = signal('');

  paginaEnvios = signal(1);
  paginaCargas = signal(1);
  tamanioPagina = 10;

  cargandoEnvios = signal(false);
  cargandoCargas = signal(false);

  descargandoAcuse = signal<string | null>(null);
  descargandoArchivos = signal<string | null>(null);
  exportandoExcel = signal<TipoReporte | null>(null);

  descargandoSabanas = signal<TipoSabanaDescarga | null>(null);
  anioSabana = signal<number>(new Date().getFullYear());

  ordenEnvios = signal<EstadoOrden<CampoOrdenEnvios> | null>(null);
  ordenCargas = signal<EstadoOrden<CampoOrdenCargas> | null>(null);

  descargaEnProceso = computed(() => {
    return (
      this.descargandoAcuse() !== null ||
      this.descargandoArchivos() !== null ||
      this.exportandoExcel() !== null ||
      this.descargandoSabanas() !== null
    );
  });

  envios = signal<InformeEnvioItem[]>([]);
  cargas = signal<InformeReporteCargaItem[]>([]);

  acuseUrl = signal<string | null>(null);
  acuseUrlSegura = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Acuse de entrega de información');

  corteOperativo = signal<CorteOperativo>(this.obtenerCorteOperativoActual());

  periodosCorte = signal<PeriodoCorteInforme[]>([]);
  periodoCorteSeleccionado = signal<string>('');

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      const reporte = data['reporte'] as TipoReporte | undefined;

      if (reporte === 'CARGAS' && !this.puedeVerCargas()) {
        this.reporteActivo.set('ENVIOS');
        this.cargarEnvios();
        return;
      }

      if (reporte === 'SABANAS' && !this.puedeVerSabanas()) {
        this.reporteActivo.set('ENVIOS');
        this.cargarEnvios();
        return;
      }

      this.reporteActivo.set(reporte ?? 'ENVIOS');

      if (this.reporteActivo() === 'CARGAS') {
        this.cargarReporteCargas();
        return;
      }

      if (this.reporteActivo() === 'SABANAS') {
        return;
      }

      this.cargarEnvios();
    });
  }

  esSuperUsuario = computed(() => {
    return this.usuario()?.rol === ROLES.SUPER_USUARIO;
  });

  esConsulta = computed(() => {
    return this.usuario()?.rol === ROLES.CONSULTA;
  });

  esEnlaceEstatal = computed(() => {
    return this.usuario()?.rol === ROLES.ENLACE_ESTATAL;
  });

  puedeVerCargas = computed(() => this.esSuperUsuario());

  puedeVerSabanas = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  puedeVerEnvios = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  entidadUsuario = computed(() => {
    return this.usuario()?.entidadFederativa ?? '';
  });

  enviosFiltrados = computed(() => {
    const texto = this.busquedaEnvios().trim().toLowerCase();

    const filtrados = this.envios().filter((envio) => {
      if (!texto) {
        return true;
      }

      return (
        envio.entidadFederativa.toLowerCase().includes(texto) ||
        envio.claveEntidad.toLowerCase().includes(texto) ||
        envio.fechaEnvioTexto.toLowerCase().includes(texto) ||
        envio.corte.toLowerCase().includes(texto) ||
        envio.usuarioEnvio.toLowerCase().includes(texto) ||
        envio.codigoReferencia.toLowerCase().includes(texto) ||
        envio.tipoCarga.toLowerCase().includes(texto) ||
        envio.estado.toLowerCase().includes(texto) ||
        envio.estadoTexto.toLowerCase().includes(texto)
      );
    });
    return this.ordenarListaEnvios(filtrados);
  });

  cargasFiltradas = computed(() => {
    const texto = this.busquedaCargas().trim().toLowerCase();
    const corte = this.corteOperativo();

    const filtradas = this.cargas().filter((carga) => {
      if (carga.claveEntidad === '00') {
        return false;
      }

      if (carga.mesCorte !== corte.mesCorte || carga.anioCorte !== corte.anioCorte) {
        return false;
      }

      if (!carga.intentos || carga.intentos === 0) {
        return false;
      }

      if (!texto) {
        return true;
      }

      return (
        carga.entidadFederativa.toLowerCase().includes(texto) ||
        carga.claveEntidad.toLowerCase().includes(texto) ||
        carga.corte.toLowerCase().includes(texto) ||
        (carga.tipoCargaUltimoIntento ?? '').toLowerCase().includes(texto) ||
        (carga.estatusUltimoIntento ?? '').toLowerCase().includes(texto)
      );
    });

    return this.ordenarListaCargas(filtradas);
  });

  enviosPaginados = computed(() => {
    const inicio = (this.paginaEnvios() - 1) * this.tamanioPagina;
    return this.enviosFiltrados().slice(inicio, inicio + this.tamanioPagina);
  });

  cargasPaginadas = computed(() => {
    const inicio = (this.paginaCargas() - 1) * this.tamanioPagina;
    return this.cargasFiltradas().slice(inicio, inicio + this.tamanioPagina);
  });

  totalPaginasEnvios = computed(() => {
    return Math.max(1, Math.ceil(this.enviosFiltrados().length / this.tamanioPagina));
  });

  totalPaginasCargas = computed(() => {
    return Math.max(1, Math.ceil(this.cargasFiltradas().length / this.tamanioPagina));
  });

  cambiarReporte(reporte: TipoReporte): void {
    if (reporte === 'CARGAS' && !this.puedeVerCargas()) {
      return;
    }

    if (reporte === 'SABANAS' && !this.puedeVerSabanas()) {
      return;
    }

    this.reporteActivo.set(reporte);

    if (reporte === 'CARGAS') {
      this.cargarReporteCargas();
      return;
    }

    if (reporte === 'SABANAS') {
      return;
    }

    this.cargarEnvios();
  }

  cargarEnvios(): void {
    this.cargandoEnvios.set(true);

    this.informesService.obtenerEnvios().subscribe({
      next: (envios) => {
        this.envios.set(envios);
        this.paginaEnvios.set(1);
        this.cargandoEnvios.set(false);
      },
      error: (error) => {
        this.cargandoEnvios.set(false);

        mostrarError(
          'No fue posible consultar los envíos',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cargarReporteCargas(): void {
    if (!this.puedeVerCargas()) {
      return;
    }

    this.cargandoCargas.set(true);

    this.informesService.obtenerReporteCargas().subscribe({
      next: (response) => {
        const registros = response.registros ?? [];

        this.cargas.set(registros);
        this.sincronizarPeriodosCorte(registros);
        this.paginaCargas.set(1);
        this.cargandoCargas.set(false);
      },
      error: (error) => {
        this.cargandoCargas.set(false);

        mostrarError(
          'No fue posible consultar el reporte de cargas',
          obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'),
        );
      },
    });
  }

  cambiarCorteReporte(): void {
    this.sincronizarCorteSeleccionado();
    this.paginaCargas.set(1);
  }

  buscarEnvios(valor: string): void {
    this.busquedaEnvios.set(valor);
    this.paginaEnvios.set(1);
  }

  buscarCargas(valor: string): void {
    this.busquedaCargas.set(valor);
    this.paginaCargas.set(1);
  }

  cambiarPaginaEnvios(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasEnvios()) {
      return;
    }

    this.paginaEnvios.set(pagina);
  }

  cambiarPaginaCargas(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasCargas()) {
      return;
    }

    this.paginaCargas.set(pagina);
  }

  etiquetaEstatusCarga(carga: InformeReporteCargaItem): string {
    const estatus = this.normalizarTexto(carga.estatusUltimoIntento);
    const tipoCarga = this.normalizarTexto(carga.tipoCargaUltimoIntento);

    const sufijo = tipoCarga.includes('ACTUALIZACION') ? 'actualización' : 'carga';

    if (!estatus) {
      return 'Sin carga';
    }

    if (estatus.includes('CONFIRMADO')) {
      return `Confirmado ${sufijo}`;
    }

    if (estatus === 'PENDIENTE_APROBACION') {
      return 'Pendiente de aprobación';
    }

    if (estatus.includes('PENDIENTE')) {
      return `Pendiente ${sufijo}`;
    }

    if (estatus.includes('RECHAZADO')) {
      return `Rechazado ${sufijo}`;
    }

    if (estatus.includes('ERROR')) {
      return `Con errores ${sufijo}`;
    }

    if (estatus.includes('EXPIRADO')) {
      return `Expirado ${sufijo}`;
    }

    return estatus.replaceAll('_', ' ');
  }

  esEstatusConfirmado(estatus: string | null): boolean {
    return this.normalizarTexto(estatus).includes('CONFIRMADO');
  }

  esEstatusPendiente(estatus: string | null): boolean {
    return this.normalizarTexto(estatus).includes('PENDIENTE');
  }

  esEstatusError(estatus: string | null): boolean {
    const valor = this.normalizarTexto(estatus);

    return valor.includes('RECHAZADO') || valor.includes('ERROR') || valor.includes('EXPIRADO');
  }

  private normalizarTexto(valor: string | null | undefined): string {
    return (valor ?? '').toString().trim().toUpperCase().replaceAll('-', '_').replace(/\s+/g, '_');
  }

  tipoCargaTexto(tipoCarga: string | null): string {
    if (!tipoCarga) {
      return '';
    }

    if (tipoCarga === 'CARGA_INICIAL') {
      return 'Carga inicial';
    }

    if (tipoCarga === 'ACTUALIZACION') {
      return 'Actualización';
    }

    return tipoCarga.replaceAll('_', ' ');
  }

  verAcuse(envio: InformeEnvioItem): void {
    if (!envio.endpointAcuse) {
      mostrarAdvertencia(
        'Informe no disponible',
        'Este envío aún no tiene informe previo disponible.',
      );
      return;
    }

    this.descargandoAcuse.set(envio.codigoReferencia);

    this.descargarEndpoint(envio.endpointAcuse, `INFORME_${envio.codigoReferencia}.pdf`, true, () =>
      this.descargandoAcuse.set(null),
    );
  }

  descargarArchivos(envio: InformeEnvioItem): void {
    if (!envio.endpointExcel) {
      mostrarAdvertencia(
        'Archivos no disponibles',
        'Este envío aún no tiene archivos confirmados previos disponibles.',
      );
      return;
    }

    this.descargandoArchivos.set(envio.codigoReferencia);

    this.descargarEndpoint(
      envio.endpointExcel,
      `ARCHIVOS_${envio.codigoReferencia}.zip`,
      false,
      () => this.descargandoArchivos.set(null),
    );
  }

  async exportarExcel(tipo: TipoReporte): Promise<void> {
    if (tipo === 'SABANAS') {
      return;
    }
    this.exportandoExcel.set(tipo);

    try {
      if (tipo === 'ENVIOS') {
        const filas = this.enviosFiltrados().map((envio) => ({
          'Entidad federativa': envio.entidadFederativa,
          'Cve. entidad': envio.claveEntidad,
          'Fecha de envío': envio.fechaEnvioTexto,
          Corte: envio.corte,
          'Usuario envío': envio.usuarioEnvio,
          Estatus: envio.estadoTexto,
        }));

        const exportado = await exportarFilasExcel(filas, 'consulta_envios.xlsx', 'Envios');

        if (!exportado) {
          this.mostrarSinRegistrosExportacion();
        }

        return;
      }

      const filas = this.cargasFiltradas().map((carga) => ({
        'Entidad federativa': carga.entidadFederativa,
        'Cve. entidad': carga.claveEntidad,
        Periodo: carga.corte,
        Intentos: carga.intentos,
        Ranking: this.obtenerOrdenCarga(carga) ?? '',
        Estatus: this.etiquetaEstatusCarga(carga),
        'Fecha/hora último movimiento': carga.fechaUltimaCargaTexto || '',
      }));

      const exportado = await exportarFilasExcel(filas, 'reporte_cargas.xlsx', 'Cargas');

      if (!exportado) {
        this.mostrarSinRegistrosExportacion();
      }
    } catch {
      mostrarError('No fue posible exportar', 'Intente nuevamente.');
    } finally {
      this.exportandoExcel.set(null);
    }
  }

  descargarSabanas(tipo: TipoSabanaDescarga): void {
    if (!this.puedeVerSabanas()) {
      return;
    }

    const anio = Number(this.anioSabana());

    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      mostrarAdvertencia('Año inválido', 'Capture un año de corte válido.');
      return;
    }

    this.descargandoSabanas.set(tipo);

    this.informesService.crearTicketDescargaSabanas(anio, tipo).subscribe({
      next: (response) => {
        if (!response.ticket) {
          this.descargandoSabanas.set(null);
          mostrarAdvertencia('Descarga no disponible', 'La API no devolvió un ticket de descarga.');
          return;
        }

        const url = this.informesService.obtenerUrlDescargaSabanas(response.ticket);
        const iframe = document.createElement('iframe');

        iframe.src = url;
        iframe.style.display = 'none';

        document.body.appendChild(iframe);

        // Aquí ya terminó la generación. La descarga solo se está disparando.
        this.descargandoSabanas.set(null);

        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 60000);
      },
      error: async (error) => {
        this.descargandoSabanas.set(null);

        mostrarError(
          'No fue posible descargar los planos',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  private descargarEndpoint(
    endpoint: string,
    nombreDefault: string,
    abrirEnNuevaPestana: boolean,
    finalizar?: () => void,
  ): void {
    if (!endpoint) {
      finalizar?.();

      mostrarAdvertencia('Archivo no disponible', 'La API no proporcionó una ruta de descarga.');

      return;
    }

    this.informesService.descargarDesdeEndpoint(endpoint).subscribe({
      next: (response) => {
        const blob = response.body;

        if (!blob) {
          finalizar?.();

          mostrarAdvertencia('Archivo vacío', 'La descarga no devolvió contenido.');

          return;
        }

        const nombreArchivo =
          this.obtenerNombreArchivo(response.headers.get('content-disposition')) || nombreDefault;
        const url = URL.createObjectURL(blob);

        if (abrirEnNuevaPestana) {
          this.mostrarAcuse(url);
          finalizar?.();
          return;
        }

        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        link.click();

        URL.revokeObjectURL(url);
        finalizar?.();
      },
      error: async (error) => {
        finalizar?.();

        mostrarError(
          'No fue posible descargar el archivo',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }

  ordenCarga(carga: InformeReporteCargaItem): string {
    const orden = this.obtenerOrdenCarga(carga);

    return orden ? `${orden}°` : '-';
  }

  private obtenerOrdenCarga(carga: InformeReporteCargaItem): number | null {
    if (!carga.fechaUltimaCarga) {
      return null;
    }

    const corte = this.corteOperativo();

    const cargasOrdenadas = this.cargas()
      .filter((item) => item.claveEntidad !== '00')
      .filter((item) => item.mesCorte === corte.mesCorte && item.anioCorte === corte.anioCorte)
      .filter((item) => !!item.intentos && item.intentos > 0)
      .filter((item) => !!item.fechaUltimaCarga)
      .sort((a, b) => {
        const fechaA = new Date(a.fechaUltimaCarga!).getTime();
        const fechaB = new Date(b.fechaUltimaCarga!).getTime();

        if (fechaA !== fechaB) {
          return fechaA - fechaB;
        }

        return a.entidadFederativa.localeCompare(b.entidadFederativa, 'es', {
          sensitivity: 'base',
        });
      });

    const indice = cargasOrdenadas.findIndex(
      (item) =>
        item.idEntidadFederativa === carga.idEntidadFederativa &&
        item.mesCorte === carga.mesCorte &&
        item.anioCorte === carga.anioCorte,
    );

    return indice >= 0 ? indice + 1 : null;
  }

  ordenarEnviosPor(campo: CampoOrdenEnvios): void {
    this.ordenEnvios.set(alternarOrden(this.ordenEnvios(), campo));
  }

  ordenarCargasPor(campo: CampoOrdenCargas): void {
    this.ordenCargas.set(alternarOrden(this.ordenCargas(), campo));
  }

  iconoOrdenEnvios(campo: CampoOrdenEnvios): string {
    return obtenerIconoOrden(this.ordenEnvios(), campo);
  }

  iconoOrdenCargas(campo: CampoOrdenCargas): string {
    return obtenerIconoOrden(this.ordenCargas(), campo);
  }

  private ordenarListaEnvios(lista: InformeEnvioItem[]): InformeEnvioItem[] {
    return ordenarPorEstado(lista, this.ordenEnvios(), (envio, campo) =>
      this.obtenerValorOrdenEnvio(envio, campo),
    );
  }

  private ordenarListaCargas(lista: InformeReporteCargaItem[]): InformeReporteCargaItem[] {
    return ordenarPorEstado(lista, this.ordenCargas(), (carga, campo) =>
      this.obtenerValorOrdenCarga(carga, campo),
    );
  }

  private obtenerValorOrdenEnvio(envio: InformeEnvioItem, campo: CampoOrdenEnvios): ValorOrden {
    if (campo === 'fechaEnvioTexto') {
      return envio.fechaEnvio;
    }

    if (campo === 'corte') {
      return envio.anioCorte * 100 + envio.mesCorte;
    }

    return envio[campo] ?? '';
  }

  private obtenerValorOrdenCarga(
    carga: InformeReporteCargaItem,
    campo: CampoOrdenCargas,
  ): ValorOrden {
    if (campo === 'fechaUltimaCargaTexto') {
      return carga.fechaUltimaCarga;
    }

    if (campo === 'corte') {
      return carga.anioCorte * 100 + carga.mesCorte;
    }

    if (campo === 'ordenCarga') {
      return this.obtenerOrdenCarga(carga) ?? Number.MAX_SAFE_INTEGER;
    }

    return carga[campo] ?? '';
  }

  private sincronizarPeriodosCorte(registros: InformeReporteCargaItem[]): void {
    const periodos = this.obtenerPeriodosDesdeCargas(registros);
    const corteActual = this.obtenerCorteOperativoActual();
    const keyActual = this.obtenerKeyPeriodo(corteActual.mesCorte, corteActual.anioCorte);

    const existeCorteActual = periodos.some(
      (periodo) => this.obtenerKeyPeriodo(periodo.mesCorte, periodo.anioCorte) === keyActual,
    );

    if (!existeCorteActual) {
      periodos.unshift({
        mesCorte: corteActual.mesCorte,
        anioCorte: corteActual.anioCorte,
        corte: corteActual.corte,
      });
    }

    this.periodosCorte.set(periodos);

    if (!this.periodoCorteSeleccionado()) {
      this.periodoCorteSeleccionado.set(keyActual);
      this.corteOperativo.set(corteActual);
      return;
    }

    this.sincronizarCorteSeleccionado();
  }

  private obtenerPeriodosDesdeCargas(registros: InformeReporteCargaItem[]): PeriodoCorteInforme[] {
    const mapa = new Map<string, PeriodoCorteInforme>();

    for (const registro of registros) {
      if (!registro.mesCorte || !registro.anioCorte) {
        continue;
      }

      const key = this.obtenerKeyPeriodo(registro.mesCorte, registro.anioCorte);

      if (!mapa.has(key)) {
        mapa.set(key, {
          mesCorte: registro.mesCorte,
          anioCorte: registro.anioCorte,
          corte: registro.corte,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      const valorA = a.anioCorte * 100 + a.mesCorte;
      const valorB = b.anioCorte * 100 + b.mesCorte;

      return valorB - valorA;
    });
  }

  private obtenerKeyPeriodo(mesCorte: number, anioCorte: number): string {
    return `${anioCorte}-${mesCorte.toString().padStart(2, '0')}`;
  }

  private sincronizarCorteSeleccionado(): void {
    const key = this.periodoCorteSeleccionado();

    if (!key) {
      return;
    }

    const periodo = this.periodosCorte().find(
      (x) => this.obtenerKeyPeriodo(x.mesCorte, x.anioCorte) === key,
    );

    if (!periodo) {
      return;
    }

    this.corteOperativo.set({
      mesCorte: periodo.mesCorte,
      anioCorte: periodo.anioCorte,
      corte: periodo.corte,
    });
  }

  private mostrarSinRegistrosExportacion(): void {
    mostrarAdvertencia(
      'Sin registros para exportar',
      'La API no proporcionó registros para exportar.',
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

  private obtenerCorteOperativoActual(): CorteOperativo {
    const fecha = new Date();
    let mesCorte = fecha.getMonth();
    let anioCorte = fecha.getFullYear();

    if (mesCorte === 0) {
      mesCorte = 12;
      anioCorte--;
    }

    return {
      mesCorte,
      anioCorte,
      corte: this.obtenerNombreCorte(mesCorte, anioCorte),
    };
  }

  private obtenerNombreCorte(mesCorte: number, anioCorte: number): string {
    const fecha = new Date(anioCorte, mesCorte - 1, 1);
    const texto = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(fecha);

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  cerrarAcuse(): void {
    this.limpiarAcuseUrl();
  }

  private mostrarAcuse(url: string): void {
    this.limpiarAcuseUrl();

    this.acuseUrl.set(url);
    this.acuseUrlSegura.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.acuseTitulo.set('Acuse de entrega de información');
  }

  private limpiarAcuseUrl(): void {
    const urlActual = this.acuseUrl();

    if (urlActual) {
      URL.revokeObjectURL(urlActual);
    }

    this.acuseUrl.set(null);
    this.acuseUrlSegura.set(null);
  }
}
