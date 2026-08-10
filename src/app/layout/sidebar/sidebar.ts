import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cargaAbierta = signal(false);

  informesAbierto = signal(false);

  administracionAbierta = signal(false);

  sesionAbierta = signal(false);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  esEnlaceEstatal = computed(() => this.usuario()?.rol === ROLES.ENLACE_ESTATAL);
  esConsulta = computed(() => this.usuario()?.rol === ROLES.CONSULTA);

  puedeRegresarSeleccionModulo = this.sessionService.tieneMultiplesModulos;

  puedeVerCargaInformacion = computed(() => {
    return !this.esConsulta() && (this.habilitaCarga() || this.habilitaModificacion());
  });

  puedeVerReporteEnvios = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  puedeVerReporteCargas = computed(() => {
    return this.esSuperUsuario();
  });

  puedeVerSabanas = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  puedeVerArchivosOriginales = computed(() => {
    return this.esSuperUsuario();
  });

  puedeVerAdministracion = computed(() => {
    return this.esSuperUsuario();
  });

  toggleCarga(): void {
    this.cargaAbierta.update((valor) => !valor);
  }

  toggleInformes(): void {
    this.informesAbierto.update((valor) => !valor);
  }

  toggleAdministracion(): void {
    this.administracionAbierta.update((valor) => !valor);
  }

  toggleSesion(): void {
    this.sesionAbierta.update((valor) => !valor);
  }

  regresarInicio(): void {
    void this.router.navigateByUrl('/').then(() => window.location.reload());
  }

  regresarSeleccionModulo(): void {
    this.sessionService.limpiarModuloActivo();
    void this.router.navigateByUrl('/seleccionar-modulo');
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
