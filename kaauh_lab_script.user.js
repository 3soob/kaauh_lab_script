// ==UserScript==
// @name         KAAUH Lab - Robust Buttons & Highlighting + Barcode/MRN Dual Entry
// @namespace    Violentmonkey Scripts
// @version      5.7
// @description  Performance-optimized entry engines, clean single-observer architecture, layout-safe grid highlighting, and real-time live clock calendar rolling tracking.
// @match        *://his.kaauh.org/lab/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @author       Hamad Al-Shegifi
// @updateURL    file:////10.9.28.57/data/scripts/kaauh_lab_script.js
// @downloadURL  file:////10.9.28.57/data/scripts/kaauh_lab_script.js
// ==/UserScript==


(function () {
    'use strict';

    const CURRENT_VERSION = 5.7;
    const SCRIPT_UPDATE_URL = 'file:////10.9.28.57/data/scripts/kaauh_lab_script.js';

    console.log(`KAAUH Lab - Robust Buttons & Highlighting + Dual Entry v${CURRENT_VERSION} Loading...`);

    //================================================================================
    // ALL STYLES CONSOLIDATED (PERFORMANCE-TUNED COMPILATION)
    //================================================================================
    const colors = ['#28a745','#ffc107','#17a2b8','#dc3545','#6f42c1','#fd7e14','#20c997','#6610f2','#e83e8c','#343a40','#198754','#0d6efd','#d63384','#6c757d','#ff5733','#9c27b0','#00bcd4','#795548','#3f51b5','#009688'];
    const dynamicColorClasses = Array.from({ length: 20 }, (_, i) => `.btn-color-${i} { background-color: ${colors[i % colors.length]} !important; }`).join('\n');

    GM_addStyle(`
        /* Native Dropdown Overrides */
        .native-date-wrapper { display: flex; flex-direction: column; gap: 8px; width: 100%; background: #fff; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; }
        .date-row { display: flex; align-items: center; gap: 6px; }
        .date-row-label { font-size: 11px; font-weight: bold; color: #6c757d; text-transform: uppercase; width: 45px; }
        .native-select { flex: 1; padding: 4px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white; cursor: pointer; outline: none; }
        .native-select:focus { border-color: #80bdff; box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25); }
        .native-btn-row { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
        .range-btn { background-color: #c0392b; color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .range-btn:hover { background-color: #a93226; }

        /* Filter Management Suite Layouts */
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

        /* AG Grid Layout Base Row Toggles */
        .ag-row:hover .ag-cell { background-color: lightblue !important; }
        .kaauh-row-emergency .ag-cell { background-color: #ffcccb !important; color: black !important; }

        /* HIGH PRIORITIZATION STATUS & SAMPLE OVERRIDES (Defeats row emergency & hover cascades) */
        .ag-row .ag-cell.kaauh-status-resulted, .ag-row:hover .ag-cell.kaauh-status-resulted { background-color: #ffb733 !important; color: black !important; }
        .ag-row .ag-cell.kaauh-status-ordered, .ag-row:hover .ag-cell.kaauh-status-ordered { background-color: yellow !important; color: black !important; }
        .ag-row .ag-cell.kaauh-status-verified, .ag-row:hover .ag-cell.kaauh-status-verified { background-color: lightgreen !important; color: black !important; }
        .ag-row .ag-cell.kaauh-sample-received, .ag-row:hover .ag-cell.kaauh-sample-received { background-color: lightgreen !important; color: black !important; font-weight: bold !important; }
        .ag-row .ag-cell.kaauh-sample-rejected, .ag-row:hover .ag-cell.kaauh-sample-rejected { background-color: red !important; color: black !important; font-weight: bold !important; }
        .ag-row .ag-cell.kaauh-sample-collected, .ag-row:hover .ag-cell.kaauh-sample-collected { background-color: orange !important; color: black !important; font-weight: bold !important; }

        /* Dialog UI Architecture */
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
    // CONFIGURATION, CONSTANTS & STATE HOOKS
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
        selectedWorkbenchId: null,
        isProcessingReset: false,
        gridObserverActive: false,
        scrollListenerAttached: false,
        targetPageSize: null,
        cachedButtons: [] // Added for button optimization
    };

    //================================================================================
    // NATIVE ANGULAR FORMS PRESCRIPTION UPDATER
    //================================================================================
    function forceAngularUpdate(originalInput, startD, endD) {
        if (!startD || !endD) return;
        const dates = [startD, endD];
        const translatedUsFormatStr = dates.map(d =>
            String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear()
        ).join(' - ');

        const context = window.ng ? window.ng.getComponent(originalInput) || window.ng.getContext(originalInput) : null;
        if (context) {
            const controlName = originalInput.getAttribute('formcontrolname');
            if (controlName && context[controlName]) {
                context[controlName].setValue(dates);
                context[controlName].markAsDirty();
            }
        }
        originalInput.value = translatedUsFormatStr;
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
        const dayPlaceholder = document.createElement('option');
        dayPlaceholder.value = ""; dayPlaceholder.text = "Day"; dayPlaceholder.disabled = true; dayPlaceholder.selected = true;
        daySelect.appendChild(dayPlaceholder);
        for (let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i; opt.text = i.toString().padStart(2, '0');
            daySelect.appendChild(opt);
        }

        const monthSelect = document.createElement('select');
        monthSelect.className = 'native-select';
        const monthPlaceholder = document.createElement('option');
        monthPlaceholder.value = ""; monthPlaceholder.text = "Month"; monthPlaceholder.disabled = true; monthPlaceholder.selected = true;
        monthSelect.appendChild(monthPlaceholder);
        MONTHS.forEach((m, idx) => {
            const opt = document.createElement('option');
            opt.value = idx; opt.text = m;
            monthSelect.appendChild(opt);
        });

        const yearSelect = document.createElement('select');
        yearSelect.className = 'native-select';
        const yearPlaceholder = document.createElement('option');
        yearPlaceholder.value = ""; yearPlaceholder.text = "Year"; yearPlaceholder.disabled = true; yearPlaceholder.selected = true;
        yearSelect.appendChild(yearPlaceholder);
        YEARS.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y; opt.text = y;
            yearSelect.appendChild(opt);
        });

        container.appendChild(lbl);
        container.appendChild(daySelect);
        container.appendChild(monthSelect);
        container.appendChild(yearSelect);

        const getDate = () => {
            if (daySelect.value && monthSelect.value && yearSelect.value) {
                return new Date(parseInt(yearSelect.value), parseInt(monthSelect.value), parseInt(daySelect.value));
            }
            return null;
        };

        const setDate = (d) => {
            daySelect.value = d.getDate();
            monthSelect.value = d.getMonth();
            yearSelect.value = d.getFullYear();
        };

        daySelect.addEventListener('change', onChangeCallback);
        monthSelect.addEventListener('change', onChangeCallback);
        yearSelect.addEventListener('change', onChangeCallback);

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

            if (startD && endD) forceAngularUpdate(originalInput, startD, endD);
            else if (startD && !endD) forceAngularUpdate(originalInput, startD, startD);
            else if (!startD && endD) forceAngularUpdate(originalInput, endD, endD);
        };

        // User adjusted a dropdown manually -> Suspend auto-rolling updates to avoid fighting the user
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

            // If targeted to today, lock tracking parameters into memory for background execution loops
            if (endOffset === 0) {
                sessionStorage.setItem('kaauh_date_tracking_active', 'true');
                sessionStorage.setItem('kaauh_date_start_offset', startOffset.toString());
            } else {
                sessionStorage.setItem('kaauh_date_tracking_active', 'false');
            }
            triggerSync();
        };

        const todayBtn = document.createElement('button');
        todayBtn.className = 'range-btn'; todayBtn.innerText = 'Today'; todayBtn.title = 'Today Only';
        todayBtn.addEventListener('click', (e) => { e.preventDefault(); applyPreset(0, 0); });

        const weekBtn = document.createElement('button');
        weekBtn.className = 'range-btn'; weekBtn.innerText = 'Last Week'; weekBtn.title = '-7 Days to Today';
        weekBtn.addEventListener('click', (e) => { e.preventDefault(); applyPreset(-7, 0); });

        const monthBtn = document.createElement('button');
        monthBtn.className = 'range-btn'; monthBtn.innerText = 'Last Month'; monthBtn.title = '-30 Days to Today';
        monthBtn.addEventListener('click', (e) => { e.preventDefault(); applyPreset(-30, 0); });

        btnRow.appendChild(todayBtn); btnRow.appendChild(weekBtn); btnRow.appendChild(monthBtn);
        wrapper.appendChild(startGroup.container); wrapper.appendChild(endGroup.container); wrapper.appendChild(btnRow);
        originalInput.parentNode.insertBefore(wrapper, originalInput);

        const savedStartMs = sessionStorage.getItem('tamper_start_ms');
        const savedEndMs = sessionStorage.getItem('tamper_end_ms');
        const isTrackingActive = sessionStorage.getItem('kaauh_date_tracking_active') === 'true';

        if (isTrackingActive) {
            // Live rolling tracking configuration was active, calculate fresh bounds relative to right now
            const offset = parseInt(sessionStorage.getItem('kaauh_date_start_offset') || '-7', 10);
            applyPreset(offset, 0);
        } else if (savedStartMs || savedEndMs) {
            // Static custom historical parameters selected previously, bind cleanly
            if (savedStartMs) startGroup.setDate(new Date(parseInt(savedStartMs)));
            if (savedEndMs) endGroup.setDate(new Date(parseInt(savedEndMs)));
            setTimeout(triggerSync, 100);
        } else {
            // System Cold Boot Execution -> Apply Last Week dynamic engine parameters by default
            applyPreset(-7, 0);
        }

        // Expose a performance-safe endpoint hook for master observers to sync live clock operations seamlessly
        originalInput.checkAndRollDate = () => {
            if (sessionStorage.getItem('kaauh_date_tracking_active') === 'true') {
                const clockNow = new Date();
                const currentUiEnd = endGroup.getDate();

                // If the clock day rolls over into a new real-world date, shift parameters automatically
                if (!currentUiEnd || currentUiEnd.toDateString() !== clockNow.toDateString()) {
                    const offset = parseInt(sessionStorage.getItem('kaauh_date_start_offset') || '-7', 10);
                    const rollingStart = new Date(clockNow);
                    rollingStart.setDate(clockNow.getDate() + offset);

                    startGroup.setDate(rollingStart);
                    endGroup.setDate(clockNow);

                    forceAngularUpdate(originalInput, rollingStart, clockNow);

                    sessionStorage.setItem('tamper_start_ms', rollingStart.getTime());
                    sessionStorage.setItem('tamper_end_ms', clockNow.getTime());
                    console.log('[Calendar Engine] Date rolled forward automatically into matching current real-world "Today".');
                }
            }
        };
    }

    //================================================================================
    // FILTER PERSISTENCE AND STATE ENFORCEMENT
    //================================================================================
    async function saveFilterValues(filters) {
        try { await GM_setValue(FILTER_PERSISTENCE_KEY, JSON.stringify(filters)); } catch (e) { console.error(e); }
    }

    async function loadFilterValues() {
        try { const f = await GM_getValue(FILTER_PERSISTENCE_KEY, null); return f ? JSON.parse(f) : {}; } catch { return {}; }
    }

    async function clearSavedFilters() {
        try { await GM_setValue(FILTER_PERSISTENCE_KEY, JSON.stringify({})); } catch (e) { console.error(e); }
    }

    function robustClearInput(inputElement) {
        if (!inputElement || inputElement.value === '') return;
        inputElement.value = '';
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
        let cycles = 0;
        const enforcer = setInterval(() => {
            if (!document.body.contains(inputElement) || cycles >= 5) { clearInterval(enforcer); return; }
            if (inputElement.value !== '') {
                inputElement.value = '';
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
            cycles++;
        }, 100);
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

    function setAndVerifyDropdown(dropdown, targetValue, description, duration = 1000) {
        return new Promise((resolve) => {
            if (!dropdown) { return resolve(false); }
            if (dropdown.value === targetValue) return resolve(true);

            dropdown.value = targetValue;
            dropdown.dispatchEvent(new Event('input', { bubbles: true }));
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));

            let cycles = 0;
            const interval = setInterval(() => {
                if (!document.body.contains(dropdown)) { clearInterval(interval); return resolve(false); }
                if (dropdown.value !== targetValue) {
                    dropdown.value = targetValue;
                    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (++cycles >= (duration / 100)) { clearInterval(interval); return resolve(dropdown.value === targetValue); }
            }, 100);
        });
    }

    //================================================================================
    // DYNAMIC PERSISTENT PAGINATION HANDLING
    //================================================================================
    async function enforcePaginationSize() {
        const dropdown = document.getElementById("dropdownPaginationPageSize");
        if (!dropdown) return;

        if (!state.targetPageSize) {
            state.targetPageSize = await GM_getValue(PAGINATION_SIZE_KEY, "500");
        }

        const targetSizes = ["10", "50", "100", "500"];
        const currentOptions = Array.from(dropdown.options).map(opt => opt.value);
        let optionsChanged = false;

        const isMismatch = targetSizes.length !== currentOptions.length || targetSizes.some((val, index) => currentOptions[index] !== val);

        if (isMismatch) {
            dropdown.innerHTML = '';
            targetSizes.forEach(size => {
                const opt = document.createElement('option');
                opt.value = size;
                opt.text = size;
                dropdown.appendChild(opt);
            });
            optionsChanged = true;
        }

        if (dropdown.dataset.pageSizeListenerAttached !== 'true') {
            dropdown.addEventListener('change', async (e) => {
                const newSize = e.target.value;
                if (state.targetPageSize !== newSize) {
                    state.targetPageSize = newSize;
                    await GM_setValue(PAGINATION_SIZE_KEY, newSize);
                    console.log(`[Pagination Engine] Stored default viewport restriction: ${newSize} items.`);
                }
            });
            dropdown.dataset.pageSizeListenerAttached = 'true';
        }

        if (dropdown.value !== state.targetPageSize || optionsChanged) {
            dropdown.value = state.targetPageSize;
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    //================================================================================
    // COLUMN FILTER INTERFACES
    //================================================================================
    function setColumnFilter(columnName, value, shouldPersist = true) {
        const headerViewport = document.querySelector(SELECTORS.agHeaderViewport);
        if (!headerViewport) return false;
        const allCols = Array.from(headerViewport.querySelectorAll('.ag-header-cell')).map(cell => cell.getAttribute('col-id'));
        const columnIndex = allCols.indexOf(columnName);
        if (columnIndex === -1) return false;

        const filterInput = headerViewport.querySelector(`.ag-header-row[aria-rowindex="2"]`)?.children[columnIndex]?.querySelector('.ag-floating-filter-input');
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
            if (Object.keys(savedFilters).length === 0) return true;
            for (const [columnName, value] of Object.entries(savedFilters)) {
                setColumnFilter(columnName, value, false);
                await new Promise(r => setTimeout(r, 250));
            }
            return true;
        } finally {
            setTimeout(() => { state.isApplyingFilters = false; }, 500);
        }
    }

    async function applyFiltersWithRetry() {
        if (!document.querySelector(SELECTORS.agHeaderViewport)) return;
        const success = await applySavedFilters();
        if (!success && state.filterRetryCount < state.maxFilterRetries) {
            state.filterRetryCount++;
            setTimeout(() => applyFiltersWithRetry(), 1500);
        }
    }

    //================================================================================
    // PATIENT LOCATION LOGGER & PANEL TOGGLES
    //================================================================================
    function addLocationToHeader() {
        if (!document.getElementById('mrn-display') || !document.getElementById('barcode-display-box') || document.getElementById('suite-location-display')) return;
        let locElement = document.querySelector('div.patient-info span[title*="UNIT/"]') || document.querySelector('div.patient-info span[title]');
        let location = null;
        if (locElement) {
            const titleAttr = locElement.getAttribute('title');
            if (titleAttr && titleAttr.trim() !== '') {
                location = titleAttr.trim().replace(/\s+/g, ' ');
            } else {
                const clone = locElement.cloneNode(true);
                const h6 = clone.querySelector('h6'); if (h6) h6.remove();
                location = clone.textContent.trim().replace(/\s+/g, ' ').replace(/^Bed\s*/i, '').trim();
            }
        }
        if (location) {
            const locationDiv = document.createElement('div');
            locationDiv.id = 'suite-location-display'; locationDiv.textContent = `${location}`;
            Object.assign(locationDiv.style, { fontWeight: 'bold', fontSize: '18px', color: '#ffffff', backgroundColor: '#0000ff', borderRadius: '4px', padding: '4px 10px', marginLeft: '12px', display: 'flex', alignItems: 'center' });
            document.getElementById('mrn-display').after(locationDiv);
        }
    }

    function manageInfoPanelVisibility() {
        const buttonContainer = document.querySelector('.btn-area');
        const targetElement = document.querySelector('.lo-view-detail-top');

        if (targetElement) {
            const isHidden = GM_getValue('elementHidden', false);
            targetElement.classList.toggle('gm-hide-element', isHidden);
        }

        if (buttonContainer && !document.getElementById('gm-toggle-button')) {
            const toggleButton = document.createElement('button');
            toggleButton.id = 'gm-toggle-button'; toggleButton.className = 'btn btn-color-11';

            const updateState = () => {
                const isHidden = GM_getValue('elementHidden', false);
                toggleButton.innerHTML = isHidden ? `Show Info` : `Hide Info`;
                toggleButton.setAttribute('title', isHidden ? 'Show patient info header' : 'Hide patient info header');
            };

            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                const current = GM_getValue('elementHidden', false);
                GM_setValue('elementHidden', !current);
                updateState();
                if (targetElement) targetElement.classList.toggle('gm-hide-element', !current);
            });

            const wrapper = document.createElement('div');
            wrapper.className = 'btn-group mr-1'; wrapper.appendChild(toggleButton);
            buttonContainer.prepend(wrapper);
            updateState();
        }
    }

    //================================================================================
    // LAYOUT REPAINT OPTIMIZED HIGH-SPEED CELLS HIGHLIGHTING
    //================================================================================
    function applyConditionalCellStyles() {
        const rows = document.querySelectorAll('.ag-center-cols-container .ag-row');
        if (rows.length === 0) return;

        // Optimization: Rather than iterating over all cells in every row, we query specifically
        // for the columns we need to check, and use dataset caching to skip unneeded classList updates.
        rows.forEach(row => {
            // Clinic check for EMERGENCY
            const clinicCell = row.querySelector('.ag-cell[col-id="clinic"]');
            if (clinicCell) {
                const isEmergency = clinicCell.textContent.trim().toUpperCase() === 'EMERGENCY';
                if (row.classList.contains('kaauh-row-emergency') !== isEmergency) {
                    row.classList.toggle('kaauh-row-emergency', isEmergency);
                }
            }

            // Test Status Checks
            const testStatusCell = row.querySelector('.ag-cell[col-id="testStatus"]');
            if (testStatusCell) {
                const text = testStatusCell.textContent.trim();
                let newClass = '';
                
                if (text === 'Resulted') newClass = 'kaauh-status-resulted';
                else if (text === 'Ordered') newClass = 'kaauh-status-ordered';
                else if (text.startsWith('VerifiedLevel')) newClass = 'kaauh-status-verified';

                const currentClass = testStatusCell.dataset.kaauhCustomClass || '';
                if (currentClass !== newClass) {
                    if (currentClass) testStatusCell.classList.remove(currentClass);
                    if (newClass) testStatusCell.classList.add(newClass);
                    testStatusCell.dataset.kaauhCustomClass = newClass;
                }
            }

            // Sample Status Checks
            const sampleStatusCell = row.querySelector('.ag-cell[col-id="sampleStatus"]');
            if (sampleStatusCell) {
                const text = sampleStatusCell.textContent.trim();
                let newClass = '';

                if (text === 'Received') newClass = 'kaauh-sample-received';
                else if (text === 'Rejected') newClass = 'kaauh-sample-rejected';
                else if (text === 'Collected') newClass = 'kaauh-sample-collected';

                const currentClass = sampleStatusCell.dataset.kaauhCustomClass || '';
                if (currentClass !== newClass) {
                    if (currentClass) sampleStatusCell.classList.remove(currentClass);
                    if (newClass) sampleStatusCell.classList.add(newClass);
                    sampleStatusCell.dataset.kaauhCustomClass = newClass;
                }
            }
        });
    }

    function setupGridScrollListener() {
        const gridViewport = document.querySelector(SELECTORS.agBodyViewport);
        if (!gridViewport) { state.scrollListenerAttached = false; return; }
        if (state.scrollListenerAttached) return;

        // Uses passive listener to avoid blocking main thread scrolling
        gridViewport.addEventListener('scroll', () => { requestAnimationFrame(applyConditionalCellStyles); }, { passive: true });
        state.scrollListenerAttached = true;
    }

    function watchGridForChanges() {
        const gridContainer = document.querySelector('.ag-center-cols-container');
        if (!gridContainer) { state.gridObserverActive = false; return; }
        if (state.gridObserverActive) return;

        const gridObserver = new MutationObserver(() => { applyConditionalCellStyles(); });
        gridObserver.observe(gridContainer, { childList: true, subtree: true });
        state.gridObserverActive = true;
    }

    //================================================================================
    // ACTION INTERACTION CONTROLLERS (WORKBENCH PRESETS & QUICK BUTTONS)
    //================================================================================
    function updateButtonSelection(selectedId) {
        state.selectedWorkbenchId = selectedId;
        // Optimization: Use cached buttons instead of querying the DOM again
        state.cachedButtons.forEach(btn => {
            if (btn.dataset.workbenchId === selectedId) {
                if (!btn.classList.contains('selected')) btn.classList.add('selected');
            } else {
                if (btn.classList.contains('selected')) btn.classList.remove('selected');
            }
        });
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
        
        // Optimization: use a DocumentFragment for batch DOM insertions
        const fragment = document.createDocumentFragment();
        let colorIndex = 0;
        state.cachedButtons = []; // Reset cache

        for (const [name, id] of Object.entries(workbenches)) {
            const btn = document.createElement('button');
            btn.className = `btn btn-color-${colorIndex++ % 20}`;
            btn.dataset.workbenchId = id;
            const sessionKey = `workbench_status_${id || 'all'}`;
            let currentStatus = sessionStorage.getItem(sessionKey) || 'Ordered';
            btn.textContent = `${name} (${currentStatus})`;
            
            if (select.value === id) { 
                btn.classList.add('selected'); 
                state.selectedWorkbenchId = id; 
            }

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
                    const rbtn = document.querySelector('.relocated-reset-button');
                    if (rbtn) rbtn.click();
                    return;
                }
                setTimeout(async () => {
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
    // ENTRY ENGINE WINDOW ARCHITECTURE (BARCODE/MRN DUAL DIALOG)
    //================================================================================
    const TARGET_SEARCH_PLACEHOLDER = 'Search by MRN / NationalId & IqamaId';
    const BARCODE_POPUP_POSITION_KEY = 'kaauh_barcode_popup_position';
    const POPUP_MODE_KEY = 'kaauh_barcode_popup_mode';

    function clearAllFiltersShallow() {
        const clearAndNotify = (el) => { if (el && el.value !== '') { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } };
        clearAndNotify(document.querySelector(`input[placeholder="${TARGET_SEARCH_PLACEHOLDER}"]`));
        document.querySelectorAll('input.ag-floating-filter-input').forEach(clearAndNotify);
    }

    document.addEventListener('keydown', (e) => {
        if (document.activeElement && document.activeElement.id === 'barcode-popup-input') return;
        if (e.key === 'Delete') clearAllFiltersShallow();
    });

    function findFilterInputByHeader(headerText) {
        const headerViewport = document.querySelector(SELECTORS.agHeaderViewport);
        if (!headerViewport) return null;
        const allTitleCells = Array.from(headerViewport.querySelectorAll('.ag-header-row[aria-rowindex="1"] .ag-header-cell'));
        let targetCell = allTitleCells.find(cell => cell.querySelector('.ag-header-cell-text')?.textContent?.trim().toLowerCase() === headerText.toLowerCase());
        if (!targetCell) return null;

        const colId = targetCell.getAttribute('col-id');
        const index = allTitleCells.findIndex(cell => cell.getAttribute('col-id') === colId);
        if (index === -1) return null;

        return headerViewport.querySelector('.ag-header-row[aria-rowindex="2"]')?.children[index]?.querySelector('input.ag-floating-filter-input');
    }

    async function createBarcodePopup() {
        let popupContainer = document.getElementById('barcode-popup-container');
        if (popupContainer) return popupContainer;

        const savedPos = await GM_getValue(BARCODE_POPUP_POSITION_KEY, null);
        const position = savedPos ? JSON.parse(savedPos) : null;

        popupContainer = document.createElement('div'); popupContainer.id = 'barcode-popup-container';
        const popupBox = document.createElement('div'); popupBox.className = 'barcode-popup-box';

        if (position && position.top && position.left) { popupBox.style.top = position.top; popupBox.style.left = position.left; }
        else { popupBox.style.top = '50%'; popupBox.style.left = '50%'; popupBox.style.transform = 'translate(-50%, -50%)'; }

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

        popupBox.appendChild(popupHeader); popupBox.appendChild(inputWrapper); popupBox.appendChild(buttonContainer); popupContainer.appendChild(popupBox);
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
            if (e.key !== 'Enter') return; e.preventDefault();
            const val = popupInput.value.trim(); if (!val) return;

            clearAllFiltersShallow();
            const currentMode = await GM_getValue(POPUP_MODE_KEY, 'BARCODE');
            let targetInput = currentMode === 'MRN' ? findFilterInputByHeader('Cluster MRN') : findFilterInputByHeader('Barcode');

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

    async function ensureEntryButtonsExist() {
        const container = document.querySelector('.reset-button-container');
        if (!container) return;
        const existingWrapper = document.getElementById('entry-buttons-wrapper');
        if (existingWrapper && container.contains(existingWrapper)) return;
        if (existingWrapper) existingWrapper.remove();

        const popup = await createBarcodePopup();
        const buttonWrapper = document.createElement('div'); buttonWrapper.id = 'entry-buttons-wrapper'; buttonWrapper.className = 'entry-button-wrapper';

        const barcodeButton = document.createElement('button'); barcodeButton.id = 'barcode-entry-btn'; barcodeButton.textContent = 'Barcode Entry';
        Object.assign(barcodeButton.style, { backgroundColor: '#11800b', padding: '6px 12px', fontSize: '13px', fontWeight: 'bold', borderRadius: '6px', color: '#ffffff', border: '1px solid #285e79', cursor: 'pointer' });
        barcodeButton.addEventListener('click', async () => {
            await GM_setValue(POPUP_MODE_KEY, 'BARCODE'); await performFullReset();
            popup.style.display = 'block'; document.getElementById('barcode-popup-input').focus();
        });

        const mrnButton = document.createElement('button'); mrnButton.id = 'mrn-entry-btn'; mrnButton.textContent = 'MRN Entry';
        Object.assign(mrnButton.style, { backgroundColor: '#d19a02', padding: '6px 12px', fontSize: '13px', fontWeight: 'bold', borderRadius: '6px', color: '#ffffff', border: '1px solid #4a2d8a', cursor: 'pointer' });
        mrnButton.addEventListener('click', async () => {
            await GM_setValue(POPUP_MODE_KEY, 'MRN'); await performFullReset();
            popup.style.display = 'block'; document.getElementById('barcode-popup-input').focus();
        });

        buttonWrapper.appendChild(barcodeButton); buttonWrapper.appendChild(mrnButton);
        container.appendChild(buttonWrapper);
    }

    //================================================================================
    // NAVIGATION LINKS AND MENU INJECTIONS
    //================================================================================
    function setupNavigationShortcut() {
        const link = document.querySelector('span.csi-menu-text[title="Lab Orders"]')?.closest('a');
        if (!link || link.dataset.shortcutAttached === 'true') return;
        link.addEventListener('click', () => {
            setTimeout(() => {
                const tab = document.querySelector('a[href="lab-orders/lab-test-analyzer"]');
                if (tab) tab.click();
            }, 100);
        });
        link.dataset.shortcutAttached = 'true';
    }

    async function applyPersistentWorkbenchFilter() {
        const wbSelect = document.getElementById(SELECTORS.workbenchDropdown.substring(1));
        const statusDropdown = document.querySelector(SELECTORS.statusDropdownTrigger)?.closest('select');
        if (!wbSelect || !statusDropdown) return;
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
    }

   function tryInjectSidebarMenu() {
        const INJECT_ID = '__custom-lab-test-status';
        if (document.getElementById(INJECT_ID)) {
            document.getElementById(INJECT_ID).classList.toggle('active', window.location.hash.startsWith('#/lab-orders/lab-test-analyzer'));
            return;
        }
        const listMenu = document.querySelector('csi-list-menu > div');
        if (!listMenu) return;

        const outer = document.createElement('div'), inner = document.createElement('div'), host = document.createElement('csi-main-menu');
        const anchor = document.createElement('a'); anchor.id = INJECT_ID; anchor.href = '#/lab-orders/lab-test-analyzer'; anchor.setAttribute('routerlinkactive', 'active'); anchor.style.cssText = 'cursor:pointer;';

        const iSpan = document.createElement('span'); iSpan.className = 'icon-holder csi-menu-icon';
        const icon = document.createElement('i'); icon.className = 'nova-icon-scan'; iSpan.appendChild(icon);

        const tWrap = document.createElement('div'); tWrap.className = 'csi-menu-text-wrapper';
        const tSpan = document.createElement('span'); tSpan.className = 'csi-menu-text sidemenu-title'; tSpan.title = 'Lab Test Status'; tSpan.textContent = 'Lab Test Status';

        tWrap.appendChild(tSpan); anchor.appendChild(iSpan); anchor.appendChild(tWrap);
        host.appendChild(anchor); inner.appendChild(host); outer.appendChild(inner);

        // Use prepend() instead of appendChild() to force it to the top of the menu
        listMenu.prepend(outer);

        anchor.classList.toggle('active', window.location.hash.startsWith('#/lab-orders/lab-test-analyzer'));
    }

    //================================================================================
    // ARCHITECTURAL MASTER OBSERVER PIPELINE
    //================================================================================
    async function masterObserverCallback() {
        if (state.observerThrottle) clearTimeout(state.observerThrottle);
        state.observerThrottle = setTimeout(async () => {
            if (location.href !== state.lastUrl) {
                state.lastUrl = location.href;
                Object.assign(state, { hasAppliedInitialFilters: false, filterRetryCount: 0, isApplyingFilters: false, selectedWorkbenchId: null, isProcessingReset: false });
            }

            setupNavigationShortcut();
            tryInjectSidebarMenu();
            addLocationToHeader();

            document.querySelectorAll('input[bsdaterangepicker]').forEach(upgradeInput);

            // Execute live rolling checks for all upgraded elements across dates/midnights
            document.querySelectorAll('input[bsdaterangepicker][data-upgraded="true"]').forEach(input => {
                if (typeof input.checkAndRollDate === 'function') input.checkAndRollDate();
            });

            if (!location.href.includes('lab-orders/lab-test-analyzer')) return;

            await enforcePaginationSize();
            relocateResetButton();
            ensureEntryButtonsExist();
            insertFilterButtons();
            addStatusDropdownListener();
            setupGridScrollListener();
            watchGridForChanges();
            manageInfoPanelVisibility();

            if (!state.hasAppliedInitialFilters) {
                await applyPersistentWorkbenchFilter();
                await applyFiltersWithRetry();
                state.hasAppliedInitialFilters = true;
            }
            applyConditionalCellStyles();
        }, 100);
    }

    //================================================================================
    // BACKGROUND UPDATE CHECKER ENGINE
    //================================================================================
    function showUpdateNotification(newVersion) {
        if (document.getElementById('kaauh-update-notification') || sessionStorage.getItem('kaauh_skip_update_notif') === String(newVersion)) return;
        
        const notif = document.createElement('div');
        notif.id = 'kaauh-update-notification';
        notif.innerHTML = `
            <div style="font-weight:bold;margin-bottom:5px;font-size:15px;">🚀 Script Update Available!</div>
            <div style="margin-bottom:8px;">Version <b>${newVersion}</b> was found on the network.</div>
            <div style="font-size:12px;margin-bottom:10px;opacity:0.9;">Please click "Check for updates" in your Tampermonkey/Violentmonkey extension menu to install it.</div>
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
        GM_xmlhttpRequest({
            method: 'GET',
            url: SCRIPT_UPDATE_URL,
            onload: function(response) {
                if (response.status === 200 || response.status === 0) { // file:// returns status 0 usually
                    const match = response.responseText.match(/@version\s+([\d\.]+)/);
                    if (match && match[1]) {
                        const remoteVersion = parseFloat(match[1]);
                        if (remoteVersion > CURRENT_VERSION) {
                            showUpdateNotification(remoteVersion);
                        }
                    }
                }
            },
            onerror: function(err) {
                console.warn('[Update Engine] Network path check failed. Make sure "Allow access to file URLs" is enabled in your extension settings.', err);
            }
        });
    }

    // Initialize checking routines (Delay first check by 5 seconds to let UI load, then loop every 60 seconds)
    setTimeout(checkForUpdates, 5000);
    setInterval(checkForUpdates, 60000);

    const observer = new MutationObserver(masterObserverCallback);
    observer.observe(document.body, { childList: true, subtree: true });
    masterObserverCallback();

    window.addEventListener('hashchange', () => { tryInjectSidebarMenu(); });
    console.log(`KAAUH Lab Script v${CURRENT_VERSION} fully loaded!`);
})();
