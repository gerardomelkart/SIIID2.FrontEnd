import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { mostrarExito } from '../../core/utils/alert.utils';
import { obtenerMensajeErrorHttp } from '../../core/utils/http-error.utils';

@Component({
  selector: 'app-cambiar-password',
  imports: [FormsModule],
  templateUrl: './cambiar-password.html',
  styleUrl: './cambiar-password.css',
})
export class CambiarPassword {
  nuevaPassword = signal('');
  confirmarPassword = signal('');
  guardando = signal(false);
  mensajeError = signal('');

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  cambiarPassword(): void {
    this.mensajeError.set('');

    const nuevaPassword = this.nuevaPassword();
    const confirmarPassword = this.confirmarPassword();

    if (!nuevaPassword || !confirmarPassword) {
      this.mensajeError.set(
        'Debe capturar y confirmar la nueva contraseña.',
      );
      return;
    }

    if (nuevaPassword.length < 8) {
      this.mensajeError.set(
        'La nueva contraseña debe tener al menos 8 caracteres.',
      );
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      this.mensajeError.set(
        'La confirmación de la contraseña no coincide.',
      );
      return;
    }

    this.guardando.set(true);

    this.authService
      .cambiarPassword({
        nuevaPassword,
        confirmarPassword,
      })
      .subscribe({
        next: async (response) => {
          this.guardando.set(false);

          if (!response.esValido) {
            this.mensajeError.set(
              response.mensaje ||
                'No fue posible cambiar la contraseña.',
            );
            return;
          }

          await mostrarExito(
            'Contraseña actualizada',
            'Inicie sesión nuevamente con su nueva contraseña.',
          );

          this.authService.logout();

          void this.router.navigateByUrl('/login');
        },
        error: (error: unknown) => {
          this.guardando.set(false);

          this.mensajeError.set(
            obtenerMensajeErrorHttp(
              error,
              'No fue posible cambiar la contraseña.',
            ),
          );
        },
      });
  }

  cerrarSesion(): void {
    this.authService.logout();

    void this.router.navigateByUrl('/login');
  }
}