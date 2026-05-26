import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';

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
    private router: Router
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

        this.router.navigateByUrl('/');
      },
      error: (error) => {
        this.cargando.set(false);

        const mensajeApi = error?.error?.mensaje;

        this.mensajeError.set(mensajeApi || 'No fue posible iniciar sesión. Verifique sus credenciales.');
      }
    });
  }
}