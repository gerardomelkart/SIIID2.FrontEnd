import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

import { SessionService } from '../../core/services/session.service';
import { InformesService } from '../../core/services/informes.service';
import {
  CorteOperativo,
  InformeEnvioItem,
  InformeReporteCargaItem,
  TipoReporte
} from '../../core/models/informes.models';

type DireccionOrden = 'asc' | 'desc';

type CampoOrdenEnvios =
  | 'entidadFederativa'
  | 'claveEntidad'
  | 'fechaEnvioTexto'
  | 'corte'
  | 'usuarioEnvio';

type CampoOrdenCargas =
  | 'entidadFederativa'
  | 'claveEntidad'
  | 'corte'
  | 'intentos'
  | 'ultimoIntento'
  | 'estatusUltimoIntento'
  | 'fechaUltimaCargaTexto';

@Component({
  selector: 'app-informes',
  imports: [FormsModule],
  templateUrl: './informes.html',
  styleUrl: './informes.css'
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

  ordenEnvios = signal<{ campo: CampoOrdenEnvios; direccion: DireccionOrden } | null>(null);
  ordenCargas = signal<{ campo: CampoOrdenCargas; direccion: DireccionOrden } | null>(null);

  descargaEnProceso = computed(() => {
    return this.descargandoAcuse() !== null || this.descargandoArchivos() !== null;
  });

  envios = signal<InformeEnvioItem[]>([]);
  cargas = signal<InformeReporteCargaItem[]>([]);

  acuseUrl = signal<string | null>(null);
  acuseUrlSegura = signal<SafeResourceUrl | null>(null);
  acuseTitulo = signal('Acuse de entrega de información');

  corteOperativo = signal<CorteOperativo>(this.obtenerCorteOperativoActual());

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      const reporte = data['reporte'] as TipoReporte | undefined;

      if (reporte === 'CARGAS' && !this.puedeVerCargas()) {
        this.reporteActivo.set('ENVIOS');
        this.cargarEnvios();
        return;
      }

      this.reporteActivo.set(reporte ?? 'ENVIOS');

      if (this.reporteActivo() === 'CARGAS') {
        this.cargarReporteCargas();
        return;
      }

      this.cargarEnvios();
    });
  }

  esSuperUsuario = computed(() => {
    return this.usuario()?.rol === 'SUPER_USUARIO';
  });

  esConsulta = computed(() => {
    return this.usuario()?.rol === 'CONSULTA';
  });

  esEnlaceEstatal = computed(() => {
    return this.usuario()?.rol === 'ENLACE_ESTATAL';
  });

  puedeVerCargas = computed(() => this.esSuperUsuario());

  puedeVerEnvios = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  entidadUsuario = computed(() => {
    return this.usuario()?.entidadFederativa ?? '';
  });

  enviosFiltrados = computed(() => {
    const texto = this.busquedaEnvios().trim().toLowerCase();

    const filtrados = this.envios().filter(envio => {
      if (!texto) {
        return true;
      }

      return envio.entidadFederativa.toLowerCase().includes(texto) ||
        envio.claveEntidad.toLowerCase().includes(texto) ||
        envio.fechaEnvioTexto.toLowerCase().includes(texto) ||
        envio.corte.toLowerCase().includes(texto) ||
        envio.usuarioEnvio.toLowerCase().includes(texto) ||
        envio.codigoReferencia.toLowerCase().includes(texto) ||
        envio.tipoCarga.toLowerCase().includes(texto);
    });

    return this.ordenarListaEnvios(filtrados);
  });

  cargasFiltradas = computed(() => {
    const texto = this.busquedaCargas().trim().toLowerCase();

    const filtradas = this.cargas().filter(carga => {
      if (!texto) {
        return true;
      }

      return carga.entidadFederativa.toLowerCase().includes(texto) ||
        carga.claveEntidad.toLowerCase().includes(texto) ||
        carga.corte.toLowerCase().includes(texto) ||
        (carga.ultimoIntento ?? '').toLowerCase().includes(texto) ||
        (carga.tipoCargaUltimoIntento ?? '').toLowerCase().includes(texto) ||
        (carga.estatusUltimoIntento ?? '').toLowerCase().includes(texto);
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

    this.reporteActivo.set(reporte);

    if (reporte === 'CARGAS') {
      this.cargarReporteCargas();
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

        Swal.fire({
          icon: 'error',
          title: 'No fue posible consultar los envíos',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  cargarReporteCargas(): void {
    if (!this.puedeVerCargas()) {
      return;
    }

    const corte = this.corteOperativo();

    this.cargandoCargas.set(true);

    this.informesService.obtenerReporteCargas({
      mesCorte: corte.mesCorte,
      anioCorte: corte.anioCorte
    }).subscribe({
      next: (response) => {
        this.cargas.set(response.registros ?? []);
        this.paginaCargas.set(1);
        this.cargandoCargas.set(false);
      },
      error: (error) => {
        this.cargandoCargas.set(false);

        Swal.fire({
          icon: 'error',
          title: 'No fue posible consultar el reporte de cargas',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
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

  etiquetaEstatus(estatus: string | null): string {
    if (!estatus) {
      return 'Sin carga';
    }

    if (estatus === 'CONFIRMADO') {
      return 'Confirmado';
    }

    if (estatus === 'VALIDADO_PENDIENTE') {
      return 'Pendiente';
    }

    if (estatus === 'VALIDADO_PENDIENTE_CONFIRMACION') {
      return 'Pendiente';
    }

    if (estatus === 'ERROR_VALIDACION') {
      return 'Con errores';
    }

    if (estatus === 'RECHAZADO') {
      return 'Rechazado';
    }

    if (estatus === 'EXPIRADO') {
      return 'Expirado';
    }

    return estatus.replaceAll('_', ' ');
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
    this.descargandoAcuse.set(envio.codigoReferencia);

    this.descargarEndpoint(
      envio.endpointAcuse,
      `ACUSE_${envio.codigoReferencia}.pdf`,
      true,
      () => this.descargandoAcuse.set(null)
    );
  }

  descargarArchivos(envio: InformeEnvioItem): void {
    this.descargandoArchivos.set(envio.codigoReferencia);

    this.descargarEndpoint(
      envio.endpointExcel,
      `ARCHIVOS_${envio.codigoReferencia}.zip`,
      false,
      () => this.descargandoArchivos.set(null)
    );
  }
  exportarExcel(tipo: TipoReporte): void {
    if (tipo === 'ENVIOS') {
      const filas = this.enviosFiltrados().map(envio => ({
        'Entidad federativa': envio.entidadFederativa,
        'Cve. entidad': envio.claveEntidad,
        'Fecha de envío': envio.fechaEnvioTexto,
        'Corte': envio.corte,
        'Usuario envío': envio.usuarioEnvio
      }));

      this.exportarFilasExcel(filas, 'consulta_envios.xlsx', 'Envios');
      return;
    }

    const filas = this.cargasFiltradas().map(carga => ({
      'Entidad federativa': carga.entidadFederativa,
      'Cve. entidad': carga.claveEntidad,
      'Periodo': carga.corte,
      'Intentos': carga.intentos,
      'Último intento': carga.ultimoIntento || '',
      'Estatus': this.etiquetaEstatus(carga.estatusUltimoIntento),
      'Fecha/hora último movimiento': carga.fechaUltimaCargaTexto || ''
    }));

    this.exportarFilasExcel(filas, 'reporte_cargas.xlsx', 'Cargas');
  }
  private descargarEndpoint(
    endpoint: string,
    nombreDefault: string,
    abrirEnNuevaPestana: boolean,
    finalizar?: () => void
  ): void {
    if (!endpoint) {
      finalizar?.();

      Swal.fire({
        icon: 'warning',
        title: 'Archivo no disponible',
        text: 'La API no proporcionó una ruta de descarga.',
        confirmButtonColor: '#691C32'
      });

      return;
    }

    this.informesService.descargarDesdeEndpoint(endpoint).subscribe({
      next: (response) => {
        const blob = response.body;

        if (!blob) {
          finalizar?.();

          Swal.fire({
            icon: 'warning',
            title: 'Archivo vacío',
            text: 'La descarga no devolvió contenido.',
            confirmButtonColor: '#691C32'
          });

          return;
        }

        const nombreArchivo = this.obtenerNombreArchivo(response.headers.get('content-disposition')) || nombreDefault;
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

        Swal.fire({
          icon: 'error',
          title: 'No fue posible descargar el archivo',
          text: await this.obtenerMensajeErrorBlob(error),
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  ordenarEnviosPor(campo: CampoOrdenEnvios): void {
  const ordenActual = this.ordenEnvios();

  if (ordenActual?.campo === campo) {
    this.ordenEnvios.set({
      campo,
      direccion: ordenActual.direccion === 'asc' ? 'desc' : 'asc'
    });

    this.paginaEnvios.set(1);
    return;
  }

  this.ordenEnvios.set({ campo, direccion: 'asc' });
  this.paginaEnvios.set(1);
}

ordenarCargasPor(campo: CampoOrdenCargas): void {
  const ordenActual = this.ordenCargas();

  if (ordenActual?.campo === campo) {
    this.ordenCargas.set({
      campo,
      direccion: ordenActual.direccion === 'asc' ? 'desc' : 'asc'
    });

    this.paginaCargas.set(1);
    return;
  }

  this.ordenCargas.set({ campo, direccion: 'asc' });
  this.paginaCargas.set(1);
}

iconoOrdenEnvios(campo: CampoOrdenEnvios): string {
  const orden = this.ordenEnvios();

  if (orden?.campo !== campo) {
    return 'fa-solid fa-sort sort-icon';
  }

  return orden.direccion === 'asc'
    ? 'fa-solid fa-sort-up sort-icon active'
    : 'fa-solid fa-sort-down sort-icon active';
}

iconoOrdenCargas(campo: CampoOrdenCargas): string {
  const orden = this.ordenCargas();

  if (orden?.campo !== campo) {
    return 'fa-solid fa-sort sort-icon';
  }

  return orden.direccion === 'asc'
    ? 'fa-solid fa-sort-up sort-icon active'
    : 'fa-solid fa-sort-down sort-icon active';
}

private ordenarListaEnvios(lista: InformeEnvioItem[]): InformeEnvioItem[] {
  const orden = this.ordenEnvios();

  if (!orden) {
    return lista;
  }

  return [...lista].sort((a, b) => {
    const valorA = this.obtenerValorOrdenEnvio(a, orden.campo);
    const valorB = this.obtenerValorOrdenEnvio(b, orden.campo);
    const resultado = this.compararValores(valorA, valorB);

    return orden.direccion === 'asc' ? resultado : resultado * -1;
  });
}

private ordenarListaCargas(lista: InformeReporteCargaItem[]): InformeReporteCargaItem[] {
  const orden = this.ordenCargas();

  if (!orden) {
    return lista;
  }

  return [...lista].sort((a, b) => {
    const valorA = this.obtenerValorOrdenCarga(a, orden.campo);
    const valorB = this.obtenerValorOrdenCarga(b, orden.campo);
    const resultado = this.compararValores(valorA, valorB);

    return orden.direccion === 'asc' ? resultado : resultado * -1;
  });
}

private obtenerValorOrdenEnvio(envio: InformeEnvioItem, campo: CampoOrdenEnvios): string | number | null {
  if (campo === 'fechaEnvioTexto') {
    return envio.fechaEnvio;
  }

  return envio[campo] ?? '';
}

private obtenerValorOrdenCarga(carga: InformeReporteCargaItem, campo: CampoOrdenCargas): string | number | null {
  if (campo === 'fechaUltimaCargaTexto') {
    return carga.fechaUltimaCarga;
  }

  return carga[campo] ?? '';
}

private compararValores(valorA: string | number | null | undefined, valorB: string | number | null | undefined): number {
  if (valorA === null || valorA === undefined || valorA === '') {
    return 1;
  }

  if (valorB === null || valorB === undefined || valorB === '') {
    return -1;
  }

  if (typeof valorA === 'number' && typeof valorB === 'number') {
    return valorA - valorB;
  }

  return String(valorA).localeCompare(String(valorB), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

private exportarFilasExcel(
  filas: Record<string, string | number>[],
  nombreArchivo: string,
  nombreHoja: string
): void {
  if (!filas.length) {
    Swal.fire({
      icon: 'info',
      title: 'Sin registros',
      text: 'No hay información para exportar.',
      confirmButtonColor: '#691C32'
    });

    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(filas);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);
  XLSX.writeFile(workbook, nombreArchivo);
}

  private async obtenerMensajeErrorBlob(error: any): Promise<string> {
    const contenido = error?.error;

    if (contenido instanceof Blob) {
      try {
        const texto = await contenido.text();
        const json = JSON.parse(texto);
        return json?.mensaje || 'Intente nuevamente.';
      } catch {
        return 'Intente nuevamente.';
      }
    }

    return contenido?.mensaje || 'Intente nuevamente.';
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
    let mesCorte = fecha.getMonth(); // Enero = 0, Junio = 5, entonces Junio -> Mayo = 5
    let anioCorte = fecha.getFullYear();

    if (mesCorte === 0) {
      mesCorte = 12;
      anioCorte--;
    }

    return {
      mesCorte,
      anioCorte,
      corte: `${this.obtenerNombreMes(mesCorte)} ${anioCorte}`
    };
  }

  private obtenerNombreMes(mes: number): string {
    const meses = [
      '',
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre'
    ];

    return meses[mes] ?? '';
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