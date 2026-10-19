import { Directive, Input, inject } from '@angular/core';
import { ModuloPlantilla, PlantillasService } from '../services/plantillas.service';
import { ArchivoCargaTipo } from '../types/archivo-carga.types';

@Directive({
    selector: 'a[plantillaModulo]',
    host: {
        href: '#',
        '[attr.aria-busy]': 'servicio.descargando() === plantillaModulo + "/" + plantillaArchivo',
        '[attr.aria-disabled]': '!!servicio.descargando()',
        '(click)': 'descargar($event)',
    },
})
export class PlantillaGeneradaDirective
{
    readonly servicio = inject(PlantillasService);
    @Input({ required: true }) plantillaModulo!: ModuloPlantilla;
    @Input({ required: true }) plantillaArchivo!: ArchivoCargaTipo;

    descargar(evento: Event): void
    {
        evento.preventDefault();
        this.servicio.descargar(this.plantillaModulo, this.plantillaArchivo);
    }
}
