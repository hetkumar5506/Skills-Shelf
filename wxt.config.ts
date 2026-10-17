import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Skill Shelf — Agent Skill Commands',
    description: 'Keep, reorder, and copy your favorite agent skill install commands.',
    version: '1.0.0',
    permissions: ['storage', 'sidePanel', 'clipboardWrite'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'Open Skill Shelf',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
