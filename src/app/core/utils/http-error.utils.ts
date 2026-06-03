import { HttpErrorResponse } from '@angular/common/http';

export function obtenerMensajeErrorHttp(
    error: unknown,
    mensajeFallback = 'Ocurrió un error inesperado.'
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