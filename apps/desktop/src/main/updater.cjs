const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const { getAppEdition } = require('./edition.cjs');
const { UPDATE_FEEDS } = require('./update-feed.cjs');

function initUpdater() {
  if (getAppEdition() !== 'remote') return;
  if (process.env.VITE_DEV_SERVER_URL) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEEDS.remote,
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater]', error?.message || error);
  });

  autoUpdater.on('update-available', (info) => {
    void dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${info.version} est en cours de téléchargement.`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox({
        type: 'question',
        buttons: ['Redémarrer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
        title: 'Mise à jour prête',
        message: `La version ${info.version} est prête à être installée.`,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  void autoUpdater.checkForUpdatesAndNotify();

  const fourHoursMs = 4 * 60 * 60 * 1000;
  setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, fourHoursMs);
}

module.exports = { initUpdater };
