# SIIID2.FrontEnd

Aplicación Angular de SIIID: Consolidado mensual, Semanal, Federal, BANCI y administración. Las versiones de dependencias están fijadas por `package-lock.json`.

## Desarrollo y compilación

```bash
npm ci
npm start
```

`npm start` utiliza `proxy.conf.json`. Revisar su destino antes de realizar operaciones de prueba.

```bash
npm run build:siiid2
npm run build:siiid2:qa
npm test -- --watch=false
```

Los dos comandos de compilación generan respectivamente las bases `/siiid2/` y `/siiid2-qa/`. Compilar no publica el sitio. El destino de API está definido en `src/app/core/constants/api-endpoints.constants.ts`: `api` en localhost, `/qa-api/api` bajo `/siiid2-qa` y `/beta/api` en el resto de despliegues.

## Organización

| Ubicación en `src/app/` | Responsabilidad |
|---|---|
| `pages/` | Pantallas y flujos de cada módulo. |
| `core/services/` | Comunicación con API y servicios compartidos. |
| `core/models/` | Contratos de datos. |
| `core/guards/` | Control de navegación; la API mantiene la autorización efectiva. |
| `core/constants/` y `core/utils/` | Constantes y utilidades compartidas. |
| `layout/` | Estructura de navegación y presentación. |
| `shared/styles/` | Estilos idénticos reutilizados por componentes. |

Los módulos comparten presentación cuando es equivalente, pero conservan sus flujos y reglas particulares.

## Estilos compartidos

- `carga-archivos.css`: carga inicial del Consolidado y carga Federal.
- `actualizacion-archivos.css`: actualización del Consolidado, actualización Federal y base de la carga Semanal.
- `usuarios-modulo.css`: usuarios de Semanal y Federal.

Cada componente referencia estos archivos mediante `styleUrl` o `styleUrls`; no son estilos globales. En carga Semanal, conservar el orden: primero el estilo compartido y luego `semanal-carga.css`, que aporta sus ajustes específicos. Antes de modificar un estilo compartido, revisar todos sus consumidores.

## Mantenimiento

Comentar decisiones del flujo, permisos y dependencias; evitar comentarios que solo repitan instrucciones. Buscar consumidores antes de retirar un servicio o modelo. Un endpoint sin consumidor en esta aplicación puede seguir atendiendo integraciones externas.

Validar compilación y pruebas de los módulos afectados. Los tests unitarios no sustituyen las pruebas de carga, aprobación/rechazo y descarga conectadas a la API de QA.

## Estilo de código

Usar cuatro espacios y llaves de bloques, clases e interfaces en una línea independiente. Mantener firmas y condiciones en una línea hasta 140 columnas. Los objetos conservan el formato de Prettier. Ejecutar `npm run format:estilo`: aplica Prettier y el estilo de llaves con TypeScript, comprobando que el árbol del código conserve su estructura. La configuración evita reformatear el contenido de plantillas literales. Los comentarios documentan permisos, flujos y recursos del navegador.

## BANCI mensual: vistas y operación

Se recuperó el diseño institucional original y se conectaron carga/actualización masiva y manual, informes, originales, aprobación administrativa y configuración al modelo mensual. Requiere el script `desarrollo/12_banci_mensual_operacion.sql` de SIIID2BD después del bloque 1.

Guía coordinada y prueba de QA: `SIIID2BD/documentacion/banci_operacion_mensual.md`. Conservar `ArchivosOriginalesBanci` al publicar API. El nuevo cruce del consolidado y las reclasificaciones permanecen en el bloque 5, desactivado.


### Ajustes BANCI: masiva completa, captura manual y acuse

Publicar API y Front de forma coordinada. Estos ajustes no requieren ningún cambio de BD ni scripts SQL nuevos.
Los motivos se consultan directamente en los catálogos existentes, con la misma consulta para manual y Excel.

- Masiva: la plantilla y la validación incluyen todas las carpetas, delitos y víctimas de desaparición
  del mensual aceptado para la entidad y corte, sin registros faltantes, adicionales o duplicados.
  Al integrar, se conservan los folios existentes y se registran los cambios.
- Manual: cada alta envía una carpeta elegida y sus hijos. Las aprobadas o enviadas a revisión dejan de
  aparecer como pendientes; se pueden enviar otras carpetas sin esperar la aprobación de las anteriores.
- Actualización manual y masiva: se integran solo víctimas modificadas y sus padres. La manual envía el
  subconjunto seleccionado; la masiva valida primero la coincidencia de la plantilla completa. El servidor
  protege identificadores y descarta registros sin cambios antes de preparar la operación.
- No localizada: condición de vida, fecha, condición y motivo de localización se ignoran y almacenan vacíos.
  La API aplica esta regla también al Excel y con validaciones de contenido desactivadas.
- Motivos constitutivos de delito: catálogo completo de modalidades con la jerarquía vigente del Semanal,
  conservando las claves generales anteriores. El catálogo de desaparición que delimita el mensual no cambia.
- Confirmación BANCI en morado. Acuse PDF en captura y reportes, con resumen y `no_banci` por víctima.
  El envío pendiente se distingue del confirmado; los folios nuevos se asignan al aprobar.

Validar los flujos contra la BD de desarrollo/QA antes de publicar en producción.
