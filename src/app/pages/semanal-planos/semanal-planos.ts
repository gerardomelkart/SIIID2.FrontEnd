import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ROLES } from '../../core/constants/roles.constants';
import { SemanalEnviosService } from '../../core/services/semanal-envios.service';
import { SessionService } from '../../core/services/session.service';
import { mostrarAdvertencia, mostrarError } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';

type TipoPlanoSemanal = 'COMPLETA' | 'ESTATALES' | 'MUNICIPALES';

@Component({
  selector: 'app-semanal-planos',
  imports: [FormsModule],
  templateUrl: './semanal-planos.html',
  styleUrls: ['../informes/informes.css', './semanal-planos.css'],
})
export class SemanalPlanos {
  private readonly semanalEnviosService = inject(SemanalEnviosService);
  private readonly sessionService = inject(SessionService);

  usuario = this.sessionService.usuario;
  esSuperUsuario = computed(() => this.usuario()?.rol === ROLES.SUPER_USUARIO);
  entidadUsuario = computed(() => this.usuario()?.entidadFederativa ?? '');

  anioCorte = signal(new Date().getFullYear());
  mesCorte = signal(new Date().getMonth() + 1);
  descargandoPlano = signal<TipoPlanoSemanal | null>(null);
  descargaEnProceso = computed(() => this.descargandoPlano() !== null);

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

  ajustarAnio(cantidad: number): void {
    this.anioCorte.set(this.anioCorte() + cantidad);
  }

  descargarPlanos(tipo: TipoPlanoSemanal): void {
    const anioCorte = Number(this.anioCorte());
    const mesCorte = Number(this.mesCorte());

    if (!Number.isInteger(anioCorte) || anioCorte < 2000 || anioCorte > 2100) {
      mostrarAdvertencia('Año inválido', 'Capture un año de corte válido.');
      return;
    }

    if (!Number.isInteger(mesCorte) || mesCorte < 1 || mesCorte > 12) {
      mostrarAdvertencia('Mes inválido', 'Seleccione un mes de corte válido.');
      return;
    }

    this.descargandoPlano.set(tipo);

    this.semanalEnviosService.crearTicketDescargaPlanos(anioCorte, mesCorte, tipo).subscribe({
      next: (response) => {
        if (!response.ticket) {
          this.descargandoPlano.set(null);
          mostrarAdvertencia('Descarga no disponible', 'La API no devolvió un ticket de descarga.');
          return;
        }

        const url = this.semanalEnviosService.obtenerUrlDescargaPlanos(response.ticket);
        const iframe = document.createElement('iframe');

        iframe.src = url;
        iframe.style.display = 'none';

        document.body.appendChild(iframe);
        this.descargandoPlano.set(null);

        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 60000);
      },
      error: async (error: unknown) => {
        this.descargandoPlano.set(null);

        mostrarError(
          'No fue posible descargar los planos semanales',
          await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.'),
        );
      },
    });
  }
}