import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ROLES } from '../../core/constants/roles.constants';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-federal-inicio',
  imports: [RouterLink],
  templateUrl: './federal-inicio.html',
  styleUrls: ['../dashboard/dashboard.css', './federal-inicio.css'],
})
export class FederalInicio {
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  esEnlaceFederal = computed(() => this.usuario()?.rol === ROLES.ENLACE_ESTATAL);
  esConsulta = computed(() => this.usuario()?.rol === ROLES.CONSULTA);

  nombreUsuario = computed(() => {
    return this.usuario()?.nombre || this.usuario()?.usuario || 'Usuario';
  });

  rolDescripcion = computed(() => {
    if (this.esSuperUsuario()) return 'Administrador general del sistema';
    if (this.esEnlaceFederal()) return 'Enlace federal';
    return 'Usuario de consulta';
  });

  puedeVerCarga = computed(() => {
    return !this.esConsulta() && this.habilitaCarga();
  });
}