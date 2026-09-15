import { Component, computed, inject, signal } from '@angular/core';
import {
  BanciCargaValidacionError,
  BanciCargaValidacionResponse,
} from '../../core/models/banci-carga.models';
import { CargaValidacionError } from '../../core/models/carga.models';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { exportarValidacionExcel } from '../../core/utils/validacion-excel.utils';

type TipoArchivoBanci = 'libro' | 'carpetas' | 'delitos' | 'victimas';
type TipoResumen = 'carpetas' | 'delitos' | 'victimas';

interface ResumenBanci {
  descripcion: string;
  totalRegistros: number;
  esError: boolean;
  esAdvertencia: boolean;
}

@Component({
  selector: 'app-banci-carga',
  imports: [],
  templateUrl: './banci-carga.html',
  styleUrl: './banci-carga.css',
})
export class BanciCarga {
  private readonly banciCargaService = inject(BanciCargaService);

  archivoLibro: File | null = null;
  archivoCarpetas: File | null = null;
  archivoDelitos: File | null = null;
  archivoVictimas: File | null = null;

  cargando = signal(false);
  exportandoValidacion = signal(false);
  resultado = signal<BanciCargaValidacionResponse | null>(null);
  mensajeLocal = signal('');
  archivoArrastrado = signal<TipoArchivoBanci | null>(null);

  errores = computed(() => this.resultado()?.errores ?? []);
  advertencias = computed(() => this.resultado()?.advertencias ?? []);
  detallesValidacion = computed(() => [...this.errores(), ...this.advertencias()]);
  resultadoConErrores = computed(() => !!this.resultado() && !this.resultado()!.esValido);
  resultadoCorrecto = computed(() => {
    const resultado = this.resultado();
    return resultado?.esValido ? resultado : null;
  });

  resumenCarpetas = computed(() => this.construirResumen('carpetas'));
  resumenDelitos = computed(() => this.construirResumen('delitos'));
  resumenVictimas = computed(() => this.construirResumen('victimas'));

  seleccionarLibro(event: Event): void {
    this.archivoLibro = this.obtenerArchivo(event);
    this.archivoCarpetas = null;
    this.archivoDelitos = null;
    this.archivoVictimas = null;
    this.limpiarResultado();
  }

  seleccionarCarpetas(event: Event): void {
    this.archivoCarpetas = this.obtenerArchivo(event);
    this.archivoLibro = null;
    this.limpiarResultado();
  }

  seleccionarDelitos(event: Event): void {
    this.archivoDelitos = this.obtenerArchivo(event);
    this.archivoLibro = null;
    this.limpiarResultado();
  }

  seleccionarVictimas(event: Event): void {
    this.archivoVictimas = this.obtenerArchivo(event);
    this.archivoLibro = null;
    this.limpiarResultado();
  }

  arrastrarArchivo(event: DragEvent, tipo: TipoArchivoBanci): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';

    this.archivoArrastrado.set(tipo);
  }

  salirArrastreArchivo(event: DragEvent, tipo: TipoArchivoBanci): void {
    const tarjeta = event.currentTarget as HTMLElement | null;
    const destino = event.relatedTarget as Node | null;

    if (tarjeta && destino && tarjeta.contains(destino)) return;
    if (this.archivoArrastrado() === tipo) this.archivoArrastrado.set(null);
  }

  soltarArchivo(event: DragEvent, tipo: TipoArchivoBanci): void {
    event.preventDefault();
    event.stopPropagation();

    this.archivoArrastrado.set(null);

    const archivo = event.dataTransfer?.files.item(0) ?? null;

    if (!archivo) return;

    if (tipo === 'libro') {
      if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
        this.mensajeLocal.set('El archivo único BANCI debe estar en formato XLSX.');
        return;
      }

      this.archivoLibro = archivo;
      this.archivoCarpetas = null;
      this.archivoDelitos = null;
      this.archivoVictimas = null;
    } else {
      const extension = archivo.name.toLowerCase();

      if (!extension.endsWith('.xlsx') && !extension.endsWith('.csv')) {
        this.mensajeLocal.set('Los archivos BANCI deben estar en formato XLSX o CSV.');
        return;
      }

      this.archivoLibro = null;

      if (tipo === 'carpetas') this.archivoCarpetas = archivo;
      if (tipo === 'delitos') this.archivoDelitos = archivo;
      if (tipo === 'victimas') this.archivoVictimas = archivo;
    }

    this.limpiarResultado();
  }

  procesar(): void {
    this.mensajeLocal.set('');
    this.resultado.set(null);

    const peticion = this.archivoLibro
      ? this.banciCargaService.validarLibro(this.archivoLibro)
      : this.archivoCarpetas && this.archivoDelitos && this.archivoVictimas
        ? this.banciCargaService.validarArchivos(
            this.archivoCarpetas,
            this.archivoDelitos,
            this.archivoVictimas,
          )
        : null;

    if (!peticion) {
      this.mensajeLocal.set(
        'Selecciona un Excel con las hojas CI, Delitos y Victimas, o los tres archivos Carpetas, Delitos y Victimas.',
      );
      return;
    }

    this.cargando.set(true);

    peticion.subscribe({
      next: (response) => {
        this.resultado.set(response);
        this.cargando.set(false);
        this.enfocarResultado();
      },
      error: (error) => {
        const response = error?.error as BanciCargaValidacionResponse | undefined;

        if (response?.errores) {
          this.resultado.set(response);
          this.enfocarResultado();
        } else {
          this.mensajeLocal.set(
            error?.error?.mensaje || 'No fue posible procesar la carga BANCI.',
          );
        }

        this.cargando.set(false);
      },
    });
  }

  prepararNuevaValidacion(): void {
    this.resultado.set(null);
    this.mensajeLocal.set('');

    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  async descargarValidacion(): Promise<void> {
    if (this.detallesValidacion().length === 0 || this.exportandoValidacion()) return;

    this.exportandoValidacion.set(true);

    try {
      const resultado = this.resultado();
      const referencia = resultado?.codigoReferencia || 'sin_referencia';

      const exportado = await exportarValidacionExcel(
        this.errores().map((detalle) => this.convertirDetalle(detalle)),
        this.advertencias().map((detalle) => this.convertirDetalle(detalle)),
        `validacion_banci_${referencia}`,
      );

      if (!exportado) {
        void mostrarAdvertencia(
          'Sin resultados para descargar',
          'La validación no contiene errores ni advertencias.',
        );
      }
    } catch {
      void mostrarError(
        'No fue posible descargar la validación',
        'Intente nuevamente.',
      );
    } finally {
      this.exportandoValidacion.set(false);
    }
  }

  private construirResumen(tipo: TipoResumen): ResumenBanci[] {
    const resultado = this.resultado();

    if (!resultado) return [];

    const total =
      tipo === 'carpetas'
        ? resultado.totalCarpetas
        : tipo === 'delitos'
          ? resultado.totalDelitos
          : resultado.totalVictimas;

    const resumen: ResumenBanci[] = [
      {
        descripcion: `Total de registros en ${tipo}`,
        totalRegistros: total,
        esError: false,
        esAdvertencia: false,
      },
    ];

    const agrupados = new Map<string, ResumenBanci>();

    const agregar = (
      detalles: BanciCargaValidacionError[],
      esError: boolean,
    ): void => {
      for (const detalle of detalles) {
        if (this.normalizarArchivo(detalle.archivo) !== tipo) continue;

        const llave = `${esError ? 'ERROR' : 'ADVERTENCIA'}|${detalle.codigo}|${detalle.mensaje}`;
        const existente = agrupados.get(llave);

        if (existente) {
          existente.totalRegistros++;
          continue;
        }

        agrupados.set(llave, {
          descripcion: detalle.mensaje,
          totalRegistros: 1,
          esError,
          esAdvertencia: !esError,
        });
      }
    };

    agregar(resultado.errores, true);
    agregar(resultado.advertencias, false);

    resumen.push(...agrupados.values());

    return resumen;
  }

  private normalizarArchivo(archivo: string): TipoResumen | null {
    const valor = archivo.trim().toLowerCase();

    if (valor === 'carpeta' || valor === 'carpetas' || valor === 'ci') return 'carpetas';
    if (valor === 'delito' || valor === 'delitos') return 'delitos';
    if (valor === 'victima' || valor === 'victimas' || valor === 'víctima' || valor === 'víctimas') return 'victimas';

    return null;
  }

  private convertirDetalle(detalle: BanciCargaValidacionError): CargaValidacionError {
    return {
      archivo: detalle.archivo,
      fila: detalle.numeroFila,
      columna: detalle.campo ?? '',
      campo: detalle.campo ?? '',
      valor: detalle.valor,
      codigo: detalle.codigo,
      descripcionResumen: detalle.mensaje,
      mensaje: detalle.mensaje,
      totalRegistrosAfectados: 1,
    };
  }

  private limpiarResultado(): void {
    this.mensajeLocal.set('');
    this.resultado.set(null);
  }

  private enfocarResultado(): void {
    setTimeout(() => {
      document
        .getElementById('resultado-banci')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private obtenerArchivo(event: Event): File | null {
    return (event.target as HTMLInputElement).files?.item(0) ?? null;
  }
}