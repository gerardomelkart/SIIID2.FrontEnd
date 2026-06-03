import { HttpErrorResponse } from '@angular/common/http';

export function obtenerMensajeErrorHttp(
  error: unknown,
  mensajeFallback = 'Ocurrió un error inesperado.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return mensajeFallback;
  }

  if (error.status === 0) {
    return 'No hay comunicación con el servidor.';
  }

  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return 'No hay comunicación con el servidor.';
  }

  if (typeof error.error === 'string') {
    const texto = error.error.trim();

    if (texto.includes('Error occurred while trying to proxy')) {
      return 'No hay comunicación con el servidor.';
    }

    return texto || mensajeFallback;
  }

  if (error.error instanceof Blob) {
    return mensajeFallback;
  }

  if (error.error?.mensaje) {
    return error.error.mensaje;
  }

  if (error.error?.title) {
    return error.error.title;
  }

  if (error.status === 401) {
    return 'No autorizado. Inicie sesión nuevamente.';
  }

  if (error.status === 403) {
    return 'No tiene permisos para realizar esta acción.';
  }

  if (error.status >= 500) {
    return 'El servidor presentó un error interno.';
  }

  return mensajeFallback;
}

export async function obtenerMensajeErrorHttpAsync(
  error: unknown,
  mensajeFallback = 'Ocurrió un error inesperado.',
): Promise<string> {
  const blob = obtenerBlobError(error);

  if (!blob) {
    return obtenerMensajeErrorHttp(error, mensajeFallback);
  }

  try {
    const texto = await blob.text();

    if (!texto.trim()) {
      return mensajeFallback;
    }

    const json = JSON.parse(texto) as {
      mensaje?: string;
      title?: string;
      detail?: string;
    };

    return json.mensaje || json.title || json.detail || mensajeFallback;
  } catch {
    return mensajeFallback;
  }
}

export function obtenerErrorPayload<TPayload>(error: unknown): TPayload | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }

  if (!error.error || typeof error.error !== 'object' || error.error instanceof Blob) {
    return undefined;
  }

  return error.error as TPayload;
}

function obtenerBlobError(error: unknown): Blob | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  return error.error instanceof Blob ? error.error : null;
}
