// Un error al mostrar diferencias no invalida la carga ya validada.
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export const TIEMPO_ESPERA_DETALLE_DIFERENCIAS_MS = 70_000;
export const AVISO_DETALLE_DIFERENCIAS =
    'La consulta de diferencias excedió el tiempo disponible. No fue posible mostrar el detalle. Revise el informe previo antes de aceptar o rechazar. La actualización continúa validada.';
export const AVISO_DETALLE_DIFERENCIAS_ADMIN =
    'La consulta de diferencias excedió el tiempo disponible. Consulte el resumen y el informe previo antes de aprobar o rechazar.';

export function esTimeoutConsultaDiferencias(error: unknown): boolean
{
    if(error instanceof TimeoutError) return true;
    return error instanceof HttpErrorResponse
        && (error.error?.codigo === 'DIFERENCIAS_TIMEOUT' || error.status === 504);
}
