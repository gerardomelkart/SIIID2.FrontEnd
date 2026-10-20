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


### Ajustes BANCI: carga de pendientes, captura manual y acuse

Publicar API y Front de forma coordinada. Estos ajustes no requieren ningún cambio de BD ni scripts SQL nuevos.
Los motivos se consultan directamente en los catálogos existentes, con la misma consulta para manual y Excel.

- Masiva: la plantilla incluye todas las carpetas pendientes del mensual aceptado para la entidad y corte,
  con sus delitos y víctimas de desaparición. Excluye las aprobadas o enviadas a revisión en ambas modalidades.
  La validación exige la plantilla pendiente completa, sin faltantes, adicionales ni duplicados. Al completar
  el periodo ya no se permite otra alta; se utiliza Actualización para modificar lo aprobado.
- Manual: cada alta envía una carpeta elegida y sus hijos. Las aprobadas o enviadas a revisión dejan de
  aparecer como pendientes; se pueden enviar otras carpetas sin esperar la aprobación de las anteriores.
- Actualización manual y masiva: se integran solo víctimas modificadas y sus padres. La manual envía el
  subconjunto seleccionado; la masiva valida primero la coincidencia de la plantilla completa. El servidor
  protege identificadores y descarta registros sin cambios antes de preparar la operación.
- No localizada: condición de vida, fecha, condición y motivo de localización se ignoran y almacenan vacíos.
  La API aplica esta regla también al Excel y con validaciones de contenido desactivadas.
- Motivos constitutivos de delito: catálogo completo de modalidades con la jerarquía vigente del Semanal,
  conservando las claves generales anteriores. El catálogo de desaparición que delimita el mensual no cambia.
- Confirmación y visor BANCI en morado. El acuse no muestra la referencia interna de carga y distingue Ciudad de México de los estados. Acuse PDF con el mismo formato institucional del Consolidado (logos, encabezado, pie y tablas), con resumen y `no_banci` por víctima.
- Actualización masiva usa los mismos dos pasos de Carga: descargar plantilla precargada y cargar el Excel completado; el archivo solo se habilita después de descargar.
  El envío pendiente se distingue del confirmado; los folios nuevos se asignan al aprobar.

Validar los flujos contra la BD de desarrollo/QA antes de publicar en producción.


### Flujo mensual BANCI

Carga mensual y Actualización mensual ofrecen un selector Manual/Masiva y conservan sus permisos.
La descarga de plantilla oculta su bloque y desplaza al siguiente paso; validar desplaza al resultado.
El informe previo y el acuse final se muestran en el visor de PDF con Aceptar/Rechazar/Cerrar,
sin descarga automática. Los reportes permiten abrir ese mismo visor.
Las plantillas y formularios BANCI no incluyen las columnas heredadas de feminicidio.
Estos ajustes no modifican objetos de BD ni el flujo de Consolidado, Federal o Semanal.

### Descarga administrativa de diferencias completas

En Aprobación administrativa de Mensual, Federal, Semanal y BANCI se ofrece **Descargar todas las diferencias en Excel**. La muestra de pantalla permanece limitada a 100 registros por sección en los tres primeros módulos; la descarga consulta el detalle completo de forma independiente, incluso si no se pudo cargar la muestra.

La API exige rol SUPER_USUARIO y acceso al módulo correspondiente. El archivo contiene Carpetas, Delitos y Víctimas con movimiento, identificador, campo y valores anterior/propuesto, filtros y encabezados inmovilizados. Los textos extensos continúan en filas marcadas como continuación, sin una columna Parte, y las hojas se dividen al alcanzar el límite de filas de Excel. Se genera en un archivo temporal eliminado al terminar la descarga, sin enviar el detalle completo al navegador como JSON ni renderizarlo en tablas.

Publicar API y frontend de forma coordinada. No requiere scripts ni cambios en la estructura de la base de datos.

### Plantillas y colores por módulo

Las plantillas vacías de Mensual (guinda), Federal (azul) y Semanal (verde) se generan desde la API con sus encabezados oficiales, formato de texto y primera fila inmovilizada. Carga y Actualización solicitan el mismo generador; ya no dependen de archivos XLSX estáticos del frontend. BANCI conserva su plantilla morada precargada con información del periodo.

La exportación administrativa de diferencias usa el color del módulo en el Excel y el botón. Durante su generación y descarga se bloquea la interacción con un aviso de que puede tardar varios minutos cuando existen muchas modificaciones; se desbloquea tanto al terminar como ante un error.

### Consulta de envíos BANCI y originales masivos

BANCI utiliza una consulta de envíos independiente con el mismo esquema visual del informe mensual: cortes disponibles, búsqueda, ordenamiento, paginación, estados legibles, exportación de la tabla, vista PDF y ZIP de acuses del corte. Muestra los envíos remitidos o resueltos administrativamente; las validaciones sin enviar no forman parte del historial de envíos. El alcance de entidad y los permisos se verifican en la API.

Los originales corresponden únicamente a cargas y actualizaciones masivas. La captura manual mantiene su snapshot y datos propuestos para revisión y acuse, pero no genera ni almacena un XLSX artificial. Los originales manuales anteriores se excluyen del listado y se bloquea su descarga, sin eliminar registros ni ejecutar scripts de limpieza. Las operaciones masivas conservan exactamente el archivo recibido.

### Reporte de cargas y archivos originales BANCI

El reporte de cargas sigue el esquema mensual por corte: entidades con carga en pantalla y todas las entidades activas en la exportación Excel (incluidas las que no tienen carga), intentos manuales y masivos, último estado, fechas y ranking por primera carga enviada correctamente. Una resolución rechazada no se presenta como fecha de aprobación.

Archivos originales muestra el último archivo masivo recibido por entidad entre todos los periodos, con nombre original, tamaño y descarga íntegra XLSX o ZIP. Excluye capturas manuales y conserva los archivos anteriores almacenados. Ambos reportes requieren SUPER_USUARIO y ofrecen búsqueda, ordenamiento, paginación y exportación de la tabla.

Publicar API y frontend juntos. No requiere cambios de base de datos.

Los nuevos originales masivos BANCI se guardan con el nombre recibido dentro de una carpeta por envío, sin regenerar el XLSX. Se mantiene la lectura de archivos anteriores almacenados como GUID.xlsx. No requiere migración ni scripts.

### Aprobación administrativa BANCI

La bandeja de aprobación sigue la presentación del mensual con búsqueda, ordenamiento, paginación y revisión por envío, incluidos pendientes de años anteriores. Muestra entidad, corte, modalidad manual/masiva, remitente, fecha y totales de carpetas, delitos y víctimas.

La revisión presenta totales completos y muestras de hasta 100 registros/cambios; la descarga administrativa existente conserva todas las diferencias y su bloqueo durante la generación. Permite consultar el informe previo y descargar el original masivo con su nombre recibido. Las capturas manuales no ofrecen archivo original. Aprobar solicita confirmación; rechazar requiere un motivo de al menos cinco caracteres. La resolución bloquea la interacción hasta terminar y actualiza la bandeja al completarse.

Los nuevos endpoints de pendientes y revisión exigen SUPER_USUARIO y acceso administrativo BANCI. Publicar API y frontend juntos; no se requieren scripts ni cambios de estructura de base de datos.

### Configuración de permisos BANCI

La configuración de BANCI usa el mismo diseño que el consolidado: controles globales de carga y actualización, resumen por entidad, búsqueda, ordenamiento, paginación, Excel y panel de permisos individuales. Los estados globales se calculan desde las cuentas activas; los administradores generales quedan fuera de la gestión operativa y los usuarios CONSULTA no pueden cargar ni actualizar. Los cambios individuales utilizan el endpoint exclusivo de permisos BANCI, sin editar perfiles ni permisos de otros módulos.

Las reglas de validación y las cargas de cortes anteriores se administran únicamente en Configuración del sistema. Se retira el endpoint duplicado PUT /api/banci/mensual/configuracion; las reglas existentes siguen aplicándose en la carga y actualización. No requiere cambios en base de datos. Publicar API y frontend juntos.

En aprobación BANCI, el resumen y la muestra de diferencias se muestran únicamente en actualizaciones, agrupados por víctima con el esquema del consolidado. Las cargas iniciales no ofrecen diferencias y se retira la muestra adicional de registros.

### Avisos y distribución BANCI

BANCI consulta los rechazos propios al entrar y cada minuto, con el mismo aviso y acceso a envíos del consolidado. Registra su consulta una sola vez en la bitácora BANCI existente, sin tablas ni columnas adicionales. El inicio incorpora el recordatorio compartido de carga pendiente, calculado sobre carpetas del corte anterior todavía no aprobadas ni enviadas a revisión.

La revisión administrativa desplaza la resolución al borde inferior visible tras renderizar. La muestra de diferencias contiene su desplazamiento sin superponer descargas o resolución. La consulta de envíos amplía el selector de corte y distribuye acciones y botones con separación y ajuste al ancho disponible. Los cambios de estilo se limitan a BANCI.

### Dashboard, recarga y barra de herramientas BANCI

Al recargar una ruta interna de BANCI se vuelve al dashboard del mismo módulo. El inicio ofrece los accesos de carga, actualización y envíos, y los cinco accesos administrativos existentes solo a SUPER_USUARIO. La barra de envíos usa las clases de distribución correctas y conserva filas compactas en escritorio, tableta y móvil. Se verificaron los accesos, la recarga, la ausencia de desbordamiento horizontal y la separación entre muestras de diferencias y botones en Chromium con datos simulados.

### Bloqueo previo por envíos BANCI pendientes

La precarga y la plantilla de actualización excluyen las víctimas incluidas en envíos pendientes de aprobación; si no quedan registros disponibles se devuelve BANCI_ENVIO_PENDIENTE (HTTP 409). La carga mantiene la exclusión de carpetas ya enviadas o aprobadas. La validación vuelve a comprobar superposición antes de procesar el contenido, además del control transaccional existente.

En captura manual y masiva, tanto de carga como de actualización, ese conflicto retira la información editable y el archivo seleccionado. Los demás errores conservan el trabajo y desplazan la vista al mensaje después de renderizarlo. Publicar API y frontend juntos. No requiere cambios de estructura de base de datos.
