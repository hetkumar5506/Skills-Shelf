# Skill Shelf — Agent Skill Commands Extension

A fast, local-first Chrome side panel extension built with **WXT**, **React 19**, and **TypeScript** for collecting, managing, backing up, and executing AI agent skill install commands and CLI execution stacks.

Designed with a modern **shadcn-inspired aesthetic**, **Geist** typography, and **Reicon** iconography.

---

## Key Features

- **One-Click Quick Copy**: Instant click-to-copy on any command card with visual confirmation indicators.
- **Batch Export as JSON Array**:
  - **Copy All**: Copies all shelf skills as a formatted JSON array string, ready to prompt into Claude, ChatGPT, Cursor, Copilot, or Antigravity agents.
  - **Copy Selected**: Multi-select cards to generate targeted command arrays for specific projects.
- **Drag-and-Drop Reordering**: Native smooth drag-and-drop to organize and prioritize your collection.
- **Smart Filter & Search**: Instant, keyboard-friendly real-time filtering across skill titles and raw commands with a one-click clear button.
- **CSV Backup & Restore (Zero Duplication)**:
  - **Single-Column CSV**: Export your library to a clean, portable CSV (`Agent-Skills.csv`).
  - **Smart Merge on Import**: Deduplicates automatically against normalized command text. Existing skills stay untouched in place; only new items are appended.
- **Command Stacking**: Full support for chained command stacks (e.g., `uv tool install ... && specify init ...`).
- **Dark & Light Modes**: Seamless theme switching with cross-window/tab sync persisted in `chrome.storage.local`.
- **Accessible & Responsive**: Keyboard dialog dismissal (`Esc`), focus rings, accessible checkboxes, and dynamic side-panel width adaptation (320px–580px+).
- **100% Private & Local-First**: No account, no background telemetry, no remote servers, and text-only storage bounded by a 5 MiB local guard.

---

## CSV Backup & Format

The extension uses a single-column CSV format with the header `Skill`. Each row stores the display name and command:

```csv
Skill
Hallmark :: npx skills add nutlope/hallmark
Ponytail :: npx skills add dietrichgebert/ponytail
Find Skills :: npx skills add vercel-labs/skills@find-skills
Cloudflare Security Audit :: npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit
React Bits :: npx shadcn@latest add @react-bits/SplitText-TS-TW && npx jsrepo@latest add https://reactbits.dev/r/SplitText-TS-TW
Spec Kit :: uv tool install specify-cli && specify init my-project --integration copilot && cd my-project
Arena Skill :: npx skills add jakeschincariol/arena-skill
Anatomy :: npx skills add wheresryan22/anatomy -g
Skillry :: npx skills add skillry
Public APIs :: git clone https://github.com/public-apis/public-apis.git
shadcn/ui :: npx skills add shadcn/ui
```

*A curated, ready-to-import template is included in [`Agent-Skills.csv`](Agent-Skills.csv).*

### Import Merge Logic
- **Existing Commands**: Skipped automatically without modifying titles or shelf positions.
- **New Commands**: Appended to the bottom in CSV order.
- **Plain Commands**: If a CSV row contains only a command without `Name ::`, Skill Shelf parses a readable title automatically.

---

## Project Structure

```text
Skill-Shelf-source/
├── .agent/
│   └── skills/                      # Local agent skills (Ponytail, Hallmark, Cloudflare Audit)
├── entrypoints/
│   ├── background.ts                # Background service worker (sidePanel trigger & seeding)
│   └── sidepanel/
│       ├── index.html               # Side panel HTML entrypoint (Geist & JetBrains Mono)
│       ├── main.tsx                 # React DOM mount point
│       ├── App.tsx                  # Core application, search, state & drag-and-drop
│       └── style.css                # shadcn design system tokens, variables & responsive rules
├── lib/
│   └── types.ts                     # TypeScript definitions, storage keys & defaults
├── public/
│   └── icon/                        # Extension icons (16, 32, 48, 128 px)
├── Agent-Skills.csv                 # Pre-configured sample CSV backup
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # Strict TypeScript configuration
└── wxt.config.ts                    # WXT & Chrome Manifest V3 configuration
```

---

## Installation & Setup

### Requirements
- **Node.js**: v20 or newer
- **Browser**: Google Chrome, Brave, Arc, Edge, or any Chromium browser supporting the Side Panel API.

### Build from Source
```bash
# 1. Install dependencies
npm install

# 2. Validate types
npm run typecheck

# 3. Build extension
npm run build

# 4. (Optional) Create .zip package
npm run zip
```

---

## Loading into Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the `.output/chrome-mv3` folder inside this repository.
5. Pin **Skill Shelf** to your toolbar and click the icon to open your shelf in the side panel.

---

## Permissions & Security

- **`sidePanel`**: Renders the extension UI in the native browser side panel.
- **`storage`**: Saves your collection locally in browser storage (`chrome.storage.local`).
- **`clipboardWrite`**: Allows one-click copying of commands into your clipboard.
- **Content Security**: No remote scripts, no trackers, and no external host permissions requested.
