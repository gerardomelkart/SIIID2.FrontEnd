import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BanciCargaService } from './banci-carga.service';
import { BanciActualizacionService } from './banci-actualizacion.service';

describe('No enviar archivos BANCI inaccesibles', () => {
  const post = vi.fn((_url: string, _body: unknown) => of({}));
  beforeEach(() => { post.mockClear(); TestBed.configureTestingModule({ providers: [{ provide: HttpClient, useValue: { post } }] }); });
  afterEach(() => TestBed.resetTestingModule());
  it('bloquea el libro completo antes de realizar HTTP', async () => {
    await expect(firstValueFrom(TestBed.inject(BanciCargaService).validarLibro(new File(['x'], '~$libro.xlsx')))).rejects.toThrow('No se pudo leer');
    expect(post).not.toHaveBeenCalled();
  });
  it('bloquea los tres archivos si uno es temporal de Excel', async () => {
    const api = TestBed.inject(BanciCargaService);
    await expect(firstValueFrom(api.validarArchivos(new File(['x'], 'ci.xlsx'), new File(['x'], '~$delitos.xlsx'), new File(['x'], 'victimas.xlsx')))).rejects.toThrow('No se pudo leer');
    expect(post).not.toHaveBeenCalled();
  });
  it('bloquea la actualización antes de realizar HTTP', async () => {
    await expect(firstValueFrom(TestBed.inject(BanciActualizacionService).validarArchivo(new File(['x'], '~$actualizacion.xlsx')))).rejects.toThrow('No se pudo leer');
    expect(post).not.toHaveBeenCalled();
  });
  it('envía un archivo legible con la entidad explícita del superusuario', async () => {
    await firstValueFrom(TestBed.inject(BanciCargaService).validarLibro(new File(['x'], 'libro.xlsx'), 15));
    expect(post).toHaveBeenCalledOnce();
    const body = post.mock.calls[0][1] as FormData;
    expect(body.get('IdEntidadFederativa')).toBe('15');
    expect((body.get('ArchivoLibro') as File).name).toBe('libro.xlsx');
  });
});
