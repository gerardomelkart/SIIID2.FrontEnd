import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActualizacionService } from './actualizacion.service';

describe('Contrato multipart de complementos BANCI del Consolidado', () =>
{
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
    afterEach(() => TestBed.inject(HttpTestingController).verify());
    for(const conComplementos of [false, true])
    {
        it(`conserva los tres archivos mensuales ${conComplementos ? 'con' : 'sin'} el original BANCI`, () =>
        {
            const archivos = ['carpetas', 'delitos', 'victimas'].map((n) => new File(['datos'], `${n}.xlsx`));
            const complemento = conComplementos ? new File(['datos'], 'BANCI_original.xlsx') : null;
            TestBed.inject(ActualizacionService)
                .validarActualizacion(5, 2026, ...(archivos as [File, File, File]), 9, complemento)
                .subscribe();
            const req = TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/actualizaciones/validar'));
            expect(req.request.body.get('mesCorte')).toBe('5');
            expect(req.request.body.get('idEntidadFederativa')).toBe('9');
            expect(req.request.body.get('carpetas').name).toBe('carpetas.xlsx');
            expect(req.request.body.get('complementosBanci')?.name ?? null).toBe(complemento?.name ?? null);
            req.flush({ esValido: true });
        });
    }
});
