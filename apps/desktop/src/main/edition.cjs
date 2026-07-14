/** Edition desktop : server | remote (extraMetadata electron-builder ou VITE_APP_EDITION en dev). */
function getAppEdition() {
  const fromEnv = process.env.VITE_APP_EDITION?.trim().toLowerCase();
  if (fromEnv === 'server' || fromEnv === 'remote') return fromEnv;

  try {
    const pkg = require('../../package.json');
    const fromPkg = pkg.edition?.trim().toLowerCase();
    if (fromPkg === 'server' || fromPkg === 'remote') return fromPkg;
  } catch {
    /* ignore */
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  return isDev ? 'server' : 'remote';
}

module.exports = { getAppEdition };
