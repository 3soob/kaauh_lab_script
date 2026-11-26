// ==UserScript==
// @name         KAAUH Lab - Robust Buttons & Highlighting + Barcode/MRN Dual Entry
// @namespace    Violentmonkey Scripts
// @version      6.0.3
// @description  Performance-optimized entry engines, single-observer architecture, layout-safe grid highlighting, 2-minute persistent clicked-row highlight, live calendar rolling.
// @match        *://his.kaauh.org/lab/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// @author       Hamad Al-Shegifi
// @updateURL    https://github.com/3soob/kaauh_lab_script/raw/refs/heads/main/kaauh_lab_script.user.js
// @downloadURL  https://github.com/3soob/kaauh_lab_script/raw/refs/heads/main/kaauh_lab_script.user.js
// ==/UserScript==
//test
(function () {
    'use strict';

    const CURRENT_VERSION = '6.0.2';
    const SCRIPT_UPDATE_URL = 'file:////10.9.28.57/data/scripts/kaauh_lab_script.js';
    const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    console.log(`KAAUH Lab v${CURRENT_VERSION} Loading...`);

    //================================================================================
    // STYLES
    //================================================================================
    const colors = ['#28a745','#ffc107','#17a2b8','#dc3545','#6f42c1','#fd7e14','#20c997','#6610f2','#e83e8c','#343a40','#198754','#0d6efd','#d63384','#6c757d','#ff5733','#9c27b0','#00bcd4','#795548','#3f51b5','#009688'];
    const dynamicColorClasses = Array.from({ length: 20 }, (_, i) => `.btn-color-${i} { background-color: ${colors[i % colors.length]} !important; }`).join('\n');

    GM_addStyle(`
        .native-date-wrapper { display: flex; flex-direction: column; gap: 8px; width: 100%; background: #fff; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; }
        .date-row { display: flex; align-items: center; gap: 6px; }
        .date-row-label { font-size: 11px; font-weight: bold; color: #6c757d; text-transform: uppercase; width: 45px; }
        .native-select { flex: 1; padding: 4px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white; cursor: pointer; outline: none; }
        .native-select:focus { border-color: #80bdff; box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25); }
        .native-btn-row { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
        .range-btn { background-color: #c0392b; color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .range-btn:hover { background-color: #a93226; }

        .filter-btn-group { display: flex !important; flex-wrap: nowrap !important; gap: 6px !important; margin-top: 12px !important; overflow-x: auto !important; padding-bottom: 6px !important; padding-inline: 10px !important; }
        .filter-btn-group::-webkit-scrollbar { height: 8px; }
        .filter-btn-group::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        .filter-btn-group::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
        .filter-btn-group::-webkit-scrollbar-thumb:hover { background: #555; }
        .filter-btn-group .btn { padding: 6px 12px !important; font-size: 13px !important; font-weight: bold !important; border-radius: 6px !important; border: none !important; color: #fff !important; white-space: nowrap !important; cursor: pointer !important; flex-shrink: 0 !important; transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; }
        .filter-btn-group .btn:not(.selected) { opacity: 0.1 !important; }
        .filter-btn-group .btn.selected { opacity: 1 !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.8), 0 0 0 5px rgba(0,123,255,0.5) !important; transform: scale(1.02) !important; z-index: 10 !important; position: relative !important; }
        .filter-btn-group .btn:hover { opacity: 1 !important; transform: scale(1.05); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .reset-button-container { display: flex !important; align-items: center !important; gap: 15px !important; margin-bottom: 10px !important; justify-content: flex-end !important; }
        .relocated-reset-button { order: -1 !important; margin-right: auto !important; }
        .entry-button-wrapper { display: flex !important; align-items: center !important; gap: 8px !important; }
        ${dynamicColorClasses}

        /* AG Grid row styles (ORDER MATTERS: later rules win at equal specificity) */
        .ag-row:hover .ag-cell { background-color: lightblue !important; }
        .kaauh-row-emergency .ag-cell { background-color: #ffcccb !important; color: black !important; }

        /* Clicked row (stays for 2 minutes). Status cells below keep their own colours. */
        .ag-row.kaauh-row-clicked .ag-cell, .ag-row.kaauh-row-clicked:hover .ag-cell { background-color: #c7b8ea !important; color: black !important; box-shadow: inset 0 1px 0 #5e35b1, inset 0 -1px 0 #5e35b1 !important; }

        /* Status & sample overrides */
        .ag-row .ag-cell.kaauh-status-resulted, .ag-row:hover .ag-cell.kaauh-status-resulted { background-color: #ffb733 !important; color: black !important; }
        .ag-row .ag-cell.kaauh-status-ordered, .ag-row:hover .ag-cell.kaauh-status-ordered { background-color: yellow !important; color: black !important; }
        .ag-row .ag-cell.kaauh-status-verified, .ag-row:hover .ag-cell.kaauh-status-verified { background-color: lightgreen !important; color: black !important; }
        .ag-row .ag-cell.kaauh-sample-received, .ag-row:hover .ag-cell.kaauh-sample-received { background-color: lightgreen !important; color: black !important; font-weight: bold !important; }
        .ag-row .ag-cell.kaauh-sample-rejected, .ag-row:hover .ag-cell.kaauh-sample-rejected { background-color: red !important; color: black !important; font-weight: bold !important; }
        .ag-row .ag-cell.kaauh-sample-collected, .ag-row:hover .ag-cell.kaauh-sample-collected { background-color: orange !important; color: black !important; font-weight: bold !important; }

        #barcode-popup-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: none; z-index: 10000; }
        .barcode-popup-box { position: absolute; background: #fff; padding: 25px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); width: 400px; }
        .barcode-popup-header { margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid #007bff; }
        .barcode-popup-title { margin: 0; color: #007bff; font-size: 20px; font-weight: 600; cursor: move; user-select: none; text-align: center; }
        .barcode-popup-input { width: 100%; padding: 10px; font-size: 16px; border: 2px solid #ccc; border-radius: 4px; padding-right: 30px; }
        .barcode-popup-input-wrapper { position: relative; margin-bottom: 15px; }
        .barcode-popup-clear-btn { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: #ccc; border: none; border-radius: 50%; width: 22px; height: 22px; font-weight: bold; color: white; cursor: pointer; line-height: 20px; text-align: center; font-size: 16px; padding: 0; }
        .barcode-popup-clear-btn:hover { background: #999; }
        .barcode-popup-button-container { display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; }
        .gm-hide-element { display: none !important; }
        #gm-toggle-button { color: white !important; }
    `);

    //================================================================================
    // CONFIG & STATE
    //================================================================================
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYear = new Date().getFullYear();
    const YEARS = Array.from({length: 11}, (_, i) => currentYear - 5 + i);

    const WORKBENCH_SELECTION_KEY = 'kaauh_last_workbench_selection';
    const FILTER_PERSISTENCE_KEY = 'kaauh_filter_persistence';
    const PAGINATION_SIZE_KEY = 'kaauh_last_pagination_size';

    const SELECTORS = {
        workbenchDropdown: '#filterSec',
        statusDropdownTrigger: 'option[translateid="lab-test-analyzer.result-status.Ordered"]',
        buttonGroupContainer: 'ul.nav.nav-tabs.tab-container',
        buttonGroup: '.filter-btn-group',
        agHeaderViewport: '.ag-header-viewport',
        agBodyViewport: '.ag-body-viewport',
        resetButton: 'button[translateid="lab-order-list.Reset"]',
        referenceLabToggle: '.nova-toggle',
    };

    let state = {
        lastUrl: location.href,
        hasAppliedInitialFilters: false,
        filterRetryCount: 0,
        maxFilterRetries: 5,
        isApplyingFilters: false,
        lastFilterApplication: 0,
        observerThrottle: null,
        masterRunning: false,
        rerunRequested: false,
        selectedWorkbenchId: null,
        isProcessingReset: false,
        targetPageSize: null,
        cachedButtons: [],
        popupPromise: null,
        creatingEntryButtons: false
    };

    //================================================================================
    // CLICKED-ROW HIGHLIGHT (persists 2 minutes, survives page switching / re-renders)
    //================================================================================
    // Clicking a row highlights EVERY row with the same barcode (matched via the 'Barcode' column).
    // If no barcode column can be found, it falls back to matching the full row's cell text.
    const CLICK_HIGHLIGHT_TTL_MS = 2 * 60 * 1000;
    const CLICKED_ROWS_KEY = 'kaauh_clicked_rows_v2';
    const IGNORED_SIGNATURE_COLS = new Set(['testStatus', 'sampleStatus']); // these change over time
    const MIN_CELL_OVERLAP = 3; // min. number of identical non-empty cells needed to call it the same row

    let clickedRows = [];          // [{ cells: {colId: text}, rowId, expiry }]
    let clickedExpiryTimer = null;

    function loadClickedRows() {
        try {
            const raw = GM_getValue(CLICKED_ROWS_KEY, '[]');
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            clickedRows = Array.isArray(parsed) ? parsed : [];
        } catch { clickedRows = []; }
        if (pruneClickedRows()) saveClickedRows();
    }

    function saveClickedRows() {
        try { GM_setValue(CLICKED_ROWS_KEY, JSON.stringify(clickedRows)); } catch (e) { console.error(e); }
    }

    function pruneClickedRows() {
        const now = Date.now();
        const before = clickedRows.length;
        clickedRows = clickedRows.filter(e => e.expiry > now);
        return clickedRows.length !== before;
    }

    // Non-empty cell texts of a row, read from the centre container (same row-id as pinned rows)
    function getRowCells(rowEl) {
        const rowId = rowEl.getAttribute('row-id');
        let source = rowEl;
        if (rowId !== null) {
            const centerRow = document.querySelector(`.ag-center-cols-container .ag-row[row-id="${CSS.escape(rowId)}"]`);
            if (centerRow) source = centerRow;
        }
        const cells = {};
        source.querySelectorAll('.ag-cell').forEach(c => {
            const id = c.getAttribute('col-id');
            if (!id || IGNORED_SIGNATURE_COLS.has(id)) return;
            const t = c.textContent.trim();
            if (t) cells[id] = t;
        });
        return cells;
    }

    // Compare only the columns rendered in both (AG Grid virtualises columns); any difference = different row
    function cellsMatch(stored, current) {
        let overlap = 0;
        for (const id in stored) {
            if (Object.prototype.hasOwnProperty.call(current, id)) {
                if (stored[id] !== current[id]) return false;
                overlap++;
            }
        }
        return overlap > 0 && overlap >= Math.min(MIN_CELL_OVERLAP, Object.keys(stored).length);
    }

    // Find the Barcode column's col-id from its header text (falls back to any col-id containing "barcode")
    function getBarcodeColId() {
        const headers = document.querySelectorAll('.ag-header-row[aria-rowindex="1"] .ag-header-cell');
        for (const h of headers) {
            if (h.querySelector('.ag-header-cell-text')?.textContent?.trim().toLowerCase() === 'barcode') {
                const id = h.getAttribute('col-id');
                if (id) return id;
            }
        }
        const anyCell = document.querySelector('.ag-row .ag-cell[col-id*="arcode" i]');
        return anyCell ? anyCell.getAttribute('col-id') : null;
    }

    function getRowBarcode(rowEl, colId) {
        if (!colId) return '';
        const sel = `.ag-cell[col-id="${CSS.escape(colId)}"]`;
        let cell = rowEl.querySelector(sel);
        const rowId = rowEl.getAttribute('row-id');
        if (!cell && rowId !== null) cell = document.querySelector(`.ag-row[row-id="${CSS.escape(rowId)}"] ${sel}`);
        return cell ? cell.textContent.trim() : '';
    }

    function applyClickedHighlights() {
        if (pruneClickedRows()) saveClickedRows();
        const rows = document.querySelectorAll('.ag-row');
        const highlightIds = new Set();

        // READ phase
        if (clickedRows.length) {
            const barcodeCol = getBarcodeColId();
            const barcodes = new Set(clickedRows.filter(e => e.barcode).map(e => e.barcode));
            const cellEntries = clickedRows.filter(e => !e.barcode && e.cells);
            const cache = {};
            for (let i = 0; i < rows.length; i++) {
                const id = rows[i].getAttribute('row-id');
                if (id === null || cache[id]) continue;
                cache[id] = {
                    barcode: barcodes.size ? getRowBarcode(rows[i], barcodeCol) : '',
                    cells: cellEntries.length ? getRowCells(rows[i]) : null
                };
            }
            const ids = Object.keys(cache);
            // Every row sharing a clicked row's barcode is highlighted
            ids.forEach(id => { if (cache[id].barcode && barcodes.has(cache[id].barcode)) highlightIds.add(id); });
            // Fallback (no barcode column found when clicked): full-row cell match
            for (const entry of cellEntries) {
                const matches = ids.filter(id => cache[id].cells && cellsMatch(entry.cells, cache[id].cells));
                if (matches.length > 1 && matches.includes(entry.rowId)) highlightIds.add(entry.rowId);
                else matches.forEach(id => highlightIds.add(id));
            }
        }

        // WRITE phase
        for (let i = 0; i < rows.length; i++) {
            const id = rows[i].getAttribute('row-id');
            const on = id !== null && highlightIds.has(id);
            if (rows[i].classList.contains('kaauh-row-clicked') !== on) rows[i].classList.toggle('kaauh-row-clicked', on);
        }
    }

    function scheduleClickedExpiry() {
        clearTimeout(clickedExpiryTimer);
        if (!clickedRows.length) return;
        const delay = Math.max(50, Math.min(...clickedRows.map(e => e.expiry)) - Date.now() + 50);
        clickedExpiryTimer = setTimeout(() => { applyClickedHighlights(); scheduleClickedExpiry(); }, delay);
    }

    document.addEventListener('click', (e) => {
        const row = e.target.closest && e.target.closest('.ag-row');
        if (!row) return;
        const barcode = getRowBarcode(row, getBarcodeColId());
        if (barcode) {
            // Same barcode => same highlight group; clicking again restarts the 2 minutes
            clickedRows = clickedRows.filter(en => en.barcode !== barcode);
            clickedRows.push({ barcode, expiry: Date.now() + CLICK_HIGHLIGHT_TTL_MS });
        } else {
            const cells = getRowCells(row);
            if (!Object.keys(cells).length) return;
            const key = JSON.stringify(cells);
            clickedRows = clickedRows.filter(en => JSON.stringify(en.cells) !== key);
            clickedRows.push({ cells, rowId: row.getAttribute('row-id'), expiry: Date.now() + CLICK_HIGHLIGHT_TTL_MS });
        }
        saveClickedRows();
        applyClickedHighlights();
        scheduleClickedExpiry();
    }, true);

    loadClickedRows();
    scheduleClickedExpiry();

    //================================================================================
    // ANGULAR DATE RANGE HELPERS
    //================================================================================
    function forceAngularUpdate(originalInput, startD, endD) {
        if (!startD || !endD) return;
        const dates = [startD, endD];
        const usFormat = dates.map(d =>
            String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear()
        ).join(' - ');

        try {
            const ng = pageWindow.ng;
            const context = ng ? (ng.getComponent(originalInput) || ng.getContext(originalInput)) : null;
            if (context) {
                const controlName = originalInput.getAttribute('formcontrolname');
                if (controlName && context[controlName]) {
                    context[controlName].setValue(dates);
                    context[controlName].markAsDirty();
                }
            }
        } catch (e) { /* production Angular builds don't expose ng */ }

        originalInput.value = usFormat;
        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
        originalInput.dispatchEvent(new Event('change', { bubbles: true }));
        originalInput.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function createDropdownGroup(idPrefix, onChangeCallback) {
        const container = document.createElement('div');
        container.className = 'date-row';

        const lbl = document.createElement('span');
        lbl.className = 'date-row-label';
        lbl.innerText = idPrefix;

        const daySelect = document.createElement('select');
        daySelect.className = 'native-select';
        daySelect.innerHTML = `<option value="" disabled selected>Day</option>` +
            Array.from({length: 31}, (_, i) => `<option value="${i+1}">${(i+1).toString().padStart(2, '0')}</option>`).join('');

        const monthSelect = document.createElement('select');
        monthSelect.className = 'native-select';
        monthSelect.innerHTML = `<option value="" disabled selected>Month</option>` +
            MONTHS.map((m, idx) => `<option value="${idx}">${m}</option>`).join('');

        const yearSelect = document.createElement('select');
        yearSelect.className = 'native-select';
        yearSelect.innerHTML = `<option value="" disabled selected>Year</option>` +
            YEARS.map(y => `<option value="${y}">${y}</option>`).join('');

        container.append(lbl, daySelect, monthSelect, yearSelect);

        const getDate = () => (daySelect.value && monthSelect.value && yearSelect.value)
            ? new Date(parseInt(yearSelect.value), parseInt(monthSelect.value), parseInt(daySelect.value)) : null;
        const setDate = (d) => { daySelect.value = d.getDate(); monthSelect.value = d.getMonth(); yearSelect.value = d.getFullYear(); };

        [daySelect, monthSelect, yearSelect].forEach(sel => sel.addEventListener('change', onChangeCallback));
        return { container, getDate, setDate };
    }

    function upgradeInput(originalInput) {
        if (originalInput.dataset.upgraded === "true") return;
        originalInput.dataset.upgraded = "true";
        originalInput.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'native-date-wrapper';

        const triggerSync = () => {
            const startD = startGroup.getDate();
            const endD = endGroup.getDate();
            if (startD) sessionStorage.setItem('tamper_start_ms', startD.getTime());
            if (endD) sessionStorage.setItem('tamper_end_ms', endD.getTime());
            forceAngularUpdate(originalInput, startD || endD, endD || startD);
        };

        const onUserManualChange = () => {
            sessionStorage.setItem('kaauh_date_tracking_active', 'false');
            triggerSync();
        };

        const startGroup = createDropdownGroup("Start", onUserManualChange);
        const endGroup = createDropdownGroup("End", onUserManualChange);

        const btnRow = document.createElement('div');
        btnRow.className = 'native-btn-row';

        const applyPreset = (startOffset, endOffset) => {
            const now = new Date();
            const startD = new Date(now); startD.setDate(now.getDate() + startOffset);
            const endD = new Date(now); endD.setDate(now.getDate() + endOffset);
            startGroup.setDate(startD);
            endGroup.setDate(endD);

            if (endOffset === 0) {
                sessionStorage.setItem('kaauh_date_tracking_active', 'true');
                sessionStorage.setItem('kaauh_date_start_offset', startOffset.toString());
            } else {
                sessionStorage.setItem('kaauh_date_tracking_active', 'false');
            }
            triggerSync();
        };

        const createBtn = (text, title, startOffset, endOffset) => {
            const btn = document.createElement('button');
            btn.className = 'range-btn'; btn.innerText = text; btn.title = title;
            btn.addEventListener('click', (e) => { e.preventDefault(); applyPreset(startOffset, endOffset); });
            return btn;
        };

        btnRow.append(createBtn('Today', 'Today Only', 0, 0), createBtn('Last Week', '-7 Days to Today', -7, 0), createBtn('Last Month', '-30 Days to Today', -30, 0));
        wrapper.append(startGroup.container, endGroup.container, btnRow);
        originalInput.parentNode.insertBefore(wrapper, originalInput);

        const savedStartMs = sessionStorage.getItem('tamper_start_ms');
        const savedEndMs = sessionStorage.getItem('tamper_end_ms');
        const isTrackingActive = sessionStorage.getItem('kaauh_date_tracking_active') === 'true';

        if (isTrackingActive) {
            applyPreset(parseInt(sessionStorage.getItem('kaauh_date_start_offset') || '-7', 10), 0);
        } else if (savedStartMs || savedEndMs) {
            if (savedStartMs) startGroup.setDate(new Date(parseInt(savedStartMs)));
            if (savedEndMs) endGroup.setDate(new Date(parseInt(savedEndMs)));
            setTimeout(triggerSync, 100);
        } else {
            applyPreset(-7, 0);
        }

        originalInput.checkAndRollDate = () => {
            if (sessionStorage.getItem('kaauh_date_tracking_active') === 'true') {
                const clockNow = new Date();
                const currentUiEnd = endGroup.getDate();
                if (!currentUiEnd || currentUiEnd.toDateString() !== clockNow.toDateString()) {
                    applyPreset(parseInt(sessionStorage.getItem('kaauh_date_start_offset') || '-7', 10), 0);
                    console.log('[Calendar Engine] Date rolled forward automatically.');
                }
            }
        };
    }

    function rollAllDates() {
        document.querySelectorAll('input[bsdaterangepicker][data-upgraded="true"]').forEach(input => {
            if (typeof input.checkAndRollDate === 'function') input.checkAndRollDate();
        });
    }

    //================================================================================
    // FILTER PERSISTENCE
    //================================================================================
    const saveFilterValues = async (filters) => { try { await GM_setValue(FILTER_PERSISTENCE_KEY, JSON.stringify(filters)); } catch (e) { console.error(e); } };
    const loadFilterValues = async () => { try { const f = await GM_getValue(FILTER_PERSISTENCE_KEY, null); return f ? JSON.parse(f) : {}; } catch { return {}; } };
    const clearSavedFilters = async () => { try { await GM_setValue(FILTER_PERSISTENCE_KEY, JSON.stringify({})); } catch (e) { console.error(e); } };

    function robustClearInput(inputElement) {
        if (!inputElement || inputElement.value === '') return;

        const clearAction = () => {
            inputElement.value = '';
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
        };

        clearAction();
        let cycles = 0;
        const check = () => {
            if (!document.body.contains(inputElement) || cycles >= 5) return;
            if (inputElement.value !== '') clearAction();
            cycles++;
            setTimeout(check, 100);
        };
        setTimeout(check, 100);
    }

    function setAndVerifyDropdown(dropdown, targetValue, description, duration = 1000) {
        return new Promise((resolve) => {
            if (!dropdown) return resolve(false);
            if (dropdown.value === targetValue) return resolve(true);

            dropdown.value = targetValue;
            dropdown.dispatchEvent(new Event('input', { bubbles: true }));
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));

            let cycles = 0;
            const maxCycles = duration / 100;
            const check = () => {
                if (!document.body.contains(dropdown)) return resolve(false);
                if (dropdown.value !== targetValue) {
                    dropdown.value = targetValue;
                    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (++cycles >= maxCycles) return resolve(dropdown.value === targetValue);
                setTimeout(check, 100);
            };
            setTimeout(check, 100);
        });
    }

    async function performFullReset() {
        if (state.isProcessingReset) return;
        state.isProcessingReset = true;
        try {
            document.querySelectorAll(SELECTORS.agHeaderViewport + ' .ag-floating-filter-input').forEach(robustClearInput);
            await clearSavedFilters();
            const wbSelect = document.getElementById(SELECTORS.workbenchDropdown.substring(1));
            if (wbSelect) await setAndVerifyDropdown(wbSelect, wbSelect.options[0].value, 'Workbench');
            const statusDropdown = document.querySelector(SELECTORS.statusDropdownTrigger)?.closest('select');
            if (statusDropdown) await setAndVerifyDropdown(statusDropdown, statusDropdown.options[0].value, 'Status');
            state.selectedWorkbenchId = null;
            await GM_setValue(WORKBENCH_SELECTION_KEY, JSON.stringify({}));
            state.cachedButtons.forEach(btn => btn.classList.remove('selected'));
        } catch (error) {
            console.error(error);
        } finally {
            setTimeout(() => { state.isProcessingReset = false; }, 1000);
        }
    }

    //================================================================================
    // PAGINATION
    //================================================================================
    async function enforcePaginationSize() {
        const dropdown = document.getElementById("dropdownPaginationPageSize");
        if (!dropdown) return;

        if (!state.targetPageSize) state.targetPageSize = await GM_getValue(PAGINATION_SIZE_KEY, "500");

        const targetSizes = ["10", "50", "100", "500"];
        const currentOptions = Array.from(dropdown.options).map(opt => opt.value);
        const isMismatch = targetSizes.length !== currentOptions.length || targetSizes.some((val, index) => currentOptions[index] !== val);

        if (isMismatch) dropdown.innerHTML = targetSizes.map(size => `<option value="${size}">${size}</option>`).join('');

        if (dropdown.dataset.pageSizeListenerAttached !== 'true') {
            dropdown.addEventListener('change', async (e) => {
                const newSize = e.target.value;
                if (state.targetPageSize !== newSize) {
                    state.targetPageSize = newSize;
                    await GM_setValue(PAGINATION_SIZE_KEY, newSize);
                }
            });
            dropdown.dataset.pageSizeListenerAttached = 'true';
        }

        if (dropdown.value !== state.targetPageSize || isMismatch) {
            dropdown.value = state.targetPageSize;
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    //================================================================================
    // COLUMN FILTERS
    //================================================================================
    function setColumnFilter(columnName, value, shouldPersist = true) {
        const headerViewport = document.querySelector(SELECTORS.agHeaderViewport);
        if (!headerViewport) return false;

        // Use only the title row so floating-filter cells can't shift the index
        const titleCells = Array.from(headerViewport.querySelectorAll('.ag-header-row[aria-rowindex="1"] .ag-header-cell'));
        const columnIndex = titleCells.findIndex(cell => cell.getAttribute('col-id') === columnName);
        if (columnIndex === -1) return false;

        const filterInput = headerViewport.querySelector('.ag-header-row[aria-rowindex="2"]')?.children[columnIndex]?.querySelector('.ag-floating-filter-input');
        if (!filterInput) return false;
        if (filterInput.value === value) return true;

        filterInput.value = value;
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
        filterInput.dispatchEvent(new Event('change', { bubbles: true }));

        if (shouldPersist) {
            setTimeout(async () => {
                const currentFilters = await loadFilterValues();
                currentFilters[columnName] = value;
                await saveFilterValues(currentFilters);
            }, 250);
        }
        return true;
    }

    async function applySavedFilters() {
        if (state.isApplyingFilters) return true;
        const now = Date.now();
        if (now - state.lastFilterApplication < 1000) return true;

        state.isApplyingFilters = true;
        state.lastFilterApplication = now;
        try {
            const savedFilters = await loadFilterValues();
            let allOk = true;
            for (const [columnName, value] of Object.entries(savedFilters)) {
                if (!setColumnFilter(columnName, value, false)) allOk = false;
                await new Promise(r => setTimeout(r, 200));
            }
            return allOk;
        } finally {
            setTimeout(() => { state.isApplyingFilters = false; }, 500);
        }
    }

    async function applyFiltersWithRetry() {
        if (!document.querySelector(SELECTORS.agHeaderViewport)) return;
        const success = await applySavedFilters();
        if (!success && state.filterRetryCount < state.maxFilterRetries) {
            state.filterRetryCount++;
            setTimeout(applyFiltersWithRetry, 1500);
        }
    }

    //================================================================================
    // PATIENT LOCATION & INFO PANEL
    //================================================================================
    function readLocationText() {
        const locElement = document.querySelector('div.patient-info span[title*="UNIT/"]') || document.querySelector('div.patient-info span[title]');
        if (!locElement) return null;
        const titleAttr = locElement.getAttribute('title');
        if (titleAttr && titleAttr.trim() !== '') return titleAttr.trim().replace(/\s+/g, ' ');
        const clone = locElement.cloneNode(true);
        const h6 = clone.querySelector('h6'); if (h6) h6.remove();
        return clone.textContent.trim().replace(/\s+/g, ' ').replace(/^Bed\s*/i, '').trim() || null;
    }

    function addLocationToHeader() {
        if (!document.getElementById('mrn-display') || !document.getElementById('barcode-display-box')) return;
        const location = readLocationText();
        const existing = document.getElementById('suite-location-display');

        if (existing) {
            // keep it in sync when the patient changes
            if (location && existing.textContent !== location) existing.textContent = location;
            return;
        }
        if (!location) return;

        const locationDiv = document.createElement('div');
        locationDiv.id = 'suite-location-display'; locationDiv.textContent = location;
        Object.assign(locationDiv.style, { fontWeight: 'bold', fontSize: '18px', color: '#ffffff', backgroundColor: '#0000ff', borderRadius: '4px', padding: '4px 10px', marginLeft: '12px', display: 'flex', alignItems: 'center' });
        document.getElementById('mrn-display').after(locationDiv);
    }

    function manageInfoPanelVisibility() {
        const buttonContainer = document.querySelector('.btn-area');
        const targetElement = document.querySelector('.lo-view-detail-top');

        if (targetElement) {
            targetElement.classList.toggle('gm-hide-element', GM_getValue('elementHidden', false));
        }

        if (buttonContainer && !document.getElementById('gm-toggle-button')) {
            const toggleButton = document.createElement('button');
            toggleButton.id = 'gm-toggle-button'; toggleButton.className = 'btn btn-color-11';

            const updateLabel = () => {
                const isHidden = GM_getValue('elementHidden', false);
                toggleButton.innerHTML = isHidden ? 'Show Info' : 'Hide Info';
                toggleButton.setAttribute('title', isHidden ? 'Show patient info header' : 'Hide patient info header');
            };

            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                const newHidden = !GM_getValue('elementHidden', false);
                GM_setValue('elementHidden', newHidden);
                updateLabel();
                // look the panel up again: Angular may have re-created it
                document.querySelector('.lo-view-detail-top')?.classList.toggle('gm-hide-element', newHidden);
            });

            const wrapper = document.createElement('div');
            wrapper.className = 'btn-group mr-1'; wrapper.appendChild(toggleButton);
            buttonContainer.prepend(wrapper);
            updateLabel();
        }
    }

    //================================================================================
    // GRID CELL HIGHLIGHTING (read/write batched)
    //================================================================================
    function applyConditionalCellStyles() {
        const rows = document.querySelectorAll('.ag-center-cols-container .ag-row');

        if (rows.length > 0) {
            const updates = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                let isEmergency = false, testClass = '', sampleClass = '';

                const clinicCell = row.querySelector('.ag-cell[col-id="clinic"]');
                if (clinicCell) isEmergency = clinicCell.textContent.trim().toUpperCase() === 'EMERGENCY';

                const testStatusCell = row.querySelector('.ag-cell[col-id="testStatus"]');
                if (testStatusCell) {
                    const text = testStatusCell.textContent.trim();
                    if (text === 'Resulted') testClass = 'kaauh-status-resulted';
                    else if (text === 'Ordered') testClass = 'kaauh-status-ordered';
                    else if (text.startsWith('VerifiedLevel')) testClass = 'kaauh-status-verified';
                }

                const sampleStatusCell = row.querySelector('.ag-cell[col-id="sampleStatus"]');
                if (sampleStatusCell) {
                    const text = sampleStatusCell.textContent.trim();
                    if (text === 'Received') sampleClass = 'kaauh-sample-received';
                    else if (text === 'Rejected') sampleClass = 'kaauh-sample-rejected';
                    else if (text === 'Collected') sampleClass = 'kaauh-sample-collected';
                }

                updates.push({
                    row, isEmergency,
                    testStatusCell, testClass, testCurrentClass: testStatusCell ? (testStatusCell.dataset.kaauhCustomClass || '') : '',
                    sampleStatusCell, sampleClass, sampleCurrentClass: sampleStatusCell ? (sampleStatusCell.dataset.kaauhCustomClass || '') : ''
                });
            }

            for (let i = 0; i < updates.length; i++) {
                const u = updates[i];
                if (u.row.classList.contains('kaauh-row-emergency') !== u.isEmergency) u.row.classList.toggle('kaauh-row-emergency', u.isEmergency);

                if (u.testStatusCell && u.testCurrentClass !== u.testClass) {
                    if (u.testCurrentClass) u.testStatusCell.classList.remove(u.testCurrentClass);
                    if (u.testClass) u.testStatusCell.classList.add(u.testClass);
                    u.testStatusCell.dataset.kaauhCustomClass = u.testClass;
                }
                if (u.sampleStatusCell && u.sampleCurrentClass !== u.sampleClass) {
                    if (u.sampleCurrentClass) u.sampleStatusCell.classList.remove(u.sampleCurrentClass);
                    if (u.sampleClass) u.sampleStatusCell.classList.add(u.sampleClass);
                    u.sampleStatusCell.dataset.kaauhCustomClass = u.sampleClass;
                }
            }
        }

        applyClickedHighlights();
    }

    // The grid DOM is destroyed/re-created when the user leaves and returns to the page,
    // so we remember the actual elements we attached to and re-attach when they change.
    let scrollViewportEl = null;
    let gridObserver = null;
    let observedContainerEl = null;
    let gridUpdatePending = false;

    function setupGridScrollListener() {
        const gridViewport = document.querySelector(SELECTORS.agBodyViewport);
        if (!gridViewport) { scrollViewportEl = null; return; }
        if (gridViewport === scrollViewportEl) return;
        gridViewport.addEventListener('scroll', () => { requestAnimationFrame(applyConditionalCellStyles); }, { passive: true });
        scrollViewportEl = gridViewport;
    }

    function watchGridForChanges() {
        const gridContainer = document.querySelector('.ag-center-cols-container');
        if (!gridContainer) {
            if (gridObserver) { gridObserver.disconnect(); gridObserver = null; }
            observedContainerEl = null;
            return;
        }
        if (gridContainer === observedContainerEl && gridContainer.isConnected) return;

        if (gridObserver) gridObserver.disconnect();
        gridObserver = new MutationObserver(() => {
            if (gridUpdatePending) return;
            gridUpdatePending = true;
            requestAnimationFrame(() => {
                gridUpdatePending = false;
                applyConditionalCellStyles();
            });
        });
        gridObserver.observe(gridContainer, { childList: true, subtree: true });
        observedContainerEl = gridContainer;
        applyConditionalCellStyles();
    }

    //================================================================================
    // WORKBENCH BUTTONS
    //================================================================================
    function updateButtonSelection(selectedId) {
        state.selectedWorkbenchId = selectedId;
        state.cachedButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.workbenchId === selectedId));
    }

    function insertFilterButtons() {
        if (document.querySelector(SELECTORS.buttonGroup)) return;
        const target = document.querySelector(SELECTORS.buttonGroupContainer);
        const select = document.getElementById(SELECTORS.workbenchDropdown.substring(1));
        if (!target || !select || select.options.length <= 1) return;

        const workbenches = Array.from(select.options).reduce((acc, option) => {
            const id = option.value?.trim();
            let name = option.textContent?.trim();
            if (id && name) {
                if (name.toLowerCase().includes('---select---') || ['select', 'all'].includes(name.toLowerCase())) name = 'ALL WORK BENCHES';
                acc[name] = id;
            }
            return acc;
        }, {});
        if (Object.keys(workbenches).length <= 1) return;

        const group = document.createElement('div');
        group.className = 'filter-btn-group';
        const fragment = document.createDocumentFragment();

        let colorIndex = 0;
        state.cachedButtons = [];

        for (const [name, id] of Object.entries(workbenches)) {
            const btn = document.createElement('button');
            btn.className = `btn btn-color-${colorIndex++ % 20}`;
            btn.dataset.workbenchId = id;

            const sessionKey = `workbench_status_${id || 'all'}`;
            let currentStatus = sessionStorage.getItem(sessionKey) || 'Ordered';
            btn.textContent = `${name} (${currentStatus})`;

            if (select.value === id) { btn.classList.add('selected'); state.selectedWorkbenchId = id; }

            btn.addEventListener('click', async () => {
                currentStatus = (currentStatus === 'Ordered') ? 'Resulted' : 'Ordered';
                sessionStorage.setItem(sessionKey, currentStatus);
                btn.textContent = `${name} (${currentStatus})`;

                updateButtonSelection(id);
                await GM_setValue(WORKBENCH_SELECTION_KEY, JSON.stringify({ id, status: currentStatus }));

                const wbSelect = document.getElementById(SELECTORS.workbenchDropdown.substring(1));
                await setAndVerifyDropdown(wbSelect, id, 'Workbench');

                const statusDropdown = document.querySelector(SELECTORS.statusDropdownTrigger)?.closest('select');
                if (statusDropdown) {
                    const optToSelect = Array.from(statusDropdown.options).find(opt => opt.textContent.trim() === currentStatus);
                    if (optToSelect) await setAndVerifyDropdown(statusDropdown, optToSelect.value, 'Status');
                }
            });

            state.cachedButtons.push(btn);
            fragment.appendChild(btn);
        }

        group.appendChild(fragment);
        target.parentNode.insertBefore(group, target.nextSibling);
        if (!state.selectedWorkbenchId && select.value) updateButtonSelection(select.value);
    }

    function addStatusDropdownListener() {
        const statusDropdown = document.querySelector(SELECTORS.statusDropdownTrigger)?.closest('select');
        if (!statusDropdown || statusDropdown.dataset.statusListenerAttached === 'true') return;

        statusDropdown.addEventListener('change', async (event) => {
            try {
                const selectedOption = event.target.options[event.target.selectedIndex];
                const selectedText = selectedOption.textContent.trim();

                if (selectedOption.value === '0' || selectedText.toLowerCase().includes('select')) {
                    if (state.isProcessingReset) return;
                    document.querySelector('.relocated-reset-button')?.click();
                    return;
                }
                setTimeout(() => {
                    if (selectedText === 'Sample Rejected') { setColumnFilter('sampleStatus', 'Rejected'); setColumnFilter('testStatus', ''); }
                    else if (selectedText === 'Sample Refused') { setColumnFilter('sampleStatus', 'Refused'); setColumnFilter('testStatus', ''); }
                    else {
                        const statusMap = { 'Verified 1': 'VerifiedLevel1', 'Verified 2': 'VerifiedLevel2', 'Cancelled': 'Cancelled' };
                        setColumnFilter('testStatus', statusMap[selectedText] || selectedText);
                        setColumnFilter('sampleStatus', 'Received');
                    }
                }, 100);
            } catch (error) { console.error(error); }
        });
        statusDropdown.dataset.statusListenerAttached = 'true';
    }

    function relocateResetButton() {
        if (document.querySelector('.reset-button-container')) return;
        const resetButton = document.querySelector(SELECTORS.resetButton);
        const referenceLabToggle = document.querySelector(SELECTORS.referenceLabToggle);
        if (!resetButton || !referenceLabToggle) return;

        const container = document.createElement('div');
        container.className = 'reset-button-container';

        const relocatedResetButton = resetButton.cloneNode(true);
        relocatedResetButton.classList.add('relocated-reset-button');

        referenceLabToggle.parentNode.insertBefore(container, referenceLabToggle);
        container.appendChild(relocatedResetButton);
        container.appendChild(referenceLabToggle);
        resetButton.remove();

        relocatedResetButton.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            await performFullReset();
        });
    }

    //================================================================================
    // BARCODE / MRN ENTRY
    //================================================================================
    const TARGET_SEARCH_PLACEHOLDER = 'Search by MRN / NationalId & IqamaId';
    const BARCODE_POPUP_POSITION_KEY = 'kaauh_barcode_popup_position';
    const POPUP_MODE_KEY = 'kaauh_barcode_popup_mode';

    function clearAllFiltersShallow() {
        const clearAndNotify = (el) => {
            if (el && el.value !== '') {
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        clearAndNotify(document.querySelector(`input[placeholder="${TARGET_SEARCH_PLACEHOLDER}"]`));
        document.querySelectorAll('input.ag-floating-filter-input').forEach(clearAndNotify);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Delete') return;
        const el = document.activeElement;
        const tag = el?.tagName;
        const editable = el && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable);
        // Don't wipe filters while the user is deleting text in other fields (popup, forms...)
        if (editable && !el.classList.contains('ag-floating-filter-input')) return;
        clearAllFiltersShallow();
    });

    function findFilterInputByHeader(headerText) {
        const headerViewport = document.querySelector(SELECTORS.agHeaderViewport);
        if (!headerViewport) return null;

        const allTitleCells = Array.from(headerViewport.querySelectorAll('.ag-header-row[aria-rowindex="1"] .ag-header-cell'));
        const index = allTitleCells.findIndex(cell => cell.querySelector('.ag-header-cell-text')?.textContent?.trim().toLowerCase() === headerText.toLowerCase());
        if (index === -1) return null;

        return headerViewport.querySelector('.ag-header-row[aria-rowindex="2"]')?.children[index]?.querySelector('input.ag-floating-filter-input');
    }

    async function buildBarcodePopup() {
        const savedPos = await GM_getValue(BARCODE_POPUP_POSITION_KEY, null);
        const position = savedPos ? JSON.parse(savedPos) : null;

        const popupContainer = document.createElement('div'); popupContainer.id = 'barcode-popup-container';
        const popupBox = document.createElement('div'); popupBox.className = 'barcode-popup-box';

        if (position?.top && position?.left) {
            popupBox.style.top = position.top; popupBox.style.left = position.left;
        } else {
            popupBox.style.top = '50%'; popupBox.style.left = '50%'; popupBox.style.transform = 'translate(-50%, -50%)';
        }

        const popupHeader = document.createElement('div'); popupHeader.className = 'barcode-popup-header';
        const popupTitle = document.createElement('h3'); popupTitle.className = 'barcode-popup-title'; popupTitle.textContent = 'Quick Entry - Barcode / MRN';
        popupHeader.appendChild(popupTitle);

        const inputWrapper = document.createElement('div'); inputWrapper.className = 'barcode-popup-input-wrapper';
        const popupInput = document.createElement('input'); popupInput.id = 'barcode-popup-input'; popupInput.type = 'text'; popupInput.placeholder = 'Scan or type and press Enter'; popupInput.className = 'barcode-popup-input';

        const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.className = 'barcode-popup-clear-btn'; clearBtn.innerHTML = '&times;';
        clearBtn.addEventListener('click', () => { popupInput.value = ''; popupInput.focus(); });
        inputWrapper.appendChild(popupInput); inputWrapper.appendChild(clearBtn);

        const buttonContainer = document.createElement('div'); buttonContainer.className = 'barcode-popup-button-container';
        const closeButton = document.createElement('button'); closeButton.textContent = 'Close'; closeButton.className = 'btn btn-secondary';
        Object.assign(closeButton.style, { padding: '8px 20px', fontSize: '14px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#6c757d', color: '#fff', border: 'none' });
        closeButton.addEventListener('click', () => { popupContainer.style.display = 'none'; });
        buttonContainer.appendChild(closeButton);

        popupBox.append(popupHeader, inputWrapper, buttonContainer);
        popupContainer.appendChild(popupBox);
        document.body.appendChild(popupContainer);

        popupHeader.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (popupBox.style.transform && popupBox.style.transform !== 'none') {
                const rect = popupBox.getBoundingClientRect();
                popupBox.style.left = rect.left + 'px'; popupBox.style.top = rect.top + 'px'; popupBox.style.transform = 'none';
            }
            const initLeft = popupBox.offsetLeft, initTop = popupBox.offsetTop, startX = e.clientX, startY = e.clientY;

            const onMouseMove = (mEvent) => {
                popupBox.style.left = (initLeft + (mEvent.clientX - startX)) + 'px';
                popupBox.style.top = (initTop + (mEvent.clientY - startY)) + 'px';
            };
            const onMouseUp = async () => {
                document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
                await GM_setValue(BARCODE_POPUP_POSITION_KEY, JSON.stringify({ top: popupBox.style.top, left: popupBox.style.left }));
            };
            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
        });

        popupContainer.addEventListener('click', (e) => { if (e.target === popupContainer) popupContainer.style.display = 'none'; });
        popupInput.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const val = popupInput.value.trim(); if (!val) return;

            clearAllFiltersShallow();
            const currentMode = await GM_getValue(POPUP_MODE_KEY, 'BARCODE');
            const targetInput = currentMode === 'MRN' ? findFilterInputByHeader('Cluster MRN') : findFilterInputByHeader('Barcode');

            if (targetInput) {
                targetInput.value = val;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                popupInput.value = ''; popupInput.focus();
            } else {
                popupInput.style.borderColor = 'red'; setTimeout(() => popupInput.style.borderColor = '#ccc', 2000);
            }
        });

        return popupContainer;
    }

    // Cached promise: concurrent callers can no longer build the popup twice
    function createBarcodePopup() {
        const existing = document.getElementById('barcode-popup-container');
        if (existing) return Promise.resolve(existing);
        if (!state.popupPromise) {
            state.popupPromise = buildBarcodePopup().finally(() => { state.popupPromise = null; });
        }
        return state.popupPromise;
    }

    async function ensureEntryButtonsExist() {
        if (state.creatingEntryButtons) return;
        const container = document.querySelector('.reset-button-container');
        if (!container) return;
        const existingWrapper = document.getElementById('entry-buttons-wrapper');
        if (existingWrapper && container.contains(existingWrapper)) return;

        state.creatingEntryButtons = true;
        try {
            if (existingWrapper) existingWrapper.remove();
            await createBarcodePopup();

            const buttonWrapper = document.createElement('div'); buttonWrapper.id = 'entry-buttons-wrapper'; buttonWrapper.className = 'entry-button-wrapper';

            const createEntryBtn = (id, text, color, mode) => {
                const btn = document.createElement('button'); btn.id = id; btn.textContent = text;
                Object.assign(btn.style, { backgroundColor: color, padding: '6px 12px', fontSize: '13px', fontWeight: 'bold', borderRadius: '6px', color: '#ffffff', border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer' });
                btn.addEventListener('click', async () => {
                    await GM_setValue(POPUP_MODE_KEY, mode);
                    await performFullReset();
                    const popup = await createBarcodePopup();
                    popup.style.display = 'block';
                    document.getElementById('barcode-popup-input')?.focus();
                });
                return btn;
            };

            buttonWrapper.appendChild(createEntryBtn('barcode-entry-btn', 'Barcode Entry', '#11800b', 'BARCODE'));
            buttonWrapper.appendChild(createEntryBtn('mrn-entry-btn', 'MRN Entry', '#d19a02', 'MRN'));
            container.appendChild(buttonWrapper);
        } finally {
            state.creatingEntryButtons = false;
        }
    }

    //================================================================================
    // NAVIGATION
    //================================================================================
    function setupNavigationShortcut() {
        const link = document.querySelector('span.csi-menu-text[title="Lab Orders"]')?.closest('a');
        if (!link || link.dataset.shortcutAttached === 'true') return;

        link.addEventListener('click', () => {
            setTimeout(() => { document.querySelector('a[href="lab-orders/lab-test-analyzer"]')?.click(); }, 100);
        });
        link.dataset.shortcutAttached = 'true';
    }

    // Returns true when both dropdowns exist (so the caller knows it is safe to mark "applied")
    async function applyPersistentWorkbenchFilter() {
        const wbSelect = document.getElementById(SELECTORS.workbenchDropdown.substring(1));
        const statusDropdown = document.querySelector(SELECTORS.statusDropdownTrigger)?.closest('select');
        if (!wbSelect || !statusDropdown) return false;

        try {
            const saved = await GM_getValue(WORKBENCH_SELECTION_KEY, null);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.id && parsed?.status) {
                    const wSuccess = await setAndVerifyDropdown(wbSelect, parsed.id, 'Workbench');
                    const targetOpt = Array.from(statusDropdown.options).find(opt => opt.textContent.trim() === parsed.status);
                    let sSuccess = false;
                    if (targetOpt) sSuccess = await setAndVerifyDropdown(statusDropdown, targetOpt.value, 'Status');
                    if (wSuccess && sSuccess) updateButtonSelection(parsed.id);
                }
            }
        } catch (e) { console.error(e); }
        return true;
    }

    function tryInjectSidebarMenu() {
        const INJECT_ID = '__custom-lab-test-status';
        const isLabTestRoute = window.location.hash.startsWith('#/lab-orders/lab-test-analyzer');

        const existing = document.getElementById(INJECT_ID);
        if (existing) { existing.classList.toggle('active', isLabTestRoute); return; }

        const listMenu = document.querySelector('csi-list-menu > div');
        if (!listMenu) return;

        const html = `<div id="__custom-sidebar-wrapper">
                        <div><csi-main-menu>
                            <a id="${INJECT_ID}" href="#/lab-orders/lab-test-analyzer" routerlinkactive="active" style="cursor:pointer;" class="${isLabTestRoute ? 'active' : ''}">
                                <span class="icon-holder csi-menu-icon"><i class="nova-icon-scan"></i></span>
                                <div class="csi-menu-text-wrapper"><span class="csi-menu-text sidemenu-title" title="Lab Test Status">Lab Test Status</span></div>
                            </a>
                        </csi-main-menu></div>
                      </div>`;
        listMenu.insertAdjacentHTML('afterbegin', html);
    }

    //================================================================================
    // MASTER OBSERVER (throttled, never starved, never overlapping)
    //================================================================================
    async function runMasterPass() {
        if (location.href !== state.lastUrl) {
            state.lastUrl = location.href;
            Object.assign(state, { hasAppliedInitialFilters: false, filterRetryCount: 0, isApplyingFilters: false, selectedWorkbenchId: null, isProcessingReset: false });
        }

        setupNavigationShortcut();
        tryInjectSidebarMenu();
        addLocationToHeader();

        document.querySelectorAll('input[bsdaterangepicker]').forEach(upgradeInput);
        rollAllDates();

        if (!location.href.includes('lab-orders/lab-test-analyzer')) return;

        await enforcePaginationSize();
        relocateResetButton();
        ensureEntryButtonsExist();
        insertFilterButtons();
        addStatusDropdownListener();
        setupGridScrollListener();
        watchGridForChanges();
        manageInfoPanelVisibility();

        if (!state.hasAppliedInitialFilters && document.querySelector(SELECTORS.agHeaderViewport)) {
            const ready = await applyPersistentWorkbenchFilter();
            if (ready) {
                await applyFiltersWithRetry();
                state.hasAppliedInitialFilters = true;
            }
        }

        applyConditionalCellStyles();
    }

    function masterObserverCallback() {
        if (state.observerThrottle) return; // throttle (not debounce) so constant mutations can't starve it
        state.observerThrottle = setTimeout(async () => {
            state.observerThrottle = null;
            if (state.masterRunning) { state.rerunRequested = true; return; }
            state.masterRunning = true;
            try {
                await runMasterPass();
            } catch (e) {
                console.error('[KAAUH] master pass error', e);
            } finally {
                state.masterRunning = false;
                if (state.rerunRequested) { state.rerunRequested = false; masterObserverCallback(); }
            }
        }, 100);
    }

    //================================================================================
    // UPDATE CHECKER
    //================================================================================
    function isNewerVersion(remote, local) {
        const a = remote.split('.').map(n => parseInt(n, 10) || 0);
        const b = local.split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const x = a[i] || 0, y = b[i] || 0;
            if (x > y) return true;
            if (x < y) return false;
        }
        return false;
    }

    function showUpdateNotification(newVersion) {
        if (document.getElementById('kaauh-update-notification') || sessionStorage.getItem('kaauh_skip_update_notif') === String(newVersion)) return;

        const notif = document.createElement('div');
        notif.id = 'kaauh-update-notification';
        notif.innerHTML = `
            <div style="font-weight:bold;margin-bottom:5px;font-size:15px;">🚀 Script Update Available!</div>
            <div style="margin-bottom:8px;">Version <b>${newVersion}</b> was found on the network.</div>
            <div style="font-size:12px;margin-bottom:10px;opacity:0.9;">Please click "Check for updates" in your extension menu to install.</div>
            <button id="kaauh-update-dismiss" style="width:100%;padding:6px;background:#fff;color:#d35400;border:none;border-radius:4px;font-weight:bold;cursor:pointer;">Dismiss</button>
        `;
        Object.assign(notif.style, {
            position: 'fixed', bottom: '25px', right: '25px', backgroundColor: '#d35400', color: 'white',
            padding: '18px', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', zIndex: '10001',
            fontFamily: 'sans-serif', fontSize: '13px', width: '280px', transition: 'all 0.3s ease'
        });

        document.body.appendChild(notif);
        document.getElementById('kaauh-update-dismiss').addEventListener('click', () => {
            notif.remove();
            sessionStorage.setItem('kaauh_skip_update_notif', String(newVersion));
        });
    }

    function checkForUpdates() {
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: SCRIPT_UPDATE_URL,
                onload: function (response) {
                    if (response.status === 200 || response.status === 0) {
                        const match = response.responseText.match(/@version\s+([\d.]+)/);
                        if (match && match[1] && isNewerVersion(match[1], CURRENT_VERSION)) showUpdateNotification(match[1]);
                    }
                },
                onerror: function (err) { console.warn('[Update Engine] Network path check failed.', err); }
            });
        } catch (e) { console.warn('[Update Engine] request blocked', e); }
    }

    setTimeout(checkForUpdates, 5000);
    setInterval(checkForUpdates, 10 * 60 * 1000);

    //================================================================================
    // START
    //================================================================================
    const observer = new MutationObserver(masterObserverCallback);
    observer.observe(document.body, { childList: true, subtree: true });
    masterObserverCallback();

    window.addEventListener('hashchange', () => { tryInjectSidebarMenu(); masterObserverCallback(); });

    // Real clock tick: roll the date range at midnight even if the page is idle (no DOM mutations)
    setInterval(rollAllDates, 30000);
})();
