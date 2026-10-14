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
