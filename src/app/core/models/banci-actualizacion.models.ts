import { BanciCargaValidacionError } from './banci-carga.models';
import { BanciFormularioOpciones } from './banci-formulario.models';

export type BanciActualizacionOpciones = BanciFormularioOpciones;

export interface BanciActualizacionFormularioRequest {
  idEntidadFederativa: number | null;
  datos: Record<string, string | null>;
}

export interface BanciActualizacionConfirmacionRequest {
  aceptar: boolean;
  huellaVistaPrevia?: string | null;
  aceptarAdvertencias: boolean;
}

export interface BanciActualizacionCambio {
  id_banci_victima: number;
  no_banci: string;
  id_ci: string;
  id_delito: string;
  id_vicf: string;
  campo: string;
  anterior: string | null;
  nuevo: string | null;
}

export interface BanciActualizacionDatoPropuesto {
  id_banci_victima: number;
  [campo: string]: string | number | null;
}

export interface BanciActualizacionResultado {
  esValido: boolean;
  codigoReferencia: string | null;
  estado: string;
  huella: string | null;
  cambios: BanciActualizacionCambio[];
  datosPropuestos: BanciActualizacionDatoPropuesto[];
  errores: BanciCargaValidacionError[];
  advertencias: BanciCargaValidacionError[];
}

export interface BanciActualizacionConfirmacionResponse {
  codigoReferencia: string;
  estado: string;
  yaResuelta: boolean;
  totalCambios: number | null;
}

export interface BanciActualizacionEstado {
  codigoReferencia: string;
  estado: string;
  origen: string;
  idEntidadFederativa: number;
  fechaRegistro: string;
  fechaDecision: string | null;
  totalCambios: number | null;
}

export interface BanciActualizacionVictima {
  id_banci_victima: number;
  id_entidad_federativa: number;
  no_banci: string;
  id_ci: string;
  ntra_ci: string;
  id_delito: string;
  id_vicf: string;
  folio_rnpdno: string | null;
  pro_apellido: string | null;
  sdo_apellido: string | null;
  nomb: string | null;
  curp: string | null;
  localizado_o_no_localizado: number | null;
  con_o_sin_vida: number | null;
  fecha_localizacion: string | null;
  voluntaria_o_fue_delito: number | null;
  delito: string | null;
  acciones_busqueda: string | null;
  obs: string | null;
}

export interface BanciActualizacionBusquedaResponse {
  total: number;
  pagina: number;
  tamanoPagina: number;
  victimas: BanciActualizacionVictima[];
}