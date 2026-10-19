import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { BanciEnvio, BanciPeriodo } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { SessionService } from '../../core/services/session.service';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';

@Component({
    selector: 'app-banci-envios',
    imports: [FormsModule, DatePipe],
    templateUrl: './banci-envios.html',
    styleUrls: ['../informes/informes.css', './banci-mensual.css', './banci-envios.css'],
})
export class BanciEnvios implements OnDestroy
{
    private readonly api = inject(BanciMensualService);
    private readonly sanitizer = inject(DomSanitizer);
    readonly usuario = inject(SessionService).usuario;
    readonly periodos = signal<BanciPeriodo[]>([]);
    readonly corte = signal('');
    readonly filas = signal<BanciEnvio[]>([]);
    readonly busqueda = signal('');
    readonly pagina = signal(1);
    readonly cargando = signal(false);
    readonly accion = signal('');
    readonly mensaje = signal('');
    readonly ocupado = computed(() => this.cargando() || !!this.accion());
    readonly acuseUrl = signal<SafeResourceUrl | null>(null);
    private acuseObjectUrl: string | null = null;
    readonly orden = signal<{ campo: keyof BanciEnvio; asc: boolean }>({ campo: 'entidadNombre', asc: true });
    readonly filtradas = computed(() =>
    {
        const texto = this.busqueda().trim().toLocaleLowerCase('es');
        const { campo, asc } = this.orden();
        return this.filas().filter(f => this.claveCorte(f) === this.corte())
            .filter(f => !texto || [f.entidadNombre, this.claveEntidad(f), this.corteTexto(f), f.nombreUsuario, this.estadoTexto(f), this.tipoTexto(f), new Date(f.fecha).toLocaleString('es-MX')].join(' ').toLocaleLowerCase('es').includes(texto))
            .sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'es', { numeric: true }) * (asc ? 1 : -1));
    });
    readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / 20)));
    readonly visibles = computed(() => this.filtradas().slice((this.pagina() - 1) * 20, this.pagina() * 20));

    constructor() { this.actualizar(); }

    claveCorte(p: BanciPeriodo): string { return `${p.anio}-${String(p.mes).padStart(2, '0')}`; }
    claveEntidad(f: BanciEnvio): string { return String(f.entidad).padStart(2, '0'); }
    corteTexto(p: BanciPeriodo): string
    {
        return new Date(p.anio, p.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    }
    tipoTexto(f: BanciEnvio): string { return `${f.tipo === 'ACTUALIZACION' ? 'Actualización' : 'Carga'} ${f.manual ? 'manual' : 'masiva'}`; }
    estadoTexto(f: BanciEnvio): string
    {
        return ({ PENDIENTE_APROBACION: 'Pendiente de aprobación', CONFIRMADO: 'Confirmado', CONFIRMADO_ACTUALIZACION: 'Actualización confirmada', RECHAZADO_ADMIN: 'Rechazado por administrador' } as Record<string, string>)[f.estado] ?? f.estado.replaceAll('_', ' ');
    }
    tieneAcuse(f: BanciEnvio): boolean { return ['PENDIENTE_APROBACION', 'CONFIRMADO', 'CONFIRMADO_ACTUALIZACION'].includes(f.estado); }
    actualizar(): void
    {
        if(this.ocupado()) return;
        this.cargando.set(true);
        this.mensaje.set('');
        this.api.periodosEnvios().subscribe({
            next: periodos =>
            {
                this.periodos.set(periodos);
                if(!periodos.some(p => this.claveCorte(p) === this.corte())) this.corte.set(periodos.length ? this.claveCorte(periodos[0]) : '');
                if(this.corte()) this.consultarCorte();
                else { this.filas.set([]); this.cargando.set(false); }
            },
            error: async error => { this.cargando.set(false); this.mensaje.set(await obtenerMensajeErrorHttpAsync(error)); },
        });
    }
    consultarCorte(): void
    {
        this.pagina.set(1);
        this.filas.set([]);
        this.mensaje.set('');
        this.cargando.set(true);
        this.api.listar(Number(this.corte().split('-')[0]), 'envios').pipe(finalize(() => this.cargando.set(false))).subscribe({
            next: filas => this.filas.set(filas),
            error: async error => this.mensaje.set(await obtenerMensajeErrorHttpAsync(error)),
        });
    }
    buscar(texto: string): void { this.busqueda.set(texto); this.pagina.set(1); }
    ordenar(campo: keyof BanciEnvio): void
    {
        this.orden.update(o => ({ campo, asc: o.campo === campo ? !o.asc : true }));
        this.pagina.set(1);
    }
    icono(campo: keyof BanciEnvio): string { return this.orden().campo === campo ? (this.orden().asc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down') : 'fa-solid fa-sort'; }
    acuse(fila: BanciEnvio): void
    {
        if(this.ocupado() || !this.tieneAcuse(fila)) return;
        this.accion.set('acuse-' + fila.referencia);
        this.api.acuse(fila.referencia).pipe(finalize(() => this.accion.set(''))).subscribe({
            next: blob =>
            {
                const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl);
                this.acuseObjectUrl = pdf.objectUrl;
                this.acuseUrl.set(pdf.safeUrl);
            },
            error: async error => this.mensaje.set(await obtenerMensajeErrorHttpAsync(error)),
        });
    }
    original(fila: BanciEnvio): void
    {
        if(this.ocupado() || fila.manual || !fila.tieneOriginal) return;
        this.accion.set('original-' + fila.referencia);
        this.api.original(fila.referencia).pipe(finalize(() => this.accion.set(''))).subscribe({
            next: blob => descargarBanci(blob, `BANCI_${this.claveCorte(fila)}_${this.claveEntidad(fila)}.xlsx`),
            error: async error => this.mensaje.set(await obtenerMensajeErrorHttpAsync(error)),
        });
    }
    acuses(): void
    {
        if(this.ocupado() || !this.corte()) return;
        const [anio, mes] = this.corte().split('-').map(Number);
        this.accion.set('acuses');
        this.api.acusesEnvios(anio, mes).pipe(finalize(() => this.accion.set(''))).subscribe({
            next: blob => descargarBanci(blob, `BANCI_acuses_${anio}${String(mes).padStart(2, '0')}.zip`),
            error: async error => this.mensaje.set(await obtenerMensajeErrorHttpAsync(error)),
        });
    }
    async exportar(): Promise<void>
    {
        if(this.ocupado() || !this.filtradas().length) return;
        this.accion.set('excel');
        try
        {
            await exportarFilasExcel(this.filtradas().map(f => ({ 'Entidad federativa': f.entidadNombre, 'Cve. entidad': this.claveEntidad(f), 'Fecha de envío': new Date(f.fecha).toLocaleString('es-MX'), Corte: this.corteTexto(f), 'Usuario envío': f.nombreUsuario, Modalidad: this.tipoTexto(f), Estatus: this.estadoTexto(f), 'Motivo del rechazo': f.motivo ?? '' })), 'BANCI_consulta_envios.xlsx', 'Envios');
        }
        catch { this.mensaje.set('No fue posible exportar la consulta. Intente nuevamente.'); }
        finally { this.accion.set(''); }
    }
    cerrarAcuse(): void { revocarObjectUrl(this.acuseObjectUrl); this.acuseObjectUrl = null; this.acuseUrl.set(null); }
    ngOnDestroy(): void { this.cerrarAcuse(); }
}
