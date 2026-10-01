import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { BanciActualizacionVictima } from '../models/banci-actualizacion.models';
import { SessionService } from './session.service';
import { ErrorCruce, mostrarTablaCruce, textoHtml } from '../utils/banci-cruce-tabla';
export type ModuloCruce = 'mensual' | 'federal';
interface ResultadoCruce { activo: boolean; puedeActualizar: boolean; motivo?: string; victimas: BanciActualizacionVictima[]; }
@Injectable({ providedIn: 'root' })
export class BanciCruceService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly session = inject(SessionService);
  private url(referencia: string, modulo: ModuloCruce): string { return `${API_BASE_URL}/banci/cruce/${modulo}/${encodeURIComponent(referencia)}`; }
  consultar(referencia: string, modulo: ModuloCruce = 'mensual') { return this.http.get<ResultadoCruce>(this.url(referencia, modulo)); }
  plantilla(referencia: string, modulo: ModuloCruce = 'mensual', entidad?: number | null) { return this.http.get(`${this.url(referencia, modulo)}/plantilla${entidad ? '?entidad=' + entidad : ''}`, { observe: 'response', responseType: 'blob' }); }
  async ofrecer(referencia: string, modulo: ModuloCruce = 'mensual'): Promise<boolean> {
    try {
      const datos = await firstValueFrom(this.http.post<ResultadoCruce>(`${this.url(referencia, modulo)}/preparar`, {}));
      if (!datos.activo || (!datos.victimas.length && !datos.motivo)) return true;
      if (!datos.puedeActualizar) {
        const aviso = await Swal.fire({ icon: 'info', title: 'Actualización BANCI opcional', text: datos.motivo, showCancelButton: true, confirmButtonText: 'Omitir actualización y continuar', cancelButtonText: 'Volver' });
        return aviso.isConfirmed;
      }
      if (!datos.victimas.length) return true;
      while (true) {
        const decision = await Swal.fire({ title: 'Actualizar datos BANCI', text: `El cruce coincide. Puede actualizar datos personales o de localización de ${datos.victimas.length} víctimas antes de aceptar o rechazar la carga. La actualización es opcional.`, showDenyButton: true, showCancelButton: true, allowOutsideClick: false, allowEscapeKey: false, confirmButtonText: 'Actualización manual', denyButtonText: 'Actualización masiva', cancelButtonText: 'Omitir actualización y continuar' });
        if (decision.isDismissed) return true;
        const ruta = this.router.serializeUrl(this.router.createUrlTree(['/banci/actualizacion',decision.isConfirmed ? 'manual' : 'masiva'],{ queryParams: { cruce: referencia, moduloCruce: modulo, integrado: 1 } }));
        const enlace = this.location.prepareExternalUrl(ruta);
        const regreso = await Swal.fire({
          title: 'Actualización BANCI opcional', width: '96vw',
          html: `<p>Solo se guardan los cambios que confirme en BANCI. La carga continúa pendiente.</p><iframe id="banci-cruce-integrado" title="Actualizar víctimas BANCI" src="${textoHtml(enlace)}" style="width:100%;height:70vh;border:0;text-align:left"></iframe>`,
          allowOutsideClick: false, allowEscapeKey: false,
          showLoaderOnConfirm: true, showLoaderOnDeny: true, showDenyButton: true, confirmButtonText: 'Continuar a aceptar/rechazar', denyButtonText: 'Cambiar modalidad',
          preConfirm: () => this.comprobarSalida(), preDeny: () => this.comprobarSalida(),
        });
        this.session.seleccionarModulo(modulo === 'federal' ? 'FEDERAL' : 'MENSUAL');
        if (regreso.isConfirmed) return true;
      }
    } catch (error: unknown) {
      const detalle = error as { error?: { errores?: ErrorCruce[]; mensaje?: string } };
      if (detalle.error?.errores?.some(e => e.codigo.startsWith('BANCI_'))) await this.mostrarBloqueo(detalle.error.errores, modulo);
      else await Swal.fire({ icon: 'error', title: 'No se pudo preparar el cruce BANCI', text: detalle.error?.mensaje || 'La carga sigue pendiente. Reintente antes de aceptar o rechazar.' });
      return false;
    }
  }
  private comprobarSalida(): Promise<boolean> {
    const marco = Swal.getHtmlContainer()?.querySelector<HTMLIFrameElement>('#banci-cruce-integrado');
    const destino = marco?.contentWindow;
    if (!destino) return Promise.resolve(false);
    return new Promise(resolve => {
      const solicitud = crypto.randomUUID();
      const finalizar = (permitido: boolean, mensaje?: string) => {
        clearTimeout(temporizador);
        window.removeEventListener('message', recibir);
        if (!permitido) Swal.showValidationMessage(mensaje || 'Confirme o rechace la actualización BANCI pendiente antes de continuar.');
        resolve(permitido);
      };
      const recibir = (evento: MessageEvent) => {
        if (evento.origin !== window.location.origin || evento.source !== destino || evento.data?.tipo !== 'BANCI_SALIDA' || evento.data?.solicitud !== solicitud) return;
        finalizar(evento.data.permitido === true, evento.data.mensaje);
      };
      const temporizador = setTimeout(() => finalizar(false, 'La pantalla BANCI no responde. La carga sigue pendiente; puede recuperarla al recargar la página.'), 5000);
      window.addEventListener('message', recibir);
      destino.postMessage({ tipo: 'BANCI_COMPROBAR_SALIDA', solicitud }, window.location.origin);
    });
  }
  async mostrarBloqueo(errores: ErrorCruce[], modulo: ModuloCruce = 'mensual'): Promise<void> {
    const acceso = this.session.modulos().some(m => m.clave === 'BANCI');
    if (await mostrarTablaCruce(errores, acceso, modulo)) await this.router.navigateByUrl('/banci');
  }
}
