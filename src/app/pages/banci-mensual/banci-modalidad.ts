import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
    selector: 'app-banci-modalidad',
    imports: [RouterLink],
    template: `
        <div class="banci-page">
            <section class="page-heading"><div><h1>{{ actualizacion ? 'Actualización mensual' : 'Carga mensual' }}</h1><p>Seleccione cómo desea reportar la información BANCI.</p></div></section>
            <section class="panel">
                <h2>Modalidad de captura</h2>
                <div class="acciones">
                    <a class="btn btn-primary" [routerLink]="actualizacion ? '/banci/actualizacion/manual' : '/banci/formulario'"><i class="fa-solid fa-pen-to-square"></i> Manual</a>
                    <a class="btn btn-primary" [routerLink]="actualizacion ? '/banci/actualizacion/masiva' : '/banci/carga-masiva'"><i class="fa-solid fa-file-excel"></i> Masiva</a>
                </div>
            </section>
        </div>
    `,
    styleUrl: './banci-mensual.css',
})
export class BanciModalidad
{
    readonly actualizacion = inject(ActivatedRoute).snapshot.data['actualizacion'] === true;
}
