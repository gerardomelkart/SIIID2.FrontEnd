import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CargaValidacionError,
  CargaValidacionResumenItem,
} from '../../core/models/carga.models';
import {
  SemanalCargaPeriodoRequest,
  SemanalCargaValidacionResponse,
  TipoContenidoSemanal,
} from '../../core/models/semanal-carga.models';
import { SemanalCargaService } from '../../core/services/semanal-carga.service';
import {
  ArchivoCargaTipo,
  ArchivosCargaSeleccionados,
} from '../../core/types/archivo-carga.types';
import {
  actualizarArchivoSeleccionado,
  crearArchivosCargaVacios,
  obtenerArchivoDesdeEvento,
  obtenerResumenPorArchivo,
  tieneTresArchivosSeleccionados,
} from '../../core/utils/archivo-carga.utils';
import {
  mostrarError,
  mostrarExitoInstitucional,
} from '../../core/utils/alert.utils';
import {
  obtenerErrorPayload,
  obtenerMensajeErrorHttp,
} from '../../core/utils/http-error.utils';

type EstadoCargaSemanal =
  | 'CAPTURA'
  | 'VALIDANDO'
  | 'RESULTADO'
  | 'CONFIRMANDO';

interface SemanalCargaFormulario {
  tipoContenido: TipoContenidoSemanal;
  anioSemana: number | null;
  numeroSemana: number | null;
  fechaInicioSemana: string;
  mesCorte: number;
  anioCorte: number;
}

interface VistaTramoSemanal {
  fechaInicioSemana: Date;
  fechaFinSemana: Date;
  fechaInicioTramo: Date | null;
  fechaFinTramo: Date | null;
  intersecaMes: boolean;
  semanaCortada: boolean;
}

@Component({
  selector: 'app-semanal-carga',
  imports: [FormsModule],
  templateUrl: './semanal-carga.html',
  styleUrls: [
    '../semanal-usuarios/semanal-usuarios.css',
    './semanal-carga.css',
  ],
})
export class SemanalCarga {
  private readonly semanalCargaService = inject(SemanalCargaService);
  private readonly router = inject(Router);

  readonly meses = [
    { valor: 1, nombre: 'Enero' },
    { valor: 2, nombre: 'Febrero' },
    { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' },
    { valor: 5, nombre: 'Mayo' },
    { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' },
    { valor: 8, nombre: 'Agosto' },
    { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' },
    { valor: 11, nombre: 'Noviembre' },
    { valor: 12, nombre: 'Diciembre' },
  ];

  readonly tiposArchivo: ReadonlyArray<{
    tipo: ArchivoCargaTipo;
    nombre: string;
    icono: string;
    plantilla: string;
    recibidos: string;
    incluidos: string;
    excluidos: string;
  }> = [
    {
      tipo: 'carpetas',
      nombre: 'Carpetas',
      icono: 'fa-folder-open',
      plantilla: 'plantillas/carpetas.xlsx',
      recibidos: 'Recibidas',
      incluidos: 'Incluidas',
      excluidos: 'Excluidas',
    },
    {
      tipo: 'delitos',
      nombre: 'Delitos',
      icono: 'fa-scale-balanced',
      plantilla: 'plantillas/delitos.xlsx',
      recibidos: 'Recibidos',
      incluidos: 'Incluidos',
      excluidos: 'Excluidos',
    },
    {
      tipo: 'victimas',
      nombre: 'Víctimas',
      icono: 'fa-users',
      plantilla: 'plantillas/victimas.xlsx',
      recibidos: 'Recibidas',
      incluidos: 'Incluidas',
      excluidos: 'Excluidas',
    },
  ];

  archivos = signal<ArchivosCargaSeleccionados>(
    crearArchivosCargaVacios(),
  );
  formulario = signal<SemanalCargaFormulario>(
    this.crearFormularioInicial(),
  );
  estado = signal<EstadoCargaSemanal>('CAPTURA');
  respuesta = signal<SemanalCargaValidacionResponse | null>(null);
  errorGeneral = signal('');

  tramoPrevisto = computed(() => this.calcularTramo(this.formulario()));

  periodoValido = computed(() => {
    const formulario = this.formulario();
    const tramo = this.tramoPrevisto();

    return (
      formulario.anioSemana !== null &&
      formulario.anioSemana >= 2000 &&
      formulario.anioSemana <= 2100 &&
      formulario.numeroSemana !== null &&
      formulario.numeroSemana >= 1 &&
      formulario.numeroSemana <= 53 &&
      formulario.anioCorte >= 2000 &&
      formulario.anioCorte <= 2100 &&
      formulario.mesCorte >= 1 &&
      formulario.mesCorte <= 12 &&
      tramo?.intersecaMes === true
    );
  });

  puedeValidar = computed(
    () =>
      tieneTresArchivosSeleccionados(this.archivos()) &&
      this      this.periodoValido() &&
      this.estado() !== 'VALIDANDO' &&
      this.estado() !== 'CONFIRMANDO',
  );

  mostrandoResultado = computed(
    () =>
      this.estado() === 'RESULTADO' ||
      this.estado() === 'CONFIRMANDO',
  );

  respuestaValida = computed(
    () => this.respuesta()?.esValido === true,
  );

  errores = computed(() => this.respuesta()?.errores ?? []);
  advertencias = computed(
    () => this.respuesta()?.advertencias ?? [],
  );

  detallesValidacion = computed<CargaValidacionError[]>(() => [
    ...this.errores(),
    ...this.advertencias(),
  ]);

  actualizarCampo<K extends keyof SemanalCargaFormulario>(
    campo: K,
    valor: SemanalCargaFormulario[K],
  ): void {
    this.formulario.update((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    this.limpiarResultado();
  }

  seleccionarArchivo(event: Event, tipo: ArchivoCargaTipo): void {
    const archivo = obtenerArchivoDesdeEvento(event);

    this.archivos.set(
      actualizarArchivoSeleccionado(
        this.archivos(),
        tipo,
        archivo,
      ),
    );

    this.limpiarResultado();
  }

  nombreArchivo(tipo: ArchivoCargaTipo): string {
    return (
      this.archivos()[tipo]?.name ?? 'Ningún archivo seleccionado'
    );
  }

  tamanioArchivo(tipo: ArchivoCargaTipo): string {
    const bytes = this.archivos()[tipo]?.size;

    if (bytes === undefined) return '';

    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  validarArchivos(): void {
    const archivos = this.archivos();
    const formulario = this.formulario();

    if (!tieneTresArchivosSeleccionados(archivos)) {
      this.errorGeneral.set(
        'Debe seleccionar los archivos de carpetas, delitos y víctimas.',
      );
      return;
    }

    if (
      !this.periodoValido() ||
      formulario.anioSemana === null ||
      formulario.numeroSemana === null
    ) {
      this.errorGeneral.set(
        'Complete un periodo semanal válido antes de continuar.',
      );
      return;
    }

    const periodo: SemanalCargaPeriodoRequest = {
      tipoContenido: formulario.tipoContenido,
      anioSemana: formulario.anioSemana,
      numeroSemana: formulario.numeroSemana,
      fechaInicioSemana: formulario.fechaInicioSemana,
      mesCorte: formulario.mesCorte,
      anioCorte: formulario.anioCorte,
    };

    this.estado.set('VALIDANDO');
    this.respuesta.set(null);
    this.errorGeneral.set('');

    this.semanalCargaService
      .validarArchivos(archivos, periodo)
      .subscribe({
        next: (response) => {
          this.respuesta.set(response);
          this.estado.set('RESULTADO');
        },
        error: (error: unknown) => {
          const response =
            obtenerErrorPayload<SemanalCargaValidacionResponse>(
              error,
            );

          if (response?.errores || response?.resumenValidacion) {
            this.respuesta.set(response);
            this.estado.set('RESULTADO');
            return;
          }

          this.estado.set('CAPTURA');
          this.errorGeneral.set(
            obtenerMensajeErrorHttp(
              error,
              'No fue posible validar la carga semanal.',
            ),
          );
        },
      });
  }

  confirmarCarga(aceptar: boolean): void {
    const response = this.respuesta();

    if (
      !response?.esValido ||
      !response.codigoReferencia ||
      this.estado() === 'CONFIRMANDO'
    ) {
      return;
    }

    this.estado.set('CONFIRMANDO');

    this.semanalCargaService
      .confirmarCarga({
        codigoReferencia: response.codigoReferencia,
        aceptar,
      })
      .subscribe({
        next: (resultado) => {
          const pendienteAprobacion =
            resultado.estado === 'PENDIENTE_APROBACION';

          const titulo = aceptar
            ? pendienteAprobacion
              ? 'Carga enviada a revisión'
              : 'Carga semanal confirmada'
            : 'Carga semanal rechazada';

          mostrarExitoInstitucional(
            titulo,
            resultado.mensaje,
          ).then(() => {
            this.reiniciarFormulario();
            void this.router.navigateByUrl('/semanal');
          });
        },
        error: (error: unknown) => {
          this.estado.set('RESULTADO');

          mostrarError(
            aceptar
              ? 'No fue posible confirmar la carga'
              : 'No fue posible rechazar la carga',
            obtenerMensajeErrorHttp(
              error,
              'Revise la conexión con la API.',
            ),
          );
        },
      });
  }

  volverACaptura(): void {
    if (this.estado() === 'CONFIRMANDO') return;

    this.respuesta.set(null);
    this.errorGeneral.set('');
    this.estado.set('CAPTURA');
  }

  reiniciarFormulario(): void {
    this.archivos.set(crearArchivosCargaVacios());
    this.formulario.set(this.crearFormularioInicial());
    this.respuesta.set(null);
    this.errorGeneral.set('');
    this.estado.set('CAPTURA');
  }

  totalRecibido(tipo: ArchivoCargaTipo): number {
    const response = this.respuesta();

    if (!response) return 0;

    if (tipo === 'carpetas') {
      return (
        response.totalCarpetasIncluidas +
        response.totalCarpetasExcluidas
      );
    }

    if (tipo === 'delitos') {
      return (
        response.totalDelitosIncluidos +
        response.totalDelitosExcluidos
      );
    }

    return (
      response.totalVictimasIncluidas +
      response.totalVictimasExcluidas
    );
  }

  totalIncluido(tipo: ArchivoCargaTipo): number {
    const response = this.respuesta();

    if (!response) return 0;

    if (tipo === 'carpetas') {
      return response.totalCarpetasIncluidas;
    }

    if (tipo === 'delitos') {
      return response.totalDelitosIncluidos;
    }

    return response.totalVictimasIncluidas;
  }

  totalExcluido(tipo: ArchivoCargaTipo): number {
    const response = this.respuesta();

    if (!response) return 0;

    if (tipo === 'carpetas') {
      return response.totalCarpetasExcluidas;
    }

    if (tipo === 'delitos') {
      return response.totalDelitosExcluidos;
    }

    return response.totalVictimasExcluidas;
  }

  formatearFecha(
    valor: string | Date | null | undefined,
  ): string {
    if (!valor) return '-';

    const fecha =
      valor instanceof Date ? valor : this.convertirFecha(valor);

    return fecha
      ? new Intl.DateTimeFormat('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(fecha)
      : '-';
  }

  etiquetaTipoContenido(
    tipo: TipoContenidoSemanal | undefined,
  ): string {
    return tipo === 'ACUMULADO_MES'
      ? 'Acumulado del mes'
      : 'Solo semana';
  }

  nombreMes(numero: number | undefined): string {
    return (
      this.meses.find((mes) => mes.valor === numero)?.nombre ?? '-'
    );
  }

  esErrorDetalle(detalle: CargaValidacionError): boolean {
    return this.errores().includes(detalle);
  }

  resumenPorArchivo(
    tipo: ArchivoCargaTipo,
  ): CargaValidacionResumenItem[] {
    return obtenerResumenPorArchivo(
      this.respuesta()?.resumenValidacion ?? [],
      tipo,
    );
  }

  private limpiarResultado(): void {
    if (
      this.estado() === 'VALIDANDO' ||
      this.estado() === 'CONFIRMANDO'
    ) {
      return;
    }

    this.respuesta.set(null);
    this.errorGeneral.set('');
    this.estado.set('CAPTURA');
  }

  private crearFormularioInicial(): SemanalCargaFormulario {
    const hoy = new Date();

    return {
      tipoContenido: 'SOLO_SEMANA',
      anioSemana: hoy.getFullYear(),
      numeroSemana: null,
      fechaInicioSemana: '',
      mesCorte: hoy.getMonth() + 1,
      anioCorte: hoy.getFullYear(),
    };
  }

  private calcularTramo(
    formulario: SemanalCargaFormulario,
  ): VistaTramoSemanal | null {
    const fechaInicioSemana = this.convertirFecha(
      formulario.fechaInicioSemana,
    );

    if (
      !fechaInicioSemana ||
      formulario.mesCorte < 1 ||
      formulario.mesCorte > 12
    ) {
      return null;
    }

    const fechaFinSemana = this.sumarDias(fechaInicioSemana, 6);
    const fechaInicioMes = new Date(
      formulario.anioCorte,
      formulario.mesCorte - 1,
      1,
    );
    const fechaFinMes = new Date(
      formulario.anioCorte,
      formulario.mesCorte,
      0,
    );

    const fechaInicioTramo =
      fechaInicioSemana > fechaInicioMes
        ? fechaInicioSemana
        : fechaInicioMes;

    const fechaFinTramo =
      fechaFinSemana < fechaFinMes
        ? fechaFinSemana
        : fechaFinMes;

    const intersecaMes = fechaInicioTramo <= fechaFinTramo;

    return {
      fechaInicioSemana,
      fechaFinSemana,
      fechaInicioTramo: intersecaMes
        ? fechaInicioTramo
        : null,
      fechaFinTramo: intersecaMes ? fechaFinTramo : null,
      intersecaMes,
      semanaCortada:
        intersecaMes &&
        (fechaInicioTramo.getTime() !==
          fechaInicioSemana.getTime() ||
          fechaFinTramo.getTime() !==
            fechaFinSemana.getTime()),
    };
  }

  private convertirFecha(valor: string): Date | null {
    const fechaBase = valor.slice(0, 10);
    const partes = fechaBase
      .split('-')
      .map((parte) => Number(parte));

    if (
      partes.length !== 3 ||
      partes.some((parte) => !Number.isInteger(parte))
    ) {
      return null;
    }

    const [anio, mes, dia] = partes;
    const fecha = new Date(anio, mes - 1, dia);

    if (
      fecha.getFullYear() !== anio ||
      fecha.getMonth() !== mes - 1 ||
      fecha.getDate() !== dia
    ) {
      return null;
    }

    return fecha;
  }

  private sumarDias(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setDate(resultado.getDate() + dias);
    return resultado;
  }
}