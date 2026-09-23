export class BanciArchivoNoLegibleError extends Error {
  readonly status = 400;
  readonly error: { mensaje: string };
  constructor(nombre: string) {
    super(`No se pudo leer el archivo «${nombre}». Si está abierto en Excel, ciérrelo. Compruebe que existe y tiene permiso para leerlo; después vuelva a seleccionarlo.`);
    this.error = { mensaje: this.message };
  }
}

export function leerArchivoBanci(archivo: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (archivo.name.startsWith('~$')) { reject(new BanciArchivoNoLegibleError(archivo.name)); return; }
    const lector = new FileReader();
    lector.onerror = () => reject(new BanciArchivoNoLegibleError(archivo.name));
    lector.onabort = () => reject(new BanciArchivoNoLegibleError(archivo.name));
    lector.onload = () => {
      if (!(lector.result instanceof ArrayBuffer)) { reject(new BanciArchivoNoLegibleError(archivo.name)); return; }
      resolve(new File([lector.result], archivo.name, { type: archivo.type, lastModified: archivo.lastModified }));
    };
    try { lector.readAsArrayBuffer(archivo); } catch { reject(new BanciArchivoNoLegibleError(archivo.name)); }
  });
}
