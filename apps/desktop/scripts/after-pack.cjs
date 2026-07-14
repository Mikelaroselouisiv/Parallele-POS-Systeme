/**
 * Applique l'icône Windows sans winCodeSign (évite l'erreur symlink sur Windows).
 * Copie l'exe hors OneDrive avant rcedit pour éviter "Unable to commit changes".
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const rcedit = require('rcedit');

  const projectDir = context.packager.projectDir;
  const icon = path.join(projectDir, 'build', 'icon.ico');
  if (!fs.existsSync(icon)) {
    console.warn('[after-pack] icon.ico introuvable, skip');
    return;
  }

  const productName = context.packager.appInfo.productFilename;
  const exe = path.join(context.appOutDir, `${productName}.exe`);
  const tmpExe = path.join(os.tmpdir(), `pos-rcedit-${process.pid}.exe`);

  try {
    fs.copyFileSync(exe, tmpExe);
    await rcedit(tmpExe, {
      icon,
      'version-string': {
        ProductName: context.packager.appInfo.productName,
        FileDescription: context.packager.appInfo.productName,
        InternalName: productName,
        OriginalFilename: `${productName}.exe`,
      },
    });
    fs.copyFileSync(tmpExe, exe);
    console.log('[after-pack] icône exe appliquée:', productName);
  } catch (err) {
    console.warn('[after-pack] rcedit échoué (build continue):', err?.message || err);
  } finally {
    try {
      fs.unlinkSync(tmpExe);
    } catch {
      /* ignore */
    }
  }
};
