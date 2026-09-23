import { ActivatedRoute, Router } from '@angular/router';
import { fechaBanci, nombreExcelBanci } from '../../core/utils/banci-archivos.utils';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BanciActualizacionService } from '../../core/services/banci-actualizacion.service';
import { SessionService } from '../../core/services/session.service';
import {
  BanciActualizacionBusquedaResponse,
  BanciActualizacionConfirmacionResponse,
  BanciActualizacionEstado,
  BanciActualizacionOpciones,
  BanciActualizacionResultado,
  BanciActualizacionVictima
} from '../../core/models/banci-actualizacion.models';

interface CampoActualizacion {
  clave: string;
  etiqueta: string;
  tipo: 'text' | 'date' | 'textarea' | 'select';
  maximo?: number;
  ayuda?: string;
}

@Component({
  selector: 'app-banci-actualizacion',
  imports: [FormsModule],
  templateUrl: './banci-actualizacion.html',
  styleUrls: ['./banci-actualizacion.css', '../banci-plantillas.css']
})
export class BanciActualizacion implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(BanciActualizacionService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly campos: CampoActualizacion[] = [
    { clave: 'folio_rnpdno', etiqueta: 'Folio RNPDNO', tipo: 'text', maximo: 250 },
    { clave: 'pro_apellido', etiqueta: 'Primer apellido', tipo: 'text', maximo: 250 },
    { clave: 'sdo_apellido', etiqueta: 'Segundo apellido', tipo: 'text', maximo: 250 },
    { clave: 'nomb', etiqueta: 'Nombre(s)', tipo: 'text', maximo: 500 },
    { clave: 'entidad_nacimiento', etiqueta: 'Entidad de nacimiento', tipo: 'text', maximo: 250 },
    { clave: 'estado_migratorio', etiqueta: 'Estado migratorio', tipo: 'text', maximo: 500 },
    { clave: 'curp', etiqueta: 'CURP', tipo: 'text', maximo: 18, ayuda: 'Si informa una CURP nueva, se validará con RENAPO.' },
    { clave: 'rfc', etiqueta: 'RFC', tipo: 'text', maximo: 13 },
    { clave: 'localizado_o_no_localizado', etiqueta: 'Estado de localización', tipo: 'select' },
    { clave: 'con_o_sin_vida', etiqueta: 'Condición de vida', tipo: 'select' },
    { clave: 'fecha_localizacion', etiqueta: 'Fecha de localización', tipo: 'date' },
    { clave: 'voluntaria_o_fue_delito', etiqueta: 'Motivo de localización', tipo: 'select' },
    { clave: 'delito', etiqueta: 'Delito relacionado con la localización', tipo: 'select', ayuda: 'Opcional e independiente de los demás campos. Puede ser diferente del delito de la carpeta.' },
    { clave: 'acciones_busqueda', etiqueta: 'Acciones emprendidas para su búsqueda', tipo: 'textarea', maximo: 20000 },
    { clave: 'obs', etiqueta: 'Observaciones', tipo: 'textarea', maximo: 20000 }
  ];

  opciones = signal<BanciActualizacionOpciones | null>(null);
  cargandoOpciones = signal(false);
  cargandoBusqueda = signal(false);
  cargandoOperacion = signal(false);
  descargandoPlantilla = signal(false);

  mensaje = signal('');
  resultado = signal<BanciActualizacionResultado | null>(null);
  confirmacion = signal<BanciActualizacionConfirmacionResponse | null>(null);
  busqueda = signal<BanciActualizacionBusquedaResponse | null>(null);
  seleccionada = signal<BanciActualizacionVictima | null>(null);
  pendientes = signal<BanciActualizacionEstado[]>([]);
  necesitaActualizar = signal(false);

  referencia = signal('');
  entidad: number | null = null;
  textoBusqueda = '';
  pagina = 1;
  archivo: File | null = null;
  edicion: Record<string, string> = {};
  aceptarAdvertencias = false;
  modalidad = signal<'manual' | 'masiva'>('manual');
  pestanaManual = signal<'localizacion' | 'personales'>('localizacion');
  archivoArrastrado = signal(false);
  mostrarResumen = signal(false);
  cambiosConfirmados: BanciActualizacionResultado['cambios'] = [];
  private referenciaConfirmada = '';

  readonly camposLocalizacion = this.campos.filter(c =>
    ['localizado_o_no_localizado','con_o_sin_vida','fecha_localizacion','voluntaria_o_fue_delito',
     'delito','acciones_busqueda','obs'].includes(c.clave));
  readonly camposPersonales = this.campos.filter(c => !this.camposLocalizacion.includes(c));

  readonly esSuperUsuario = computed(() => this.opciones()?.esSuperUsuario === true);
  readonly pendiente = computed(() => this.resultado()?.estado === 'PENDIENTE' && !!this.referencia());
  readonly ocupado = computed(() => this.cargandoBusqueda() || this.cargandoOperacion() || this.descargandoPlantilla());
  readonly entidades = computed(() => this.opciones()?.catalogos.filter(c => c.campo === 'id_ent_hchos' && Number(c.clave) >= 1 && Number(c.clave) <= 32) ?? []);

  ngOnInit(): void {
    this.modalidad.set(this.route.snapshot.data['modalidad'] === 'masiva' ? 'masiva' : 'manual');
    this.cargarOpciones();
    this.cargarPendientes();

    try {
      const referencia = localStorage.getItem(this.claveReferencia());
      if (referencia) this.recuperar(referencia);
    } catch {
      /* La pantalla funciona sin almacenamiento local. */
    }
  }

  cargarOpciones(): void {
    if (this.cargandoOpciones()) return;
    this.cargandoOpciones.set(true);

    this.service.obtenerOpciones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: opciones => {
        this.opciones.set(opciones);
        if (!opciones.esSuperUsuario) this.entidad = opciones.idEntidadFederativa;
        this.cargandoOpciones.set(false);
      },
      error: e => {
        this.cargandoOpciones.set(false);
        this.mensaje.set(e?.error?.mensaje || 'No fue posible cargar los catálogos de actualización BANCI.');
      }
    });
  }

  opcionesCampo(campo: string) {
    return this.opciones()?.catalogos.filter(o => o.campo === campo) ?? [];
  }

  nombre(victima: BanciActualizacionVictima): string {
    return [victima.nomb, victima.pro_apellido, victima.sdo_apellido].filter(Boolean).join(' ') || 'Sin nombre registrado';
  }

  cambiarEntidad(entidad: number | null): void {
    if (this.ocupado() || this.pendiente()) return;
    this.entidad = entidad;
    this.busqueda.set(null);
    this.seleccionada.set(null);
    this.edicion = {};
    this.archivo = null;
    this.mensaje.set('');
  }

  buscar(pagina = 1): void {
    if (this.ocupado() || this.pendiente() || this.necesitaActualizar()) return;

    const texto = this.textoBusqueda.trim();

    if (texto.length < 3) {
      this.mensaje.set('Escriba al menos tres caracteres para buscar una víctima.');
      return;
    }

    if (this.esSuperUsuario() && !this.entidad) {
      this.mensaje.set('Seleccione la entidad federativa antes de buscar.');
      return;
    }

    this.mensaje.set('');
    this.busqueda.set(null);
    this.seleccionada.set(null);
    this.edicion = {};
    this.pagina = pagina;
    this.cargandoBusqueda.set(true);

    this.service.buscarVictimas(texto, this.esSuperUsuario() ? this.entidad : null, pagina, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: respuesta => {
          this.busqueda.set(respuesta);
          this.cargandoBusqueda.set(false);
        },
        error: e => {
          this.cargandoBusqueda.set(false);
          this.mensaje.set(e?.error?.mensaje || 'No fue posible buscar víctimas BANCI.');
        }
      });
  }

  seleccionar(victima: BanciActualizacionVictima): void {
    if (this.ocupado() || this.pendiente() || this.necesitaActualizar()) return;
    this.seleccionada.set(victima);
    this.edicion = {};
    this.pestanaManual.set('localizacion');
    this.archivo = null;
    this.resultado.set(null);
    this.confirmacion.set(null);
    this.aceptarAdvertencias = false;
    this.mensaje.set('');
  }

  actual(campo: string): string {
    const victima = this.seleccionada();
    if (!victima) return '—';

    const valor = (victima as unknown as Record<string, unknown>)[campo];
    if (valor == null || valor === '') return '—';

    if (['localizado_o_no_localizado', 'con_o_sin_vida', 'voluntaria_o_fue_delito'].includes(campo)) {
      const opcion = this.opcionesCampo(campo).find(o => o.clave === String(valor));
      if (opcion) return opcion.descripcion;
    }

    return String(valor);
  }

  validarFormulario(): void {
    const victima = this.seleccionada();
    if (!victima || this.ocupado() || this.resultado() || this.necesitaActualizar()) return;

    const cambios = Object.fromEntries(
      Object.entries(this.edicion)
        .map(([campo, valor]) => [campo, valor.trim()])
        .filter(([, valor]) => !!valor)
    );

    if (!Object.keys(cambios).length) {
      this.mensaje.set('Indique al menos un campo que desee actualizar.');
      return;
    }

    const datos: Record<string, string | null> = {
      no_banci: victima.no_banci,
      id_delito: victima.id_delito,
      id_vicf: victima.id_vicf,
      ...cambios
    };

    this.validar(this.service.validarFormulario({
      idEntidadFederativa: this.esSuperUsuario() ? this.entidad : null,
      datos
    }));
  }

  puedeSalir(): boolean {
    if (!this.cargandoOperacion()) return true;
    this.mensaje.set('Espere el resultado de la operación antes de cambiar de vista.');
    return false;
  }

  fechaHoy(): string { return fechaBanci(); }

  fechaMinima(): string | null {
    const victima = this.seleccionada();
    return [victima?.fha_de_ini, victima?.fha_de_hchos].filter((fecha): fecha is string => !!fecha).map(fecha => fecha.slice(0, 10)).sort().at(-1) ?? null;
  }

  capturarTexto(campo: string, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    if (campo === 'curp' || campo === 'rfc') input.value = input.value.toUpperCase();
    this.edicion[campo] = input.value;
  }

  private enfocarResultado(): void {
    setTimeout(() => {
      if (this.destroyRef.destroyed) return;
      const resultado = document.getElementById('resultado-actualizacion');
      resultado?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultado?.focus({ preventScroll: true });
    }, 60);
  }

  arrastrarArchivo(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.ocupado() && !this.pendiente() && !this.necesitaActualizar()) this.archivoArrastrado.set(true);
  }

  salirArrastreArchivo(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.archivoArrastrado.set(false);
  }

  soltarArchivo(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.archivoArrastrado.set(false);
    if (this.ocupado() || this.pendiente() || this.necesitaActualizar()) return;
    this.asignarArchivo(event.dataTransfer?.files.item(0) ?? null);
  }

  private asignarArchivo(archivo: File | null): void {
    if (archivo && !archivo.name.toLowerCase().endsWith('.xlsx')) {
      this.archivo = null;
      this.mensaje.set('Seleccione un archivo Excel .xlsx.');
      return;
    }
    if (archivo && archivo.size > 20 * 1024 * 1024) {
      this.archivo = null;
      this.mensaje.set('El archivo supera 20 MB. Reduzca su tamaño antes de validar.');
      return;
    }
    this.archivo = archivo;
    this.mensaje.set('');
  }

  seleccionarArchivo(event: Event): void {
    if (this.ocupado() || this.pendiente() || this.necesitaActualizar()) return;

    this.asignarArchivo((event.target as HTMLInputElement).files?.item(0) ?? null);
  }

  validarExcel(): void {
    if (!this.archivo || this.ocupado() || this.resultado() || this.necesitaActualizar()) return;

    if (this.esSuperUsuario() && !this.entidad) {
      this.mensaje.set('Seleccione la entidad federativa del archivo.');
      return;
    }

    this.validar(this.service.validarArchivo(this.archivo, this.esSuperUsuario() ? this.entidad : null));
  }

  private validar(peticion: ReturnType<BanciActualizacionService['validarFormulario']>): void {
    this.resultado.set(null);
    this.confirmacion.set(null);
    this.aceptarAdvertencias = false;
    this.necesitaActualizar.set(false);
    this.mensaje.set('');
    this.cargandoOperacion.set(true);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => this.recibirValidacion(respuesta),
      error: e => {
        this.cargandoOperacion.set(false);
        if (Array.isArray(e?.error?.errores)) this.resultado.set(e.error as BanciActualizacionResultado);
        else if (e?.status === 400) this.resultado.set(this.resultadoConError(e?.error?.mensaje || 'Revise el archivo y los datos de actualización.'));
        else this.mensaje.set(e?.error?.mensaje || 'No fue posible validar la actualización.');
        this.enfocarResultado();
      }
    });
  }

  private recibirValidacion(respuesta: BanciActualizacionResultado): void {
    this.resultado.set(respuesta);
    this.cargandoOperacion.set(false);
    this.enfocarResultado();

    if (respuesta.estado === 'PENDIENTE' && respuesta.codigoReferencia) {
      this.referencia.set(respuesta.codigoReferencia);
      this.guardarReferencia(respuesta.codigoReferencia);
      this.cargarPendientes();
    }
  }

  recuperar(referencia: string): void {
    if (!referencia || this.cargandoOperacion()) return;
    if (this.necesitaActualizar() && this.referencia() && referencia !== this.referencia()) return;
    this.referencia.set(referencia);
    this.guardarReferencia(referencia);

    this.cargandoOperacion.set(true);
    this.necesitaActualizar.set(false);
    this.aceptarAdvertencias = false;
    this.mensaje.set('');

    this.service.obtenerEstado(referencia).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: estados => {
        const estado = estados[0];

        if (!estado) {
          this.cargandoOperacion.set(false);
          this.mensaje.set('No se encontró la operación de actualización. Revise las operaciones pendientes.');
          this.olvidarReferencia();
          this.resultado.set(null);
          return;
        }

        const modalidad = estado.origen === 'EXCEL' ? 'masiva' : 'manual';
        if (modalidad !== this.modalidad()) {
          this.cargandoOperacion.set(false);
          this.necesitaActualizar.set(true);
          this.mensaje.set('Esta operación corresponde a la otra modalidad de actualización. Se abrirá su vista para revisarla.');
          void this.router.navigateByUrl(`/banci/actualizacion/${modalidad}`);
          return;
        }
        this.entidad = estado.idEntidadFederativa;

        if (estado.estado !== 'PENDIENTE') {
          this.cargandoOperacion.set(false);
          this.resultado.set(null);
          this.confirmacion.set({
            codigoReferencia: estado.codigoReferencia,
            estado: estado.estado,
            yaResuelta: true,
            totalCambios: estado.totalCambios
          });
          this.olvidarReferencia();
          this.cargarPendientes();
          return;
        }

        this.service.obtenerVistaPrevia(referencia).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: resultado => {
            this.resultado.set(resultado);
            this.confirmacion.set(null);
            this.referencia.set(referencia);
            this.guardarReferencia(referencia);
            this.cargandoOperacion.set(false);
            this.cargarPendientes();
            this.enfocarResultado();
          },
          error: e => {
            this.cargandoOperacion.set(false);
            if (e?.status === 400) {
              this.resultado.set({ ...this.resultadoConError(e?.error?.mensaje || 'La revisión dejó de ser válida. Regrese y corrija los datos.'), codigoReferencia: referencia, estado: 'PENDIENTE' });
              this.necesitaActualizar.set(false);
              this.enfocarResultado();
              return;
            }
            this.necesitaActualizar.set(true);
            this.mensaje.set(e?.error?.mensaje || 'No fue posible recuperar la vista previa. Reintente antes de decidir.');
          }
        });
      },
      error: e => {
        this.cargandoOperacion.set(false);
        this.necesitaActualizar.set(true);
        this.mensaje.set(e?.error?.mensaje || 'No fue posible recuperar el estado. Reintente antes de decidir.');
      }
    });
  }

  cargarPendientes(): void {
    this.service.obtenerPendientes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: pendientes => this.pendientes.set(pendientes),
      error: () => {
        /* Una falla al listar pendientes no debe borrar una referencia recuperable. */
      }
    });
  }

  private resultadoConError(mensaje: string): BanciActualizacionResultado {
    return { esValido: false, codigoReferencia: null, estado: 'NO_VALIDADA', huella: null, cambios: [], datosPropuestos: [], errores: [{ archivo: 'actualizacion', hoja: null, valor: null, numeroFila: null, campo: null, codigo: 'BANCI_ACTUALIZACION_INVALIDA', mensaje }], advertencias: [] };
  }

  regresarAEdicion(aviso?: BanciActualizacionResultado['advertencias'][number]): void {
    const resultado = this.resultado();
    if (!resultado || this.ocupado() || this.necesitaActualizar()) return;
    aviso ??= resultado.errores.find(a => !!a.campo) ?? resultado.advertencias.find(a => !!a.campo);
    if (!this.pendiente()) { this.abrirEdicion(aviso); return; }
    this.cargandoOperacion.set(true);
    this.mensaje.set('');
    this.service.confirmar(this.referencia(), { aceptar: false, huellaVistaPrevia: null, aceptarAdvertencias: false }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => {
        this.cargandoOperacion.set(false);
        if (respuesta.estado !== 'RECHAZADA') {
          this.necesitaActualizar.set(true);
          this.mensaje.set('No se confirmó el rechazo. Recupere el estado antes de editar.');
          return;
        }
        this.abrirEdicion(aviso);
      },
      error: e => {
        this.cargandoOperacion.set(false);
        this.necesitaActualizar.set(true);
        this.aceptarAdvertencias = false;
        this.mensaje.set((e?.error?.mensaje || 'No se confirmó el rechazo de la actualización.') + ' Recupere el estado antes de volver a editar.');
      }
    });
  }

  private abrirEdicion(aviso?: BanciActualizacionResultado['advertencias'][number]): void {
    this.resultado.set(null);
    this.confirmacion.set(null);
    this.aceptarAdvertencias = false;
    this.necesitaActualizar.set(false);
    this.olvidarReferencia();
    this.cargarPendientes();
    let destino = 'archivo-actualizacion';
    if (this.modalidad() === 'masiva') {
      this.archivo = null;
      const detalle = [aviso?.numeroFila ? `fila ${aviso.numeroFila}` : '', aviso?.campo ? `campo ${aviso.campo}` : ''].filter(Boolean).join(', ');
      this.mensaje.set(`Corrija el Excel${detalle ? ' en ' + detalle : ''} y seleccione el archivo corregido antes de validar.`);
    } else {
      const campo = this.campos.find(c => c.clave === aviso?.campo);
      if (campo) this.pestanaManual.set(this.camposLocalizacion.includes(campo) ? 'localizacion' : 'personales');
      destino = campo ? `actualizar-${campo.clave}` : 'busqueda-actualizacion';
      this.mensaje.set(this.seleccionada() ? 'Corrija la información y vuelva a validar. Sus datos capturados se conservaron.' : 'Busque nuevamente la víctima para corregir la información.');
    }
    setTimeout(() => {
      if (this.destroyRef.destroyed) return;
      const elemento = document.getElementById(destino);
      elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elemento?.focus({ preventScroll: true });
    }, 60);
  }

  confirmar(aceptar: boolean): void {
    const resultado = this.resultado();
    const referencia = this.referencia();

    if (!resultado || !referencia || !this.pendiente() || this.ocupado() || this.necesitaActualizar()) return;

    if (aceptar && !resultado.huella) {
      this.mensaje.set('Recupere y revise la vista previa antes de aceptar.');
      return;
    }

    if (aceptar && resultado.advertencias.length > 0 && !this.aceptarAdvertencias) {
      this.mensaje.set('Debe aceptar expresamente las advertencias para continuar.');
      return;
    }

    this.cargandoOperacion.set(true);
    this.mensaje.set('');

    this.service.confirmar(referencia, {
      aceptar,
      huellaVistaPrevia: aceptar ? resultado.huella : null,
      aceptarAdvertencias: aceptar && resultado.advertencias.length > 0 && this.aceptarAdvertencias
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => {
        if (aceptar && ['INTEGRADA'].includes(respuesta.estado)) {
          this.cambiosConfirmados = resultado.cambios;
          this.referenciaConfirmada = referencia;
          this.mostrarResumen.set(true);
        } else {
          this.cambiosConfirmados = [];
          this.referenciaConfirmada = '';
        }
        this.confirmacion.set(respuesta);
        this.resultado.set(null);
        this.cargandoOperacion.set(false);
        this.aceptarAdvertencias = false;
        this.olvidarReferencia();
        this.cargarPendientes();
      },
      error: e => {
        this.cargandoOperacion.set(false);
        this.necesitaActualizar.set(true);
        this.aceptarAdvertencias = false;
        this.mensaje.set((e?.error?.mensaje || 'No se recibió la confirmación.') + ' Recupere el estado antes de volver a decidir; no repita la operación.');
      }
    });
  }

  descargarPlantilla(): void {
    if (this.descargandoPlantilla()) return;

    this.descargandoPlantilla.set(true);

    this.service.descargarPlantilla().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => {
        if (!respuesta.body) {
          this.descargandoPlantilla.set(false);
          this.mensaje.set('La API no devolvió la plantilla.');
          return;
        }

        const url = URL.createObjectURL(respuesta.body);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = 'BANCI_actualizacion_victimas_v2.xlsx';
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.descargandoPlantilla.set(false);
      },
      error: e => {
        this.descargandoPlantilla.set(false);
        this.mensaje.set(e?.error?.mensaje || 'No fue posible descargar la plantilla de actualización.');
      }
    });
  }

  async descargarResumenActualizacion(): Promise<void> {
    if (!this.confirmacion() || !this.cambiosConfirmados.length || !this.referenciaConfirmada) return;
    const { exportarFilasExcel } = await import('../../core/utils/excel-export.utils');
    const filas = this.cambiosConfirmados.map(c => ({
      Referencia: this.referenciaConfirmada, NO_BANCI: c.no_banci, ID_CI: c.id_ci,
      ID_DELITO: c.id_delito, ID_VICF: c.id_vicf,
      Campo: c.campo, Anterior: c.anterior ?? '', Nuevo: c.nuevo ?? ''
    }));
    const noBanci = this.modalidad() === 'manual' ? this.cambiosConfirmados[0]?.no_banci : null;
    const entidad = this.entidades().find(e => Number(e.clave) === this.entidad)?.descripcion ?? `ENTIDAD_${this.entidad ?? ''}`;
    await exportarFilasExcel(filas, nombreExcelBanci('actualizacion', entidad, noBanci), 'Cambios');
  }

  nuevaOperacion(): void {
    if (this.ocupado() || this.pendiente() || this.necesitaActualizar()) return;

    this.resultado.set(null);
    this.confirmacion.set(null);
    this.mostrarResumen.set(false);
    this.cambiosConfirmados = [];
    this.referenciaConfirmada = '';
    this.pestanaManual.set('localizacion');
    this.seleccionada.set(null);
    this.busqueda.set(null);
    this.textoBusqueda = '';
    this.edicion = {};
    this.archivo = null;
    this.aceptarAdvertencias = false;
    this.mensaje.set('');
    this.olvidarReferencia();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private claveReferencia(): string {
    return `siiid_banci_actualizacion_${this.session.usuario()?.idUsuario ?? 'sin_sesion'}`;
  }

  private guardarReferencia(referencia: string): void {
    try { localStorage.setItem(this.claveReferencia(), referencia); } catch { /* Sin almacenamiento local. */ }
  }

  private olvidarReferencia(): void {
    this.referencia.set('');
    try { localStorage.removeItem(this.claveReferencia()); } catch { /* Sin almacenamiento local. */ }
  }
}
