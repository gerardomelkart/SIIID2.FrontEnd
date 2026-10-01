import Swal from 'sweetalert2';
import { exportarFilasExcel } from './excel-export.utils';
export interface ErrorCruce { codigo: string; mensaje: string; ntraCi?: string | null; entidadCruce?: number | null; archivo?: string; fila?: number | null; campo?: string; columna?: string; }
export const textoHtml = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g,c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export async function mostrarTablaCruce(errores: ErrorCruce[], acceso: boolean, modulo: string): Promise<boolean> {
  const nombre = modulo === 'federal' ? 'Federal' : 'Consolidado';
  const filas = errores.filter(e => e.codigo.startsWith('BANCI_')).map(e => ({
    Tipo: e.codigo === 'BANCI_OMITIDA' ? 'Falta en la carga' : e.codigo === 'BANCI_NO_REPORTADA' ? 'No reportada en BANCI' : 'Diferencia',
    Entidad: e.entidadCruce ?? '', Carpeta: e.ntraCi ?? '', Archivo: e.archivo ?? '', Fila: e.fila ?? '', Campo: e.campo || e.columna || '', Detalle: e.mensaje, Codigo: e.codigo
  }));
  if (!filas.length) return false;
  let pagina = 0, filtro = '', descargando = false;
  const eventos = new AbortController();
  const resultado = await Swal.fire({ icon: 'error', title: `Cruce ${nombre}–BANCI`, width: 'min(1200px, 96vw)',
    html: `<p>Faltantes: <b>${filas.filter(f => f.Tipo === 'Falta en la carga').length}</b> · No reportadas: <b>${filas.filter(f => f.Tipo === 'No reportada en BANCI').length}</b> · Diferencias: <b>${filas.filter(f => f.Tipo === 'Diferencia').length}</b></p>
      <p>Incluya las carpetas faltantes. Las no reportadas deben registrarse primero en BANCI y después volver a cargar ${nombre}.</p>
      ${acceso ? '' : '<p>Solicite a un usuario autorizado registrar o corregir la información en BANCI.</p>'}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px"><select id="cruce-filtro" aria-label="Filtrar incidencias" class="form-select" style="width:auto"><option value="">Todas las incidencias</option><option>Falta en la carga</option><option>No reportada en BANCI</option><option>Diferencia</option></select><button type="button" id="cruce-excel" class="btn btn-outline-primary">Descargar tabla completa</button></div>
      <div style="max-height:45vh;overflow:auto;text-align:left" tabindex="0" aria-label="Diferencias del cruce"><table class="table table-sm table-striped"><thead style="position:sticky;top:0;background:white"><tr><th>Tipo</th><th>Entidad</th><th>Carpeta</th><th>Archivo/fila</th><th>Campo</th><th>Detalle</th></tr></thead><tbody id="cruce-filas"></tbody></table></div>
      <div style="display:flex;justify-content:center;gap:16px;align-items:center;margin-top:12px"><button type="button" id="cruce-anterior" class="btn btn-outline-secondary">Anterior</button><span id="cruce-pagina" aria-live="polite"></span><button type="button" id="cruce-siguiente" class="btn btn-outline-secondary">Siguiente</button></div><p id="cruce-descarga-estado" role="status"></p>`,
    showCancelButton: acceso, confirmButtonText: acceso ? 'Ir a BANCI' : 'Cerrar', cancelButtonText: 'Cerrar',
    didOpen: popup => {
      const elemento = <T extends HTMLElement>(id: string) => popup.querySelector<T>('#' + id)!;
      const seleccionadas = () => filas.filter(f => !filtro || f.Tipo === filtro);
      const pintar = () => {
        const lista = seleccionadas(), paginas = Math.max(1, Math.ceil(lista.length / 50)); pagina = Math.min(pagina, paginas - 1);
        elemento('cruce-filas').innerHTML = lista.slice(pagina * 50, (pagina + 1) * 50).map(f => '<tr>' + [f.Tipo,f.Entidad,f.Carpeta,`${f.Archivo} ${f.Fila}`,f.Campo,f.Detalle].map(v => `<td style="min-width:90px;max-width:420px;white-space:normal;overflow-wrap:anywhere">${textoHtml(v)}</td>`).join('') + '</tr>').join('');
        elemento('cruce-pagina').textContent = `Página ${pagina + 1} de ${paginas} · ${lista.length} incidencias`;
        elemento<HTMLButtonElement>('cruce-anterior').disabled = pagina === 0;
        elemento<HTMLButtonElement>('cruce-siguiente').disabled = pagina + 1 >= paginas;
      };
      const opciones = { signal: eventos.signal };
      elemento<HTMLSelectElement>('cruce-filtro').addEventListener('change',e => { filtro = (e.target as HTMLSelectElement).value; pagina = 0; pintar(); },opciones);
      elemento('cruce-anterior').addEventListener('click',() => { pagina--; pintar(); },opciones);
      elemento('cruce-siguiente').addEventListener('click',() => { pagina++; pintar(); },opciones);
      elemento('cruce-excel').addEventListener('click',async () => {
        if (descargando) return; descargando = true; elemento<HTMLButtonElement>('cruce-excel').disabled = true;
        try { await exportarFilasExcel(seleccionadas().map(f => {
          const fila: Record<string, string | number> = { ...f, Detalle: f.Detalle.slice(0, 30000) };
          for (let i = 30000; i < f.Detalle.length; i += 30000) fila[`Detalle ${i / 30000 + 1}`] = f.Detalle.slice(i, i + 30000);
          return fila;
        }),`Cruce_${nombre}_BANCI.xlsx`,'Incidencias'); elemento('cruce-descarga-estado').textContent = 'Se descargaron todas las páginas del filtro seleccionado.'; }
        catch { elemento('cruce-descarga-estado').textContent = 'No fue posible generar el Excel. Reintente.'; }
        finally { descargando = false; elemento<HTMLButtonElement>('cruce-excel').disabled = false; }
      },opciones); pintar();
    }, willClose: () => eventos.abort()
  });
  return acceso && resultado.isConfirmed;
}
