import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { SessionService } from '../../core/services/session.service';

type TipoReporte = 'ENVIOS' | 'CARGAS';
type EstatusCarga = 'CONFIRMADO' | 'PENDIENTE' | 'CON_ERRORES' | 'RECHAZADO' | 'PROCESANDO';

interface ReporteEnvio {
  id: number;
  entidadFederativa: string;
  claveEntidad: string;
  fechaEnvio: string;
  corte: string;
  usuarioEnvio: string;
  codigoReferencia: string;
}

interface ReporteCarga {
  id: number;
  entidadFederativa: string;
  claveEntidad: string;
  periodo: string;
  intentos: number;
  ultimoFolio: string;
  estatus: EstatusCarga;
  fechaUltimoMovimiento: string;
}

@Component({
  selector: 'app-informes',
  imports: [FormsModule],
  templateUrl: './informes.html',
  styleUrl: './informes.css'
})
export class Informes implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly route = inject(ActivatedRoute);

  usuario = this.sessionService.usuario;

  reporteActivo = signal<TipoReporte>('ENVIOS');
  busquedaEnvios = signal('');
  busquedaCargas = signal('');

  paginaEnvios = signal(1);
  paginaCargas = signal(1);
  tamanioPagina = 10;

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      const reporte = data['reporte'] as TipoReporte | undefined;

      if (reporte === 'CARGAS' && !this.puedeVerCargas()) {
        this.reporteActivo.set('ENVIOS');
        return;
      }

      this.reporteActivo.set(reporte ?? 'ENVIOS');
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

  envios = signal<ReporteEnvio[]>([
    {
      id: 1,
      entidadFederativa: 'Aguascalientes',
      claveEntidad: '01',
      fechaEnvio: '10-06-2025',
      corte: 'Mayo 2025',
      usuarioEnvio: 'AGUASCALIENTES USUARIO PRUEBA',
      codigoReferencia: 'AGS-202505-0001'
    },
    {
      id: 2,
      entidadFederativa: 'Aguascalientes',
      claveEntidad: '01',
      fechaEnvio: '09-07-2025',
      corte: 'Junio 2025',
      usuarioEnvio: 'AGUASCALIENTES USUARIO PRUEBA',
      codigoReferencia: 'AGS-202506-0001'
    },
    {
      id: 3,
      entidadFederativa: 'Ciudad de México',
      claveEntidad: '09',
      fechaEnvio: '10-06-2025',
      corte: 'Mayo 2025',
      usuarioEnvio: 'ENLACE CDMX',
      codigoReferencia: 'CDMX-202505-0001'
    },
    {
      id: 4,
      entidadFederativa: 'Ciudad de México',
      claveEntidad: '09',
      fechaEnvio: '09-07-2025',
      corte: 'Junio 2025',
      usuarioEnvio: 'ENLACE CDMX',
      codigoReferencia: 'CDMX-202506-0001'
    },
    {
      id: 5,
      entidadFederativa: 'Jalisco',
      claveEntidad: '14',
      fechaEnvio: '11-08-2025',
      corte: 'Julio 2025',
      usuarioEnvio: 'JALISCO USUARIO PRUEBA',
      codigoReferencia: 'JAL-202507-0001'
    },
    {
      id: 6,
      entidadFederativa: 'Campeche',
      claveEntidad: '04',
      fechaEnvio: '12-09-2025',
      corte: 'Agosto 2025',
      usuarioEnvio: 'CAMPECHE USUARIO PRUEBA',
      codigoReferencia: 'CAMP-202508-0001'
    }
  ]);

  cargas = signal<ReporteCarga[]>([
    {
      id: 1,
      entidadFederativa: 'Aguascalientes',
      claveEntidad: '01',
      periodo: 'Mayo 2025',
      intentos: 2,
      ultimoFolio: 'AGS-202505-0002',
      estatus: 'CONFIRMADO',
      fechaUltimoMovimiento: '10-06-2025 14:35'
    },
    {
      id: 2,
      entidadFederativa: 'Ciudad de México',
      claveEntidad: '09',
      periodo: 'Mayo 2025',
      intentos: 4,
      ultimoFolio: 'CDMX-202505-0004',
      estatus: 'CONFIRMADO',
      fechaUltimoMovimiento: '10-06-2025 16:12'
    },
    {
      id: 3,
      entidadFederativa: 'Jalisco',
      claveEntidad: '14',
      periodo: 'Junio 2025',
      intentos: 3,
      ultimoFolio: 'JAL-202506-0003',
      estatus: 'CON_ERRORES',
      fechaUltimoMovimiento: '09-07-2025 11:48'
    },
    {
      id: 4,
      entidadFederativa: 'Campeche',
      claveEntidad: '04',
      periodo: 'Junio 2025',
      intentos: 1,
      ultimoFolio: 'CAMP-202506-0001',
      estatus: 'PENDIENTE',
      fechaUltimoMovimiento: '09-07-2025 09:25'
    },
    {
      id: 5,
      entidadFederativa: 'Baja California',
      claveEntidad: '02',
      periodo: 'Julio 2025',
      intentos: 2,
      ultimoFolio: 'BC-202507-0002',
      estatus: 'RECHAZADO',
      fechaUltimoMovimiento: '11-08-2025 10:04'
    },
    {
      id: 6,
      entidadFederativa: 'Sonora',
      claveEntidad: '26',
      periodo: 'Agosto 2025',
      intentos: 1,
      ultimoFolio: 'SON-202508-0001',
      estatus: 'PROCESANDO',
      fechaUltimoMovimiento: '12-09-2025 13:22'
    }
  ]);

  enviosFiltrados = computed(() => {
    const texto = this.busquedaEnvios().trim().toLowerCase();

    return this.envios()
      .filter(envio => {
        if (this.esSuperUsuario()) {
          return true;
        }

        return envio.entidadFederativa === this.entidadUsuario();
      })
      .filter(envio => {
        if (!texto) {
          return true;
        }

        return envio.entidadFederativa.toLowerCase().includes(texto) ||
          envio.claveEntidad.toLowerCase().includes(texto) ||
          envio.fechaEnvio.toLowerCase().includes(texto) ||
          envio.corte.toLowerCase().includes(texto) ||
          envio.usuarioEnvio.toLowerCase().includes(texto) ||
          envio.codigoReferencia.toLowerCase().includes(texto);
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
        carga.periodo.toLowerCase().includes(texto) ||
        carga.ultimoFolio.toLowerCase().includes(texto) ||
        carga.estatus.toLowerCase().includes(texto);
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

  etiquetaEstatus(estatus: EstatusCarga): string {
    if (estatus === 'CONFIRMADO') {
      return 'Confirmado';
    }

    if (estatus === 'PENDIENTE') {
      return 'Pendiente';
    }

    if (estatus === 'CON_ERRORES') {
      return 'Con errores';
    }

    if (estatus === 'RECHAZADO') {
      return 'Rechazado';
    }

    return 'Procesando';
  }

  verAcuse(codigoReferencia: string): void {
    alert(`Mock visual: abrir acuse ${codigoReferencia}`);
  }

  descargarArchivos(codigoReferencia: string): void {
    alert(`Mock visual: descargar archivos enviados ${codigoReferencia}`);
  }

  exportarExcel(tipo: TipoReporte): void {
    alert(`Mock visual: exportar Excel ${tipo}`);
  }
}