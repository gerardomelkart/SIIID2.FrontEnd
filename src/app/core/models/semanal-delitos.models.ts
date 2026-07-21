export interface ConfiguracionModalidadSemanalItem {
  idBienJuridico: number;
  claveBienJuridico: string;
  bienJuridico: string;
  idDelito: number;
  claveDelito: string;
  delito: string;
  idSubtipoDelito: number;
  claveSubtipo: string;
  subtipo: string;
  idModalidadDelito: number;
  claveModalidad: string;
  modalidad: string;
  seleccionado: boolean;
  esObligatorio: boolean;
  conservarEntrePeriodos: boolean;
  orden: number;
}

export interface ConfiguracionModalidadSemanalRequest {
  idModalidadDelito: number;
  seleccionado: boolean;
}

export interface ActualizarConfiguracionDelitosSemanalesRequest {
  modalidades: ConfiguracionModalidadSemanalRequest[];
}

export interface ConfiguracionDelitosSemanalesResponse {
  esValido: boolean;
  codigo: string;
  mensaje: string;
  totalSeleccionados: number;
  modalidades: ConfiguracionModalidadSemanalItem[];
}