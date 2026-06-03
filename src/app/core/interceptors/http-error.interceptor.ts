import { isDevMode } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (isDevMode()) {
                registrarErrorHttpSeguro(req.method, req.urlWithParams, error);
            }

            return throwError(() => error);
        })
    );
};

function registrarErrorHttpSeguro(
    metodo: string,
    url: string,
    error: HttpErrorResponse
): void {
    const esErrorConexion = esErrorDeConexion(error);

    console.groupCollapsed(
        `%cHTTP ERROR ${error.status || 'SIN_RESPUESTA'}%c ${metodo} ${url}`,
        'color: #fff; background: #b42318; padding: 2px 6px; border-radius: 3px;',
        'color: inherit;'
    );

    console.error('Request:', {
        method: metodo,
        url
    });

    console.error('Response:', {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        message: error.message,
        error: sanitizarErrorResponse(error.error)
    });

    if (esErrorConexion) {
        console.error(
            'Diagnóstico:',
            'No hay comunicación con la API. Revise que Visual Studio/API esté corriendo y que el proxy apunte al puerto correcto.'
        );
    }

    console.groupEnd();
}

function esErrorDeConexion(error: HttpErrorResponse): boolean {
    return error.status === 0
        || error.status === 502
        || error.status === 503
        || error.status === 504;
}

function sanitizarErrorResponse(error: unknown): unknown {
    if (!error) {
        return error;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof Blob) {
        return {
            tipo: 'Blob',
            contentType: error.type,
            size: error.size
        };
    }

    if (error instanceof ProgressEvent) {
        return {
            tipo: 'ProgressEvent',
            mensaje: 'Error de red o conexión interrumpida.'
        };
    }

    if (Array.isArray(error)) {
        return error.map(item => sanitizarObjeto(item));
    }

    if (typeof error === 'object') {
        return sanitizarObjeto(error as Record<string, unknown>);
    }

    return error;
}

function sanitizarObjeto(objeto: Record<string, unknown>): Record<string, unknown> {
    const camposSensibles = [
        'password',
        'nuevaPassword',
        'token',
        'accessToken',
        'refreshToken',
        'authorization',
        'Authorization'
    ];

    return Object.entries(objeto).reduce((acumulado, [llave, valor]) => {
        if (camposSensibles.some(campo => campo.toLowerCase() === llave.toLowerCase())) {
            acumulado[llave] = '[OCULTO]';
            return acumulado;
        }

        if (Array.isArray(valor)) {
            acumulado[llave] = valor.map(item =>
                typeof item === 'object' && item !== null
                    ? sanitizarObjeto(item as Record<string, unknown>)
                    : item
            );
            return acumulado;
        }

        if (typeof valor === 'object' && valor !== null) {
            acumulado[llave] = sanitizarObjeto(valor as Record<string, unknown>);
            return acumulado;
        }

        acumulado[llave] = valor;
        return acumulado;
    }, {} as Record<string, unknown>);
}