import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, filter, map, throwError } from 'rxjs';

import { SessionService } from '../services/session.service';

const MARCADOR_URL_DIRECTA = '__siiidDirectObjectUrl';

type BlobConUrlDirecta = Blob & { [MARCADOR_URL_DIRECTA]?: string };
type CreateObjectUrlPatched = typeof URL.createObjectURL & { __siiidPatched?: boolean };
type RevokeObjectUrlPatched = typeof URL.revokeObjectURL & { __siiidPatched?: boolean };
type TipoAcuseTicket =
  | 'PREVIO_CARGA'
  | 'CONFIRMADO_CARGA'
  | 'PREVIO_ACTUALIZACION'
  | 'CONFIRMADO_ACTUALIZACION';

interface AcuseTicketResponse {
  esValido: boolean;
  ticket: string;
  nombreArchivo: string;
}

interface DatosAcuse {
  baseApi: string;
  codigoReferencia: string;
  tipo: TipoAcuseTicket;
}

function instalarSoporteUrlDirecta(): void {
  const createActual = URL.createObjectURL as CreateObjectUrlPatched;

  if (!createActual.__siiidPatched) {
    const createOriginal = URL.createObjectURL.bind(URL);
    const createPatched = ((objeto: Blob | MediaSource) => {
      const urlDirecta = (objeto as BlobConUrlDirecta)[MARCADOR_URL_DIRECTA];
      return urlDirecta || createOriginal(objeto);
    }) as CreateObjectUrlPatched;

    createPatched.__siiidPatched = true;
    URL.createObjectURL = createPatched;
  }

  const revokeActual = URL.revokeObjectURL as RevokeObjectUrlPatched;

  if (!revokeActual.__siiidPatched) {
    const revokeOriginal = URL.revokeObjectURL.bind(URL);
    const revokePatched = ((url: string) => {
      if (url.startsWith('blob:')) {
        revokeOriginal(url);
      }
    }) as RevokeObjectUrlPatched;

    revokePatched.__siiidPatched = true;
    URL.revokeObjectURL = revokePatched;
  }
}

function crearBlobUrlDirecta(url: string): Blob {
  const blob = new Blob([], { type: 'application/x-siiid-direct-url' }) as BlobConUrlDirecta;
  blob[MARCADOR_URL_DIRECTA] = url;
  return blob;
}

function obtenerDatosAcuse(url: string): DatosAcuse | null {
  const match = url.match(/\/(cargas|actualizaciones)\/([^/?#]+)\/(acuse-confirmado|acuse)(?:[?#]|$)/i);

  if (!match) {
    return null;
  }

  const modulo = match[1].toLowerCase();
  const codigoReferencia = decodeURIComponent(match[2]);
  const confirmado = match[3].toLowerCase() === 'acuse-confirmado';
  const baseApi = url.substring(0, match.index ?? 0);

  if (modulo === 'actualizaciones') {
    return { baseApi, codigoReferencia, tipo: confirmado ? 'CONFIRMADO_ACTUALIZACION' : 'PREVIO_ACTUALIZACION' };
  }

  return { baseApi, codigoReferencia, tipo: confirmado ? 'CONFIRMADO_CARGA' : 'PREVIO_CARGA' };
}

function manejarError(error: unknown, sessionService: SessionService, router: Router) {
  if (
    error instanceof HttpErrorResponse &&
    error.status === 403 &&
    error.error?.codigo === 'CAMBIO_PASSWORD_REQUERIDO'
  ) {
    sessionService.marcarCambioPasswordRequerido();
    void router.navigateByUrl('/cambiar-password');
  }

  return throwError(() => error);
}

instalarSoporteUrlDirecta();

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const token = sessionService.token();

  const request = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  const datosAcuse = request.method === 'GET' ? obtenerDatosAcuse(request.url) : null;

  if (datosAcuse) {
    const ticketUrl = `${datosAcuse.baseApi}/acuses/${encodeURIComponent(datosAcuse.codigoReferencia)}/ticket?tipo=${encodeURIComponent(datosAcuse.tipo)}`;
    const ticketRequest = new HttpRequest<unknown>('POST', ticketUrl, null, {
      headers: request.headers,
      withCredentials: request.withCredentials,
      responseType: 'json',
    });

    return next(ticketRequest).pipe(
      filter((event): event is HttpResponse<unknown> => event instanceof HttpResponse),
      map((event) => {
        const response = event.body as AcuseTicketResponse | null;

        if (!response?.ticket) {
          throw new Error('La API no devolvió un ticket de acuse válido.');
        }

        const urlDirecta = `${datosAcuse.baseApi}/acuses/descargar?ticket=${encodeURIComponent(response.ticket)}`;

        return new HttpResponse<Blob>({
          body: crearBlobUrlDirecta(urlDirecta),
          headers: event.headers,
          status: 200,
          statusText: 'OK',
          url: urlDirecta,
        });
      }),
      catchError((error: unknown) => manejarError(error, sessionService, router)),
    );
  }

  return next(request).pipe(
    catchError((error: unknown) => manejarError(error, sessionService, router)),
  );
};
