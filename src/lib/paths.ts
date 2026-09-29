// Acepta rutas internas; evita redirecciones a otro sitio mediante // o barras invertidas.
export function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !/[\\\u0000-\u001f]/.test(path);
}
