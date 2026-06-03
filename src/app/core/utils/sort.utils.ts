export type DireccionOrden = 'asc' | 'desc';

export interface EstadoOrden<TCampo extends string> {
  campo: TCampo;
  direccion: DireccionOrden;
}

export type ValorOrden = string | number | boolean | Date | null | undefined;

export function alternarOrden<TCampo extends string>(
  actual: EstadoOrden<TCampo> | null,
  campo: TCampo
): EstadoOrden<TCampo> {
  if (actual?.campo === campo) {
    return {
      campo,
      direccion: actual.direccion === 'asc' ? 'desc' : 'asc'
    };
  }

  return {
    campo,
    direccion: 'asc'
  };
}

export function obtenerIconoOrden<TCampo extends string>(
  actual: EstadoOrden<TCampo> | null,
  campo: TCampo
): string {
  if (actual?.campo !== campo) {
    return 'fa-solid fa-sort sort-icon';
  }

  return actual.direccion === 'asc'
    ? 'fa-solid fa-sort-up sort-icon active'
    : 'fa-solid fa-sort-down sort-icon active';
}

export function ordenarPorEstado<TItem, TCampo extends string>(
  lista: TItem[],
  orden: EstadoOrden<TCampo> | null,
  obtenerValor: (item: TItem, campo: TCampo) => ValorOrden
): TItem[] {
  if (!orden) {
    return lista;
  }

  return [...lista].sort((a, b) => {
    const valorA = obtenerValor(a, orden.campo);
    const valorB = obtenerValor(b, orden.campo);
    const resultado = compararValoresOrden(valorA, valorB);

    return orden.direccion === 'asc' ? resultado : resultado * -1;
  });
}

export function compararValoresOrden(valorA: ValorOrden, valorB: ValorOrden): number {
  if (valorA === null || valorA === undefined || valorA === '') {
    return 1;
  }

  if (valorB === null || valorB === undefined || valorB === '') {
    return -1;
  }

  if (typeof valorA === 'boolean' && typeof valorB === 'boolean') {
    return Number(valorA) - Number(valorB);
  }

  if (typeof valorA === 'number' && typeof valorB === 'number') {
    return valorA - valorB;
  }

  if (valorA instanceof Date && valorB instanceof Date) {
    return valorA.getTime() - valorB.getTime();
  }

  return String(valorA).localeCompare(String(valorB), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}