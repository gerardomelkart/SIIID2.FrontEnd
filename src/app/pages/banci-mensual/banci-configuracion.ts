import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { BanciMensualService } from '../../core/services/banci-mensual.service';
import { BanciUsuariosService } from '../../core/services/banci-usuarios.service';
import { BanciOpciones } from '../../core/models/banci-mensual.models';
import { BanciUsuarioDetalle } from '../../core/models/banci-usuarios.models';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({
    selector: 'app-banci-configuracion',
    imports: [FormsModule],
    templateUrl: './banci-configuracion.html',
    styleUrl: './banci-mensual.css',
})
export class BanciConfiguracion
{
    private readonly api = inject(BanciMensualService);
    private readonly usuariosApi = inject(BanciUsuariosService);
    readonly opciones = signal<BanciOpciones | null>(null);
    readonly usuarios = signal<BanciUsuarioDetalle[]>([]);
    readonly mensaje = signal('');
    readonly ocupado = signal(false);
    motivo = '';
    cargaGlobal = true;
    modificacionGlobal = true;
    constructor()
    {
        this.recargar();
    }
    recargar(): void
    {
        this.api.opciones().subscribe({ next: (o) => this.opciones.set(o), error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)) });
        this.usuariosApi.obtenerUsuarios(false).subscribe({
            next: (r) => this.usuarios.set(r.usuarios.filter((u) => u.rol !== 'SUPER_USUARIO')),
            error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
        });
    }
    cambiar(clave: string, habilitado: boolean): void
    {
        if(!this.motivo.trim())
        {
            this.mensaje.set('Indique el motivo del cambio de configuración.');
            return;
        }
        this.ocupado.set(true);
        this.api
            .configuracion(clave, habilitado, this.opciones()!.version, this.motivo)
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: () =>
                {
                    this.mensaje.set('Configuración actualizada.');
                    this.recargar();
                },
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
            });
    }
    guardarUsuario(u: BanciUsuarioDetalle): void
    {
        this.ocupado.set(true);
        this.usuariosApi
            .actualizarPermisos(u.idUsuario, {
                habilitaBanci: u.habilitaBanci,
                habilitaCarga: u.habilitaCarga,
                habilitaModificacion: u.habilitaModificacion,
            })
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (r) =>
                {
                    this.mensaje.set(r.mensaje);
                    this.recargar();
                },
                error: (e) =>
                {
                    this.mensaje.set(obtenerMensajeErrorHttp(e));
                    this.recargar();
                },
            });
    }
    guardarGlobal(): void
    {
        this.ocupado.set(true);
        this.usuariosApi
            .actualizarPermisosGlobales({ habilitaCarga: this.cargaGlobal, habilitaModificacion: this.modificacionGlobal })
            .pipe(finalize(() => this.ocupado.set(false)))
            .subscribe({
                next: (r) =>
                {
                    this.mensaje.set(r.mensaje);
                    this.recargar();
                },
                error: (e) => this.mensaje.set(obtenerMensajeErrorHttp(e)),
            });
    }
}
