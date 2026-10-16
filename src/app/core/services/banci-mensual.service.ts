import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../constants/api-endpoints.constants';
import { BanciEnvio, BanciLibro, BanciOpciones, BanciValidacion } from '../models/banci-mensual.models';

@Injectable({ providedIn: 'root' })
export class BanciMensualService
{
    private readonly http = inject(HttpClient);
    private readonly url = `${API_BASE_URL}/banci/mensual`;
    opciones()
    {
        return this.http.get<BanciOpciones>(`${this.url}/opciones`);
    }
    precarga(entidad: number, mes: number, anio: number, actualizacion: boolean, manual = false)
    {
        return this.http.get<BanciLibro>(`${this.url}/precarga`, { params: { entidad, mes, anio, actualizacion, manual } });
    }
    plantilla(entidad: number, mes: number, anio: number, actualizacion: boolean, manual = false)
    {
        return this.http.get(`${this.url}/plantilla`, { params: { entidad, mes, anio, actualizacion, manual }, responseType: 'blob' });
    }
    validarManual(libro: BanciLibro)
    {
        return this.http.post<BanciValidacion>(`${this.url}/validar/manual`, libro);
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
    configuracion(clave: string, habilitado: boolean, version: number, motivo: string)
    {
        return this.http.put(`${this.url}/configuracion`, { clave, habilitado, version, motivo });
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
