export interface BanciConsultaOpciones {
  alcanceNacional: boolean;
  anios: number[];
  entidades: { idEntidadFederativa: number; nombre: string }[];
}

export interface BanciConsultaFiltro {
  anio: number;
  mes: number | null;
  idEntidadFederativa: number | null;
  busqueda: string;
  pagina: number;
  tamanoPagina: number;
}

export interface BanciConsultaCarpeta {
  idBanciCarpetaInvestigacion: number;
  idEntidadFederativa: number;
  entidad: string;
  idCi: string;
  ntraCi: string;
  fechaInicio: string;
  totalDelitos: number;
  totalVictimas: number;
}

export interface BanciConsultaResultado {
  totalCarpetas: number;
  totalDelitos: number;
  totalVictimas: number;
  pagina: number;
  tamanoPagina: number;
  totalPaginas: number;
  carpetas: BanciConsultaCarpeta[];
}

export interface BanciCampoConsulta { nombre: string; valor: string | null; }

export interface BanciConsultaDetalle {
  carpeta: BanciCampoConsulta[];
  delitos: { id: number; campos: BanciCampoConsulta[]; victimas: BanciCampoConsulta[][] }[];
}
