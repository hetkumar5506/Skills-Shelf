import { DEFAULT_SKILLS, STORAGE_KEYS } from '../lib/types';

export default defineBackground(() => {
  // Seed the example list once on a genuinely fresh install. If local extension
  // storage is later cleared, the side panel stays empty so a CSV can restore it.
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason !== 'install') return;
    void chrome.storage.local.get(STORAGE_KEYS.skills).then((stored) => {
      if (!Array.isArray(stored[STORAGE_KEYS.skills])) {
        return chrome.storage.local.set({ [STORAGE_KEYS.skills]: DEFAULT_SKILLS });
      }
      return undefined;
    }).catch(() => undefined);
  });

  // Open the persistent side panel when the toolbar icon is clicked.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
