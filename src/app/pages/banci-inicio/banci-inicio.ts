import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/constants/api-endpoints.constants';
@Component({ selector: 'app-banci-inicio', templateUrl: './banci-inicio.html', styleUrl: './banci-inicio.css' })
export class BanciInicio
{
    readonly instalado = signal<boolean | null>(null);
    readonly error = signal('');
    constructor()
    {
        inject(HttpClient)
            .get<{ instalado: boolean }>(`${API_BASE_URL}/banci/modelo`)
            .subscribe({
                next: (estado) => this.instalado.set(estado.instalado),
                error: () => this.error.set('No fue posible consultar la disponibilidad de BANCI.'),
            });
    }
}
