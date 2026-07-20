export interface ConfiguracionDelitoSemanalItem {
  idDelito: number;
  clave: string;
  delito: string;
  bienJuridico: string;
  seleccionado: boolean;
  esObligatorio: boolean;
  conservarEntrePeriodos: boolean;
  orden: number;
}

export interface ConfiguracionDelitoSemanalRequest {
  idDelito: number;
  seleccionado: boolean;
  orden: number;
}

export interface ActualizarConfiguracionDelitosSemanalesRequest {
  delitos: ConfiguracionDelitoSemanalRequest[];
}

export interface ConfiguracionDelitosSemanalesResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  totalSeleccionados: number;
  delitos: ConfiguracionDelitoSemanalItem[];
}