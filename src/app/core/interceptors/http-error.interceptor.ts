import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            const esErrorConexion = error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;

            console.groupCollapsed(
                `%cHTTP ERROR ${error.status || 'SIN_RESPUESTA'}%c ${req.method} ${req.urlWithParams}`,
                'color: #fff; background: #b42318; padding: 2px 6px; border-radius: 3px;',
                'color: inherit;'
            );

            console.error('Request:', {
                method: req.method,
                url: req.urlWithParams,
                body: req.body,
                headers: req.headers.keys().reduce((acc, key) => {
                    acc[key] = req.headers.get(key);
                    return acc;
                }, {} as Record<string, string | null>)
            });

            console.error('Response:', {
                status: error.status,
                statusText: error.statusText,
                url: error.url,
                message: error.message,
                error: error.error
            });

            if (esErrorConexion) {
                console.error('Diagnóstico:', 'No hay comunicación con la API. Revise que Visual Studio/API esté corriendo y que el proxy apunte al puerto correcto.');
            }

            console.groupEnd();

            return throwError(() => error);
        })
    );
};