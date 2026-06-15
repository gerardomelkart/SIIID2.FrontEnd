import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROLES } from '../../core/constants/roles.constants';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  esEnlaceEstatal = computed(() => this.usuario()?.rol === ROLES.ENLACE_ESTATAL);
  esConsulta = computed(() => this.usuario()?.rol === ROLES.CONSULTA);

  nombreUsuario = computed(() => {
    return this.usuario()?.nombre || this.usuario()?.usuario || 'Usuario';
  });

  entidadUsuario = computed(() => {
    return this.usuario()?.entidadFederativa || 'Nacional';
  });

  rolDescripcion = computed(() => {
    if (this.esSuperUsuario()) {
      return 'Administrador general del sistema';
    }

    if (this.esEnlaceEstatal()) {
      return 'Enlace estatal';
    }

    return 'Usuario de consulta';
  });

  puedeVerCarga = computed(() => {
    return !this.esConsulta() && this.habilitaCarga();
  });

  puedeVerActualizacion = computed(() => {
    return !this.esConsulta() && this.habilitaModificacion();
  });

  puedeVerEnvios = computed(() => {
    return this.esSuperUsuario() || this.esEnlaceEstatal() || this.esConsulta();
  });

  puedeVerCargas = computed(() => {
    return this.esSuperUsuario();
  });

  puedeVerSabanas = computed(() => {
    return this.esSuperUsuario();
  });

  puedeVerAdministracion = computed(() => {
    return this.esSuperUsuario();
  });
}
