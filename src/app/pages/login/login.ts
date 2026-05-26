import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  usuario = signal('');
  password = signal('');

  constructor(private router: Router) {}

  entrar(): void {
    // Temporal visual.
    // Después aquí irá la llamada real a la API de autenticación.
    this.router.navigateByUrl('/');
  }
}