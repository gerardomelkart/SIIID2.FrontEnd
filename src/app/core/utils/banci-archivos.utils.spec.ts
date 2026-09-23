import { describe, expect, it } from 'vitest';
import { fechaBanci, nombreExcelBanci } from './banci-archivos.utils';

describe('Nombres de Excel BANCI', () => {
  it('usa el folio individual y elimina separadores de ruta', () => {
    expect(nombreExcelBanci('actualizacion', 'Jalisco', 'BANCI/14/2026/000001')).toBe('BANCI_14_2026_000001_actualizacion.xlsx');
  });

  it('usa entidad y fecha de integración en cargas masivas', () => {
    expect(nombreExcelBanci('integracion', 'México', null, '2026-09-23T11:00:00')).toBe('BANCI_integracion_Mexico_2026-09-23.xlsx');
  });

  it('usa el día de Ciudad de México y no el día UTC cercano a medianoche', () => {
    expect(fechaBanci(new Date('2026-09-23T02:00:00Z'))).toBe('2026-09-22');
  });
});
