import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';

import {
  CambiarPasswordRequest,
  CambiarPasswordResponse,
  LoginRequest,
  LoginResponse,
} from '../models/auth.models';

import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = API_ENDPOINTS.auth;

  constructor(
    private http: HttpClient,
    private sessionService: SessionService,
  ) {}

  login(request: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      tap((response) => {
        if (response.esValido) {
          this.sessionService.guardarSesion(response);
        }
      }),
    );
  }

  cambiarPassword(request: CambiarPasswordRequest) {
    return this.http.post<CambiarPasswordResponse>(`${this.apiUrl}/cambiar-password`, request);
  }

  logout(): void {
    this.sessionService.limpiarSesion();
  }
}
