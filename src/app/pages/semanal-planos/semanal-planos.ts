import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ROLES } from '../../core/constants/roles.constants';
import {
  SemanalReportePreliminarDelitoItem,
  SemanalReportePreliminarEntidadItem,
} from '../../core/models/semanal-envios.models';
import { SemanalEnviosService } from '../../core/services/semanal-envios.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';

type ModoReportePreliminar = 'CONFIRMADO' | 'PREVIO' | 'MIXTO';

@Component({
  selector: 'app-semanal-planos',
  imports: [FormsModule],
  templateUrl: './semanal-planos.html',
  styleUrls: ['../informes/informes.css', './semanal-planos.css'],
})
export class SemanalPlanos implements OnInit {
  private readonly semanalEnviosService = inject(SemanalEnviosService);
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  entidadUsuario = computed(() => this.usuario()?.entidadFederativa ?? '');

  readonly meses = [
    { numero: 1, nombre: 'Enero' },
    { numero: 2, nombre: 'Febrero' },
    { numero: 3, nombre: 'Marzo' },
    { numero: 4, nombre: 'Abril' },
    { numero: 5, nombre: 'Mayo' },
    { numero: 6, nombre: 'Junio' },
    { numero: 7, nombre: 'Julio' },
    { numero: 8, nombre: 'Agosto' },
    { numero: 9, nombre: 'Septiembre' },
    { numero: 10, nombre: 'Octubre' },
    { numero: 11, nombre: 'Noviembre' },
    { numero: 12, nombre: 'Diciembre' },
  ];

  anioCorte = signal(new Date().getFullYear());
  mesCorte = signal(new Date().getMonth() + 1);
  modoReporte = signal<ModoReportePreliminar>('CONFIRMADO');
  idEntidadSeleccionada = signal<number | null>(null);
  idDelitoSeleccionado = signal<number | null>(null);
  entidades = signal<SemanalReportePreliminarEntidadItem[]>([]);
  delitos = signal<SemanalReportePreliminarDelitoItem[]>([]);
  cargandoOpciones = signal(false);
  descargandoReporte = signal(false);

  operacionEnCurso = computed(() => this.cargandoOpciones() || this.descargandoReporte());
  nombreMesSeleccionado = computed(
    () => this.meses.find((x) => x.numero === this.mesCorte())?.nombre ?? '',
  );
  delitoSeleccionado = computed(
    () => this.delitos().find((x) => x.idDelito === this.idDelitoSeleccionado()) ?? null,
  );
  descripcionModo = computed(() => {
    if (this.modoReporte() === 'PREVIO')
      return 'Incluye únicamente cargas pendientes de aprobación.';
    if (this.modoReporte() === 'MIXTO')
      return 'Combina la información confirmada con la información pendiente disponible.';
    return 'Incluye únicamente cargas confirmadas.';
  });

  alcanceSeleccionado = computed(() => {
    if (!this.esSuperUsuario())
      return this.entidadUsuario() || this.entidades()[0]?.entidadFederativa || 'Mi entidad';

    const idEntidad = this.idEntidadSeleccionada();

    if (!idEntidad) return 'General — todas las entidades';

    return (
      this.entidades().find((x) => x.idEntidadFederativa === idEntidad)?.entidadFederativa ??
      'Entidad seleccionada'
    );
  });

  descripcionAlcance = computed(() => {
    if (!this.esSuperUsuario())
      return 'Incluye únicamente los registros confirmados que fueron cargados por tu usuario.';
    if (this.idEntidadSeleccionada())
      return `${this.descripcionModo()} Alcance: todos los usuarios de la entidad seleccionada.`;
    return `${this.descripcionModo()} Alcance: todas las entidades y todos los usuarios.`;
  });

  ngOnInit(): void {
    this.cargarOpciones();
  }

  ajustarAnio(cantidad: number): void {
    this.anioCorte.set(this.anioCorte() + cantidad);
    this.cambiarPeriodo();
  }

  cambiarPeriodo(): void {
    if (!this.periodoValido()) return;

    this.idEntidadSeleccionada.set(null);
    this.idDelitoSeleccionado.set(null);
    this.cargarOpciones();
  }

  cambiarMes(valor: number): void {
    this.mesCorte.set(Number(valor));
    this.cambiarPeriodo();
  }

  cambiarModo(valor: ModoReportePreliminar): void {
    this.modoReporte.set(valor);
    this.idEntidadSeleccionada.set(null);
    this.idDelitoSeleccionado.set(null);
    this.cargarOpciones();
  }

  cambiarEntidad(valor: string | number | null): void {
    const idEntidad = Number(valor);

    this.idEntidadSeleccionada.set(
      valor === null || valor === '' || !Number.isInteger(idEntidad) || idEntidad <= 0
        ? null
        : idEntidad,
    );
    this.idDelitoSeleccionado.set(null);
    this.cargarOpciones();
  }

  cambiarDelito(valor: string | number | null): void {
    const idDelito = Number(valor);

    this.idDelitoSeleccionado.set(
      valor === null || valor === '' || !Number.isInteger(idDelito) || idDelito <= 0
        ? null
        : idDelito,
    );
  }

  cargarOpciones(): void {
    if (!this.periodoValido() || this.cargandoOpciones()) return;

    this.cargandoOpciones.set(true);

    this.semanalEnviosService
      .obtenerOpcionesReportePreliminar(
        this.anioCorte(),
        this.mesCorte(),
        this.esSuperUsuario() ? this.modoReporte() : 'CONFIRMADO',
        this.esSuperUsuario() ? this.idEntidadSeleccionada() : null,
      )
      .subscribe({
        next: (response) => {
          this.cargandoOpciones.set(false);

          const entidades = response.entidades ?? [];
          const delitos = response.delitos ?? [];

          this.entidades.set(entidades);
          this.delitos.set(delitos);
          this.idDelitoSeleccionado.set(delitos[0]?.idDelito ?? null);
        },
        error: async (error: unknown) => {
          this.cargandoOpciones.set(false);
          this.entidades.set([]);
          this.delitos.set([]);
          this.idDelitoSeleccionado.set(null);

          mostrarError(
            'No fue posible consultar el reporte preliminar',
            await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
          );
        },
      });
  }

  descargar(): void {
    if (this.descargandoReporte() || !this.periodoValido()) return;

    const idDelito = this.idDelitoSeleccionado();

    if (!idDelito) {
      mostrarAdvertencia(
        'Reporte no disponible',
        'No existe información disponible para el periodo, estado y alcance seleccionados.',
      );
      return;
    }

    this.descargandoReporte.set(true);

    this.semanalEnviosService
      .crearTicketReportePreliminar(
        this.anioCorte(),
        this.mesCorte(),
        idDelito,
        this.esSuperUsuario() ? this.modoReporte() : 'CONFIRMADO',
        this.esSuperUsuario() ? this.idEntidadSeleccionada() : null,
      )
      .subscribe({
        next: (response) => {
          if (!response.ticket) {
            this.descargandoReporte.set(false);
            mostrarAdvertencia(
              'Descarga no disponible',
              'La API no devolvió un ticket de descarga.',
            );
            return;
          }

          const iframe = document.createElement('iframe');

          iframe.src = this.semanalEnviosService.obtenerUrlReportePreliminar(response.ticket);
          iframe.style.display = 'none';

          document.body.appendChild(iframe);
          this.descargandoReporte.set(false);

          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 60000);
        },
        error: async (error: unknown) => {
          this.descargandoReporte.set(false);

          mostrarError(
            'No fue posible descargar el reporte preliminar',
            await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
          );
        },
      });
  }

  private periodoValido(): boolean {
    const anioCorte = Number(this.anioCorte());
    const mesCorte = Number(this.mesCorte());

    if (!Number.isInteger(anioCorte) || anioCorte < 2000 || anioCorte > 2100) {
      mostrarAdvertencia('Año inválido', 'Capture un año de corte válido.');
      return false;
    }

    if (!Number.isInteger(mesCorte) || mesCorte < 1 || mesCorte > 12) {
      mostrarAdvertencia('Mes inválido', 'Seleccione un mes de corte válido.');
      return false;
    }

    return true;
  }
}
