import { signal } from '@angular/core';
import { NEVER } from 'rxjs';
import { CargaInicial } from './carga-inicial/carga-inicial';
import { FederalCarga } from './federal-carga/federal-carga';
import { Actualizacion } from './actualizacion/actualizacion';
import { FederalActualizacion } from './federal-actualizacion/federal-actualizacion';
import Swal from 'sweetalert2';
import { AprobacionCargas } from './aprobacion-cargas/aprobacion-cargas';
import { FederalAprobacionCargas } from './federal-aprobacion-cargas/federal-aprobacion-cargas';
import { CargaPendienteAdministracionItem } from '../core/models/administracion-cargas.models';

describe('Continuidad de cargas sin el cruce anterior BANCI', () =>
{
    afterEach(() => vi.restoreAllMocks());
    for(const federal of [false, true])
    {
        it(`envía los archivos de ${federal ? 'Federal' : 'Consolidado'} a validar`, async () =>
        {
            const archivo = new File(['prueba'], 'prueba.xlsx');
            vi.spyOn(archivo, 'slice').mockReturnValue({ arrayBuffer: async () => new ArrayBuffer(1) } as Blob);
            const validarArchivos = vi.fn().mockReturnValue(NEVER);
            const contexto = {
                archivos: signal({ carpetas: archivo, delitos: archivo, victimas: archivo }),
                estado: signal('INICIAL'),
                errorGeneral: signal(''),
                mensaje: signal(''),
                respuesta: signal(null),
                limpiarUrlsPdf: vi.fn(),
                cargaService: { validarArchivos },
                federalCargaService: { validarArchivos },
            };
            if(federal) await FederalCarga.prototype.validarArchivos.call(contexto as unknown as FederalCarga);
            else await CargaInicial.prototype.validarArchivos.call(contexto as unknown as CargaInicial);
            expect(validarArchivos).toHaveBeenCalledWith(archivo, archivo, archivo);
        });
        it(`envía la validación de actualización de ${federal ? 'Federal' : 'Consolidado'}`, async () =>
        {
            const archivo = new File(['prueba'], 'prueba.xlsx');
            vi.spyOn(archivo, 'slice').mockReturnValue({ arrayBuffer: async () => new ArrayBuffer(1) } as Blob);
            const validarActualizacion = vi.fn().mockReturnValue(NEVER);
            const contexto = {
                archivos: signal({ carpetas: archivo, delitos: archivo, victimas: archivo }),
                mesCorte: signal(9),
                anioCorte: signal(2026),
                esSuperUsuario: () => false,
                estadoPeriodo: signal('DISPONIBLE'),
                errorGeneral: signal(''),
                respuestaValidacion: signal(null),
                diferencias: signal(null),
                limpiarUrlsPdf: vi.fn(),
                actualizacionService: { validarActualizacion },
            };
            if(federal) await FederalActualizacion.prototype.validarActualizacion.call(contexto as unknown as FederalActualizacion);
            else await Actualizacion.prototype.validarActualizacion.call(contexto as unknown as Actualizacion);
            expect(validarActualizacion).toHaveBeenCalled();
        });
        it(`envía la aprobación administrativa de ${federal ? 'Federal' : 'Consolidado'}`, async () =>
        {
            vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
            const aprobar = vi.fn().mockReturnValue(NEVER);
            const contexto = {
                periodoTexto: () => 'septiembre 2026',
                procesando: signal(null),
                esActualizacion: () => false,
                administracionService: { aprobar },
            };
            const carga = {
                codigoReferencia: 'PRUEBA',
                entidadFederativa: 'Hidalgo',
                mesCorte: 9,
                anioCorte: 2026,
            } as CargaPendienteAdministracionItem;
            if(federal) await FederalAprobacionCargas.prototype.aprobar.call(contexto as unknown as FederalAprobacionCargas, carga);
            else await AprobacionCargas.prototype.aprobar.call(contexto as unknown as AprobacionCargas, carga);
            expect(aprobar).toHaveBeenCalledWith('PRUEBA');
        });
        it(`envía la confirmación de carga de ${federal ? 'Federal' : 'Consolidado'}`, () =>
        {
            const confirmarCarga = vi.fn().mockReturnValue(NEVER);
            const contexto = {
                codigoReferenciaOperacion: () => 'PRUEBA',
                estado: signal('MOSTRANDO_ACUSE'),
                cargaService: { confirmarCarga },
                federalCargaService: { confirmarCarga },
            };
            if(federal) FederalCarga.prototype.aceptarCarga.call(contexto as unknown as FederalCarga);
            else CargaInicial.prototype.aceptarCarga.call(contexto as unknown as CargaInicial);
            expect(confirmarCarga).toHaveBeenCalledWith({ codigoReferencia: 'PRUEBA', aceptar: true });
        });
        it(`envía la confirmación de actualización de ${federal ? 'Federal' : 'Consolidado'}`, () =>
        {
            const confirmarActualizacion = vi.fn().mockReturnValue(NEVER);
            const contexto = {
                codigoReferenciaOperacion: () => 'PRUEBA',
                procesandoConfirmacion: signal(false),
                mensajeConfirmacion: signal(''),
                estadoPeriodo: signal('MOSTRANDO_ACUSE'),
                actualizacionService: { confirmarActualizacion },
            };
            if(federal) FederalActualizacion.prototype.aceptarActualizacion.call(contexto as unknown as FederalActualizacion);
            else Actualizacion.prototype.aceptarActualizacion.call(contexto as unknown as Actualizacion);
            expect(confirmarActualizacion).toHaveBeenCalledWith({ codigoReferencia: 'PRUEBA', aceptar: true });
        });
    }
});
