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

  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  esEnlaceEstatal = computed(() => this.usuario()?.rol === ROLES.ENLACE_ESTATAL);

  nombreUsuario = computed(() => {
    return this.usuario()?.nombre || this.usuario()?.usuario || 'Usuario';
  });

  entidadUsuario = computed(() => {
    return this.usuario()?.entidadFederativa || 'Nacional';
  });

  rolDescripcion = computed(() => {
    if (this.esSuperUsuario()) return 'Administrador general del sistema';
    if (this.esEnlaceEstatal()) return 'Enlace estatal';
    return 'Usuario de consulta';
  });

  puedeCargar = computed(
    () =>
      (this.esSuperUsuario() || this.esEnlaceEstatal()) &&
      this.habilitaCarga(),
  );

  puedeActualizar = computed(
    () =>
      (this.esSuperUsuario() || this.esEnlaceEstatal()) &&
      this.habilitaModificacion(),
  );

  puedeAdministrarUsuarios = computed(() => this.esSuperUsuario());

  puedeAprobarCargas = computed(() => this.esSuperUsuario());

  puedeAdministrarDelitos = computed(
    () => this.esSuperUsuario() && this.sessionService.administraDelitos(),
  );
}
