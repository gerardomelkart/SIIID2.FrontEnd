import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ROLES } from '../../core/constants/roles.constants';
import { ActualizarPermisosSemanalesRequest, UsuarioDetalle, UsuarioListadoItem } from '../../core/models/usuarios.models';
import { SessionService } from '../../core/services/session.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { mostrarAdvertencia, mostrarError, mostrarExitoInstitucional } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

interface PermisosSemanalesForm {
  habilitaSemanal: boolean;
  habilitaCargaSemanal: boolean;
  habilitaModificacionSemanal: boolean;
  administraDelitosSemanal: boolean;
}

@Component({
  selector: 'app-semanal-usuarios',
  imports: [FormsModule],
  templateUrl: './semanal-usuarios.html',
  styleUrl: './semanal-usuarios.css',
})
export class SemanalUsuarios implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly sessionService = inject(SessionService);

  usuarios = signal<UsuarioListadoItem[]>([]);
  usuarioSeleccionado = signal<UsuarioDetalle | null>(null);
  formulario = signal<PermisosSemanalesForm>(this.crearFormularioVacio());

  busqueda = signal('');
  cargandoUsuarios = signal(false);
  cargandoDetalle = signal(false);
  guardando = signal(false);
  panelAbierto = signal(false);

  usuarioActual = this.sessionService.usuario;

  usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) return this.usuarios();

    return this.usuarios().filter((usuario) => usuario.nombreCompleto.toLowerCase().includes(texto) || usuario.usuario.toLowerCase().includes(texto) || usuario.rol.toLowerCase().includes(texto) || usuario.entidadFederativa?.toLowerCase().includes(texto));
  });

  totalUsuarios = computed(() => this.usuarios().length);
  totalConSemanal = computed(() => this.usuarios().filter((usuario) => usuario.habilitaSemanal).length);
  totalSinSemanal = computed(() => this.usuarios().filter((usuario) => !usuario.habilitaSemanal).length);

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargandoUsuarios.set(true);

    this.usuariosService.obtenerUsuarios(false).subscribe({
      next: (response) => {
        this.usuarios.set(response.usuarios ?? []);
        this.cargandoUsuarios.set(false);
      },
      error: (error) => {
        this.cargandoUsuarios.set(false);
        mostrarError('No fue posible cargar usuarios', obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'));
      },
    });
  }

  buscarUsuarios(valor: string): void {
    this.busqueda.set(valor);
  }

  abrirPermisos(usuario: UsuarioListadoItem): void {
    this.cargandoDetalle.set(true);

    this.usuariosService.obtenerDetalle(usuario.idUsuario).subscribe({
      next: (response) => {
        this.cargandoDetalle.set(false);

        if (!response.esValido || !response.usuario) {
          mostrarAdvertencia('Usuario no encontrado', response.mensaje || 'No fue posible obtener el detalle.');
          return;
        }

        const detalle = response.usuario;

        this.usuarioSeleccionado.set(detalle);
        this.formulario.set({
          habilitaSemanal: detalle.habilitaSemanal,
          habilitaCargaSemanal: detalle.habilitaCargaSemanal,
          habilitaModificacionSemanal: detalle.habilitaModificacionSemanal,
          administraDelitosSemanal: detalle.administraDelitosSemanal,
        });
        this.normalizarFormulario();
        this.panelAbierto.set(true);
      },
      error: (error) => {
        this.cargandoDetalle.set(false);
        mostrarError('No fue posible obtener el usuario', obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'));
      },
    });
  }

  cerrarPanel(): void {
    if (this.guardando()) return;

    this.panelAbierto.set(false);
    this.usuarioSeleccionado.set(null);
    this.formulario.set(this.crearFormularioVacio());
  }

  actualizarCampo<K extends keyof PermisosSemanalesForm>(campo: K, valor: PermisosSemanalesForm[K]): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
    this.normalizarFormulario();
  }

  esUsuarioActualSeleccionado(): boolean {
    return this.usuarioSeleccionado()?.idUsuario === this.usuarioActual()?.idUsuario;
  }

  guardarPermisos(): void {
    const usuario = this.usuarioSeleccionado();

    if (!usuario) return;

    this.normalizarFormulario();

    const form = this.formulario();
    const request: ActualizarPermisosSemanalesRequest = {
      habilitaSemanal: form.habilitaSemanal,
      habilitaCargaSemanal: form.habilitaCargaSemanal,
      habilitaModificacionSemanal: form.habilitaModificacionSemanal,
      administraDelitosSemanal: form.administraDelitosSemanal,
    };

    this.guardando.set(true);

    this.usuariosService.actualizarPermisosSemanales(usuario.idUsuario, request).subscribe({
      next: (response) => {
        this.guardando.set(false);
        mostrarExitoInstitucional(response.mensaje || 'Permisos semanales actualizados.');
        this.cerrarPanel();
        this.cargarUsuarios();
      },
      error: (error) => {
        this.guardando.set(false);
        mostrarError('No fue posible actualizar permisos', obtenerMensajeErrorHttp(error, 'Intente nuevamente.'));
      },
    });
  }

  private normalizarFormulario(): void {
    const usuario = this.usuarioSeleccionado();

    if (!usuario) return;

    this.formulario.update((actual) => ({
      ...actual,
      habilitaCargaSemanal: actual.habilitaSemanal && usuario.rol !== ROLES.CONSULTA ? actual.habilitaCargaSemanal : false,
      habilitaModificacionSemanal: actual.habilitaSemanal && usuario.rol !== ROLES.CONSULTA ? actual.habilitaModificacionSemanal : false,
      administraDelitosSemanal: actual.habilitaSemanal && usuario.rol === ROLES.SUPER_USUARIO ? actual.administraDelitosSemanal : false,
    }));
  }

  private crearFormularioVacio(): PermisosSemanalesForm {
    return {
      habilitaSemanal: false,
      habilitaCargaSemanal: false,
      habilitaModificacionSemanal: false,
      administraDelitosSemanal: false,
    };
  }
}