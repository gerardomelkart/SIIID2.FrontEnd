import { signal } from '@angular/core';
import { of } from 'rxjs';
import Swal from 'sweetalert2';
import { CargaInicial } from './carga-inicial/carga-inicial';
import { Actualizacion } from './actualizacion/actualizacion';

describe('Decisión por persona mexicana sin CURP en el Consolidado', () => {
    afterEach(() => vi.restoreAllMocks());
    for(const actualizacion of [false, true]) for(const aceptar of [false, true]) {
        it(`${actualizacion ? 'actualización' : 'carga'} ${aceptar ? 'continúa' : 'permanece en revisión'} al decidir el modal`, async () => {
            const modal = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: aceptar, isDenied: false, isDismissed: !aceptar });
            const archivo = new File(['datos'], 'prueba.xlsx');
            vi.spyOn(archivo, 'slice').mockReturnValue({ arrayBuffer: async () => new ArrayBuffer(1) } as Blob);
            const avisos = [{ codigo: 'FEMINICIDIO_MEXICANA_SIN_CURP_ADVERTENCIA', mensaje: '¿Está seguro de que desea registrar a una persona mexicana sin CURP? Este registro será observado a nivel administrativo.' }];
            const respuesta = { esValido: true, codigoReferencia: 'PRUEBA', advertencias: avisos, errores: [] };
            const continuar = vi.fn();
            const contexto = {
                archivos: signal({ carpetas: archivo, delitos: archivo, victimas: archivo }),
                estado: signal('INICIAL'), estadoPeriodo: signal('DISPONIBLE'),
                errorGeneral: signal(''), mensaje: signal(''), respuesta: signal(null), respuestaValidacion: signal(null),
                diferencias: signal(null), detalleDiferenciasOmitido: signal(false),
                solicitudComplementosBanci: signal(null), archivoComplementosBanci: signal(null),
                mesCorte: signal(9), anioCorte: signal(2026), esSuperUsuario: () => false,
                limpiarUrlsPdf: vi.fn(), hayAdvertenciasDeDecision: () => true, advertencias: () => avisos,
                continuarAAcusePrevio: continuar, aceptarAdvertenciasActualizacion: continuar,
                cargaService: { validarArchivos: () => of(respuesta) },
                actualizacionService: { validarActualizacion: () => of(respuesta) },
            };
            if(actualizacion) await Actualizacion.prototype.validarActualizacion.call(contexto as unknown as Actualizacion);
            else await CargaInicial.prototype.validarArchivos.call(contexto as unknown as CargaInicial);
            await Promise.resolve();
            expect(modal).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Persona mexicana sin CURP', text: avisos[0].mensaje,
                showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
            }));
            expect(continuar).toHaveBeenCalledTimes(aceptar ? 1 : 0);
        });
    }
});
