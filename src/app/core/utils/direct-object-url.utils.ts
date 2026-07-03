const MARCADOR_URL_DIRECTA = '__siiidDirectObjectUrl';

type BlobConUrlDirecta = Blob & { [MARCADOR_URL_DIRECTA]?: string };
type CreateObjectUrlPatched = typeof URL.createObjectURL & { __siiidPatched?: boolean };
type RevokeObjectUrlPatched = typeof URL.revokeObjectURL & { __siiidPatched?: boolean };

export function crearBlobUrlDirecta(url: string): Blob {
  const blob = new Blob([], { type: 'application/x-siiid-direct-url' }) as BlobConUrlDirecta;
  blob[MARCADOR_URL_DIRECTA] = url;
  return blob;
}

export function instalarSoporteUrlDirecta(): void {
  const createActual = URL.createObjectURL as CreateObjectUrlPatched;

  if (!createActual.__siiidPatched) {
    const createOriginal = URL.createObjectURL.bind(URL);
    const createPatched = ((objeto: Blob | MediaSource) => {
      const urlDirecta = (objeto as BlobConUrlDirecta)[MARCADOR_URL_DIRECTA];
      return urlDirecta || createOriginal(objeto);
    }) as CreateObjectUrlPatched;

    createPatched.__siiidPatched = true;
    URL.createObjectURL = createPatched;
  }

  const revokeActual = URL.revokeObjectURL as RevokeObjectUrlPatched;

  if (!revokeActual.__siiidPatched) {
    const revokeOriginal = URL.revokeObjectURL.bind(URL);
    const revokePatched = ((url: string) => {
      if (url.startsWith('blob:')) {
        revokeOriginal(url);
      }
    }) as RevokeObjectUrlPatched;

    revokePatched.__siiidPatched = true;
    URL.revokeObjectURL = revokePatched;
  }
}

instalarSoporteUrlDirecta();
