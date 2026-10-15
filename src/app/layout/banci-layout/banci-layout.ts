import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
@Component({
    selector: 'app-banci-layout',
    imports: [RouterLink, RouterOutlet],
    templateUrl: './banci-layout.html',
    styleUrls: ['./banci-layout.css'],
})
export class BanciLayout
{
    readonly usuario = inject(SessionService).usuario;
    private readonly session = inject(SessionService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    salir(): void
    {
        this.auth.logout();
        void this.router.navigateByUrl('/login');
    }
    cambiarModulo(): void
    {
        this.session.limpiarModuloActivo();
        void this.router.navigateByUrl('/seleccionar-modulo');
    }
}
