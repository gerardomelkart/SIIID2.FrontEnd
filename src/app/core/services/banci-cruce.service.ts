import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { BanciActualizacionVictima } from '../models/banci-actualizacion.models';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class BanciCruceService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private url(referencia: string): string { return `${API_BASE_URL}/banci/cruce/mensual/${encodeURIComponent(referencia)}`; }
  consultar(referencia: string) { return this.http.get<{ victimas: BanciActualizacionVictima[] }>(this.url(referencia)); }
  plantilla(referencia: string) { return this.http.get(`${this.url(referencia)}/plantilla`, { observe: 'response', responseType: 'blob' }); }
  async ofrecer(referencia: string): Promise<void> {
    try {
      const datos = await firstValueFrom(this.consultar(referencia));
      if (!datos.victimas.length) return;
      const decision = await Swal.fire({
        title: 'Actualización opcional de BANCI',
        text: `El Consolidado ya está integrado. Puede actualizar los datos personales o de localización de ${datos.victimas.length} víctimas relacionadas. ¿Cómo desea hacerlo?`,
        showDenyButton: true, showCancelButton: true,
        confirmButtonText: 'Actualización manual', denyButtonText: 'Actualización masiva', cancelButtonText: 'Omitir actualización'
      });
      if (decision.isConfirmed || decision.isDenied)
        await this.router.navigate(['/banci/actualizacion', decision.isConfirmed ? 'manual' : 'masiva'], { queryParams: { cruce: referencia } });
    } catch {
      await Swal.fire({ icon: 'info', title: 'Consolidado integrado', text: 'No fue posible consultar la actualización opcional. Puede actualizar los datos posteriormente desde BANCI.' });
    }
  }
  async mostrarBloqueo(errores: { codigo: string; mensaje: string }[]): Promise<void> {
    const cruce = errores.filter(e => e.codigo.startsWith('BANCI_'));
    if (!cruce.length) return;
    const acceso = this.session.modulos().some(m => m.clave === 'BANCI');
    const decision = await Swal.fire({ icon: 'error', title: 'Carga detenida por el cruce con BANCI', text: cruce.map(e => e.mensaje).join('\n') + (acceso ? '' : '\nSolicite a un usuario autorizado registrar o corregir la información en BANCI.'), showCancelButton: acceso, confirmButtonText: acceso ? 'Ir a BANCI' : 'Revisar diferencias', cancelButtonText: 'Revisar diferencias' });
    if (acceso && decision.isConfirmed) await this.router.navigateByUrl('/banci');
  }
}
