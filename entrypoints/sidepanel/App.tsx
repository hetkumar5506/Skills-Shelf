import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  Add,
  Bolt,
  Check,
  ChevronDown,
  CloseCircle,
  CloudUpload,
  Copy,
  Download,
  Edit,
  ListCheck,
  Moon,
  Reorder,
  Search,
  Sun,
  Trash,
  X
} from 'reicon-react';
import { DEFAULT_SKILLS, STORAGE_KEYS, STORAGE_LIMIT_BYTES, type SkillItem, type Theme } from '../../lib/types';

const estimateBytes = (value: unknown) => new Blob([JSON.stringify(value)]).size;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `skill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalizeCommand = (command: string) => command.trim().replace(/\s+/g, ' ');

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function parseSingleColumnCsv(source: string): string[] {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (char === '\r' && text[i + 1] === '\n') i += 1;
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error('This CSV has an unclosed quote. Re-export it from Skill Shelf or check the file.');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((cells) => cells.some((value) => value.trim().length > 0));
  const multiColumnRow = nonEmptyRows.find((cells) => cells.length !== 1);
  if (multiColumnRow) {
    throw new Error('This file has more than one column. Skill Shelf imports a single-column CSV; quote any commas inside a skill.');
  }

  const values = nonEmptyRows.map((cells) => cells[0]?.trim() ?? '');
  if (values[0] && ['skill', 'skills', 'command', 'skill command'].includes(values[0].toLocaleLowerCase())) {
    values.shift();
  }
  return values.filter(Boolean);
}

function titleFromCommand(command: string): string {
  const skillMatch = command.match(/(?:^|\s)--skill(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/i);
  const flaggedSkill = skillMatch?.[1] ?? skillMatch?.[2] ?? skillMatch?.[3];
  if (flaggedSkill) return flaggedSkill.split(/[-_.\s]+/).filter(Boolean).map((part) => part[0]!.toLocaleUpperCase() + part.slice(1)).join(' ');

  const repoMatch = command.match(/(?:^|\s)([\w.-]+\/[\w.-]+)(?:\s|$)/);
  const repo = repoMatch?.[1]?.replace(/\.git$/i, '');
  if (repo) {
    const parts = repo.split('/');
    const repoName = parts[parts.length - 1] ?? repo;
    if (repoName.toLocaleLowerCase() === 'skills') {
      return `${(parts[0] ?? 'Agent').replace(/[._-]+/g, ' ')} Skills`;
    }
    return repoName.split(/[-_.\s]+/).filter(Boolean).map((part) => part[0]!.toLocaleUpperCase() + part.slice(1)).join(' ');
  }

  const cleaned = command.replace(/^\s*npx\s+skills\s+add\s+/i, '').trim();
  return cleaned.slice(0, 48) || 'Agent Skill';
}

function parseSkillCell(value: string): { name: string; command: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const separator = trimmed.lastIndexOf(' :: ');
  if (separator > 0) {
    const name = trimmed.slice(0, separator).trim();
    const command = trimmed.slice(separator + 4).trim();
    return command ? { name: name || titleFromCommand(command), command } : null;
  }
  return { name: titleFromCommand(trimmed), command: trimmed };
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  }
}

function App() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCommand, setDraftCommand] = useState('');
  const [toast, setToast] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [storageError, setStorageError] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (!active || areaName !== 'local') return;
      const changedSkills = changes[STORAGE_KEYS.skills];
      if (changedSkills) setSkills(Array.isArray(changedSkills.newValue) ? (changedSkills.newValue as SkillItem[]) : []);
      const changedTheme = changes[STORAGE_KEYS.theme];
      if (changedTheme && (changedTheme.newValue === 'light' || changedTheme.newValue === 'dark')) {
        setTheme(changedTheme.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    (async () => {
      try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.skills, STORAGE_KEYS.theme]);
        if (!active) return;
        const storedSkills = result[STORAGE_KEYS.skills] as SkillItem[] | undefined;
        const storedTheme = result[STORAGE_KEYS.theme] as Theme | undefined;
        setSkills(Array.isArray(storedSkills) ? storedSkills : []);
        setTheme(storedTheme === 'light' ? 'light' : 'dark');
      } catch {
        if (active) {
          setSkills(DEFAULT_SKILLS);
          setStorageError('Could not access extension storage. Your edits may not persist.');
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast('');
      toastTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const persistSkills = useCallback(async (next: SkillItem[]) => {
    const bytes = estimateBytes(next);
    if (bytes > STORAGE_LIMIT_BYTES) {
      setStorageError('Storage limit reached. Remove some text before saving.');
      return false;
    }
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.skills]: next });
      setStorageError('');
      setSkills(next);
      return true;
    } catch {
      setStorageError('Could not save your changes. Please try again.');
      return false;
    }
  }, []);

  const filteredSkills = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return skills;
    return skills.filter((skill) => `${skill.name} ${skill.command}`.toLocaleLowerCase().includes(needle));
  }, [query, skills]);

  const selectedSkills = useMemo(() => skills.filter((skill) => selectedIds.has(skill.id)), [selectedIds, skills]);
  const allVisibleSelected = filteredSkills.length > 0 && filteredSkills.every((skill) => selectedIds.has(skill.id));
  const usedBytes = estimateBytes(skills);
  const storageLabel =
    usedBytes >= 1024 * 1024
      ? `${(usedBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.ceil(usedBytes / 1024))} KB`;

  const toggleTheme = async () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.theme]: next });
    } catch {
      showToast('Theme changed for this session');
    }
  };

  const copyCommand = async (skill: SkillItem) => {
    if (await writeClipboard(skill.command)) {
      setCopiedId(skill.id);
      showToast(`${skill.name} copied`);
      window.setTimeout(() => setCopiedId((current) => (current === skill.id ? null : current)), 1500);
    } else {
      showToast('Copy failed — try again');
    }
  };

  const copyAsArray = async (items: SkillItem[], label: string) => {
    if (!items.length) {
      showToast('No skills to copy');
      return;
    }
    const arrayText = JSON.stringify(items.map((skill) => skill.command), null, 2);
    if (await writeClipboard(arrayText)) showToast(`${label} copied as command array`);
    else showToast('Copy failed — try again');
  };

  const exportCsv = () => {
    if (!skills.length) {
      showToast('Add a skill before exporting');
      return;
    }
    const rows = [csvCell('Skill'), ...skills.map((skill) => csvCell(`${skill.name} :: ${skill.command}`))];
    const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skill-shelf-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('CSV backup downloaded');
  };

  const importCsvFile = async (file: File) => {
    try {
      const csv = await file.text();
      const cells = parseSingleColumnCsv(csv);
      const parsed = cells.map(parseSkillCell).filter((entry): entry is { name: string; command: string } => entry !== null);
      if (!parsed.length) {
        showToast('No skill commands found in CSV');
        return;
      }

      const existing = new Set(skills.map((skill) => normalizeCommand(skill.command)));
      const addedCommands = new Set<string>();
      const additions: SkillItem[] = [];
      let skipped = 0;
      for (const entry of parsed) {
        const key = normalizeCommand(entry.command);
        if (!key || existing.has(key) || addedCommands.has(key)) {
          skipped += 1;
          continue;
        }
        addedCommands.add(key);
        additions.push({ id: makeId(), name: entry.name, command: entry.command });
      }

      if (!additions.length) {
        showToast(`Skipped ${skipped} duplicate ${skipped === 1 ? 'skill' : 'skills'}`);
        return;
      }
      if (await persistSkills([...skills, ...additions])) {
        showToast(`Imported ${additions.length} skills`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not read CSV file');
    }
  };

  const handleCsvChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) void importCsvFile(file);
    event.currentTarget.value = '';
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredSkills.forEach((skill) => next.delete(skill.id));
      else filteredSkills.forEach((skill) => next.add(skill.id));
      return next;
    });
  };

  const toggleSkillSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openAdd = () => {
    setEditingId(null);
    setDraftName('');
    setDraftCommand('');
    setModalOpen(true);
  };

  const openEdit = (skill: SkillItem) => {
    setEditingId(skill.id);
    setDraftName(skill.name);
    setDraftCommand(skill.command);
    setModalOpen(true);
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    const command = draftCommand.trim();
    if (!name || !command) return;
    let next: SkillItem[];
    if (editingId) {
      next = skills.map((skill) => (skill.id === editingId ? { ...skill, name, command } : skill));
    } else {
      next = [...skills, { id: makeId(), name, command }];
    }
    if (await persistSkills(next)) {
      setModalOpen(false);
      showToast(editingId ? 'Skill updated' : 'Skill added');
    }
  };

  const deleteSkill = async (id: string) => {
    const skill = skills.find((item) => item.id === id);
    if (await persistSkills(skills.filter((item) => item.id !== id))) {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      showToast(`${skill?.name ?? 'Skill'} deleted`);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = draggedId ?? event.dataTransfer.getData('text/plain');
    setOverId(null);
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    const next = [...skills];
    const sourceIndex = next.findIndex((skill) => skill.id === sourceId);
    const targetIndex = next.findIndex((skill) => skill.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const targetBounds = event.currentTarget.getBoundingClientRect();
    let insertionIndex = targetIndex + (event.clientY >= targetBounds.top + targetBounds.height / 2 ? 1 : 0);
    const [moved] = next.splice(sourceIndex, 1);
    if (!moved) return;
    if (sourceIndex < insertionIndex) insertionIndex -= 1;
    next.splice(insertionIndex, 0, moved);
    if (await persistSkills(next)) showToast('Skill order saved');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Bolt size={18} />
          </div>
          <h1>Skill Shelf</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      <section className="toolbar" aria-label="Skill search and add">
        <label className="search-box">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter skills..."
            aria-label="Filter skills"
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear filter">
              <CloseCircle size={14} />
            </button>
          )}
        </label>
        <button className="add-button" type="button" onClick={openAdd}>
          <Add size={15} />
          <span>Add Skill</span>
        </button>
      </section>

      <section className="quick-actions" aria-label="Quick operations">
        <button
          className="quick-action"
          type="button"
          disabled={!ready || skills.length === 0}
          onClick={() => void copyAsArray(skills, 'All')}
        >
          <Copy size={13} />
          <span>Copy All</span>
        </button>
        <button className="quick-action" type="button" onClick={() => csvInputRef.current?.click()}>
          <CloudUpload size={13} />
          <span>Import CSV</span>
        </button>
        <button
          className="quick-action"
          type="button"
          disabled={!ready || skills.length === 0}
          onClick={exportCsv}
        >
          <Download size={13} />
          <span>Export CSV</span>
        </button>
        <input
          ref={csvInputRef}
          className="visually-hidden"
          type="file"
          accept=".csv,text/csv"
          aria-label="Upload CSV"
          onChange={handleCsvChange}
        />
      </section>

      <section className="selection-toolbar" aria-label="Batch selection controls">
        <button
          className="selection-toggle"
          type="button"
          onClick={toggleVisibleSelection}
          disabled={!filteredSkills.length}
        >
          <ListCheck size={14} />
          <span>{allVisibleSelected ? 'Deselect visible' : 'Select visible'}</span>
        </button>
        <span className="selection-count">{selectedSkills.length} selected</span>
        <button
          className="copy-selected-action"
          type="button"
          disabled={!selectedSkills.length}
          onClick={() => void copyAsArray(selectedSkills, 'Selected')}
        >
          <Copy size={13} />
          <span>Copy selected</span>
        </button>
      </section>

      <section className="list-heading">
        <h2>
          Skills
          <span className="count-badge">{skills.length}</span>
        </h2>
        <div className="storage-chip" title="Local storage used">
          <span className="storage-dot" />
          <span>{storageLabel} / 5 MB</span>
        </div>
      </section>

      {storageError && (
        <div className="inline-warning" role="status">
          {storageError}
        </div>
      )}

      <section className="skill-list" aria-label="Skill items">
        {!ready ? (
          <div className="loading-state">
            <span className="spinner" />
            <span>Loading shelf...</span>
          </div>
        ) : filteredSkills.length ? (
          filteredSkills.map((skill) => (
            <article
              className={`skill-card ${draggedId === skill.id ? 'is-dragging' : ''} ${
                overId === skill.id ? 'is-drop-target' : ''
              } ${selectedIds.has(skill.id) ? 'is-selected' : ''}`}
              key={skill.id}
              draggable={true}
              onDragStart={(event) => handleDragStart(event, skill.id)}
              onDragEnd={() => {
                setDraggedId(null);
                setOverId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setOverId(skill.id);
                event.dataTransfer.dropEffect = 'move';
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverId(null);
              }}
              onDrop={(event) => void handleDrop(event, skill.id)}
            >
              <div className="card-topline">
                <div className="card-identity">
                  <label className="skill-checkbox-wrap" aria-label={`Select ${skill.name}`}>
                    <input
                      className="skill-checkbox"
                      type="checkbox"
                      checked={selectedIds.has(skill.id)}
                      onChange={(event) => toggleSkillSelection(skill.id, event.currentTarget.checked)}
                    />
                  </label>
                  <span className="skill-card-name">{skill.name}</span>
                </div>
                <div className="card-actions">
                  <div
                    className="small-icon-button drag-handle"
                    aria-label={`Drag to reorder ${skill.name}`}
                    title="Drag to reorder"
                  >
                    <Reorder size={14} />
                  </div>
                  <button
                    className="small-icon-button"
                    type="button"
                    aria-label={`Edit ${skill.name}`}
                    title="Edit skill"
                    onClick={() => openEdit(skill)}
                  >
                    <Edit size={13} />
                  </button>
                  <button
                    className="small-icon-button danger-button"
                    type="button"
                    aria-label={`Delete ${skill.name}`}
                    title="Delete skill"
                    onClick={() => void deleteSkill(skill.id)}
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </div>

              <button
                className="command-copy"
                type="button"
                onClick={() => void copyCommand(skill)}
                title="Click to copy command"
              >
                <code>{skill.command}</code>
                <span className={`copy-indicator ${copiedId === skill.id ? 'copied' : ''}`} aria-hidden="true">
                  {copiedId === skill.id ? <Check size={14} /> : <Copy size={13} />}
                </span>
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <Search size={18} />
            </div>
            <h3>{query ? 'No matching skills' : 'No skills in shelf'}</h3>
            <p>{query ? 'Try checking your search query.' : 'Add your first command to get started.'}</p>
            {query ? (
              <button className="text-button" type="button" onClick={() => setQuery('')}>
                Clear filter
              </button>
            ) : (
              <button className="text-button" type="button" onClick={openAdd}>
                Add skill <ChevronDown size={12} />
              </button>
            )}
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="modal-header">
              <h2 id="editor-title">{editingId ? 'Edit Skill' : 'Add Skill'}</h2>
              <button
                className="icon-button"
                type="button"
                aria-label="Close dialog"
                onClick={() => setModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={(event) => void saveDraft(event)}>
              <label className="field-label" htmlFor="skill-name">
                Name
              </label>
              <input
                id="skill-name"
                className="form-input"
                autoFocus
                maxLength={80}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="e.g. Frontend Design"
                required
              />
              <label className="field-label command-label" htmlFor="skill-command">
                Command
              </label>
              <textarea
                id="skill-command"
                className="form-input command-input"
                value={draftCommand}
                onChange={(event) => setDraftCommand(event.target.value)}
                placeholder="npx skills add owner/repo --skill name"
                maxLength={20000}
                rows={3}
                required
              />
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  {editingId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span className="toast-icon">
            <Check size={14} />
          </span>
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

export default App;
