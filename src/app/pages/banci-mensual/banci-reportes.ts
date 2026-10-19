import { DiferenciasAdministracionService } from '../../core/services/diferencias-administracion.service';
import { nombreCampo } from './banci-campos';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { BanciEnvio, BanciLibro } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { obtenerMensajeErrorHttp, obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { confirmarAccion } from '../../core/utils/alert.utils';

@Component({
    selector: 'app-banci-reportes',
    imports: [FormsModule, DatePipe],
    templateUrl: './banci-reportes.html',
    styleUrl: './banci-mensual.css',
})
export class BanciReportes implements OnDestroy
{
    private readonly diferenciasExcel = inject(DiferenciasAdministracionService);
    readonly descargandoDiferencias = signal(false);
    descargarTodasDiferencias(): void
    {
        const referencia = this.seleccion()?.referencia;
        if(this.reporte !== 'pendientes' || !referencia || this.descargandoDiferencias() || this.ocupado()) return;
        this.descargandoDiferencias.set(true);
        this.diferenciasExcel.descargar('banci', referencia).pipe(finalize(() => this.descargandoDiferencias.set(false))).subscribe({
            next: archivo => descargarBanci(archivo, 'Diferencias_banci.xlsx'),
            error: async error => this.mensaje.set(await obtenerMensajeErrorHttpAsync(error, 'No fue posible descargar las diferencias. Intente nuevamente.')),
        });
    }
    private readonly sanitizer = inject(DomSanitizer);
    readonly acuseUrl = signal<SafeResourceUrl | null>(null);
    private acuseObjectUrl: string | null = null;
    cerrarAcuse(): void
    {
        revocarObjectUrl(this.acuseObjectUrl);
        this.acuseObjectUrl = null;
        this.acuseUrl.set(null);
    }
    ngOnDestroy(): void
    {
        this.cerrarAcuse();
    }
    readonly nombreCampo = nombreCampo;
    private readonly api = inject(BanciMensualService);
    readonly reporte: string = inject(ActivatedRoute).snapshot.data['reporte'];
    readonly titulo = (
        {
            envios: 'Consulta de envíos',
            cargas: 'Reporte de cargas',
            originales: 'Archivos originales',
            pendientes: 'Aprobación administrativa',
        } as Record<string, string>
    )[this.reporte];
    readonly filas = signal<BanciEnvio[]>([]);
    readonly detalle = signal<BanciLibro | null>(null);
    readonly seleccion = signal<BanciEnvio | null>(null);
    readonly mensaje = signal('');
    readonly ocupado = signal(false);
    anio = new Date().getFullYear();
    mes = 0;
    pagina = 1;
    motivo = '';
    grupo: 'carpetas' | 'delitos' | 'victimas' = 'carpetas';
    campoOrden: keyof BanciEnvio = 'fecha';
    ascendente = false;
    constructor()
    {
        this.consultar();
    }
    consultar(): void
    {
        this.ocupado.set(true);
        this.mensaje.set('');
        this.detalle.set(null);
        this.seleccion.set(null);
        this.pagina = 1;
        this.api
            .listar(this.anio, this.reporte)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({ next: (filas) => this.filas.set(filas), error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)) });
    }
    filtradas(): BanciEnvio[]
    {
        const orden = this.ascendente ? 1 : -1;
        return this.filas()
            .filter((f) => !this.mes || f.mes === Number(this.mes))
            .sort(
                (a, b) => String(a[this.campoOrden] ?? '').localeCompare(String(b[this.campoOrden] ?? ''), 'es', { numeric: true }) * orden,
            );
    }
    visibles(): BanciEnvio[]
    {
        return this.filtradas().slice((this.pagina - 1) * 20, this.pagina * 20);
    }
    ordenar(campo: keyof BanciEnvio): void
    {
        this.ascendente = this.campoOrden === campo ? !this.ascendente : true;
        this.campoOrden = campo;
        this.pagina = 1;
    }
    ver(fila: BanciEnvio): void
    {
        this.ocupado.set(true);
        this.motivo = '';
        this.api
            .detalle(fila.referencia)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (detalle) =>
                {
                    this.seleccion.set(fila);
                    this.detalle.set(detalle);
                    setTimeout(() => document.getElementById('banci-detalle')?.scrollIntoView({ behavior: 'smooth' }));
                },
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
            });
    }
    columnas(): string[]
    {
        return [...new Set(this.detalle()?.[this.grupo].flatMap((f) => Object.keys(f.columnas)) ?? [])];
    }
    descargar(fila: BanciEnvio): void
    {
        this.ocupado.set(true);
        this.api
            .original(fila.referencia)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (blob) => descargarBanci(blob, `BANCI_${fila.anio}${String(fila.mes).padStart(2, '0')}_${fila.referencia}.xlsx`),
                error: () =>
                    this.mensaje.set('No fue posible descargar el original. Verifique la conservación de archivos en este ambiente.'),
            });
    }
    acuse(fila: BanciEnvio): void
    {
        this.ocupado.set(true);
        this.api
            .acuse(fila.referencia)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (blob) =>
                {
                    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl);
                    this.acuseObjectUrl = pdf.objectUrl;
                    this.acuseUrl.set(pdf.safeUrl);
                },
                error: () => this.mensaje.set('No fue posible descargar el acuse BANCI.'),
            });
    }
    exportar(): void
    {
        void exportarFilasExcel(
            this.filtradas().map((f) => ({
                Entidad: f.entidadNombre,
                Año: f.anio,
                Mes: f.mes,
                Usuario: f.nombreUsuario,
                Tipo: f.tipo,
                Estado: f.estado,
                Fecha: f.fecha,
                Motivo: f.motivo,
                Referencia: f.referencia,
            })),
            'BANCI_envios.xlsx',
        );
    }
    async resolver(aceptar: boolean): Promise<void>
    {
        const fila = this.seleccion();
        if(!fila) return;
        if(!aceptar && !this.motivo.trim())
        {
            this.mensaje.set('Indique el motivo del rechazo.');
            return;
        }
        const confirmacion = await confirmarAccion(
            aceptar ? 'Aprobar carga BANCI' : 'Rechazar carga BANCI',
            aceptar ? 'Los datos se integrarán al corte correspondiente.' : 'El envío será rechazado con el motivo indicado.',
            aceptar ? 'Aprobar' : 'Rechazar',
        );
        if(!confirmacion.isConfirmed) return;
        this.ocupado.set(true);
        this.api
            .resolver(fila.referencia, aceptar, this.motivo, true)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({ next: () => this.consultar(), error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)) });
    }
}
