import { Component, OnDestroy, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { HttpErrorResponse } from '@angular/common/http';
import { SessionService } from '../../core/services/session.service';
import { BanciLibro, BanciOpciones, BanciError, BanciValidacion } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';

@Component({
    selector: 'app-banci-captura',
    imports: [FormsModule],
    templateUrl: './banci-captura.html',
    styleUrls: ['./banci-mensual.css', './banci-carga.css'],
})
export class BanciCaptura implements OnDestroy
{
    private readonly sanitizer = inject(DomSanitizer);
    readonly acuseUrl = signal<SafeResourceUrl | null>(null);
    readonly acuseReferencia = signal<string | null>(null);
    readonly cargandoAcuse = signal(false);
    readonly errorAcuse = signal('');
    private acuseObjectUrl: string | null = null;
    ngOnDestroy(): void
    {
        this.cerrarAcuse();
    }
    cerrarAcuse(): void
    {
        revocarObjectUrl(this.acuseObjectUrl);
        this.acuseObjectUrl = null;
        this.acuseUrl.set(null);
        this.acuseReferencia.set(null);
        this.errorAcuse.set('');
    }
    private readonly injector = inject(Injector);
    private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
    private desplazar(id: string, block: ScrollLogicalPosition = 'start'): void
    {
        afterNextRender(() =>
        {
            const panel = this.elemento.nativeElement.querySelector<HTMLElement>(`#${id}`);
            if(!panel) return;
            if(block === 'end')
            {
                // Las observaciones también tienen su propio desplazamiento vertical.
                panel.querySelectorAll<HTMLElement>('.table-scroll').forEach(tabla => tabla.scrollTo({ top: tabla.scrollHeight, behavior: 'smooth' }));
                for(let padre = panel.parentElement; padre; padre = padre.parentElement)
                {
                    if(/auto|scroll/.test(getComputedStyle(padre).overflowY))
                        padre.scrollTo({ top: padre.scrollHeight, behavior: 'smooth' });
                }
                const pagina = document.scrollingElement ?? document.documentElement;
                pagina.scrollTo({ top: pagina.scrollHeight, behavior: 'smooth' });
            }
            else panel.scrollIntoView({ behavior: 'smooth', block });
        }, { injector: this.injector });
    }
    private async mostrarError(error: unknown): Promise<void>
    {
        let datos = error instanceof HttpErrorResponse ? error.error : null;
        if(datos instanceof Blob) { try { datos = JSON.parse(await datos.text()); } catch { datos = null; } }
        if(datos?.codigo === 'BANCI_ENVIO_PENDIENTE') this.limpiar();
        this.mostrarMensaje(error instanceof HttpErrorResponse && error.error instanceof Blob
            ? datos?.mensaje || await this.errorDescarga(error)
            : obtenerMensajeErrorHttp(error));
    }
    private mostrarMensaje(texto: string): void
    {
        this.mensaje.set(texto);
        if(texto) this.desplazar('banci-mensaje');
    }
    readonly arrastrandoArchivo = signal(false);
    private readonly api = inject(BanciMensualService);
    private readonly session = inject(SessionService);
    private readonly ruta = inject(ActivatedRoute);
    readonly actualizacion = this.ruta.snapshot.data['actualizacion'] === true;
    readonly titulo = `${this.actualizacion ? 'Actualización' : 'Carga'} masiva`;
    readonly cargaGuiada = true;
    readonly plantillaDescargada = signal(false);
    readonly ultimoEnvio = signal<{ referencia: string; estado: string } | null>(null);
    readonly opciones = signal<BanciOpciones | null>(null);
    readonly libro = signal<BanciLibro | null>(null);
    readonly errores = signal<BanciError[]>([]);
    readonly mensaje = signal('');
    readonly ocupado = signal(false);
    readonly validacion = signal<BanciValidacion | null>(null);
    readonly historicaSinOrigen = signal(false);
    entidad = 0;
    mes = 0;
    anio = 0;
    readonly meses = Array.from({ length: 12 }, (_, indice) => ({
        valor: indice + 1,
        nombre: new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' })
            .format(new Date(Date.UTC(2026, indice, 1)))
            .replace(/^./, letra => letra.toUpperCase()),
    }));
    archivo: File | null = null;
    constructor()
    {
        this.api.opciones().subscribe({
            next: (opciones) =>
            {
                this.opciones.set(opciones);
                this.entidad = opciones.entidades[0]?.id ?? 0;
                this.mes = opciones.mes;
                this.anio = opciones.anio;
            },
            error: (e) => void this.mostrarError(e),
        });
    }
    puedeElegirEntidad(): boolean
    {
        return this.session.usuario()?.rol === 'SUPER_USUARIO';
    }
    puedeElegirCorte(): boolean
    {
        return this.actualizacion || this.opciones()?.cortesAnteriores === true;
    }
    entidadNombre(): string
    {
        return this.opciones()?.entidades.find((e) => e.id === this.entidad)?.nombre ?? '';
    }
    periodoNombre(): string
    {
        if(!this.mes || !this.anio) return '';
        return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
            new Date(Date.UTC(this.anio, this.mes - 1, 1)),
        );
    }
    limpiar(): void
    {
        this.cerrarAcuse();
        this.ultimoEnvio.set(null);
        this.plantillaDescargada.set(false);
        this.libro.set(null);
        this.validacion.set(null);
        this.errores.set([]);
        this.mensaje.set('');
        this.archivo = null;
    }
    async plantilla(): Promise<void>
    {
        if(this.ocupado() || !this.entidad || !this.opciones()) return;
        if(this.cargaGuiada) this.limpiar();
        this.ocupado.set(true);
        this.mensaje.set('');
        try
        {
            if(this.cargaGuiada)
            {
                const libro = await firstValueFrom(this.api.precarga(this.entidad, this.mes, this.anio, this.actualizacion));
                const sinOrigen = libro.carpetas.length === 0;
                const respuesta = await Swal.fire({
                    icon: 'warning',
                    title: this.actualizacion
                        ? 'Descargar plantilla de actualización'
                        : sinOrigen
                          ? 'Descargar plantilla histórica'
                          : 'Descargar información precargada',
                    text: this.actualizacion
                        ? 'Descargue la información aprobada en BANCI, modifique únicamente los datos personales o de localización que correspondan y cargue la plantilla completa. Solo se enviarán los registros que reciban cambios.'
                        : sinOrigen
                          ? 'Este corte histórico no tiene información aceptada en el módulo Consolidado. ¿Desea descargar la plantilla para capturar la información histórica de su fiscalía?'
                          : '¿Desea descargar la información reportada por su fiscalía en el Sistema de Integración de Información de Incidencia Delictiva? La carga BANCI deberá coincidir con la información aceptada en el módulo Consolidado para el periodo seleccionado. Complete únicamente los datos complementarios de BANCI.',
                    showCancelButton: true,
                    confirmButtonText: 'Descargar información',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#6f2c91',
                    reverseButtons: true,
                });
                if(!respuesta.isConfirmed) return;
                this.limpiar();
                this.libro.set(libro);
                this.historicaSinOrigen.set(sinOrigen);
            }
            const blob = await firstValueFrom(this.api.plantilla(this.entidad, this.mes, this.anio, this.actualizacion));
            descargarBanci(blob, `BANCI_${this.anio}${String(this.mes).padStart(2, '0')}.xlsx`);
            this.plantillaDescargada.set(true);
            this.desplazar('banci-carga-archivo');
        } catch (e)
        {
            await this.mostrarError(e);
        } finally
        {
            this.ocupado.set(false);
        }
    }
    private async errorDescarga(e: unknown): Promise<string>
    {
        if(e instanceof HttpErrorResponse && e.error instanceof Blob)
        {
            try
            {
                return JSON.parse(await e.error.text()).mensaje;
            } catch
            {
                return 'No fue posible descargar la plantilla.';
            }
        }
        return obtenerMensajeErrorHttp(e);
    }
    soltarArchivo(evento: DragEvent): void
    {
        evento.preventDefault();
        this.arrastrandoArchivo.set(false);
        const archivo = evento.dataTransfer?.files[0];
        if(archivo && !this.ocupado() && (!this.cargaGuiada || this.plantillaDescargada()))
        {
            this.archivo = archivo;
            this.validacion.set(null);
            this.errores.set([]);
        }
    }
    cambiarArchivo(): void
    {
        if(this.ocupado()) return;
        this.cerrarAcuse();
        this.archivo = null;
        this.arrastrandoArchivo.set(false);
        this.validacion.set(null);
        this.errores.set([]);
        this.mensaje.set('');
    }
    archivoSeleccionado(evento: Event): void
    {
        if(this.cargaGuiada && !this.plantillaDescargada()) return;
        this.archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
        this.validacion.set(null);
        this.errores.set([]);
    }
    validar(): void
    {
        if(this.cargaGuiada && !this.plantillaDescargada()) return;
        const libro = this.libro();
        if(!libro || !this.archivo) return;
        this.ocupado.set(true);
        this.mensaje.set('');
        this.validacion.set(null);
        this.errores.set([]);
        this.desplazar('banci-proceso', 'end');
        const peticion = this.api.validarArchivo(this.archivo, libro);
        peticion.pipe(finalize(() => this.ocupado.set(false))).subscribe({
            next: (r) =>
            {
                this.errores.set(r.errores);
                if(r.esValido)
                {
                    this.validacion.set(r);
                    if(r.referencia) this.mostrarAcuse(r.referencia);
                    this.desplazar('banci-informe', 'end');
                }
                if(r.errores.length) this.desplazar('banci-errores', 'end');
            },
            error: (e) => void this.mostrarError(e),
        });
    }
    async confirmar(aceptar: boolean): Promise<void>
    {
        const referencia = this.validacion()?.referencia;
        if(!referencia) return;
        const confirmacion = await Swal.fire({
            icon: 'warning',
            title: aceptar ? 'Confirmar envío BANCI' : 'Descartar envío BANCI',
            text: aceptar ? '¿Desea continuar con el envío de información BANCI?' : '¿Desea descartar este envío validado?',
            showCancelButton: true,
            confirmButtonText: aceptar ? 'Confirmar envío' : 'Descartar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#6f2c91',
        });
        if(!confirmacion.isConfirmed) return;
        this.ocupado.set(true);
        this.api
            .resolver(referencia, aceptar, aceptar ? '' : 'Descartado por el remitente.', false)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (r) =>
                {
                    this.limpiar();
                    if(aceptar)
                    {
                        this.ultimoEnvio.set({ referencia, estado: r.estado });
                        this.mostrarAcuse(referencia);
                    }
                    void Swal.fire({
                        icon: 'success',
                        title: 'Envío procesado',
                        text: r.estado.replaceAll('_', ' '),
                        confirmButtonColor: '#6f2c91',
                    });
                },
                error: (e) => void this.mostrarError(e),
            });
    }
    mostrarAcuse(referencia: string): void
    {
        this.acuseReferencia.set(referencia);
        this.cargandoAcuse.set(true);
        this.errorAcuse.set('');
        this.api
            .acuse(referencia)
            .pipe(finalize(() => this.cargandoAcuse.set(false)))
            .subscribe({
                next: (blob) =>
                {
                    if(this.acuseReferencia() !== referencia) return;
                    const pdf = crearSafeBlobUrl(blob, this.sanitizer, this.acuseObjectUrl);
                    this.acuseObjectUrl = pdf.objectUrl;
                    this.acuseUrl.set(pdf.safeUrl);
                },
                error: async (e) =>
                {
                    if(this.acuseReferencia() === referencia) this.errorAcuse.set(await this.errorDescarga(e));
                },
            });
    }
    exportarErrores(): void
    {
        void exportarFilasExcel(
            this.errores().map((e) => ({ Archivo: e.archivo, Fila: e.fila, Campo: e.campo, Mensaje: e.mensaje })),
            'BANCI_validaciones.xlsx',
        );
    }
}
