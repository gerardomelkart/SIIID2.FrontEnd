import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BanciCargaValidacionError,
  BanciCargaValidacionResponse,
} from '../../core/models/banci-carga.models';
import { CargaValidacionError } from '../../core/models/carga.models';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { exportarValidacionExcel } from '../../core/utils/validacion-excel.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { BanciResumenRegistro } from '../../core/models/banci-resumen.models';
import { BanciVistaPreviaComponent } from './banci-vista-previa';
import { FormsModule } from '@angular/forms';
import { BanciFormularioOpciones } from '../../core/models/banci-formulario.models';

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
  imports: [FormsModule, BanciVistaPreviaComponent],
  templateUrl: './banci-carga.html',
  styleUrl: './banci-carga.css',
})
export class BanciCarga implements OnInit {
  private readonly banciCargaService = inject(BanciCargaService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly esSuperUsuario = computed(() => this.session.usuario()?.rol === 'SUPER_USUARIO');

  opciones = signal<BanciFormularioOpciones | null>(null);
  cargandoOpciones = signal(false);
  descargandoPlantilla = signal(false);
  cargandoResumen = signal(false);
  resumenConfirmado = signal<BanciResumenRegistro[]>([]);
  errorResumen = signal('');
  aceptarAdvertencias = false;
  entidad: number | null = null;

  entidades = computed(
    () =>
      this.opciones()?.catalogos.filter(
        (c) => c.campo === 'id_ent_hchos' && Number(c.clave) >= 1 && Number(c.clave) <= 32,
      ) ?? [],
  );

  necesitaActualizar = signal(false);
  referenciaEnCurso = signal('');
  bloqueado = computed(() => this.cargando());
  pendiente = computed(() => this.resultado()?.estado === 'VALIDADO_PENDIENTE');
  rechazado = computed(() => this.resultado()?.estado === 'RECHAZADO_VALIDACION');

  ngOnInit(): void {
    this.cargarOpciones();
    try {
      const referencia = localStorage.getItem(this.claveRecuperacion());
      if (referencia) this.recuperarCarga(referencia);
    } catch {
      /* La recuperación manual funciona aunque el almacenamiento no esté disponible. */
    }
  }

  cargarOpciones(): void {
    if (this.cargandoOpciones()) return;

    this.cargandoOpciones.set(true);
    this.banciCargaService
      .obtenerFormularioOpciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opciones) => {
          this.opciones.set(opciones);

          if (!opciones.esSuperUsuario) {
            this.entidad = opciones.idEntidadFederativa;
          }

          this.cargandoOpciones.set(false);
        },
        error: (e) => {
          this.cargandoOpciones.set(false);
          this.mensajeLocal.set(
            e?.error?.mensaje ||
              'No fue posible obtener las entidades. Reintente cargar las opciones.',
          );
        },
      });
  }

  descargarPlantilla(): void {
    if (this.descargandoPlantilla()) return;

    this.descargandoPlantilla.set(true);

    this.banciCargaService
      .descargarPlantilla()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const archivo = response.body;

          if (!archivo) {
            this.mensajeLocal.set('La API no devolvió la plantilla BANCI.');
            this.descargandoPlantilla.set(false);
            return;
          }

          const url = URL.createObjectURL(archivo);
          const enlace = document.createElement('a');

          enlace.href = url;
          enlace.download = 'BANCI_carga_inicial_v2.xlsx';
          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();

          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.descargandoPlantilla.set(false);
        },
        error: (e) => {
          this.descargandoPlantilla.set(false);
          this.mensajeLocal.set(
            e?.error?.mensaje || 'No fue posible descargar la plantilla BANCI V2.',
          );
        },
      });
  }

  recuperarCarga(referencia: string): void {
    referencia = referencia.trim();
    this.aceptarAdvertencias = false;
    if (!referencia || referencia.length > 50 || this.cargando()) return;
    this.referenciaEnCurso.set(referencia);
    this.cargando.set(true);
    this.mensajeLocal.set('');
    this.banciCargaService
      .obtenerCarga(referencia)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (carga) => {
          this.resultado.set(carga);
          this.recordarReferencia(referencia);
          this.necesitaActualizar.set(false);
          this.cargando.set(false);
          this.limpiarArchivosSeleccionados();
          this.enfocarResultado();
        },
        error: (error) => {
          this.cargando.set(false);
          this.necesitaActualizar.set(error?.status !== 404);
          if (error?.status === 404) {
            try {
              localStorage.removeItem(this.claveRecuperacion());
            } catch {
              /* Sin almacenamiento local. */
            }
          }
          this.mensajeLocal.set(
            error?.error?.mensaje ||
              'No se pudo recuperar el estado. Intente recuperar el estado; no vuelva a subir los archivos.',
          );
        },
      });
  }

  confirmar(aceptar: boolean): void {
    const carga = this.resultado();
    if (
      !carga ||
      !this.pendiente() ||
      !carga.esValido ||
      this.bloqueado() ||
      this.necesitaActualizar()
    )
      return;

    if (aceptar && carga.vistaPrevia?.puedeAceptar === false) {
      this.mensajeLocal.set(
        carga.vistaPrevia.motivoBloqueo || 'No tiene permisos para integrar esta carga.',
      );
      return;
    }

    if (aceptar && !carga.vistaPrevia?.huella) {
      this.mensajeLocal.set('Actualice el estado y revise la vista previa antes de aceptar.');
      return;
    }

    if (aceptar && carga.advertencias.length > 0 && !this.aceptarAdvertencias) {
      this.mensajeLocal.set(
        'Debe revisar y aceptar explícitamente las advertencias antes de integrar la carga.',
      );
      return;
    }

    this.cargando.set(true);
    this.mensajeLocal.set('');
    this.recordarReferencia(carga.codigoReferencia);

    const peticion =
      aceptar && carga.advertencias.length > 0
        ? this.banciCargaService.confirmar(
            carga.codigoReferencia,
            true,
            carga.vistaPrevia?.huella,
            true,
          )
        : this.banciCargaService.confirmar(
            carga.codigoReferencia,
            aceptar,
            aceptar ? carga.vistaPrevia?.huella : undefined,
          );

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.resultado.set({
          ...respuesta,
          modalidadIngreso: carga.modalidadIngreso,
          fechaCarga: carga.fechaCarga,
          errores: carga.errores,
          advertencias: carga.advertencias,
        });
        this.aceptarAdvertencias = false;
        this.cargando.set(false);
        this.enfocarResultado();
      },
      error: (error) => {
        this.cargando.set(false);
        this.necesitaActualizar.set(true);
        this.mensajeLocal.set(
          (error?.error?.mensaje || 'No se recibió la confirmación de la operación.') +
            ' Pulse «Actualizar revisión» para conocer el resultado antes de decidir nuevamente.',
        );
      },
    });
  }

  descargarResumen(): void {
    const r = this.resultadoCorrecto();
    if (!r || this.cargandoResumen()) return;
    this.cargandoResumen.set(true);
    this.errorResumen.set('');
    this.banciCargaService.obtenerResumen(r.codigoReferencia).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async filas => {
        this.resumenConfirmado.set(filas);
        try {
          if (!filas.length) throw new Error('La API no devolvió registros definitivos para esta carga.');
          const ok = await exportarFilasExcel(filas.map(f => ({
            Entidad: f.entidad, NO_BANCI: f.noBanci, ID_CI: f.idCi, NTRA_CI: f.ntraCi,
            ID_DELITO: f.idDelito, ID_VICF: f.idVicf, FOLIO_RNPDNO: f.folioRnpdno ?? '',
            Resultado: f.resultado, FechaIntegracion: f.fechaIntegracion ?? '',
            Referencia: r.codigoReferencia
          })), `BANCI_integracion_${r.codigoReferencia}.xlsx`, 'Registros integrados');
          if (!ok) throw new Error('No fue posible exportar el resumen.');
        } catch(e) {
          this.errorResumen.set(e instanceof Error ? e.message : 'No fue posible exportar el resumen.');
        } finally { this.cargandoResumen.set(false); }
      },
      error: e => { this.cargandoResumen.set(false); this.errorResumen.set(e?.error?.mensaje ||
        'No se pudo recuperar el resumen confirmado. Reintente la descarga.'); }
    });
  }

  private claveRecuperacion(): string {
    return `siiid_banci_carga_${this.session.usuario()?.idUsuario ?? 'sin_sesion'}`;
  }

  private recordarReferencia(referencia: string): void {
    this.referenciaEnCurso.set(referencia);
    try {
      localStorage.setItem(this.claveRecuperacion(), referencia);
    } catch {
      /* Sólo se guarda la referencia. */
    }
  }

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
    return resultado?.esValido &&
      ['PROCESADO', 'PROCESADO_CON_ADVERTENCIAS'].includes(resultado.estado)
      ? resultado
      : null;
  });

  resumenCarpetas = computed(() => this.construirResumen('carpetas'));
  resumenDelitos = computed(() => this.construirResumen('delitos'));
  resumenVictimas = computed(() => this.construirResumen('victimas'));

  seleccionarLibro(event: Event): void {
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;
    this.archivoLibro = this.obtenerArchivo(event);
    this.archivoCarpetas = null;
    this.archivoDelitos = null;
    this.archivoVictimas = null;
    this.limpiarResultado();
  }

  seleccionarCarpetas(event: Event): void {
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;
    this.archivoCarpetas = this.obtenerArchivo(event);
    this.archivoLibro = null;
    this.limpiarResultado();
  }

  seleccionarDelitos(event: Event): void {
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;
    this.archivoDelitos = this.obtenerArchivo(event);
    this.archivoLibro = null;
    this.limpiarResultado();
  }

  seleccionarVictimas(event: Event): void {
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;
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
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;

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
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;

    this.mensajeLocal.set('');
    this.aceptarAdvertencias = false;

    if (this.session.usuario()?.rol === 'SUPER_USUARIO' && !this.entidad) {
      this.mensajeLocal.set('Seleccione la entidad federativa que reporta la información.');
      return;
    }

    const idEntidad = this.session.usuario()?.rol === 'SUPER_USUARIO' ? this.entidad : null;

    const peticion = this.archivoLibro
      ? idEntidad == null
        ? this.banciCargaService.validarLibro(this.archivoLibro)
        : this.banciCargaService.validarLibro(this.archivoLibro, idEntidad)
      : this.archivoCarpetas && this.archivoDelitos && this.archivoVictimas
        ? idEntidad == null
          ? this.banciCargaService.validarArchivos(
              this.archivoCarpetas,
              this.archivoDelitos,
              this.archivoVictimas,
            )
          : this.banciCargaService.validarArchivos(
              this.archivoCarpetas,
              this.archivoDelitos,
              this.archivoVictimas,
              idEntidad,
            )
        : null;

    if (!peticion) {
      this.mensajeLocal.set(
        'Seleccione un Excel con las hojas CI, Delitos y Victimas, o los tres archivos Carpetas, Delitos y Victimas.',
      );
      return;
    }

    this.resultado.set(null);
    this.cargando.set(true);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.resultado.set(response);
        this.cargando.set(false);

        if (response.estado === 'VALIDADO_PENDIENTE') {
          this.recordarReferencia(response.codigoReferencia);
          this.limpiarArchivosSeleccionados();
        }

        this.enfocarResultado();
      },
      error: (error) => {
        const response = error?.error as BanciCargaValidacionResponse | undefined;

        if (response?.errores) {
          this.resultado.set(response);
          this.enfocarResultado();
        } else {
          this.mensajeLocal.set(
            error?.error?.mensaje ||
              'No se recibió el resultado de la validación. Ninguna carga se integra sin su confirmación.',
          );
        }

        this.cargando.set(false);
      },
    });
  }

  prepararNuevaValidacion(): void {
    this.resumenConfirmado.set([]);
    this.errorResumen.set('');
    if (this.bloqueado() || this.pendiente() || this.necesitaActualizar()) return;
    this.aceptarAdvertencias = false;
    this.limpiarArchivosSeleccionados();
    this.resultado.set(null);
    this.mensajeLocal.set('');
    try {
      localStorage.removeItem(this.claveRecuperacion());
    } catch {
      /* Sin almacenamiento local. */
    }

    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  async descargarValidacion(): Promise<void> {
    if (this.detallesValidacion().length === 0 || this.exportandoValidacion()) return;

    this.exportandoValidacion.set(true);

    try {
      const resultado = this.resultado();

      const exportado = await exportarValidacionExcel(
        this.errores().map((detalle) => this.convertirDetalle(detalle)),
        this.advertencias().map((detalle) => this.convertirDetalle(detalle)),
        `validacion_banci_${new Date().toISOString().slice(0, 10)}`,
      );

      if (!exportado) {
        void mostrarAdvertencia(
          'Sin resultados para descargar',
          'La validación no contiene errores ni advertencias.',
        );
      }
    } catch {
      void mostrarError('No fue posible descargar la validación', 'Intente nuevamente.');
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

    const agregar = (detalles: BanciCargaValidacionError[], esError: boolean): void => {
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
    if (valor === 'victima' || valor === 'victimas' || valor === 'víctima' || valor === 'víctimas')
      return 'victimas';

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

  private limpiarArchivosSeleccionados(): void {
    this.archivoLibro = null;
    this.archivoCarpetas = null;
    this.archivoDelitos = null;
    this.archivoVictimas = null;
    this.archivoArrastrado.set(null);

    document
      .querySelectorAll<HTMLInputElement>('.carga-banci input[type="file"]')
      .forEach((input) => (input.value = ''));
  }

  private limpiarResultado(): void {
    this.aceptarAdvertencias = false;
    this.mensajeLocal.set('');
    this.resultado.set(null);
  }

  irADecision(): void {
    const destino = document.getElementById('decision-banci');
    destino?.focus({ preventScroll: true });
    destino?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  verAdvertencias(): void {
    document
      .getElementById('resultado-banci')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private enfocarResultado(): void {
    setTimeout(() => {
      document
        .getElementById(this.pendiente() ? 'decision-banci' : 'resultado-banci')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private obtenerArchivo(event: Event): File | null {
    return (event.target as HTMLInputElement).files?.item(0) ?? null;
  }
}
