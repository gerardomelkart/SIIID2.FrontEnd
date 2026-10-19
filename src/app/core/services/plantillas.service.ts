import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { ArchivoCargaTipo } from '../types/archivo-carga.types';
import { obtenerMensajeErrorHttpAsync } from '../utils/http-error.utils';
import { mostrarError } from '../utils/alert.utils';

export type ModuloPlantilla = 'mensual' | 'federal' | 'semanal';

@Injectable({ providedIn: 'root' })
export class PlantillasService
{
    private readonly http = inject(HttpClient);
    readonly descargando = signal<string | null>(null);

    descargar(modulo: ModuloPlantilla, archivo: ArchivoCargaTipo): void
    {
        if(this.descargando()) return;
        this.descargando.set(`${modulo}/${archivo}`);
        this.http.get(`${API_BASE_URL}/plantillas/${modulo}/${archivo}`, { responseType: 'blob' })
            .pipe(finalize(() => this.descargando.set(null))).subscribe({
                next: blob =>
                {
                    const url = URL.createObjectURL(blob);
                    const enlace = document.createElement('a');
                    enlace.href = url;
                    enlace.download = `${archivo}.xlsx`;
                    enlace.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                },
                error: async error => mostrarError('No fue posible descargar la plantilla', await obtenerMensajeErrorHttpAsync(error, 'Intente nuevamente.')),
            });
    }
}
