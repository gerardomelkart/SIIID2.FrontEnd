import { nombreCampo } from './banci-campos';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { BanciLibro, BanciFila, BanciOpciones, BanciError, BanciValidacion } from '../../core/models/banci-mensual.models';
import { BanciMensualService, descargarBanci } from '../../core/services/banci-mensual.service';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';
import { exportarFilasExcel } from '../../core/utils/excel-export.utils';
import { confirmarAccion, mostrarExitoInstitucional } from '../../core/utils/alert.utils';

@Component({ selector: 'app-banci-captura', imports: [FormsModule], templateUrl: './banci-captura.html', styleUrl: './banci-mensual.css' })
export class BanciCaptura
{
    readonly nombreCampo = nombreCampo;
    private readonly api = inject(BanciMensualService);
    private readonly ruta = inject(ActivatedRoute);
    readonly actualizacion = this.ruta.snapshot.data['actualizacion'] === true;
    readonly manual = this.ruta.snapshot.data['manual'] === true;
    readonly titulo = `${this.actualizacion ? 'Actualización' : 'Carga'} ${this.manual ? 'manual' : 'masiva'}`;
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
    limpiar(): void
    {
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
            .precarga(this.entidad, this.mes, this.anio, this.actualizacion)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (libro) =>
                {
                    this.libro.set(libro);
                    this.historicaSinOrigen.set(!this.actualizacion && libro.carpetas.length === 0);
                },
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
            });
    }
    plantilla(): void
    {
        this.ocupado.set(true);
        this.api
            .plantilla(this.entidad, this.mes, this.anio, this.actualizacion)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (blob) => descargarBanci(blob, `BANCI_${this.anio}${String(this.mes).padStart(2, '0')}.xlsx`),
                error: async (e) => this.mensaje.set(await this.errorDescarga(e)),
            });
    }
    private async errorDescarga(e: { error?: unknown }): Promise<string>
    {
        if(e.error instanceof Blob)
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
        const archivo = evento.dataTransfer?.files[0];
        if(archivo && !this.ocupado())
        {
            this.archivo = archivo;
            this.validacion.set(null);
            this.errores.set([]);
        }
    }
    archivoSeleccionado(evento: Event): void
    {
        this.archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
        this.validacion.set(null);
        this.errores.set([]);
    }
    seleccionar(fila: BanciFila): void
    {
        this.seleccion.set(fila);
        setTimeout(() => document.getElementById('banci-complementos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    victimasCarpeta(): BanciFila[]
    {
        return this.libro()?.victimas.filter((f) => f.columnas['id_ci'] === this.seleccion()?.columnas['id_ci']) ?? [];
    }
    camposVictima(): string[]
    {
        return this.historicaSinOrigen() ? (this.opciones()?.columnas.victimas ?? []) : this.editables();
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
        const libro = this.libro();
        if(!libro || (!this.manual && !this.archivo)) return;
        this.ocupado.set(true);
        this.mensaje.set('');
        this.validacion.set(null);
        const peticion = this.manual ? this.api.validarManual(libro) : this.api.validarArchivo(this.archivo!, libro);
        peticion.pipe(finalize(() => this.ocupado.set(false))).subscribe({
            next: (r) =>
            {
                this.errores.set(r.errores);
                if(r.esValido) this.validacion.set(r);
                if(r.errores.length) setTimeout(() => document.getElementById('banci-errores')?.scrollIntoView({ behavior: 'smooth' }));
            },
            error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
        });
    }
    async confirmar(aceptar: boolean): Promise<void>
    {
        const referencia = this.validacion()?.referencia;
        if(!referencia) return;
        const confirmacion = await confirmarAccion(
            aceptar ? 'Confirmar envío' : 'Descartar envío',
            aceptar ? '¿Desea continuar con el envío de información BANCI?' : '¿Desea descartar este envío validado?',
            aceptar ? 'Continuar' : 'Descartar',
        );
        if(!confirmacion.isConfirmed) return;
        this.ocupado.set(true);
        this.api
            .resolver(referencia, aceptar, aceptar ? '' : 'Descartado por el remitente.', false)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (r) =>
                {
                    this.limpiar();
                    void mostrarExitoInstitucional('Envío procesado', r.estado.replaceAll('_', ' '));
                },
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
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
