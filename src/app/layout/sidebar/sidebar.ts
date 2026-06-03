import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cargaAbierta = signal(false);
  incidenciaAbierta = signal(false);

  informesAbierto = signal(false);
  informesIncidenciaAbierta = signal(false);

  administracionAbierta = signal(false);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  esEnlaceEstatal = computed(() => this.usuario()?.rol === ROLES.ENLACE_ESTATAL);
  esConsulta = computed(() => this.usuario()?.rol === ROLES.CONSULTA);

  puedeVerCargaInformacion = computed(() => {
    return !this.esConsulta() && (this.habilitaCarga() || this.habilitaModificacion());
  });

  puedeVerReporteEnvios = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  puedeVerReporteCargas = computed(() => {
    return this.esSuperUsuario();
  });

  puedeVerAdministracion = computed(() => {
    return this.esSuperUsuario();
  });

  toggleCarga(): void {
    this.cargaAbierta.update(valor => !valor);

    if (!this.cargaAbierta()) {
      this.incidenciaAbierta.set(false);
    }
  }

  toggleIncidencia(): void {
    this.incidenciaAbierta.update(valor => !valor);
  }

  toggleInformes(): void {
    this.informesAbierto.update(valor => !valor);

    if (!this.informesAbierto()) {
      this.informesIncidenciaAbierta.set(false);
    }
  }

  toggleInformesIncidencia(): void {
    this.informesIncidenciaAbierta.update(valor => !valor);
  }

  toggleAdministracion(): void {
    this.administracionAbierta.update(valor => !valor);
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}