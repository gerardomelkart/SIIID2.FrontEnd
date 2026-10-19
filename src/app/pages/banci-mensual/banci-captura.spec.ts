import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import Swal from 'sweetalert2';
import { BanciOpciones } from '../../core/models/banci-mensual.models';
import { BanciCaptura } from './banci-captura';
const opciones: BanciOpciones = {
    version: 1,
    personales: [],
    opciones: [],
    entidades: [{ id: 9, nombre: 'Ciudad de México' }],
    mes: 9,
    anio: 2026,
    cortesAnteriores: false,
    complementos: ['nomb', 'curp', 'localizado_o_no_localizado', 'constitutiva_delito', 'motivo_desaparicion'],
    columnas: { carpetas: [], delitos: [], victimas: [] },
    catalogos: {
        localizacion: [
            { clave: '45', descripcion: 'Localizado', codigo: 'LOCALIZADO' },
            { clave: '49', descripcion: 'No localizado', codigo: 'NO_LOCALIZADO' },
        ],
        motivos: [{ condicion: 17, clave: '4', descripcion: 'Motivo desde BD' }],
    },
};
describe('Carga BANCI por cortes', () =>
{
    beforeEach(() =>
    {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:banci-prueba');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() =>
        {});
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ActivatedRoute, useValue: { snapshot: { data: { manual: true, actualizacion: false } } } },
            ],
        });
    });
    afterEach(() =>
    {
        TestBed.inject(HttpTestingController).verify();
        vi.restoreAllMocks();
    });
    function crear()
    {
        const fixture = TestBed.createComponent(BanciCaptura);
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/opciones'))
            .flush(opciones);
        fixture.detectChanges();
        return fixture;
    }
    for(const actualizacion of [false, true])
    {
        it(`permite regresar a la selección de ${actualizacion ? 'actualización' : 'carga'}`, () =>
        {
            TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion } } } });
            const f = crear();
            expect(f.nativeElement.querySelector('.volver-modalidad').getAttribute('href')).toBe(actualizacion ? '/banci/actualizacion-mensual' : '/banci/carga-mensual');
        });
    }
    it('resalta el área al arrastrar y retira el resaltado al soltar el archivo', () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false } } } });
        const f = crear();
        f.componentInstance.plantillaDescargada.set(true);
        f.detectChanges();
        const zona = f.nativeElement.querySelector('label.archivo');
        zona.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
        f.detectChanges();
        expect(zona.classList.contains('arrastrando')).toBe(true);
        const archivo = new File(['prueba'], 'BANCI.xlsx');
        const soltar = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(soltar, 'dataTransfer', { value: { files: [archivo] } });
        zona.dispatchEvent(soltar);
        f.detectChanges();
        expect(zona.classList.contains('arrastrando')).toBe(false);
        expect(f.componentInstance.archivo).toBe(archivo);
    });
    it('usa el corte del servidor y bloquea su selección al desactivar históricos', async () =>
    {
        const f = crear();
        expect(f.componentInstance.mes).toBe(9);
        expect(f.componentInstance.anio).toBe(2026);
        await f.whenStable();
        f.detectChanges();
        const numeros = f.nativeElement.querySelectorAll('input[type="number"]');
        expect(numeros.length).toBe(0);
        expect(f.nativeElement.querySelector('select')).toBeNull();
        expect(f.nativeElement.textContent).toContain('septiembre de 2026');
    });
    it('muestra el corte solamente al habilitar los históricos', () =>
    {
        const f = crear();
        f.componentInstance.opciones.set({ ...opciones, cortesAnteriores: true });
        f.detectChanges();
        expect(f.nativeElement.querySelectorAll('input[type="number"]').length).toBe(2);
    });
    it('impide cargar archivos antes de descargar la plantilla', () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: false } } } });
        const f = crear();
        const archivo = new File(['prueba'], 'prueba.xlsx');
        f.componentInstance.archivoSeleccionado({ target: { files: [archivo] } } as unknown as Event);
        expect(f.componentInstance.archivo).toBeNull();
        expect(f.nativeElement.querySelector('input[type="file"]')).toBeNull();
        f.componentInstance.plantillaDescargada.set(true);
        f.detectChanges();
        expect(f.nativeElement.querySelector('input[type="file"]')).not.toBeNull();
        f.componentInstance.limpiar();
        f.detectChanges();
        expect(f.nativeElement.querySelector('input[type="file"]')).toBeNull();
    });
    it('cancelar el aviso no descarga ni habilita la carga', async () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: false } } } });
        const aviso = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true });
        const f = crear();
        const descarga = f.componentInstance.plantilla();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga'))
            .flush({
                entidad: 9,
                mes: 9,
                anio: 2026,
                actualizacion: false,
                carpetas: [{ numeroFila: 2, columnas: { id_ci: '1' } }],
                delitos: [],
                victimas: [],
            });
        await descarga;
        expect(aviso).toHaveBeenCalledWith(expect.objectContaining({ title: 'Descargar información precargada', showCancelButton: true }));
        TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/plantilla'));
        expect(f.componentInstance.plantillaDescargada()).toBe(false);
        expect(f.componentInstance.ocupado()).toBe(false);
    });
    it('muestra la validación manual solamente al modificar datos y la oculta al revertirlos', () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: true, actualizacion: true } } } });
        const f = crear();
        f.componentInstance.precargar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga'))
            .flush({
                entidad: 9,
                mes: 9,
                anio: 2026,
                actualizacion: true,
                carpetas: [{ numeroFila: 2, columnas: { id_ci: '1', ntra_ci: 'CARPETA' } }],
                delitos: [],
                victimas: [{ numeroFila: 2, columnas: { id_ci: '1', id_delito: '1', id_vicf: '1', nomb: 'Persona' } }],
            });
        f.detectChanges();
        expect(f.componentInstance.hayCambios()).toBe(false);
        expect(f.nativeElement.querySelector('.panel.acciones')).toBeNull();
        f.componentInstance.validar();
        TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/validar/manual'));
        const victima = f.componentInstance.libro()!.victimas[0];
        f.componentInstance.editar('nomb', victima, 'Persona actualizada');
        f.detectChanges();
        expect(f.componentInstance.hayCambios()).toBe(true);
        expect(f.nativeElement.querySelector('.panel.acciones')).not.toBeNull();
        f.componentInstance.editar('nomb', victima, 'Persona');
        f.detectChanges();
        expect(f.componentInstance.hayCambios()).toBe(false);
    });
    it('no duplica los datos personales del origen en el formulario', () =>
    {
        const f = crear();
        for(const campo of ['nombre_vicfem', '1apellido_vicfem', '2apellido_vicfem', 'curp_vicfem'])
            expect(f.componentInstance.mostrarProtegido(campo)).toBe(false);
        expect(f.componentInstance.mostrarProtegido('id_ci')).toBe(true);
        expect(f.componentInstance.mostrarProtegido('id_tv')).toBe(true);
    });
    it('al validar desplaza la vista al informe y retira el botón de validación', async () =>
    {
        const f = crear();
        f.componentInstance.libro.set({ entidad: 9, mes: 9, anio: 2026, actualizacion: false, carpetas: [], delitos: [], victimas: [] });
        f.componentInstance.seleccion.set({ numeroFila: 2, columnas: { id_ci: '1' } });
        f.componentInstance.validar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/validar/manual'))
            .flush({ esValido: true, referencia: 'prueba', errores: [], advertencias: [] });
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/envios/prueba/acuse'))
            .flush(new Blob(['pdf'], { type: 'application/pdf' }));
        f.detectChanges();
        const informe = f.nativeElement.querySelector('#banci-informe');
        const scroll = vi.fn();
        Object.defineProperty(informe, 'scrollIntoView', { value: scroll });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
        expect(f.nativeElement.querySelector('.panel.acciones')).toBeNull();
    });
    it('no muestra registros inventados cuando la precarga falla', () =>
    {
        const f = crear();
        f.componentInstance.precargar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga'))
            .flush({ mensaje: 'Sin consolidado aceptado' }, { status: 400, statusText: 'Bad Request' });
        expect(f.componentInstance.libro()).toBeNull();
        expect(f.componentInstance.mensaje()).toContain('Sin consolidado');
    });
    it('resuelve motivos y estados con claves de catálogo diferentes', () =>
    {
        const f = crear();
        const fila = {
            numeroFila: 2,
            columnas: { constitutiva_delito: '17', motivo_desaparicion: '4', fecha_localizacion: '2026-09-01' } as Record<string, string>,
        };
        expect(f.componentInstance.catalogo('motivo_desaparicion', fila)?.[0].descripcion).toBe('Motivo desde BD');
        f.componentInstance.editar('constitutiva_delito', fila, '18');
        expect(fila.columnas['motivo_desaparicion']).toBe('');
        f.componentInstance.editar('localizado_o_no_localizado', fila, '49');
        expect(fila.columnas['fecha_localizacion']).toBe('');
    });
    it('envía los datos por el endpoint manual y conserva los errores por fila', () =>
    {
        const f = crear();
        f.componentInstance.libro.set({ entidad: 9, mes: 9, anio: 2026, actualizacion: false, carpetas: [], delitos: [], victimas: [] });
        f.componentInstance.seleccion.set({ numeroFila: 2, columnas: { id_ci: '1' } });
        f.componentInstance.validar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/validar/manual'))
            .flush({ esValido: false, errores: [{ archivo: 'victimas', fila: 2, campo: 'curp', mensaje: 'CURP inválida' }] });
        expect(f.componentInstance.errores()[0].campo).toBe('curp');
        expect(f.componentInstance.validacion()).toBeNull();
    });
    it('la captura manual envía solo la carpeta seleccionada y conserva sus hijos', () =>
    {
        const f = crear();
        const carpetas = ['1', '2'].map((id) => ({ numeroFila: Number(id) + 1, columnas: { id_ci: id } }));
        f.componentInstance.libro.set({
            entidad: 9,
            mes: 9,
            anio: 2026,
            actualizacion: false,
            carpetas,
            delitos: ['1', '2'].map((id) => ({ numeroFila: Number(id) + 1, columnas: { id_ci: id, id_delito: 'D' } })),
            victimas: ['1', '2'].map((id) => ({ numeroFila: Number(id) + 1, columnas: { id_ci: id, id_delito: 'D', id_vicf: 'V' } })),
        });
        expect(f.componentInstance.libroParaEnviar()).toBeNull();
        f.componentInstance.seleccionar(carpetas[1]);
        const envio = f.componentInstance.libroParaEnviar()!;
        expect(envio.manual).toBe(true);
        expect(envio.carpetas.map((r) => r.columnas['id_ci'])).toEqual(['2']);
        expect(envio.delitos.map((r) => r.columnas['id_ci'])).toEqual(['2']);
        expect(envio.victimas.map((r) => r.columnas['id_ci'])).toEqual(['2']);
    });
    it('la actualización manual envía una víctima modificada y excluye las demás', () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: true, actualizacion: true } } } });
        const f = crear();
        f.componentInstance.precargar();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga') && r.params.get('manual') === 'true')
            .flush({
                entidad: 9,
                mes: 9,
                anio: 2026,
                actualizacion: true,
                carpetas: [{ numeroFila: 2, columnas: { id_ci: '1' } }],
                delitos: [{ numeroFila: 2, columnas: { id_ci: '1', id_delito: 'D' } }],
                victimas: ['1', '2'].map((id) => ({
                    numeroFila: Number(id) + 1,
                    columnas: { id_ci: '1', id_delito: 'D', id_vicf: id, nomb: 'Persona' },
                })),
            });
        f.componentInstance.editar('nomb', f.componentInstance.libro()!.victimas[1], 'Persona modificada');
        f.componentInstance.validar();
        const envio = TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/validar/manual'));
        expect(envio.request.body.victimas.length).toBe(1);
        expect(envio.request.body.victimas[0].columnas.id_vicf).toBe('2');
        expect(envio.request.body.carpetas.length).toBe(1);
        expect(envio.request.body.delitos.length).toBe(1);
        envio.flush({ esValido: false, errores: [] });
    });
    it('oculta condición de vida y datos de localización mientras siga no localizada', () =>
    {
        const f = crear();
        f.componentInstance.opciones.set({
            ...opciones,
            complementos: [
                'localizado_o_no_localizado',
                'con_o_sin_vida',
                'fecha_localizacion',
                'constitutiva_delito',
                'motivo_desaparicion',
            ],
        });
        const fila = { numeroFila: 2, columnas: { localizado_o_no_localizado: '49', con_o_sin_vida: '' } };
        expect(f.componentInstance.camposVictima(fila)).toEqual(['localizado_o_no_localizado']);
        fila.columnas.localizado_o_no_localizado = '45';
        expect(f.componentInstance.camposVictima(fila)).toContain('con_o_sin_vida');
    });
    it('la masiva conserva todas las filas para validar coincidencia exacta en servidor', () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: false } } } });
        const f = crear();
        const libro = { entidad: 9, mes: 9, anio: 2026, actualizacion: false, carpetas: [], delitos: [], victimas: [] };
        f.componentInstance.libro.set(libro);
        expect(f.componentInstance.libroParaEnviar()).toBe(libro);
        expect(f.nativeElement.textContent).not.toContain('Las cargas adicionales se suman');
    });
    it('la actualización masiva muestra los mismos pasos y bloquea el archivo hasta descargar', () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: true } } } });
        const f = crear();
        expect(f.nativeElement.querySelector('.paso-descarga')).not.toBeNull();
        expect(f.nativeElement.querySelector('.paso-carga')).not.toBeNull();
        expect(f.nativeElement.querySelector('input[type="file"]')).toBeNull();
        f.componentInstance.archivoSeleccionado({ target: { files: [new File(['datos'], 'actualizacion.xlsx')] } } as unknown as Event);
        expect(f.componentInstance.archivo).toBeNull();
        f.componentInstance.plantillaDescargada.set(true);
        f.detectChanges();
        expect(f.nativeElement.querySelector('input[type="file"]')).not.toBeNull();
    });
    it('la descarga de actualización precarga los aprobados y permite cancelar antes de habilitar el archivo', async () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: true } } } });
        const aviso = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false, isDenied: false, isDismissed: true });
        const f = crear();
        const descarga = f.componentInstance.plantilla();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga') && r.params.get('actualizacion') === 'true')
            .flush({
                entidad: 9,
                mes: 9,
                anio: 2026,
                actualizacion: true,
                carpetas: [{ numeroFila: 2, columnas: { id_ci: '1' } }],
                delitos: [],
                victimas: [],
            });
        await descarga;
        expect(aviso).toHaveBeenCalledWith(expect.objectContaining({ title: 'Descargar plantilla de actualización' }));
        expect(f.componentInstance.plantillaDescargada()).toBe(false);
        TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/plantilla'));
    });
    it('un periodo ya registrado rechaza la descarga y retira cualquier archivo previamente habilitado', async () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: false } } } });
        const f = crear();
        f.componentInstance.plantillaDescargada.set(true);
        f.componentInstance.archivo = new File(['datos'], 'anterior.xlsx');
        const descarga = f.componentInstance.plantilla();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga'))
            .flush({ mensaje: 'El periodo ya tiene información BANCI registrada.' }, { status: 400, statusText: 'Bad Request' });
        await descarga;
        f.detectChanges();
        expect(f.componentInstance.mensaje()).toContain('ya tiene información BANCI');
        expect(f.componentInstance.plantillaDescargada()).toBe(false);
        expect(f.componentInstance.archivo).toBeNull();
        expect(f.nativeElement.querySelector('input[type="file"]')).toBeNull();
        TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/plantilla'));
    });
    it('abre el acuse previo y lo reemplaza por el final al aceptar, sin descargarlo', async () =>
    {
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
        const f = crear();
        const c = f.componentInstance;
        const http = TestBed.inject(HttpTestingController);
        c.validacion.set({ esValido: true, referencia: 'acuse-prueba', errores: [] });
        c.mostrarAcuse('acuse-prueba');
        http.expectOne((r) => r.url.endsWith('/envios/acuse-prueba/acuse')).flush(new Blob(['previo'], { type: 'application/pdf' }));
        f.detectChanges();
        expect(f.nativeElement.querySelector('.acuse-modal iframe')).not.toBeNull();
        await c.confirmar(true);
        http.expectOne((r) => r.url.endsWith('/envios/acuse-prueba/confirmar')).flush({ estado: 'CONFIRMADO' });
        http.expectOne((r) => r.url.endsWith('/envios/acuse-prueba/acuse')).flush(new Blob(['final'], { type: 'application/pdf' }));
        f.detectChanges();
        expect(c.ultimoEnvio()?.estado).toBe('CONFIRMADO');
        expect(f.nativeElement.querySelector('.acuse-modal iframe')).not.toBeNull();
        expect(f.nativeElement.textContent).not.toContain('Descargar acuse PDF');
        c.cerrarAcuse();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
        expect(c.acuseUrl()).toBeNull();
    });
    it('oculta el bloque de descarga y desplaza a la carga de archivo al obtener la plantilla', async () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: true } } } });
        vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true, isDenied: false, isDismissed: false });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() =>
        {});
        const f = crear();
        const descarga = f.componentInstance.plantilla();
        const http = TestBed.inject(HttpTestingController);
        http.expectOne((r) => r.url.endsWith('/precarga')).flush({
            entidad: 9,
            mes: 9,
            anio: 2026,
            actualizacion: true,
            carpetas: [{ numeroFila: 2, columnas: { id_ci: '1' } }],
            delitos: [],
            victimas: [],
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        http.expectOne((r) => r.url.endsWith('/plantilla')).flush(new Blob(['excel']));
        await descarga;
        f.detectChanges();
        expect(f.nativeElement.querySelector('.paso-descarga')).toBeNull();
        const scroll = vi.fn();
        Object.defineProperty(f.nativeElement.querySelector('#banci-carga-archivo'), 'scrollIntoView', { value: scroll });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });
    it('desplaza hacia el estado de proceso al validar una carga manual', async () =>
    {
        const f = crear();
        f.componentInstance.libro.set({ entidad: 9, mes: 9, anio: 2026, actualizacion: false, carpetas: [], delitos: [], victimas: [] });
        f.componentInstance.seleccion.set({ numeroFila: 2, columnas: { id_ci: '1' } });
        f.componentInstance.validar();
        f.detectChanges();
        const scroll = vi.fn();
        Object.defineProperty(f.nativeElement.querySelector('#banci-proceso'), 'scrollIntoView', { value: scroll });
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/validar/manual'))
            .flush({ esValido: false, errores: [] });
    });
});
