import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { BanciEnvio, BanciLibro, BanciOpciones, BanciValidacion, BanciPeriodo, BanciReporteCarga, BanciArchivoOriginal, BanciPendiente, BanciRevisionAdministracion } from '../models/banci-mensual.models';

@Injectable({ providedIn: 'root' })
export class BanciMensualService
{
    private readonly http = inject(HttpClient);
    private readonly url = `${API_BASE_URL}/banci/mensual`;
    pendientesAdministracion() { return this.http.get<BanciPendiente[]>(`${this.url}/administracion/pendientes`); }
    revisionAdministracion(referencia: string) { return this.http.get<BanciRevisionAdministracion>(`${this.url}/administracion/${referencia}/revision`); }
    periodosCargas() { return this.http.get<BanciPeriodo[]>(`${this.url}/reportes/cargas/periodos`); }
    reporteCargas(anio: number, mes: number) { return this.http.get<BanciReporteCarga[]>(`${this.url}/reportes/cargas`, { params: { anio, mes } }); }
    ultimosOriginales() { return this.http.get<BanciArchivoOriginal[]>(`${this.url}/reportes/originales`); }
    originalZip(referencia: string) { return this.http.get(`${this.url}/reportes/originales/${referencia}/zip`, { responseType: 'blob' }); }
    periodosEnvios()
    {
        return this.http.get<BanciPeriodo[]>(`${this.url}/envios/periodos`);
    }
    acusesEnvios(anio: number, mes: number)
    {
        return this.http.get(`${this.url}/envios/acuses`, { params: { anio, mes }, responseType: 'blob' });
    }
    opciones()
    {
        return this.http.get<BanciOpciones>(`${this.url}/opciones`);
    }
    precarga(entidad: number, mes: number, anio: number, actualizacion: boolean)
    {
        return this.http.get<BanciLibro>(`${this.url}/precarga`, { params: { entidad, mes, anio, actualizacion } });
    }
    plantilla(entidad: number, mes: number, anio: number, actualizacion: boolean)
    {
        return this.http.get(`${this.url}/plantilla`, { params: { entidad, mes, anio, actualizacion }, responseType: 'blob' });
    }
    validarArchivo(archivo: File, libro: BanciLibro)
    {
        const datos = new FormData();
        datos.append('archivo', archivo);
        for(const campo of ['entidad', 'mes', 'anio', 'actualizacion'] as const) datos.append(campo, String(libro[campo]));
        return this.http.post<BanciValidacion>(`${this.url}/validar/archivo`, datos);
    }
    listar(anio: number, reporte: string)
    {
        return this.http.get<BanciEnvio[]>(`${this.url}/${reporte}`, { params: { anio } });
    }
    detalle(referencia: string)
    {
        return this.http.get<BanciLibro>(`${this.url}/envios/${referencia}`);
    }
    resolver(referencia: string, aceptar: boolean, motivo: string, administracion: boolean)
    {
        return this.http.post<{ estado: string }>(`${this.url}/envios/${referencia}/${administracion ? 'resolver' : 'confirmar'}`, {
            aceptar,
            motivo,
        });
    }
    acuse(referencia: string)
    {
        return this.http.get(`${this.url}/envios/${referencia}/acuse`, { responseType: 'blob' });
    }
    original(referencia: string)
    {
        return this.http.get(`${this.url}/envios/${referencia}/original`, { responseType: 'blob' });
    }

}
// La URL se revoca después de iniciar la descarga; no se conserva el libro en memoria.
export function descargarBanci(blob: Blob, nombre: string): void
{
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
