export interface BanciFormularioDelito { datos: Record<string, string>; victimas: Record<string, string>[]; }
export interface BanciFormularioRequest { idEntidadFederativa: number | null; carpeta: Record<string, string>; delitos: BanciFormularioDelito[]; }
export interface BanciFormularioOpcion { campo: string; clave: string; descripcion: string; idEntidadFederativa: number | null; }
export interface BanciFormularioOpciones { esSuperUsuario: boolean; idEntidadFederativa: number | null; catalogos: BanciFormularioOpcion[]; }
export interface BanciFormularioCampo { clave: string; etiqueta: string; tipo: 'text' | 'textarea' | 'date' | 'time' | 'select'; obligatorio?: boolean; maximo?: number; ayuda?: string; }
