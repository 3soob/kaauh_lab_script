// ==UserScript==
// @name         HIS Pending Samples + 3-Pane Master-Detail UX
// @namespace    http://tampermonkey.net/
// @version      28.6
// @updateURL    https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/HIS%20Pending%20Samples%20%2B%203-Pane%20Master-Detail%20UX.js
// @downloadURL  https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/HIS%20Pending%20Samples%20%2B%203-Pane%20Master-Detail%20UX.js
// @description  3-pane UI: stable left barcode list, parallel bulk status sync, persistent center pane header & embedded HIS order page, simplified responsive headers, manual test exclusion & ultra-compact table, right action panel.
// @author       Hamad AlShegifi
// @match        *://his.kaauh.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @license      MIT
// ==/UserScript==


(function() {
    'use strict';

    // ==========================================
    // EMBEDDED MODE: runs INSIDE the center-pane iframe only.
    // Keeps the patient info (top), the ultra-compact test summary table, and the action button bar (pinned at the bottom).
    // ==========================================
    function runEmbeddedCleanMode() {
        const SUMMARY_SEL = '#test-summary-container';
        const BAR_SEL = '.btn-area.stickey-btnset';
        const PATIENT_SELECTORS = [
            'csi-patient-banner', 'csi-patient-info', 'csi-patient-header', 'app-patient-banner',
            '.patient-banner', '.patient-info', '.patient-header', '.patient-details',
            '[class*="patient-banner"]', '[class*="patient-header"]', '[class*="patient-info"]'
        ];
        const GIVE_UP_MS = 20000;

        const FIELD_DEFS = [
            ['Name', /^(patient\s*)?(full\s*)?name$/i],
            ['MRN',  /^(mrn|medical record(\s*(no\.?|number))?|file\s*(no\.?|number))$/i],
            ['DOB',  /^(dob|date of birth|birth\s*date)$/i],
            ['Age',  /^age$/i],
            ['Sex',  /^(gender|sex)$/i],
            ['Loc',  /^(location|ward|room|bed)$/i]
        ];

        GM_addStyle(`
            html.tp-embed-wait body { visibility: hidden !important; }
            .tp-embed-hide { display: none !important; }
            ${SUMMARY_SEL} { position: static !important; top: auto !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
            html.tp-embed-on, html.tp-embed-on body { background: #f8fafc !important; margin: 0 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }

            /* ---- Hide any Code 128 / barcode elements inside the embedded order view ---- */
            svg[jsbarcode-value], [class*="barcode"], [id*="barcode"], canvas[id*="barcode"] { display: none !important; }

            /* ---- Ultra-Compact High-Density Test Summary Table ---- */
            #test-summary-container { background: #fff !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; overflow: hidden !important; box-shadow: 0 1px 2px rgba(15,23,42,0.03) !important; }
            #test-summary-container .modern-summary-header { padding: 4px 10px !important; margin: 0 !important; border-radius: 0 !important; min-height: 0 !important; background: #0f172a !important; color: #f8fafc !important; }
            #test-summary-container .header-info { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; width: 100% !important; }
            #test-summary-container .header-info h2 { margin: 0 !important; font-size: 12px !important; line-height: 1.15 !important; font-weight: 600 !important; color: #fff !important; }
            #test-summary-container .header-meta { margin: 0 !important; font-size: 11px !important; white-space: nowrap !important; color: #cbd5e1 !important; }
            #test-summary-container .header-meta span { font-size: 11px !important; padding: 1px 5px !important; border-radius: 3px !important; background: rgba(255,255,255,0.12) !important; }
            #test-summary-container .search-box, #test-summary-container .summary-footer { display: none !important; }

            #test-summary-container .controls-bar { display: flex !important; align-items: center !important; padding: 3px 8px !important; margin: 0 !important; gap: 4px !important; background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; }
            #test-summary-container .filter-buttons { display: flex !important; flex-wrap: nowrap !important; gap: 4px !important; overflow-x: auto !important; margin: 0 !important; }
            #test-summary-container .filter-btn { padding: 1px 7px !important; margin: 0 !important; font-size: 10.5px !important; font-weight: 600 !important; line-height: 1.35 !important; border-radius: 999px !important; white-space: nowrap !important; border: 1px solid #cbd5e1 !important; background: #fff !important; color: #475569 !important; }
            #test-summary-container .filter-btn.active { background: #0284c7 !important; border-color: #0284c7 !important; color: #fff !important; }
            #test-summary-container .filter-btn .count { margin-left: 3px !important; font-size: 10px !important; opacity: .85 !important; }

            #test-summary-container .table-container { max-height: none !important; overflow: visible !important; padding: 0 !important; margin: 0 !important; }
            #test-summary-container .tests-table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; margin: 0 !important; }
            #test-summary-container .tests-table th:nth-child(3), #test-summary-container .tests-table td:nth-child(3),
            #test-summary-container .tests-table th:nth-child(4), #test-summary-container .tests-table td:nth-child(4),
            #test-summary-container .tests-table th:nth-child(5), #test-summary-container .tests-table td:nth-child(5) { display: none !important; }

            #test-summary-container .tests-table thead th {
                padding: 3px 10px !important; height: 22px !important; font-size: 10px !important; font-weight: 700 !important;
                text-transform: uppercase !important; letter-spacing: .4px !important;
                background: #f1f5f9 !important; color: #475569 !important;
                border-bottom: 1px solid #cbd5e1 !important; text-align: left !important;
            }
            #test-summary-container .tests-table tbody tr { transition: background-color 0.1s ease !important; }
            #test-summary-container .tests-table tbody tr:nth-child(even) { background-color: #fafbfc !important; }
            #test-summary-container .tests-table tbody tr:hover { background-color: #f0f9ff !important; }
            #test-summary-container .tests-table tbody tr.flagged-L,
            #test-summary-container .tests-table tbody tr.flagged-H { background-color: #fef2f2 !important; }
            #test-summary-container .tests-table tbody tr.flagged-L:hover,
            #test-summary-container .tests-table tbody tr.flagged-H:hover { background-color: #fee2e2 !important; }
            #test-summary-container .tests-table tbody tr.tp-row-excluded { opacity: 0.42 !important; text-decoration: line-through !important; }

            #test-summary-container .tests-table td {
                padding: 1px 10px !important; height: 21px !important; font-size: 12px !important; line-height: 1.15 !important;
                white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
                border-bottom: 1px solid #f1f5f9 !important; vertical-align: middle !important; color: #1e293b !important;
            }
            #test-summary-container .tests-table td.test-name { font-weight: 500 !important; color: #0f172a !important; }
            #test-summary-container .tests-table th:nth-child(2),
            #test-summary-container .tests-table td:nth-child(2) {
                width: 110px !important; text-align: right !important;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
                font-variant-numeric: tabular-nums !important;
                font-size: 12px !important; font-weight: 700 !important; color: #0f172a !important;
            }
            #test-summary-container .tests-table td.result-value.flagged-L,
            #test-summary-container .tests-table td.result-value.flagged-H { color: #dc2626 !important; }

            #test-summary-container .tests-table th:nth-child(6),
            #test-summary-container .tests-table td:nth-child(6) { width: 105px !important; text-align: right !important; }

            #test-summary-container .tests-table .status-badge {
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
                padding: 0 7px !important; height: 16px !important; line-height: 1 !important; border-radius: 999px !important;
                font-size: 10px !important; font-weight: 700 !important; letter-spacing: .15px !important;
                white-space: nowrap !important; border: 1px solid transparent !important;
            }
            #test-summary-container .tests-table .status-badge.verified2,
            #test-summary-container .tests-table .status-badge.verified1,
            #test-summary-container .tests-table .status-badge.verified {
                background: #dcfce7 !important; color: #15803d !important; border-color: #bbf7d0 !important;
            }
            #test-summary-container .tests-table .status-badge.ordered {
                background: #f1f5f9 !important; color: #475569 !important; border-color: #e2e8f0 !important;
            }
            #test-summary-container .tests-table .status-badge.resulted {
                background: #dbeafe !important; color: #1d4ed8 !important; border-color: #bfdbfe !important;
            }
            #test-summary-container .tests-table .status-icon { display: none !important; }

            html.tp-embed-on body { display: block !important; height: auto !important; min-height: 0 !important; padding: 34px 6px 56px !important; overflow-x: hidden !important; }
            .tp-embed-flat { display: block !important; position: static !important; float: none !important; transform: none !important;
                             margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: transparent !important;
                             width: auto !important; max-width: none !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; max-height: none !important;
                             overflow: visible !important; flex: none !important; }
            .tp-embed-bar { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 4px 6px !important; zoom: 0.82; }
            .tp-embed-bar .btn-group { margin: 0 !important; float: none !important; }
            .tp-embed-bar #custom-script-buttons { margin: 0 !important; gap: 6px !important; }

            /* ---- Simplified responsive patient strip ---- */
            .tp-embed-strip { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483000; box-sizing: border-box;
                display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; padding: 5px 12px; min-height: 30px;
                background: #fff; border-bottom: 1px solid #cbd5e1; color: #0f172a;
                font: 12.5px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
            .tp-embed-strip .tp-p-item { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; min-width: 0; }
            .tp-embed-strip .tp-p-item b { color: #94a3b8; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }
            .tp-embed-strip .tp-p-name { font-weight: 700; font-size: 13.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
            .tp-embed-strip .tp-p-MRN { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 600; }
            @media (max-width: 760px) { .tp-embed-strip .tp-p-DOB { display: none; } }
            @media (max-width: 480px) { .tp-embed-strip .tp-p-name { flex: 1 1 100%; } }

            .tp-embed-bar { position: fixed !important; left: 0 !important; right: 0 !important; bottom: 0 !important; top: auto !important; z-index: 2147483000 !important;
                            background: #fff !important; border-top: 1px solid #cbd5e1 !important; box-shadow: 0 -2px 8px rgba(0,0,0,0.06) !important;
                            padding: 6px 12px !important; margin: 0 !important; width: auto !important; max-height: 40vh; overflow-y: auto; }
            .tp-embed-bar .dropdown-menu { top: auto !important; bottom: 100% !important; transform: none !important; }
        `);
        document.documentElement.classList.add('tp-embed-wait');

        const startedAt = Date.now();
        let patientEl = null;
        let gaveUp = false;
        let stripEl = null, stripSig = '', stripRO = null;
        let barObserved = null, barRO = null;

        function trackBarHeight(bar) {
            if (!bar || bar === barObserved || typeof ResizeObserver === 'undefined') return;
            if (barRO) barRO.disconnect();
            barObserved = bar;
            const apply = () => {
                const h = Math.ceil(bar.getBoundingClientRect().height) + 8;
                document.body.style.setProperty('padding-bottom', h + 'px', 'important');
            };
            barRO = new ResizeObserver(apply);
            barRO.observe(bar);
            apply();
        }

        function patientTokens(el) {
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const t = [];
            while (w.nextNode()) {
                const x = (w.currentNode.nodeValue || '').replace(/\s+/g, ' ').trim();
                if (x) t.push(x);
            }
            return t;
        }

        function buildPatientItems(el) {
            const tokens = patientTokens(el);
            const isLabelToken = (s) => {
                const clean = s.replace(/\s*:$/, '').trim();
                for (const [k, re] of FIELD_DEFS) if (re.test(clean)) return k;
                if (/^(nationality|national\s*id|iqama|phone|mobile|episode|visit|order|physician|doctor|clinic|dept|department|status|priority|reg\.?\s*date|admission)$/i.test(clean)) {
                    return '__OTHER__';
                }
                if (/^[A-Za-z][A-Za-z\s./()-]{1,24}:$/.test(s)) return '__OTHER__';
                return null;
            };

            const found = {};
            for (let i = 0; i < tokens.length; i++) {
                const tok = tokens[i];
                let key = null;
                const valParts = [];

                const m = tok.match(/^([^:]{1,30}):\s*(.+)$/);
                if (m) {
                    key = isLabelToken(m[1]);
                    if (key && key !== '__OTHER__') valParts.push(m[2]);
                } else {
                    key = isLabelToken(tok);
                }

                if (key && key !== '__OTHER__') {
                    const maxLookahead = key === 'Name' ? 8 : 2;
                    let steps = 0;
                    while (i + 1 < tokens.length && steps < maxLookahead) {
                        const nextTok = tokens[i + 1];
                        if (nextTok === '|' || nextTok === '·' || nextTok === '/') { i++; break; }
                        if (isLabelToken(nextTok) || /^[^:]{1,30}:\s*.+$/.test(nextTok)) break;
                        if (key === 'Name' && (/^\d{5,}$/.test(nextTok) || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(nextTok))) break;
                        valParts.push(nextTok);
                        i++;
                        steps++;
                        if (key !== 'Name') break;
                    }
                    const fullVal = valParts.join(' ').replace(/\s+/g, ' ').trim();
                    if (fullVal && (!found[key] || (key === 'Name' && fullVal.length > found[key].length))) {
                        found[key] = fullVal;
                    }
                }
            }

            if (!found.Name) {
                const candidate = tokens
                    .filter(t => !isLabelToken(t) && /^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s.'-]{3,}$/.test(t) && t.trim().includes(' '))
                    .sort((a, b) => b.length - a.length)[0];
                if (candidate) found.Name = candidate;
            }

            const items = FIELD_DEFS.map(([k]) => k).filter(k => found[k]).map(k => [k, found[k]]);
            if (items.length) return items;
            return [['', tokens.join(' · ').slice(0, 180)]];
        }

        function updatePatientStrip() {
            if (!patientEl || !patientEl.isConnected) return;
            if (!stripEl) {
                stripEl = document.createElement('div');
                stripEl.className = 'tp-embed-strip';
                document.body.appendChild(stripEl);
                if (typeof ResizeObserver !== 'undefined') {
                    stripRO = new ResizeObserver(() => {
                        const h = Math.ceil(stripEl.getBoundingClientRect().height) + 6;
                        document.body.style.setProperty('padding-top', h + 'px', 'important');
                    });
                    stripRO.observe(stripEl);
                }
            }
            const sig = patientEl.textContent || '';
            if (sig !== stripSig) {
                stripSig = sig;
                stripEl.textContent = '';
                buildPatientItems(patientEl).forEach(([label, value]) => {
                    const item = document.createElement('span');
                    item.className = 'tp-p-item' + (label ? ' tp-p-' + label : '') + (label === 'Name' ? ' tp-p-name' : '');
                    if (label && label !== 'Name') { const b = document.createElement('b'); b.textContent = label; item.appendChild(b); }
                    item.appendChild(document.createTextNode(value));
                    stripEl.appendChild(item);
                });
            }
            patientEl.classList.add('tp-embed-hide');
        }

        function findPatient(summary) {
            if (patientEl && patientEl.isConnected) return patientEl;
            patientEl = null;
            for (const sel of PATIENT_SELECTORS) {
                const el = document.querySelector(sel);
                if (el && !el.contains(summary) && !summary.contains(el)) return (patientEl = el);
            }
            let leaf = null;
            for (const el of document.body.querySelectorAll('*')) {
                if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.closest(SUMMARY_SEL)) continue;
                const txt = el.textContent || '';
                if (!/\bMRN\b/i.test(txt) || txt.length > 200) continue;
                if (Array.from(el.children).some(c => /\bMRN\b/i.test(c.textContent || ''))) continue;
                if (el.offsetParent === null) continue;
                leaf = el;
                break;
            }
            if (!leaf) return null;
            let node = leaf;
            while (node.parentElement && node.parentElement !== document.body &&
                   !node.parentElement.contains(summary) &&
                   (node.parentElement.textContent || '').length < 900) {
                node = node.parentElement;
            }
            return (patientEl = node);
        }

        function isolate() {
            if (gaveUp) return;
            const root = document.documentElement;
            const summary = document.querySelector(SUMMARY_SEL);
            if (!summary) {
                if (Date.now() - startedAt > GIVE_UP_MS) {
                    gaveUp = true;
                    root.classList.remove('tp-embed-wait');
                }
                return;
            }
            const bar = document.querySelector(BAR_SEL);
            if (bar) bar.classList.add('tp-embed-bar');
            const keepers = [findPatient(summary), summary, bar].filter(Boolean);
            const keep = new Set();
            for (const k of keepers) {
                for (let n = k; n && n !== document.documentElement; n = n.parentElement) keep.add(n);
            }
            for (const k of keepers) {
                for (let n = k.parentElement; n; n = n.parentElement) {
                    for (const child of n.children) {
                        if (child.classList.contains('tp-embed-strip')) continue;
                        if (!keep.has(child)) child.classList.add('tp-embed-hide');
                        else child.classList.remove('tp-embed-hide');
                    }
                    if (n === document.body) break;
                }
            }
            for (const n of keep) {
                if (keepers.includes(n) || n === document.body || n === document.documentElement) continue;
                n.classList.add('tp-embed-flat');
            }
            trackBarHeight(bar);
            updatePatientStrip();
            root.classList.add('tp-embed-on');
            root.classList.remove('tp-embed-wait');
        }

        let timer = null;
        const schedule = () => { clearTimeout(timer); timer = setTimeout(isolate, 150); };
        const startObserving = () => {
            new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
            schedule();
            const iv = setInterval(() => { if (gaveUp) clearInterval(iv); else isolate(); }, 1000);
        };
        if (document.body) startObserving();
        else document.addEventListener('DOMContentLoaded', startObserving);
    }

    if (window.top !== window.self) {
        if (window.name === 'tp-order-frame') runEmbeddedCleanMode();
        return;
    }

    // ==========================================
    // PART 0: USERNAME & TOKEN INTERCEPTORS
    // ==========================================
    let currentUsername = 'Unknown';
    let userDataCaptured = false;

    let activeBearerToken = "";
    let activeXUser = "";
    let activeXGroup = "";

    function extractHeaders(headers) {
        if (!headers) return;
        const getVal = (key) => {
            if (headers instanceof Headers) return headers.get(key) || headers.get(key.toLowerCase());
            return headers[key] || headers[key.toLowerCase()];
        };

        const auth = getVal('Authorization');
        if (auth && auth.toLowerCase().startsWith('bearer ')) activeBearerToken = auth.substring(7);

        const xUser = getVal('x-user');
        if (xUser) activeXUser = xUser;

        const xGroup = getVal('x-group');
        if (xGroup) activeXGroup = xGroup;
    }

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [resource, config] = args;
        if (config && config.headers) extractHeaders(config.headers);
        return originalFetch.apply(this, args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        const lowerName = name.toLowerCase();
        if (lowerName === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
            activeBearerToken = value.substring(7);
        } else if (lowerName === 'x-user') {
            activeXUser = value;
        } else if (lowerName === 'x-group') {
            activeXGroup = value;
        }
        return origSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        return originalOpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', function() {
            if (this._url.includes('user') || this._url.includes('profile') ||
                this._url.includes('auth') || this._url.includes('permission')) {
                try {
                    const data = JSON.parse(this.responseText);
                    const username = data.username || data.user?.name || data.user?.username ||
                                 data.userName || data.name || data.displayName || data.fullName;

                    if (username && !userDataCaptured) {
                        currentUsername = username;
                        userDataCaptured = true;
                        sessionStorage.setItem('his_cached_username', username);
                    }
                } catch(e) {}
            }
        });
        return originalSend.call(this, ...args);
    };

    function getUserFromDOM() {
        const userDiv = document.querySelector('div[_ngcontent-gaa-c24].ng-star-inserted');
        if (userDiv) return userDiv.textContent.trim();
        return null;
    }

    function getUserFromStorage() {
        const cached = sessionStorage.getItem('his_cached_username');
        if (cached) return cached;
        const storageKeys = ['username', 'user', 'currentUser', 'userInfo', 'profile'];
        for (let key of storageKeys) {
            const sessionData = sessionStorage.getItem(key);
            const localData = localStorage.getItem(key);
            try {
                if (sessionData) { const parsed = JSON.parse(sessionData); const u = parsed.username || parsed.name || parsed.displayName; if(u) return u; }
                if (localData) { const parsed = JSON.parse(localData); const u = parsed.username || parsed.name || parsed.displayName; if(u) return u; }
            } catch(e) {}
        }
        return null;
    }

    function getDetectedUsername() {
        if (userDataCaptured && currentUsername !== 'Unknown') return currentUsername;
        let u = getUserFromDOM();
        if (u) { currentUsername = u; return u; }
        u = getUserFromStorage();
        if (u) { currentUsername = u; return u; }
        if (activeXUser && currentUsername === 'Unknown') return activeXUser;
        return currentUsername;
    }

    // ==========================================
    // PART 1: CONFIGURATION & CONSTANTS
    // ==========================================
    const NEW_TAB_NAME = "Pending Samples (3-Pane)";
    const NEW_TAB_ID = "custom-pending-samples-tab";
    const CUSTOM_CONTENT_ID = "custom-pending-samples-content";
    const TAB_BADGE_ID = "tab-pending-count-badge";

    const NAVBAR_SELECTOR = 'ul.navbar-right';
    const GRID_CONTAINER_SELECTOR = '.ag-center-cols-container';
    const FLOATING_TOP_SELECTOR = '.ag-floating-top-container';
    const TABLE_BODY_SELECTOR = 'tbody[formarrayname="TubeTypeList"], tbody[formarrayname="tubetypelist"]';

    const STORAGE_KEY = 'collectedBarcodes_storage_v5';
    const EXCLUDED_TESTS_KEY = 'excludedTests_storage_v1';
    const DEBOUNCE_DELAY = 100;
    const CACHE_DURATION = 2000;

    const collectedBarcodesThisSession = new Set();
    let sortState = { key: 'timestamp', direction: 'desc' };
    let statsBoxInjected = false;
    let mainObserver = null;
    let agGridObserver = null;
    let observerDebounceTimer = null;
    let cachedBarcodes = null;
    let cacheTimestamp = 0;
    let excludedTestsList = null;
    let isSyncingStatuses = false;
    let activeSelectedBarcode = null;
    let lastKnownActiveEntry = null; // Keeps header stable even during transient cache reloads

    // Inspector state
    const detailRowsCache = new Map();
    const iframeSummaryCache = new Map();
    const inspectorInflight = new Set();
    const inspectorAttempted = new Set();
    const orderLoading = new Set();
    const orderLookupFailed = new Set();

    let pendingBarcodesCache = new Set();
    let cacheUpdatePromise = null;

    const $id = (i) => document.getElementById(i);

    // ==========================================
    // PART 2: INITIALIZATION & CUSTOM TAB
    // ==========================================
    function init() {
        if (!mainObserver) initializeBarcodeLogic();
        if (!document.getElementById(NEW_TAB_ID)) {
            const navList = document.querySelector('ul.nav.nav-tabs.tab-container');
            if (navList) setupCustomTab(navList);
        }
        initAgGridRowHighlighting();
    }

    function setupCustomTab(navList) {
        let originalContent = document.querySelector('.tab-content');
        if (!originalContent) originalContent = navList.nextElementSibling;
        if (!originalContent) return;

        let customContent = document.getElementById(CUSTOM_CONTENT_ID);
        if (!customContent) {
            customContent = document.createElement('div');
            customContent.id = CUSTOM_CONTENT_ID;
            customContent.style.display = 'none';
            originalContent.parentNode.insertBefore(customContent, originalContent.nextSibling);
        }

        const lastTab = navList.lastElementChild;
        if (document.getElementById(NEW_TAB_ID)) return;

        const newLi = lastTab.cloneNode(true);
        const link = newLi.querySelector('a');
        const textSpan = newLi.querySelector('span');

        newLi.id = NEW_TAB_ID;
        if (textSpan) textSpan.innerHTML = `${NEW_TAB_NAME} <span id="${TAB_BADGE_ID}" class="tab-badge" style="display:none">0</span>`;

        link.href = "javascript:void(0);";
        link.classList.remove('active');
        link.removeAttribute('style');
        if(textSpan) textSpan.removeAttribute('style');

        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            navList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');
            originalContent.style.display = 'none';
            customContent.style.display = 'block';
            renderThreePaneLayout();
            syncPendingStatuses();
        });

        navList.addEventListener('click', function(e) {
            if (!e.target.closest('#' + NEW_TAB_ID)) {
                link.classList.remove('active');
                originalContent.style.display = 'block';
                customContent.style.display = 'none';
            }
        });

        navList.appendChild(newLi);
        setTimeout(renderThreePaneLayout, 500);
    }

    // ==========================================
    // PART 3: BARCODE, MANUAL EXCLUSIONS & SUMMARY PARSING
    // ==========================================
    async function getExcludedTests() {
        if (!excludedTestsList) {
            const arr = await GM_getValue(EXCLUDED_TESTS_KEY, []);
            excludedTestsList = [...new Set(arr.map(s => String(s).trim()).filter(Boolean))];
        }
        return excludedTestsList;
    }

    async function addExcludedTests(rawInput) {
        const list = await getExcludedTests();
        const existingLower = new Set(list.map(s => s.toLowerCase()));
        const additions = String(rawInput || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        let changed = false;
        for (const item of additions) {
            if (!existingLower.has(item.toLowerCase())) {
                list.push(item);
                existingLower.add(item.toLowerCase());
                changed = true;
            }
        }
        if (changed) await GM_setValue(EXCLUDED_TESTS_KEY, list);
        return changed;
    }

    async function removeExcludedTest(name) {
        const list = await getExcludedTests();
        const key = String(name).trim().toLowerCase();
        excludedTestsList = list.filter(s => s.toLowerCase() !== key);
        await GM_setValue(EXCLUDED_TESTS_KEY, excludedTestsList);
    }

    function isTestExcluded(testName, excludedList) {
        if (!testName || !excludedList || excludedList.length === 0) return false;
        const target = String(testName).trim().toLowerCase();
        return excludedList.some(ex => {
            const term = ex.toLowerCase();
            return target === term || target.includes(term);
        });
    }

    function isEntryFullyCompleted(entry) {
        if (!entry) return false;
        const sampleOk = String(entry.sampleStatus || '').trim().toLowerCase() === 'received';
        const testRaw = String(entry.testStatus || '').trim().toLowerCase();
        const testOk = testRaw.startsWith('verified');
        return sampleOk && testOk;
    }

    function readSummaryTableFromIframe(fallbackSampleStatus) {
        const frame = $id('tp-order-frame');
        if (!frame) return null;
        let doc = null;
        try { doc = frame.contentDocument; } catch (e) { return null; }
        if (!doc) return null;

        const tbody = doc.querySelector('#modernTestsTableBody');
        if (!tbody) return null;
        const trs = Array.from(tbody.querySelectorAll('tr'));
        if (trs.length === 0) return null;

        const parsed = [];
        for (const tr of trs) {
            const nameCell = tr.querySelector('td.test-name') || tr.querySelector('td:first-child');
            const badge = tr.querySelector('td:last-child .status-badge') || tr.querySelector('.status-badge');
            if (!nameCell) continue;
            const fullName = (nameCell.getAttribute('title') || nameCell.textContent || '').trim();
            const statusText = (badge ? badge.textContent : tr.querySelector('td:last-child')?.textContent || 'Ordered').trim();
            if (fullName) {
                parsed.push({
                    name: fullName,
                    testStatus: statusText,
                    sampleStatus: isVerified(statusText) ? 'Received' : (fallbackSampleStatus || 'Received'),
                    rowEl: tr
                });
            }
        }
        return parsed.length > 0 ? parsed : null;
    }

    function getEffectiveIndividualTests(barcode, apiRows, entry) {
        const domTests = iframeSummaryCache.get(barcode);
        if (domTests && domTests.length > 0) return domTests;

        const items = [];
        if (apiRows && apiRows.length > 0) {
            for (const r of apiRows) {
                const rawName = getTestName(r) || r.testDescription || '';
                const parts = rawName.split(',').map(s => s.trim()).filter(Boolean);
                const names = parts.length > 0 ? parts : ['--'];
                for (const name of names) {
                    items.push({
                        name,
                        testStatus: String(r.testStatus || 'Unknown').trim(),
                        sampleStatus: isVerified(r.testStatus) ? 'Received' : String(r.sampleStatus || 'Unknown').trim()
                    });
                }
            }
        } else if (entry && entry.testNames && entry.testNames !== '--') {
            for (const part of entry.testNames.split(',')) {
                const name = part.trim();
                if (name) {
                    items.push({
                        name,
                        testStatus: entry.testStatus || '--',
                        sampleStatus: entry.sampleStatus || '--'
                    });
                }
            }
        }
        return items;
    }

    function initializeBarcodeLogic() {
        mainObserver = new MutationObserver(() => {
            if (observerDebounceTimer) clearTimeout(observerDebounceTimer);
            observerDebounceTimer = setTimeout(observerCallback, DEBOUNCE_DELAY);
        });

        mainObserver.observe(document.body, {
            childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value']
        });

        window.addEventListener('beforeunload', cleanup);
    }

    async function observerCallback() {
        injectStatsBox();
        checkForSaveButton();
        await collectAndSaveBarcodes();
        const stats = extractSampleCounts();
        updateStatsDisplay(stats);
    }

    function checkForSaveButton() {
        const saveBtn = document.getElementById('savebtn-smplrecieve');
        if (saveBtn && !saveBtn.dataset.tmListenerAttached) {
            saveBtn.addEventListener('mousedown', async () => { await collectAndSaveBarcodes(); });
            saveBtn.dataset.tmListenerAttached = "true";
        }
    }

    async function collectAndSaveBarcodes() {
        const selectors = TABLE_BODY_SELECTOR.split(',').map(s => `${s.trim()} tr`);
        const allBarcodeRows = document.querySelectorAll(selectors.join(', '));
        const newEntries = [];

        if (allBarcodeRows.length > 0) {
            for (const row of allBarcodeRows) {
                const barcodeInput = row.querySelector('input[formcontrolname="Barcode"]');
                const workbenchInput = row.querySelector('input[formcontrolname="TestSection"]');
                if (barcodeInput && barcodeInput.value) {
                    const barcode = barcodeInput.value.trim();
                    if(barcode.length < 3) continue;
                    const workbench = workbenchInput && workbenchInput.value ? workbenchInput.value.trim() : 'N/A';
                    newEntries.push({ barcode, workbench });
                }
            }
        }
        if (newEntries.length > 0) await saveBarcodesBatch(newEntries);
    }

    async function saveBarcodesBatch(entries) {
        let barcodes = await getCachedBarcodes();
        let isDirty = false;
        const currentUser = getDetectedUsername();

        for (const entry of entries) {
            if (collectedBarcodesThisSession.has(entry.barcode)) continue;
            if (barcodes.some(b => b.barcode === entry.barcode)) {
                collectedBarcodesThisSession.add(entry.barcode);
                continue;
            }
            barcodes.push({
                count: barcodes.length + 1,
                barcode: entry.barcode,
                workbench: entry.workbench,
                timestamp: new Date().toISOString(),
                found: false,
                username: currentUser,
                sampleStatus: "--",
                testStatus: "--"
            });
            collectedBarcodesThisSession.add(entry.barcode);
            isDirty = true;
        }
        if (isDirty) {
            await saveBarcodesCached(barcodes);
            setTimeout(() => syncPendingStatuses(), 300);
            if (document.getElementById(CUSTOM_CONTENT_ID)?.style.display === 'block') {
                renderThreePaneLayout();
            }
        }
    }

    // --- FAST BULK + PARALLEL API QUERIES ---
    function getApiHeaders() {
        return {
            "accept": "application/json, text/plain, */*",
            "authorization": `bearer ${activeBearerToken}`,
            "content-type": "application/json",
            "x-hospital": "303", "x-location": "303", "x-module": "lab",
            "x-user": activeXUser, "x-group": activeXGroup
        };
    }

    const SYNC_CONCURRENCY = 30;
    const BATCH_CHUNK = 80;

    function getSearchDateRange(oldestIso) {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 30);
        if (oldestIso) {
            const o = new Date(oldestIso);
            o.setDate(o.getDate() - 7);
            if (!isNaN(o) && o > past) past.setTime(o.getTime());
        }
        const fmt = (d, end) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${end ? "23:59:59" : "00:00:00"}`;
        return { from: fmt(past, false), to: fmt(today, true) };
    }

    async function queryBarcodesBatchAPI(barcodes, range) {
        if (!activeBearerToken || !activeXUser || !activeXGroup || !barcodes.length) return null;
        const apiUrl = "https://his.kaauh.org/csi-api/csi-net-labsrvcs/api/v1.1/LabOrderGridData/ActiveTestStatusGridPage?lang=en&internationalization=false";
        const { from, to } = range || getSearchDateRange();

        const payload = {
            "startRow": 0, "endRow": 5000,
            "searchParams": {
                "startRow": 0, "endRow": 5000, "rowGroupCols": [], "valueCols": [], "pivotCols": [], "pivotMode": false, "groupKeys": [],
                "filterModel": {
                    "barcode": { "filterType": "set", "values": barcodes }
                },
                "sortModel": []
            },
            "metaParams": {
                "analyzer": 0, "status": 0, "division": 0,
                "from": from, "to": to,
                "patientMRN": "", "patientName": "", "referenceLab": 0, "clientTimeZoneOffSet": -180, "isDetailedView": false, "divisionCode": null
            }
        };

        try {
            const response = await originalFetch(apiUrl, {
                method: "POST",
                headers: getApiHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function queryBarcodeStatusAPI(barcode) {
        if (!activeBearerToken || !activeXUser || !activeXGroup) return null;
        const apiUrl = "https://his.kaauh.org/csi-api/csi-net-labsrvcs/api/v1.1/LabOrderGridData/ActiveTestStatusGridPage?lang=en&internationalization=false";
        const { from, to } = getSearchDateRange();

        const payload = {
            "startRow": 0, "endRow": 200,
            "searchParams": {
                "startRow": 0, "endRow": 200, "rowGroupCols": [], "valueCols": [], "pivotCols": [], "pivotMode": false, "groupKeys": [],
                "filterModel": { "barcode": { "filterType": "text", "type": "contains", "filter": barcode } }, "sortModel": []
            },
            "metaParams": {
                "analyzer": 0, "status": 0, "division": 0,
                "from": from, "to": to,
                "patientMRN": "", "patientName": "", "referenceLab": 0, "clientTimeZoneOffSet": -180, "isDetailedView": false, "divisionCode": null
            }
        };

        const response = await originalFetch(apiUrl, {
            method: "POST",
            headers: getApiHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok) return null;
        return await response.json();
    }

    function isVerified(s) {
        if (!s) return false;
        const t = String(s).toLowerCase().replace(/[\s_-]+/g, '');
        return t.startsWith('verified');
    }

    function getTestName(r) {
        const v = r.testAbbreviation || r.testDescription;
        return v ? String(v).trim() : '';
    }

    // Excluded test names are treated as Verified / Received
    async function computeStatusSummary(individualTests, apiRows) {
        const excluded = await getExcludedTests();
        const evalTests = individualTests.map(t => {
            if (isTestExcluded(t.name, excluded)) {
                return { ...t, testStatus: 'Verified', sampleStatus: 'Received', excluded: true };
            }
            return t;
        });

        const n = evalTests.length;
        const tests = evalTests.map(t => t.testStatus);
        const samples = evalTests.map(t => t.sampleStatus);
        const testNames = [...new Set(individualTests.map(t => t.name).filter(name => name && name !== '--'))].join(', ') || '--';

        let sampleStatus;
        if (samples.every(s => s.toLowerCase() === 'received')) {
            sampleStatus = 'Received';
        } else if (samples.some(s => s.toLowerCase() === 'rejected')) {
            sampleStatus = 'Rejected';
        } else {
            const notReceived = samples.filter(s => s.toLowerCase() !== 'received');
            sampleStatus = (notReceived.length === n) ? notReceived[0] : `${notReceived[0]} (${notReceived.length}/${n})`;
        }

        const verified = tests.filter(isVerified).length;
        let testStatus;
        if (n === 1) {
            testStatus = tests[0];
        } else if (verified === n) {
            testStatus = `Verified (${n}/${n})`;
        } else if (verified > 0) {
            testStatus = `${verified}/${n} Verified`;
        } else {
            const distinct = [...new Set(tests)];
            testStatus = distinct.length === 1 ? `${distinct[0]} (${n})` : `Mixed (${n})`;
        }

        const allSamplesReceived = n > 0 && sampleStatus.toLowerCase() === 'received';
        const allTestsVerified = n > 0 && evalTests.every(t => isVerified(t.testStatus));
        const allDone = allSamplesReceived && allTestsVerified;

        const orderRow = (apiRows || []).find(r => r.orderNo) || {};
        return { sampleStatus, testStatus, testNames, allDone, orderNo: orderRow.orderNo || null, revId: orderRow.labAyntRequestRevisionId ?? null };
    }

    async function summarizeRows(rows, barcode) {
        const individualTests = getEffectiveIndividualTests(barcode, rows, null);
        return computeStatusSummary(individualTests, rows);
    }

    async function syncPendingStatuses(manual) {
        const syncBtn = document.getElementById('tp-sync-btn');
        if (isSyncingStatuses) return;

        if (!activeBearerToken || !activeXUser || !activeXGroup) {
            if (manual === true && syncBtn) {
                syncBtn.textContent = "No login token yet - click around HIS once";
                setTimeout(() => { syncBtn.textContent = "Sync Statuses"; }, 3500);
            }
            return;
        }
        isSyncingStatuses = true;

        try {
            const snapshot = await getCachedBarcodes();
            const targets = snapshot.filter(b => !b.found);
            if (targets.length === 0) return;

            if (syncBtn) syncBtn.textContent = `Syncing ${targets.length} at once…`;

            const oldest = targets.reduce((m, b) => (!m || b.timestamp < m) ? b.timestamp : m, null);
            const range = getSearchDateRange(oldest);
            const codes = targets.map(b => b.barcode);

            const chunks = [];
            for (let i = 0; i < codes.length; i += BATCH_CHUNK) chunks.push(codes.slice(i, i + BATCH_CHUNK));
            const chunkResults = await Promise.all(chunks.map(c => queryBarcodesBatchAPI(c, range)));

            const grouped = new Map();
            for (const res of chunkResults) {
                if (!res || !Array.isArray(res.data)) continue;
                for (const r of res.data) {
                    if (!r.barcode) continue;
                    const key = String(r.barcode).trim().toLowerCase();
                    if (!grouped.has(key)) grouped.set(key, []);
                    grouped.get(key).push(r);
                }
            }

            const results = new Map();
            const matched = new Set();
            await Promise.all(targets.map(async (b) => {
                const rows = grouped.get(String(b.barcode).trim().toLowerCase());
                if (!rows || rows.length === 0) return;
                matched.add(b.barcode);
                detailRowsCache.set(b.barcode, rows);
                const s = await summarizeRows(rows, b.barcode);
                results.set(b.barcode, { sampleStatus: s.sampleStatus, testStatus: s.testStatus, testNames: s.testNames, orderNo: s.orderNo, revId: s.revId, found: s.allDone });
            }));

            const remaining = targets.filter(b => !matched.has(b.barcode));
            if (remaining.length > 0) {
                let next = 0;
                const worker = async () => {
                    while (next < remaining.length) {
                        const b = remaining[next++];
                        try {
                            const res = await queryBarcodeStatusAPI(b.barcode);
                            if (res && Array.isArray(res.data)) {
                                const wanted = String(b.barcode).trim().toLowerCase();
                                const rows = res.data.filter(r => r.barcode == null || String(r.barcode).trim().toLowerCase() === wanted);
                                if (rows.length > 0) {
                                    detailRowsCache.set(b.barcode, rows);
                                    const s = await summarizeRows(rows, b.barcode);
                                    results.set(b.barcode, { sampleStatus: s.sampleStatus, testStatus: s.testStatus, testNames: s.testNames, orderNo: s.orderNo, revId: s.revId, found: s.allDone });
                                } else {
                                    results.set(b.barcode, { sampleStatus: "Not Found", testStatus: "N/A", testNames: "--", found: false });
                                }
                            }
                        } catch (e) { console.warn("Status lookup failed for", b.barcode, e); }
                    }
                };
                await Promise.all(Array.from({ length: Math.min(SYNC_CONCURRENCY, remaining.length) }, worker));
            }

            if (results.size > 0) {
                const current = await getCachedBarcodes();
                let isDirty = false;
                for (const entry of current) {
                    const r = results.get(entry.barcode);
                    if (!r) continue;
                    entry.sampleStatus = r.sampleStatus;
                    entry.testStatus = r.testStatus;
                    if (!iframeSummaryCache.has(entry.barcode)) entry.testNames = r.testNames;
                    if (r.orderNo) { entry.orderNo = r.orderNo; entry.labAyntRevId = r.revId; }
                    entry.found = r.found;
                    isDirty = true;
                }
                if (isDirty) {
                    await saveBarcodesCached(current);
                    renderThreePaneLayout();
                }
            }
        } catch (e) {
            console.error("Error syncing statuses:", e);
        } finally {
            isSyncingStatuses = false;
            if (syncBtn) syncBtn.textContent = "Sync Statuses";
        }
    }

    async function getCachedBarcodes() {
        const now = Date.now();
        if (!cachedBarcodes || (now - cacheTimestamp) > CACHE_DURATION) {
            const loaded = await GM_getValue(STORAGE_KEY, null);
            if (Array.isArray(loaded)) {
                cachedBarcodes = loaded;
                cacheTimestamp = now;
            } else if (!cachedBarcodes) {
                cachedBarcodes = [];
            }
        }
        return cachedBarcodes;
    }

    async function updatePendingBarcodesCache() {
        if (!cacheUpdatePromise) {
            cacheUpdatePromise = (async () => {
                const barcodes = await getCachedBarcodes();
                pendingBarcodesCache = new Set(barcodes.filter(b => !b.found).map(b => b.barcode));
                cacheUpdatePromise = null;
            })();
        }
        return cacheUpdatePromise;
    }

    async function saveBarcodesCached(barcodes) {
        await GM_setValue(STORAGE_KEY, barcodes);
        cachedBarcodes = barcodes;
        cacheTimestamp = Date.now();
        await updatePendingBarcodesCache();
        highlightRows();
    }

    function extractSampleCounts() {
        const barcodes = cachedBarcodes || [];
        const total = barcodes.length;
        const completed = barcodes.filter(b => b.found).length;
        return { totalSamples: total, completedSamples: completed, pendingSamples: total - completed };
    }

    function getStatusClass(status, type) {
        if (!status || status === '--') return 'bc-status-gray';
        const s = status.toLowerCase();
        if (s.includes('not found') || s.includes('rejected')) return 'bc-status-red';
        if (type === 'sample') {
            if (s === 'received') return 'bc-status-green';
            if (s.startsWith('collected')) return 'bc-status-yellow';
            if (/\(\d+\/\d+\)/.test(s)) return 'bc-status-yellow';
        } else {
            const partial = s.match(/^(\d+)\/(\d+)\s+verified/);
            if (partial) return partial[1] === partial[2] ? 'bc-status-green' : 'bc-status-yellow';
            if (s.startsWith('verified')) return 'bc-status-green';
            if (s.startsWith('resulted')) return 'bc-status-blue';
            if (s.startsWith('mixed')) return 'bc-status-yellow';
            if (s.startsWith('ordered')) return 'bc-status-gray';
        }
        return 'bc-status-gray';
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function formatTimeSince(iso) {
        const d = Math.floor((new Date() - new Date(iso)) / 60000);
        if (d < 1) return "Now";
        const h = Math.floor(d / 60);
        return h > 0 ? `${h}h ${d%60}m` : `${d}m`;
    }

    // ==========================================
    // PART 4: THE 3-PANE LAYOUT ENGINE
    // ==========================================
    async function renderThreePaneLayout() {
        let container = document.getElementById(CUSTOM_CONTENT_ID);
        if (!container) return;

        const stats = extractSampleCounts();
        updateStatsDisplay(stats);

        const barcodes = await getCachedBarcodes();
        barcodes.sort((a, b) => {
             const dateA = new Date(a.timestamp);
             const dateB = new Date(b.timestamp);
             return sortState.direction === 'asc' ? dateA - dateB : dateB - dateA;
        });

        const uniqueWorkbenches = ['All', ...new Set(barcodes.map(b => b.workbench).filter(Boolean))];

        // Only switch selection if the selected barcode was explicitly deleted
        if (activeSelectedBarcode && barcodes.length > 0 && !barcodes.some(b => b.barcode === activeSelectedBarcode)) {
            activeSelectedBarcode = barcodes[0].barcode;
        }
        if (!activeSelectedBarcode && barcodes.length > 0) {
            activeSelectedBarcode = barcodes[0].barcode;
        }

        let innerWrapper = document.getElementById('tp-master-wrapper');
        if (!innerWrapper) {
            container.innerHTML = `
                <div id="tp-master-wrapper">
                    <!-- LEFT PANE: Barcode List -->
                    <div id="tp-pane-left">
                        <div class="tp-left-header">
                            <h3>Barcodes</h3>
                            <span id="tp-left-count" class="tp-badge">${barcodes.length}</span>
                        </div>
                        <div class="tp-left-search-bar">
                            <input type="text" id="tp-filter-search" placeholder="Search barcode..." autocomplete="off" />
                            <select id="tp-workbench-filter"></select>
                        </div>
                        <div class="tp-barcode-list-container">
                            <ul id="tp-barcode-ul"></ul>
                        </div>
                    </div>

                    <!-- CENTER PANE: order view -->
                    <div id="tp-pane-center">
                        <div id="tp-inspector-content"></div>
                    </div>

                    <!-- RIGHT PANE: Actions & Stats -->
                    <div id="tp-pane-right">
                        <div class="tp-right-card">
                            <h4>Sync & Maintenance</h4>
                            <button id="tp-sync-btn" class="tp-btn tp-btn-sync">Sync Statuses</button>
                            <button id="delete-completed-btn" class="tp-btn tp-btn-secondary">Clear Completed</button>
                            <button id="clear-all-btn" class="tp-btn tp-btn-danger">Clear All Data</button>
                        </div>
                        <div class="tp-right-card tp-stats-card">
                            <h4>Session Statistics</h4>
                            <div class="tp-stat-row"><span>Total:</span> <strong id="tp-stat-tot">0</strong></div>
                            <div class="tp-stat-row"><span>Completed:</span> <strong id="tp-stat-ok" style="color:#166534">0</strong></div>
                            <div class="tp-stat-row"><span>Pending:</span> <strong id="tp-stat-pen" style="color:#ef5350">0</strong></div>
                        </div>
                    </div>
                </div>`;

            innerWrapper = document.getElementById('tp-master-wrapper');

            innerWrapper.querySelector('#clear-all-btn').onclick = async () => {
                if (confirm("Delete ALL barcodes?")) {
                    await saveBarcodesCached([]);
                    activeSelectedBarcode = null;
                    lastKnownActiveEntry = null;
                    detailRowsCache.clear();
                    iframeSummaryCache.clear();
                    inspectorInflight.clear();
                    inspectorAttempted.clear();
                    orderLookupFailed.clear();
                    renderThreePaneLayout();
                }
            };
            innerWrapper.querySelector('#delete-completed-btn').onclick = deleteCompletedBarcodes;
            innerWrapper.querySelector('#tp-sync-btn').onclick = () => syncPendingStatuses(true);
            innerWrapper.querySelector('#tp-workbench-filter').onchange = () => renderThreePaneLayout();
            innerWrapper.querySelector('#tp-filter-search').oninput = () => filterBarcodeListDOM();
        }

        const filterDropdown = document.getElementById('tp-workbench-filter');
        if (filterDropdown && filterDropdown.children.length !== uniqueWorkbenches.length) {
             const current = filterDropdown.value;
             filterDropdown.innerHTML = uniqueWorkbenches.map(wb => `<option value="${esc(wb)}">${esc(wb)}</option>`).join('');
             if(uniqueWorkbenches.includes(current)) filterDropdown.value = current;
        }

        const selectedWb = filterDropdown?.value || 'All';
        const searchQuery = (document.getElementById('tp-filter-search')?.value || '').toLowerCase();

        const filteredBarcodes = barcodes.filter(b => {
            const matchesWb = (selectedWb === 'All' || b.workbench === selectedWb);
            const matchesSearch = b.barcode.toLowerCase().includes(searchQuery);
            return matchesWb && matchesSearch;
        });

        const ul = document.getElementById('tp-barcode-ul');
        if (ul) {
            ul.innerHTML = filteredBarcodes.length === 0 ? '<li class="tp-li-empty">No matching barcodes</li>' :
                filteredBarcodes.map(entry => `
                    <li class="tp-barcode-item ${entry.barcode === activeSelectedBarcode ? 'active' : ''} ${entry.found ? 'completed' : ''}" data-barcode="${esc(entry.barcode)}" title="${esc(entry.workbench)}">
                        <strong class="tp-li-code">${esc(entry.barcode)}</strong>
                        <span class="tp-status-pill ${getStatusClass(entry.sampleStatus, 'sample')}">${esc(entry.sampleStatus || '--')}</span>
                        <span class="tp-li-time">${formatTimeSince(entry.timestamp)}</span>
                        <span class="tp-li-delete" data-del="${esc(entry.barcode)}" title="Delete">×</span>
                    </li>
                `).join('');

            ul.onclick = async (e) => {
                const delBtn = e.target.closest('.tp-li-delete');
                if (delBtn) {
                    e.stopPropagation();
                    await deleteBarcode(delBtn.dataset.del);
                    return;
                }
                const li = e.target.closest('.tp-barcode-item');
                if (li) selectBarcode(li.dataset.barcode);
            };
        }

        document.getElementById('tp-stat-tot').textContent = stats.totalSamples;
        document.getElementById('tp-stat-ok').textContent = stats.completedSamples;
        document.getElementById('tp-stat-pen').textContent = stats.pendingSamples;
        document.getElementById('tp-left-count').textContent = barcodes.length;

        await renderInspector(activeSelectedBarcode, false);
    }

    function filterBarcodeListDOM() {
        const searchQuery = (document.getElementById('tp-filter-search')?.value || '').toLowerCase();
        const items = document.querySelectorAll('.tp-barcode-item');
        items.forEach(li => {
            const code = li.dataset.barcode.toLowerCase();
            li.style.display = code.includes(searchQuery) ? 'flex' : 'none';
        });
    }

    // ==========================================
    // CENTER PANE: PERSISTENT BARCODE HEADER BAR, ORDER VIEW & EXCLUSION TOOLBAR
    // ==========================================
    function buildOrderUrl(orderNo, revId) {
        const rev = (revId === null || revId === undefined || revId === '') ? 'null' : revId;
        return `https://his.kaauh.org/lab/#/lab-orders/edit-lab-order/${orderNo}/0/-1/${rev}`;
    }

    async function selectBarcode(code) {
        activeSelectedBarcode = code;
        document.querySelectorAll('.tp-barcode-item').forEach(li =>
            li.classList.toggle('active', li.dataset.barcode === code));

        const list = await getCachedBarcodes();
        const found = list.find(b => b.barcode === code);
        if (found) lastKnownActiveEntry = { ...found };

        iframeSummaryCache.delete(code);

        const frame = $id('tp-order-frame');
        if (frame) {
            frame.dataset.loadedFor = '';
            frame.style.visibility = 'hidden';
            showOrderMsg('Loading order…');
        }

        await renderInspector(code, true);
    }

    function ensureInspectorShell() {
        const host = $id('tp-inspector-content');
        if (!host) return false;
        if ($id('tp-inspector-shell')) return true;

        host.innerHTML = `
            <div id="tp-inspector-shell">
                <div id="tp-empty" class="tp-empty-state" style="display:none">Select an item from the left list to view its order</div>
                <div id="tp-inspector-main">
                    <!-- PERSISTENT BARCODE HEADER BAR -->
                    <div id="tp-barcode-header-card" class="tp-header-card">
                        <span id="ti-code" class="tp-hc-code">--</span>
                        <span id="ti-sample" class="bc-status-badge">--</span>
                        <span id="ti-test" class="bc-status-badge">--</span>
                        <span class="tp-hc-meta"><span id="ti-wb">--</span><i>·</i><span id="ti-order" class="tp-mono">--</span></span>
                        <span id="ti-status" class="tp-hc-sync-note"></span>
                        <div class="tp-hc-actions">
                            <button id="ti-open-tab" class="tp-icon-btn" title="Open order in new tab">↗</button>
                            <button id="inspect-refresh-btn" class="tp-icon-btn" title="Refresh order & status">↻</button>
                        </div>
                    </div>

                    <!-- EXCLUSION TOOLBAR -->
                    <div id="tp-exclude-bar" class="tp-exclude-bar">
                        <span class="tp-ex-title">Exclude tests</span>
                        <div class="tp-ex-input-group">
                            <input type="text" id="tp-ex-input" placeholder="Test name (e.g. TSH, Culture)…" autocomplete="off" />
                            <button id="tp-ex-add-btn" type="button">Add</button>
                        </div>
                        <div id="tp-exclude-list" class="tp-exclude-list"></div>
                    </div>

                    <!-- EMBEDDED ORDER VIEW -->
                    <div id="tp-order-pane">
                        <div id="tp-order-frame-wrap">
                            <div id="tp-order-msg" style="display:none"></div>
                            <iframe id="tp-order-frame" name="tp-order-frame" title="HIS order"></iframe>
                        </div>
                    </div>
                </div>
            </div>`;

        $id('tp-order-frame').addEventListener('load', () => {
            const frame = $id('tp-order-frame');
            if (!frame || frame.getAttribute('src') === 'about:blank') return;
            clearTimeout(loadMsgTimer);
            showOrderMsg('');
            frame.style.visibility = 'visible';
            attachFrameWatcher();
            setTimeout(syncFromIframeSummaryTable, 600);
        });

        const handleAddExclude = async () => {
            const inp = $id('tp-ex-input');
            if (!inp || !inp.value.trim()) return;
            const changed = await addExcludedTests(inp.value);
            inp.value = '';
            if (changed) await applyExclusionsAndRefresh();
        };

        $id('tp-ex-add-btn').onclick = handleAddExclude;
        $id('tp-ex-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddExclude();
            }
        });

        $id('ti-open-tab').onclick = async () => {
            if (!activeSelectedBarcode) return;
            const list = await getCachedBarcodes();
            const e = list.find(b => b.barcode === activeSelectedBarcode) || lastKnownActiveEntry;
            if (e && e.orderNo) window.open(buildOrderUrl(e.orderNo, e.labAyntRevId), '_blank');
            else alert('No order number found yet. Try Refresh first.');
        };

        $id('inspect-refresh-btn').onclick = () => {
            const code = activeSelectedBarcode;
            if (!code) return;
            orderLookupFailed.delete(code);
            iframeSummaryCache.delete(code);
            loadOrderFrame(code, true);
            refreshInspectorRows(code);
        };
        return true;
    }

    async function applyExclusionsAndRefresh() {
        const code = activeSelectedBarcode;
        const list = await getCachedBarcodes();
        const excluded = await getExcludedTests();

        const domTests = code ? iframeSummaryCache.get(code) : null;
        if (domTests) {
            for (const t of domTests) {
                if (t.rowEl) t.rowEl.classList.toggle('tp-row-excluded', isTestExcluded(t.name, excluded));
            }
        }

        // Re-evaluate all cached barcodes with updated exclusions
        let anyChanged = false;
        for (const entry of list) {
            const apiRows = detailRowsCache.get(entry.barcode);
            const tests = getEffectiveIndividualTests(entry.barcode, apiRows, entry);
            if (tests.length > 0) {
                const s = await computeStatusSummary(tests, apiRows);
                if (entry.sampleStatus !== s.sampleStatus || entry.testStatus !== s.testStatus || entry.found !== s.allDone) {
                    entry.sampleStatus = s.sampleStatus;
                    entry.testStatus = s.testStatus;
                    entry.found = s.allDone;
                    anyChanged = true;
                }
            }
        }

        if (anyChanged) {
            await saveBarcodesCached(list);
        }

        const targetEntry = code ? (list.find(b => b.barcode === code) || lastKnownActiveEntry) : null;
        if (targetEntry) updateInspectorSummary(targetEntry);
        await renderExcludeBar();
        renderThreePaneLayout();
    }

    async function syncFromIframeSummaryTable() {
        const code = activeSelectedBarcode;
        if (!code) return;
        const frame = $id('tp-order-frame');
        if (!frame || frame.dataset.loadedFor !== code) return;

        const list = await getCachedBarcodes();
        const entry = list.find(b => b.barcode === code);
        if (!entry) return;

        try {
            const frameHref = frame.contentWindow.location.href;
            if (!frameHref || frameHref === 'about:blank') return;
            if (entry.orderNo && !frameHref.includes(String(entry.orderNo))) return;
        } catch (e) {}

        const domTests = readSummaryTableFromIframe(entry.sampleStatus);
        if (!domTests || domTests.length === 0) return;

        iframeSummaryCache.set(code, domTests);
        const excluded = await getExcludedTests();

        for (const t of domTests) {
            if (t.rowEl) {
                t.rowEl.classList.toggle('tp-row-excluded', isTestExcluded(t.name, excluded));
            }
        }

        const apiRows = detailRowsCache.get(code);
        const s = await computeStatusSummary(domTests, apiRows);

        const before = [entry.sampleStatus, entry.testStatus, entry.found].join('|');
        entry.sampleStatus = s.sampleStatus;
        entry.testStatus = s.testStatus;
        entry.testNames = s.testNames;
        entry.found = s.allDone;
        lastKnownActiveEntry = { ...entry };
        const after = [entry.sampleStatus, entry.testStatus, entry.found].join('|');

        if (activeSelectedBarcode === code) {
            updateInspectorSummary(entry);
            await renderExcludeBar();
        }

        if (before !== after) {
            await saveBarcodesCached(list);
            renderThreePaneLayout();
        }
    }

    async function renderExcludeBar() {
        const exList = $id('tp-exclude-list');
        if (!exList) return;

        const excluded = await getExcludedTests();
        if (excluded.length === 0) {
            exList.innerHTML = `<span class="tp-ex-hint">No tests excluded</span>`;
        } else {
            exList.innerHTML = excluded.map(name => `
                <span class="tp-ex-chip" data-ex-name="${esc(name)}" title="Click to remove exclusion">
                    <span>${esc(name)}</span>
                    <b>×</b>
                </span>
            `).join('');

            exList.onclick = async (e) => {
                const chip = e.target.closest('.tp-ex-chip');
                if (!chip) return;
                await removeExcludedTest(chip.dataset.exName);
                await applyExclusionsAndRefresh();
            };
        }
    }

    function updateInspectorSummary(entry) {
        if (!entry) return;
        lastKnownActiveEntry = { ...entry };

        const headerCard = $id('tp-barcode-header-card');
        if (headerCard) headerCard.style.display = 'flex';

        const code = $id('ti-code');
        if (code) {
            code.textContent = entry.barcode || activeSelectedBarcode || '--';
            code.title = `Logged by ${entry.username || 'Unknown'} · ${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        const wb = $id('ti-wb');
        if (wb) wb.textContent = entry.workbench || '--';
        const ord = $id('ti-order');
        if (ord) ord.textContent = entry.orderNo || '--';

        const sample = $id('ti-sample');
        if (sample) {
            sample.textContent = entry.sampleStatus || '--';
            sample.className = `bc-status-badge ${getStatusClass(entry.sampleStatus, 'sample')}`;
        }

        const test = $id('ti-test');
        if (test) {
            test.textContent = entry.testStatus || '--';
            test.className = `bc-status-badge ${getStatusClass(entry.testStatus, 'test')}`;
        }
    }

    function showOrderMsg(txt) {
        const msg = $id('tp-order-msg');
        if (!msg) return;
        msg.textContent = txt;
        msg.style.display = txt ? 'flex' : 'none';
    }

    async function lookupOrderInfo(barcode) {
        try {
            const res = await queryBarcodeStatusAPI(barcode);
            if (res && Array.isArray(res.data)) {
                const wanted = String(barcode).trim().toLowerCase();
                const row = res.data.find(r => r.orderNo && String(r.barcode || '').trim().toLowerCase() === wanted);
                if (row) {
                    const info = { orderNo: row.orderNo, revId: row.labAyntRequestRevisionId ?? null };
                    const list = await getCachedBarcodes();
                    const e = list.find(b => b.barcode === barcode);
                    if (e) {
                        e.orderNo = info.orderNo;
                        e.labAyntRevId = info.revId;
                        await saveBarcodesCached(list);
                    }
                    return info;
                }
            }
        } catch (e) { console.warn('Order lookup failed for', barcode, e); }
        return null;
    }

    let loadMsgTimer = null;

    async function loadOrderFrame(barcode, hard) {
        const frame = $id('tp-order-frame');
        if (!frame || orderLoading.has(barcode)) return;

        const list = await getCachedBarcodes();
        const entry = list.find(b => b.barcode === barcode) || lastKnownActiveEntry;
        if (!entry || activeSelectedBarcode !== barcode) return;

        let orderNo = entry.orderNo;
        let revId = entry.labAyntRevId;

        if (!orderNo) {
            orderLoading.add(barcode);
            showOrderMsg('Looking up order…');
            frame.style.visibility = 'hidden';
            const info = await lookupOrderInfo(barcode);
            orderLoading.delete(barcode);
            if (activeSelectedBarcode !== barcode) return;
            if (info) { orderNo = info.orderNo; revId = info.revId; }
        }

        if (!orderNo) {
            orderLookupFailed.add(barcode);
            frame.dataset.loadedFor = '';
            frame.style.visibility = 'hidden';
            showOrderMsg(activeBearerToken
                ? 'No order found in HIS for this sample.'
                : 'No login token yet. Click around HIS once, then press Refresh.');
            return;
        }

        orderLookupFailed.delete(barcode);
        const targetUrl = buildOrderUrl(orderNo, revId);

        frame.dataset.loadedFor = barcode;
        showOrderMsg(`Loading order ${orderNo}…`);
        frame.style.visibility = 'hidden';

        clearTimeout(loadMsgTimer);
        loadMsgTimer = setTimeout(() => {
            if (activeSelectedBarcode === barcode) {
                showOrderMsg('');
                frame.style.visibility = 'visible';
            }
        }, 8000);

        try {
            frame.contentWindow.location.href = 'about:blank';
        } catch (e) {}

        setTimeout(() => {
            if (activeSelectedBarcode !== barcode) return;
            frame.src = targetUrl;
        }, 30);
    }

    async function renderInspector(barcode, forceFetch) {
        if (!ensureInspectorShell()) return;

        const main = $id('tp-inspector-main');
        const empty = $id('tp-empty');

        const barcodesList = await getCachedBarcodes();
        const entry = barcode
            ? (barcodesList.find(b => b.barcode === barcode) || (lastKnownActiveEntry?.barcode === barcode ? lastKnownActiveEntry : null))
            : null;

        if (!entry) {
            main.style.display = 'none';
            empty.style.display = 'block';
            return;
        }
        if (activeSelectedBarcode !== barcode) return;

        empty.style.display = 'none';
        main.style.display = 'flex';

        updateInspectorSummary(entry);
        await renderExcludeBar();

        const cachedRows = detailRowsCache.get(barcode);
        const loading = inspectorInflight.has(barcode);
        const statusEl = $id('ti-status');
        if (statusEl) statusEl.textContent = loading ? 'Syncing…' : '';

        if (entry.orderNo) orderLookupFailed.delete(barcode);
        const frame = $id('tp-order-frame');
        if (frame && frame.dataset.loadedFor !== barcode && !orderLookupFailed.has(barcode) && !orderLoading.has(barcode)) {
            loadOrderFrame(barcode, false);
        }

        if (forceFetch || (!cachedRows && !loading && !inspectorAttempted.has(barcode))) {
            refreshInspectorRows(barcode);
        }
    }

    async function refreshInspectorRows(barcode, silent) {
        if (inspectorInflight.has(barcode)) return;
        inspectorInflight.add(barcode);
        inspectorAttempted.add(barcode);

        const setStatus = (txt) => {
            if (activeSelectedBarcode !== barcode) return;
            const el = $id('ti-status');
            if (el) el.textContent = txt;
        };
        if (!silent) setStatus('Syncing…');

        let changed = false;
        try {
            const res = await queryBarcodeStatusAPI(barcode);
            if (!res || !Array.isArray(res.data)) {
                if (!silent) setStatus(activeBearerToken ? 'Lookup failed' : 'No token');
                return;
            }

            const wanted = String(barcode).trim().toLowerCase();
            const rows = res.data.filter(r => r.barcode == null || String(r.barcode).trim().toLowerCase() === wanted);
            if (rows.length === 0) {
                if (!silent) setStatus('Not found in HIS');
                return;
            }

            detailRowsCache.set(barcode, rows);

            const list = await getCachedBarcodes();
            const entry = list.find(b => b.barcode === barcode);
            if (entry) {
                const sig = (e) => [e.sampleStatus, e.testStatus, e.testNames, e.orderNo, e.found].join('|');
                const before = sig(entry);
                const s = await summarizeRows(rows, barcode);
                entry.sampleStatus = s.sampleStatus;
                entry.testStatus = s.testStatus;
                entry.testNames = s.testNames;
                if (s.orderNo) { entry.orderNo = s.orderNo; entry.labAyntRevId = s.revId; }
                entry.found = s.allDone;
                changed = before !== sig(entry);
                if (changed) {
                    await saveBarcodesCached(list);
                }
                if (activeSelectedBarcode === barcode) updateInspectorSummary(entry);
            }
        } catch (e) {
            if (!silent) setStatus('Lookup failed');
            console.warn('Inspector refresh failed for', barcode, e);
            return;
        } finally {
            inspectorInflight.delete(barcode);
        }

        if (activeSelectedBarcode === barcode) {
            setStatus('');
            await syncFromIframeSummaryTable();
        }
        if (changed || !silent) renderThreePaneLayout();
    }

    function pollSelectedBarcode() {
        const content = document.getElementById(CUSTOM_CONTENT_ID);
        if (!content || content.style.display !== 'block' || document.hidden || !activeSelectedBarcode) return;
        syncFromIframeSummaryTable();
        refreshInspectorRows(activeSelectedBarcode, true);
    }

    let frameWatchObserver = null, frameTriggerTimer = null, lastFrameTrigger = 0;
    function attachFrameWatcher() {
        const frame = $id('tp-order-frame');
        if (!frame) return;
        let doc = null;
        try { doc = frame.contentDocument; } catch (e) { return; }
        if (!doc || !doc.body) return;
        if (frameWatchObserver) frameWatchObserver.disconnect();
        frameWatchObserver = new MutationObserver((muts) => {
            const inSummary = muts.some(m => {
                const n = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                return n && n.closest && n.closest('#test-summary-container');
            });
            if (!inSummary) return;
            syncFromIframeSummaryTable();
            clearTimeout(frameTriggerTimer);
            const wait = Math.max(800, 4000 - (Date.now() - lastFrameTrigger));
            frameTriggerTimer = setTimeout(() => {
                lastFrameTrigger = Date.now();
                if (activeSelectedBarcode) refreshInspectorRows(activeSelectedBarcode, true);
            }, wait);
        });
        frameWatchObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });
    }

    async function deleteCompletedBarcodes() {
        if (confirm("Delete all completed barcodes?")) {
            let barcodes = await getCachedBarcodes();
            let updated = barcodes.filter(e => !e.found && !isEntryFullyCompleted(e));
            updated.forEach((e, i) => e.count = i + 1);
            await saveBarcodesCached(updated);
            if (!updated.some(e => e.barcode === activeSelectedBarcode)) {
                activeSelectedBarcode = updated.length > 0 ? updated[0].barcode : null;
                lastKnownActiveEntry = updated.length > 0 ? { ...updated[0] } : null;
            }
            renderThreePaneLayout();
        }
    }

    async function deleteBarcode(b) {
        let barcodes = await getCachedBarcodes();
        let updated = barcodes.filter(e => e.barcode !== b);
        updated.forEach((e, i) => e.count = i + 1);
        await saveBarcodesCached(updated);
        detailRowsCache.delete(b);
        iframeSummaryCache.delete(b);
        inspectorAttempted.delete(b);
        orderLookupFailed.delete(b);
        if (activeSelectedBarcode === b) {
            activeSelectedBarcode = updated.length > 0 ? updated[0].barcode : null;
            lastKnownActiveEntry = updated.length > 0 ? { ...updated[0] } : null;
        }
        renderThreePaneLayout();
    }

    function injectStatsBox() {
        if (statsBoxInjected) return;
        const navbar = document.querySelector(NAVBAR_SELECTOR);
        if (!navbar) return;
        const statsContainer = document.createElement('li');
        statsContainer.className = 'nav-item';
        statsContainer.id = 'bc-stats-container';
        statsContainer.innerHTML = `<div class="bc-stats-box"><div class="bc-stat-item"><span>Tot:</span><span id="bc-total-count" class="bc-stat-value">0</span></div><div class="bc-stat-item"><span>Ok:</span><span id="bc-completed-count" class="bc-stat-value bc-completed">0</span></div><div class="bc-stat-item"><span>Pen:</span><span id="bc-pending-count" class="bc-stat-value bc-pending">0</span></div></div>`;
        const clock = navbar.querySelector('.clock-nav');
        navbar.insertBefore(statsContainer, clock || navbar.firstChild);
        statsBoxInjected = true;
    }

    function updateStatsDisplay(stats) {
        const t = document.getElementById('bc-total-count'); if(t) t.textContent = stats.totalSamples;
        const c = document.getElementById('bc-completed-count'); if(c) c.textContent = stats.completedSamples;
        const p = document.getElementById('bc-pending-count'); if(p) p.textContent = stats.pendingSamples;
        const tabBadge = document.getElementById(TAB_BADGE_ID);
        if (tabBadge) { tabBadge.textContent = stats.pendingSamples; tabBadge.style.display = stats.pendingSamples > 0 ? 'inline-block' : 'none'; }
    }

    function cleanup() {
        if (mainObserver) mainObserver.disconnect();
        if (agGridObserver) agGridObserver.disconnect();
    }

    // ==========================================
    // PART 5: AG-GRID HIGHLIGHTING
    // ==========================================
    function getAgGridApi() {
        const el = document.querySelector('#labTestAnalyzerID');
        if (!el) return null;
        try {
            if (el.gridOptions && el.gridOptions.api) return el.gridOptions.api;
            const ng = window.ng || (typeof unsafeWindow !== 'undefined' ? unsafeWindow.ng : null);
            if (ng && ng.probe) {
                const debugNode = ng.probe(el);
                return debugNode?.componentInstance?.gridOptions?.api || debugNode?.componentInstance?.api;
            }
        } catch(e) {}
        return null;
    }

    async function pinPendingRowsToTop() {
        const api = getAgGridApi();
        if (!api) return;
        const barcodes = await getCachedBarcodes();
        const pendingSet = new Set(barcodes.filter(b => !b.found).map(b => b.barcode));
        const rowsToPin = [];
        api.forEachNode(node => {
            if (node.data && node.data.barcode && pendingSet.has(node.data.barcode)) {
                rowsToPin.push(node.data);
            }
        });
        if (rowsToPin.length > 0 || api.getPinnedTopRowCount() > 0) {
            api.setPinnedTopRowData(rowsToPin);
        }
    }

    function highlightSingleRow(row) {
        const barcodeCell = row.querySelector('[col-id="barcode"]');
        if (!barcodeCell) return;
        const code = Array.from(barcodeCell.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent).join('').trim();

        if (pendingBarcodesCache.has(code)) {
            row.style.backgroundColor = 'lightgreen';
            row.style.color = '#000';
        } else {
            row.style.backgroundColor = '';
            row.style.color = '';
        }
    }

    async function highlightRows() {
        await updatePendingBarcodesCache();
        const rows = document.querySelectorAll('.ag-row');
        rows.forEach(row => highlightSingleRow(row));
        pinPendingRowsToTop();
    }

    function initAgGridRowHighlighting() {
        highlightRows();
        const gridContainer = document.querySelector(GRID_CONTAINER_SELECTOR);
        const floatingTop = document.querySelector(FLOATING_TOP_SELECTOR);

        if (!agGridObserver) {
            agGridObserver = new MutationObserver((mutations) => {
                let shouldPin = false;
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.classList && node.classList.contains('ag-row')) {
                                    highlightSingleRow(node);
                                    shouldPin = true;
                                } else if (node.querySelectorAll) {
                                    node.querySelectorAll('.ag-row').forEach(row => {
                                        highlightSingleRow(row);
                                        shouldPin = true;
                                    });
                                }
                            }
                        });
                    } else if (mutation.type === 'attributes' && mutation.target.classList?.contains('ag-row')) {
                        highlightSingleRow(mutation.target);
                    }
                }
                if (shouldPin) pinPendingRowsToTop();
            });
            const observeConfig = { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'row-index'] };
            if (gridContainer) agGridObserver.observe(gridContainer, observeConfig);
            if (floatingTop) agGridObserver.observe(floatingTop, observeConfig);
        }
    }

    // ==========================================
    // PART 6: STYLES (3-PANE UI)
    // ==========================================
    GM_addStyle(`
        :root { --bc-primary: #ef5350; --bc-secondary: #0288d1; --bc-success: #4caf50; }
        ul.nav.nav-tabs.tab-container { display: flex !important; flex-wrap: nowrap !important; width: 100% !important; gap: 5px !important; }
        ul.nav.nav-tabs.tab-container > li { flex: 1 1 0px !important; display: flex !important; min-width: 0 !important; }
        ul.nav.nav-tabs.tab-container > li > a { width: 100% !important; text-align: center !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; padding: 10px 4px !important; margin: 0 !important; display: block !important; font-size: 12px !important; }
        .tab-badge { background-color: var(--bc-primary); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; margin-left: 5px; }
        #bc-stats-container { display: flex !important; align-items: center; margin-right: auto; padding: 0 10px; }
        .bc-stats-box { display: flex; gap: 10px; background: rgba(0,0,0,0.05); padding: 5px 10px; border-radius: 6px; font-size: 12px; }
        .bc-stat-value { font-weight: bold; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.1); margin-left: 4px; }
        .bc-stat-value.bc-completed { background: var(--bc-success); color: #fff; }
        .bc-stat-value.bc-pending { background: var(--bc-primary); color: #fff; }

        /* THREE PANE CONTAINER */
        #${CUSTOM_CONTENT_ID} { padding: 12px; background: #eaedf2; min-height: 84vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        #tp-master-wrapper { display: flex; gap: 12px; height: 82vh; width: 100%; box-sizing: border-box; }

        /* LEFT PANE */
        #tp-pane-left { width: 270px; flex-shrink: 0; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
        .tp-left-header { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .tp-left-header h3 { margin: 0; font-size: 13.5px; font-weight: 700; color: #0f172a; }
        .tp-badge { background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .tp-left-search-bar { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid #e2e8f0; background: #fff; }
        .tp-left-search-bar input, .tp-left-search-bar select { padding: 5px 9px; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 12px; outline: none; color: #0f172a; }
        .tp-left-search-bar input:focus, .tp-left-search-bar select:focus { border-color: var(--bc-secondary); }
        .tp-barcode-list-container { flex: 1; overflow-y: auto; }
        #tp-barcode-ul { list-style: none; margin: 0; padding: 0; }
        .tp-barcode-item { display: flex; align-items: center; gap: 6px; padding: 4px 10px; min-height: 26px; line-height: 1.2; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background-color 0.1s ease; }
        .tp-barcode-item:hover { background: #f8fafc; }
        .tp-barcode-item.active { background: #eff6ff !important; box-shadow: inset 3px 0 0 #0284c7; }
        .tp-barcode-item.completed { background: #f0fdf4; }
        .tp-li-code { flex: 1; min-width: 0; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tp-barcode-item .tp-status-pill { max-width: 86px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tp-li-time { font-size: 10px; color: #64748b; white-space: nowrap; min-width: 30px; text-align: right; }
        .tp-li-delete { font-weight: bold; color: #94a3b8; font-size: 14px; line-height: 1; cursor: pointer; padding: 0 3px; }
        .tp-li-delete:hover { color: var(--bc-primary); }
        .tp-li-empty { padding: 20px; text-align: center; color: #94a3b8; font-size: 13px; }

        /* CENTER PANE */
        #tp-pane-center { flex: 1; min-width: 0; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; padding: 10px 12px; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
        #tp-inspector-content, #tp-inspector-shell { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        #tp-inspector-main { flex: 1; min-height: 0; flex-direction: column; display: flex; gap: 8px; }
        .tp-empty-state { text-align: center; color: #94a3b8; font-size: 14px; margin-top: 150px; }

        /* PERSISTENT HEADER BAR */
        .tp-header-card {
            display: flex !important; align-items: center; flex-wrap: wrap; gap: 6px 10px;
            flex-shrink: 0; min-height: 40px;
            padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
        }
        .tp-hc-code { font: 700 13.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #0f172a; }
        .tp-hc-meta { display: inline-flex; gap: 6px; font-size: 11.5px; color: #475569; min-width: 0; }
        .tp-hc-meta i { color: #cbd5e1; font-style: normal; }
        .tp-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .tp-hc-sync-note { font-size: 11px; color: #0284c7; font-weight: 600; }
        .tp-hc-actions { display: flex; gap: 5px; margin-left: auto; }
        .tp-icon-btn { width: 28px; height: 28px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; cursor: pointer; font-size: 14px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
        .tp-icon-btn:hover { background: #f1f5f9; border-color: #94a3b8; }

        /* STREAMLINED EXCLUSION TOOLBAR */
        .tp-exclude-bar {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0;
            padding: 5px 10px;
            background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
            font-size: 12px;
        }
        .tp-ex-title { font-weight: 700; color: #475569; white-space: nowrap; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; }
        .tp-ex-input-group { display: inline-flex; align-items: center; gap: 4px; }
        #tp-ex-input {
            padding: 3px 8px; border: 1px solid #cbd5e1; border-radius: 4px;
            font-size: 11.5px; background: #fff; color: #0f172a; width: 205px; outline: none;
        }
        #tp-ex-input:focus { border-color: #0284c7; }
        #tp-ex-add-btn {
            padding: 3px 9px; border: 0; border-radius: 4px;
            background: #334155; color: #fff; font-size: 11px; font-weight: 600; cursor: pointer;
        }
        #tp-ex-add-btn:hover { background: #0f172a; }
        .tp-exclude-list { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; flex: 1; }
        .tp-ex-hint { font-size: 11px; color: #94a3b8; }
        .tp-ex-chip {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 2px 8px; border-radius: 999px;
            background: #fef3c7; border: 1px solid #fcd34d; color: #92400e;
            cursor: pointer; user-select: none; font-weight: 600; font-size: 11px;
        }
        .tp-ex-chip b { font-size: 13px; line-height: 1; color: #b45309; }
        .tp-ex-chip:hover { background: #fde68a; }

        /* ORDER PANE & IFRAME */
        #tp-order-pane { display: flex; flex-direction: column; flex: 1; min-height: 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #f8fafc; }
        #tp-order-frame-wrap { position: relative; flex: 1; min-height: 0; width: 100%; }
        #tp-order-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #fff; }
        #tp-order-msg { position: absolute; inset: 0; align-items: center; justify-content: center; text-align: center; padding: 20px; color: #64748b; font-size: 13px; z-index: 1; }

        /* RIGHT PANE */
        #tp-pane-right { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
        .tp-right-card { background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px; box-shadow: 0 1px 3px rgba(15,23,42,0.04); }
        .tp-right-card h4 { margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #0f172a; }
        .tp-btn { width: 100%; border: none; padding: 8px 12px; border-radius: 5px; color: white; cursor: pointer; font-size: 12px; font-weight: 600; margin-bottom: 6px; text-align: center; }
        .tp-btn:hover { filter: brightness(1.06); }
        .tp-btn-sync { background: #7c3aed; }
        .tp-btn-secondary { background: var(--bc-secondary); }
        .tp-btn-danger { background: var(--bc-primary); margin-bottom: 0; }
        .tp-stats-card .tp-stat-row { display: flex; justify-content: space-between; font-size: 12.5px; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; color: #475569; }
        .tp-stats-card .tp-stat-row:last-child { border-bottom: none; }

        /* STATUS BADGES */
        .bc-status-badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.4; }
        .tp-status-pill { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; }
        .bc-status-green { background: #dcfce7; color: #166534; }
        .bc-status-yellow { background: #fef9c3; color: #854d0e; }
        .bc-status-red { background: #fee2e2; color: #991b1b; }
        .bc-status-blue { background: #dbeafe; color: #1e40af; }
        .bc-status-gray { background: #f1f5f9; color: #475569; }
    `);

    setInterval(init, 1000);
    setInterval(syncPendingStatuses, 15000);
    setInterval(pollSelectedBarcode, 5000);

})();
