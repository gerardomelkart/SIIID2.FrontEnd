import fs from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';
import ts from 'typescript';

// Prettier indenta el contenido; TypeScript identifica las llaves de bloques.
// Los objetos y las plantillas literales conservan su sintaxis y su contenido.
const raiz = path.resolve(import.meta.dirname, '..');
const configuracion = JSON.parse(await fs.readFile(path.join(raiz, '.prettierrc'), 'utf8'));
let total = 0;

async function archivos(directorio)
{
    const entradas = await fs.readdir(directorio, { withFileTypes: true });
    const listas = await Promise.all(entradas.map(entrada =>
    {
        const nombre = path.join(directorio, entrada.name);
        return entrada.isDirectory() ? archivos(nombre) : [nombre];
    }));
    return listas.flat();
}

function analizar(texto, nombre)
{
    const archivo = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
    if(archivo.parseDiagnostics.length) throw new Error(`Sintaxis inválida: ${nombre}`);
    return archivo;
}

function estructura(nodo)
{
    // Las expresiones mantienen su árbol aunque Prettier ajuste paréntesis redundantes.
    if(ts.isParenthesizedExpression(nodo)) return estructura(nodo.expression);
    if(ts.isParenthesizedTypeNode(nodo)) return estructura(nodo.type);
    const hijos = [];
    ts.forEachChild(nodo, hijo => { hijos.push(estructura(hijo)); });
    const nombrePropiedad = nodo.parent && (ts.isPropertyAssignment(nodo.parent) || ts.isPropertySignature(nodo.parent)) && nodo.parent.name === nodo && (ts.isIdentifier(nodo) || ts.isStringLiteral(nodo));
    return [nombrePropiedad ? 'nombrePropiedad' : nodo.kind, (ts.isIdentifier(nodo) || ts.isLiteralExpression(nodo) || ts.isTemplateLiteralToken(nodo)) ? nodo.text : null, hijos];
}

function estiloBloques(texto, nombre)
{
    const archivo = analizar(texto, nombre);
    const cambios = [];
    function visitar(nodo)
    {
        if(ts.isBlock(nodo) || ts.isClassDeclaration(nodo) || ts.isInterfaceDeclaration(nodo) || ts.isEnumDeclaration(nodo))
        {
            const llave = nodo.getChildren(archivo).find(hijo => hijo.kind === ts.SyntaxKind.OpenBraceToken);
            if(llave)
            {
                const posicion = llave.getStart(archivo);
                const inicioLinea = texto.lastIndexOf('\n', posicion - 1) + 1;
                const prefijo = texto.slice(inicioLinea, posicion);
                if(prefijo.trim())
                {
                    const espacios = prefijo.match(/^ */)[0];
                    const anteriores = prefijo.match(/ *$/)[0].length;
                    cambios.push({ inicio: posicion - anteriores, fin: posicion, texto: '\n' + espacios });
                }
            }
        }
        if(ts.isIfStatement(nodo) || ts.isForStatement(nodo) || ts.isForOfStatement(nodo) || ts.isForInStatement(nodo) || ts.isWhileStatement(nodo) || ts.isSwitchStatement(nodo))
        {
            const llave = nodo.getChildren(archivo).find(hijo => hijo.kind === ts.SyntaxKind.OpenParenToken);
            if(llave && texto[llave.getStart(archivo) - 1] === ' ')
                cambios.push({ inicio: llave.getStart(archivo) - 1, fin: llave.getStart(archivo), texto: '' });
        }
        ts.forEachChild(nodo, visitar);
    }
    visitar(archivo);
    for(const cambio of cambios.sort((a, b) => b.inicio - a.inicio))
        texto = texto.slice(0, cambio.inicio) + cambio.texto + texto.slice(cambio.fin);
    return texto;
}

for(const nombre of (await archivos(path.join(raiz, 'src'))).filter(nombre => /\.(ts|html|css)$/.test(nombre)))
{
    const original = await fs.readFile(nombre, 'utf8');
    if(process.argv[2] === '--verificar')
    {
        const anterior = await fs.readFile(path.join(process.argv[3], path.relative(raiz, nombre)), 'utf8');
        const a = nombre.endsWith('.ts') ? JSON.stringify(estructura(analizar(anterior, nombre))) : await prettier.format(anterior, { ...configuracion, filepath: nombre, ...(nombre.endsWith('.html') ? { parser: 'angular' } : {}) });
        const b = nombre.endsWith('.ts') ? JSON.stringify(estructura(analizar(original, nombre))) : await prettier.format(original, { ...configuracion, filepath: nombre, ...(nombre.endsWith('.html') ? { parser: 'angular' } : {}) });
        if(a !== b) throw new Error(`Cambio de contenido contra la referencia: ${nombre}`);
        total++;
        continue;
    }
    let resultado = await prettier.format(original, { ...configuracion, filepath: nombre, ...(nombre.endsWith('.html') ? { parser: 'angular' } : {}) });
    if(nombre.endsWith('.html'))
    {
        const segundaPasada = await prettier.format(resultado, { ...configuracion, filepath: nombre, parser: 'angular' });
        // No aplicar un formato inestable a interpolaciones Angular con elementos adyacentes.
        if(segundaPasada !== resultado) continue;
    }
    if(nombre.endsWith('.ts'))
    {
        resultado = estiloBloques(resultado, nombre);
        const antes = JSON.stringify(estructura(analizar(original, nombre)));
        const despues = JSON.stringify(estructura(analizar(resultado, nombre)));
        if(antes !== despues) throw new Error(`El formato modificó la estructura del código: ${nombre}`);
    }
    if(original !== resultado)
    {
        await fs.writeFile(nombre, resultado);
        total++;
    }
}
console.log(`${total} archivos formateados; árboles TypeScript verificados.`);
