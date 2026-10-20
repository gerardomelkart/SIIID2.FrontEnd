import { App } from './app';

describe('Recarga en BANCI', () =>
{
    const rutaAnterior = window.location.href;
    afterEach(() =>
    {
        vi.restoreAllMocks();
        window.history.replaceState(null, '', rutaAnterior);
    });
    for(const base of ['/siiid2/', '/siiid2-qa/'])
    {
        for(const ruta of ['banci', 'banci/carga-mensual', 'banci/actualizacion-mensual'])
        {
            it(`recarga ${base}${ruta} en el inicio de BANCI`, () =>
            {
                vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'reload' }] as unknown as PerformanceEntry[]);
                vi.spyOn(document, 'baseURI', 'get').mockReturnValue(`${window.location.origin}${base}`);
                window.history.replaceState(null, '', `${base}${ruta}`);
                const navegar = vi.fn();
                const iniciar = vi.fn();
                App.prototype.ngOnInit.call({ router: { navigateByUrl: navegar }, inactivityService: { iniciar } } as unknown as App);
                expect(iniciar).toHaveBeenCalledOnce();
                if(ruta === 'banci') expect(navegar).not.toHaveBeenCalled();
                else expect(navegar).toHaveBeenCalledWith('/banci');
            });
        }
    }
});
