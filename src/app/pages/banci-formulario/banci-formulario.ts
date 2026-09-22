import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { BanciCargaValidacionResponse, BanciCargaValidacionError } from '../../core/models/banci-carga.models';
import {
  BanciFormularioDelito,
  BanciFormularioOpciones,
} from '../../core/models/banci-formulario.models';
import { BanciCampos } from './banci-campos';
import { CAMPOS_CARPETAS, CAMPOS_DELITOS, CAMPOS_VICTIMAS } from './banci-formulario-campos';
import { BanciVistaPreviaComponent } from '../banci-carga/banci-vista-previa';
import { BanciResumenRegistro } from '../../core/models/banci-resumen.models';

@Component({
  selector: 'app-banci-formulario',
  imports: [FormsModule, RouterLink, BanciCampos, BanciVistaPreviaComponent],
  templateUrl: './banci-formulario.html',
  styleUrl: './banci-formulario.css',
})
export class BanciFormulario implements OnInit {
  private readonly service = inject(BanciCargaService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly camposCarpeta = CAMPOS_CARPETAS;
  readonly camposDelito = CAMPOS_DELITOS;
  readonly camposVictima = CAMPOS_VICTIMAS;
  opciones = signal<BanciFormularioOpciones | null>(null);
  resultado = signal<BanciCargaValidacionResponse | null>(null);
  cargando = signal(false);
  cargandoOpciones = signal(false);
  mensaje = signal('');
  errorOpciones = signal('');
  necesitaActualizar = signal(false);
  referencia = signal('');
  aceptarAdvertencias = false;
  cargandoResumen = signal(false);
  resumenConfirmado = signal<BanciResumenRegistro[]>([]);
  mostrarAcuse = signal(false);
  errorAcuse = signal('');
  pendiente = computed(() => this.resultado()?.estado === 'VALIDADO_PENDIENTE');
  terminado = computed(() =>
    ['PROCESADO', 'PROCESADO_CON_ADVERTENCIAS'].includes(this.resultado()?.estado ?? ''),
  );
  bloqueado = computed(
    () =>
      this.cargando() ||
      this.pendiente() ||
      this.necesitaActualizar() ||
      this.terminado() ||
      this.resultado()?.estado === 'RECHAZADO_VALIDACION',
  );
  entidades = computed(
    () =>
      this.opciones()?.catalogos.filter(
        (c) => c.campo === 'id_ent_hchos' && Number(c.clave) >= 1 && Number(c.clave) <= 32,
      ) ?? [],
  );
  entidad: number | null = null;
  carpeta: Record<string, string> = {};
  delitos: BanciFormularioDelito[] = [{ datos: {}, victimas: [{}] }];

  ngOnInit(): void {
    this.cargarOpciones();
    try {
      this.referencia.set(localStorage.getItem(this.claveReferencia()) || '');
    } catch {
      /* Sólo se conserva la referencia, no los datos personales. */
    }
    if (this.referencia()) this.actualizarEstado();
  }

  cargarOpciones(): void {
    if (this.cargandoOpciones()) return;
    this.cargandoOpciones.set(true);
    this.errorOpciones.set('');
    this.service
      .obtenerFormularioOpciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opciones) => {
          this.opciones.set(opciones);
          this.entidad = opciones.esSuperUsuario ? null : opciones.idEntidadFederativa;
          for (const delito of this.delitos) this.preseleccionarEntidad(delito);
          this.cargandoOpciones.set(false);
        },
        error: (e) => {
          this.cargandoOpciones.set(false);
          this.errorOpciones.set(
            e?.error?.mensaje || 'No fue posible cargar las opciones del formulario.',
          );
        },
      });
  }

  private preseleccionarEntidad(delito: BanciFormularioDelito): void {
    const opciones = this.opciones();
    if (
      !opciones ||
      opciones.esSuperUsuario ||
      !opciones.idEntidadFederativa ||
      delito.datos['id_ent_hchos']
    )
      return;
    const entidad = opciones.catalogos.find(
      (c) => c.campo === 'id_ent_hchos' && Number(c.clave) === opciones.idEntidadFederativa,
    );
    if (entidad) {
      delito.datos['id_ent_hchos'] = entidad.clave;
      delito.datos['nom_ent_hchos'] = entidad.descripcion;
    }
  }
  agregarDelito(): void {
    if (!this.bloqueado() && this.delitos.length < 100) {
      const delito = { datos: {}, victimas: [{}] };
      this.preseleccionarEntidad(delito);
      this.delitos.push(delito);
    }
  }
  quitarDelito(indice: number): void {
    if (!this.bloqueado() && this.delitos.length > 1) this.delitos.splice(indice, 1);
  }
  agregarVictima(delito: BanciFormularioDelito): void {
    if (!this.bloqueado() && delito.victimas.length < 500 && this.totalVictimas() < 1000)
      delito.victimas.push({});
  }
  quitarVictima(delito: BanciFormularioDelito, indice: number): void {
    if (!this.bloqueado() && delito.victimas.length > 1) delito.victimas.splice(indice, 1);
  }
  totalVictimas(): number {
    return this.delitos.reduce((total, delito) => total + delito.victimas.length, 0);
  }

  validar(): void {
    if (this.bloqueado() || !this.opciones()) return;
    this.mensaje.set('');
    this.aceptarAdvertencias = false;
    if (this.opciones()!.esSuperUsuario && !this.entidad) {
      this.mensaje.set('Seleccione la entidad que reporta la carpeta.');
      return;
    }
    this.resultado.set(null);
    this.cargando.set(true);
    const request = {
      idEntidadFederativa: this.opciones()!.esSuperUsuario ? this.entidad : null,
      carpeta: this.carpeta,
      delitos: this.delitos,
    };
    this.service
      .validarFormulario(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.recibir(respuesta);
          this.enfocarResultado();
        },
        error: (e) => {
          this.cargando.set(false);
          if (Array.isArray(e?.error?.errores)) this.resultado.set(e.error);
          else
            this.mensaje.set(
              e?.error?.mensaje ||
                'No se recibió el resultado. Puede volver a validar; nada se integra sin su aceptación.',
            );
          this.enfocarResultado();
        },
      });
  }

  confirmar(aceptar: boolean): void {
    const carga = this.resultado();
    if (!carga || !this.pendiente() || this.cargando() || this.necesitaActualizar()) return;

    if (aceptar && carga.vistaPrevia?.puedeAceptar === false) {
      this.mensaje.set(
        carga.vistaPrevia.motivoBloqueo || 'No tiene permisos para integrar esta carga.',
      );
      return;
    }

    if (aceptar && !carga.vistaPrevia?.huella) {
      this.mensaje.set('Actualice el estado y revise la vista previa antes de aceptar.');
      return;
    }

    if (aceptar && carga.advertencias.length > 0 && !this.aceptarAdvertencias) {
      this.mensaje.set(
        'Debe revisar y aceptar explícitamente las advertencias antes de registrar la carpeta.',
      );
      return;
    }

    this.cargando.set(true);
    this.mensaje.set('');

    const peticion =
      aceptar && carga.advertencias.length > 0
        ? this.service.confirmar(carga.codigoReferencia, true, carga.vistaPrevia?.huella, true)
        : this.service.confirmar(
            carga.codigoReferencia,
            aceptar,
            aceptar ? carga.vistaPrevia?.huella : undefined,
          );

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.recibir({
          ...respuesta,
          modalidadIngreso: 'FORMULARIO',
          errores: carga.errores,
          advertencias: carga.advertencias,
        });
        this.enfocarResultado();
        if (aceptar && this.terminado()) this.abrirAcuse();
      },
      error: (e) => {
        this.cargando.set(false);
        this.necesitaActualizar.set(e?.error?.codigo !== 'BANCI_52424');
        this.mensaje.set(
          e?.error?.mensaje ||
            'No se recibió la confirmación. Actualice el estado antes de volver a decidir.',
        );
      },
    });
  }

  actualizarEstado(): void {
    if (!this.referencia() || this.cargando()) return;
    this.cargando.set(true);
    this.aceptarAdvertencias = false;
    this.necesitaActualizar.set(true);
    this.mensaje.set('');
    this.service
      .obtenerCarga(this.referencia())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.recibir(respuesta);
          this.necesitaActualizar.set(false);
        },
        error: (e) => {
          this.cargando.set(false);
          if (e?.status === 404) {
            this.olvidarReferencia();
            this.resultado.set(null);
            this.necesitaActualizar.set(false);
          }
          this.mensaje.set(
            e?.error?.mensaje ||
              'No fue posible recuperar la captura. Reintente actualizar el estado.',
          );
        },
      });
  }

  nuevaCaptura(): void {
    this.mostrarAcuse.set(false);
    this.resumenConfirmado.set([]);
    if (this.cargando() || this.pendiente() || this.necesitaActualizar()) return;
    this.aceptarAdvertencias = false;
    this.carpeta = {};
    this.delitos = [{ datos: {}, victimas: [{}] }];
    this.preseleccionarEntidad(this.delitos[0]);
    this.resultado.set(null);
    this.mensaje.set('');
    this.olvidarReferencia();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  corregirCaptura(): void {
    if (this.cargando() || this.pendiente() || this.necesitaActualizar() || this.terminado())
      return;
    this.resultado.set(null);
    this.mensaje.set('');
    this.olvidarReferencia();
  }

  private recibir(respuesta: BanciCargaValidacionResponse): void {
    this.resultado.set(respuesta);
    this.cargando.set(false);
    this.referencia.set(respuesta.codigoReferencia);
    try {
      localStorage.setItem(this.claveReferencia(), respuesta.codigoReferencia);
    } catch {
      /* Referencia disponible en pantalla. */
    }
  }

  // Cancelar expresamente la validación pendiente ANTES de volver a editar.
  // Si la red falla, se conserva la referencia: no se habilita una segunda operación.
  volverAFormulario(aviso?: BanciCargaValidacionError): void {
    aviso ??= this.resultado()?.advertencias.find(a => !!a.campo);
    if (this.cargando() || this.necesitaActualizar() || this.terminado()) return;
    const abrir = () => {
      this.aceptarAdvertencias = false;
      this.resultado.set(null);
      this.olvidarReferencia();
      this.mensaje.set('Edite el dato señalado y vuelva a validar. La revisión anterior fue rechazada sin integrar información.');
      setTimeout(() => this.enfocarCampoAdvertido(aviso), 60);
    };
    if (!this.pendiente()) { abrir(); return; }
    const referencia = this.resultado()!.codigoReferencia;
    this.cargando.set(true);
    this.service.confirmar(referencia, false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => {
        this.cargando.set(false);
        if (respuesta.estado !== 'RECHAZADO_VALIDACION') {
          this.necesitaActualizar.set(true);
          this.mensaje.set('No se confirmó el rechazo de la revisión anterior. Recupere el estado antes de editar.');
          return;
        }
        abrir();
      },
      error: e => {
        this.cargando.set(false);
        this.necesitaActualizar.set(true);
        this.mensaje.set((e?.error?.mensaje || 'No se confirmó el rechazo.') + ' Recupere el estado; la captura se conserva en esta pantalla.');
      }
    });
  }

  private enfocarCampoAdvertido(aviso?: BanciCargaValidacionError): void {
    const archivo = (aviso?.archivo || '').toLowerCase();
    const campo = (aviso?.campo || '').toLowerCase();
    const fila = aviso?.numeroFila ?? 0;
    let prefijo = 'banci-carpeta';
    if (archivo.includes('delito')) prefijo = `banci-delito-${Math.max(0, fila - 1)}`;
    else if (archivo.includes('victim')) {
      let restante = Math.max(1, fila);
      for (let i = 0; i < this.delitos.length; i++) {
        if (restante <= this.delitos[i].victimas.length) {
          prefijo = `banci-victima-${i}-${restante - 1}`;
          break;
        }
        restante -= this.delitos[i].victimas.length;
      }
    }
    const input = campo ? document.getElementById(`${prefijo}-${campo}`) : null;
    if (input) {
      input.closest('details')?.setAttribute('open', '');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (input as HTMLElement).focus({ preventScroll: true });
    } else {
      document.getElementById('inicio-formulario-banci')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Acuse de una captura confirmada: las llaves y NO_BANCI se consultan en la API, no se inventan.
  abrirAcuse(): void {
    const r = this.resultado();
    if (!r || !this.terminado() || this.cargandoResumen()) return;
    this.cargandoResumen.set(true);
    this.errorAcuse.set('');
    this.service.obtenerResumen(r.codigoReferencia).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: filas => {
        this.cargandoResumen.set(false);
        this.resumenConfirmado.set(filas);
        this.mostrarAcuse.set(true);
      },
      error: e => {
        this.cargandoResumen.set(false);
        this.errorAcuse.set(e?.error?.mensaje || 'No se pudo obtener el resumen confirmado. Reintente desde esta pantalla.');
      }
    });
  }

  private claveReferencia(): string {
    return `siiid_banci_formulario_${this.session.usuario()?.idUsuario ?? 'sin_sesion'}`;
  }
  private olvidarReferencia(): void {
    this.referencia.set('');
    try {
      localStorage.removeItem(this.claveReferencia());
    } catch {
      /* Sin almacenamiento local. */
    }
  }
  private enfocarResultado(): void {
    setTimeout(() =>
      document
        .getElementById(
          this.pendiente() ? 'decision-formulario-banci' : 'resultado-formulario-banci',
        )
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
}
