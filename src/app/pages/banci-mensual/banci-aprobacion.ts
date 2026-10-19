import { Component, ChangeDetectorRef, computed, inject, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';
import { BanciPendiente, BanciRevisionAdministracion } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { DiferenciasAdministracionService } from '../../core/services/diferencias-administracion.service';
import { obtenerMensajeErrorHttpAsync } from '../../core/utils/http-error.utils';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { nombreCampo } from './banci-campos';

@Component({
    selector: 'app-banci-aprobacion', imports: [DatePipe, FormsModule],
    templateUrl: './banci-aprobacion.html',
    styleUrls: ['../aprobacion-cargas/aprobacion-cargas.css', './banci-aprobacion.css'],
})
export class BanciAprobacion implements OnDestroy
{
    private readonly api = inject(BanciMensualService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly diferencias = inject(DiferenciasAdministracionService);
    private readonly sanitizer = inject(DomSanitizer);
    readonly filas = signal<BanciPendiente[]>([]);
    readonly seleccion = signal<BanciPendiente | null>(null);
    readonly revision = signal<BanciRevisionAdministracion | null>(null);
    readonly ocupado = signal(false);
    readonly accion = signal('');
    readonly mensaje = signal('');
    readonly busqueda = signal('');
    readonly pagina = signal(1);
    readonly campo = signal('fecha');
    readonly ascendente = signal(true);
    readonly mostrarCambios = signal(false);
    readonly acuseUrl = signal<SafeResourceUrl | null>(null);
    private acuseObjectUrl: string | null = null;
    readonly nombreCampo = nombreCampo;
    readonly columnas = [ { campo: 'entidadNombre', titulo: 'Entidad federativa' }, { campo: 'periodo', titulo: 'Periodo' }, { campo: 'tipo', titulo: 'Tipo' }, { campo: 'nombreUsuario', titulo: 'Usuario que envió' }, { campo: 'fecha', titulo: 'Fecha de envío' } ];
    readonly filtradas = computed(() =>
    {
        const texto = this.busqueda().trim().toLocaleLowerCase('es');
        const valor = (f: BanciPendiente): unknown => this.campo() === 'periodo' ? f.anio * 100 + f.mes : f[this.campo() as keyof BanciPendiente];
        return this.filas().filter(f => [f.entidadNombre, this.periodo(f), f.nombreUsuario, this.tipo(f)].join(' ').toLocaleLowerCase('es').includes(texto))
            .sort((a, b) => String(valor(a) ?? '').localeCompare(String(valor(b) ?? ''), 'es', { numeric: true }) * (this.ascendente() ? 1 : -1));
    });
    readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / 20)));
    readonly visibles = computed(() => this.filtradas().slice((this.pagina() - 1) * 20, this.pagina() * 20));
    readonly muestraVictimas = computed(() =>
    {
        const grupos = new Map<string, { carpeta: string; delito: string; victima: string; cambios: NonNullable<BanciRevisionAdministracion['libro']['cambios']> }>();
        for(const cambio of this.revision()?.libro.cambios ?? [])
        {
            const clave = JSON.stringify([cambio.carpeta, cambio.delito, cambio.victima]);
            const grupo = grupos.get(clave) ?? { carpeta: cambio.carpeta, delito: cambio.delito, victima: cambio.victima, cambios: [] };
            grupo.cambios.push(cambio); grupos.set(clave, grupo);
        }
        return [...grupos.values()];
    });
    constructor() { this.actualizar(); }
    periodo(f: { anio: number; mes: number }): string { return new Date(f.anio, f.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); }
    tipo(f: BanciPendiente): string { return `${f.tipo === 'ACTUALIZACION' ? 'Actualización' : 'Carga'} ${f.manual ? 'manual' : 'masiva'}`; }
    buscar(texto: string): void { this.busqueda.set(texto); this.pagina.set(1); }
    ordenar(campo: string): void { this.ascendente.set(this.campo() === campo ? !this.ascendente() : true); this.campo.set(campo); this.pagina.set(1); }
    icono(campo: string): string { return this.campo() !== campo ? 'fa-sort' : this.ascendente() ? 'fa-sort-up' : 'fa-sort-down'; }
    actualizar(): void
    {
        if(this.ocupado()) return;
        this.ocupado.set(true); this.accion.set('lista'); this.mensaje.set(''); this.cerrarDetalle();
        this.api.pendientesAdministracion().pipe(finalize(() => { this.ocupado.set(false); this.accion.set(''); })).subscribe({
            next: filas => { this.filas.set(filas); this.pagina.set(1); }, error: e => this.error(e),
        });
    }
    cerrarDetalle(): void { this.seleccion.set(null); this.revision.set(null); this.mostrarCambios.set(false); }
    revisar(fila: BanciPendiente): void
    {
        if(this.ocupado()) return;
        this.cerrarDetalle(); this.mensaje.set(''); this.ocupado.set(true); this.accion.set(fila.referencia);
        this.api.revisionAdministracion(fila.referencia).pipe(finalize(() => { this.ocupado.set(false); this.accion.set(''); })).subscribe({
            next: revision =>
            {
                this.seleccion.set(fila); this.revision.set(revision);
                this.cdr.detectChanges();
                requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('resolucion-carga-banci')?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })));
            }, error: e => this.error(e),
        });
    }
    descargarDiferencias(): void
    {
        const fila = this.seleccion(); if(!fila || fila.tipo !== 'ACTUALIZACION' || this.ocupado()) return;
        this.ocupado.set(true); this.accion.set('diferencias');
        this.diferencias.descargar('banci', fila.referencia).pipe(finalize(() => { this.ocupado.set(false); this.accion.set(''); })).subscribe({
            next: blob => descargarBanci(blob, 'Diferencias_banci.xlsx'), error: e => this.error(e),
        });
    }
    original(): void
    {
        const fila = this.seleccion(); if(!fila || fila.manual || !fila.tieneOriginal || !fila.nombreOriginal || this.ocupado()) return;
        this.ocupado.set(true);
        this.api.original(fila.referencia).pipe(finalize(() => this.ocupado.set(false))).subscribe({
            next: blob => descargarBanci(blob, fila.nombreOriginal!), error: e => this.error(e),
        });
    }
    acuse(): void
    {
        const fila = this.seleccion(); if(!fila || this.ocupado()) return;
        this.ocupado.set(true);
        this.api.acuse(fila.referencia).pipe(finalize(() => this.ocupado.set(false))).subscribe({
            next: blob => { const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl); this.acuseObjectUrl = pdf.objectUrl; this.acuseUrl.set(pdf.safeUrl); },
            error: e => this.error(e),
        });
    }
    cerrarAcuse(): void { revocarObjectUrl(this.acuseObjectUrl); this.acuseObjectUrl = null; this.acuseUrl.set(null); }
    ngOnDestroy(): void { this.cerrarAcuse(); }
    async resolver(aceptar: boolean): Promise<void>
    {
        const fila = this.seleccion(); if(!fila || this.ocupado()) return;
        this.ocupado.set(true);
        try
        {
            const respuesta = await Swal.fire(aceptar ? {
                icon: 'warning', title: 'Aprobar carga BANCI', text: `Se incorporará la información de ${fila.entidadNombre}, correspondiente a ${this.periodo(fila)}.`,
                showCancelButton: true, confirmButtonText: 'Aprobar carga', cancelButtonText: 'Cancelar', confirmButtonColor: '#6f2c91',
            } : {
                icon: 'warning', title: 'Rechazar carga BANCI', text: `${fila.entidadNombre} — ${this.periodo(fila)}`,
                input: 'textarea', inputLabel: 'Motivo del rechazo', inputPlaceholder: 'Describa las correcciones que debe realizar el enlace...',
                inputAttributes: { maxlength: '2000', 'aria-label': 'Motivo del rechazo' }, showCancelButton: true,
                confirmButtonText: 'Rechazar carga', cancelButtonText: 'Cancelar', confirmButtonColor: '#6f2c91',
                inputValidator: (valor: string) => valor?.trim().length >= 5 ? undefined : 'Capture un motivo de al menos 5 caracteres.',
            });
            const motivo = aceptar ? '' : String(respuesta.value ?? '').trim();
            if(!respuesta.isConfirmed || (!aceptar && motivo.length < 5)) { this.ocupado.set(false); return; }
            void Swal.fire({ title: aceptar ? 'Aprobando carga' : 'Rechazando carga', text: 'Espere mientras se procesa la solicitud. Puede tardar si contiene muchos registros.', allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
            this.api.resolver(fila.referencia, aceptar, motivo, true).subscribe({
                next: () =>
                {
                    Swal.close(); this.ocupado.set(false); this.actualizar();
                    void Swal.fire({ icon: 'success', title: aceptar ? 'Carga aprobada' : 'Carga rechazada', text: aceptar ? 'La información se incorporó correctamente.' : 'El enlace podrá consultar el motivo del rechazo.', confirmButtonColor: '#6f2c91' });
                },
                error: e => { Swal.close(); this.ocupado.set(false); void this.error(e); },
            });
        }
        catch(e) { this.ocupado.set(false); await this.error(e); }
    }
    private async error(e: unknown): Promise<void> { this.mensaje.set(await obtenerMensajeErrorHttpAsync(e)); }
}
