import { nombreCampo } from './banci-campos';
import { Component, OnDestroy, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { crearSafeBlobUrl, revocarObjectUrl } from '../../core/utils/blob-url.utils';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { HttpErrorResponse } from '@angular/common/http';
import { SessionService } from '../../core/services/session.service';
import { BanciLibro, BanciFila, BanciOpciones, BanciError, BanciValidacion } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';

@Component({
    selector: 'app-banci-captura',
    imports: [FormsModule, RouterLink],
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
    readonly arrastrandoArchivo = signal(false);
    readonly nombreCampo = nombreCampo;
    private readonly api = inject(BanciMensualService);
    private readonly session = inject(SessionService);
    private readonly ruta = inject(ActivatedRoute);
    readonly actualizacion = this.ruta.snapshot.data['actualizacion'] === true;
    readonly manual = this.ruta.snapshot.data['manual'] === true;
    readonly titulo = `${this.actualizacion ? 'Actualización' : 'Carga'} ${this.manual ? 'manual' : 'masiva'}`;
    readonly cargaGuiada = !this.manual;
    readonly plantillaDescargada = signal(false);
    readonly ultimoEnvio = signal<{ referencia: string; estado: string } | null>(null);
    private originales: BanciFila[] = [];
    private readonly originalEditable = signal('');
    readonly opciones = signal<BanciOpciones | null>(null);
    readonly libro = signal<BanciLibro | null>(null);
    readonly errores = signal<BanciError[]>([]);
    readonly mensaje = signal('');
    readonly ocupado = signal(false);
    readonly validacion = signal<BanciValidacion | null>(null);
    readonly seleccion = signal<BanciFila | null>(null);
    readonly historicaSinOrigen = signal(false);
    entidad = 0;
    mes = 0;
    anio = 0;
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
            error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
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
        this.originales = [];
        this.plantillaDescargada.set(false);
        this.originalEditable.set('');
        this.libro.set(null);
        this.validacion.set(null);
        this.errores.set([]);
        this.mensaje.set('');
        this.seleccion.set(null);
        this.archivo = null;
    }
    precargar(): void
    {
        this.limpiar();
        this.ocupado.set(true);
        this.api
            .precarga(this.entidad, this.mes, this.anio, this.actualizacion, this.manual)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (libro) =>
                {
                    this.libro.set(libro);
                    this.originales = structuredClone(libro.victimas);
                    this.originalEditable.set(this.firmaEditable());
                    this.historicaSinOrigen.set(!this.actualizacion && libro.carpetas.length === 0);
                },
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
            });
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
            const blob = await firstValueFrom(this.api.plantilla(this.entidad, this.mes, this.anio, this.actualizacion, this.manual));
            descargarBanci(blob, `BANCI_${this.anio}${String(this.mes).padStart(2, '0')}.xlsx`);
            this.plantillaDescargada.set(true);
            this.desplazar(this.cargaGuiada ? 'banci-carga-archivo' : 'banci-captura-manual');
        } catch (e)
        {
            this.mensaje.set(await this.errorDescarga(e));
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
    seleccionar(fila: BanciFila): void
    {
        this.seleccion.set(fila);
        this.validacion.set(null);
        setTimeout(() => document.getElementById('banci-complementos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    victimasCarpeta(): BanciFila[]
    {
        return this.libro()?.victimas.filter((f) => f.columnas['id_ci'] === this.seleccion()?.columnas['id_ci']) ?? [];
    }
    private firmaEditable(): string
    {
        return JSON.stringify(this.libro()?.victimas.map((f) => this.editables().map((c) => f.columnas[c]?.trim() ?? '')) ?? []);
    }
    readonly hayCambios = computed(() => this.originalEditable() !== '' && this.firmaEditable() !== this.originalEditable());
    mostrarProtegido(campo: string): boolean
    {
        return (
            !this.editables().includes(campo) && !['nombre_vicfem', '1apellido_vicfem', '2apellido_vicfem', 'curp_vicfem'].includes(campo)
        );
    }
    camposVictima(fila: BanciFila): string[]
    {
        const campos = this.historicaSinOrigen() ? (this.opciones()?.columnas.victimas ?? []) : this.editables();
        const localizado = this.opciones()?.catalogos['localizacion']?.find((o) => o.codigo === 'LOCALIZADO');
        return campos.filter(
            (c) =>
                !['con_o_sin_vida', 'fecha_localizacion', 'constitutiva_delito', 'motivo_desaparicion'].includes(c) ||
                fila.columnas['localizado_o_no_localizado'] === String(localizado?.clave),
        );
    }
    private llave(fila: BanciFila): string
    {
        return JSON.stringify(['id_ci', 'id_delito', 'id_vicf'].map((c) => fila.columnas[c]?.trim() ?? ''));
    }
    libroParaEnviar(): BanciLibro | null
    {
        const libro = this.libro();
        if(!libro || !this.manual) return libro;
        let victimas: BanciFila[];
        if(this.actualizacion)
        {
            const anteriores = new Map(this.originales.map((f) => [this.llave(f), f]));
            victimas = libro.victimas.filter((f) =>
            {
                const anterior = anteriores.get(this.llave(f));
                return !anterior || this.editables().some((c) => (f.columnas[c]?.trim() ?? '') !== (anterior.columnas[c]?.trim() ?? ''));
            });
        } else
        {
            if(!this.seleccion()) return null;
            victimas = libro.victimas.filter((f) => f.columnas['id_ci'] === this.seleccion()!.columnas['id_ci']);
        }
        const carpetas = new Set(victimas.map((f) => f.columnas['id_ci']));
        // En alta se conserva toda la carpeta elegida, aunque falte completar una víctima.
        if(!this.actualizacion) carpetas.add(this.seleccion()!.columnas['id_ci']);
        const delitos = new Set(victimas.map((f) => JSON.stringify([f.columnas['id_ci'], f.columnas['id_delito']])));
        return {
            ...libro,
            manual: true,
            victimas,
            carpetas: libro.carpetas.filter((f) => carpetas.has(f.columnas['id_ci'])),
            delitos: libro.delitos.filter((f) =>
                this.actualizacion
                    ? delitos.has(JSON.stringify([f.columnas['id_ci'], f.columnas['id_delito']]))
                    : carpetas.has(f.columnas['id_ci']),
            ),
        };
    }
    editables(): string[]
    {
        return [...(this.actualizacion ? (this.opciones()?.personales ?? []) : []), ...(this.opciones()?.complementos ?? [])];
    }
    catalogo(campo: string, fila: BanciFila)
    {
        const clave =
            (
                {
                    localizado_o_no_localizado: 'localizacion',
                    con_o_sin_vida: 'condicion_vida',
                    constitutiva_delito: 'constitutiva_delito',
                    motivo_desaparicion: 'motivos',
                } as Record<string, string>
            )[campo] ?? campo;
        const opciones = this.opciones()?.catalogos[clave];
        if(campo === 'id_mun_hchos') return opciones?.filter((o) => String(o.condicion) === fila.columnas['id_ent_hchos']) ?? [];
        return campo === 'motivo_desaparicion'
            ? (opciones?.filter((o) => String(o.condicion) === fila.columnas['constitutiva_delito']) ?? [])
            : opciones;
    }
    editar(campo: string, fila: BanciFila, valor: string): void
    {
        const anterior = fila.columnas[campo];
        if(this.historicaSinOrigen() && campo === 'id_ci' && this.libro()?.carpetas.includes(fila))
            for(const hijo of [...this.libro()!.delitos, ...this.libro()!.victimas].filter((f) => f.columnas['id_ci'] === anterior))
                hijo.columnas['id_ci'] = valor;
        if(this.historicaSinOrigen() && campo === 'id_delito' && this.libro()?.delitos.includes(fila))
            for(const hijo of this.libro()!.victimas.filter(
                (f) => f.columnas['id_ci'] === fila.columnas['id_ci'] && f.columnas['id_delito'] === anterior,
            ))
                hijo.columnas['id_delito'] = valor;
        fila.columnas[campo] = valor;
        this.libro.update((libro) => (libro ? { ...libro } : libro));
        this.validacion.set(null);
        if(campo === 'constitutiva_delito') fila.columnas['motivo_desaparicion'] = '';
        if(campo === 'localizado_o_no_localizado')
        {
            const localizado = this.opciones()?.catalogos['localizacion']?.find((o) => o.codigo === 'LOCALIZADO');
            if(valor !== String(localizado?.clave))
                for(const nombre of ['con_o_sin_vida', 'fecha_localizacion', 'constitutiva_delito', 'motivo_desaparicion'])
                    fila.columnas[nombre] = '';
        }
    }
    agregar(grupo: 'carpetas' | 'delitos' | 'victimas'): void
    {
        const libro = this.libro();
        const opciones = this.opciones();
        if(!libro || !opciones || !this.historicaSinOrigen()) return;
        const fila: BanciFila = {
            numeroFila: libro[grupo].length + 2,
            columnas: Object.fromEntries(opciones.columnas[grupo].map((c) => [c, ''])),
        };
        if(grupo !== 'carpetas') fila.columnas['id_ci'] = this.seleccion()?.columnas['id_ci'] ?? '';
        libro[grupo].push(fila);
        this.libro.set({ ...libro });
        this.validacion.set(null);
        if(grupo === 'carpetas') this.seleccionar(fila);
    }
    eliminar(grupo: 'carpetas' | 'delitos' | 'victimas', fila: BanciFila): void
    {
        const libro = this.libro();
        if(!libro || !this.historicaSinOrigen()) return;
        libro[grupo] = libro[grupo].filter((f) => f !== fila);
        this.libro.set({ ...libro });
        this.validacion.set(null);
    }
    validar(): void
    {
        if(this.cargaGuiada && !this.plantillaDescargada()) return;
        if(this.manual && this.actualizacion && !this.hayCambios()) return;
        const libro = this.libroParaEnviar();
        if(!libro || (!this.manual && !this.archivo) || (this.manual && this.actualizacion && !libro.victimas.length)) return;
        this.ocupado.set(true);
        this.mensaje.set('');
        this.validacion.set(null);
        this.errores.set([]);
        this.desplazar('banci-proceso', 'end');
        const peticion = this.manual ? this.api.validarManual(libro) : this.api.validarArchivo(this.archivo!, libro);
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
            error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
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
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
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
