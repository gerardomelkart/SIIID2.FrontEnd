import { HttpClient, HttpResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { InactivityService } from './core/services/inactivity.service';

const MARCADOR_URL_DIRECTA = '__siiidDirectObjectUrl';

type BlobConUrlDirecta = Blob & { [MARCADOR_URL_DIRECTA]?: string };
type CreateObjectUrlPatched = typeof URL.createObjectURL & { __siiidPatched?: boolean };
type RevokeObjectUrlPatched = typeof URL.revokeObjectURL & { __siiidPatched?: boolean };
type HttpClientGetPatched = typeof HttpClient.prototype.get & { __siiidPatched?: boolean };
type TipoAcuseTicket =
  | 'PREVIO_CARGA'
  | 'CONFIRMADO_CARGA'
  | 'PREVIO_ACTUALIZACION'
  | 'CONFIRMADO_ACTUALIZACION';

interface AcuseTicketResponse {
  esValido: boolean;
  ticket: string;
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

function instalarIntercepcionAcuses(http: HttpClient): void {
  const getActual = http.get as HttpClientGetPatched;

  if (getActual.__siiidPatched) {
    return;
  }

  const getOriginal = http.get.bind(http);
  const getPatched = ((url: string, options?: Record<string, unknown>) => {
    const datosAcuse = obtenerDatosAcuse(url);

    if (!datosAcuse) {
      return getOriginal(url, options);
    }

    const ticketUrl = `${datosAcuse.baseApi}/acuses/${encodeURIComponent(datosAcuse.codigoReferencia)}/ticket?tipo=${encodeURIComponent(datosAcuse.tipo)}`;

    return http.post<AcuseTicketResponse>(ticketUrl, null).pipe(
      map((response) => {
        if (!response.ticket) {
          throw new Error('La API no devolvió un ticket de acuse válido.');
        }

        const urlDirecta = `${datosAcuse.baseApi}/acuses/descargar?ticket=${encodeURIComponent(response.ticket)}`;
        const blob = crearBlobUrlDirecta(urlDirecta);

        if (options?.['observe'] === 'response') {
          return new HttpResponse<Blob>({ body: blob, status: 200, statusText: 'OK', url: urlDirecta });
        }

        return blob;
      }),
    );
  }) as HttpClientGetPatched;

  getPatched.__siiidPatched = true;
  http.get = getPatched;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('SIIID2.FrontEnd');

  constructor(
    private router: Router,
    private inactivityService: InactivityService,
    private http: HttpClient,
  ) {
    instalarSoporteUrlDirecta();
    instalarIntercepcionAcuses(this.http);
  }

  ngOnInit(): void {
    this.inactivityService.iniciar();
    const navigationEntry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const esRecarga = navigationEntry?.type === 'reload';

    if (!esRecarga) {
      return;
    }

    const basePath = new URL(document.baseURI).pathname.replace(/\/$/, '').toLowerCase();

    const pathname = window.location.pathname.replace(/\/$/, '').toLowerCase() || '/';

    const rutaActual =
      basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname;

    // Estas rutas deben conservarse al recargar.
    if (rutaActual === '/login' || rutaActual === '/cambiar-password') {
      return;
    }

    // Si está dentro del sistema, al refrescar regresa al inicio vacío.
    if (rutaActual !== '/') {
      this.router.navigateByUrl('/');
    }
  }
}
