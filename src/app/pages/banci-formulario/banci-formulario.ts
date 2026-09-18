import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BanciCargaService } from '../../core/services/banci-carga.service';
import { SessionService } from '../../core/services/session.service';
import { BanciCargaValidacionResponse } from '../../core/models/banci-carga.models';
import { BanciFormularioDelito, BanciFormularioOpciones } from '../../core/models/banci-formulario.models';
import { BanciCampos } from './banci-campos';
import { CAMPOS_CARPETAS, CAMPOS_DELITOS, CAMPOS_VICTIMAS } from './banci-formulario-campos';
import { BanciVistaPreviaComponent } from '../banci-carga/banci-vista-previa';

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
  pendiente = computed(() => this.resultado()?.estado === 'VALIDADO_PENDIENTE');
  terminado = computed(() => ['PROCESADO', 'PROCESADO_CON_ADVERTENCIAS'].includes(this.resultado()?.estado ?? ''));
  bloqueado = computed(() => this.cargando() || this.pendiente() || this.necesitaActualizar() || this.terminado() || this.resultado()?.estado === 'RECHAZADO_VALIDACION');
  entidades = computed(() => this.opciones()?.catalogos.filter(c => c.campo === 'id_ent_hchos' && Number(c.clave) >= 1 && Number(c.clave) <= 32) ?? []);
  entidad: number | null = null;
  carpeta: Record<string, string> = {};
  delitos: BanciFormularioDelito[] = [{ datos: {}, victimas: [{}] }];

  ngOnInit(): void {
    this.cargarOpciones();
    try { this.referencia.set(localStorage.getItem(this.claveReferencia()) || ''); } catch { /* Sólo se conserva la referencia, no los datos personales. */ }
    if (this.referencia()) this.actualizarEstado();
  }

  cargarOpciones(): void {
    if (this.cargandoOpciones()) return;
    this.cargandoOpciones.set(true);
    this.errorOpciones.set('');
    this.service.obtenerFormularioOpciones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: opciones => {
        this.opciones.set(opciones);
        this.entidad = opciones.esSuperUsuario ? null : opciones.idEntidadFederativa;
        for (const delito of this.delitos) this.preseleccionarEntidad(delito);
        this.cargandoOpciones.set(false);
      },
      error: e => { this.cargandoOpciones.set(false); this.errorOpciones.set(e?.error?.mensaje || 'No fue posible cargar las opciones del formulario.'); },
    });
  }

  private preseleccionarEntidad(delito: BanciFormularioDelito): void {
    const opciones = this.opciones();
    if (!opciones || opciones.esSuperUsuario || !opciones.idEntidadFederativa || delito.datos['id_ent_hchos']) return;
    const entidad = opciones.catalogos.find(c => c.campo === 'id_ent_hchos' && Number(c.clave) === opciones.idEntidadFederativa);
    if (entidad) { delito.datos['id_ent_hchos'] = entidad.clave; delito.datos['nom_ent_hchos'] = entidad.descripcion; }
  }
  agregarDelito(): void { if (!this.bloqueado() && this.delitos.length < 100) { const delito = { datos: {}, victimas: [{}] }; this.preseleccionarEntidad(delito); this.delitos.push(delito); } }
  quitarDelito(indice: number): void { if (!this.bloqueado() && this.delitos.length > 1) this.delitos.splice(indice, 1); }
  agregarVictima(delito: BanciFormularioDelito): void { if (!this.bloqueado() && delito.victimas.length < 500 && this.totalVictimas() < 1000) delito.victimas.push({}); }
  quitarVictima(delito: BanciFormularioDelito, indice: number): void { if (!this.bloqueado() && delito.victimas.length > 1) delito.victimas.splice(indice, 1); }
  totalVictimas(): number { return this.delitos.reduce((total, delito) => total + delito.victimas.length, 0); }

  validar(): void {
    if (this.bloqueado() || !this.opciones()) return;
    this.mensaje.set('');
    if (this.opciones()!.esSuperUsuario && !this.entidad) { this.mensaje.set('Seleccione la entidad que reporta la carpeta.'); return; }
    this.resultado.set(null);
    this.cargando.set(true);
    const request = { idEntidadFederativa: this.opciones()!.esSuperUsuario ? this.entidad : null, carpeta: this.carpeta, delitos: this.delitos };
    this.service.validarFormulario(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => { this.recibir(respuesta); this.enfocarResultado(); },
      error: e => {
        this.cargando.set(false);
        if (Array.isArray(e?.error?.errores)) this.resultado.set(e.error);
        else this.mensaje.set(e?.error?.mensaje || 'No se recibió el resultado. Puede volver a validar; nada se integra sin su aceptación.');
        this.enfocarResultado();
      },
    });
  }

  confirmar(aceptar: boolean): void {
    const carga = this.resultado();
    if (!carga || !this.pendiente() || this.cargando() || this.necesitaActualizar()) return;
    if (aceptar && !carga.vistaPrevia?.huella) { this.mensaje.set('Actualice el estado y revise la vista previa antes de aceptar.'); return; }
    this.cargando.set(true);
    this.mensaje.set('');
    this.service.confirmar(carga.codigoReferencia, aceptar, aceptar ? carga.vistaPrevia?.huella : undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => { this.recibir({ ...respuesta, modalidadIngreso: 'FORMULARIO', errores: carga.errores, advertencias: carga.advertencias }); this.enfocarResultado(); },
      error: e => {
        this.cargando.set(false);
        this.necesitaActualizar.set(e?.error?.codigo !== 'BANCI_52424');
        this.mensaje.set(e?.error?.mensaje || 'No se recibió la confirmación. Actualice el estado antes de volver a decidir.');
      },
    });
  }

  actualizarEstado(): void {
    if (!this.referencia() || this.cargando()) return;
    this.cargando.set(true);
    this.necesitaActualizar.set(true);
    this.mensaje.set('');
    this.service.obtenerCarga(this.referencia()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: respuesta => { this.recibir(respuesta); this.necesitaActualizar.set(false); },
      error: e => {
        this.cargando.set(false);
        if (e?.status === 404) { this.olvidarReferencia(); this.resultado.set(null); this.necesitaActualizar.set(false); }
        this.mensaje.set(e?.error?.mensaje || 'No fue posible recuperar la captura. Reintente actualizar el estado.');
      },
    });
  }

  nuevaCaptura(): void {
    if (this.cargando() || this.pendiente() || this.necesitaActualizar()) return;
    this.carpeta = {};
    this.delitos = [{ datos: {}, victimas: [{}] }];
    this.preseleccionarEntidad(this.delitos[0]);
    this.resultado.set(null);
    this.mensaje.set('');
    this.olvidarReferencia();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  corregirCaptura(): void {
    if (this.cargando() || this.pendiente() || this.necesitaActualizar() || this.terminado()) return;
    this.resultado.set(null);
    this.mensaje.set('');
    this.olvidarReferencia();
  }

  private recibir(respuesta: BanciCargaValidacionResponse): void {
    this.resultado.set(respuesta);
    this.cargando.set(false);
    this.referencia.set(respuesta.codigoReferencia);
    try { localStorage.setItem(this.claveReferencia(), respuesta.codigoReferencia); } catch { /* Referencia disponible en pantalla. */ }
  }

  private claveReferencia(): string { return `siiid_banci_formulario_${this.session.usuario()?.idUsuario ?? 'sin_sesion'}`; }
  private olvidarReferencia(): void { this.referencia.set(''); try { localStorage.removeItem(this.claveReferencia()); } catch { /* Sin almacenamiento local. */ } }
  private enfocarResultado(): void { setTimeout(() => document.getElementById('resultado-formulario-banci')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
}
