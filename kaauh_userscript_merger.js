#!/usr/bin/env node
/**
 * KAAUH Lab Userscript Merger (Zero-Dependency Node.js Bundler)
 * -------------------------------------------------------------
 * Merges all 6 KAAUH Lab Tampermonkey/Violentmonkey .js userscripts in the
 * target folder into one conflict-free, syntax-verified userscript:
 * `KAAUH_Lab_All_In_One.user.js`.
 *
 * Key Features:
 *  - Enforces safe execution order (token interceptors -> Super Suite ->
 *    Unified Assistant -> Robust Buttons -> HL7 Generator -> Report Uploader).
 *  - Automatically patches 4 real cross-script conflicts dynamically based on
 *    which modules are enabled in the Module Manager:
 *      1. `#suite-location-display` overwrite (preserves Telephone Extension chip).
 *      2. Duplicate "Hide/Show Patient Info" buttons fighting over `.lo-view-detail-top`.
 *      3. Pagination page-size fight (`500` forced vs. saved `10/50/100/500`).
 *      4. Duplicate AG-Grid clicked-row highlight (1-min green vs. 2-min purple).
 *  - Deduplicates and merges all ==UserScript== headers (@match, @grant,
 *    @require, @connect, @resource) and strips `@grant none`.
 *  - Preserves each script's URL routing and isolates each module in a
 *    try/catch boundary.
 *  - Injects a Shadow-DOM Module Manager UI (Alt+Shift+K or Tampermonkey Menu).
 *  - Validates the generated userscript with Node's `vm.Script` before saving.
 *
 * Usage:
 *   1. Place this file inside your `kaauh_lab_script-main` folder.
 *   2. Run: `node merge_kaauh_scripts.js`
 *   3. Install `KAAUH_Lab_All_In_One.user.js` in Tampermonkey/Violentmonkey
 *      and disable the 6 old individual scripts.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ============================================================================
// CONFIGURATION
// ============================================================================
const TARGET_DIR = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
const OUTPUT_FILENAME = 'KAAUH_Lab_All_In_One.user.js';
const SELF_FILENAME = path.basename(__filename);

const MERGED_META = {
  name: 'KAAUH Lab — All-In-One Unified Suite',
  namespace: 'https://github.com/3soob/kaauh_lab_script',
  version: '1.1.0',
  description:
    'Conflict-free unified bundle of all 6 KAAUH Lab userscripts with automatic deduplication, per-module URL routing, error boundaries, and a built-in Module Manager (Alt+Shift+K).',
  author: 'Hamad AlShegifi / 3soob',
};

// Required grants across the suite & Module Manager
const CORE_GRANTS = [
  'GM_getValue',
  'GM_setValue',
  'GM_deleteValue',
  'GM_addStyle',
  'GM_xmlhttpRequest',
  'GM_registerMenuCommand',
  'unsafeWindow',
];

// Required @connect hosts for local bridge servers
const CORE_CONNECTS = ['127.0.0.1', 'localhost'];

// Deterministic load order so dependent DOM elements & interceptors initialize cleanly
const LOAD_ORDER_MATCHERS = [
  /HIS Pending Samples/i,          // 1. Fetch/XHR token interceptor + 3-pane iframe mode
  /KAAUH_Lab_Super_Suite/i,        // 2. Verify1/Verify2 buttons, critical/amended modals
  /Unified_Lab_Assistant/i,        // 3. Rapid Receiver, sticky barcode, location+tel chip, summary
  /Robust Buttons/i,               // 4. Date pickers, workbench buttons, dual entry, 2-min highlight
  /Printable Worklist/i,           // 5. Attaches next to #rapidReceiveBtn
  /Manual Confirm Patient Report/i // 6. #/documents PDF batch uploader
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeSource(raw) {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function getLoadPriority(filename) {
  const idx = LOAD_ORDER_MATCHERS.findIndex((re) => re.test(filename));
  return idx === -1 ? LOAD_ORDER_MATCHERS.length : idx;
}

/**
 * Extracts the ==UserScript== header block and returns parsed directives + body.
 */
function parseUserscript(rawContent, filename) {
  const content = normalizeSource(rawContent);
  const headerRegex = /\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/;
  const match = content.match(headerRegex);

  const meta = {
    name: filename.replace(/(\.user)?\.js$/i, ''),
    version: '1.0.0',
    description: '',
    matches: [],
    includes: [],
    excludes: [],
    grants: [],
    requires: [],
    connects: [],
    resources: [],
    runAt: 'document-idle',
    noframes: false,
  };

  let body = content;

  if (match) {
    const headerBlock = match[1];
    body = content.replace(headerRegex, '').trim();

    const lines = headerBlock.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*\/\/\s*@([\w-]+)(?:\s+(.*))?$/);
      if (!m) continue;
      const key = m[1].trim();
      const value = (m[2] || '').trim();

      switch (key) {
        case 'name':
          if (value) meta.name = value;
          break;
        case 'version':
          if (value) meta.version = value;
          break;
        case 'description':
          if (value) meta.description = value;
          break;
        case 'match':
          if (value) meta.matches.push(value);
          break;
        case 'include':
          if (value) meta.includes.push(value);
          break;
        case 'exclude':
          if (value) meta.excludes.push(value);
          break;
        case 'grant':
          if (value) meta.grants.push(value);
          break;
        case 'require':
          if (value) meta.requires.push(value);
          break;
        case 'connect':
          if (value) meta.connects.push(value);
          break;
        case 'resource':
          if (value) meta.resources.push(value);
          break;
        case 'run-at':
          if (value) meta.runAt = value;
          break;
        case 'noframes':
          meta.noframes = true;
          break;
        default:
          break;
      }
    }
  }

  const id = filename
    .replace(/(\.user)?\.js$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return {
    id,
    filename,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    meta,
    body,
    patchesApplied: [],
  };
}

function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function resolveEarliestRunAt(runAtList) {
  const priority = [
    'document-start',
    'document-body',
    'document-end',
    'document-idle',
  ];
  let bestIndex = priority.length - 1;
  for (const r of runAtList) {
    const idx = priority.indexOf(r);
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx;
    }
  }
  return priority[bestIndex];
}

function indentCode(code, spaces = 4) {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n');
}

// ============================================================================
// AUTOMATIC CONFLICT RESOLUTION PATCHES
// ============================================================================

/**
 * Applies targeted, runtime-aware conflict patches when conflicting KAAUH
 * scripts are bundled together. If a conflicting module is later disabled in
 * the Module Manager, the deferred feature automatically re-enables itself.
 */
function applyConflictPatches(modules) {
  const unifiedMod = modules.find((m) => /Unified_Lab_Assistant/i.test(m.filename));
  const robustMod = modules.find((m) => /Robust Buttons/i.test(m.filename));

  if (unifiedMod && robustMod) {
    // Patch 1: Prevent Robust Buttons' addLocationToHeader() from overwriting
    // Unified Assistant's `#suite-location-display` telephone extension chip.
    const locFnRegex = /function\s+addLocationToHeader\s*\(\s*\)\s*\{/;
    if (locFnRegex.test(robustMod.body)) {
      robustMod.body = robustMod.body.replace(
        locFnRegex,
        `function addLocationToHeader() {\n        if (isModuleEnabled('${unifiedMod.id}')) return; // [AIO Patch] Owned by Unified Lab Assistant (with telephone extensions)`
      );
      robustMod.patchesApplied.push('Deferred #suite-location-display to Unified Lab Assistant (preserves phone extensions)');
    }

    // Patch 2: Prevent duplicate "Hide/Show Info" button (#gm-toggle-button)
    // fighting Unified Assistant's #custom-detail-toggle-btn over .lo-view-detail-top.
    const infoFnRegex = /function\s+manageInfoPanelVisibility\s*\(\s*\)\s*\{/;
    if (infoFnRegex.test(robustMod.body)) {
      robustMod.body = robustMod.body.replace(
        infoFnRegex,
        `function manageInfoPanelVisibility() {\n        if (isModuleEnabled('${unifiedMod.id}')) return; // [AIO Patch] Owned by Unified Lab Assistant (#custom-detail-toggle-btn)`
      );
      robustMod.patchesApplied.push('Removed duplicate Hide/Show Patient Info button conflict');
    }

    // Patch 3: Prevent Unified Assistant's setDropdownValue() from forcing page
    // size 500 over Robust Buttons' persistent 10/50/100/500 selector.
    const pageFnRegex = /const\s+setDropdownValue\s*=\s*\(\s*\)\s*=>\s*\{/;
    if (pageFnRegex.test(unifiedMod.body)) {
      unifiedMod.body = unifiedMod.body.replace(
        pageFnRegex,
        `const setDropdownValue = () => { if (isModuleEnabled('${robustMod.id}')) return; // [AIO Patch] Owned by Robust Buttons persistent pagination`
      );
      unifiedMod.patchesApplied.push('Deferred pagination dropdown to Robust Buttons (keeps 10/50/100/500 choice)');
    }

    // Patch 4: Prevent Unified Assistant's 1-min green clicked-row highlight from
    // clashing with Robust Buttons' 2-min purple clicked-row highlight.
    const rowStyleRegex = /function\s+applyPersistentRowStyles\s*\(\s*\)\s*\{/;
    if (rowStyleRegex.test(unifiedMod.body)) {
      unifiedMod.body = unifiedMod.body.replace(
        rowStyleRegex,
        `function applyPersistentRowStyles() {\n        if (isModuleEnabled('${robustMod.id}')) return; // [AIO Patch] Owned by Robust Buttons (2-min persistent purple highlight)`
      );
      unifiedMod.patchesApplied.push('Deferred clicked-row highlight to Robust Buttons (2-min highlight)');
    }
  }
}

// ============================================================================
// RUNTIME SHELL GENERATOR (Injected into the final merged userscript)
// ============================================================================

function buildMergedHeader(modules) {
  const allMatches = unique(modules.flatMap((m) => m.meta.matches));
  const allIncludes = unique(modules.flatMap((m) => m.meta.includes));
  const allRequires = unique(modules.flatMap((m) => m.meta.requires));
  const allConnects = unique([
    ...CORE_CONNECTS,
    ...modules.flatMap((m) => m.meta.connects),
  ]);
  const allResources = unique(modules.flatMap((m) => m.meta.resources));

  const allGrants = unique([
    ...CORE_GRANTS,
    ...modules.flatMap((m) => m.meta.grants),
  ]).filter((g) => g.toLowerCase() !== 'none');

  const earliestRunAt = resolveEarliestRunAt(modules.map((m) => m.meta.runAt));

  if (allMatches.length === 0 && allIncludes.length === 0) {
    allMatches.push('*://his.kaauh.org/*');
  }

  const lines = [
    '// ==UserScript==',
    `// @name         ${MERGED_META.name}`,
    `// @namespace    ${MERGED_META.namespace}`,
    `// @version      ${MERGED_META.version}`,
    `// @description  ${MERGED_META.description}`,
    `// @author       ${MERGED_META.author}`,
  ];

  for (const m of allMatches) lines.push(`// @match        ${m}`);
  for (const inc of allIncludes) lines.push(`// @include      ${inc}`);
  for (const req of allRequires) lines.push(`// @require      ${req}`);
  for (const res of allResources) lines.push(`// @resource     ${res}`);
  for (const con of allConnects) lines.push(`// @connect      ${con}`);
  for (const gr of allGrants) lines.push(`// @grant        ${gr}`);

  lines.push(`// @run-at       ${earliestRunAt}`);
  lines.push('// ==/UserScript==');

  return lines.join('\n');
}

function buildMergedScript(modules) {
  const header = buildMergedHeader(modules);

  const moduleRegistrations = modules
    .map((mod) => {
      const configJson = JSON.stringify(
        {
          id: mod.id,
          name: mod.meta.name,
          version: mod.meta.version,
          filename: mod.filename,
          description: mod.meta.description,
          matches: mod.meta.matches,
          includes: mod.meta.includes,
          excludes: mod.meta.excludes,
          runAt: mod.meta.runAt,
          noframes: mod.meta.noframes,
          patches: mod.patchesApplied,
        },
        null,
        4
      );

      return `
  // ==========================================================================
  // MODULE: ${mod.meta.name} (${mod.filename})
  // ==========================================================================
  registerModule(${configJson}, function () {
${indentCode(mod.body, 4)}
  });`;
    })
    .join('\n');

  return `${header}

(function () {
  'use strict';

  // Prevent double-initialization if script is injected twice in the same frame
  if (window.__KAAUH_LAB_AIO_LOADED__) return;
  window.__KAAUH_LAB_AIO_LOADED__ = true;

  const STORAGE_KEY = 'kaauh_aio_module_states_v1';
  const MODULES = [];
  const RUNTIME_STATUS = {};

  // --------------------------------------------------------------------------
  // 1. PERSISTENT MODULE STATE (GM_getValue / GM_setValue + localStorage fallback)
  // --------------------------------------------------------------------------
  function loadStates() {
    try {
      if (typeof GM_getValue === 'function') {
        const raw = GM_getValue(STORAGE_KEY, '{}');
        return typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      }
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      console.warn('[KAAUH AIO] Failed to load module states:', e);
      return {};
    }
  }

  function saveStates(states) {
    try {
      const serialized = JSON.stringify(states);
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, serialized);
      } else {
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.warn('[KAAUH AIO] Failed to save module states:', e);
    }
  }

  const moduleStates = loadStates();

  function isModuleEnabled(id) {
    return moduleStates[id] !== false;
  }

  // --------------------------------------------------------------------------
  // 2. URL PATTERN MATCHING (@match, @include, @exclude)
  // --------------------------------------------------------------------------
  function wildcardToRegex(pattern) {
    if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
      try {
        return new RegExp(pattern.slice(1, -1));
      } catch (_) {}
    }
    const escaped = pattern
      .replace(/[.+?^$()|[\\]\\\\]/g, '\\\\$&')
      .replace(/\\*/g, '.*');
    return new RegExp('^' + escaped + '$', 'i');
  }

  function matchesUrl(url, mod) {
    if (mod.noframes && window.self !== window.top) {
      return false;
    }
    if (mod.excludes && mod.excludes.length > 0) {
      for (const ex of mod.excludes) {
        if (wildcardToRegex(ex).test(url)) return false;
      }
    }
    const allowList = [...(mod.matches || []), ...(mod.includes || [])];
    if (allowList.length === 0) return true;
    return allowList.some((pattern) => wildcardToRegex(pattern).test(url));
  }

  // --------------------------------------------------------------------------
  // 3. EXECUTION TIMING SCHEDULER (@run-at preservation)
  // --------------------------------------------------------------------------
  function scheduleByRunAt(runAt, fn) {
    const state = document.readyState;

    if (runAt === 'document-start') {
      fn();
      return;
    }

    if (runAt === 'document-body') {
      if (document.body) {
        fn();
      } else {
        const obs = new MutationObserver(() => {
          if (document.body) {
            obs.disconnect();
            fn();
          }
        });
        obs.observe(document.documentElement, { childList: true });
      }
      return;
    }

    // For document-end and document-idle: execute immediately once DOM is interactive/complete
    if (state === 'interactive' || state === 'complete') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  // --------------------------------------------------------------------------
  // 4. MODULE REGISTRATION & ISOLATED EXECUTION
  // --------------------------------------------------------------------------
  function registerModule(config, initFn) {
    MODULES.push({ config, initFn });
    const url = window.location.href;

    if (!isModuleEnabled(config.id)) {
      RUNTIME_STATUS[config.id] = { status: 'disabled', message: 'Disabled by user' };
      return;
    }

    if (!matchesUrl(url, config)) {
      RUNTIME_STATUS[config.id] = { status: 'standby', message: 'URL does not match module rules' };
      return;
    }

    RUNTIME_STATUS[config.id] = { status: 'scheduled', message: 'Waiting for ' + config.runAt };

    scheduleByRunAt(config.runAt, () => {
      try {
        initFn();
        RUNTIME_STATUS[config.id] = { status: 'active', message: 'Running' };
        console.info(\`[KAAUH AIO] ✓ Loaded: \${config.name} (v\${config.version})\`);
      } catch (err) {
        RUNTIME_STATUS[config.id] = {
          status: 'error',
          message: err && err.message ? err.message : String(err),
        };
        console.error(\`[KAAUH AIO] ✗ Error in module "\${config.name}":\`, err);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. MODULE MANAGER UI (Shadow DOM — Zero CSS Collisions)
  // --------------------------------------------------------------------------
  let modalHost = null;

  function openModuleManager() {
    if (modalHost) {
      modalHost.remove();
      modalHost = null;
      return;
    }
    if (!document.body) return;

    modalHost = document.createElement('div');
    modalHost.id = 'kaauh-aio-manager-host';
    modalHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
    const shadow = modalHost.attachShadow({ mode: 'open' });

    const draftStates = { ...moduleStates };

    const statusBadge = (id) => {
      const info = RUNTIME_STATUS[id] || { status: 'unknown', message: '' };
      const map = {
        active: { label: 'Active', bg: '#dcfce7', fg: '#166534' },
        scheduled: { label: 'Scheduled', bg: '#dbeafe', fg: '#1e40af' },
        standby: { label: 'Standby (URL)', bg: '#f1f5f9', fg: '#475569' },
        disabled: { label: 'Disabled', bg: '#fee2e2', fg: '#991b1b' },
        error: { label: 'Error', bg: '#fef2f2', fg: '#b91c1c' },
      };
      const style = map[info.status] || { label: info.status, bg: '#f1f5f9', fg: '#334155' };
      return \`<span class="badge" title="\${(info.message || '').replace(/"/g, '&quot;')}" style="background:\${style.bg};color:\${style.fg}">\${style.label}</span>\`;
    };

    const rowsHtml = MODULES.map(({ config }) => {
      const checked = draftStates[config.id] !== false ? 'checked' : '';
      const info = RUNTIME_STATUS[config.id] || {};
      const errLine = info.status === 'error'
        ? \`<div class="err-msg">Error: \${info.message}</div>\`
        : '';
      const patchNote = config.patches && config.patches.length
        ? \`<div class="patch-note">✓ \${config.patches.length} conflict patch(es) active</div>\`
        : '';
      return \`
        <label class="mod-row">
          <div class="mod-info">
            <div class="mod-title">
              <span>\${config.name}</span>
              \${statusBadge(config.id)}
            </div>
            <div class="mod-meta">\${config.filename} • v\${config.version} • \${config.runAt}</div>
            \${patchNote}
            \${errLine}
          </div>
          <input type="checkbox" class="toggle" data-id="\${config.id}" \${checked} />
        </label>
      \`;
    }).join('');

    shadow.innerHTML = \`
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .backdrop {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .panel {
          width: 100%; max-width: 640px; max-height: 85vh; display: flex; flex-direction: column;
          background: #ffffff; color: #0f172a; border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); overflow: hidden;
        }
        .header {
          padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
          display: flex; align-items: center; justify-content: space-between;
          background: #f8fafc;
        }
        .header h2 { margin: 0; font-size: 16px; font-weight: 700; }
        .header small { color: #64748b; font-size: 12px; display: block; margin-top: 2px; }
        .close-btn {
          border: none; background: transparent; font-size: 20px; cursor: pointer;
          color: #64748b; padding: 4px 8px; border-radius: 6px;
        }
        .close-btn:hover { background: #e2e8f0; color: #0f172a; }
        .list { padding: 12px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .mod-row {
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px;
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
        }
        .mod-row:hover { border-color: #94a3b8; background: #f8fafc; }
        .mod-info { flex: 1; min-width: 0; }
        .mod-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; font-size: 14px; }
        .mod-meta { font-size: 12px; color: #64748b; margin-top: 4px; word-break: break-all; }
        .patch-note { font-size: 11px; color: #0369a1; margin-top: 3px; font-weight: 500; }
        .err-msg { font-size: 12px; color: #b91c1c; margin-top: 4px; font-family: monospace; }
        .badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
        .toggle { width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer; flex-shrink: 0; }
        .footer {
          padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .hint { font-size: 12px; color: #64748b; }
        .actions { display: flex; gap: 8px; }
        .btn {
          border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a;
          padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .btn:hover { background: #f1f5f9; }
        .btn-primary { background: #2563eb; border-color: #2563eb; color: #ffffff; }
        .btn-primary:hover { background: #1d4ed8; }
      </style>
      <div class="backdrop" id="backdrop">
        <div class="panel">
          <div class="header">
            <div>
              <h2>KAAUH Lab — All-In-One Module Manager</h2>
              <small>\${MODULES.length} merged scripts • Shortcut: Alt + Shift + K</small>
            </div>
            <button class="close-btn" id="closeBtn" title="Close">&times;</button>
          </div>
          <div class="list">\${rowsHtml}</div>
          <div class="footer">
            <span class="hint">Toggle modules and reload to apply changes.</span>
            <div class="actions">
              <button class="btn" id="cancelBtn">Close</button>
              <button class="btn btn-primary" id="saveReloadBtn">Save &amp; Reload</button>
            </div>
          </div>
        </div>
      </div>
    \`;

    const close = () => {
      if (modalHost) {
        modalHost.remove();
        modalHost = null;
      }
    };

    shadow.getElementById('closeBtn').addEventListener('click', close);
    shadow.getElementById('cancelBtn').addEventListener('click', close);
    shadow.getElementById('backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'backdrop') close();
    });

    shadow.querySelectorAll('.toggle').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        draftStates[e.target.dataset.id] = e.target.checked;
      });
    });

    shadow.getElementById('saveReloadBtn').addEventListener('click', () => {
      saveStates(draftStates);
      close();
      window.location.reload();
    });

    document.body.appendChild(modalHost);
  }

  // Register Tampermonkey menu command & Alt+Shift+K shortcut (top frame only)
  if (window.self === window.top) {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('⚙️ KAAUH Suite: Module Manager', openModuleManager);
    }
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        openModuleManager();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 6. REGISTERED MODULES (Ordered & Conflict-Patched)
  // --------------------------------------------------------------------------
${moduleRegistrations}
})();
`;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
function main() {
  try {
    console.log(`\n🔍 Scanning folder: ${TARGET_DIR}\n`);

    const entries = fs.readdirSync(TARGET_DIR, { withFileTypes: true });
    const jsFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => {
        const lower = name.toLowerCase();
        return (
          lower.endsWith('.js') &&
          name !== SELF_FILENAME &&
          name !== OUTPUT_FILENAME
        );
      })
      .sort((a, b) => {
        const diff = getLoadPriority(a) - getLoadPriority(b);
        return diff !== 0 ? diff : a.localeCompare(b);
      });

    if (jsFiles.length === 0) {
      console.error('❌ No .js userscript files found in:', TARGET_DIR);
      process.exit(1);
    }

    const modules = jsFiles.map((filename) => {
      const fullPath = path.join(TARGET_DIR, filename);
      const raw = fs.readFileSync(fullPath, 'utf8');
      return parseUserscript(raw, filename);
    });

    // Apply automatic cross-script conflict patches
    applyConflictPatches(modules);

    console.log(`Found ${modules.length} userscripts (sorted in safe load order):\n`);
    for (const [idx, mod] of modules.entries()) {
      const kb = (mod.sizeBytes / 1024).toFixed(1);
      console.log(`  ${idx + 1}. ${mod.filename} (${kb} KB) — v${mod.meta.version}`);
      for (const patch of mod.patchesApplied) {
        console.log(`       ↳ [Conflict Fix] ${patch}`);
      }
    }

    const outputCode = buildMergedScript(modules);

    // Syntax-check the generated bundle before writing to disk
    console.log('\n🧪 Verifying generated JavaScript syntax...');
    new vm.Script(outputCode, { filename: OUTPUT_FILENAME });
    console.log('   ✓ Syntax check passed with 0 errors.');

    const outputPath = path.join(TARGET_DIR, OUTPUT_FILENAME);
    fs.writeFileSync(outputPath, outputCode, 'utf8');

    const totalKb = (Buffer.byteLength(outputCode, 'utf8') / 1024).toFixed(1);
    console.log(`\n✅ Successfully merged ${modules.length} scripts into:`);
    console.log(`   ${outputPath} (${totalKb} KB)`);
    console.log(`\n💡 Press Alt + Shift + K (or use the Tampermonkey menu) to toggle modules.\n`);
  } catch (err) {
    console.error('\n❌ Merge failed:', err);
    process.exit(1);
  }
}

main();