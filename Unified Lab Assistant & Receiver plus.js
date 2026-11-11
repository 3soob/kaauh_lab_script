// ==UserScript==
// @name         Unified Lab Assistant & Receiver plus
// @version      30.6
// @description  v30.6: Added timestamps to barcode database. Popup UI now displays last-scan time. Auto-fix engine strictly enforces shift time boundaries.
// @match        https://his.kaauh.org/lab/*
// @author       Hamad AlShegifi
// @namespace    http://tampermonkey.net/
// @license      MIT
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/colresizable@1.6.0/colResizable-1.6.min.js
// @require      https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @downloadURL https://github.com/3soob/kaauh_lab_script/raw/refs/heads/main/Unified%20Lab%20Assistant%20&%20Receiver%20plus
// @updateURL https://github.com/3soob/kaauh_lab_script/raw/refs/heads/main/Unified%20Lab%20Assistant%20&%20Receiver%20plus

(function () {
    'use strict';

    const SHIFT_STATS_KEY = 'labStaffShiftStats';
    const ALL_TIME_STATS_KEY = 'labStaffMonthlyStats';
    const SHIFT_ID_KEY = 'labStaffCurrentShift';
    const PROCESSED_RECORDS_KEY = 'labStaffProcessedRecords';
    const BADGE_VISIBILITY_KEY = 'labStaffBadgeVisible';

    const HIDDEN_CLASS = 'lab-badge-hidden';
    const BADGE_ID = 'staffInlineCountBadge';
    const POPUP_ID = 'staffStatsPopup';
    const RESET_MODAL_ID = 'staffStatsResetModal';

    const SAVE_DEBOUNCE_MS = 1200;
    const POPUP_CLOSE_SECONDS = 5;
    const POST_SAVE_READ_DELAY_MS = 350;
    const PROCESSED_RECORD_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

    let attachedSaveBtn = null;
    let lastDisplayedStaff = null;
    let lastSampleCountSeen = null;
    let lastHotkeyTime = 0;
    let lastSaveCreditTime = 0;

    GM_addStyle(`
        #${BADGE_ID}.${HIDDEN_CLASS} {
            display: none !important;
        }

        #${RESET_MODAL_ID} {
            position: fixed;
            inset: 0;
            z-index: 1000001;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(15, 23, 42, 0.55);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }

        #${RESET_MODAL_ID} .staff-reset-dialog {
            width: min(580px, 100%);
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.30);
            overflow: hidden;
        }

        #${RESET_MODAL_ID} .staff-reset-header {
            padding: 18px 20px;
            background: linear-gradient(135deg, #b91c1c, #ef4444);
            color: #fff;
            font-size: 16px;
            font-weight: 800;
        }

        #${RESET_MODAL_ID} .staff-reset-body {
            padding: 20px;
            color: #334155;
            font-size: 14px;
            line-height: 1.55;
        }

        #${RESET_MODAL_ID} .staff-reset-body p {
            margin: 0 0 12px;
        }

        #${RESET_MODAL_ID} .staff-reset-summary {
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 10px;
            color: #475569;
            font-size: 13px;
        }

        #${RESET_MODAL_ID} .staff-reset-footer {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-end;
            padding: 14px 20px;
            border-top: 1px solid #e2e8f0;
            background: #f8fafc;
        }

        #${RESET_MODAL_ID} button {
            border: 0;
            border-radius: 8px;
            padding: 9px 13px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
        }

        #${RESET_MODAL_ID} .staff-reset-cancel {
            background: #e2e8f0;
            color: #334155;
        }

        #${RESET_MODAL_ID} .staff-reset-sync {
            background: #2563eb;
            color: #fff;
        }

        #${RESET_MODAL_ID} .staff-reset-export {
            background: #0f766e;
            color: #fff;
        }

        #${RESET_MODAL_ID} .staff-reset-confirm {
            background: #dc2626;
            color: #fff;
        }
    `);

    function isBadgeVisible() {
        const localVis = localStorage.getItem(BADGE_VISIBILITY_KEY);

        if (localVis !== null) {
            GM_setValue(BADGE_VISIBILITY_KEY, localVis);
            localStorage.removeItem(BADGE_VISIBILITY_KEY);
        }

        return GM_getValue(BADGE_VISIBILITY_KEY) === 'true';
    }

    function applyBadgeVisibility() {
        const visible = isBadgeVisible();
        document.getElementById(BADGE_ID)?.classList.toggle(HIDDEN_CLASS, !visible);
    }

    function setBadgeVisible(visible) {
        GM_setValue(BADGE_VISIBILITY_KEY, visible ? 'true' : 'false');
        applyBadgeVisibility();
    }

    function toggleBadgeVisibility() {
        setBadgeVisible(!isBadgeVisible());
        console.log('[Staff Counter] Badge visibility:', isBadgeVisible() ? 'visible' : 'hidden');
    }

    function isCtrlShiftF4(event) {
        return event.ctrlKey && event.shiftKey && (event.key === 'F4' || event.code === 'F4' || event.keyCode === 115 || event.which === 115);
    }

    function isCtrlDelete(event) {
        return event.ctrlKey && (event.key === 'Delete' || event.code === 'Delete' || event.keyCode === 46 || event.which === 46);
    }

    function staffCounterHotkeyHandler(event) {
        if (event.repeat) return;
        const now = Date.now();

        if (isCtrlShiftF4(event)) {
            if (now - lastHotkeyTime < 300) return;
            lastHotkeyTime = now;
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleBadgeVisibility();
            return;
        }

        if (isCtrlDelete(event)) {
            if (now - lastHotkeyTime < 300) return;
            lastHotkeyTime = now;
            event.preventDefault();
            event.stopImmediatePropagation();
            openResetModal();
        }
    }

    window.addEventListener('keydown', staffCounterHotkeyHandler, true);

    function loadStats(key) {
        try {
            const localData = localStorage.getItem(key);
            if (localData) {
                GM_setValue(key, localData);
                localStorage.removeItem(key);
            }
            const rawData = GM_getValue(key);
            return rawData ? JSON.parse(rawData) : {};
        } catch {
            return {};
        }
    }

    function saveStats(key, stats) {
        GM_setValue(key, JSON.stringify(stats));
    }

    function loadProcessedRecords() {
        const records = loadStats(PROCESSED_RECORDS_KEY);
        return records && typeof records === 'object' && !Array.isArray(records) ? records : {};
    }

    function saveProcessedRecords(records) {
        saveStats(PROCESSED_RECORDS_KEY, records);
    }

    function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getShiftIdFromTimestamp(timestamp) {
        const date = new Date(timestamp);
        const hour = date.getHours();

        const shift =
            hour >= 7 && hour < 15 ? 'Morning' :
            hour >= 15 && hour < 23 ? 'Evening' :
            'Night';

        const anchorDate = new Date(date);
        if (hour < 7) {
            anchorDate.setDate(anchorDate.getDate() - 1);
        }

        return `${formatLocalDate(anchorDate)}_${shift}`;
    }

    function getCurrentShiftId() {
        return getShiftIdFromTimestamp(Date.now());
    }

    function checkAndResetShift() {
        const currentShift = getCurrentShiftId();
        const localShift = localStorage.getItem(SHIFT_ID_KEY);

        if (localShift) {
            GM_setValue(SHIFT_ID_KEY, localShift);
            localStorage.removeItem(SHIFT_ID_KEY);
        }

        if (GM_getValue(SHIFT_ID_KEY) !== currentShift) {
            saveStats(SHIFT_STATS_KEY, {});
            GM_setValue(SHIFT_ID_KEY, currentShift);
            saveProcessedRecords({});

            lastDisplayedStaff = null;
            lastSampleCountSeen = null;

            console.log('[Staff Counter] New shift started. Shift badge totals reset; persistent totals retained.');
        }
    }

    function parseTests(rawText) {
        return rawText ? rawText.split(',').map(item => item.trim()).filter(Boolean) : [];
    }

    function getSamplesCountFromPage() {
        const element = document.querySelector(
            '#main-counter-tag-inline-counter-smplrecieve .section-count-badge, ' +
            '[translateid*="Sample"] .section-count-badge, ' +
            '.profile-wrapper .section-count-badge'
        );
        if (!element) return null;
        const value = parseInt(element.textContent.trim(), 10);
        return Number.isNaN(value) ? null : value;
    }

    function getStaffNameFromPage() {
        const input = document.querySelector('input[formcontrolname="receiverStaffName"]');
        return input?.value.trim() || document.querySelector('.profile-wrapper .csi-dropdown-btn-text')?.textContent.trim() || '';
    }

    function normalizeBarcode(value) {
        return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
    }

    function buildCreditFingerprint(staffName, barcodes, totalTests) {
        const normalizedBarcodes = [...new Set(barcodes.map(normalizeBarcode).filter(Boolean))].sort();
        if (normalizedBarcodes.length > 0) {
            return `barcodes:${normalizedBarcodes.join('|')}`;
        }
        return `fallback:${String(staffName || '').trim().toLowerCase()}:${totalTests}`;
    }

    function pruneProcessedRecords(records, currentShiftId) {
        const now = Date.now();
        Object.keys(records).forEach(key => {
            const record = records[key];
            if (!record || typeof record !== 'object' || record.shiftId !== currentShiftId || now - Number(record.creditedAt || 0) > PROCESSED_RECORD_MAX_AGE_MS) {
                delete records[key];
            }
        });
        return records;
    }

    // Helper functions for new timestamp barcode objects
    function hasBarcode(barcodeArray, targetId) {
        if (!barcodeArray || !Array.isArray(barcodeArray)) return false;
        return barcodeArray.some(b => {
            const id = typeof b === 'string' ? b : b.id;
            return id === targetId;
        });
    }

    function getLastScan(barcodeArray) {
        if (!barcodeArray || !Array.isArray(barcodeArray)) return null;
        let maxTs = 0;
        barcodeArray.forEach(b => {
            if (b && typeof b === 'object' && b.ts > maxTs) {
                maxTs = b.ts;
            }
        });
        return maxTs > 0 ? maxTs : null;
    }

    function formatTime(ts, includeDate = false) {
        if (!ts) return '--:--';
        const d = new Date(ts);
        if (includeDate) {
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function recalculateSampleCounts() {
        let shiftFixes = 0;
        let allTimeFixes = 0;
        let shiftAdjustments = 0;
        let allTimeAdjustments = 0;
        const currentShiftId = getCurrentShiftId();

        [SHIFT_STATS_KEY, ALL_TIME_STATS_KEY].forEach(key => {
            const stats = loadStats(key);
            let updated = false;

            Object.keys(stats).forEach(staff => {
                const data = stats[staff];

                if (data.barcodes && Array.isArray(data.barcodes)) {
                    let validBarcodes = data.barcodes;

                    // Strict Shift validation using recorded timestamp objects
                    if (key === SHIFT_STATS_KEY) {
                        validBarcodes = data.barcodes.filter(b => {
                            if (typeof b === 'string') return true; // Legacy string preserve
                            if (!b.ts) return true; // Malformed preserve
                            return getShiftIdFromTimestamp(b.ts) === currentShiftId;
                        });

                        if (validBarcodes.length !== data.barcodes.length) {
                            data.barcodes = validBarcodes;
                            updated = true;
                        }
                    }

                    const uniqueCount = new Set(validBarcodes.map(b => typeof b === 'string' ? normalizeBarcode(b) : normalizeBarcode(b.id)).filter(Boolean)).size;
                    const currentSamples = data.samples || 0;

                    if (currentSamples < uniqueCount) {
                        const difference = uniqueCount - currentSamples;

                        if (key === SHIFT_STATS_KEY) {
                            shiftFixes++;
                            shiftAdjustments += difference;
                        } else {
                            allTimeFixes++;
                            allTimeAdjustments += difference;
                        }

                        data.samples = uniqueCount;
                        updated = true;
                    }
                }
            });

            if (updated) {
                saveStats(key, stats);
            }
        });

        return { shiftFixes, allTimeFixes, shiftAdjustments, allTimeAdjustments };
    }

    function addTestsForStaff(staffName, testCount, sampleDelta, extractedBarcodes = []) {
        if (!staffName || testCount <= 0) return false;

        const samples = Math.max(0, Number(sampleDelta) || 0);
        const shiftStats = loadStats(SHIFT_STATS_KEY);
        const allTimeStats = loadStats(ALL_TIME_STATS_KEY);

        shiftStats[staffName] ||= { tests: 0, samples: 0, barcodes: [] };
        allTimeStats[staffName] ||= { tests: 0, samples: 0, barcodes: [] };

        shiftStats[staffName].barcodes ||= [];
        allTimeStats[staffName].barcodes ||= [];

        shiftStats[staffName].tests += testCount;
        shiftStats[staffName].samples += samples;

        allTimeStats[staffName].tests += testCount;
        allTimeStats[staffName].samples += samples;

        const now = Date.now();

        extractedBarcodes
            .map(normalizeBarcode)
            .filter(Boolean)
            .forEach(barcode => {
                if (!hasBarcode(shiftStats[staffName].barcodes, barcode)) {
                    shiftStats[staffName].barcodes.push({ id: barcode, ts: now });
                }

                if (!hasBarcode(allTimeStats[staffName].barcodes, barcode)) {
                    allTimeStats[staffName].barcodes.push({ id: barcode, ts: now });
                }
            });

        saveStats(SHIFT_STATS_KEY, shiftStats);
        saveStats(ALL_TIME_STATS_KEY, allTimeStats);

        updateInlineBadge(true);
        return true;
    }

    function countAndCreditOnSave() {
        checkAndResetShift();

        const now = Date.now();
        if (now - lastSaveCreditTime < SAVE_DEBOUNCE_MS) return;

        const staffName = getStaffNameFromPage();
        const tbody = document.querySelector('tbody[formarrayname="TubeTypeList"]');

        if (!staffName || !tbody) return;

        let totalTests = 0;
        const extractedBarcodes = [];

        tbody.querySelectorAll('tr').forEach(row => {
            const textarea = row.querySelector('textarea[formcontrolname="TestDetails"]');
            const text = (textarea?.value || textarea?.getAttribute('value') || '').trim();
            totalTests += parseTests(text).length;

            const barcodeInput = row.querySelector(
                'input[formcontrolname="Barcode"], ' +
                'input[formcontrolname="TubeBarcode"], ' +
                'input[formcontrolname="BatchBarcode"]'
            );
            const barcode = (barcodeInput?.value || barcodeInput?.getAttribute('value') || '').trim();

            if (barcode) {
                extractedBarcodes.push(barcode);
            }
        });

        if (totalTests <= 0 && extractedBarcodes.length === 0) return;
        if (totalTests <= 0) return;

        const currentShiftId = getCurrentShiftId();
        const fingerprint = buildCreditFingerprint(staffName, extractedBarcodes, totalTests);
        const processedRecords = pruneProcessedRecords(loadProcessedRecords(), currentShiftId);

        if (processedRecords[fingerprint]) {
            console.log('[Staff Counter] Duplicate save ignored:', fingerprint);
            const updateCount = getSamplesCountFromPage();
            if(updateCount !== null) lastSampleCountSeen = updateCount;
            return;
        }

        const currentSamples = getSamplesCountFromPage();
        let domDelta = 0;

        if (currentSamples !== null) {
            domDelta = lastSampleCountSeen === null ? 0 : Math.max(0, currentSamples - lastSampleCountSeen);
            lastSampleCountSeen = currentSamples;
        }

        const uniqueBarcodes = new Set(extractedBarcodes.map(normalizeBarcode).filter(Boolean));
        let sampleDelta = uniqueBarcodes.size;

        if (sampleDelta === 0) {
            sampleDelta = domDelta > 0 ? domDelta : 1;
        }

        const credited = addTestsForStaff(staffName, totalTests, sampleDelta, extractedBarcodes);
        if (!credited) return;

        processedRecords[fingerprint] = {
            shiftId: currentShiftId,
            staffName,
            testCount: totalTests,
            sampleCount: sampleDelta,
            barcodes: [...new Set(extractedBarcodes.map(normalizeBarcode).filter(Boolean))],
            creditedAt: now
        };

        saveProcessedRecords(processedRecords);
        lastSaveCreditTime = now;
        showPopup();
    }

    function configureBadge(badge) {
        badge.id = BADGE_ID;
        badge.style.cssText = `
            display:inline-flex;
            align-items:center;
            gap:8px;
            flex-shrink:0;
            padding:4px 14px;
            background:linear-gradient(135deg,#10b981 0,#059669 100%);
            color:#fff;
            border-radius:20px;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
            font-size:12px;
            white-space:nowrap;
            margin:0 12px;
            box-shadow:0 4px 12px rgba(16,185,129,.3);
            border:1px solid rgba(255,255,255,.2);
            transition:transform .2s ease,box-shadow .2s ease;
            cursor:pointer;
        `;
        badge.classList.toggle(HIDDEN_CLASS, !isBadgeVisible());
        badge.addEventListener('click', showPopup);
        badge.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 6px 16px rgba(16,185,129,.4)';
        });
        badge.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 12px rgba(16,185,129,.3)';
        });
        return badge;
    }

    function updateInlineBadge(force) {
        const staffName = getStaffNameFromPage();
        let badge = document.getElementById(BADGE_ID);

        if (!staffName) {
            badge?.remove();
            return;
        }

        if (!force && badge && staffName === lastDisplayedStaff) {
            applyBadgeVisibility();
            return;
        }

        lastDisplayedStaff = staffName;

        const profileWrapper = document.querySelector('.profile-wrapper');
        const staffInput = document.querySelector('input[formcontrolname="receiverStaffName"]');

        if (!badge && profileWrapper) {
            badge = configureBadge(document.createElement('span'));
            profileWrapper.insertAdjacentElement('afterend', badge);
        } else if (!badge && staffInput) {
            const parent = staffInput.parentElement;
            if (parent && getComputedStyle(parent).display !== 'flex') {
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.gap = '8px';
            }
            badge = configureBadge(document.createElement('span'));
            staffInput.insertAdjacentElement('afterend', badge);
        }

        if (!badge) return;

        const data = loadStats(SHIFT_STATS_KEY)[staffName] || { tests: 0, samples: 0 };

        badge.innerHTML = `
            <span style="display:flex;align-items:baseline;gap:4px;">
                <span style="font-size:14px;font-weight:800;letter-spacing:-.5px;">${Number(data.tests) || 0}</span>
                <span style="font-size:11px;font-weight:500;opacity:.9;text-transform:uppercase;letter-spacing:.5px;">tests</span>
            </span>
            <span style="width:1px;height:12px;background:#fff;opacity:.3;margin:0 2px;"></span>
            <span style="display:flex;align-items:baseline;gap:4px;">
                <span style="font-size:14px;font-weight:800;letter-spacing:-.5px;">${Number(data.samples) || 0}</span>
                <span style="font-size:11px;font-weight:500;opacity:.9;text-transform:uppercase;letter-spacing:.5px;">samples</span>
            </span>
        `;
        badge.title = `${staffName} current shift total: ${Number(data.tests) || 0} tests across ${Number(data.samples) || 0} samples. Click to view persistent statistics.`;
        applyBadgeVisibility();
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function showPopup() {
        if (!isBadgeVisible()) return;
        document.getElementById(POPUP_ID)?.remove();

        const currentStaffName = getStaffNameFromPage();

        const buildRows = (statsKey, emptyMessage) => {
            const entries = Object.entries(loadStats(statsKey)).sort((a, b) => (b[1].tests || 0) - (a[1].tests || 0));
            const isAllTime = statsKey === ALL_TIME_STATS_KEY;

            return entries.length
                ? entries.map(([name, values]) => {
                    const isCurrent = currentStaffName && name.toLowerCase() === currentStaffName.toLowerCase();
                    const lastScanTs = getLastScan(values.barcodes);
                    const lastScanStr = lastScanTs ? `<div style="font-size:9.5px; font-weight:600; color:#888; margin-top:3px; letter-spacing:0.2px;">⌚ ${formatTime(lastScanTs, isAllTime)}</div>` : '';

                    return `
                        <tr style="${isCurrent ? 'background:linear-gradient(90deg,rgba(16,185,129,.15),rgba(5,150,105,.05));border-left:3px solid #10b981;' : ''}">
                            <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-weight:${isCurrent ? 800 : 500};color:${isCurrent ? '#059669' : '#444'};">
                                ${escapeHtml(name)}
                                ${isCurrent ? '<span style="font-size:9px;background:#10b981;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px;">YOU</span>' : ''}
                                ${lastScanStr}
                            </td>
                            <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#10b981;vertical-align:top;">
                                ${Number(values.tests) || 0}
                            </td>
                            <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#059669;vertical-align:top;">
                                ${Number(values.samples) || 0}
                            </td>
                        </tr>
                    `;
                }).join('')
                : `<tr><td colspan="3" style="padding:12px;color:#999;text-align:center;font-style:italic;">${emptyMessage}</td></tr>`;
        };

        const allTimeRows = buildRows(ALL_TIME_STATS_KEY, 'No persistent statistics yet...');
        const shiftRows = buildRows(SHIFT_STATS_KEY, 'No current-shift statistics yet...');

        const currentShiftId = getCurrentShiftId();
        const currentShiftLabel = currentShiftId.replace('_', ' · ').replace(/^\d{4}-\d{2}-\d{2}/, match => {
            const [year, month, day] = match.split('-');
            return `${day}/${month}/${year}`;
        });

        const popup = document.createElement('div');
        popup.id = POPUP_ID;
        popup.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:999999;
            background:rgba(255,255,255,.98); backdrop-filter:blur(10px);
            border:1px solid rgba(0,0,0,.08); border-radius:16px;
            box-shadow:0 10px 30px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.05);
            padding:16px 20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
            font-size:13px; min-width:280px; max-width:340px;
            animation:staffPopupFadeIn .4s cubic-bezier(.16,1,.3,1);
        `;

        popup.innerHTML = `
            <style>
                @keyframes staffPopupFadeIn { from { opacity:0; transform:translateY(20px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
                @keyframes staffPopupFadeOut { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(.95); } }
                .staff-popup-tab { border:0; background:transparent; color:#94a3b8; cursor:pointer; padding:7px 8px; font-size:11px; font-weight:800; border-radius:8px; transition:all .2s ease; white-space:nowrap; }
                .staff-popup-tab:hover { background:#f1f5f9; color:#475569; }
                .staff-popup-tab.active { color:#fff; background:linear-gradient(135deg,#10b981,#059669); box-shadow:0 3px 8px rgba(16,185,129,.25); }
                .staff-popup-panel { display:none; }
                .staff-popup-panel.active { display:block; }
            </style>
            <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-weight:800;font-size:14px;color:#111;letter-spacing:-.5px;">Staff Statistics</span>
                <div style="display:flex;gap:4px;background:#f1f5f9;padding:3px;border-radius:10px;">
                    <button type="button" class="staff-popup-tab" data-staff-tab="alltime">ALL TIME</button>
                    <button type="button" class="staff-popup-tab active" data-staff-tab="shift">CURRENT SHIFT</button>
                </div>
            </div>
            <div id="staffPopupAllTimePanel" class="staff-popup-panel">
                <div style="font-size:10px;color:#10b981;font-weight:700;margin:-3px 0 8px;">Persistent Staff Stats</div>
                <div style="max-height:250px;overflow-y:auto;padding-right:4px;margin-bottom:4px;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead style="position:sticky;top:0;background:rgba(255,255,255,.98);z-index:2;">
                            <tr>
                                <th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Staff</th>
                                <th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Tests</th>
                                <th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Samples</th>
                            </tr>
                        </thead>
                        <tbody>${allTimeRows}</tbody>
                    </table>
                </div>
            </div>
            <div id="staffPopupShiftPanel" class="staff-popup-panel active">
                <div style="font-size:10px;color:#2563eb;font-weight:700;margin:-3px 0 8px;">Current Shift: ${escapeHtml(currentShiftLabel)}</div>
                <div style="max-height:250px;overflow-y:auto;padding-right:4px;margin-bottom:4px;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead style="position:sticky;top:0;background:rgba(255,255,255,.98);z-index:2;">
                            <tr>
                                <th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Staff</th>
                                <th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Tests</th>
                                <th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Samples</th>
                            </tr>
                        </thead>
                        <tbody>${shiftRows}</tbody>
                    </table>
                </div>
            </div>
            <div id="staffPopupTimer" style="margin-top:12px;font-size:11px;font-weight:500;color:#aaa;text-align:right;">Closing in ${POPUP_CLOSE_SECONDS}s...</div>
        `;

        document.body.appendChild(popup);

        const tabs = popup.querySelectorAll('.staff-popup-tab');
        const allTimePanel = popup.querySelector('#staffPopupAllTimePanel');
        const shiftPanel = popup.querySelector('#staffPopupShiftPanel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const isAllTime = tab.dataset.staffTab === 'alltime';
                tabs.forEach(button => { button.classList.toggle('active', button.dataset.staffTab === tab.dataset.staffTab); });
                allTimePanel.classList.toggle('active', isAllTime);
                shiftPanel.classList.toggle('active', !isAllTime);
            });
        });

        let seconds = POPUP_CLOSE_SECONDS;
        let countdownInterval = null;
        let isPopupHovered = false;
        let isClosing = false;

        function updatePopupTimer() {
            const timer = popup.querySelector('#staffPopupTimer');
            if (!timer) return;
            timer.textContent = isPopupHovered ? `Paused — closing in ${seconds}s...` : `Closing in ${seconds}s...`;
        }

        function closePopup() {
            if (isClosing || isPopupHovered || !popup.isConnected) return;
            isClosing = true;
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            popup.style.animation = 'staffPopupFadeOut .3s ease-in';
            setTimeout(() => { popup.remove(); }, 300);
        }

        function startPopupCountdown() {
            if (isClosing || isPopupHovered || countdownInterval) return;
            updatePopupTimer();
            countdownInterval = setInterval(() => {
                if (isPopupHovered || isClosing) return;
                seconds -= 1;
                updatePopupTimer();
                if (seconds <= 0) { clearInterval(countdownInterval); countdownInterval = null; closePopup(); }
            }, 1000);
        }

        function pausePopupCountdown() {
            isPopupHovered = true;
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            updatePopupTimer();
        }

        function resumePopupCountdown() {
            isPopupHovered = false;
            if (seconds <= 0) { closePopup(); return; }
            startPopupCountdown();
        }

        popup.addEventListener('mouseenter', pausePopupCountdown);
        popup.addEventListener('mouseleave', resumePopupCountdown);
        startPopupCountdown();
    }

    function downloadStats() {
        const exportData = {
            exportedAt: new Date().toISOString(),
            application: 'Unified Lab Assistant – Staff Counter',
            scope: 'Persistent staff statistics',
            statistics: loadStats(ALL_TIME_STATS_KEY)
        };
        const content = JSON.stringify(exportData, null, 2);
        const name = `lab-staff-stats-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function openResetModal() {
        document.getElementById(RESET_MODAL_ID)?.remove();

        const stats = loadStats(ALL_TIME_STATS_KEY);
        const staffCount = Object.keys(stats).length;

        const totals = Object.values(stats).reduce((result, item) => {
            result.tests += Number(item.tests) || 0;
            result.samples += Number(item.samples) || 0;
            return result;
        }, { tests: 0, samples: 0 });

        const modal = document.createElement('div');
        modal.id = RESET_MODAL_ID;
        modal.innerHTML = `
            <div class="staff-reset-dialog" role="dialog" aria-modal="true">
                <div class="staff-reset-header">Manage Persistent Staff Statistics</div>
                <div class="staff-reset-body">
                    <p>Statistics are retained until you delete them manually. Save a backup to your PC before deletion if needed.</p>
                    <div class="staff-reset-summary">
                        <strong>${staffCount}</strong> staff member(s) · <strong>${totals.tests}</strong> tests · <strong>${totals.samples}</strong> samples
                    </div>
                </div>
                <div class="staff-reset-footer">
                    <button type="button" class="staff-reset-cancel">Cancel</button>
                    <button type="button" class="staff-reset-sync" title="Fix visual sample counts using saved barcode history">Auto-Fix Sample Counts</button>
                    <button type="button" class="staff-reset-export">Save Stats to PC</button>
                    <button type="button" class="staff-reset-confirm">Delete All Stats</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.staff-reset-cancel').addEventListener('click', () => modal.remove());

        modal.querySelector('.staff-reset-sync').addEventListener('click', () => {
            const results = recalculateSampleCounts();
            alert(`Analysis complete!\n\nCURRENT SHIFT:\n- Fixed records for ${results.shiftFixes} staff.\n- Restored ${results.shiftAdjustments} missing samples.\n\nALL TIME (PERSISTENT):\n- Fixed records for ${results.allTimeFixes} staff.\n- Restored ${results.allTimeAdjustments} missing samples.`);
            updateInlineBadge(true);
            modal.remove();
            if (document.getElementById(POPUP_ID)) showPopup();
        });

        modal.querySelector('.staff-reset-export').addEventListener('click', downloadStats);

        modal.querySelector('.staff-reset-confirm').addEventListener('click', () => {
            if (!window.confirm('Delete all persistent staff statistics? This cannot be undone.')) return;
            saveStats(ALL_TIME_STATS_KEY, {});
            saveStats(SHIFT_STATS_KEY, {});
            saveProcessedRecords({});
            GM_deleteValue(SHIFT_ID_KEY);
            localStorage.removeItem(SHIFT_ID_KEY);
            lastDisplayedStaff = null;
            lastSampleCountSeen = getSamplesCountFromPage();
            lastSaveCreditTime = 0;
            updateInlineBadge(true);
            document.getElementById(POPUP_ID)?.remove();
            modal.remove();
        });

        modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    }

    function attachSaveListener() {
        const saveButton = document.getElementById('savebtn-smplrecieve');
        if (!saveButton || saveButton === attachedSaveBtn) return;
        attachedSaveBtn = saveButton;
        saveButton.addEventListener('click', () => setTimeout(countAndCreditOnSave, POST_SAVE_READ_DELAY_MS), true);
        console.log('[Staff Counter] Save button listener attached.');
    }

    function init() {
        checkAndResetShift();
        recalculateSampleCounts();
        lastSampleCountSeen = getSamplesCountFromPage();

        const observer = new MutationObserver(() => {
            attachSaveListener();
            updateInlineBadge(false);
            applyBadgeVisibility();
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        setInterval(attachSaveListener, 1000);
        setInterval(() => updateInlineBadge(false), 700);
        setInterval(checkAndResetShift, 60000);
        setInterval(applyBadgeVisibility, 700);

        attachSaveListener();
        updateInlineBadge(true);
        applyBadgeVisibility();

        console.log('[Staff Counter] Ready. Ctrl+Shift+F4 toggles badge. Ctrl+Delete manages stats.');
    }

    setTimeout(init, 500);
})();

(function() {
    'use strict';

    // Global namespace orchestration
    window.enhancedGrid = window.enhancedGrid || {};
    window.enhancedGrid.summaryPopulated = false;

    // ==========================================
    // GLOBAL CSS STYLE INJECTIONS
    // ==========================================
    GM_addStyle(`
        /* --- RESTORED LOCAL FONT AWESOME HANDSHAKE --- */
        @font-face {
            font-family: 'FontAwesome';
            font-style: normal;
            font-weight: 900;
            font-display: block;
            src: url(https://his.kaauh.org/lab/fontawesome-webfont.af7ae505a9eed503f8b8.woff2?v=4.7.0) format('woff2');
        }
        .fa, .fas {
            font-family: 'FontAwesome' !important;
            font-weight: 900;
            -moz-osx-font-smoothing: grayscale;
            -webkit-font-smoothing: antialiased;
            display: inline-block;
            font-style: normal;
            font-variant: normal;
            text-rendering: auto;
            line-height: 1;
        }
        .fa-check-circle:before { content: "\\f058"; }
        .fa-star:before { content: "\\f005"; }
        .fa-arrow-circle-up:before { content: "\\f0aa"; }
        .fa-arrow-circle-down:before { content: "\\f0ab"; }
        .fa-arrow-circle-right:before { content: "\\f0a9"; }

        /* Bootstrap Tab Layout Corrections */
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] {
            width: 100% !important;
            display: flex !important;
            flex-wrap: nowrap !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] > li {
            flex: 1 1 0 !important;
            display: flex !important;
            float: none !important;
            margin-bottom: -1px;
        }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] > li > a {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
            text-align: center !important;
            white-space: nowrap !important;
            margin: 0 !important;
        }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] > li > a > span {
            display: inline-block !important;
            text-align: center !important;
        }

        /* Rapid Receiver Modal Overrides */
        .rr-modal-backdrop { display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); }
        .rr-modal-content { display: flex; flex-direction: column; background-color: #f8f9fa; margin: 5% auto; padding: 25px; border: none; width: 90%; max-width: 950px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); height: 80vh; }
        .rr-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-bottom: 15px; margin-bottom: 15px; }
        .rr-modal-header h2 { margin: 0; font-size: 1.5rem; color: #343a40; }
        .rr-modal-body { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
        .rr-modal-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 15px; }
        .rr-close-button { color: #aaa; font-size: 32px; font-weight: bold; cursor: pointer; line-height: 1; width: 32px; text-align: center; }
        .rr-close-button:hover { color: black; }
        #newBarcodeEntry { width: 100%; padding: 10px; font-size: 16px; margin-bottom: 15px; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; }
        #newBarcodeEntry:focus { border-color: #80bdff; outline: 0; box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25); }
        #rr-table-container { flex-grow: 1; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; background-color: #fff; }
        #barcodeTable { width: 100%; border-collapse: collapse; table-layout: fixed; }
        #barcodeTable th, #barcodeTable td { padding: 4px 15px; text-align: left; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
        #barcodeTable th { background-color: #e9ecef; color: #495057; position: sticky; top: 0; z-index: 10; }
        #barcodeTable th:not(:last-child), #barcodeTable td:not(:last-child) { border-right: 1px solid #dee2e6 !important; }
        #barcodeTable tbody tr:nth-child(even) { background-color: #f8f9fa; }
        .rr-th-no { width: 7%; }
        .rr-th-barcode { width: 33%; }
        .rr-th-location { width: 15%; }
        .rr-th-status { width: 45%; }
        .td.status-cell { font-weight: bold; text-align: left; }
        .td.status-cell.success { text-align: center; color: green; font-size: 1.2rem; }
        .rr-counter-style { font-size: 14px; font-weight: bold; color: #555; }
        .rr-error-text { color: #D8000C; font-weight: bold; font-size: 13px; }
        .JCLRgrip { background-color: #007bff !important; width: 3px !important; z-index: 99999 !important; }

        /* Modern UI Switch Components - Continuous Stream Engine UI */
        .stream-toggle { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1px solid #ccc; border-radius: 20px; background-color: #f8f9fa; cursor: pointer; transition: all 0.3s ease; user-select: none; margin-right: 8px; }
        .stream-toggle.is-active { border-color: #ffa726; background-color: #fff3e0; animation: stream-glow 2s infinite; }
        .stream-toggle .toggle-label { font-size: 11px; font-weight: 700; color: #444; display: flex; align-items: center; gap: 4px; }
        .stream-toggle .toggle-switch { position: relative; width: 36px; height: 18px; background-color: #ccc; border-radius: 9px; transition: background-color 0.3s ease; }
        .stream-toggle.is-active .toggle-switch { background-color: #f57c00; }
        .stream-toggle .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background-color: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.3s ease; }
        .stream-toggle.is-active .toggle-thumb { transform: translateX(18px); }
        @keyframes stream-glow { 0% { box-shadow: 0 0 0 0px rgba(245, 124, 0, 0.3); } 70% { box-shadow: 0 0 0 8px rgba(245, 124, 0, 0); } 100% { box-shadow: 0 0 0 0px rgba(245, 124, 0, 0); } }

        /* Industrial Button Upgrades */
        #rapidReceiveBtn {
            background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%) !important;
            color: #ffffff !important;
            font-weight: bold !important;
            font-size: 13px !important;
            border-radius: 6px !important;
            border: 1px solid rgb(40, 94, 121) !important;
            padding: 6px 12px !important;
            box-shadow: 0 4px 10px rgba(0, 114, 255, 0.4) !important;
            transition: all 0.2s ease-in-out !important;
            cursor: pointer !important;
            height: auto !important;
            display: inline-block !important;
        }
        #rapidReceiveBtn:hover {
            transform: translateY(-1px) !important;
            box-shadow: 0 6px 14px rgba(0, 114, 255, 0.6) !important;
            filter: brightness(1.1) !important;
        }
        #rapidReceiveBtn:active {
            transform: translateY(1px) !important;
            box-shadow: 0 2px 5px rgba(0, 114, 255, 0.4) !important;
        }
        #processBarcodesBtn {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%) !important;
            color: #ffffff !important;
            font-weight: 800 !important;
            font-size: 14px !important;
            text-transform: uppercase !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 8px 20px !important;
            box-shadow: 0 4px 12px rgba(56, 239, 125, 0.4) !important;
            transition: all 0.2s ease !important;
        }
        #processBarcodesBtn:hover:not(:disabled) {
            transform: translateY(-1px) !important;
            box-shadow: 0 6px 16px rgba(56, 239, 125, 0.6) !important;
            filter: brightness(1.05) !important;
        }
        @keyframes critical-stop-pulse {
            0% { box-shadow: 0 0 0 0px rgba(255, 75, 43, 0.7); }
            70% { box-shadow: 0 0 0 12px rgba(255, 75, 43, 0); }
            100% { box-shadow: 0 0 0 0px rgba(255, 75, 43, 0); }
        }
        #stopProcessBtn {
            background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%) !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            font-size: 14px !important;
            text-transform: uppercase !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 8px 22px !important;
            animation: critical-stop-pulse 1.5s infinite !important;
            transition: all 0.15s ease !important;
        }
        #stopProcessBtn:hover {
            filter: brightness(1.1) !important;
            transform: scale(1.02) !important;
        }
        #clearBarcodesBtn {
            background: linear-gradient(135deg, #e65c00 0%, #f9d423 100%) !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            font-size: 13px !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 8px 16px !important;
            box-shadow: 0 4px 10px rgba(230, 92, 0, 0.3) !important;
            transition: all 0.2s ease !important;
        }
        #clearBarcodesBtn:hover:not(:disabled) {
            box-shadow: 0 6px 14px rgba(230, 92, 0, 0.4) !important;
            filter: brightness(1.05) !important;
        }
        #resetStatusBtn {
            background: linear-gradient(135deg, #4b6cb7 0%, #182848 100%) !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            font-size: 13px !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 8px 16px !important;
            box-shadow: 0 4px 10px rgba(75, 108, 183, 0.3) !important;
            transition: all 0.2s ease !important;
        }
        #resetStatusBtn:hover:not(:disabled) {
            box-shadow: 0 6px 14px rgba(75, 108, 183, 0.4) !important;
            filter: brightness(1.1) !important;
        }

        /* Summary Panel System Styling */
        #test-summary-container {
            width: 44%; float: left; margin: 10px 5px 5px 0; background-color: #fff;
            border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.12);
            display: flex; flex-direction: column; overflow: hidden;
        }
        .modern-summary-header { background-color: #34495e; color: white; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.3s ease, color 0.3s ease; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .modern-summary-header h2 { font-size: 14px; font-weight: 700; margin: 0; line-height: 1.2; }
        .header-meta { font-size: 11px; font-weight: 500; opacity: 0.9; margin-top: 2px; }
        .controls-bar { padding: 8px 10px; background: white; border-bottom: 1px solid #e0e0e0; display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
        .search-box { flex: 1; min-width: 150px; position: relative; }
        .search-box input { width: 100%; padding: 4px 8px 4px 28px; border: 2px solid #ddd; border-radius: 6px; font-size: 12px; transition: all 0.2s; }
        .search-box input:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); }
        .search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #6c757d; }
        .filter-buttons { display: flex; gap: 4px; flex-wrap: wrap; }
        .filter-btn { padding: 3px 6px; border: 2px solid #ddd; background: white; border-radius: 6px; font-size: 10px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px; }
        .filter-btn:hover { background: #f8f9fa; }
        .filter-btn.active { background: #3498db; color: white; border-color: #3498db; }
        .filter-btn .count { background: rgba(0,0,0,0.1); padding: 1px 4px; border-radius: 10px; font-size: 9px; font-weight: 600; }
        .filter-btn.active .count { background: rgba(255,255,255,0.2); }
        .filter-btn.pulse-red { background-color: #e74c3c; color: white; border-color: #e74c3c; animation: pulse-red 2s infinite; }

        @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0px rgba(231, 76, 60, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
            100% { box-shadow: 0 0 0 0px rgba(231, 76, 60, 0); }
        }
        .table-container { flex-grow: 1; }
        .tests-table { width: 100%; border-collapse: collapse; }
        .tests-table thead { background: #f8f9fa; position: sticky; top: 0; z-index: 10; }
        .tests-table th { padding: 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #2c3e50; border-bottom: 2px solid #ddd; white-space: nowrap; }
        .tests-table th.center { text-align: center; }
        .tests-table th.right { text-align: right; }
        .tests-table tbody tr { border-bottom: 1px solid #e9ecef; }
        .tests-table tbody tr:not(.critical-row-high):not(.critical-row-low):hover { background-color: #f8f9fa; }
        .tests-table td { padding: 2px 6px; font-size: 15px; vertical-align: middle; }
        .test-name { font-weight: 800; color: #000000; white-space: nowrap; }
        .tests-table tbody tr.flagged-H { background: #ffe0e0; }
        .tests-table tbody tr.flagged-L { background: #e0f2f7; }
        .result-value { font-weight: 800; text-align: right; }
        .flag-indicator { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; font-size: 12px; font-weight: 700; color: white; }
        .flag-indicator.H { background: #e74c3c; }
        .flag-indicator.L { background: #3498db; }

        @keyframes pulse-dark-red { 0% { background-color: #c0392b; } 50% { background-color: #e74c3c; } 100% { background-color: #c0392b; } }
        @keyframes pulse-dark-blue { 0% { background-color: #2980b9; } 50% { background-color: #3498db; } 100% { background-color: #2980b9; } }
        .tests-table tbody tr.critical-row-high { animation: pulse-dark-red 2s infinite !important; font-weight: bold; color: #ffffff !important; }
        .tests-table tbody tr.critical-row-low { animation: pulse-dark-blue 2s infinite !important; font-weight: bold; color: #ffffff !important; }
        .tests-table tbody tr.critical-row-high *, .tests-table tbody tr.critical-row-low * { color: inherit !important; font-weight: bold; }
        .uom, .ref-range { color: #6c757d; font-size: 11px; width: 1%; white-space: nowrap; }
        .ref-range { text-align: center; }
        .status-badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 2px 5px; border-radius: 12px; font-size: 10px; font-weight: 600; min-width: 75px; text-align: center; }
        .status-badge.resulted { background: #fff3cd; color: #856404; }
        .status-badge.ordered { background: #d1ecf1; color: #0c5460; }
        .status-badge.verified1 { background: #d4edda; color: #155724; }
        .status-badge.verified2 { background: #c3e6cb; color: #0d4d1a; }
        .status-icon { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .status-icon.resulted { background: #f39c12; }
        .status-icon.ordered { background: #17a2b8; }
        .status-icon.verified1 { background: #90EE90; }
        .status-icon.verified2 { background: #27ae60; }
        .empty-state { padding: 50px 20px; text-align: center; color: #6c757d; }
        .summary-footer { padding: 8px 10px; background: #f8f9fa; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6c757d; }

        .patient-type-badge { position: absolute; top: 0; left: 0; background-color: #007bff; color: white; padding: 2px 8px; font-size: 11px; font-weight: bold; border-bottom-right-radius: 8px; z-index: 5; text-transform: uppercase; }
        .patient-type-badge.in-patient { background-color: #d32f2f; }
        .patient-type-badge.out-patient { background-color: #388e3c; }
        .patient-img { position: relative !important; overflow: hidden; }

        /* General Layout Controls */
        .results .ag-theme-balham, .accd-details, .accd-details-table-static, .card-header { width: 50vw !important; margin-left: auto !important; margin-right: 0 !important; box-sizing: border-box; }
        .accd-details table, .accd-details-table-static table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
        .ag-row { transition: background-color 0.3s ease; }
        .ag-row.clicked-row-green .ag-cell { background-color: #20c929 !important; }
        #mrn-display { font-size: 20px; font-weight: bold; color: #fff; background-color: #000; padding: 4px 8px; border-radius: 4px; margin-left: 10px; }

        /* High-Visibility Custom Layout Toggle Controls */
        #custom-detail-toggle-btn {
            font-weight: bold !important;
            border-radius: 4px !important;
            padding: 4px 14px !important;
            font-size: 12px !important;
            height: auto !important;
            vertical-align: middle !important;
            border: none !important;
            cursor: pointer !important;
            display: inline-block !important;
            margin-right: 8px !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.15) !important;
            transition: all 0.2s ease-in-out !important;
            text-transform: uppercase !important;
            letter-spacing: 0.3px !important;
        }
        #custom-detail-toggle-btn:hover {
            transform: translateY(-1px) !important;
            filter: brightness(1.1) !important;
        }
    `);
})();

(function() {
    'use strict';

    window.enhancedGrid = window.enhancedGrid || {};
    window.enhancedGrid.summaryPopulated = false;

    // ==========================================
    // UTILITY WAITER FOR ELEMENT LOADS
    // ==========================================
    function waitForKeyElements(selector, callback, bWaitOnce) {
        var targetNodes, bDone = false;
        targetNodes = $(selector);
        if (targetNodes && targetNodes.length > 0) {
            targetNodes.each(function() { callback($(this)); });
            bDone = bWaitOnce;
        }
        var obs = new MutationObserver(function(mutations) {
            if (bDone) { obs.disconnect(); return; }
            mutations.forEach(function(mutation) {
                var newNodes = mutation.addedNodes;
                if (newNodes && newNodes.length > 0) {
                    for (var i = 0, len = newNodes.length; i < len; i++) {
                        var newNode = newNodes[i];
                        if (newNode.nodeType === 1) {
                            var $node = $(newNode);
                            if ($node.is(selector)) {
                                callback($node);
                                if (bWaitOnce) bDone = true;
                            } else if ($node.find(selector).length > 0) {
                                $node.find(selector).each(function() { callback($(this)); });
                                if (bWaitOnce) bDone = true;
                            }
                        }
                    }
                }
            });
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // ==========================================
    // COMPREHENSIVE ANGULAR NUMERIC RESTRICTION REMOVER & GRID UNLOCKER
    // ==========================================

    function syncWithAngular(input, value) {
        let finalValue = value;

        // Check if the input is a pure decimal number (e.g., 0.2, .5, 1.0)
        // Append an invisible Zero-Width Space to force the system to treat it as a String
        if (/^\d*\.\d+$/.test(value)) {
            finalValue = value + '\u200B';
        }

        // 1. Trigger prototype setter to force Angular's ControlValueAccessor to notice
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) {
            valueSetter.call(input, finalValue);
        } else {
            input.value = finalValue;
        }

        // 2. Dispatch events that Angular listens to
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

        // 3. Attempt direct access to Angular Form Context
        try {
            const ngControl = input.__ngContext__ || window.ng?.getComponent(input);
            if (ngControl && ngControl.formControl) {
                ngControl.formControl.setValue(finalValue);
                ngControl.formControl.setErrors(null);
                ngControl.formControl.markAsDirty();
                ngControl.formControl.markAsTouched();
                ngControl.formControl.updateValueAndValidity();
            }
        } catch (err) {
            // Silently continue if private Angular context is masked
        }
    }

    function removeNumericRestriction(input) {
        if (!input || input.dataset.restrictionRemoved) return;
        input.dataset.restrictionRemoved = 'true';

        // Neutralize standard HTML5 constraints
        if (input.type === 'number') input.type = 'text';
        input.removeAttribute('pattern');
        input.removeAttribute('maxlength');
        input.removeAttribute('min');
        input.removeAttribute('max');
        input.removeAttribute('step');

        // Bypass restrictive Angular directives on key input
        input.addEventListener('keydown', function(e) {
            e.stopImmediatePropagation();
        }, true);

        input.addEventListener('keypress', function(e) {
            e.stopImmediatePropagation();
        }, true);

        input.addEventListener('paste', function(e) {
            e.stopImmediatePropagation();
        }, true);

        // Whenever input changes, keep Angular synced
        input.addEventListener('input', function() {
            syncWithAngular(input, input.value);
        }, false);
    }

    function processAllInputs() {
        const selectors = [
            'app-result-value-render input',
            'input.lo-res-edit',
            'div[role="gridcell"] input',
            'div[col-id="TestResult"] input',
            // AG Grid native editor inputs:
            'input.ag-cell-edit-input',
            '.ag-cell-inline-editing input'
        ];
        document.querySelectorAll(selectors.join(', ')).forEach(removeNumericRestriction);
    }

    processAllInputs();

    const inputObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches('input')) removeNumericRestriction(node);
                    if (node.querySelectorAll) {
                        node.querySelectorAll('input.lo-res-edit, app-result-value-render input, div[role="gridcell"] input, input.ag-cell-edit-input, .ag-cell-inline-editing input').forEach(removeNumericRestriction);
                    }
                }
            });
        });
    });
    inputObserver.observe(document.body, { childList: true, subtree: true });

    // Dynamic Save Button Unlocker
    function enableModalSaveButton() {
        const saveBtn = document.querySelector('button[translateid="result-confirmation.Save"]');
        if (saveBtn && saveBtn.hasAttribute('disabled')) {
            saveBtn.removeAttribute('disabled');
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
        }
    }
    const modalObserver = new MutationObserver(() => {
        enableModalSaveButton();
    });
    modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

    // AG Grid Framework Unlocker
    function unlockAgGridCells() {
        const gridElements = document.querySelectorAll('ag-grid-angular, .ag-root-wrapper');

        gridElements.forEach(grid => {
            const api = grid.__agGridComp?.api || grid.agGrid?.api || grid.__ngContext__?.[8]?.api;
            const columnApi = grid.__agGridComp?.columnApi || grid.agGrid?.columnApi || grid.__ngContext__?.[8]?.columnApi;

            if (api && columnApi) {
                const targetCols = ['TestResult', 'testresult', 'result'];

                targetCols.forEach(colId => {
                    const col = columnApi.getColumn(colId);
                    if (col) {
                        const colDef = col.getColDef();

                        if (colDef.editable !== true || colDef.cellEditor !== 'agTextCellEditor') {
                            colDef.editable = true;
                            colDef.cellEditor = 'agTextCellEditor';
                            colDef.valueParser = params => params.newValue;
                        }
                    }
                });
            }
        });
    }
    setInterval(unlockAgGridCells, 1500);

    // ==========================================
    // RAPID BARCODE RECEIVER MODULE
    // ==========================================
    const existingBarcodes = new Set();
    let stopProcessingFlag = false;
    let isStreamModeEnabled = localStorage.getItem('labStreamModeEnabled') === 'true';

    function initializeScript() {
        const closeButtonSelector = "#closebtn-smplrecieve, #btnclose-smplcollection";
        console.log("Rapid Receiver: Initializing Target Close Screen Adjustments...");

        setupMenuNavigationObserver();

        waitForKeyElements(closeButtonSelector, (closeButton) => {
            if (closeButton.parent().find('#rapidReceiveBtn').length > 0) return;

            let rapidReceiveBtn = $('<button type="button" class="btn btn-color-1" id="rapidReceiveBtn">Rapid Receiver</button>');
            rapidReceiveBtn.css('margin-right', '5px');
            closeButton.before(rapidReceiveBtn);

            if ($('#rapidReceiveModal').length === 0) {
                injectModal();
                attachRapidReceiverEventListeners();
            }

            closeButton.parent().off('click', '#rapidReceiveBtn').on('click', '#rapidReceiveBtn', openRapidReceiver);
        }, false);
    }

    function setupMenuNavigationObserver() {
        const menuSelectors = ".csi-menu-icon, .csi-menu-text, .icon-holder, a[href*='receive'], [title*='Receive']";

        window.requestAnimationFrame(() => {
            $(menuSelectors).each(function() {
                const $this = $(this);
                const combinedText = ($this.text() + " " + ($this.attr('title') || "") + " " + $this.closest('li, a, div').text()).toUpperCase();

                if ((combinedText.includes("SAMPLE RECEIVE") || combinedText.includes("RECEIVE")) && !$this.data('navHookAttached')) {
                    $this.data('navHookAttached', true);
                    $this.css('border-left', '3px solid #00c6ff');

                    $this.closest('a, li, span').off('click.receiverNav').on('click.receiverNav', function() {
                        window.enhancedGrid.summaryPopulated = false;
                        setTimeout(() => { runAllUpdates(); initializeScript(); }, 400);
                    });
                }
            });
        });
    }

    function injectModal() {
        let modalHTML = `
            <div id="rapidReceiveModal" class="rr-modal-backdrop">
                <div class="rr-modal-content">
                    <div class="rr-modal-header">
                        <h2>Rapid Barcode Processor</h2>
                        <span class="rr-close-button">&times;</span>
                    </div>
                    <div class="rr-modal-body">
                        <input type="text" id="newBarcodeEntry" placeholder="Scan or paste barcodes here and press Enter">
                        <div id="rr-table-container">
                            <table id="barcodeTable">
                                <thead>
                                    <tr>
                                        <th class="rr-th-no">No.</th>
                                        <th class="rr-th-barcode">Barcode</th>
                                        <th class="rr-th-location">Location</th>
                                        <th class="rr-th-status">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="barcodeListBody"></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="rr-modal-footer">
                        <span id="rr-counter" class="rr-counter-style">0 Barcodes Entered</span>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <div id="streamModeToggleContainer" class="stream-toggle">
                                <span class="toggle-label">⚡ CONTINUOUS STREAM</span>
                                <div class="toggle-switch"><div class="toggle-thumb"></div></div>
                            </div>
                            <button id="resetStatusBtn" class="btn">Reset Status</button>
                            <button id="clearBarcodesBtn" class="btn">Clear All</button>
                            <button id="stopProcessBtn" class="btn" style="display:none;">STOP</button>
                            <button id="processBarcodesBtn" class="btn">Process</button>
                        </div>
                    </div>
                </div>
            </div>`;
        $('body').append(modalHTML);

        setTimeout(() => {
            if ($.fn.colResizable) {
                $('#barcodeTable').colResizable({
                    liveDrag: true,
                    gripInnerHtml: "<div class='JCLRgrip'></div>",
                    minWidth: 30
                });
            }
        }, 100);
        updateStreamUI();
    }

    function attachRapidReceiverEventListeners() {
        $('body').off('click', '.rr-close-button').on('click', '.rr-close-button', () => $('#rapidReceiveModal').hide());
        $(window).off('click.rr-modal').on('click.rr-modal', (event) => {
            if ($(event.target).is('#rapidReceiveModal')) $('#rapidReceiveModal').hide();
        });

        $('body').off('click', '#processBarcodesBtn').on('click', '#processBarcodesBtn', processBarcodes);
        $('body').off('click', '#clearBarcodesBtn').on('click', '#clearBarcodesBtn', clearAllBarcodes);
        $('body').off('click', '#stopProcessBtn').on('click', '#stopProcessBtn', () => {
            stopProcessingFlag = true;
            $('#stopProcessBtn').prop('disabled', true).text('Stopping...');
        });
        $('body').off('click', '#resetStatusBtn').on('click', '#resetStatusBtn', resetStatuses);

        $('body').off('click', '#streamModeToggleContainer').on('click', '#streamModeToggleContainer', function() {
            isStreamModeEnabled = !isStreamModeEnabled;
            localStorage.setItem('labStreamModeEnabled', isStreamModeEnabled);
            updateStreamUI();
        });

        $('body').off('keydown', '#newBarcodeEntry').on('keydown', '#newBarcodeEntry', handleBarcodeEntry);
        $('body').off('paste', '#newBarcodeEntry').on('paste', '#newBarcodeEntry', handleBarcodePaste);
    }

    function updateStreamUI() {
        $('#streamModeToggleContainer').toggleClass('is-active', isStreamModeEnabled);
    }

    function openRapidReceiver() {
        $('#rapidReceiveModal').show();
        clearAllBarcodes();
        $('#newBarcodeEntry').focus();
        $('#rr-counter').css('color', '');
        $('#processBarcodesBtn, #clearBarcodesBtn, #resetStatusBtn').prop('disabled', false);
        $('#stopProcessBtn').hide();
        $('#processBarcodesBtn').show().text('Process');
        updateStreamUI();
    }

    function clearAllBarcodes() {
        $('#barcodeListBody').find('*').off();
        $('#barcodeListBody').empty();
        $('#newBarcodeEntry').val('').prop('disabled', false).focus();
        existingBarcodes.clear();
        updateBarcodeCount();
    }

    function resetStatuses() {
        const rowCount = $('#barcodeListBody tr').length;
        if(rowCount === 0) return;
        if(confirm(`Reset status for all ${rowCount} barcodes?`)) {
            $('.status-cell').empty().removeClass('success');
            $('#rr-counter').text('Statuses Reset. Ready to Stream.').css('color', 'blue');
        }
    }

    function updateBarcodeCount() {
        const count = $('#barcodeListBody tr').length;
        $('#rr-counter').text(`${count} Barcodes Entered`);
    }

    function addBarcodeToTable(barcode) {
        barcode = barcode.trim();
        if (barcode === '' || existingBarcodes.has(barcode)) return;
        existingBarcodes.add(barcode);

        const rowIndex = $('#barcodeListBody tr').length;
        const rowNum = rowIndex + 1;
        const letter = String.fromCharCode(65 + Math.floor(rowIndex / 10));
        const number = (rowIndex % 10) + 1;
        const location = `${letter}${number}`;

        const newRow = `
            <tr>
                <td>${rowNum}</td>
                <td>${barcode}</td>
                <td>${location}</td>
                <td class="status-cell"></td>
            </tr>`;
        $('#barcodeListBody').append(newRow);
        updateBarcodeCount();
    }

    function handleBarcodeEntry(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const barcodeInput = $(this);
            const barcode = barcodeInput.val().trim();
            if (barcode) addBarcodeToTable(barcode);
            barcodeInput.val('').focus();
        }
    }

    function handleBarcodePaste(event) {
        event.preventDefault();
        const pastedText = (event.originalEvent || event).clipboardData.getData('text/plain');
        pastedText.split(/\r?\n/).filter(line => line.trim() !== '').forEach(addBarcodeToTable);
        $(this).val('').focus();
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const dispatchEvent = (element, eventType) => element.dispatchEvent(new Event(eventType, { bubbles: true }));

    const simulateEnter = async (element) => {
        const props = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        element.dispatchEvent(new KeyboardEvent('keydown', props));
        await sleep(25);
        element.dispatchEvent(new KeyboardEvent('keyup', props));
    };

    // ===================================================================
    // STABILIZED REACTIVE PIPELINE ENGINE (CONTINUOUS STREAM ARCHITECTURE)
    // ===================================================================
    async function processBarcodes() {
        const barcodeInput = $('#barcodecollection');
        const processButton = $('#processBarcodesBtn');
        const clearButton = $('#clearBarcodesBtn');
        const resetStatusBtn = $('#resetStatusBtn');
        const stopButton = $('#stopProcessBtn');
        const entryInput = $('#newBarcodeEntry');
        const counterElement = $('#rr-counter');

        if (barcodeInput.length === 0) {
            alert('Error: Main barcode input field "#barcodecollection" not found.');
            return;
        }

        stopProcessingFlag = false;
        processButton.hide();
        stopButton.show().prop('disabled', false).text('STOP');
        clearButton.prop('disabled', true);
        resetStatusBtn.prop('disabled', true);
        entryInput.prop('disabled', true);

        const inputElement = barcodeInput[0];
        let passIteration = 1;
        const totalPassesCeiling = 2;

        while (passIteration <= totalPassesCeiling) {
            if (stopProcessingFlag) break;

            const rowsToProcess = $('#barcodeListBody tr').filter(function() {
                const currentStatus = $(this).find('td.status-cell').text().trim();
                if (passIteration === 1) {
                    return currentStatus !== '✔️' && !currentStatus.includes('❌');
                } else {
                    return currentStatus !== '✔️';
                }
            }).toArray();

            if (rowsToProcess.length === 0) break;

            if (passIteration > 1) {
                counterElement.text(`🔄 Pass 2: Sequentially Re-validating ${rowsToProcess.length} Unresolved Barcodes...`).css('color', '#e65c00');
                await sleep(800);
            }

            let processedCount = 0;

            if (isStreamModeEnabled && passIteration === 1) {
                const streamPromises = [];

                for (const row of rowsToProcess) {
                    if (stopProcessingFlag) break;
                    processedCount++;
                    counterElement.text(`⚡ Streaming Injections: ${processedCount} / ${rowsToProcess.length}`);

                    const $row = $(row);
                    const barcode = $row.find('td:nth-child(2)').text().trim();
                    const statusCell = $row.find('td.status-cell');
                    statusCell.removeClass('success').html('<span style="color: #ff9800;">⚡ Streaming...</span>');

                    $('.alert-dismissable .close').click();

                    inputElement.value = barcode;
                    dispatchEvent(inputElement, 'input');
                    dispatchEvent(inputElement, 'change');

                    await sleep(65);
                    inputElement.focus();
                    await simulateEnter(inputElement);

                    streamPromises.push((async ($r, bc, sCell) => {
                        sCell.html('<span style="color: #0072ff;">⏳ Processing...</span>');
                        return new Promise((resolveItem) => {
                            const startTime = Date.now();
                            const cutoffTime = startTime + 4500;
                            const minLatencyWindow = startTime + 450;

                            const checkLifecycle = () => {
                                if (stopProcessingFlag) { resolveItem(); return; }

                                const $errorAlert = $("div.alert.alert-danger:visible");
                                if ($errorAlert.length > 0) {
                                    const errorMessage = $errorAlert.find('strong').text().trim() || 'Handshake Rejected';
                                    sCell.html('<span class="rr-error-text">❌ ' + errorMessage + '</span>');
                                    $errorAlert.find('.close').click();
                                    resolveItem();
                                    return;
                                }

                                if (Date.now() >= minLatencyWindow) {
                                    const barcodeSettledInGrid = $(
                                        'tbody[formarrayname="TubeTypeList"] input[formcontrolname="Barcode"], ' +
                                        'input[formcontrolname="Barcode"], ' +
                                        'input[formcontrolname="BatchBarcode"], ' +
                                        'input[formcontrolname="TubeBarcode"], ' +
                                        '#batchbarcode'
                                    ).toArray().some(el => el.value.trim() === bc);

                                    if (barcodeSettledInGrid) {
                                        sCell.addClass('success').html('✔️');
                                        resolveItem();
                                        return;
                                    }
                                }

                                if (Date.now() > cutoffTime) {
                                    sCell.html('<span class="rr-error-text">⚠️ Timeout</span>');
                                    resolveItem();
                                    return;
                                }
                                requestAnimationFrame(checkLifecycle);
                            };
                            requestAnimationFrame(checkLifecycle);
                        });
                    })($row, barcode, statusCell));

                    await sleep(35);
                }

                if (streamPromises.length > 0) {
                    counterElement.text(`⏳ Awaiting Stream Verification Framework Completion...`);
                    await Promise.all(streamPromises);
                }
                await sleep(400);
            }
            else {
                for (const row of rowsToProcess) {
                    if (stopProcessingFlag) {
                        counterElement.text('⚠️ Processing Stopped by User').css('color', 'orange');
                        break;
                    }

                    processedCount++;
                    counterElement.text((passIteration === 1 ? 'Processing: ' : 'Retrying: ') + processedCount + ' / ' + rowsToProcess.length);

                    const $row = $(row);
                    const barcode = $row.find('td:nth-child(2)').text().trim();
                    const statusCell = $row.find('td.status-cell');
                    statusCell.removeClass('success').html('<span style="color: #0072ff;">⏳ Processing...</span>');

                    $('.alert-dismissable .close').click();

                    inputElement.value = barcode;
                    dispatchEvent(inputElement, 'input');
                    dispatchEvent(inputElement, 'change');

                    await sleep(35);
                    inputElement.focus();
                    await simulateEnter(inputElement);

                    await new Promise((resolveItem) => {
                        const startTime = Date.now();
                        const cutoffTime = startTime + 3500;
                        const minLatencyWindow = startTime + 400;

                        const checkLifecycle = () => {
                            if (stopProcessingFlag) { resolveItem(); return; }

                            const $errorAlert = $("div.alert.alert-danger:visible");
                            if ($errorAlert.length > 0) {
                                const errorMessage = $errorAlert.find('strong').text().trim() || 'Handshake Rejected';
                                statusCell.html('<span class="rr-error-text">❌ ' + errorMessage + '</span>');
                                $('.alert-dismissable .close').click();
                                resolveItem();
                                return;
                            }

                            if (Date.now() >= minLatencyWindow) {
                                const barcodeSettledInGrid = $(
                                    'tbody[formarrayname="TubeTypeList"] input[formcontrolname="Barcode"], ' +
                                    'input[formcontrolname="Barcode"], ' +
                                    'input[formcontrolname="BatchBarcode"], ' +
                                    'input[formcontrolname="TubeBarcode"], ' +
                                    '#batchbarcode'
                                ).toArray().some(el => el.value.trim() === barcode);

                                if (barcodeSettledInGrid || inputElement.value === '') {
                                    statusCell.addClass('success').html('✔️');
                                    resolveItem();
                                    return;
                                }
                            }

                            if (Date.now() > cutoffTime) {
                                statusCell.html('<span class="rr-error-text">⚠️ Timeout</span>');
                                resolveItem();
                                return;
                            }
                            requestAnimationFrame(checkLifecycle);
                        };
                        requestAnimationFrame(checkLifecycle);
                    });

                    await sleep(40);
                }
            }

            if (passIteration === 1) processedCount = 0;
            passIteration++;
        }

        stopButton.hide();
        processButton.show().prop('disabled', false).text('Process');
        clearButton.prop('disabled', false);
        resetStatusBtn.prop('disabled', false);
        entryInput.prop('disabled', false).focus();

        if (!stopProcessingFlag) {
            const residualTimeouts = $('#barcodeListBody tr').filter(function() {
                return $(this).find('td.status-cell').text().trim() !== '✔️';
            }).length;

            if (residualTimeouts > 0) {
                counterElement.text(`⚠️ Finish pass: ${residualTimeouts} barcodes remained unresolved.`).css('color', 'red');
            } else {
                counterElement.text('✅ Complete! All Clear.').css('color', 'green');
            }
        }
    }

    initializeScript();

    // ==========================================
    // MODERN SUMMARY HYBRID UI MODULE
    // ==========================================
    const CONFIG = {
        COLUMN_PATTERNS: {
            TEST_DESC: ['testdesc', 'testdescription', 'name'],
            STATUS: ['resultstatus', 'teststatus', 'status', 'state'],
            RESULT_VALUE: ['testresult'],
            UOM: ['uom', 'uomvalue'],
            REFERENCE_RANGE: ['referencerange', 'range'],
            FLAG_CRITICAL: ['ltflag']
        }
    };

    const testSortOrder = [
        'sodium (na)', 'potassium', 'chloride', 'urea (bun)', 'creatinine', 'calcium',
        'phosphate (phos)', 'magnesium (mg)', 'alkaline phosphatase (alpi)',
        'Alanine Amino Transferase (ALTI)', 'Aspartate Amino Transferase(AST)',
        'total protein (tp)', 'albumin (alb)', 'Bilirubin - Total (TBIL)',
        'Bilirubin - Direct (DBIL)', 'cholesterol', 'triglycerides',
        'high density lipoprotein - hdl', 'low density lipoprotein - ldl',
        'creatine kinase (ck)', 'lactate dehydrogenase (ldh)', 'troponin -i (ctn-1)',
        'haemoglobin a1c (hba1c)', 'tsh (thyroid stimulating hormone)-tft', 'uric acid',
        'mid stream urine'
    ];

    function getSortIndex(testName) {
        const lowerTestName = testName.toLowerCase();
        const index = testSortOrder.findIndex(sortedName => lowerTestName.includes(sortedName.toLowerCase()));
        return index === -1 ? Infinity : index;
    }

    const findCellByPatterns = (row, patterns) => {
        for (const cell of row.querySelectorAll('[col-id]')) {
            const colId = cell.getAttribute('col-id')?.toLowerCase();
            if (colId && patterns.includes(colId)) return cell;
        }
        return null;
    }

    function parseRangeAndCompare(rangeStr, value) {
        if (!rangeStr || value === null || isNaN(parseFloat(value))) return null;
        const numVal = parseFloat(value);
        const stdRange = rangeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (stdRange) {
            const lower = parseFloat(stdRange[1]);
            const upper = parseFloat(stdRange[2]);
            if (numVal < lower) return 'L';
            if (numVal > upper) return 'H';
        }
        const ltRange = rangeStr.match(/(?:<|Less than)\s*(\d+\.?\d*)/i);
        if (ltRange && numVal >= parseFloat(ltRange[1])) return 'H';
        const gtRange = rangeStr.match(/(?:>|Greater than)\s*(\d+\.?\d*)/i);
        if (gtRange && numVal <= parseFloat(gtRange[1])) return 'L';
        return null;
    }

    function getAllTests() {
        const leftRows = document.querySelectorAll('.ag-pinned-left-cols-container .ag-row');
        const centerRows = document.querySelectorAll('.ag-center-cols-container .ag-row');
        const rightRows = document.querySelectorAll('.ag-pinned-right-cols-container .ag-row');
        const combinedRows = [];

        for (let i = 0; i < centerRows.length; i++) {
            const combined = document.createElement('div');
            [leftRows[i], centerRows[i], rightRows[i]].forEach(p => {
                if (p) p.querySelectorAll('[col-id]').forEach(c => combined.appendChild(c.cloneNode(true)));
            });
            combinedRows.push(combined);
        }

        const uniqueTests = new Map();
        for (const [index, combined] of combinedRows.entries()) {
            const nameCell = findCellByPatterns(combined, CONFIG.COLUMN_PATTERNS.TEST_DESC);
            const testName = nameCell?.textContent?.trim();
            if (!testName) continue;

            const statusCell = findCellByPatterns(combined, CONFIG.COLUMN_PATTERNS.STATUS);
            const status = statusCell?.textContent?.trim().toLowerCase() || 'unknown';

            let data = { name: testName, status: status, value: null, uom: null, range: null, flag: null, criticalFlag: null, originalIndex: index };

            const valCell = findCellByPatterns(combined, CONFIG.COLUMN_PATTERNS.RESULT_VALUE);
            const rangeCell = findCellByPatterns(combined, CONFIG.COLUMN_PATTERNS.REFERENCE_RANGE);
            const uomCell = findCellByPatterns(combined, CONFIG.COLUMN_PATTERNS.UOM);

            data.value = valCell?.textContent?.trim() || null;
            data.range = rangeCell?.textContent?.trim() || null;
            data.uom = uomCell?.textContent?.trim() || null;
            data.flag = parseRangeAndCompare(data.range, data.value);

            const criticalFlagCell = findCellByPatterns(combined, CONFIG.COLUMN_PATTERNS.FLAG_CRITICAL);
            if (criticalFlagCell) {
                const textSpan = criticalFlagCell.querySelector('span.critial-alret-indication');
                const icon = criticalFlagCell.querySelector('i.fa');
                if (textSpan && icon) {
                    const flagText = textSpan.textContent.trim();
                    if ((flagText === 'CL' || flagText === 'CH') && icon.className.includes('critical')) {
                        data.criticalFlag = { text: flagText, iconClass: icon.className };
                    }
                }
            }
            uniqueTests.set(testName, data);
        }
        return Array.from(uniqueTests.values());
    }

    const FILTER_STORAGE_KEY = 'labSummaryFilter';
    let currentFilter = localStorage.getItem(FILTER_STORAGE_KEY) || 'all';
    let searchTerm = '';
    let allTestsData = [];

    function normalizeStatus(status) {
        const normalized = status.toLowerCase().replace(/\s+/g, '');
        if (normalized.includes('verifiedlevel1') || (normalized.includes('verified') && normalized.includes('1'))) return 'verified1';
        if (normalized.includes('verifiedlevel2') || (normalized.includes('verified') && normalized.includes('2'))) return 'verified2';
        if (normalized === 'resulted') return 'resulted';
        if (normalized === 'ordered') return 'ordered';
        return 'default';
    }

    function getStatusLabel(status) {
        const statusMap = { 'verified1': 'Verified L1', 'verified2': 'Verified L2', 'resulted': 'Resulted', 'ordered': 'Ordered' };
        return statusMap[status] || status;
    }

    function renderModernTable() {
        const tbody = document.getElementById('modernTestsTableBody');
        const emptyState = document.getElementById('modernEmptyState');
        const tableContainer = document.querySelector('.table-container');
        if (!tbody) return;

        let filteredTests = allTestsData.filter(test => {
            if (currentFilter === 'all') {}
            else if (currentFilter === 'flagged') { if (!test.flag && !test.criticalFlag) return false; }
            else { if (normalizeStatus(test.status) !== currentFilter) return false; }
            if (searchTerm && !test.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        tbody.innerHTML = '';
        if (filteredTests.length === 0) {
            emptyState.style.display = 'block';
            if(tableContainer) tableContainer.querySelector('.tests-table').style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            if(tableContainer) tableContainer.querySelector('.tests-table').style.display = 'table';

            filteredTests.forEach(test => {
                const statusClass = normalizeStatus(test.status);
                let criticalClass = '', valueClass = !test.criticalFlag && test.flag ? `flagged-${test.flag}` : '';
                let flagHtml = '--';

                if (test.criticalFlag) {
                    let displayCriticalText = test.criticalFlag.text === 'CH' ? 'CRITICAL HIGH' : 'CRITICAL LOW';
                    criticalClass = test.criticalFlag.text === 'CH' ? 'critical-row-high' : 'critical-row-low';
                    flagHtml = `<span class="critial-alret-indication"><i class="${test.criticalFlag.iconClass}"></i> ${displayCriticalText}</span>`;
                } else if (test.flag) {
                    flagHtml = `<span class="flag-indicator ${test.flag}">${test.flag}</span>`;
                }

                const truncatedName = test.name.length > 30 ? test.name.substring(0, 30) + '...' : test.name;
                const row = document.createElement('tr');
                row.className = (valueClass + ' ' + criticalClass).trim();
                row.innerHTML = `
                    <td class="test-name" title="${test.name}">${truncatedName}</td>
                    <td class="result-value ${valueClass}">${test.value || '--'}</td>
                    <td class="uom">${test.uom || '--'}</td>
                    <td class="ref-range">${test.range || '--'}</td>
                    <td class="center">${flagHtml}</td>
                    <td class="center">
                        <span class="status-badge ${statusClass}">
                            <span class="status-icon ${statusClass}"></span>
                            ${getStatusLabel(statusClass)}
                        </span>
                    </td>`;
                tbody.appendChild(row);
            });
        }
        if (document.getElementById('modernDisplayInfo')) {
            document.getElementById('modernDisplayInfo').textContent = 'Showing ' + filteredTests.length + ' of ' + allTestsData.length + ' tests';
        }
    }

    function updateModernCounts() {
        const counts = { total: allTestsData.length, resulted: 0, verified1: 0, verified2: 0, flagged: 0, ordered: 0 };
        allTestsData.forEach(test => {
            const status = normalizeStatus(test.status);
            if (status === 'resulted') counts.resulted++;
            if (status === 'verified1') counts.verified1++;
            if (status === 'verified2') counts.verified2++;
            if (status === 'ordered') counts.ordered++;
            if (test.flag || test.criticalFlag) counts.flagged++;
        });

        const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        updateEl('modernAllCount', counts.total);
        updateEl('modernOrderedFilterCount', counts.ordered);
        updateEl('modernResultedFilterCount', counts.resulted);
        updateEl('modernVerified1FilterCount', counts.verified1);
        updateEl('modernVerified2FilterCount', counts.verified2);
        updateEl('modernFlaggedFilterCount', counts.flagged);

        const orderedBtn = document.querySelector('.filter-btn[data-filter="ordered"]');
        if (orderedBtn) orderedBtn.classList.toggle('pulse-red', counts.ordered > 0);

        return counts;
    }

    function updateActionableHeader(counts) {
        const headerTitle = document.querySelector('.modern-summary-header h2');
        const headerMeta = document.querySelector('.modern-summary-header .header-meta');
        if (!headerTitle || !headerMeta) return;

        if (counts.total === 0) {
            headerTitle.textContent = 'UNKNOWN';
            headerMeta.textContent = 'No test data loaded';
            return;
        }

        const pendingTotal = counts.ordered + counts.resulted;
        const totalSpan = `<span style="background-color: #000000; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 16px; font-weight: bold;">TOTAL TESTS: ${counts.total}</span>`;

        if (pendingTotal > 0) {
            if (counts.ordered > 0 && counts.resulted > 0) {
                headerTitle.textContent = "ACTION REQUIRED! : Waiting for Result & Verification";
            } else {
                headerTitle.textContent = counts.resulted > 0 ? "ACTION REQUIRED! : Verification Required" : "ACTION REQUIRED! : Waiting for Results";
            }
            headerMeta.innerHTML = pendingTotal + ' Pending | ' + totalSpan;
        } else {
            headerTitle.textContent = 'All Clear: No Pending Actions';
            headerMeta.innerHTML = totalSpan;
        }
    }

    function syncHeaderColor(counts) {
        const summaryHeader = document.querySelector('.modern-summary-header');
        if (!summaryHeader) return;
        const pending = counts.ordered + counts.resulted;
        summaryHeader.style.backgroundColor = counts.total === 0 ? '#808080' : (pending > 0 ? '#f1c40f' : '#2ecc71');
        summaryHeader.style.color = pending > 0 ? '#2c3e50' : '#ffffff';
    }

    function initializeModernSummaryTable() {
        const container = document.getElementById('test-summary-container');
        if (!container) return;

        container.innerHTML = `
            <div class="modern-summary-header">
                <div class="header-info">
                    <h2>Loading...</h2>
                    <div class="header-meta">--</div>
                </div>
            </div>
            <div class="controls-bar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="modernSearchInput" placeholder="Search tests...">
                </div>
                <div class="filter-buttons">
                    <button class="filter-btn" data-filter="all">All <span class="count" id="modernAllCount">0</span></button>
                    <button class="filter-btn" data-filter="ordered">Ordered <span class="count" id="modernOrderedFilterCount">0</span></button>
                    <button class="filter-btn" data-filter="resulted">Resulted <span class="count" id="modernResultedFilterCount">0</span></button>
                    <button class="filter-btn" data-filter="verified1">L1 <span class="count" id="modernVerified1FilterCount">0</span></button>
                    <button class="filter-btn" data-filter="verified2">L2 <span class="count" id="modernVerified2FilterCount">0</span></button>
                    <button class="filter-btn" data-filter="flagged">Flagged <span class="count" id="modernFlaggedFilterCount">0</span></button>
                </div>
            </div>
            <div class="table-container">
                <table class="tests-table">
                    <thead>
                        <tr>
                            <th>Test Name</th>
                            <th class="right">Result</th>
                            <th>UOM</th>
                            <th class="center">Reference Range</th>
                            <th class="center">Flag</th>
                            <th class="center">Status</th>
                        </tr>
                    </thead>
                    <tbody id="modernTestsTableBody"></tbody>
                </table>
                <div id="modernEmptyState" class="empty-state" style="display: none;">
                    <div class="empty-state-icon">📋</div>
                    <p>No tests found</p>
                </div>
            </div>
            <div class="summary-footer">
                <span id="modernDisplayInfo">Showing 0 of 0 tests</span>
                <span>Last updated: <span id="modernLastUpdate">--</span></span>
            </div>`;

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentFilter = btn.dataset.filter;
                localStorage.setItem(FILTER_STORAGE_KEY, currentFilter);
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderModernTable();
            });
        });

        const searchInput = document.getElementById('modernSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => { searchTerm = e.target.value; renderModernTable(); });
        }
        const activeBtn = document.querySelector('.filter-btn[data-filter="' + currentFilter + '"]');
        if (activeBtn) activeBtn.classList.add('active');
    }

    window.enhancedGrid.triggerSummaryUpdate = function() {
        allTestsData = getAllTests();
        allTestsData.sort((a, b) => {
            const statusA = normalizeStatus(a.status), statusB = normalizeStatus(b.status);
            if (statusA === 'resulted' && statusB !== 'resulted') return -1;
            if (statusA !== 'resulted' && statusB === 'resulted') return 1;
            const idxA = getSortIndex(a.name), idxB = getSortIndex(b.name);
            return idxA === idxB ? a.originalIndex - b.originalIndex : idxA - idxB;
        });

        const counts = updateModernCounts();
        renderModernTable();
        const formattedTime = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        if(document.getElementById('modernLastUpdate')) document.getElementById('modernLastUpdate').textContent = formattedTime;
        updateActionableHeader(counts);
        syncHeaderColor(counts);
    };

    // ==========================================
    // EXTENDED PERSISTENT LAYOUT FUNCTIONS
    // ==========================================
    const GRID_WIDTH = '50vw';
    const RESIZED_FLAG = 'data-ag-resized';
    const CLICKED_ROW_EXPIRY_PREFIX = 'clicked_row_expiry_';
    const CLICK_DURATION_MS = 60 * 1000;

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    function extractMrnsFromContainer(profileContainer) {
        const mrns = {};
        const mid2Container = profileContainer.querySelector('.mid2');
        if (mid2Container) {
            const primaryMrnEl = mid2Container.querySelector('span.content[placement="left"]');
            const secondaryMrnEl = mid2Container.querySelector('span.content[placement="right"]');
            if (primaryMrnEl && secondaryMrnEl) {
                return " Baby's MRN: " + primaryMrnEl.textContent.trim() + " |  Mother's MRN: " + secondaryMrnEl.textContent.replace(/[\/ ]/g, '').trim();
            }
        }
        profileContainer.querySelectorAll('.mid').forEach(div => {
            const label = div.querySelector('h6')?.textContent.trim().toUpperCase();
            const value = div.querySelector('span')?.textContent.trim();
            if (label?.includes('MRN')) {
                if (!mrns.patient && value) mrns.patient = value;
                if (label.includes('M.MRN') && value) mrns.mother = value;
            }
        });
        return mrns.patient && mrns.mother ? "Baby'MRN : " + mrns.patient + " | Mother's MRN: " + mrns.mother : (mrns.patient ? "MRN: " + mrns.patient : null);
    }

    function displayMrn() {
        const box = document.getElementById('barcode-display-box');
        const profileContainer = document.querySelector('.patient-profile');
        if (!box || !profileContainer) return;
        const mrnString = extractMrnsFromContainer(profileContainer);
        let mrnElement = document.getElementById('mrn-display');
        if (mrnString) {
            if (!mrnElement) {
                mrnElement = document.createElement('div');
                mrnElement.id = 'mrn-display';
                box.appendChild(mrnElement);
            }
            if (mrnElement.textContent !== mrnString) mrnElement.textContent = mrnString;
        } else if (mrnElement) mrnElement.remove();
    }

    function updatePatientTypeBadge() {
        const container = document.querySelector('.patient-img');
        const labelTd = document.querySelector('td[translateid="patient-detail.PatientType"]');
        if (!container || !labelTd || !labelTd.nextElementSibling) return;

        const patientType = labelTd.nextElementSibling.textContent.trim().toUpperCase();
        let badge = container.querySelector('.patient-type-badge');
        if (!badge) { badge = document.createElement('div'); container.appendChild(badge); }

        if (patientType.includes('IN PATIENT') || patientType.includes('INPATIENT')) {
            badge.textContent = 'IN-PATIENT'; badge.className = 'patient-type-badge in-patient';
        } else if (patientType.includes('OUT PATIENT') || patientType.includes('OUTPATIENT')) {
            badge.textContent = 'OUT-PATIENT'; badge.className = 'patient-type-badge out-patient';
        } else if (patientType.includes('EMERGENCY') || patientType === 'ER') {
            badge.textContent = 'ER'; badge.className = 'patient-type-badge in-patient';
            badge.style.backgroundColor = '#c0392b';
        } else { badge.remove(); }
    }

    // ==========================================
    // AUTOMATED ANALYZER COLUMNS TOGGLE PANEL
    // ==========================================
    const columnsToUncheck = [
        'Lab Order No', 'Hospital MRN', 'DOB', 'Test ID', 'National/Iqama Id', 'Department',
        'Doctor', 'Analyzer', 'Reference Lab', 'Accession No', 'Sequence No', 'Age',
        'Container Type', 'Storage Condition'
    ];
    let hasRunOnce = false;

    function isSpecificPageForColumns() {
        return window.location.href.endsWith('/#/lab-orders/lab-test-analyzer');
    }
    function areColumnsChecked() {
        return columnsToUncheck.some(column => isColumnChecked(column));
    }
    function isColumnChecked(labelText) {
        for (const label of document.querySelectorAll('.ag-column-tool-panel-column-label')) {
            if (label.textContent.trim() === labelText && label.parentElement.querySelector('.ag-icon-checkbox-checked')) return true;
        }
        return false;
    }
    function ensureColumnsUnchecked() {
        if (hasRunOnce || !isSpecificPageForColumns() || !areColumnsChecked()) return;
        hasRunOnce = true;
        setTimeout(() => columnsToUncheck.forEach(clickColumnLabel), 1000);
    }
    function ensureOtherColumnsChecked() {
        if (!isSpecificPageForColumns()) return;
        document.querySelectorAll('.ag-column-tool-panel-column-label').forEach(label => {
            if (!columnsToUncheck.includes(label.textContent.trim()) && label.parentElement.querySelector('.ag-icon-checkbox-unchecked')) label.click();
        });
    }
    function clickColumnLabel(labelText) {
        if (!isSpecificPageForColumns()) return;
        document.querySelectorAll('.ag-column-tool-panel-column-label').forEach(label => {
            if (label.textContent.trim() === labelText && label.parentElement.querySelector('.ag-icon-checkbox-checked')) label.click();
        });
    }
    function initColumnToggle() {
        if (!isSpecificPageForColumns()) return;
        let attempts = 0;
        const interval = setInterval(() => {
            if (document.querySelector('.ag-side-buttons') || ++attempts > 10) {
                if (document.querySelector('.ag-side-buttons')) {
                    ensureColumnsUnchecked();
                    ensureOtherColumnsChecked();
                }
                clearInterval(interval);
            }
        }, 500);
    }

    function handleRowClickForPersistentGreen(event) {
        const cellElement = event.target.closest('.ag-cell');
        const rowElement = cellElement?.closest('.ag-row[role="row"]');
        const barcode = rowElement?.querySelector('div[col-id="barcode"]')?.textContent?.trim();
        if (!barcode) return;
        localStorage.setItem(CLICKED_ROW_EXPIRY_PREFIX + barcode, (Date.now() + CLICK_DURATION_MS).toString());
        applyPersistentRowStyles();
    }

    function applyPersistentRowStyles() {
        const rows = document.querySelectorAll('.ag-center-cols-container div[role="row"], .ag-pinned-left-cols-container div[role="row"], .ag-pinned-right-cols-container div[role="row"]');
        const now = Date.now();
        rows.forEach(row => {
            const barcode = row.querySelector('div[col-id="barcode"]')?.textContent?.trim();
            if (barcode) {
                const val = localStorage.getItem(CLICKED_ROW_EXPIRY_PREFIX + barcode);
                if (val && now < parseInt(val, 10)) row.classList.add('clicked-row-green');
                else { localStorage.removeItem(CLICKED_ROW_EXPIRY_PREFIX + barcode); row.classList.remove('clicked-row-green'); }
            } else row.classList.remove('clicked-row-green');
        });
    }

    // ==========================================
    // FEATURE: PERSISTENT DETAILS SHOW/HIDE TOGGLE
    // ==========================================
    function setupPatientDetailToggle() {
        const detailTop = document.querySelector('.lo-view-detail-top');
        const btnArea = document.querySelector('.btn-area');

        if (!detailTop || !btnArea || document.getElementById('custom-detail-toggle-btn')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'custom-detail-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn btn-sm';

        const updateButtonUI = (state) => {
            if (state === 'hide') {
                toggleBtn.innerHTML = '<i class="fa fa-eye"></i> Show Patient Info';
                toggleBtn.style.cssText = 'background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important; color: white !important;';
            } else {
                toggleBtn.innerHTML = '<i class="fa fa-eye-slash"></i> Hide Patient Info';
                toggleBtn.style.cssText = 'background: linear-gradient(135deg, #d32f2f 0%, #a11f1f 100%) !important; color: white !important;';
            }
        };

        const initialVisibility = localStorage.getItem('labDetailTopVisibility') || 'show';
        updateButtonUI(initialVisibility);

        toggleBtn.addEventListener('click', () => {
            const isCurrentlyHidden = detailTop.style.display === 'none';
            if (isCurrentlyHidden) {
                detailTop.style.display = '';
                localStorage.setItem('labDetailTopVisibility', 'show');
                updateButtonUI('show');
            } else {
                detailTop.style.display = 'none';
                localStorage.setItem('labDetailTopVisibility', 'hide');
                updateButtonUI('hide');
            }
            window.enhancedGrid.triggerSummaryUpdate?.();
        });

        btnArea.prepend(toggleBtn);
    }

    const fullPageUpdate = debounce(() => {
        const actionButtonContainer = document.querySelector('div.lo-act-btn');
        if (actionButtonContainer && actionButtonContainer.parentElement) {
            actionButtonContainer.parentElement.removeAttribute('style');
        }
        document.querySelectorAll('ag-grid-angular').forEach(grid => {
            if (grid.getAttribute(RESIZED_FLAG)) return;
            const api = grid.agGrid?.api || grid.__agGridComp?.api;
            if (api && typeof api.sizeColumnsToFit === 'function') {
                grid.style.width = GRID_WIDTH;
                grid.style.marginLeft = 'auto';
                grid.style.marginRight = '0';
                api.sizeColumnsToFit();
                grid.setAttribute(RESIZED_FLAG, 'true');
            }
        });
        document.querySelectorAll('div.accd-details-table-static.test-open, .card-header').forEach(el => {
            el.style.width = GRID_WIDTH;
            el.style.marginLeft = 'auto';
            el.style.marginRight = '0';
        });
        document.querySelectorAll('h6[translateid="test-results.Results"]').forEach(el => el.remove());

        const detailTop = document.querySelector('.lo-view-detail-top');
        if (detailTop) {
            const storedVisibility = localStorage.getItem('labDetailTopVisibility') || 'show';
            detailTop.style.display = storedVisibility === 'hide' ? 'none' : '';
        }
        setupPatientDetailToggle();

        applyPersistentRowStyles();
        const gridRoot = document.querySelector('.ag-root-wrapper') || document.querySelector('.ag-body-viewport') || document.body;
        if (gridRoot && !gridRoot.dataset.persistentClickListenerAttached) {
            gridRoot.addEventListener('click', handleRowClickForPersistentGreen, true);
            gridRoot.dataset.persistentClickListenerAttached = 'true';
        }
        displayMrn();
        updateSummaryPosition();
        updatePatientTypeBadge();
        setupMenuNavigationObserver();

        if (isSpecificPageForColumns()) {
            hasRunOnce = false;
            initColumnToggle();
        }
    }, 100);

    // ==========================================
    // STICKY CONTEXT BARCODE GENERATOR
    // ==========================================
    (function() {
        const BARCODE_KEY = 'selectedBarcode';

        function insertBarcodeBox(barcode) {
            const stickyBtnSet = document.querySelector('.btn-area.stickey-btnset');
            let target = document.querySelector('#custom-script-buttons') || document.querySelector('.test-open.mt-2');
            if (!barcode || document.getElementById('barcode-display-box')) return;

            const box = document.createElement('div');
            box.id = 'barcode-display-box';
            box.style.cssText = 'padding: 5px 10px; background:#ffffff; border-bottom: 1px solid #ccc; display:flex; align-items:center; gap:10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; z-index: 990;';

            box.innerHTML = `<div style="font-weight:bold; font-size:12px; color:#555; text-transform: uppercase;">Barcode:</div>
                             <div style="font-size: 18px; color: #000; font-weight: 800; font-family: monospace; letter-spacing: 1px;">${barcode}</div>`;

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.id = "barcode-svg"; svg.style.cssText = 'height:30px; width:90px;';
            box.appendChild(svg);

            if (stickyBtnSet) stickyBtnSet.insertAdjacentElement('afterend', box);
            else if (target) target.insertAdjacentElement('afterend', box);

            if (stickyBtnSet) {
                try {
                    const style = window.getComputedStyle(stickyBtnSet);
                    if (style.position === 'sticky' || style.position === 'fixed') {
                        Object.assign(box.style, { position: 'sticky', top: (stickyBtnSet.offsetHeight + (parseInt(style.top, 10) || 0)) + 'px', left: '0', zIndex: '999' });
                    }
                } catch (e) { console.error(e); }
            }

            if (window.JsBarcode) {
                try {
                    JsBarcode(svg, barcode, { format: "CODE128", displayValue: false, height: 30, width: 2, margin: 0, background: "transparent" });
                } catch (err) { svg.outerHTML = "<span style='color:red; font-size:10px;'>Invalid</span>"; }
            }
            displayMrn();
        }

        document.body.addEventListener('click', e => {
            const cell = e.target.closest('.ag-row')?.querySelector('[col-id="barcode"]');
            if (cell?.textContent.trim()) {
                const val = cell.textContent.trim();
                localStorage.setItem(BARCODE_KEY, val);
                const textDiv = document.querySelector('#barcode-display-box div:nth-child(2)');
                if (textDiv) {
                    textDiv.textContent = val;
                    const svg = document.getElementById('barcode-svg');
                    if(svg && window.JsBarcode) JsBarcode(svg, val, { format: "CODE128", displayValue: false, height: 35, width: 2, margin: 0, background: "transparent" });
                }
            }
        });

        window.enhancedGrid.barcodeBoxUrlCheck = function() {
            const barcode = localStorage.getItem(BARCODE_KEY);
            if (!barcode || !/\/lab\/.*\/0\//.test(location.href)) return;
            if (document.getElementById('barcode-display-box')) return;

            let target = document.querySelector('.btn-area.stickey-btnset') || document.querySelector('#custom-script-buttons') || document.querySelector('.test-open.mt-2');
            if (target) {
                insertBarcodeBox(barcode);
            }
        };
    })();

    // ==========================================
    // CONDITIONAL AUTOMATED AUTO VERIFY 2
    // ==========================================
    (function() {
        const VERIFIED1_STATUS_TEXT = 'Verified 1', RESULTED_STATUS_TEXT = 'Resulted';
        let isAutoVerifyEnabled = true, isVerificationProcessStarted = false, hasAutoClicked = false;

        function runSafetyChecks() {
            if (document.querySelector('.modal-content')?.querySelector('h4.modal-title')?.textContent.trim() === 'Primary Verification') return false;
            for (const cell of document.querySelectorAll('div[col-id="ResultStatus"]')) {
                if (cell.textContent?.trim().includes(RESULTED_STATUS_TEXT)) return false;
            }
            return true;
        }

        function checkAndAutoClick() {
            if (!isAutoVerifyEnabled || !isVerificationProcessStarted || hasAutoClicked || !runSafetyChecks()) return;
            let targetFound = false;
            for (const cell of document.querySelectorAll('div[col-id="ResultStatus"]')) {
                if (cell.textContent?.trim().includes(VERIFIED1_STATUS_TEXT)) { targetFound = true; break; }
            }
            if (targetFound) {
                document.querySelector('button.verify2-btn')?.click(); hasAutoClicked = true;
            }
        }

        window.enhancedGrid.autoVerify = {
            init: () => {
                GM_addStyle(`
                    .auto-verify-toggle { display: inline-flex; align-items: center; gap: 12px; padding: 6px 10px; border: 1px solid #ccc; border-radius: 20px; background-color: #f8f9fa; cursor: pointer; transition: all 0.3s ease; user-select: none; }
                    .auto-verify-toggle.is-active { border-color: #7ab5ff; background-color: #e7f1ff; animation: pulse-glow 2s infinite; }
                    .toggle-label { font-size: 12px; font-weight: 600; color: #333; display: flex; align-items: center; gap: 6px; }
                    .toggle-switch { position: relative; width: 40px; height: 22px; background-color: #ccc; border-radius: 11px; transition: background-color 0.3s ease; }
                    .auto-verify-toggle.is-active .toggle-switch { background-color: #007bff; }
                    .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background-color: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.3s ease; }
                    .auto-verify-toggle.is-active .toggle-thumb { transform: translateX(18px); }
                    @keyframes pulse-glow { 0% { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0.3); } 70% { box-shadow: 0 0 0 8px rgba(0, 123, 255, 0); } 100% { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0); } }
                `);
                setInterval(checkAndAutoClick, 200);
                document.addEventListener('keydown', e => { if (e.key === 'F8' && runSafetyChecks()) document.querySelector('button.verify2-btn')?.click(); });
                document.addEventListener('click', e => { if (e.target.closest('button.verify1-btn')) { isVerificationProcessStarted = true; hasAutoClicked = false; } });
            },
            updateUI: () => {
                document.getElementById('autoVerifyToggleContainer')?.classList.toggle('is-active', isAutoVerifyEnabled);
                const btn2 = document.querySelector('button.verify2-btn');
                if (btn2 && !btn2.dataset.redesigned) {
                    btn2.textContent = 'VERIFY2 (F8)';
                    Object.assign(btn2.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500' });
                    btn2.dataset.redesigned = 'true';
                }
                if (btn2) btn2.style.borderColor = isAutoVerifyEnabled ? '#007bff' : '';
            },
            redesignHistory: () => {
                const btn = document.querySelector('button.backBtn[translateid="edit-lab-order.HistoryResults"]');
                if (!btn || btn.dataset.redesigned) return;
                btn.innerHTML = `<span style="margin-right: 6px;">🕒</span> View History`;
                Object.assign(btn.style, { display: 'inline-flex', alignItems: 'center', fontWeight: '500' });
                btn.dataset.redesigned = 'true';
            },
            injectToggle: () => {
                const btn = document.querySelector('button.backBtn[translateid="edit-lab-order.HistoryResults"]');
                if (!btn || document.getElementById('autoVerifyToggleContainer')) return;
                const container = document.createElement('div');
                container.id = 'autoVerifyToggleContainer'; container.className = 'auto-verify-toggle';
                container.innerHTML = `<span class="toggle-label"><span style="font-size: 14px;">🤖</span><span>AUTO VERIFY 2</span></span>
                                       <div class="toggle-switch"><div class="toggle-thumb"></div></div>`;
                container.addEventListener('click', () => { isAutoVerifyEnabled = !isAutoVerifyEnabled; window.enhancedGrid.autoVerify.updateUI(); });
                container.style.marginRight = '15px'; container.style.verticalAlign = 'middle';
                btn.parentElement.insertBefore(container, btn);
            },
            resetState: () => { hasAutoClicked = false; isVerificationProcessStarted = false; }
        };
    })();

    // ==========================================
    // SUMMARY VIEW LIFECYCLE MANAGEMENT
    // ==========================================
    const attemptInsertion = () => {
        let target = document.getElementById('barcode-display-box') || document.querySelector('.btn-area.stickey-btnset') || document.querySelector('.test-open.mt-2');
        if (!target || document.getElementById('test-summary-container')) return false;

        let container = document.createElement('div');
        container.id = 'test-summary-container';
        target.insertAdjacentElement('afterend', container);

        updateSummaryPosition();
        initializeModernSummaryTable();
        return true;
    };

    function updateSummaryPosition() {
        const container = document.getElementById('test-summary-container');
        const barcodeBox = document.getElementById('barcode-display-box');
        if (container && barcodeBox) {
            try {
                const styles = window.getComputedStyle(barcodeBox);
                if (styles.position === 'sticky' || styles.position === 'fixed') {
                    Object.assign(container.style, { position: 'sticky', top: ((parseInt(styles.top, 10) || 0) + barcodeBox.offsetHeight) + 'px', zIndex: '98', marginLeft: 'auto', marginRight: '0' });
                }
            } catch (e) { console.error(e); }
        }
    }

    const manageSummaryTableLifecycle = () => {
        if (/\/lab\/.*\/0\//.test(window.location.href)) {
            if (!document.getElementById('test-summary-container')) {
                attemptInsertion();
            }
        } else {
            document.getElementById('test-summary-container')?.remove();
        }
    };

    // ==========================================
    // DEBOUNCED REACTIVE UI AUTOMATION PIPELINE
    // ==========================================
    let lastSummaryUpdate = 0;
    function runAllUpdates() {
        fullPageUpdate();
        if (document.getElementById('test-summary-container') && (document.querySelector('.ag-center-cols-container .ag-row') || document.querySelector('.ag-overlay-no-rows-center'))) {
            const now = Date.now();
            if (!window.enhancedGrid.summaryPopulated || (now - lastSummaryUpdate > 5000)) {
                window.enhancedGrid.triggerSummaryUpdate?.();
                lastSummaryUpdate = now; window.enhancedGrid.summaryPopulated = true;
            }
        }
        window.enhancedGrid.autoVerify?.injectToggle();
        window.enhancedGrid.autoVerify?.redesignHistory();
        window.enhancedGrid.autoVerify?.updateUI();
    }

    console.log('Unified Lab Assistant Architecture initialized.');
    window.enhancedGrid.autoVerify.init();

    let lastUrl = location.href;
    const spaObserver = new MutationObserver(debounce(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            window.enhancedGrid.summaryPopulated = false;
            document.querySelectorAll('ag-grid-angular').forEach(grid => grid.removeAttribute(RESIZED_FLAG));
            window.enhancedGrid.autoVerify?.resetState();
            console.log('[Lab Assistant] Navigation Mutation Triggered: Resetting state maps.');

            initializeScript();
        }
        // Continuous structural layout verification to intercept dynamic template switches
        window.enhancedGrid.barcodeBoxUrlCheck?.();
        manageSummaryTableLifecycle();
        runAllUpdates();
    }, 200));

    spaObserver.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { runAllUpdates(); initializeScript(); window.enhancedGrid.barcodeBoxUrlCheck?.(); manageSummaryTableLifecycle(); }, 500);
})();

// ==========================================
// AUTOMATED MASTER DROPDOWN PAGINATION OVERRIDE
// ==========================================
(function() {
    'use strict';
    const setDropdownValue = () => {
        const dropdown = document.getElementById("dropdownPaginationPageSize");
        if (dropdown) {
            const customOption = Array.from(dropdown.options).find(opt => opt.value === "500");
            if (!customOption) {
                const newOption = document.createElement('option');
                newOption.value = "500";
                newOption.text = "500";
                dropdown.appendChild(newOption);
            }
            if (dropdown.value !== "500") {
                dropdown.value = "500";
                dropdown.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };
    new MutationObserver(setDropdownValue).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', setDropdownValue);
})();

// ============================================
// TELEPHONE EXTENSION OVERLAY MODULE
// ============================================
(function() {
    'use strict';

    const WARD_EXTENSIONS = {
        'CARDIAC CARE CENTER': ['12600', '11648'], 'CARDIAC CARE UNIT': ['12600', '11648'], 'CARDIAC CENTER': ['12600', '11648'], 'CARDIC CENTRE': ['12600', '11648'], 'CARDIC CARE CENTER': ['12600', '11648'], 'CCU': ['12600', '11648'], 'CC': ['12600', '11648'],
        'FEMALE MEDICAL UNIT': ['13114'], 'FEMALE MEDICAL': ['13114'], 'FM': ['13114'],
        'MALE MEDICAL UNIT': ['13014', '13774', '13616'], 'MALE MEDICAL': ['13014', '13774', '13616'], 'MM': ['13014', '13774', '13616'],
        'MALE SURGICAL UNIT': ['15613', '15600', '15007', '15614', '15615'], 'MALE SURGICAL': ['15613', '15600', '15007', '15614', '15615'], 'MS': ['15613', '15600', '15007', '15614', '15615'],
        'FEMALE SURGICAL UNIT': ['15113', '15114', '15115'], 'FEMALE SURGICAL': ['15113', '15114', '15115'], 'FS': ['15113', '15114', '15115'],
        'LABOR AND DELIVERY': ['11722', '11723'], 'LABOR & DELIVERY': ['11722', '11723'], 'L & D': ['11722', '11723'], 'L&D': ['11722', '11723'],
        'DAY CARE UNIT ONCOLOGY HEMATOLOGY': ['14107', '14116', '14106', '14310'], 'DCUOH': ['14107', '14116', '14106', '14310'], 'DAY CARE UNIT': ['14107', '14116', '14106', '14310'], 'DCU': ['14107', '14116', '14106', '14310'],
        'DIALYSIS': ['10319', '12146', '12401'], 'DUTY MANAGER': ['17179'], 'ENDOSCOPY': ['10228', '10221'], 'ENDO': ['10228', '10221'],
        'EMERGENCY ROOM UNIT': ['10999', '18331', '10342', '10552', '10415', '10557', '10435'], 'Emergency Department (ED)': ['10999', '18331', '10342', '10552', '10415', '10557', '10435'], 'EMERGENCY ROOM': ['10999', '18331', '10342', '10552', '10415', '10557', '10435'], 'ER UNIT': ['10999', '18331', '10342', '10552', '10415', '10557', '10435'], 'ER': ['10999', '18331', '10342', '10552', '10415', '10557', '10435'], 'ED': ['10999', '18331', '10342', '10552', '10415', '10557', '10435'],
        'HEMATOLOGY CLINIC': ['11411', '11410'], 'HEMA CLINIC': ['11411', '11410'], 'INFECTIOUS DISEASE ISOLATION': ['12401', '12402'], 'IDIA': ['12401', '12402'],
        'INPATIENT ONC.HEMA.': ['10652', '10360'], 'INSTITUTE OF OPHTHALMOLOGY': ['10652', '10360'], 'IOH IN': ['10652', '10360'], 'IOH': ['10652', '10360'],
        'ISOLATION UNIT': ['14302', '14303'], 'ISOLATION': ['14302', '14303'], 'ISO': ['14302', '14303'],
        'MEDICAL INTENSIVE CARE UNIT': ['12807', '12802', '12801'], 'MICU': ['12807', '12802', '12801'], 'SURGICAL INTENSIVE CARE UNIT': ['10258', '10288', '10277', '18422'], 'SICU': ['10258', '10288', '10277', '18422'],
        'NEONATAL INTENSIVE CARE UNIT': ['11840'], 'NICU': ['11840'], 'PEDIATRIC CARDIAC INTENSIVE CARE UNIT': ['10547', '10549'], 'PEDIATRIC CARDIAC ICU': ['10547', '10549'], 'PCICU': ['10547', '10549'], 'PEDIATRIC INTENSIVE CARE UNIT 2': ['13352', '13355'], 'PICU 2': ['13352', '13355'], 'PEDIATRIC INTENSIVE CARE UNIT': ['12814', '12815'], 'PICU': ['12814', '12815'], 'SURGICAL INTERMEDIATE CARE UNIT': ['15115'], 'SIMCU': ['15115'],
        'NEWBORN NURSERY': ['11220', '11767', '11724'], 'NURSERY': ['11220', '11767', '11724'], 'NN': ['11220', '11767', '11724'], 'OBSTETRICS': ['11734', '11114', '11116'], 'OB': ['11734', '11114', '11116'],
        'PEDIATRIC DAY CARE UNIT': ['11764'], 'PED DAY CARE': ['11764'], 'DAY CARE (PEDIATRIC UNIT)': ['11764'], 'PEDIATRIC EMERGENCY ROOM': ['10412'], 'PEDIATRIC ER': ['10412'], 'PED ER': ['10412'], 'PEDIATRIC HEMATOLOGY ONCOLOGY': ['12615'], 'PED HEMA ONC': ['12615'],
        'POST MEDICAL 1': ['11613', '17164', '11612', '10288', '11761'], 'PM 1': ['11613', '17164', '11612', '10288', '11761'], 'PEDIATRIC UNIT 1': ['11613', '17164', '11612', '10288', '11761'], 'POST MEDICAL 2': ['12616', '12618', '12605'], 'PM 2': ['12616', '12618', '12605'], 'PEDIATRIC UNIT 2': ['12616', '12618', '12605'],
        'PRIVATE WARD 1': ['11763', '12012', '12011', '12015'], 'PRIVATE': ['11763', '12012', '12011', '12015'], 'PVT1': ['11763', '12012', '12011', '12015'],
        'PATIENT CARE SUPPORT SERVICES': ['10538'], 'PCSS': ['10538'], 'STAFF HEALTH SERVICES': ['10016', '10017'], 'STAFF HEALTH': ['10016', '10017'], 'STAT LABORATORY': ['10427'], 'STAFF LAB': ['10427']
    };

    function getExtensionsForLocation(location) {
        if (!location) return null;
        const normalized = location.toUpperCase().trim().split('/')[0].trim();
        const abbrevMatch = normalized.match(/\(([^)]+)\)/);
        if (abbrevMatch && WARD_EXTENSIONS[abbrevMatch[1].trim()]) return WARD_EXTENSIONS[abbrevMatch[1].trim()];
        if (WARD_EXTENSIONS[normalized]) return WARD_EXTENSIONS[normalized];

        const sortedKeys = Object.keys(WARD_EXTENSIONS).sort((a, b) => b.length - a.length);
        for (const ward of sortedKeys) { if (normalized.includes(ward)) return WARD_EXTENSIONS[ward]; }
        return null;
    }

    GM_addStyle(`
        .location-telephone-chip { display: inline-flex; align-items: center; border-radius: 12px; overflow: hidden; font-size: 16px; font-weight: 600; box-shadow: 0 2px 8px rgba(0, 123, 255, 0.25); border: 1px solid rgba(0, 123, 255, 0.2); cursor: default; }
        .loc-text { padding: 8px 16px; background: linear-gradient(135deg, #0062cc 0%, #004a99 50%, #003875 100%); color: #ffffff; font-weight: 700; }
        .loc-tel { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); color: #2c3e50; border-left: 2px solid rgba(0, 123, 255, 0.3); }
        .loc-tel::before { content: '☎'; color: #007bff; font-size: 16px; }
        .tel-numbers { font-family: sans-serif; font-weight: 700; color: #1a1a1a; }
    `);

    function createUnifiedChip(locationText, extensions) {
        if (!extensions || extensions.length === 0) return null;
        if (!locationText) locationText = "Location";
        const extensionList = extensions.join(', ');

        const chip = document.createElement('span');
        chip.className = 'location-telephone-chip';
        chip.innerHTML = `
            <span class="loc-text">${locationText}</span>
            <span class="loc-tel" title="Extension(s): ${extensionList}">
                <span class="tel-numbers">${extensionList}</span>
            </span>`;
        return chip;
    }

    function enhanceLocationWithTelephone(element) {
        if (!element) return;
        let text = "";
        element.childNodes.forEach(n => { if (n.nodeType === 3) text += n.textContent; });
        text = text.trim();
        if (!text || element.dataset.processedLocation === text) return;
        element.dataset.processedLocation = text;

        const extensions = getExtensionsForLocation(text);
        if (extensions) {
            element.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
            element.querySelectorAll('.location-telephone-chip, .location-telephone').forEach(c => c.remove());
            element.style.cssText = "background:none; border:none; padding:0; margin:0; box-shadow:none; display:inline-block;";

            const chip = createUnifiedChip(text, extensions);
            if (chip) element.appendChild(chip);
        }
    }

    const selectors = '[col-id*="location"], [col-id*="Location"], .patient-location, .test-location, #suite-location-display';
    const cellObserver = new MutationObserver(mutations => {
        window.requestAnimationFrame(() => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.matches(selectors)) enhanceLocationWithTelephone(node);
                        if (node.querySelectorAll) node.querySelectorAll(selectors).forEach(enhanceLocationWithTelephone);
                    }
                }
            }
        });
    });
    cellObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => document.querySelectorAll(selectors).forEach(enhanceLocationWithTelephone), 1500);
})();
