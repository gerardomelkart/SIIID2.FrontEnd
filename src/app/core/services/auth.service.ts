import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { LoginRequest, LoginResponse } from '../models/auth.models';
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

  logout(): void {
    this.sessionService.limpiarSesion();
  }
}
