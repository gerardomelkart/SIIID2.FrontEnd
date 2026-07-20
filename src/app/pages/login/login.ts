import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  usuario = signal('');
  password = signal('');
  cargando = signal(false);
  mensajeError = signal('');

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private router: Router,
  ) {}

  entrar(): void {
    this.mensajeError.set('');

    const usuario = this.usuario().trim();
    const password = this.password();

    if (!usuario || !password) {
      this.mensajeError.set('Debe capturar usuario y contraseña.');
      return;
    }

    this.cargando.set(true);

    this.authService.login({ usuario, password }).subscribe({
      next: (response) => {
        this.cargando.set(false);

        if (!response.esValido) {
          this.mensajeError.set(response.mensaje || 'Usuario o contraseña incorrectos.');
          return;
        }

        if (response.usuario?.requiereCambioPassword) {
          void this.router.navigateByUrl('/cambiar-password');
          return;
        }

        const modulos = this.sessionService.modulos();

        if (modulos.length === 0) {
          this.authService.logout();
          this.mensajeError.set('El usuario no tiene módulos habilitados.');
          return;
        }

        if (modulos.length > 1) {
          void this.router.navigateByUrl('/seleccionar-modulo');
          return;
        }

        void this.router.navigateByUrl(this.sessionService.obtenerRutaModulo(modulos[0].clave));
      },
      error: (error) => {
        this.cargando.set(false);
        this.mensajeError.set(
          obtenerMensajeErrorHttp(
            error,
            'No fue posible iniciar sesión. Verifique sus credenciales.',
          ),
        );
      },
    });
  }
}