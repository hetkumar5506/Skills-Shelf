# Skill Shelf

A local-first Chrome extension for saving, organizing, backing up, and copying agent-skill install commands. Open the side panel, find a skill, copy one command or a JSON array of commands, and paste it into your agent chat.

## Features

- **Quick copy:** click any command to copy that command as plain text.
- **Copy all / selected:** copy every command or only checked commands as a valid JSON array of strings, in the current shelf order.
- **Single-column CSV backup:** export your collection to one CSV column and import it later.
- **Safe merge on import:** commands already in the shelf are skipped; only new commands are appended, in CSV order. Re-importing the same file is safe and will not duplicate entries.
- **Manage skills:** add, edit, delete, search, select, and drag to reorder.
- **Light and dark themes:** preference is saved locally.
- **Local-only:** no account, analytics, or network service. Only names, command text, order, and theme are stored by the extension.
- **Responsive side panel:** adapts to a narrow Chrome side panel and respects reduced-motion preferences.

## CSV format and restore behavior

Use **Export CSV** before clearing extension storage or removing the extension. The downloaded CSV has exactly one column named `Skill`; each skill occupies one row. A row contains both its display name and command in the same cell, for example:

```csv
Skill
"Hallmark :: npx skills add nutlope/hallmark"
"Frontend Design :: npx skills add anthropics/skills --skill frontend-design"
```

Names are included so a backup restores the shelf as it looked. The importer also accepts a one-column CSV with just commands (no `Name ::` prefix); it will create a readable name from the command. Keep commas inside a cell quoted, as in standard CSV. `Skill-Shelf-sample.csv` is included as a six-row example.

### Merge examples

- Shelf has 5 commands; CSV has those 5 plus 2 new ones → **2 are appended**, and the original 5 keep their order.
- Shelf is empty; CSV has 7 commands → **all 7 are added** in the CSV order.
- A command is repeated in the CSV or already saved → it is **skipped**, not overwritten or duplicated.

Duplicate detection compares normalized command text. Existing skills are never renamed by an import; edit them in the extension if you want to change their display names.

## Copy formats

**Copy all** and **Copy selected** copy a JSON array containing the command strings, for example:

```json
[
  "npx skills add nutlope/hallmark",
  "npx skills add anthropics/skills --skill frontend-design"
]
```

The normal click-to-copy action on a skill card still copies only its raw command, without JSON formatting.

## Install in Chrome

### Requirements

- Node.js 22 or newer and npm 10 or newer for building from source.
- Google Chrome or another Chromium browser with the Chrome Side Panel API.

### Build from source

```bash
npm install
npm run typecheck
npm run build
```

The unpacked extension is generated at `.output/chrome-mv3`.

### Load the built extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `.output/chrome-mv3`.
4. Pin **Skill Shelf** from the extensions menu.
5. Click its toolbar icon to open the side panel.

To use the packaged build, extract `Skill-Shelf-chrome-extension.zip` first, then choose the extracted folder with **Load unpacked**.

## Development commands

```bash
npm run dev        # WXT development mode
npm run typecheck  # TypeScript validation
npm run build      # Production extension in .output/chrome-mv3
npm run zip        # WXT extension archive
```

## Data and privacy

Skills are saved in `chrome.storage.local` on this browser. The app enforces a 5 MiB limit for saved skill data. Browser cache clearing and extension storage removal are different actions, but if the extension's local data is cleared or the extension is removed, restore your collection by installing Skill Shelf again and importing the CSV backup. Keep the CSV somewhere outside the browser profile.

The first fresh install seeds the six example commands. If extension storage is later cleared, the shelf opens empty so you can restore from CSV; it will not re-seed the examples and create confusing duplicates.

## Permissions

- `sidePanel`: opens the Skill Shelf UI in Chrome's side panel.
- `storage`: saves skills and theme locally.
- `clipboardWrite`: copies commands and command arrays to the clipboard.

The extension does not request access to webpages or send data to a server.
