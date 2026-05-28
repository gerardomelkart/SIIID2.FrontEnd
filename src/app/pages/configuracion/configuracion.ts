import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { UsuarioListadoItem } from '../../core/models/usuarios.models';
import { UsuariosService } from '../../core/services/usuarios.service';
import { RouterLink } from '@angular/router';

interface ConfiguracionEntidad {
  idEntidadFederativa: number | null;
  entidadFederativa: string;
  totalUsuarios: number;
  usuariosCarga: number;
  usuariosModificacion: number;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  estadoCarga: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
  estadoModificacion: 'ACTIVO' | 'INACTIVO' | 'MIXTO';
}

@Component({
  selector: 'app-configuracion',
imports: [FormsModule, RouterLink],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css'
})
export class Configuracion implements OnInit {
  private readonly usuariosService = inject(UsuariosService);

  cargando = signal(false);
  guardandoGlobal = signal(false);

  busquedaEntidad = signal('');

  habilitaCargaGlobal = signal(true);
  habilitaModificacionGlobal = signal(true);

  usuarios = signal<UsuarioListadoItem[]>([]);

  entidadesConfiguracion = computed<ConfiguracionEntidad[]>(() => {
    const grupos = new Map<string, UsuarioListadoItem[]>();

    for (const usuario of this.usuarios()) {
      if (!usuario.activo) {
        continue;
      }

      if (usuario.rol === 'CONSULTA') {
        continue;
      }

      const key = usuario.idEntidadFederativa?.toString() ?? 'NACIONAL';
      const lista = grupos.get(key) ?? [];
      lista.push(usuario);
      grupos.set(key, lista);
    }

    const resultado: ConfiguracionEntidad[] = [];

    grupos.forEach((lista) => {
      const primero = lista[0];

      const usuariosCarga = lista.filter(x => x.habilitaCarga).length;
      const usuariosModificacion = lista.filter(x => x.habilitaModificacion).length;

      resultado.push({
        idEntidadFederativa: primero.idEntidadFederativa,
        entidadFederativa: primero.entidadFederativa || 'Nacional',
        totalUsuarios: lista.length,
        usuariosCarga,
        usuariosModificacion,
        habilitaCarga: usuariosCarga === lista.length,
        habilitaModificacion: usuariosModificacion === lista.length,
        estadoCarga: this.obtenerEstadoPermiso(usuariosCarga, lista.length),
        estadoModificacion: this.obtenerEstadoPermiso(usuariosModificacion, lista.length)
      });
    });

    return resultado.sort((a, b) => a.entidadFederativa.localeCompare(b.entidadFederativa));
  });

  entidadesFiltradas = computed(() => {
    const texto = this.busquedaEntidad().trim().toLowerCase();

    if (!texto) {
      return this.entidadesConfiguracion();
    }

    return this.entidadesConfiguracion().filter(entidad =>
      entidad.entidadFederativa.toLowerCase().includes(texto)
    );
  });

  totalEntidades = computed(() => this.entidadesConfiguracion().length);

  totalEntidadesCargaActiva = computed(() => {
    return this.entidadesConfiguracion().filter(x => x.estadoCarga === 'ACTIVO').length;
  });

  totalEntidadesModificacionActiva = computed(() => {
    return this.entidadesConfiguracion().filter(x => x.estadoModificacion === 'ACTIVO').length;
  });

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando.set(true);

    this.usuariosService.obtenerUsuarios(true).subscribe({
      next: (response) => {
        const usuarios = response.usuarios ?? [];

        this.usuarios.set(usuarios);
        this.sincronizarSwitchesGlobales(usuarios);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);

        Swal.fire({
          icon: 'error',
          title: 'No fue posible cargar configuración',
          text: error?.error?.mensaje || 'Revise la conexión con la API.',
          confirmButtonColor: '#691C32'
        });
      }
    });
  }

  guardarConfiguracionGlobal(): void {
    Swal.fire({
      icon: 'question',
      title: 'Actualizar permisos globales',
      text: 'Esta acción actualizará carga y modificación para todos los usuarios activos permitidos.',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#691C32'
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.guardandoGlobal.set(true);

      this.usuariosService.actualizarPermisosGlobales({
        habilitaCarga: this.habilitaCargaGlobal(),
        habilitaModificacion: this.habilitaModificacionGlobal()
      }).subscribe({
        next: (response) => {
          this.guardandoGlobal.set(false);

          Swal.fire({
            icon: 'success',
            title: response.mensaje || 'Configuración global actualizada.',
            confirmButtonColor: '#691C32'
          });

          this.cargarUsuarios();
        },
        error: (error) => {
          this.guardandoGlobal.set(false);

          Swal.fire({
            icon: 'error',
            title: 'No fue posible actualizar configuración global',
            text: error?.error?.mensaje || 'Intente nuevamente.',
            confirmButtonColor: '#691C32'
          });
        }
      });
    });
  }

  cambiarCargaGlobal(valor: boolean): void {
    this.habilitaCargaGlobal.set(valor);
  }

  cambiarModificacionGlobal(valor: boolean): void {
    this.habilitaModificacionGlobal.set(valor);
  }

  etiquetaEstado(estado: 'ACTIVO' | 'INACTIVO' | 'MIXTO'): string {
    if (estado === 'ACTIVO') {
      return 'Activo';
    }

    if (estado === 'INACTIVO') {
      return 'Inactivo';
    }

    return 'Mixto';
  }

  private obtenerEstadoPermiso(totalActivos: number, totalUsuarios: number): 'ACTIVO' | 'INACTIVO' | 'MIXTO' {
    if (totalUsuarios === 0 || totalActivos === 0) {
      return 'INACTIVO';
    }

    if (totalActivos === totalUsuarios) {
      return 'ACTIVO';
    }

    return 'MIXTO';
  }

  private sincronizarSwitchesGlobales(usuarios: UsuarioListadoItem[]): void {
    const usuariosOperativos = usuarios.filter(x => x.activo && x.rol !== 'CONSULTA');

    if (usuariosOperativos.length === 0) {
      this.habilitaCargaGlobal.set(false);
      this.habilitaModificacionGlobal.set(false);
      return;
    }

    this.habilitaCargaGlobal.set(usuariosOperativos.every(x => x.habilitaCarga));
    this.habilitaModificacionGlobal.set(usuariosOperativos.every(x => x.habilitaModificacion));
  }
}