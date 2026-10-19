export interface BanciFila
{
    numeroFila: number | null;
    columnas: Record<string, string | null>;
}
export interface BanciLibro
{
    entidad: number;
    mes: number;
    anio: number;
    actualizacion: boolean;
    manual?: boolean;
    cambios?: { carpeta: string; delito: string; victima: string; campo: string; anterior: string; nuevo: string }[];
    carpetas: BanciFila[];
    delitos: BanciFila[];
    victimas: BanciFila[];
}
export interface BanciOpcion
{
    clave: string;
    descripcion: string;
    codigo?: string;
    condicion?: number;
}
export interface BanciOpciones
{
    entidades: { id: number; nombre: string }[];
    catalogos: Record<string, BanciOpcion[]>;
    mes: number;
    anio: number;
    cortesAnteriores: boolean;
    version: number;
    complementos: string[];
    personales: string[];
    columnas: Record<'carpetas' | 'delitos' | 'victimas', string[]>;
    opciones: { clave: string; descripcion: string; habilitado: boolean; disponible: boolean }[];
}
export interface BanciError
{
    archivo: string;
    fila: number | null;
    campo: string;
    mensaje: string;
}
export interface BanciValidacion
{
    esValido: boolean;
    referencia?: string;
    carpetas?: number;
    delitos?: number;
    victimas?: number;
    errores: BanciError[];
    advertencias?: BanciError[];
}
export interface BanciEnvio
{
    id: number;
    referencia: string;
    entidad: number;
    entidadNombre: string;
    mes: number;
    anio: number;
    tipo: string;
    estado: string;
    nombreUsuario: string;
    fecha: string;
    motivo: string | null;
    manual: boolean;
    tieneOriginal: boolean;
}

export interface BanciPeriodo { anio: number; mes: number; }
