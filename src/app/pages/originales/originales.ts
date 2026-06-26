import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InformesService } from '../../core/services/informes.service';
import { UltimosArchivosEntidadResumen } from '../../core/models/informes.models';
import { mostrarError } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-originales',
  imports: [FormsModule],
  templateUrl: './originales.html',
  styleUrl: './originales.css',
})
export class Originales implements OnInit {
  private readonly informesService = inject(InformesService);

  archivos = signal<UltimosArchivosEntidadResumen[]>([]);
  busqueda = signal('');
  cargando = signal(false);
  descargandoEntidad = signal<number | null>(null);

  archivosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) {
      return this.archivos();
    }

    return this.archivos().filter((item) => {
      return (
        this.entidadTexto(item).toLowerCase().includes(texto) ||
        item.codigoReferencia.toLowerCase().includes(texto) ||
        this.tipoMovimientoTexto(item.tipoMovimiento).toLowerCase().includes(texto) ||
        item.archivos.some((archivo) => archivo.nombreOriginal.toLowerCase().includes(texto))
      );
    });
  });

  ngOnInit(): void {
    this.cargarArchivos();
  }

  cargarArchivos(): void {
    this.cargando.set(true);

    this.informesService.obtenerArchivosOriginales().subscribe({
      next: (response) => {
        this.archivos.set(response.registros ?? []);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);
        mostrarError('No fue posible consultar los archivos originales', obtenerMensajeErrorHttp(error, 'Revise la conexión con la API.'));
      },
    });
  }

  descargar(item: UltimosArchivosEntidadResumen): void {
    this.descargandoEntidad.set(item.idEntidadFederativa);
    this.descargandoEntidad.set(null);
  }

  entidadTexto(item: UltimosArchivosEntidadResumen): string {
    return `Entidad ${item.idEntidadFederativa.toString().padStart(2, '0')}`;
  }

  tipoMovimientoTexto(tipoMovimiento: string | null): string {
    if (!tipoMovimiento) {
      return '-';
    }

    if (tipoMovimiento === 'CARGA_INICIAL') {
      return 'Carga inicial';
    }

    if (tipoMovimiento === 'ACTUALIZACION') {
      return 'Actualización';
    }

    return tipoMovimiento.replaceAll('_', ' ');
  }

  periodoTexto(item: UltimosArchivosEntidadResumen): string {
    const fecha = new Date(item.anioCorte, item.mesCorte - 1, 1);
    const texto = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(fecha);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  fechaTexto(fecha: string): string {
    if (!fecha) {
      return '-';
    }

    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fecha));
  }

  tamanioTexto(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }

    const unidades = ['B', 'KB', 'MB', 'GB'];
    let valor = bytes;
    let indice = 0;

    while (valor >= 1024 && indice < unidades.length - 1) {
      valor = valor / 1024;
      indice++;
    }

    return `${valor.toFixed(indice === 0 ? 0 : 2)} ${unidades[indice]}`;
  }
}