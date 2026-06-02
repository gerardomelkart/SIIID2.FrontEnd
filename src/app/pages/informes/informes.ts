import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';

import { SessionService } from '../../core/services/session.service';
import { InformesService } from '../../core/services/informes.service';
import {
  CorteOperativo,
  InformeEnvioItem,
  InformeReporteCargaItem,
  TipoReporte
} from '../../core/models/informes.models';

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

  usuario = this.sessionService.usuario;

  reporteActivo = signal<TipoReporte>('ENVIOS');
  busquedaEnvios = signal('');
  busquedaCargas = signal('');

  paginaEnvios = signal(1);
  paginaCargas = signal(1);
  tamanioPagina = 10;

  cargandoEnvios = signal(false);
  cargandoCargas = signal(false);

  envios = signal<InformeEnvioItem[]>([]);
  cargas = signal<InformeReporteCargaItem[]>([]);

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

    return this.envios().filter(envio => {
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
  });

  cargasFiltradas = computed(() => {
    const texto = this.busquedaCargas().trim().toLowerCase();

    return this.cargas().filter(carga => {
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
    this.descargarEndpoint(envio.endpointAcuse, `ACUSE_${envio.codigoReferencia}.pdf`, true);
  }

  descargarArchivos(envio: InformeEnvioItem): void {
    this.descargarEndpoint(envio.endpointExcel, `ARCHIVOS_${envio.codigoReferencia}.zip`, false);
  }

  exportarExcel(tipo: TipoReporte): void {
    Swal.fire({
      icon: 'info',
      title: 'Exportación pendiente',
      text: `El endpoint de exportación general para ${tipo === 'ENVIOS' ? 'envíos' : 'cargas'} todavía no está conectado.`,
      confirmButtonColor: '#691C32'
    });
  }

  private descargarEndpoint(endpoint: string, nombreDefault: string, abrirEnNuevaPestana: boolean): void {
    if (!endpoint) {
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
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          return;
        }

        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        link.click();

        URL.revokeObjectURL(url);
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'No fue posible descargar el archivo',
          text: error?.error?.mensaje || 'Intente nuevamente.',
          confirmButtonColor: '#691C32'
        });
      }
    });
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
}