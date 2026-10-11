// Lets node run src/ as-is: Parcel resolves extensionless imports, and src/ .js files are ES modules
// even though package.json doesn't say so.
export async function resolve(specifier, context, next) {
  let resolved;
  try {
    resolved = await next(specifier, context);
  } catch (err) {
    if (!specifier.startsWith('.')) throw err;
    resolved = await next(`${specifier}.js`, context);
  }
  if (resolved.url.includes('/src/') && !resolved.url.includes('/node_modules/') && resolved.url.endsWith('.js')) {
    return { ...resolved, format: 'module', shortCircuit: true };
  }
  return resolved;
}
