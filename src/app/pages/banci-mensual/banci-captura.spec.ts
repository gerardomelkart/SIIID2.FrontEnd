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
const scrollToOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo');
const scrollIntoViewOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
describe('Carga BANCI por cortes', () =>
{
    beforeEach(() =>
    {
        Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, writable: true, value: vi.fn() });
        Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:banci-prueba');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() =>
        {});
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: ActivatedRoute, useValue: { snapshot: { data: { manual: false, actualizacion: false } } } },
            ],
        });
    });
    afterEach(() =>
    {
        TestBed.inject(HttpTestingController).verify();
        vi.restoreAllMocks();
        if(scrollToOriginal) Object.defineProperty(Element.prototype, 'scrollTo', scrollToOriginal);
        else delete (Element.prototype as Partial<Element>).scrollTo;
        if(scrollIntoViewOriginal) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollIntoViewOriginal);
        else delete (Element.prototype as Partial<Element>).scrollIntoView;
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
    for(const actualizacion of [false, true]) {
        it(`abre directamente el Excel en ${actualizacion ? 'actualización' : 'carga'}`, () => {
            TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { actualizacion, manual: true } } } });
            const f = crear();
            expect(f.nativeElement.textContent).toContain('Plantilla BANCI precargada');
            expect(f.nativeElement.textContent).not.toContain('Manual o Masiva');
            expect(f.nativeElement.querySelector('#banci-captura-manual')).toBeNull();
            expect(f.componentInstance.titulo).toContain('masiva');
        });
        it(`valida únicamente el archivo en ${actualizacion ? 'actualización' : 'carga'}`, () => {
            TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { actualizacion } } } });
            const f = crear(); const c = f.componentInstance;
            c.libro.set({ entidad: 9, mes: 9, anio: 2026, actualizacion, carpetas: [], delitos: [], victimas: [] });
            c.plantillaDescargada.set(true);
            c.validar();
            const http = TestBed.inject(HttpTestingController);
            http.expectNone(r => r.url.endsWith('/validar/archivo'));
            c.archivo = new File(['excel'], 'original.xlsx'); c.validar();
            const req = http.expectOne(r => r.url.endsWith('/validar/archivo'));
            expect(req.request.body.get('archivo').name).toBe('original.xlsx');
            expect(req.request.body.get('actualizacion')).toBe(String(actualizacion));
            req.flush({ esValido: false, errores: [{ archivo: 'victimas', fila: 2, campo: 'nomb', mensaje: 'Requerido' }], advertencias: [] });
            f.detectChanges();
            expect(f.nativeElement.textContent).toContain('Requerido');
            http.expectNone(r => r.url.endsWith('/validar/manual'));
        });
    }
    it('oculta el recuadro al elegir archivo y permite reemplazarlo', () => {
        const f = crear(); const c = f.componentInstance;
        c.plantillaDescargada.set(true); c.archivo = new File(['x'], 'prueba.xlsx'); f.detectChanges();
        expect(f.nativeElement.querySelector('input[type=file]')).toBeNull();
        expect(f.nativeElement.textContent).toContain('Cargar otro archivo');
        c.cambiarArchivo(); f.detectChanges();
        expect(f.nativeElement.querySelector('input[type=file]')).not.toBeNull();
    });
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
        expect(f.componentInstance.arrastrandoArchivo()).toBe(false);
        expect(f.nativeElement.querySelector('label.archivo')).toBeNull();
        expect(f.componentInstance.archivo).toBe(archivo);
    });
    for(const actualizacion of [false, true])
    {
        it(`oculta el recuadro al elegir archivo y permite reemplazarlo en ${actualizacion ? 'actualización' : 'carga'}`, () =>
        {
            TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion } } } });
            const f = crear();
            f.componentInstance.plantillaDescargada.set(true);
            f.detectChanges();
            const entrada = f.nativeElement.querySelector('input[type="file"]');
            Object.defineProperty(entrada, 'files', { value: [new File(['datos'], 'prueba.xlsx')] });
            entrada.dispatchEvent(new Event('change'));
            f.detectChanges();
            expect(f.nativeElement.querySelector('label.archivo')).toBeNull();
            const botones = [...f.nativeElement.querySelectorAll('#banci-carga-archivo .acciones button')] as HTMLButtonElement[];
            expect(botones.map(b => b.textContent?.trim())).toEqual(['Validar información', 'Cargar otro archivo']);
            f.componentInstance.errores.set([{ archivo: 'victimas', fila: 2, campo: 'fub', mensaje: 'Complete el dato.' }]);
            botones[1].click();
            f.detectChanges();
            expect(f.componentInstance.archivo).toBeNull();
            expect(f.componentInstance.errores()).toEqual([]);
            expect(f.componentInstance.plantillaDescargada()).toBe(true);
            expect(f.nativeElement.querySelector('input[type="file"]')).not.toBeNull();
            expect(f.nativeElement.querySelector('#banci-carga-archivo .acciones')).toBeNull();
        });
    }
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
        expect(f.nativeElement.querySelectorAll('input[type="number"]').length).toBe(1);
        expect(f.nativeElement.querySelectorAll('select option').length).toBe(12);
    });
    it('permite actualizar meses anteriores con históricos desactivados y muestra nombres de mes', async () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { actualizacion: true } } } });
        const f = crear();
        await f.whenStable();
        f.detectChanges();
        expect(f.componentInstance.puedeElegirCorte()).toBe(true);
        expect(f.nativeElement.textContent).toContain('Mes a actualizar');
        expect(f.nativeElement.textContent).not.toContain('Periodo a reportar');
        const selector = f.nativeElement.querySelector('select') as HTMLSelectElement;
        expect(selector.disabled).toBe(false);
        expect(selector.options.length).toBe(12);
        expect(selector.selectedOptions[0].textContent).toContain('Septiembre');
        selector.selectedIndex = 0;
        selector.dispatchEvent(new Event('change'));
        await f.whenStable();
        expect(f.componentInstance.mes).toBe(1);
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
    it('un periodo sin carpetas pendientes rechaza la descarga y retira cualquier archivo previamente habilitado', async () =>
    {
        TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data: { manual: false, actualizacion: false } } } });
        const f = crear();
        f.componentInstance.plantillaDescargada.set(true);
        f.componentInstance.archivo = new File(['datos'], 'anterior.xlsx');
        const descarga = f.componentInstance.plantilla();
        TestBed.inject(HttpTestingController)
            .expectOne((r) => r.url.endsWith('/precarga'))
            .flush({ mensaje: 'Ya no hay carpetas pendientes para este periodo.' }, { status: 400, statusText: 'Bad Request' });
        await descarga;
        f.detectChanges();
        expect(f.componentInstance.mensaje()).toContain('Ya no hay carpetas pendientes');
        expect(f.componentInstance.plantillaDescargada()).toBe(false);
        expect(f.componentInstance.archivo).toBeNull();
        expect(f.nativeElement.querySelector('input[type="file"]')).toBeNull();
        TestBed.inject(HttpTestingController).expectNone((r) => r.url.endsWith('/plantilla'));
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
        const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
        f.detectChanges();
        expect(f.nativeElement.querySelector('.paso-descarga')).toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });
});
