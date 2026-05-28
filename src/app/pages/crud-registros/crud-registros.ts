import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

interface UsuarioAdmin {
  id: number;
  nombreCompleto: string;
  usuario: string;
  correo: string;
  telefono: string;
  rol: string;
  entidad: string;
  habilitaCarga: boolean;
  habilitaModificacion: boolean;
  estado: EstadoUsuario;
  fechaAlta: string;
  usuarioRegistro: string;
}

@Component({
  selector: 'app-crud-registros',
  imports: [FormsModule],
  templateUrl: './crud-registros.html',
  styleUrl: './crud-registros.css'
})
export class CrudRegistros {
  busqueda = signal('');
  mostrarInactivos = signal(false);
  modalAbierto = signal(false);
  modoFormulario = signal<'NUEVO' | 'EDITAR'>('NUEVO');

  usuarioSeleccionado = signal<UsuarioAdmin | null>(null);

  usuarios = signal<UsuarioAdmin[]>([
    {
      id: 1,
      nombreCompleto: 'SUPER USUARIO',
      usuario: 'super.usuario',
      correo: 'super@siiid.gob.mx',
      telefono: '5550000000',
      rol: 'Super Usuario',
      entidad: 'Nacional',
      habilitaCarga: true,
      habilitaModificacion: true,
      estado: 'ACTIVO',
      fechaAlta: '2026-05-27 12:17:05',
      usuarioRegistro: 'melkart'
    },
    {
      id: 2,
      nombreCompleto: 'USUARIO CAMPECHE PRUEBA',
      usuario: 'camp.prueba',
      correo: 'cni@sspc.gob.mx',
      telefono: '5611036000',
      rol: 'Operador',
      entidad: 'Campeche',
      habilitaCarga: true,
      habilitaModificacion: true,
      estado: 'ACTIVO',
      fechaAlta: '2026-05-27 12:20:30',
      usuarioRegistro: 'melkart'
    },
    {
      id: 3,
      nombreCompleto: 'CONSULTA BAJA CALIFORNIA',
      usuario: 'bc.consulta',
      correo: 'consulta@sspc.gob.mx',
      telefono: '5533322584',
      rol: 'Consulta',
      entidad: 'Baja California',
      habilitaCarga: false,
      habilitaModificacion: false,
      estado: 'INACTIVO',
      fechaAlta: '2026-05-04 07:29:09',
      usuarioRegistro: 'melkart'
    }
  ]);

usuariosFiltrados = computed(() => {
  const texto = this.busqueda().trim().toLowerCase();
  const mostrarInactivos = this.mostrarInactivos();

  return this.usuarios().filter(usuario => {
    const pasaEstado = mostrarInactivos || usuario.estado === 'ACTIVO';

    const pasaBusqueda = !texto ||
      usuario.nombreCompleto.toLowerCase().includes(texto) ||
      usuario.usuario.toLowerCase().includes(texto) ||
      usuario.correo.toLowerCase().includes(texto) ||
      usuario.rol.toLowerCase().includes(texto) ||
      usuario.entidad.toLowerCase().includes(texto);

    return pasaEstado && pasaBusqueda;
  });
});

  totalUsuarios = computed(() => this.usuarios().length);
  totalActivos = computed(() => this.usuarios().filter(x => x.estado === 'ACTIVO').length);
  totalInactivos = computed(() => this.usuarios().filter(x => x.estado === 'INACTIVO').length);
  totalSuperUsuarios = computed(() => this.usuarios().filter(x => x.rol.toLowerCase().includes('super')).length);

  abrirNuevoUsuario(): void {
    this.modoFormulario.set('NUEVO');
    this.usuarioSeleccionado.set(null);
    this.modalAbierto.set(true);
  }

  abrirEditarUsuario(usuario: UsuarioAdmin): void {
    this.modoFormulario.set('EDITAR');
    this.usuarioSeleccionado.set({ ...usuario });
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.usuarioSeleccionado.set(null);
  }

  cambiarEstado(usuario: UsuarioAdmin): void {
    usuario.estado = usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    this.usuarios.update(lista => [...lista]);
  }

  guardarUsuarioDemo(): void {
    this.cerrarModal();
  }
}