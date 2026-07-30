import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ROLES } from '../../core/constants/roles.constants';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-semanal-inicio',
  imports: [RouterLink],
  templateUrl: './semanal-inicio.html',
  styleUrls: ['../dashboard/dashboard.css', './semanal-inicio.css'],
})
export class SemanalInicio {
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  habilitaModificacion = this.sessionService.habilitaModificacion;

  esSuperUsuario = computed(
    () => this.usuario()?.rol === ROLES.SUPER_USUARIO,
  );

  esEnlaceEstatal = computed(
    () => this.usuario()?.rol === ROLES.ENLACE_ESTATAL,
  );

  esConsulta = computed(
    () => this.usuario()?.rol === ROLES.CONSULTA,
  );

  nombreUsuario = computed(
    () => this.usuario()?.nombre || this.usuario()?.usuario || 'Usuario',
  );

  entidadUsuario = computed(
    () => this.usuario()?.entidadFederativa || 'Nacional',
  );

  rolDescripcion = computed(() => {
    if (this.esSuperUsuario()) {
      return 'Administrador general del sistema';
    }

    if (this.esEnlaceEstatal()) {
      return 'Enlace estatal';
    }

    return 'Usuario de consulta';
  });

  puedeIntegrar = computed(
    () =>
      (this.esSuperUsuario() || this.esEnlaceEstatal()) &&
      (this.habilitaCarga() || this.habilitaModificacion()),
  );

  puedeConsultarEnvios = computed(
    () =>
      this.esSuperUsuario() ||
      this.esEnlaceEstatal() ||
      this.esConsulta(),
  );

  puedeVerReporteCargas = computed(
    () => this.esSuperUsuario(),
  );

  puedeVerPlanos = computed(
    () =>
      this.esSuperUsuario() ||
      this.esEnlaceEstatal() ||
      this.esConsulta(),
  );

  puedeVerArchivosOriginales = computed(
    () => this.esSuperUsuario(),
  );

  puedeAprobarCargas = computed(
    () => this.esSuperUsuario(),
  );

  puedeAdministrarUsuarios = computed(
    () => this.esSuperUsuario(),
  );

  puedeAdministrarConfiguracion = computed(
    () => this.esSuperUsuario(),
  );

  puedeAdministrarDelitos = computed(
    () =>
      this.esSuperUsuario() &&
      this.sessionService.administraDelitos(),
  );
}