import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { defer, finalize } from 'rxjs';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../constants/api-endpoints.constants';

@Injectable({ providedIn: 'root' })
export class DiferenciasAdministracionService
{
    private readonly http = inject(HttpClient);

    descargar(modulo: 'mensual' | 'federal' | 'semanal' | 'banci', referencia: string)
    {
        return defer(() =>
        {
            const color = { mensual: '#691c32', federal: '#1f4e79', semanal: '#235b4e', banci: '#6f2c91' }[modulo];
            void Swal.fire({
                title: 'Generando Excel de diferencias',
                text: 'Esta descarga puede tardar varios minutos si hay muchas modificaciones. Espere a que termine.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false,
                showConfirmButton: false,
                loaderHtml: `<i class="fa-solid fa-spinner fa-spin" style="color:${color};font-size:2rem" aria-hidden="true"></i>`,
                didOpen: () => Swal.showLoading(),
            });
            return this.http.get(`${API_BASE_URL}/administracion/diferencias/${modulo}/${encodeURIComponent(referencia)}/excel`, { responseType: 'blob' })
                .pipe(finalize(() => Swal.close()));
        });
    }
}
