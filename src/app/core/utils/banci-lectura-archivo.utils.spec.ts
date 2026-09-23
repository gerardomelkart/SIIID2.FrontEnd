import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerArchivoBanci } from './banci-lectura-archivo.utils';

describe('Lectura de archivos BANCI antes de enviar', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('rechaza el archivo temporal de bloqueo de Excel', async () => {
    await expect(leerArchivoBanci(new File(['x'], '~$datos.xlsx'))).rejects.toThrow('Si está abierto en Excel, ciérrelo');
  });
  it('explica un fallo de lectura sin afirmar que Excel sea la única causa', async () => {
    vi.stubGlobal('FileReader', class { onerror: (() => void) | null = null; readAsArrayBuffer() { this.onerror?.(); } });
    await expect(leerArchivoBanci(new File(['x'], 'datos.xlsx'))).rejects.toMatchObject({ status: 400, error: { mensaje: expect.stringContaining('vuelva a seleccionarlo') } });
  });
  it('captura también los errores sincrónicos de acceso', async () => {
    vi.stubGlobal('FileReader', class { readAsArrayBuffer() { throw new DOMException('NotReadableError'); } });
    await expect(leerArchivoBanci(new File(['x'], 'datos.xlsx'))).rejects.toThrow('No se pudo leer');
  });
  it('devuelve una copia legible conservando nombre y tamaño', async () => {
    const original = new File(['contenido'], 'datos.xlsx', { lastModified: 123 });
    const copia = await leerArchivoBanci(original);
    expect(copia).not.toBe(original);
    expect(copia.name).toBe(original.name);
    expect(copia.size).toBe(original.size);
    expect(copia.lastModified).toBe(123);
  });
});
