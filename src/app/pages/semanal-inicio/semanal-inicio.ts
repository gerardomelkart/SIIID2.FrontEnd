import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ROLES } from '../../core/constants/roles.constants';
import { DelitoSemanalHabilitadoItem } from '../../core/models/semanal-delitos.models';
import { SemanalDelitosService } from '../../core/services/semanal-delitos.service';
import { SessionService } from '../../core/services/session.service';
import { RecordatorioCarga } from '../../shared/recordatorio-carga/recordatorio-carga';

@Component({
  selector: 'app-semanal-inicio',
  imports: [RouterLink, RecordatorioCarga],
  templateUrl: './semanal-inicio.html',
  styleUrls: ['../dashboard/dashboard.css', './semanal-inicio.css'],
})
export class SemanalInicio implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly semanalDelitosService = inject(SemanalDelitosService);

  usuario = this.sessionService.usuario;
  habilitaCarga = this.sessionService.habilitaCarga;
  delitosHabilitados = signal<DelitoSemanalHabilitadoItem[]>([]);
  cargandoDelitos = signal(true);
  mensajeDelitos = signal('');

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
    () => (this.esSuperUsuario() || this.esEnlaceEstatal()) && this.habilitaCarga(),
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

  puedeVerReportePreliminar = computed(
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

  ngOnInit(): void {
    this.cargarDelitosHabilitados();
  }

  private cargarDelitosHabilitados(): void {
    this.semanalDelitosService.obtenerDelitosHabilitados().subscribe({
      next: (response) => {
        this.cargandoDelitos.set(false);

        if (!response.esValido) {
          this.mensajeDelitos.set(response.mensaje || 'No fue posible consultar los delitos habilitados.');
          return;
        }

        const delitos = response.delitos ?? [];

        this.delitosHabilitados.set(delitos);
        this.mensajeDelitos.set(delitos.length === 0 ? 'No hay delitos habilitados.' : '');
      },
      error: () => {
        this.cargandoDelitos.set(false);
        this.mensajeDelitos.set('No fue posible consultar los delitos habilitados.');
      },
    });
  }
}