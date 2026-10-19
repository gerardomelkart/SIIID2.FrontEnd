import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { BanciArchivoOriginal, BanciPeriodo, BanciReporteCarga } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';

type Fila = BanciReporteCarga | BanciArchivoOriginal;

@Component({
    selector: 'app-banci-informes', imports: [FormsModule, DatePipe],
    templateUrl: './banci-informes.html',
    styleUrls: ['../informes/informes.css', '../originales/originales.css', './banci-envios.css', './banci-informes.css'],
})
export class BanciInformes
{
    private readonly api = inject(BanciMensualService);
    readonly originales = inject(ActivatedRoute).snapshot.data['reporte'] === 'originales';
    readonly titulo = this.originales ? 'Archivos originales' : 'Reporte de cargas';
    readonly columnas = this.originales
        ? [{ campo: 'entidadNombre', titulo: 'Entidad federativa' }, { campo: 'tipo', titulo: 'Último movimiento' }, { campo: 'periodo', titulo: 'Periodo' }, { campo: 'fecha', titulo: 'Fecha guardado' }, { campo: 'nombreOriginal', titulo: 'Archivo' }]
        : [{ campo: 'ranking', titulo: 'Ranking' }, { campo: 'entidadNombre', titulo: 'Entidad federativa' }, { campo: 'entidad', titulo: 'Cve. entidad' }, { campo: 'corte', titulo: 'Periodo' }, { campo: 'intentos', titulo: 'Intentos' }, { campo: 'estado', titulo: 'Estatus' }, { campo: 'fechaCarga', titulo: 'Fecha de carga/actualización' }, { campo: 'fechaAprobacion', titulo: 'Fecha de aprobación' }];
    readonly filas = signal<Fila[]>([]);
    readonly periodos = signal<BanciPeriodo[]>([]);
    readonly corte = signal('');
    readonly busqueda = signal('');
    readonly pagina = signal(1);
    readonly ocupado = signal(false);
    readonly descargando = signal('');
    readonly mensaje = signal('');
    readonly campo = signal(this.originales ? 'entidadNombre' : 'ranking');
    readonly ascendente = signal(true);
    readonly filtradas = computed(() =>
    {
        const texto = this.busqueda().trim().toLocaleLowerCase('es');
        return this.filas().filter(f => !texto || [...Object.values(f), 'estado' in f ? this.estadoTexto(f.estado) : this.tipoTexto(f.tipo)].join(' ').toLocaleLowerCase('es').includes(texto))
            .sort((a, b) =>
            {
                const valor = (f: Fila) =>
                {
                    if(this.campo() === 'periodo' && 'anio' in f) return this.clave(f);
                    const v = (f as unknown as Record<string, unknown>)[this.campo()];
                    return this.campo() === 'ranking' && v == null ? Number.MAX_SAFE_INTEGER : v ?? '';
                };
                return String(valor(a)).localeCompare(String(valor(b)), 'es', { numeric: true }) * (this.ascendente() ? 1 : -1) || a.entidadNombre.localeCompare(b.entidadNombre, 'es');
            });
    });
    readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / 20)));
    readonly cargasVisibles = computed(() => this.filtradas().slice((this.pagina() - 1) * 20, this.pagina() * 20) as BanciReporteCarga[]);
    readonly originalesVisibles = computed(() => this.filtradas().slice((this.pagina() - 1) * 20, this.pagina() * 20) as BanciArchivoOriginal[]);

    constructor() { this.actualizar(); }
    clave(p: BanciPeriodo): string { return `${p.anio}-${String(p.mes).padStart(2, '0')}`; }
    periodo(p?: BanciPeriodo): string
    {
        if(!p) { const [anio, mes] = this.corte().split('-').map(Number); p = { anio, mes }; }
        return p.anio && p.mes ? new Date(p.anio, p.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : '—';
    }
    claveEntidad(f: Fila): string { return String(f.entidad).padStart(2, '0'); }
    tipoTexto(tipo: string): string { return tipo === 'ACTUALIZACION' ? 'Actualización masiva' : 'Carga masiva'; }
    estadoTexto(estado: string): string
    {
        return ({ SIN_CARGA: 'Sin carga', VALIDADO: 'Validado, sin enviar', PENDIENTE_APROBACION: 'Pendiente de aprobación', CONFIRMADO: 'Confirmado', CONFIRMADO_ACTUALIZACION: 'Actualización confirmada', RECHAZADO_ADMIN: 'Rechazado por administrador', RECHAZADO_USUARIO: 'Descartado por el usuario' } as Record<string, string>)[estado] ?? estado.replaceAll('_', ' ');
    }
    tamanio(bytes: number): string { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
    buscar(texto: string): void { this.busqueda.set(texto); this.pagina.set(1); }
    ordenar(campo: string): void { this.ascendente.set(this.campo() === campo ? !this.ascendente() : true); this.campo.set(campo); this.pagina.set(1); }
    icono(campo: string): string { return this.campo() === campo ? (this.ascendente() ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down') : 'fa-solid fa-sort'; }
    actualizar(): void
    {
        if(this.ocupado()) return;
        this.ocupado.set(true); this.mensaje.set(''); this.pagina.set(1);
        if(this.originales)
        {
            this.api.ultimosOriginales().pipe(finalize(() => this.ocupado.set(false))).subscribe({ next: filas => this.filas.set(filas), error: error => this.error(error) });
            return;
        }
        this.api.periodosCargas().subscribe({
            next: periodos =>
            {
                this.periodos.set(periodos);
                if(!periodos.some(p => this.clave(p) === this.corte())) this.corte.set(periodos.length ? this.clave(periodos[0]) : '');
                if(this.corte()) this.cambiarCorte(); else { this.filas.set([]); this.ocupado.set(false); }
            },
            error: error => { this.ocupado.set(false); void this.error(error); },
        });
    }
    cambiarCorte(): void
    {
        const [anio, mes] = this.corte().split('-').map(Number);
        this.ocupado.set(true); this.mensaje.set(''); this.pagina.set(1); this.filas.set([]);
        this.api.reporteCargas(anio, mes).pipe(finalize(() => this.ocupado.set(false))).subscribe({ next: filas => this.filas.set(filas), error: error => this.error(error) });
    }
    descargar(fila: BanciArchivoOriginal, zip: boolean): void
    {
        if(this.ocupado()) return;
        this.ocupado.set(true); this.descargando.set(fila.referencia);
        (zip ? this.api.originalZip(fila.referencia) : this.api.original(fila.referencia))
            .pipe(finalize(() => { this.ocupado.set(false); this.descargando.set(''); })).subscribe({
                next: blob => descargarBanci(blob, zip ? `BANCI_original_${this.claveEntidad(fila)}.zip` : fila.nombreOriginal),
                error: error => this.error(error),
            });
    }
    async exportar(): Promise<void>
    {
        if(this.ocupado() || !this.filtradas().length) return;
        this.ocupado.set(true);
        try
        {
            const datos = this.filtradas().map(f => 'intentos' in f
                ? { Ranking: f.ranking ?? '', Entidad: f.entidadNombre, 'Cve. entidad': this.claveEntidad(f), Periodo: this.periodo(), Intentos: f.intentos, Estatus: this.estadoTexto(f.estado), 'Fecha de carga/actualización': f.fechaCarga ?? '', 'Fecha de aprobación': f.fechaAprobacion ?? '' }
                : { Entidad: f.entidadNombre, 'Cve. entidad': this.claveEntidad(f), Movimiento: this.tipoTexto(f.tipo), Periodo: this.periodo(f), 'Fecha guardado': f.fecha, Archivo: f.nombreOriginal, 'Tamaño bytes': f.tamanioBytes, SHA256: f.sha256 });
            await exportarFilasExcel(datos, `BANCI_${this.originales ? 'originales' : 'cargas'}.xlsx`);
        }
        catch { this.mensaje.set('No fue posible exportar el reporte. Intente nuevamente.'); }
        finally { this.ocupado.set(false); }
    }
    private async error(error: unknown): Promise<void> { this.mensaje.set(await obtenerMensajeErrorHttpAsync(error)); }
}
