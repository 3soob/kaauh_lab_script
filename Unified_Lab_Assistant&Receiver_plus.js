// ==UserScript==
// @name         Unified Lab Assistant & Receiver plus
// @version      30.11.18
// @updateURL    https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/Unified_Lab_Assistant%26Receiver_plus.js
// @downloadURL  https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/Unified_Lab_Assistant%26Receiver_plus.js
// @description  v30.11.10: Shows patient location + telephone extensions (or "Not Available") exclusively inside the sticky barcode display box, plus all v30.11.6 features.
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
// ==/UserScript==

(function () {
    'use strict';

    const SHIFT_STATS_KEY = 'labStaffShiftStats';
    const ALL_TIME_STATS_KEY = 'labStaffMonthlyStats';
    const LOCAL_SHIFT_STATS_KEY = 'labStaffLocalShiftStats';
    const LOCAL_ALL_TIME_STATS_KEY = 'labStaffLocalAllTimeStats';
    const SYNC_PC_ID_KEY = 'labStaffSyncPcId';
    const SHIFT_ID_KEY = 'labStaffCurrentShift';
    const PROCESSED_RECORDS_KEY = 'labStaffProcessedRecords';
    const BADGE_VISIBILITY_KEY = 'labStaffBadgeVisible';

    const HIDDEN_CLASS = 'lab-badge-hidden';
    const BADGE_ID = 'staffInlineCountBadge';
    const SYNC_RECONNECT_ID = 'staffSyncReconnectBtn';
    const POPUP_ID = 'staffStatsPopup';
    const RESET_MODAL_ID = 'staffStatsResetModal';

    const SYNC_DB_NAME = 'labStaffSyncDB';
    const SYNC_STORE_NAME = 'handles';
    const SYNC_HANDLE_KEY = 'syncDir';
    const SYNC_INTERVAL_MS = 15000;

    const POPUP_CLOSE_SECONDS = 5;
    const PROCESSED_RECORD_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

    let lastDisplayedStaff = null;
    let lastSampleCountSeen = null;
    let lastHotkeyTime = 0;
    let isStaffPopupHovered = false;

    function isPopupHovered() {
        const popup = document.getElementById(POPUP_ID);
        return !!(popup && (isStaffPopupHovered || popup.matches(':hover')));
    }

    GM_addStyle(`
        #${BADGE_ID}.${HIDDEN_CLASS} { display: none !important; }
        #${RESET_MODAL_ID} { position: fixed; inset: 0; z-index: 1000001; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(15, 23, 42, 0.55); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
        #${RESET_MODAL_ID} .staff-reset-dialog { width: min(580px, 100%); background: #fff; border-radius: 16px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.30); overflow: hidden; }
        #${RESET_MODAL_ID} .staff-reset-header { padding: 18px 20px; background: linear-gradient(135deg, #b91c1c, #ef4444); color: #fff; font-size: 16px; font-weight: 800; }
        #${RESET_MODAL_ID} .staff-reset-body { padding: 20px; color: #334155; font-size: 14px; line-height: 1.55; }
        #${RESET_MODAL_ID} .staff-reset-body p { margin: 0 0 12px; }
        #${RESET_MODAL_ID} .staff-reset-summary { padding: 10px 12px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; color: #475569; font-size: 13px; }
        #${RESET_MODAL_ID} .staff-reset-footer { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
        #${RESET_MODAL_ID} button { border: 0; border-radius: 8px; padding: 9px 13px; cursor: pointer; font-size: 13px; font-weight: 700; }
        #${RESET_MODAL_ID} .staff-reset-cancel { background: #e2e8f0; color: #334155; }
        #${RESET_MODAL_ID} .staff-reset-sync { background: #2563eb; color: #fff; }
        #${RESET_MODAL_ID} .staff-reset-export { background: #0f766e; color: #fff; }
        #${RESET_MODAL_ID} .staff-reset-confirm { background: #dc2626; color: #fff; }
        #${RESET_MODAL_ID} .staff-sync-box { margin-top: 12px; padding: 12px; border: 1px solid #cbd5e1; background: #f1f5f9; border-radius: 10px; font-size: 13px; }
        #${RESET_MODAL_ID} .staff-sync-status { font-weight: 700; color: #1e293b; margin-bottom: 8px; }
        #${RESET_MODAL_ID} .staff-sync-actions { display: flex; flex-wrap: wrap; gap: 6px; }
        #${RESET_MODAL_ID} .staff-sync-link { background: #4f46e5; color: #fff; }
        #${RESET_MODAL_ID} .staff-sync-reconnect { background: #d97706; color: #fff; }
        #${RESET_MODAL_ID} .staff-sync-now { background: #0284c7; color: #fff; }
        #${RESET_MODAL_ID} .staff-sync-unlink { background: #64748b; color: #fff; }
        #${SYNC_RECONNECT_ID} { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; margin-right: 8px; border: 1px solid #f59e0b; border-radius: 20px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 6px rgba(245,158,11,.25); }
        #${SYNC_RECONNECT_ID}:hover { background: #fde68a; }
    `);

    let badgeVisibleCache = null;
    function isBadgeVisible() {
        if (badgeVisibleCache === null) {
            const localVis = localStorage.getItem(BADGE_VISIBILITY_KEY);
            if (localVis !== null) { GM_setValue(BADGE_VISIBILITY_KEY, localVis); localStorage.removeItem(BADGE_VISIBILITY_KEY); }
            badgeVisibleCache = GM_getValue(BADGE_VISIBILITY_KEY) === 'true';
        }
        return badgeVisibleCache;
    }

    function applyBadgeVisibility() {
        const visible = isBadgeVisible();
        document.getElementById(BADGE_ID)?.classList.toggle(HIDDEN_CLASS, !visible);
        if (typeof updateReconnectPill === 'function') updateReconnectPill();
    }

    function setBadgeVisible(visible) {
        badgeVisibleCache = !!visible;
        GM_setValue(BADGE_VISIBILITY_KEY, visible ? 'true' : 'false');
        applyBadgeVisibility();
    }

    function toggleBadgeVisibility() {
        setBadgeVisible(!isBadgeVisible());
        console.log('[Staff Counter] Badge visibility:', isBadgeVisible() ? 'visible' : 'hidden');
    }

    function isCtrlShiftF4(event) { return event.ctrlKey && event.shiftKey && (event.key === 'F4' || event.code === 'F4' || event.keyCode === 115 || event.which === 115); }
    function isCtrlDelete(event) { return event.ctrlKey && (event.key === 'Delete' || event.code === 'Delete' || event.keyCode === 46 || event.which === 46); }

    function staffCounterHotkeyHandler(event) {
        if (event.repeat) return;
        const now = Date.now();
        if (isCtrlShiftF4(event)) {
            if (now - lastHotkeyTime < 300) return;
            lastHotkeyTime = now; event.preventDefault(); event.stopImmediatePropagation();
            toggleBadgeVisibility(); return;
        }
        if (isCtrlDelete(event)) {
            if (now - lastHotkeyTime < 300) return;
            lastHotkeyTime = now; event.preventDefault(); event.stopImmediatePropagation();
            openResetModal();
        }
    }
    window.addEventListener('keydown', staffCounterHotkeyHandler, true);

    function loadStats(key) {
        try {
            const localData = localStorage.getItem(key);
            if (localData) { GM_setValue(key, localData); localStorage.removeItem(key); }
            const rawData = GM_getValue(key);
            return rawData ? JSON.parse(rawData) : {};
        } catch { return {}; }
    }

    function saveStats(key, stats) { GM_setValue(key, JSON.stringify(stats)); }

    function normalizeStaffName(name) {
        return String(name || '').trim().replace(/\s+/g, ' ');
    }

    function getStaffStat(statsObj, staffName) {
        if (!statsObj || !staffName) return { tests: 0, samples: 0 };
        if (statsObj[staffName]) return statsObj[staffName];
        const target = normalizeStaffName(staffName).toLowerCase();
        for (const [key, val] of Object.entries(statsObj)) {
            if (normalizeStaffName(key).toLowerCase() === target) return val;
        }
        return { tests: 0, samples: 0 };
    }

    function loadProcessedRecords() {
        const records = loadStats(PROCESSED_RECORDS_KEY);
        return records && typeof records === 'object' && !Array.isArray(records) ? records : {};
    }
    function saveProcessedRecords(records) { saveStats(PROCESSED_RECORDS_KEY, records); }

    function formatLocalDate(date) {
        const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, '0'), day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getShiftIdFromTimestamp(timestamp) {
        const date = new Date(timestamp);
        const hour = date.getHours();
        const shift = hour >= 7 && hour < 15 ? 'Morning' : hour >= 15 && hour < 23 ? 'Evening' : 'Night';
        const anchorDate = new Date(date);
        if (hour < 7) anchorDate.setDate(anchorDate.getDate() - 1);
        return `${formatLocalDate(anchorDate)}_${shift}`;
    }

    function getCurrentShiftId() { return getShiftIdFromTimestamp(Date.now()); }

    function checkAndResetShift(triggerSync = true) {
        const currentShift = getCurrentShiftId();
        const localShift = localStorage.getItem(SHIFT_ID_KEY);
        if (localShift) { GM_setValue(SHIFT_ID_KEY, localShift); localStorage.removeItem(SHIFT_ID_KEY); }
        if (GM_getValue(SHIFT_ID_KEY) !== currentShift) {
            saveStats(SHIFT_STATS_KEY, {});
            saveStats(LOCAL_SHIFT_STATS_KEY, {});
            GM_setValue(SHIFT_ID_KEY, currentShift);
            saveProcessedRecords({});
            localStorage.removeItem('selectedBarcode');
            lastDisplayedStaff = null;
            lastSampleCountSeen = null;
            console.log('[Staff Counter] New shift started. Shift badge totals reset; persistent totals retained.');
            if (triggerSync && typeof syncWithDirectory === 'function') syncWithDirectory();
        }
    }

    function parseTests(rawText) { return rawText ? rawText.split(',').map(item => item.trim()).filter(Boolean) : []; }

    function getSamplesCountFromPage() {
        const element = document.querySelector('#main-counter-tag-inline-counter-smplrecieve .section-count-badge, [translateid*="Sample"] .section-count-badge, .profile-wrapper .section-count-badge');
        if (!element) return null;
        const value = parseInt(element.textContent.trim(), 10);
        return Number.isNaN(value) ? null : value;
    }

    function getStaffNameFromPage() {
        const input = document.querySelector('input[formcontrolname="receiverStaffName"]');
        return normalizeStaffName(input?.value || document.querySelector('.profile-wrapper .csi-dropdown-btn-text')?.textContent || '');
    }

    function normalizeBarcode(value) { return String(value || '').trim().replace(/\s+/g, '').toUpperCase(); }

    function buildCreditFingerprint(staffName, barcodes, totalTests) {
        const normalizedBarcodes = [...new Set(barcodes.map(normalizeBarcode).filter(Boolean))].sort();
        if (normalizedBarcodes.length > 0) return `barcodes:${normalizedBarcodes.join('|')}`;
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

    function hasBarcode(barcodeArray, targetId) {
        if (!barcodeArray || !Array.isArray(barcodeArray)) return false;
        return barcodeArray.some(b => { const id = typeof b === 'string' ? b : b.id; return id === targetId; });
    }

    function getLastScan(barcodeArray) {
        if (!barcodeArray || !Array.isArray(barcodeArray)) return null;
        let maxTs = 0;
        barcodeArray.forEach(b => { if (b && typeof b === 'object' && b.ts > maxTs) maxTs = b.ts; });
        return maxTs > 0 ? maxTs : null;
    }

    function formatTime(ts, includeDate = false) {
        if (!ts) return '--:--';
        const d = new Date(ts);
        if (includeDate) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function recalculateSampleCounts() {
        let shiftFixes = 0, allTimeFixes = 0, shiftAdjustments = 0, allTimeAdjustments = 0;
        const currentShiftId = getCurrentShiftId();

        [SHIFT_STATS_KEY, ALL_TIME_STATS_KEY, LOCAL_SHIFT_STATS_KEY, LOCAL_ALL_TIME_STATS_KEY].forEach(key => {
            const stats = loadStats(key);
            let updated = false;

            Object.keys(stats).forEach(staff => {
                const data = stats[staff];
                if (data.barcodes && Array.isArray(data.barcodes)) {
                    let validBarcodes = data.barcodes;
                    if (key === SHIFT_STATS_KEY || key === LOCAL_SHIFT_STATS_KEY) {
                        validBarcodes = data.barcodes.filter(b => {
                            if (typeof b === 'string' || !b.ts) return true;
                            return getShiftIdFromTimestamp(b.ts) === currentShiftId;
                        });
                        if (validBarcodes.length !== data.barcodes.length) { data.barcodes = validBarcodes; updated = true; }
                    }

                    const uniqueCount = new Set(validBarcodes.map(b => typeof b === 'string' ? normalizeBarcode(b) : normalizeBarcode(b.id)).filter(Boolean)).size;
                    const currentSamples = data.samples || 0;

                    if (currentSamples < uniqueCount) {
                        const difference = uniqueCount - currentSamples;
                        if (key === SHIFT_STATS_KEY) { shiftFixes++; shiftAdjustments += difference; }
                        else if (key === ALL_TIME_STATS_KEY) { allTimeFixes++; allTimeAdjustments += difference; }
                        data.samples = uniqueCount; updated = true;
                    }
                }
            });
            if (updated) saveStats(key, stats);
        });
        return { shiftFixes, allTimeFixes, shiftAdjustments, allTimeAdjustments };
    }

    function addTestsForStaff(staffName, testCount, sampleDelta, extractedBarcodes = []) {
        staffName = normalizeStaffName(staffName);
        if (!staffName || testCount <= 0) return false;

        const samples = Math.max(0, Number(sampleDelta) || 0);
        const now = Date.now();
        const normalizedBarcodes = extractedBarcodes.map(normalizeBarcode).filter(Boolean);

        [
            [SHIFT_STATS_KEY, ALL_TIME_STATS_KEY],
            [LOCAL_SHIFT_STATS_KEY, LOCAL_ALL_TIME_STATS_KEY]
        ].forEach(([sKey, aKey]) => {
            const shiftStats = loadStats(sKey);
            const allTimeStats = loadStats(aKey);

            shiftStats[staffName] ||= { tests: 0, samples: 0, barcodes: [] };
            allTimeStats[staffName] ||= { tests: 0, samples: 0, barcodes: [] };
            shiftStats[staffName].barcodes ||= [];
            allTimeStats[staffName].barcodes ||= [];

            shiftStats[staffName].tests += testCount; shiftStats[staffName].samples += samples;
            allTimeStats[staffName].tests += testCount; allTimeStats[staffName].samples += samples;

            normalizedBarcodes.forEach(barcode => {
                if (!hasBarcode(shiftStats[staffName].barcodes, barcode)) shiftStats[staffName].barcodes.push({ id: barcode, ts: now });
                if (!hasBarcode(allTimeStats[staffName].barcodes, barcode)) allTimeStats[staffName].barcodes.push({ id: barcode, ts: now });
            });

            saveStats(sKey, shiftStats); saveStats(aKey, allTimeStats);
        });

        updateInlineBadge(true);
        syncWithDirectory(false);
        return true;
    }

    // =====================================================================
    // BROWSER-ONLY DIRECTORY SYNC (File System Access API + IndexedDB)
    // =====================================================================
    let cachedDirHandle = null;
    let syncPermissionState = 'unlinked';
    let syncInProgress = false;
    let syncIntervalId = null;

    function getSyncPcId() {
        let id = GM_getValue(SYNC_PC_ID_KEY);
        if (!id) {
            id = 'pc_' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
            GM_setValue(SYNC_PC_ID_KEY, id);
        }
        return id;
    }

    function migrateLocalOnlyStatsIfNeeded() {
        if (GM_getValue(LOCAL_ALL_TIME_STATS_KEY) === undefined) {
            const existingAll = GM_getValue(ALL_TIME_STATS_KEY);
            if (existingAll) GM_setValue(LOCAL_ALL_TIME_STATS_KEY, existingAll);
        }
        if (GM_getValue(LOCAL_SHIFT_STATS_KEY) === undefined) {
            const existingShift = GM_getValue(SHIFT_STATS_KEY);
            if (existingShift) GM_setValue(LOCAL_SHIFT_STATS_KEY, existingShift);
        }
    }

    function openSyncDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(SYNC_DB_NAME, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(SYNC_STORE_NAME)) {
                    req.result.createObjectStore(SYNC_STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbSaveDirHandle(handle) {
        const db = await openSyncDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
            tx.objectStore(SYNC_STORE_NAME).put(handle, SYNC_HANDLE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbLoadDirHandle() {
        try {
            const db = await openSyncDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(SYNC_STORE_NAME, 'readonly');
                const req = tx.objectStore(SYNC_STORE_NAME).get(SYNC_HANDLE_KEY);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch { return null; }
    }

    async function idbClearDirHandle() {
        try {
            const db = await openSyncDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
                tx.objectStore(SYNC_STORE_NAME).delete(SYNC_HANDLE_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch {}
    }

    function mergeStaffMaps(pcsData, statType, currentShiftId) {
        const mergedByNorm = {};
        const displayNameByNorm = {};
        Object.values(pcsData || {}).forEach(pc => {
            if (!pc || typeof pc !== 'object') return;
            if (statType === 'shift' && pc.shiftId !== currentShiftId) return;
            const map = pc[statType] || {};
            Object.entries(map).forEach(([rawStaff, data]) => {
                const cleanStaff = normalizeStaffName(rawStaff);
                if (!cleanStaff || !data || typeof data !== 'object') return;
                const normKey = cleanStaff.toLowerCase();
                if (!displayNameByNorm[normKey]) displayNameByNorm[normKey] = cleanStaff;
                mergedByNorm[normKey] ||= { tests: 0, samples: 0, barcodes: [] };
                mergedByNorm[normKey].tests += Number(data.tests) || 0;
                mergedByNorm[normKey].samples += Number(data.samples) || 0;
                const seen = new Map();
                mergedByNorm[normKey].barcodes.forEach(b => {
                    const id = normalizeBarcode(typeof b === 'string' ? b : b.id);
                    const ts = (b && typeof b === 'object' && b.ts) ? b.ts : 0;
                    if (id) seen.set(id, Math.max(seen.get(id) || 0, ts));
                });
                (data.barcodes || []).forEach(b => {
                    const id = normalizeBarcode(typeof b === 'string' ? b : b.id);
                    const ts = (b && typeof b === 'object' && b.ts) ? b.ts : 0;
                    if (id) seen.set(id, Math.max(seen.get(id) || 0, ts));
                });
                mergedByNorm[normKey].barcodes = Array.from(seen.entries()).map(([id, ts]) => ({ id, ts }));
            });
        });
        const merged = {};
        Object.entries(mergedByNorm).forEach(([normKey, val]) => {
            merged[displayNameByNorm[normKey]] = val;
        });
        return merged;
    }

    function updateReconnectPill() {
        const existing = document.getElementById(SYNC_RECONNECT_ID);
        if (syncPermissionState !== 'prompt' || !cachedDirHandle) {
            existing?.remove();
            return;
        }
        const badge = document.getElementById(BADGE_ID);
        if (!badge || !badge.parentElement) return;
        if (!existing) {
            const btn = document.createElement('button');
            btn.id = SYNC_RECONNECT_ID;
            btn.type = 'button';
            btn.textContent = '📁 Reconnect Sync';
            btn.title = 'Click once to re-authorize access to your shared sync folder after browser restart';
            btn.addEventListener('click', () => reconnectSyncFolder(true));
            badge.insertAdjacentElement('afterend', btn);
        }
    }

    function startSyncPolling() {
        if (syncIntervalId) clearInterval(syncIntervalId);
        syncIntervalId = setInterval(() => {
            if (!document.hidden && syncPermissionState === 'granted' && !isPopupHovered()) {
                syncWithDirectory(false);
            }
        }, SYNC_INTERVAL_MS);
    }

    async function syncWithDirectory(showFeedback = false) {
        if (!cachedDirHandle || syncInProgress) return false;
        if (!showFeedback && isPopupHovered()) return false;
        syncInProgress = true;
        try {
            const perm = await cachedDirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                syncPermissionState = 'prompt';
                updateReconnectPill();
                return false;
            }
            syncPermissionState = 'granted';
            updateReconnectPill();

            checkAndResetShift(false);
            const pcId = getSyncPcId();
            const currentShiftId = getCurrentShiftId();
            const payload = {
                pcId,
                shiftId: currentShiftId,
                updatedAt: Date.now(),
                shift: loadStats(LOCAL_SHIFT_STATS_KEY),
                allTime: loadStats(LOCAL_ALL_TIME_STATS_KEY)
            };

            const fileHandle = await cachedDirHandle.getFileHandle(`${pcId}.json`, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(payload));
            await writable.close();

            const allPcs = {};
            for await (const [name, handle] of cachedDirHandle.entries()) {
                if (handle.kind !== 'file' || !name.endsWith('.json')) continue;
                try {
                    const file = await handle.getFile();
                    const text = await file.text();
                    if (!text) continue;
                    const parsed = JSON.parse(text);
                    if (parsed && typeof parsed === 'object' && parsed.pcId) allPcs[name] = parsed;
                } catch {}
            }

            if (Object.keys(allPcs).length > 0) {
                saveStats(SHIFT_STATS_KEY, mergeStaffMaps(allPcs, 'shift', currentShiftId));
                saveStats(ALL_TIME_STATS_KEY, mergeStaffMaps(allPcs, 'allTime', currentShiftId));
                updateInlineBadge(true);
                if (document.getElementById(POPUP_ID) && !isPopupHovered()) showPopup(true);
            }
            if (showFeedback) showToastNotification(`Synced with ${Object.keys(allPcs).length} PC file(s) in "${cachedDirHandle.name}".`, 'success');
            return true;
        } catch (err) {
            console.warn('[Staff Sync] Directory sync error:', err);
            if (showFeedback) showToastNotification('Sync failed: ' + (err?.message || err), 'error');
            return false;
        } finally {
            syncInProgress = false;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && syncPermissionState === 'granted' && !isPopupHovered()) {
            syncWithDirectory(false);
        }
    });

    async function linkSyncFolder() {
        if (typeof window.showDirectoryPicker !== 'function') {
            showToastNotification('File System Access API is not supported in this browser.', 'error');
            return false;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await idbSaveDirHandle(handle);
            cachedDirHandle = handle;
            syncPermissionState = 'granted';
            updateReconnectPill();
            startSyncPolling();
            await syncWithDirectory(true);
            return true;
        } catch (err) {
            if (err?.name !== 'AbortError') showToastNotification('Could not link folder: ' + (err?.message || err), 'error');
            return false;
        }
    }

    async function reconnectSyncFolder(showFeedback = true) {
        if (!cachedDirHandle) return false;
        try {
            const perm = await cachedDirHandle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                syncPermissionState = 'granted';
                updateReconnectPill();
                startSyncPolling();
                await syncWithDirectory(showFeedback);
                return true;
            }
            syncPermissionState = 'prompt';
            updateReconnectPill();
            return false;
        } catch (err) {
            if (showFeedback) showToastNotification('Reconnect failed: ' + (err?.message || err), 'error');
            return false;
        }
    }

    async function unlinkSyncFolder() {
        await idbClearDirHandle();
        cachedDirHandle = null;
        syncPermissionState = 'unlinked';
        if (syncIntervalId) { clearInterval(syncIntervalId); syncIntervalId = null; }
        updateReconnectPill();
        showToastNotification('Sync folder unlinked.', 'info');
    }

    let autoReconnectArmed = false;
    function armAutoReconnectOnGesture() {
        if (autoReconnectArmed || syncPermissionState !== 'prompt' || !cachedDirHandle) return;
        autoReconnectArmed = true;
        const onFirstGesture = (e) => {
            if (e.target?.closest?.('#' + SYNC_RECONNECT_ID)) return;
            document.removeEventListener('pointerdown', onFirstGesture, true);
            document.removeEventListener('keydown', onFirstGesture, true);
            if (syncPermissionState === 'prompt' && cachedDirHandle) {
                reconnectSyncFolder(false);
            }
        };
        document.addEventListener('pointerdown', onFirstGesture, true);
        document.addEventListener('keydown', onFirstGesture, true);
    }

    async function initDirectorySync() {
        migrateLocalOnlyStatsIfNeeded();
        const handle = await idbLoadDirHandle();
        if (!handle) { syncPermissionState = 'unlinked'; return; }
        cachedDirHandle = handle;
        try {
            const perm = await handle.queryPermission({ mode: 'readwrite' });
            syncPermissionState = perm === 'granted' ? 'granted' : 'prompt';
            updateReconnectPill();
            if (syncPermissionState === 'granted') {
                startSyncPolling();
                syncWithDirectory(false);
            } else {
                armAutoReconnectOnGesture();
            }
        } catch {
            syncPermissionState = 'prompt';
            updateReconnectPill();
            armAutoReconnectOnGesture();
        }
    }

    function captureTableSaveSnapshot() {
        const staffName = getStaffNameFromPage();
        const tbody = document.querySelector('tbody[formarrayname="TubeTypeList"]');
        if (!tbody) return null;

        let bcCol = -1, testCol = -1;
        const table = tbody.closest('table');
        if (table) {
            const ths = table.querySelectorAll('th');
            for (let i = 0; i < ths.length; i++) {
                const th = ths[i];
                const tId = th.getAttribute('translateid') || '';
                const txt = th.textContent.trim().toLowerCase();
                if (tId === 'sample-receive.Barcode' || txt === 'barcode') bcCol = i;
                if (tId === 'sample-receive.TestIDAndAbbreviation' || txt.includes('test')) testCol = i;
            }
        }

        let totalTests = 0;
        const extractedBarcodes = [];
        const uniqueBarcodesList = [];
        const seenBarcodes = new Set();

        const rows = tbody.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let tds = null;

            let testsText = '';
            const tArea = row.querySelector('textarea[formcontrolname="TestDetails"], input[formcontrolname="TestIDAndAbbreviation"]');
            if (tArea) {
                testsText = (tArea.value || tArea.getAttribute('value') || '').trim();
            } else if (testCol !== -1) {
                tds = row.querySelectorAll('td');
                if (tds.length > testCol) testsText = tds[testCol].textContent.trim();
            }
            totalTests += parseTests(testsText).length || (testsText ? 1 : 0);

            let bcVal = '';
            const bcIn = row.querySelector('input[formcontrolname="Barcode"], input[formcontrolname="TubeBarcode"], input[formcontrolname="SampleBarcode"], input[formcontrolname="BatchBarcode"], input[id*="barcode" i]');
            if (bcIn) {
                bcVal = (bcIn.value || bcIn.getAttribute('value') || '').trim();
            } else if (bcCol !== -1) {
                if (!tds) tds = row.querySelectorAll('td');
                if (tds.length > bcCol) bcVal = tds[bcCol].textContent.trim();
            }

            if (bcVal && /^[A-Za-z0-9-]{4,25}$/.test(bcVal)) {
                extractedBarcodes.push(bcVal);
                if (!seenBarcodes.has(bcVal)) {
                    seenBarcodes.add(bcVal);
                    uniqueBarcodesList.push(bcVal);
                }
            }
        }

        return {
            staffName,
            totalTests,
            extractedBarcodes,
            uniqueBarcodesList,
            rowCount: rows.length,
            currentSamples: getSamplesCountFromPage()
        };
    }

    function countAndCreditFromSnapshot(snapshot) {
        checkAndResetShift();
        if (!snapshot || !snapshot.staffName) return false;

        const now = Date.now();
        let { staffName, totalTests, extractedBarcodes, currentSamples } = snapshot;
        if (totalTests <= 0 && extractedBarcodes.length > 0) totalTests = extractedBarcodes.length;
        if (totalTests <= 0) return false;

        const currentShiftId = getCurrentShiftId();
        const fingerprint = buildCreditFingerprint(staffName, extractedBarcodes, totalTests);
        const processedRecords = pruneProcessedRecords(loadProcessedRecords(), currentShiftId);

        if (processedRecords[fingerprint]) {
            console.log('[Staff Counter] Duplicate save ignored:', fingerprint);
            const live = getSamplesCountFromPage();
            if (live !== null) lastSampleCountSeen = live;
            return false;
        }

        const liveSamples = getSamplesCountFromPage();
        const samplesNow = liveSamples !== null ? liveSamples : currentSamples;
        let domDelta = 0;
        if (samplesNow !== null && samplesNow !== undefined) {
            domDelta = lastSampleCountSeen === null ? 0 : Math.max(0, samplesNow - lastSampleCountSeen);
            lastSampleCountSeen = samplesNow;
        }

        const uniqueBarcodes = new Set(extractedBarcodes.map(normalizeBarcode).filter(Boolean));
        const sampleDelta = uniqueBarcodes.size || (domDelta > 0 ? domDelta : 1);

        const credited = addTestsForStaff(staffName, totalTests, sampleDelta, extractedBarcodes);
        if (!credited) return false;

        processedRecords[fingerprint] = {
            shiftId: currentShiftId,
            staffName,
            testCount: totalTests,
            sampleCount: sampleDelta,
            barcodes: [...uniqueBarcodes],
            creditedAt: now
        };
        saveProcessedRecords(processedRecords);
        showPopup();
        return true;
    }

    window.enhancedGrid = window.enhancedGrid || {};
    window.enhancedGrid.captureTableSaveSnapshot = captureTableSaveSnapshot;
    window.enhancedGrid.countAndCreditFromSnapshot = countAndCreditFromSnapshot;
    window.enhancedGrid.updateInlineBadge = updateInlineBadge;
    window.enhancedGrid.getCurrentShiftId = getCurrentShiftId;
    window.enhancedGrid.getSamplesCountFromPage = getSamplesCountFromPage;

    function configureBadge(badge) {
        badge.id = BADGE_ID;
        badge.style.cssText = 'display:inline-flex; align-items:center; gap:8px; flex-shrink:0; padding:4px 14px; background:linear-gradient(135deg,#10b981 0,#059669 100%); color:#fff; border-radius:20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; font-size:12px; white-space:nowrap; margin:0 12px; box-shadow:0 4px 12px rgba(16,185,129,.3); border:1px solid rgba(255,255,255,.2); transition:transform .2s ease,box-shadow .2s ease; cursor:pointer;';
        badge.classList.toggle(HIDDEN_CLASS, !isBadgeVisible());
        badge.addEventListener('click', () => {
            showPopup();
            if (syncPermissionState === 'granted' && !isPopupHovered()) syncWithDirectory(false);
        });
        badge.addEventListener('mouseenter', function () { this.style.transform = 'translateY(-1px)'; this.style.boxShadow = '0 6px 16px rgba(16,185,129,.4)'; });
        badge.addEventListener('mouseleave', function () { this.style.transform = 'translateY(0)'; this.style.boxShadow = '0 4px 12px rgba(16,185,129,.3)'; });
        return badge;
    }

    function updateInlineBadge(force) {
        const staffName = getStaffNameFromPage();
        let badge = document.getElementById(BADGE_ID);
        if (!staffName) { badge?.remove(); return; }
        if (!force && badge && staffName === lastDisplayedStaff) { applyBadgeVisibility(); return; }

        lastDisplayedStaff = staffName;
        const profileWrapper = document.querySelector('.profile-wrapper');
        const staffInput = document.querySelector('input[formcontrolname="receiverStaffName"]');

        if (!badge && profileWrapper) {
            badge = configureBadge(document.createElement('span'));
            profileWrapper.insertAdjacentElement('afterend', badge);
        } else if (!badge && staffInput) {
            const parent = staffInput.parentElement;
            if (parent && getComputedStyle(parent).display !== 'flex') { parent.style.display = 'flex'; parent.style.alignItems = 'center'; parent.style.gap = '8px'; }
            badge = configureBadge(document.createElement('span'));
            staffInput.insertAdjacentElement('afterend', badge);
        }
        if (!badge) return;

        const data = getStaffStat(loadStats(SHIFT_STATS_KEY), staffName);
        badge.innerHTML = `<span style="display:flex;align-items:baseline;gap:4px;"><span style="font-size:14px;font-weight:800;letter-spacing:-.5px;">${Number(data.tests) || 0}</span><span style="font-size:11px;font-weight:500;opacity:.9;text-transform:uppercase;letter-spacing:.5px;">tests</span></span><span style="width:1px;height:12px;background:#fff;opacity:.3;margin:0 2px;"></span><span style="display:flex;align-items:baseline;gap:4px;"><span style="font-size:14px;font-weight:800;letter-spacing:-.5px;">${Number(data.samples) || 0}</span><span style="font-size:11px;font-weight:500;opacity:.9;text-transform:uppercase;letter-spacing:.5px;">samples</span></span>`;
        badge.title = `${staffName} current shift total: ${Number(data.tests) || 0} tests across ${Number(data.samples) || 0} samples. Click to view persistent statistics.`;
        applyBadgeVisibility();
    }

    function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

    function showPopup(preserveTab = false) {
        if (!isBadgeVisible()) return;
        const prevPopup = document.getElementById(POPUP_ID);
        const activeTabName = preserveTab && prevPopup
            ? (prevPopup.querySelector('.staff-popup-tab.active')?.dataset.staffTab || 'shift')
            : 'shift';
        prevPopup?.remove();
        isStaffPopupHovered = false;

        const currentStaffName = getStaffNameFromPage();
        const buildRows = (statsKey, emptyMessage) => {
            const entries = Object.entries(loadStats(statsKey)).sort((a, b) => (b[1].tests || 0) - (a[1].tests || 0));
            const isAllTime = statsKey === ALL_TIME_STATS_KEY;
            return entries.length ? entries.map(([name, values]) => {
                const isCurrent = currentStaffName && normalizeStaffName(name).toLowerCase() === currentStaffName.toLowerCase();
                const lastScanTs = getLastScan(values.barcodes);
                const lastScanStr = lastScanTs ? `<div style="font-size:9.5px; font-weight:600; color:#888; margin-top:3px; letter-spacing:0.2px;">⌚ ${formatTime(lastScanTs, isAllTime)}</div>` : '';
                return `<tr style="${isCurrent ? 'background:linear-gradient(90deg,rgba(16,185,129,.15),rgba(5,150,105,.05));border-left:3px solid #10b981;' : ''}"><td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-weight:${isCurrent ? 800 : 500};color:${isCurrent ? '#059669' : '#444'};">${escapeHtml(name)}${isCurrent ? '<span style="font-size:9px;background:#10b981;color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px;">YOU</span>' : ''}${lastScanStr}</td><td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#10b981;vertical-align:top;">${Number(values.tests) || 0}</td><td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#059669;vertical-align:top;">${Number(values.samples) || 0}</td></tr>`;
            }).join('') : `<tr><td colspan="3" style="padding:12px;color:#999;text-align:center;font-style:italic;">${emptyMessage}</td></tr>`;
        };

        const allTimeRows = buildRows(ALL_TIME_STATS_KEY, 'No persistent statistics yet...');
        const shiftRows = buildRows(SHIFT_STATS_KEY, 'No current-shift statistics yet...');
        const currentShiftLabel = getCurrentShiftId().replace('_', ' · ').replace(/^\d{4}-\d{2}-\d{2}/, match => { const [year, month, day] = match.split('-'); return `${day}/${month}/${year}`; });
        const showAllTime = activeTabName === 'alltime';

        const popup = document.createElement('div');
        popup.id = POPUP_ID;
        popup.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:999999; background:rgba(255,255,255,.98); backdrop-filter:blur(10px); border:1px solid rgba(0,0,0,.08); border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.05); padding:16px 20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; min-width:280px; max-width:340px; animation:staffPopupFadeIn .4s cubic-bezier(.16,1,.3,1);';
        popup.innerHTML = `
            <style>
                @keyframes staffPopupFadeIn { from { opacity:0; transform:translateY(20px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
                @keyframes staffPopupFadeOut { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(.95); } }
                .staff-popup-tab { border:0; background:transparent; color:#94a3b8; cursor:pointer; padding:7px 8px; font-size:11px; font-weight:800; border-radius:8px; transition:all .2s ease; white-space:nowrap; }
                .staff-popup-tab:hover { background:#f1f5f9; color:#475569; }
                .staff-popup-tab.active { color:#fff; background:linear-gradient(135deg,#10b981,#059669); box-shadow:0 3px 8px rgba(16,185,129,.25); }
                .staff-popup-panel { display:none; }
                .staff-popup-panel.active { display:block; }
                #staffPopupClose { border:0; background:#f1f5f9; color:#64748b; width:22px; height:22px; line-height:20px; border-radius:50%; cursor:pointer; font-size:15px; font-weight:800; padding:0; flex-shrink:0; }
                #staffPopupClose:hover { background:#fee2e2; color:#b91c1c; }
            </style>
            <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-weight:800;font-size:14px;color:#111;letter-spacing:-.5px;">Staff Statistics</span>
                <div style="display:flex;gap:4px;align-items:center;">
                    <div style="display:flex;gap:4px;background:#f1f5f9;padding:3px;border-radius:10px;">
                        <button type="button" class="staff-popup-tab ${showAllTime ? 'active' : ''}" data-staff-tab="alltime">ALL TIME</button>
                        <button type="button" class="staff-popup-tab ${showAllTime ? '' : 'active'}" data-staff-tab="shift">CURRENT SHIFT</button>
                    </div>
                    <button type="button" id="staffPopupClose" title="Close">×</button>
                </div>
            </div>
            <div id="staffPopupAllTimePanel" class="staff-popup-panel ${showAllTime ? 'active' : ''}"><div style="font-size:10px;color:#10b981;font-weight:700;margin:-3px 0 8px;">Persistent Staff Stats</div><div style="max-height:250px;overflow-y:auto;padding-right:4px;margin-bottom:4px;"><table style="width:100%;border-collapse:collapse;"><thead style="position:sticky;top:0;background:rgba(255,255,255,.98);z-index:2;"><tr><th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Staff</th><th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Tests</th><th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Samples</th></tr></thead><tbody>${allTimeRows}</tbody></table></div></div>
            <div id="staffPopupShiftPanel" class="staff-popup-panel ${showAllTime ? '' : 'active'}"><div style="font-size:10px;color:#2563eb;font-weight:700;margin:-3px 0 8px;">Current Shift: ${escapeHtml(currentShiftLabel)}</div><div style="max-height:250px;overflow-y:auto;padding-right:4px;margin-bottom:4px;"><table style="width:100%;border-collapse:collapse;"><thead style="position:sticky;top:0;background:rgba(255,255,255,.98);z-index:2;"><tr><th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Staff</th><th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Tests</th><th style="text-align:right;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;border-bottom:2px solid #eee;">Samples</th></tr></thead><tbody>${shiftRows}</tbody></table></div></div>
            <div id="staffPopupTimer" style="margin-top:12px;font-size:11px;font-weight:500;color:#aaa;text-align:right;">Closing in ${POPUP_CLOSE_SECONDS}s...</div>
        `;
        document.body.appendChild(popup);

        const tabs = popup.querySelectorAll('.staff-popup-tab'), allTimePanel = popup.querySelector('#staffPopupAllTimePanel'), shiftPanel = popup.querySelector('#staffPopupShiftPanel');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const isAllTime = tab.dataset.staffTab === 'alltime';
                tabs.forEach(button => button.classList.toggle('active', button.dataset.staffTab === tab.dataset.staffTab));
                allTimePanel.classList.toggle('active', isAllTime); shiftPanel.classList.toggle('active', !isAllTime);
            });
        });

        let seconds = POPUP_CLOSE_SECONDS, countdownInterval = null, isClosing = false;
        function updatePopupTimer() { const timer = popup.querySelector('#staffPopupTimer'); if (timer) timer.textContent = isStaffPopupHovered ? `Paused — closing in ${seconds}s...` : `Closing in ${seconds}s...`; }
        function stopCountdown() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } }
        function closePopup(force) {
            if (isClosing || (isStaffPopupHovered && !force) || !popup.isConnected) return;
            isClosing = true; isStaffPopupHovered = false; stopCountdown();
            if (force) { popup.remove(); return; }
            popup.style.animation = 'staffPopupFadeOut .3s ease-in'; setTimeout(() => popup.remove(), 300);
        }
        function startPopupCountdown() {
            if (isClosing || isStaffPopupHovered || countdownInterval) return;
            updatePopupTimer();
            countdownInterval = setInterval(() => {
                if (isStaffPopupHovered || isClosing) return;
                seconds -= 1; updatePopupTimer();
                if (seconds <= 0) { stopCountdown(); closePopup(); }
            }, 1000);
        }
        function pausePopupCountdown() { isStaffPopupHovered = true; stopCountdown(); updatePopupTimer(); }
        function resumePopupCountdown() { isStaffPopupHovered = false; if (seconds <= 0) closePopup(); else startPopupCountdown(); }

        popup.querySelector('#staffPopupClose').addEventListener('click', () => closePopup(true));
        popup.addEventListener('mouseenter', pausePopupCountdown);
        popup.addEventListener('mouseleave', resumePopupCountdown);
        startPopupCountdown();
    }

    function downloadStats() {
        const exportData = { exportedAt: new Date().toISOString(), application: 'Unified Lab Assistant – Staff Counter', scope: 'Persistent staff statistics', statistics: loadStats(ALL_TIME_STATS_KEY) };
        const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `lab-staff-stats-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function showToastNotification(message, type = 'info') {
        const existing = document.getElementById('lab-toast-msg');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'lab-toast-msg';
        const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
        toast.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:1000005; background:${bg}; color:#fff; padding:10px 18px; border-radius:8px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; font-weight:700; box-shadow:0 8px 20px rgba(0,0,0,0.2); white-space:pre-line; text-align:center; pointer-events:none;`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    function openResetModal() {
        document.getElementById(RESET_MODAL_ID)?.remove();
        const stats = loadStats(ALL_TIME_STATS_KEY);
        const totals = Object.values(stats).reduce((res, item) => { res.tests += Number(item.tests) || 0; res.samples += Number(item.samples) || 0; return res; }, { tests: 0, samples: 0 });

        const pcId = getSyncPcId();
        const folderName = cachedDirHandle ? escapeHtml(cachedDirHandle.name) : '';
        const syncStatusText = syncPermissionState === 'granted'
            ? `🟢 Connected to folder: "${folderName}" (PC ID: ${escapeHtml(pcId)})`
            : syncPermissionState === 'prompt'
                ? `🟠 Folder "${folderName}" needs 1-click reconnect (PC ID: ${escapeHtml(pcId)})`
                : `⚪ Not linked to a shared sync folder (PC ID: ${escapeHtml(pcId)})`;

        const modal = document.createElement('div');
        modal.id = RESET_MODAL_ID;
        modal.innerHTML = `
            <div class="staff-reset-dialog" role="dialog" aria-modal="true">
                <div class="staff-reset-header">Manage Persistent Staff Statistics</div>
                <div class="staff-reset-body">
                    <p>Statistics are retained until you delete them manually. Save a backup to your PC before deletion if needed.</p>
                    <div class="staff-reset-summary"><strong>${Object.keys(stats).length}</strong> staff member(s) · <strong>${totals.tests}</strong> tests · <strong>${totals.samples}</strong> samples</div>
                    <div class="staff-sync-box">
                        <div class="staff-sync-status">${syncStatusText}</div>
                        <div class="staff-sync-actions">
                            <button type="button" class="staff-sync-link">${cachedDirHandle ? 'Change Sync Folder' : '📁 Link Sync Folder'}</button>
                            ${syncPermissionState === 'prompt' ? '<button type="button" class="staff-sync-reconnect">🔓 Reconnect</button>' : ''}
                            ${syncPermissionState === 'granted' ? '<button type="button" class="staff-sync-now">🔄 Sync Now</button>' : ''}
                            ${cachedDirHandle ? '<button type="button" class="staff-sync-unlink">Unlink</button>' : ''}
                        </div>
                    </div>
                </div>
                <div class="staff-reset-footer"><button type="button" class="staff-reset-cancel">Cancel</button><button type="button" class="staff-reset-sync" title="Fix visual sample counts using saved barcode history">Auto-Fix Sample Counts</button><button type="button" class="staff-reset-export">Save Stats to PC</button><button type="button" class="staff-reset-confirm" data-confirm-step="0">Delete All Stats</button></div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.staff-sync-link')?.addEventListener('click', async () => { if (await linkSyncFolder()) { modal.remove(); openResetModal(); } });
        modal.querySelector('.staff-sync-reconnect')?.addEventListener('click', async () => { if (await reconnectSyncFolder(true)) { modal.remove(); openResetModal(); } });
        modal.querySelector('.staff-sync-now')?.addEventListener('click', () => syncWithDirectory(true));
        modal.querySelector('.staff-sync-unlink')?.addEventListener('click', async () => { await unlinkSyncFolder(); modal.remove(); openResetModal(); });

        modal.querySelector('.staff-reset-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.staff-reset-sync').addEventListener('click', () => {
            const res = recalculateSampleCounts();
            showToastNotification(`Analysis complete! Fixed ${res.shiftFixes} shift & ${res.allTimeFixes} all-time records (+${res.allTimeAdjustments} samples).`, 'success');
            updateInlineBadge(true); modal.remove(); if (document.getElementById(POPUP_ID) && !isPopupHovered()) showPopup(true);
            syncWithDirectory(false);
        });
        modal.querySelector('.staff-reset-export').addEventListener('click', downloadStats);

        const confirmBtn = modal.querySelector('.staff-reset-confirm');
        confirmBtn.addEventListener('click', () => {
            if (confirmBtn.dataset.confirmStep === '0') {
                confirmBtn.dataset.confirmStep = '1';
                confirmBtn.textContent = 'Click Again to Confirm Delete';
                confirmBtn.style.background = '#991b1b';
                return;
            }
            saveStats(ALL_TIME_STATS_KEY, {}); saveStats(SHIFT_STATS_KEY, {});
            saveStats(LOCAL_ALL_TIME_STATS_KEY, {}); saveStats(LOCAL_SHIFT_STATS_KEY, {});
            saveProcessedRecords({});
            GM_deleteValue(SHIFT_ID_KEY); localStorage.removeItem(SHIFT_ID_KEY);
            lastDisplayedStaff = null; lastSampleCountSeen = getSamplesCountFromPage();
            isStaffPopupHovered = false;
            updateInlineBadge(true); document.getElementById(POPUP_ID)?.remove(); modal.remove();
            syncWithDirectory(false);
            showToastNotification('All persistent statistics deleted.', 'info');
        });
        modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
    }

    function init() {
        checkAndResetShift(false); recalculateSampleCounts(); lastSampleCountSeen = getSamplesCountFromPage();
        updateInlineBadge(true); applyBadgeVisibility();
        initDirectorySync();
        console.log('[Staff Counter] Ready. Ctrl+Shift+F4 toggles badge. Ctrl+Delete manages stats & folder sync.');
    }
    setTimeout(init, 500);

})();

(function() {
    'use strict';
    window.enhancedGrid = window.enhancedGrid || {};
    window.enhancedGrid.summaryPopulated = false;

    GM_addStyle(`
        @font-face { font-family: 'FontAwesome'; font-style: normal; font-weight: 900; font-display: block; src: url(https://his.kaauh.org/lab/fontawesome-webfont.af7ae505a9eed503f8b8.woff2?v=4.7.0) format('woff2'); }
        .fa, .fas { font-family: 'FontAwesome' !important; font-weight: 900; -moz-osx-font-smoothing: grayscale; -webkit-font-smoothing: antialiased; display: inline-block; font-style: normal; font-variant: normal; text-rendering: auto; line-height: 1; }
        .fa-check-circle:before { content: "\\f058"; } .fa-star:before { content: "\\f005"; } .fa-arrow-circle-up:before { content: "\\f0aa"; } .fa-arrow-circle-down:before { content: "\\f0ab"; } .fa-arrow-circle-right:before { content: "\\f0a9"; }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] { width: 100% !important; display: flex !important; flex-wrap: nowrap !important; padding: 0 !important; margin: 0 !important; }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] > li { flex: 1 1 0 !important; display: flex !important; float: none !important; margin-bottom: -1px; }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] > li > a { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100% !important; text-align: center !important; white-space: nowrap !important; margin: 0 !important; }
        ul.nav.nav-tabs.tab-container.widget-tabs[role="tablist"] > li > a > span { display: inline-block !important; text-align: center !important; }
        .rr-modal-backdrop { display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); }
        .rr-modal-content { display: flex; flex-direction: column; background-color: #f8f9fa; margin: 3% auto; padding: 22px; border: none; width: 92%; max-width: 980px; border-radius: 10px; box-shadow: 0 5px 25px rgba(0,0,0,0.35); height: 86vh; }
        .rr-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-bottom: 12px; margin-bottom: 12px; }
        .rr-modal-header h2 { margin: 0; font-size: 1.4rem; color: #343a40; font-weight: 800; }
        .rr-modal-body { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
        .rr-modal-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #dee2e6; padding-top: 12px; margin-top: 12px; }
        .rr-close-button { color: #aaa; font-size: 32px; font-weight: bold; cursor: pointer; line-height: 1; width: 32px; text-align: center; } .rr-close-button:hover { color: black; }

        /* Workbench Sample Receive Saved Batches Button & Dropdown */
        #wbSavedBatchesWrapper { position: relative; display: inline-flex; align-items: center; margin-right: 6px; vertical-align: middle; }
        #wbSavedBatchesBtn { background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%) !important; color: #ffffff !important; font-weight: 700 !important; font-size: 12.5px !important; border-radius: 6px !important; border: 1px solid #312e81 !important; padding: 6px 12px !important; box-shadow: 0 3px 8px rgba(79, 70, 229, 0.35) !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; transition: all 0.2s ease !important; height: auto !important; }
        #wbSavedBatchesBtn:hover { filter: brightness(1.1) !important; transform: translateY(-1px) !important; }
        #wbSavedBatchesBtn .wb-badge-count { background: rgba(255,255,255,0.25); padding: 1px 6px; border-radius: 10px; font-size: 11px; font-weight: 800; }
        #wbSavedBatchesMenu { display: none; position: absolute; top: calc(100% + 6px); right: 0; min-width: 310px; max-width: 380px; max-height: 340px; overflow-y: auto; background: #ffffff; border: 1px solid #c7d2fe; border-radius: 10px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22); z-index: 100050; padding: 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        #wbSavedBatchesMenu.open { display: block; }
        .wb-menu-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 6px; font-size: 11px; font-weight: 800; color: #3730a3; text-transform: uppercase; }
        .wb-menu-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 7px; cursor: pointer; transition: background 0.15s ease; border-bottom: 1px solid #f1f5f9; }
        .wb-menu-item:last-child { border-bottom: none; }
        .wb-menu-item:hover { background: #eef2ff; }
        .wb-menu-item-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
        .wb-menu-item-time { font-size: 12.5px; font-weight: 700; color: #1e1b4b; }
        .wb-menu-item-preview { font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px; }
        .wb-menu-item-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .wb-menu-item-count { background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 10px; }
        .wb-menu-empty { padding: 16px 10px; text-align: center; color: #94a3b8; font-size: 12px; font-style: italic; }

        #newBarcodeEntry { width: 100%; padding: 10px; font-size: 16px; margin-bottom: 12px; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; }
        #newBarcodeEntry:focus { border-color: #80bdff; outline: 0; box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25); }
        #rr-table-container { flex-grow: 1; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; background-color: #fff; }
        #barcodeTable { width: 100%; border-collapse: collapse; table-layout: fixed; } #barcodeTable th, #barcodeTable td { padding: 4px 15px; text-align: left; border-bottom: 1px solid #e9ecef; vertical-align: middle; }
        #barcodeTable th { background-color: #e9ecef; color: #495057; position: sticky; top: 0; z-index: 10; }
        #barcodeTable th:not(:last-child), #barcodeTable td:not(:last-child) { border-right: 1px solid #dee2e6 !important; } #barcodeTable tbody tr:nth-child(even) { background-color: #f8f9fa; }
        .rr-th-no { width: 7%; } .rr-th-barcode { width: 33%; } .rr-th-location { width: 15%; } .rr-th-status { width: 45%; }
        #barcodeTable td.status-cell { font-weight: bold; text-align: left; } #barcodeTable td.status-cell.success { text-align: center; color: green; font-size: 1.2rem; }
        .rr-counter-style { font-size: 14px; font-weight: bold; color: #555; } .rr-error-text { color: #D8000C; font-weight: bold; font-size: 13px; } .JCLRgrip { background-color: #007bff !important; width: 3px !important; z-index: 99999 !important; }
        .stream-toggle { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1px solid #ccc; border-radius: 20px; background-color: #f8f9fa; cursor: pointer; transition: all 0.3s ease; user-select: none; margin-right: 8px; }
        .stream-toggle.is-active { border-color: #ffa726; background-color: #fff3e0; animation: stream-glow 2s infinite; }
        .stream-toggle .toggle-label { font-size: 11px; font-weight: 700; color: #444; display: flex; align-items: center; gap: 4px; }
        .stream-toggle .toggle-switch { position: relative; width: 36px; height: 18px; background-color: #ccc; border-radius: 9px; transition: background-color 0.3s ease; } .stream-toggle.is-active .toggle-switch { background-color: #f57c00; }
        .stream-toggle .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background-color: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.3s ease; } .stream-toggle.is-active .toggle-thumb { transform: translateX(18px); }
        @keyframes stream-glow { 0% { box-shadow: 0 0 0 0px rgba(245, 124, 0, 0.3); } 70% { box-shadow: 0 0 0 8px rgba(245, 124, 0, 0); } 100% { box-shadow: 0 0 0 0px rgba(245, 124, 0, 0); } }
        #rapidReceiveBtn { background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%) !important; color: #ffffff !important; font-weight: bold !important; font-size: 13px !important; border-radius: 6px !important; border: 1px solid rgb(40, 94, 121) !important; padding: 6px 12px !important; box-shadow: 0 4px 10px rgba(0, 114, 255, 0.4) !important; transition: all 0.2s ease-in-out !important; cursor: pointer !important; height: auto !important; display: inline-block !important; }
        #rapidReceiveBtn:hover { transform: translateY(-1px) !important; box-shadow: 0 6px 14px rgba(0, 114, 255, 0.6) !important; filter: brightness(1.1) !important; }
        #rapidReceiveBtn:active { transform: translateY(1px) !important; box-shadow: 0 2px 5px rgba(0, 114, 255, 0.4) !important; }
        #processBarcodesBtn { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%) !important; color: #ffffff !important; font-weight: 800 !important; font-size: 14px !important; text-transform: uppercase !important; border: none !important; border-radius: 6px !important; padding: 8px 20px !important; box-shadow: 0 4px 12px rgba(56, 239, 125, 0.4) !important; transition: all 0.2s ease !important; } #processBarcodesBtn:hover:not(:disabled) { transform: translateY(-1px) !important; box-shadow: 0 6px 16px rgba(56, 239, 125, 0.6) !important; filter: brightness(1.05) !important; }
        @keyframes critical-stop-pulse { 0% { box-shadow: 0 0 0 0px rgba(255, 75, 43, 0.7); } 70% { box-shadow: 0 0 0 12px rgba(255, 75, 43, 0); } 100% { box-shadow: 0 0 0 0px rgba(255, 75, 43, 0); } }
        #stopProcessBtn { background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%) !important; color: #ffffff !important; font-weight: 900 !important; font-size: 14px !important; text-transform: uppercase !important; border: none !important; border-radius: 6px !important; padding: 8px 22px !important; animation: critical-stop-pulse 1.5s infinite !important; transition: all 0.15s ease !important; } #stopProcessBtn:hover { filter: brightness(1.1) !important; transform: scale(1.02) !important; }
        #clearBarcodesBtn { background: linear-gradient(135deg, #e65c00 0%, #f9d423 100%) !important; color: #ffffff !important; font-weight: 700 !important; font-size: 13px !important; border: none !important; border-radius: 6px !important; padding: 8px 16px !important; box-shadow: 0 4px 10px rgba(230, 92, 0, 0.3) !important; transition: all 0.2s ease !important; } #clearBarcodesBtn:hover:not(:disabled) { box-shadow: 0 6px 14px rgba(230, 92, 0, 0.4) !important; filter: brightness(1.05) !important; }
        #resetStatusBtn { background: linear-gradient(135deg, #4b6cb7 0%, #182848 100%) !important; color: #ffffff !important; font-weight: 700 !important; font-size: 13px !important; border: none !important; border-radius: 6px !important; padding: 8px 16px !important; box-shadow: 0 4px 10px rgba(75, 108, 183, 0.3) !important; transition: all 0.2s ease !important; } #resetStatusBtn:hover:not(:disabled) { box-shadow: 0 6px 14px rgba(75, 108, 183, 0.4) !important; filter: brightness(1.1) !important; }
        #test-summary-container { width: 44%; float: left; margin: 10px 5px 5px 0; background-color: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.12); display: flex; flex-direction: column; overflow: hidden; }
        .modern-summary-header { background-color: #34495e; color: white; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.3s ease, color 0.3s ease; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .modern-summary-header h2 { font-size: 14px; font-weight: 700; margin: 0; line-height: 1.2; } .header-meta { font-size: 11px; font-weight: 500; opacity: 0.9; margin-top: 2px; }
        .controls-bar { padding: 8px 10px; background: white; border-bottom: 1px solid #e0e0e0; display: flex; gap: 5px; flex-wrap: wrap; align-items: center; } .search-box { flex: 1; min-width: 150px; position: relative; } .search-box input { width: 100%; padding: 4px 8px 4px 28px; border: 2px solid #ddd; border-radius: 6px; font-size: 12px; transition: all 0.2s; } .search-box input:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); } .search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #6c757d; }
        .filter-buttons { display: flex; gap: 4px; flex-wrap: wrap; } .filter-btn { padding: 3px 6px; border: 2px solid #ddd; background: white; border-radius: 6px; font-size: 10px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px; } .filter-btn:hover { background: #f8f9fa; } .filter-btn.active { background: #3498db; color: white; border-color: #3498db; } .filter-btn .count { background: rgba(0,0,0,0.1); padding: 1px 4px; border-radius: 10px; font-size: 9px; font-weight: 600; } .filter-btn.active .count { background: rgba(255,255,255,0.2); } .filter-btn.pulse-red { background-color: #e74c3c; color: white; border-color: #e74c3c; animation: pulse-red 2s infinite; }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0px rgba(231, 76, 60, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0px rgba(231, 76, 60, 0); } }
        .table-container { flex-grow: 1; } .tests-table { width: 100%; border-collapse: collapse; } .tests-table thead { background: #f8f9fa; position: sticky; top: 0; z-index: 10; } .tests-table th { padding: 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #2c3e50; border-bottom: 2px solid #ddd; white-space: nowrap; } .tests-table th.center { text-align: center; } .tests-table th.right { text-align: right; } .tests-table tbody tr { border-bottom: 1px solid #e9ecef; } .tests-table tbody tr:not(.critical-row-high):not(.critical-row-low):hover { background-color: #f8f9fa; } .tests-table td { padding: 2px 6px; font-size: 15px; vertical-align: middle; } .test-name { font-weight: 800; color: #000000; white-space: nowrap; }
        .tests-table tbody tr.flagged-H { background: #ffe0e0; } .tests-table tbody tr.flagged-L { background: #e0f2f7; } .result-value { font-weight: 800; text-align: right; } .flag-indicator { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; font-size: 12px; font-weight: 700; color: white; } .flag-indicator.H { background: #e74c3c; } .flag-indicator.L { background: #3498db; }
        @keyframes pulse-dark-red { 0% { background-color: #c0392b; } 50% { background-color: #e74c3c; } 100% { background-color: #c0392b; } } @keyframes pulse-dark-blue { 0% { background-color: #2980b9; } 50% { background-color: #3498db; } 100% { background-color: #2980b9; } }
        .tests-table tbody tr.critical-row-high { animation: pulse-dark-red 2s infinite !important; font-weight: bold; color: #ffffff !important; } .tests-table tbody tr.critical-row-low { animation: pulse-dark-blue 2s infinite !important; font-weight: bold; color: #ffffff !important; } .tests-table tbody tr.critical-row-high *, .tests-table tbody tr.critical-row-low * { color: inherit !important; font-weight: bold; }
        .uom, .ref-range { color: #6c757d; font-size: 11px; width: 1%; white-space: nowrap; } .ref-range { text-align: center; } .status-badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 2px 5px; border-radius: 12px; font-size: 10px; font-weight: 600; min-width: 75px; text-align: center; } .status-badge.resulted { background: #fff3cd; color: #856404; } .status-badge.ordered { background: #d1ecf1; color: #0c5460; } .status-badge.verified1 { background: #d4edda; color: #155724; } .status-badge.verified2 { background: #c3e6cb; color: #0d4d1a; }
        .status-icon { width: 6px; height: 6px; border-radius: 50%; display: inline-block; } .status-icon.resulted { background: #f39c12; } .status-icon.ordered { background: #17a2b8; } .status-icon.verified1 { background: #90EE90; } .status-icon.verified2 { background: #27ae60; } .empty-state { padding: 50px 20px; text-align: center; color: #6c757d; } .summary-footer { padding: 8px 10px; background: #f8f9fa; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #6c757d; }
        .patient-type-badge { position: absolute; top: 0; left: 0; background-color: #007bff; color: white; padding: 2px 8px; font-size: 11px; font-weight: bold; border-bottom-right-radius: 8px; z-index: 5; text-transform: uppercase; } .patient-type-badge.in-patient { background-color: #d32f2f; } .patient-type-badge.out-patient { background-color: #388e3c; } .patient-img { position: relative !important; overflow: hidden; }
        .results .ag-theme-balham, .accd-details, .accd-details-table-static, .card-header { width: 50vw !important; margin-left: auto !important; margin-right: 0 !important; box-sizing: border-box; } .accd-details table, .accd-details-table-static table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; } .ag-row { transition: background-color 0.3s ease; } .ag-row.clicked-row-green .ag-cell { background-color: #20c929 !important; }
        #custom-detail-toggle-btn { font-weight: bold !important; border-radius: 4px !important; padding: 4px 14px !important; font-size: 12px !important; height: auto !important; vertical-align: middle !important; border: none !important; cursor: pointer !important; display: inline-block !important; margin-right: 8px !important; box-shadow: 0 2px 5px rgba(0,0,0,0.15) !important; transition: all 0.2s ease-in-out !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; } #custom-detail-toggle-btn:hover { transform: translateY(-1px) !important; filter: brightness(1.1) !important; }
    `);

    // ===== One-line barcode display box (High-Contrast Off-White Theme - Large Text) =====
    GM_addStyle(`
        #barcode-display-box {
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 12px !important;
            padding: 6px 14px !important;
            background: #f8fafc !important;
            color: #0f172a !important;
            border-top: 1px solid #cbd5e1 !important;
            border-bottom: 2.5px solid #d97706 !important;
            border-left: 6px solid #d97706 !important;
            box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08) !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            box-sizing: border-box !important;
        }
        #barcode-display-box > * { flex-shrink: 0; }
        #barcode-display-box > div:first-child {
            font-size: 13.5px !important;
            font-weight: 800 !important;
            color: #92400e !important;
            letter-spacing: 0.9px !important;
        }
        #barcode-value-text {
            font-size: 21px !important;
            font-weight: 900 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            letter-spacing: 1px !important;
            color: #000000 !important;
            background: #fef3c7 !important;
            border: 2px solid #d97706 !important;
            padding: 2px 11px !important;
            border-radius: 5px !important;
            line-height: 1.25 !important;
            flex-shrink: 0;
        }
        #barcode-svg, #mrn-barcode-svg {
            height: 34px !important;
            width: auto !important;
            min-width: 56px !important;
            margin: 0 !important;
            padding: 3px 8px !important;
            background: #ffffff !important;
            border-radius: 5px !important;
            border: 1.5px solid #cbd5e1 !important;
            box-sizing: border-box !important;
            flex: 0 1 auto !important;
        }
        #barcode-spacer { flex: 1 1 0 !important; min-width: 8px !important; }
        #mrn-display {
            font-size: 21px !important;
            font-weight: 900 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            color: #0f172a !important;
            background: #e2e8f0 !important;
            border: 1.5px solid #94a3b8 !important;
            padding: 3px 11px !important;
            margin: 0 !important;
            border-radius: 5px !important;
            line-height: 1.25 !important;
            flex-shrink: 0 !important;
        }
        #suite-location-display {
            font-size: 15.5px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            background: #dc2626 !important;
            border: 1.5px solid #b91c1c !important;
            padding: 3px 11px !important;
            border-radius: 5px !important;
            line-height: 1.25 !important;
            white-space: nowrap !important;
            flex: 0 1 auto !important;
            min-width: 0 !important;
            max-width: 480px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        #suite-location-display:has(.location-telephone-chip) {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
        }
        #suite-location-display .location-telephone-chip {
            font-size: 15.5px !important;
            border-radius: 6px !important;
            border: 2px solid #b91c1c !important;
            box-shadow: none !important;
        }
        #suite-location-display .loc-text {
            padding: 2px 10px !important;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
            color: #ffffff !important;
            font-weight: 800 !important;
        }
        #suite-location-display .loc-tel {
            padding: 2px 11px !important;
            gap: 6px !important;
            background: #fef3c7 !important;
            color: #0f172a !important;
            border-left: 2px solid #d97706 !important;
        }
        #suite-location-display .loc-tel::before {
            font-size: 15.5px !important;
            color: #b45309 !important;
        }
        #suite-location-display .tel-numbers {
            color: #000000 !important;
            font-weight: 900 !important;
        }
    `);

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const fireEvent = (element, eventType) => element.dispatchEvent(new Event(eventType, { bubbles: true }));
    const debounce = (func, wait) => { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; };

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '\x26amp;',
        '<': '\x26lt;',
        '>': '\x26gt;',
        '"': '\x26quot;',
        "'": '\x26#39;'
    }[c]));

    let lastSummarySignature = '';
    let columnToggleDone = false, columnToggleRunning = false;

    const wkeRegistered = new Set();
    function waitForKeyElements(selector, callback) {
        $(selector).each(function() { callback($(this)); });
        if (wkeRegistered.has(selector)) return;
        wkeRegistered.add(selector);
        const obs = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                for (const newNode of mutation.addedNodes) {
                    if (newNode.nodeType !== 1) continue;
                    const $node = $(newNode);
                    if ($node.is(selector)) callback($node);
                    else $node.find(selector).each(function() { callback($(this)); });
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    const RESULT_INPUT_SELECTOR = 'input.lo-res-edit, app-result-value-render input, div[role="gridcell"] input, input.ag-cell-edit-input, .ag-cell-inline-editing input';

    function syncWithAngular(input, value) {
        if (input.__labSyncing) return;
        input.__labSyncing = true;
        try {
            let finalValue = /^\d*\.\d+$/.test(value) ? value + '\u200B' : value;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, finalValue); else input.value = finalValue;
            ['input', 'change', 'blur'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
            try { const ng = input.__ngContext__ || window.ng?.getComponent(input); if (ng?.formControl) { ng.formControl.setValue(finalValue); ng.formControl.setErrors(null); ng.formControl.markAsDirty(); ng.formControl.markAsTouched(); ng.formControl.updateValueAndValidity(); } } catch (err) {}
        } finally {
            input.__labSyncing = false;
        }
    }

    function removeNumericRestriction(input) {
        if (!input || input.dataset.restrictionRemoved) return;
        input.dataset.restrictionRemoved = 'true';
        if (input.type === 'number') input.type = 'text';
        ['pattern', 'maxlength', 'min', 'max', 'step'].forEach(attr => input.removeAttribute(attr));
        input.addEventListener('keydown', e => { if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation(); }, true);
        input.addEventListener('keypress', e => e.stopImmediatePropagation(), true);
        input.addEventListener('paste', e => e.stopImmediatePropagation(), true);
        input.addEventListener('input', () => syncWithAngular(input, input.value), false);
    }

    function enableModalSaveButton() {
        const saveBtn = document.querySelector('button[translateid="result-confirmation.Save"]');
        if (saveBtn?.hasAttribute('disabled')) { saveBtn.removeAttribute('disabled'); saveBtn.disabled = false; saveBtn.classList.remove('disabled'); }
    }

    function unlockAgGridCells() {
        document.querySelectorAll('ag-grid-angular, .ag-root-wrapper').forEach(grid => {
            const api = grid.__agGridComp?.api || grid.agGrid?.api || grid.__ngContext__?.[8]?.api;
            const columnApi = grid.__agGridComp?.columnApi || grid.agGrid?.columnApi || grid.__ngContext__?.[8]?.columnApi;
            if (api && columnApi) {
                ['TestResult', 'testresult', 'result'].forEach(colId => {
                    const col = columnApi.getColumn(colId);
                    if (col) {
                        const colDef = col.getColDef();
                        if (colDef.editable !== true || colDef.cellEditor !== 'agTextCellEditor') { colDef.editable = true; colDef.cellEditor = 'agTextCellEditor'; colDef.valueParser = p => p.newValue; }
                    }
                });
            }
        });
    }

    // RAPID RECEIVER NATIVE + LOCAL BATCH HISTORY
    const existingBarcodes = new Set();
    const RR_BATCH_HISTORY_KEY = 'labRapidReceiverSavedBatches';
    const RR_BATCH_SHIFT_KEY = 'labRapidReceiverBatchShift';
    const MAX_SAVED_BATCHES = 20;
    let stopProcessingFlag = false;
    let isStreamModeEnabled = localStorage.getItem('labStreamModeEnabled') === 'true';

    function loadSavedBatches() {
        try {
            const legacy = localStorage.getItem(RR_BATCH_HISTORY_KEY);
            if (legacy) { if (!GM_getValue(RR_BATCH_HISTORY_KEY)) GM_setValue(RR_BATCH_HISTORY_KEY, legacy); localStorage.removeItem(RR_BATCH_HISTORY_KEY); }

            const shiftId = window.enhancedGrid.getCurrentShiftId?.();
            if (shiftId && GM_getValue(RR_BATCH_SHIFT_KEY) !== shiftId) {
                GM_setValue(RR_BATCH_SHIFT_KEY, shiftId);
                GM_deleteValue(RR_BATCH_HISTORY_KEY);
                return [];
            }

            const raw = GM_getValue(RR_BATCH_HISTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveBatchesToStorage(batches) {
        GM_setValue(RR_BATCH_HISTORY_KEY, JSON.stringify(batches.slice(0, MAX_SAVED_BATCHES)));
        renderWorkbenchBatchesUI();
    }

    function formatBatchTimestamp(ts) {
        const d = new Date(ts);
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${dateStr} · ${timeStr}`;
    }

    function saveBatchFromSnapshot(snapshot) {
        const barcodes = snapshot?.uniqueBarcodesList;
        if (!barcodes || barcodes.length === 0) return;
        const batches = loadSavedBatches();
        if (batches[0] && Array.isArray(batches[0].barcodes) && batches[0].barcodes.join('|') === barcodes.join('|')) return;
        const now = Date.now();
        batches.unshift({ id: 'saved_table_' + now, timestamp: now, source: 'Sample Receive', barcodes: barcodes });
        saveBatchesToStorage(batches);
    }

    function renderWorkbenchBatchesUI() {
        const countBadge = document.getElementById('wbSavedBatchesCount');
        const menuBody = document.getElementById('wbSavedBatchesMenuBody');
        const batches = loadSavedBatches();

        if (countBadge) countBadge.textContent = batches.length;
        if (!menuBody) return;

        if (batches.length === 0) {
            menuBody.innerHTML = `<div class="wb-menu-empty">No scanned barcode batches saved yet.</div>`;
            return;
        }

        menuBody.innerHTML = batches.map(batch => {
            const label = formatBatchTimestamp(batch.timestamp);
            const count = batch.barcodes ? batch.barcodes.length : 0;
            const preview = esc((batch.barcodes || []).join(', '));
            return `
                <div class="wb-menu-item" data-batch-id="${esc(batch.id)}" title="Click to open Rapid Receiver Plus and paste ${count} barcode(s)">
                    <div class="wb-menu-item-info">
                        <span class="wb-menu-item-time">🕒 ${label}</span>
                        <span class="wb-menu-item-preview">${preview}</span>
                    </div>
                    <div class="wb-menu-item-actions">
                        <span class="wb-menu-item-count">${count}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function restoreSavedBatch(batchId) {
        const batches = loadSavedBatches();
        const target = batches.find(b => b.id === batchId);
        if (!target || !Array.isArray(target.barcodes) || target.barcodes.length === 0) return;

        if ($('#rapidReceiveModal').length === 0) {
            injectModal();
            attachRapidReceiverEventListeners();
        }
        $('#rapidReceiveModal').show();
        $('#processBarcodesBtn, #clearBarcodesBtn, #resetStatusBtn').prop('disabled', false);
        $('#resetStatusBtn').attr('data-confirm', '0').text('Reset Status');
        $('#stopProcessBtn').hide();
        $('#processBarcodesBtn').show().text('Process');
        updateStreamUI();

        clearAllBarcodes();

        target.barcodes.forEach(code => {
            addBarcodeToTable(code, true);
        });
        updateBarcodeCount();

        $('#rr-counter').text(`Restored ${target.barcodes.length} Barcodes from ${formatBatchTimestamp(target.timestamp)}`).css('color', '#4f46e5');
        $('#newBarcodeEntry').focus();
    }

    function injectWorkbenchBatchesButton(anchorElement, insertAfter = false) {
        if (!anchorElement || document.getElementById('wbSavedBatchesWrapper')) return;
        const batches = loadSavedBatches();
        const marginLeft = insertAfter ? 'margin-left: 10px;' : 'margin-right: 6px;';
        const menuStyle = insertAfter ? 'left: 0; right: auto;' : '';

        const isSampleReceive = window.location.href.toLowerCase().includes('sample-receive') || document.getElementById('closebtn-smplrecieve');
        const displayStyle = isSampleReceive ? 'inline-block' : 'none';

        const wrapper = $(`
            <div id="wbSavedBatchesWrapper" style="${marginLeft} vertical-align: middle; display: ${displayStyle};">
                <button type="button" id="wbSavedBatchesBtn" title="View saved barcode batches and open in Rapid Receiver Plus">
                    <span>📂 Saved Barcodes</span>
                    <span class="wb-badge-count" id="wbSavedBatchesCount">${batches.length}</span>
                </button>
                <div id="wbSavedBatchesMenu" style="${menuStyle}">
                    <div class="wb-menu-header">
                        <span>Saved Barcode Batches</span>
                        <span style="color:#64748b; font-size:9px; font-weight:600; text-transform:none;">(Auto-clears each shift)</span>
                    </div>
                    <div id="wbSavedBatchesMenuBody"></div>
                </div>
            </div>
        `);

        if (insertAfter) $(anchorElement).after(wrapper);
        else $(anchorElement).before(wrapper);
        renderWorkbenchBatchesUI();
    }

    function initializeScript() {
        setupMenuNavigationObserver();
        attachBatchMenuListeners();

        waitForKeyElements("#closebtn-smplrecieve, #btnclose-smplcollection", (closeButton) => {
            if ($('#rapidReceiveModal').length === 0) { injectModal(); attachRapidReceiverEventListeners(); }

            let rapidReceiveBtn = closeButton.parent().find('#rapidReceiveBtn');
            if (rapidReceiveBtn.length === 0) {
                rapidReceiveBtn = $('<button type="button" class="btn btn-color-1" id="rapidReceiveBtn">Rapid Receiver</button>');
                rapidReceiveBtn.css('margin-right', '5px');
                closeButton.before(rapidReceiveBtn);
                closeButton.parent().off('click', '#rapidReceiveBtn').on('click', '#rapidReceiveBtn', openRapidReceiver);
            }

            if (closeButton.attr('id') === 'closebtn-smplrecieve') {
                injectWorkbenchBatchesButton(rapidReceiveBtn.length ? rapidReceiveBtn : closeButton, false);
            }
        });

        waitForKeyElements('#main-counter-tag-inline-counter-smplrecieve', (headerEl) => {
            if (document.getElementById('wbSavedBatchesWrapper')) return;
            injectWorkbenchBatchesButton(headerEl, true);
        });
    }

    let batchMenuListenersAttached = false;
    function attachBatchMenuListeners() {
        if (batchMenuListenersAttached) return;
        batchMenuListenersAttached = true;

        $('body').on('click', '#wbSavedBatchesBtn', function(e) {
            e.stopPropagation();
            renderWorkbenchBatchesUI();
            $('#wbSavedBatchesMenu').toggleClass('open');
        });

        $(document).on('click.wbBatchesClose', function(e) {
            if (!$(e.target).closest('#wbSavedBatchesWrapper').length) $('#wbSavedBatchesMenu').removeClass('open');
        });

        $('body').on('click', '.wb-menu-item', function() {
            const batchId = String($(this).attr('data-batch-id') || '');
            $('#wbSavedBatchesMenu').removeClass('open');
            if (batchId) restoreSavedBatch(batchId);
        });
    }

    let lastMenuScan = 0;
    function setupMenuNavigationObserver() {
        const now = Date.now();
        if (now - lastMenuScan < 3000) return;
        lastMenuScan = now;
        window.requestAnimationFrame(() => {
            $(".csi-menu-icon, .csi-menu-text, .icon-holder, a[href*='receive'], [title*='Receive']").each(function() {
                const $this = $(this);
                if ($this.data('navHookAttached')) return;
                const combinedText = ($this.text() + " " + ($this.attr('title') || "")).toUpperCase();
                if (combinedText.includes("RECEIVE")) {
                    $this.data('navHookAttached', true); $this.css('border-left', '3px solid #00c6ff');
                    $this.closest('a, li, span').off('click.receiverNav').on('click.receiverNav', function() {
                        window.enhancedGrid.summaryPopulated = false; setTimeout(() => { runAllUpdates(); initializeScript(); }, 400);
                    });
                }
            });
        });
    }

    function injectModal() {
        $('body').append(`
            <div id="rapidReceiveModal" class="rr-modal-backdrop">
                <div class="rr-modal-content">
                    <div class="rr-modal-header"><h2>Rapid Barcode Processor</h2><span class="rr-close-button">×</span></div>
                    <div class="rr-modal-body">
                        <input type="text" id="newBarcodeEntry" placeholder="Scan or paste barcodes here and press Enter">
                        <div id="rr-table-container"><table id="barcodeTable"><thead><tr><th class="rr-th-no">No.</th><th class="rr-th-barcode">Barcode</th><th class="rr-th-location">Location</th><th class="rr-th-status">Status</th></tr></thead><tbody id="barcodeListBody"></tbody></table></div>
                    </div>
                    <div class="rr-modal-footer"><span id="rr-counter" class="rr-counter-style">0 Barcodes Entered</span><div style="display: flex; gap: 6px; align-items: center;"><div id="streamModeToggleContainer" class="stream-toggle"><span class="toggle-label">⚡ CONTINUOUS STREAM</span><div class="toggle-switch"><div class="toggle-thumb"></div></div></div><button id="resetStatusBtn" class="btn" data-confirm="0">Reset Status</button><button id="clearBarcodesBtn" class="btn">Clear All</button><button id="stopProcessBtn" class="btn" style="display:none;">STOP</button><button id="processBarcodesBtn" class="btn">Process</button></div></div>
                </div>
            </div>`);
        setTimeout(() => { if ($.fn.colResizable) $('#barcodeTable').colResizable({ liveDrag: true, gripInnerHtml: "<div class='JCLRgrip'></div>", minWidth: 30 }); }, 100);
        updateStreamUI();
    }

    function attachRapidReceiverEventListeners() {
        $('body').off('click', '.rr-close-button').on('click', '.rr-close-button', () => $('#rapidReceiveModal').hide());
        $(window).off('click.rr-modal').on('click.rr-modal', (e) => { if ($(e.target).is('#rapidReceiveModal')) $('#rapidReceiveModal').hide(); });
        $('body').off('click', '#processBarcodesBtn').on('click', '#processBarcodesBtn', processBarcodes);
        $('body').off('click', '#clearBarcodesBtn').on('click', '#clearBarcodesBtn', () => clearAllBarcodes());
        $('body').off('click', '#stopProcessBtn').on('click', '#stopProcessBtn', () => { stopProcessingFlag = true; $('#stopProcessBtn').prop('disabled', true).text('Stopping...'); });
        $('body').off('click', '#resetStatusBtn').on('click', '#resetStatusBtn', resetStatuses);
        $('body').off('click', '#streamModeToggleContainer').on('click', '#streamModeToggleContainer', () => { isStreamModeEnabled = !isStreamModeEnabled; localStorage.setItem('labStreamModeEnabled', isStreamModeEnabled); updateStreamUI(); });
        $('body').off('keydown', '#newBarcodeEntry').on('keydown', '#newBarcodeEntry', handleBarcodeEntry);
        $('body').off('paste', '#newBarcodeEntry').on('paste', '#newBarcodeEntry', handleBarcodePaste);
    }

    function updateStreamUI() { $('#streamModeToggleContainer').toggleClass('is-active', isStreamModeEnabled); }
    function openRapidReceiver() {
        $('#rapidReceiveModal').show();
        clearAllBarcodes();
        $('#newBarcodeEntry').focus();
        $('#rr-counter').css('color', '');
        $('#processBarcodesBtn, #clearBarcodesBtn, #resetStatusBtn').prop('disabled', false);
        $('#resetStatusBtn').attr('data-confirm', '0').text('Reset Status');
        $('#stopProcessBtn').hide();
        $('#processBarcodesBtn').show().text('Process');
        updateStreamUI();
    }

    function isRapidModalOpen() {
        const modal = document.getElementById('rapidReceiveModal');
        return !!modal && getComputedStyle(modal).display !== 'none';
    }

    function clearAllBarcodes() {
        const listBody = document.getElementById('barcodeListBody');
        if (listBody) listBody.innerHTML = '';
        const entry = document.getElementById('newBarcodeEntry');
        if (entry) {
            entry.value = '';
            entry.disabled = false;
            if (isRapidModalOpen()) entry.focus();
        }
        existingBarcodes.clear();
        updateBarcodeCount();
    }

    function resetStatuses() {
        const rowCount = $('#barcodeListBody tr').length;
        if (rowCount === 0) return;
        const $btn = $('#resetStatusBtn');
        if ($btn.attr('data-confirm') === '0') {
            $btn.attr('data-confirm', '1').text('Confirm Reset?');
            setTimeout(() => { if ($btn.length) $btn.attr('data-confirm', '0').text('Reset Status'); }, 3000);
            return;
        }
        $btn.attr('data-confirm', '0').text('Reset Status');
        $('.status-cell').empty().removeClass('success');
        $('#rr-counter').text('Statuses Reset. Ready to Stream.').css('color', 'blue');
    }

    function updateBarcodeCount() { $('#rr-counter').text(`${existingBarcodes.size} Barcodes Entered`).css('color', ''); }

    function addBarcodeToTable(barcode, skipCount) {
        barcode = barcode.trim();
        if (barcode === '' || existingBarcodes.has(barcode)) return;
        existingBarcodes.add(barcode);
        const rowIndex = existingBarcodes.size - 1, rowNum = rowIndex + 1, letter = String.fromCharCode(65 + Math.floor(rowIndex / 10)), number = (rowIndex % 10) + 1, location = `${letter}${number}`;
        $('#barcodeListBody').append(`<tr><td>${rowNum}</td><td>${esc(barcode)}</td><td>${location}</td><td class="status-cell"></td></tr>`);
        if (!skipCount) updateBarcodeCount();
    }

    function handleBarcodeEntry(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const barcode = $(this).val().trim();
            if (barcode) addBarcodeToTable(barcode);
            $(this).val('').focus();
        }
    }

    function handleBarcodePaste(event) {
        event.preventDefault();
        const pastedText = (event.originalEvent || event).clipboardData.getData('text/plain');
        const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lines.forEach(line => addBarcodeToTable(line, true)); updateBarcodeCount();
        $(this).val('').focus();
    }

    async function simulateEnter(element) { const props = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }; element.dispatchEvent(new KeyboardEvent('keydown', props)); await sleep(25); element.dispatchEvent(new KeyboardEvent('keyup', props)); }

    async function processBarcodes() {
        const inputElement = document.getElementById('barcodecollection');
        if (!inputElement) {
            $('#rr-counter').text('❌ Error: Main barcode input "#barcodecollection" not found.').css('color', 'red');
            return;
        }

        const $btnProcess = $('#processBarcodesBtn'), $btnStop = $('#stopProcessBtn'), $btnClear = $('#clearBarcodesBtn'), $btnReset = $('#resetStatusBtn'), $entry = $('#newBarcodeEntry'), $counter = $('#rr-counter');
        stopProcessingFlag = false; $btnProcess.hide(); $btnStop.show().prop('disabled', false).text('STOP'); $btnClear.prop('disabled', true); $btnReset.prop('disabled', true); $entry.prop('disabled', true);

        let passIteration = 1;
        while (passIteration <= 2) {
            if (stopProcessingFlag) break;
            const rowsToProcess = Array.from(document.querySelectorAll('#barcodeListBody tr')).filter(row => { const status = row.querySelector('td.status-cell')?.textContent.trim() || ''; return passIteration === 1 ? status !== '✔️' && !status.includes('❌') : status !== '✔️'; });
            if (rowsToProcess.length === 0) break;
            if (passIteration > 1) { $counter.text(`🔄 Pass 2: Re-validating...`).css('color', '#e65c00'); await sleep(800); }

            let processedCount = 0;
            if (isStreamModeEnabled && passIteration === 1) {
                const streamPromises = [];
                for (const row of rowsToProcess) {
                    if (stopProcessingFlag) break;
                    $counter.text(`⚡ Streaming Injections: ${++processedCount} / ${rowsToProcess.length}`);
                    const barcode = row.children[1].textContent.trim();
                    const statusCell = row.querySelector('.status-cell');
                    statusCell.className = 'status-cell'; statusCell.innerHTML = '<span style="color: #ff9800;">⚡ Streaming...</span>';
                    document.querySelector('.alert-dismissable .close')?.click();
                    inputElement.value = barcode; fireEvent(inputElement, 'input'); fireEvent(inputElement, 'change');
                    await sleep(65); inputElement.focus(); await simulateEnter(inputElement);

                    streamPromises.push(new Promise(resolveItem => {
                        statusCell.innerHTML = '<span style="color: #0072ff;">⏳ Processing...</span>';
                        const startTime = Date.now(), cutoffTime = startTime + 4500, minLatencyWindow = startTime + 450;
                        const checkLifecycle = () => {
                            if (stopProcessingFlag) return resolveItem();
                            const errorAlert = document.querySelector("div.alert.alert-danger");
                            if (errorAlert && errorAlert.offsetParent !== null) {
                                statusCell.innerHTML = `<span class="rr-error-text">❌ ${esc(errorAlert.querySelector('strong')?.textContent.trim() || 'Rejected')}</span>`;
                                errorAlert.querySelector('.close')?.click(); return resolveItem();
                            }
                            if (Date.now() >= minLatencyWindow) {
                                const targetInputs = document.querySelectorAll('tbody[formarrayname="TubeTypeList"] input[formcontrolname="Barcode"], input[formcontrolname="Barcode"], input[formcontrolname="BatchBarcode"], input[formcontrolname="TubeBarcode"], #batchbarcode');
                                let settled = false; for(let i = 0; i < targetInputs.length; i++) { if(targetInputs[i].value.trim() === barcode) { settled = true; break; } }
                                if (settled) { statusCell.className = 'status-cell success'; statusCell.innerHTML = '✔️'; return resolveItem(); }
                            }
                            if (Date.now() > cutoffTime) { statusCell.innerHTML = '<span class="rr-error-text">⚠️ Timeout</span>'; return resolveItem(); }
                            setTimeout(checkLifecycle, 50);
                        };
                        setTimeout(checkLifecycle, 50);
                    }));
                    await sleep(35);
                }
                if (streamPromises.length > 0) await Promise.all(streamPromises);
                await sleep(400);
            } else {
                for (const row of rowsToProcess) {
                    if (stopProcessingFlag) break;
                    $counter.text(`Processing: ${++processedCount} / ${rowsToProcess.length}`);
                    const barcode = row.children[1].textContent.trim();
                    const statusCell = row.querySelector('.status-cell');
                    statusCell.className = 'status-cell'; statusCell.innerHTML = '<span style="color: #0072ff;">⏳ Processing...</span>';
                    document.querySelector('.alert-dismissable .close')?.click();
                    inputElement.value = barcode; fireEvent(inputElement, 'input'); fireEvent(inputElement, 'change');
                    await sleep(35); inputElement.focus(); await simulateEnter(inputElement);

                    await new Promise(resolveItem => {
                        const startTime = Date.now(), cutoffTime = startTime + 3500, minLatencyWindow = startTime + 400;
                        const checkLifecycle = () => {
                            if (stopProcessingFlag) return resolveItem();
                            const errorAlert = document.querySelector("div.alert.alert-danger");
                            if (errorAlert && errorAlert.offsetParent !== null) {
                                statusCell.innerHTML = `<span class="rr-error-text">❌ ${esc(errorAlert.querySelector('strong')?.textContent.trim() || 'Rejected')}</span>`;
                                errorAlert.querySelector('.close')?.click(); return resolveItem();
                            }
                            if (Date.now() >= minLatencyWindow) {
                                const targetInputs = document.querySelectorAll('tbody[formarrayname="TubeTypeList"] input[formcontrolname="Barcode"], input[formcontrolname="Barcode"], input[formcontrolname="BatchBarcode"], input[formcontrolname="TubeBarcode"], #batchbarcode');
                                let settled = false; for(let i = 0; i < targetInputs.length; i++) { if(targetInputs[i].value.trim() === barcode) { settled = true; break; } }
                                if (settled || inputElement.value === '') { statusCell.className = 'status-cell success'; statusCell.innerHTML = '✔️'; return resolveItem(); }
                            }
                            if (Date.now() > cutoffTime) { statusCell.innerHTML = '<span class="rr-error-text">⚠️ Timeout</span>'; return resolveItem(); }
                            setTimeout(checkLifecycle, 50);
                        };
                        setTimeout(checkLifecycle, 50);
                    });
                    await sleep(40);
                }
            }
            passIteration++;
        }
        $btnStop.hide(); $btnProcess.show().prop('disabled', false).text('Process'); $btnClear.prop('disabled', false); $btnReset.prop('disabled', false); $entry.prop('disabled', false).focus();
        if (!stopProcessingFlag) {
            const residual = document.querySelectorAll('#barcodeListBody td.status-cell');
            let count = 0; for(let i=0; i<residual.length; i++) if(residual[i].textContent.trim() !== '✔️') count++;
            $counter.text(count > 0 ? `⚠️ Finish pass: ${count} unresolved.` : '✅ Complete!').css('color', count > 0 ? 'red' : 'green');
        }
    }

    // MODERN SUMMARY
    const CONFIG = { COLUMN_PATTERNS: { TEST_DESC: ['testdesc', 'testdescription', 'name'], STATUS: ['resultstatus', 'teststatus', 'status', 'state'], RESULT_VALUE: ['testresult'], UOM: ['uom', 'uomvalue'], REFERENCE_RANGE: ['referencerange', 'range'], FLAG_CRITICAL: ['ltflag'] }};
    const testSortOrder = ['sodium (na)', 'potassium', 'chloride', 'urea (bun)', 'creatinine', 'calcium', 'phosphate (phos)', 'magnesium (mg)', 'alkaline phosphatase (alpi)', 'Alanine Amino Transferase (ALTI)', 'Aspartate Amino Transferase(AST)', 'total protein (tp)', 'albumin (alb)', 'Bilirubin - Total (TBIL)', 'Bilirubin - Direct (DBIL)', 'cholesterol', 'triglycerides', 'high density lipoprotein - hdl', 'low density lipoprotein - ldl', 'creatine kinase (ck)', 'lactate dehydrogenase (ldh)', 'troponin -i (ctn-1)', 'haemoglobin a1c (hba1c)', 'tsh (thyroid stimulating hormone)-tft', 'uric acid', 'mid stream urine'];
    function getSortIndex(testName) { const lower = testName.toLowerCase(); const idx = testSortOrder.findIndex(sn => lower.includes(sn.toLowerCase())); return idx === -1 ? Infinity : idx; }

    function parseRangeAndCompare(rangeStr, value) {
        if (!rangeStr || value === null || isNaN(parseFloat(value))) return null;
        const numVal = parseFloat(value), stdRange = rangeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (stdRange) { const lower = parseFloat(stdRange[1]), upper = parseFloat(stdRange[2]); if (numVal < lower) return 'L'; if (numVal > upper) return 'H'; }
        const ltRange = rangeStr.match(/(?:<|Less than)\s*(\d+\.?\d*)/i); if (ltRange && numVal >= parseFloat(ltRange[1])) return 'H';
        const gtRange = rangeStr.match(/(?:>|Greater than)\s*(\d+\.?\d*)/i); if (gtRange && numVal <= parseFloat(gtRange[1])) return 'L';
        return null;
    }

    function getAllTests() {
        const leftRows = document.querySelectorAll('.ag-pinned-left-cols-container .ag-row, .ag-pinned-left-row-container .ag-row'),
              centerRows = document.querySelectorAll('.ag-center-cols-container .ag-row, .ag-row-container .ag-row, .ag-center-row-container .ag-row'),
              rightRows = document.querySelectorAll('.ag-pinned-right-cols-container .ag-row, .ag-pinned-right-row-container .ag-row');

        const fallbackRows = (centerRows.length === 0) ? document.querySelectorAll('div[role="row"]') : [];
        const uniqueTests = new Map();

        if (fallbackRows.length > 0) {
            fallbackRows.forEach((row, i) => {
                let testName, status, val, range, uom, critText, iconClass;
                row.querySelectorAll('[col-id]').forEach(c => {
                    const id = c.getAttribute('col-id').toLowerCase();
                    if (CONFIG.COLUMN_PATTERNS.TEST_DESC.includes(id)) testName = c.textContent.trim();
                    else if (CONFIG.COLUMN_PATTERNS.STATUS.includes(id)) status = c.textContent.trim().toLowerCase();
                    else if (CONFIG.COLUMN_PATTERNS.RESULT_VALUE.includes(id)) val = c.textContent.trim();
                    else if (CONFIG.COLUMN_PATTERNS.REFERENCE_RANGE.includes(id)) range = c.textContent.trim();
                    else if (CONFIG.COLUMN_PATTERNS.UOM.includes(id)) uom = c.textContent.trim();
                    else if (CONFIG.COLUMN_PATTERNS.FLAG_CRITICAL.includes(id)) { const sp = c.querySelector('span.critial-alret-indication'); if (sp) { critText = sp.textContent.trim(); iconClass = c.querySelector('i.fa')?.className; } }
                });
                if (testName && !uniqueTests.has(testName)) {
                    uniqueTests.set(testName, { name: testName, status: status || 'unknown', value: val || null, uom: uom || null, range: range || null, flag: parseRangeAndCompare(range, val), criticalFlag: (critText === 'CL' || critText === 'CH') && iconClass?.includes('critical') ? { text: critText, iconClass } : null, originalIndex: i });
                }
            });
        } else {
            const maxLen = Math.max(leftRows.length, centerRows.length, rightRows.length);
            for (let i = 0; i < maxLen; i++) {
                const parts = [leftRows[i], centerRows[i], rightRows[i]].filter(Boolean);
                let testName, status, val, range, uom, critText, iconClass;
                for (const part of parts) {
                    const cells = part.querySelectorAll('[col-id]');
                    for (let j = 0; j < cells.length; j++) {
                        const c = cells[j], id = c.getAttribute('col-id').toLowerCase();
                        if (CONFIG.COLUMN_PATTERNS.TEST_DESC.includes(id)) testName = c.textContent.trim();
                        else if (CONFIG.COLUMN_PATTERNS.STATUS.includes(id)) status = c.textContent.trim().toLowerCase();
                        else if (CONFIG.COLUMN_PATTERNS.RESULT_VALUE.includes(id)) val = c.textContent.trim();
                        else if (CONFIG.COLUMN_PATTERNS.REFERENCE_RANGE.includes(id)) range = c.textContent.trim();
                        else if (CONFIG.COLUMN_PATTERNS.UOM.includes(id)) uom = c.textContent.trim();
                        else if (CONFIG.COLUMN_PATTERNS.FLAG_CRITICAL.includes(id)) { const sp = c.querySelector('span.critial-alret-indication'); if (sp) { critText = sp.textContent.trim(); iconClass = c.querySelector('i.fa')?.className; } }
                    }
                }
                if (testName) uniqueTests.set(testName, { name: testName, status: status || 'unknown', value: val || null, uom: uom || null, range: range || null, flag: parseRangeAndCompare(range, val), criticalFlag: (critText === 'CL' || critText === 'CH') && iconClass?.includes('critical') ? { text: critText, iconClass } : null, originalIndex: i });
            }
        }
        return Array.from(uniqueTests.values());
    }

    const FILTER_STORAGE_KEY = 'labSummaryFilter';
    let currentFilter = localStorage.getItem(FILTER_STORAGE_KEY) || 'all', searchTerm = '', allTestsData = [];
    function normalizeStatus(status) { const n = status.toLowerCase().replace(/\s+/g, ''); if (n.includes('verifiedlevel1') || (n.includes('verified') && n.includes('1'))) return 'verified1'; if (n.includes('verifiedlevel2') || (n.includes('verified') && n.includes('2'))) return 'verified2'; if (n === 'resulted') return 'resulted'; if (n === 'ordered') return 'ordered'; return 'default'; }
    function getStatusLabel(status) { const map = { 'verified1': 'Verified L1', 'verified2': 'Verified L2', 'resulted': 'Resulted', 'ordered': 'Ordered' }; return map[status] || status; }

    function renderModernTable() {
        const tbody = document.getElementById('modernTestsTableBody'), emptyState = document.getElementById('modernEmptyState'), tableContainer = document.querySelector('.table-container');
        if (!tbody) return;
        let filteredTests = allTestsData.filter(test => {
            if (currentFilter === 'flagged' && !test.flag && !test.criticalFlag) return false;
            if (currentFilter !== 'all' && currentFilter !== 'flagged' && normalizeStatus(test.status) !== currentFilter) return false;
            if (searchTerm && !test.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        const rowsHtml = [];
        if (filteredTests.length === 0) { emptyState.style.display = 'block'; if(tableContainer) tableContainer.querySelector('.tests-table').style.display = 'none'; }
        else {
            emptyState.style.display = 'none'; if(tableContainer) tableContainer.querySelector('.tests-table').style.display = 'table';
            filteredTests.forEach(test => {
                const statusClass = normalizeStatus(test.status);
                let criticalClass = '', valueClass = !test.criticalFlag && test.flag ? `flagged-${test.flag}` : '', flagHtml = '--';
                if (test.criticalFlag) { criticalClass = test.criticalFlag.text === 'CH' ? 'critical-row-high' : 'critical-row-low'; flagHtml = `<span class="critial-alret-indication"><i class="${esc(test.criticalFlag.iconClass)}"></i> ${test.criticalFlag.text === 'CH' ? 'CRITICAL HIGH' : 'CRITICAL LOW'}</span>`; }
                else if (test.flag) flagHtml = `<span class="flag-indicator ${test.flag}">${test.flag}</span>`;
                rowsHtml.push(`<tr class="${(valueClass + ' ' + criticalClass).trim()}"><td class="test-name" title="${esc(test.name)}">${esc(test.name.length > 30 ? test.name.substring(0, 30) + '...' : test.name)}</td><td class="result-value ${valueClass}">${esc(test.value) || '--'}</td><td class="uom">${esc(test.uom) || '--'}</td><td class="ref-range">${esc(test.range) || '--'}</td><td class="center">${flagHtml}</td><td class="center"><span class="status-badge ${statusClass}"><span class="status-icon ${statusClass}"></span> ${getStatusLabel(statusClass)}</span></td></tr>`);
            });
        }
        tbody.innerHTML = rowsHtml.join('');
        if (document.getElementById('modernDisplayInfo')) document.getElementById('modernDisplayInfo').textContent = `Showing ${filteredTests.length} of ${allTestsData.length} tests`;
    }

    function updateModernCounts() {
        const counts = { total: allTestsData.length, resulted: 0, verified1: 0, verified2: 0, flagged: 0, ordered: 0 };
        allTestsData.forEach(test => { const s = normalizeStatus(test.status); if (s === 'resulted') counts.resulted++; if (s === 'verified1') counts.verified1++; if (s === 'verified2') counts.verified2++; if (s === 'ordered') counts.ordered++; if (test.flag || test.criticalFlag) counts.flagged++; });
        const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        updateEl('modernAllCount', counts.total); updateEl('modernOrderedFilterCount', counts.ordered); updateEl('modernResultedFilterCount', counts.resulted); updateEl('modernVerified1FilterCount', counts.verified1); updateEl('modernVerified2FilterCount', counts.verified2); updateEl('modernFlaggedFilterCount', counts.flagged);
        const orderedBtn = document.querySelector('.filter-btn[data-filter="ordered"]'); if (orderedBtn) orderedBtn.classList.toggle('pulse-red', counts.ordered > 0);
        return counts;
    }

    function updateActionableHeader(counts) {
        const headerTitle = document.querySelector('.modern-summary-header h2'), headerMeta = document.querySelector('.modern-summary-header .header-meta');
        if (!headerTitle || !headerMeta) return;
        if (counts.total === 0) { headerTitle.textContent = 'UNKNOWN'; headerMeta.textContent = 'No test data loaded'; return; }
        const pendingTotal = counts.ordered + counts.resulted, totalSpan = `<span style="background-color: #000; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 16px; font-weight: bold;">TOTAL TESTS: ${counts.total}</span>`;
        if (pendingTotal > 0) { headerTitle.textContent = (counts.ordered > 0 && counts.resulted > 0) ? "ACTION REQUIRED! : Waiting for Result & Verification" : (counts.resulted > 0 ? "ACTION REQUIRED! : Verification Required" : "ACTION REQUIRED! : Waiting for Results"); headerMeta.innerHTML = pendingTotal + ' Pending | ' + totalSpan; }
        else { headerTitle.textContent = 'All Clear: No Pending Actions'; headerMeta.innerHTML = totalSpan; }
    }

    function syncHeaderColor(counts) {
        const summaryHeader = document.querySelector('.modern-summary-header');
        if (summaryHeader) { const p = counts.ordered + counts.resulted; summaryHeader.style.backgroundColor = counts.total === 0 ? '#808080' : (p > 0 ? '#f1c40f' : '#2ecc71'); summaryHeader.style.color = p > 0 ? '#2c3e50' : '#ffffff'; }
    }

    function initializeModernSummaryTable() {
        const container = document.getElementById('test-summary-container'); if (!container) return;
        lastSummarySignature = '';
        container.innerHTML = `<div class="modern-summary-header"><div class="header-info"><h2>Loading...</h2><div class="header-meta">--</div></div></div><div class="controls-bar"><div class="search-box"><span class="search-icon">🔍</span><input type="text" id="modernSearchInput" placeholder="Search tests..."></div><div class="filter-buttons"><button class="filter-btn" data-filter="all">All <span class="count" id="modernAllCount">0</span></button><button class="filter-btn" data-filter="ordered">Ordered <span class="count" id="modernOrderedFilterCount">0</span></button><button class="filter-btn" data-filter="resulted">Resulted <span class="count" id="modernResultedFilterCount">0</span></button><button class="filter-btn" data-filter="verified1">L1 <span class="count" id="modernVerified1FilterCount">0</span></button><button class="filter-btn" data-filter="verified2">L2 <span class="count" id="modernVerified2FilterCount">0</span></button><button class="filter-btn" data-filter="flagged">Flagged <span class="count" id="modernFlaggedFilterCount">0</span></button></div></div><div class="table-container"><table class="tests-table"><thead><tr><th>Test Name</th><th class="right">Result</th><th>UOM</th><th class="center">Reference Range</th><th class="center">Flag</th><th class="center">Status</th></tr></thead><tbody id="modernTestsTableBody"></tbody></table><div id="modernEmptyState" class="empty-state" style="display: none;"><div class="empty-state-icon">📋</div><p>No tests found</p></div></div><div class="summary-footer"><span id="modernDisplayInfo">Showing 0 of 0 tests</span><span>Last updated: <span id="modernLastUpdate">--</span></span></div>`;
        container.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => { currentFilter = btn.dataset.filter; localStorage.setItem(FILTER_STORAGE_KEY, currentFilter); container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderModernTable(); }));
        document.getElementById('modernSearchInput')?.addEventListener('input', e => { searchTerm = e.target.value; renderModernTable(); });
        container.querySelector(`.filter-btn[data-filter="${currentFilter}"]`)?.classList.add('active');
    }

    window.enhancedGrid.triggerSummaryUpdate = function() {
        const fresh = getAllTests();
        window.enhancedGrid.summaryPopulated = fresh.length > 0;
        const sig = JSON.stringify(fresh);
        if (sig === lastSummarySignature) return;
        lastSummarySignature = sig;
        allTestsData = fresh;
        allTestsData.sort((a, b) => { const sA = normalizeStatus(a.status), sB = normalizeStatus(b.status); if (sA === 'resulted' && sB !== 'resulted') return -1; if (sA !== 'resulted' && sB === 'resulted') return 1; const iA = getSortIndex(a.name), iB = getSortIndex(b.name); return iA === iB ? a.originalIndex - b.originalIndex : iA - iB; });
        const counts = updateModernCounts(); renderModernTable();
        const formattedTime = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        if(document.getElementById('modernLastUpdate')) document.getElementById('modernLastUpdate').textContent = formattedTime;
        updateActionableHeader(counts); syncHeaderColor(counts);
    };

    // LAYOUT & PERSISTENCE
    const GRID_WIDTH = '50vw', RESIZED_FLAG = 'data-ag-resized', CLICKED_ROW_EXPIRY_PREFIX = 'clicked_row_expiry_', CLICK_DURATION_MS = 60 * 1000;
    const BARCODE_KEY = 'selectedBarcode';

    function getRowBarcode(row) {
        let cell = row.querySelector('[col-id="barcode"]');
        if (!cell) {
            const attr = row.hasAttribute('row-id') ? 'row-id' : (row.hasAttribute('row-index') ? 'row-index' : null);
            if (attr) {
                const id = row.getAttribute(attr);
                try { cell = document.querySelector(`.ag-row[${attr}="${CSS.escape(id)}"] [col-id="barcode"]`); } catch (e) {}
            }
        }
        return cell?.textContent?.trim() || '';
    }

    function extractMrnsData(pc) {
        const mrns = {}; const mid2 = pc.querySelector('.mid2');
        if (mid2) { const p = mid2.querySelector('span.content[placement="left"]'), s = mid2.querySelector('span.content[placement="right"]'); if (p && s) { mrns.patient = p.textContent.trim(); mrns.mother = s.textContent.replace(/[\/ ]/g, '').trim(); } }
        if (!mrns.patient) {
            pc.querySelectorAll('.mid').forEach(div => { const label = div.querySelector('h6')?.textContent.trim().toUpperCase(), val = div.querySelector('span')?.textContent.trim(); if (label?.includes('MRN')) { if (!mrns.patient && val) mrns.patient = val; if (label.includes('M.MRN') && val) mrns.mother = val; } });
        }
        const text = mrns.patient && mrns.mother ? `Baby's MRN: ${mrns.patient} | Mother's MRN: ${mrns.mother}` : (mrns.patient ? `MRN: ${mrns.patient}` : null);
        return { raw: mrns.patient, text: text };
    }

    function displayMrn() {
        const box = document.getElementById('barcode-display-box'), pc = document.querySelector('.patient-profile'); if (!box || !pc) return;
        const mrnData = extractMrnsData(pc);

        let mrnEl = document.getElementById('mrn-display');
        let spacer = document.getElementById('barcode-spacer');
        let mrnSvg = document.getElementById('mrn-barcode-svg');

        const currentBarcode = document.getElementById('barcode-value-text')?.textContent?.trim() || '';

        if (mrnData.text) {
            if (!spacer) {
                spacer = document.createElement('div');
                spacer.id = 'barcode-spacer';
                spacer.style.flexGrow = '1';
                box.appendChild(spacer);
            }
            if (!mrnEl) {
                mrnEl = document.createElement('div');
                mrnEl.id = 'mrn-display';
                box.appendChild(mrnEl);
            }
            if (!mrnSvg) {
                mrnSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                mrnSvg.id = 'mrn-barcode-svg';
                mrnSvg.style.cssText = 'display:block;';
                box.appendChild(mrnSvg);
            }

            const combinedBarcode = currentBarcode ? `${mrnData.raw}_${currentBarcode}` : mrnData.raw;

            if (mrnEl.textContent !== mrnData.text || mrnSvg.dataset.combinedValue !== combinedBarcode) {
                mrnEl.textContent = mrnData.text;
                if (mrnData.raw && window.JsBarcode) {
                    try {
                        mrnSvg.innerHTML = '';
                        JsBarcode(mrnSvg, combinedBarcode, { format: "CODE128", displayValue: false, height: 34, width: 2, margin: 0, background: "transparent" });
                        mrnSvg.setAttribute('preserveAspectRatio', 'none');
                        mrnSvg.dataset.combinedValue = combinedBarcode;
                    } catch (e) { console.warn('MRN Barcode generation failed:', e); }
                }
            }
        } else {
            if (mrnEl) mrnEl.remove();
            if (mrnSvg) mrnSvg.remove();
            if (spacer) spacer.remove();
        }
        syncPatientBannerLocation();
    }

    function updatePatientTypeBadge() {
        const container = document.querySelector('.patient-img'), labelTd = document.querySelector('td[translateid="patient-detail.PatientType"]'); if (!container || !labelTd || !labelTd.nextElementSibling) return;
        const pType = labelTd.nextElementSibling.textContent.trim().toUpperCase(); let badge = container.querySelector('.patient-type-badge'); if (!badge) { badge = document.createElement('div'); container.appendChild(badge); }
        if (pType.includes('IN PATIENT') || pType.includes('INPATIENT')) { badge.textContent = 'IN-PATIENT'; badge.className = 'patient-type-badge in-patient'; badge.style.backgroundColor = '#d32f2f'; } else if (pType.includes('OUT PATIENT') || pType.includes('OUTPATIENT')) { badge.textContent = 'OUT-PATIENT'; badge.className = 'patient-type-badge out-patient'; badge.style.backgroundColor = '#388e3c'; } else if (pType.includes('EMERGENCY') || pType === 'ER') { badge.textContent = 'ER'; badge.className = 'patient-type-badge in-patient'; badge.style.backgroundColor = '#c0392b'; } else badge.remove();
    }

    // ANALYZER COLUMNS TOGGLE
    const colsToUncheck = ['Lab Order No', 'Hospital MRN', 'DOB', 'Test ID', 'National/Iqama Id', 'Department', 'Doctor', 'Analyzer', 'Reference Lab', 'Accession No', 'Sequence No', 'Age', 'Container Type', 'Storage Condition'];
    let hasRunOnce = false;
    function isSpecificPageForColumns() { return window.location.href.endsWith('/#/lab-orders/lab-test-analyzer'); }
    function areColsChecked() { return colsToUncheck.some(col => { for(const lbl of document.querySelectorAll('.ag-column-tool-panel-column-label')) if(lbl.textContent.trim() === col && lbl.parentElement.querySelector('.ag-icon-checkbox-checked')) return true; return false; }); }
    function initColumnToggle() {
        if (!isSpecificPageForColumns() || columnToggleDone || columnToggleRunning) return;
        columnToggleRunning = true;
        let attempts = 0; const interval = setInterval(() => { if (document.querySelector('.ag-side-buttons') || ++attempts > 10) { if (document.querySelector('.ag-side-buttons')) { columnToggleDone = true; if (!hasRunOnce && areColsChecked()) { hasRunOnce = true; setTimeout(() => colsToUncheck.forEach(txt => { document.querySelectorAll('.ag-column-tool-panel-column-label').forEach(lbl => { if(lbl.textContent.trim() === txt && lbl.parentElement.querySelector('.ag-icon-checkbox-checked')) lbl.click(); }); }), 1000); } document.querySelectorAll('.ag-column-tool-panel-column-label').forEach(lbl => { if(!colsToUncheck.includes(lbl.textContent.trim()) && lbl.parentElement.querySelector('.ag-icon-checkbox-unchecked')) lbl.click(); }); } columnToggleRunning = false; clearInterval(interval); } }, 500);
    }

    function applyPersistentRowStyles() {
        const rows = document.querySelectorAll('.ag-center-cols-container div[role="row"], .ag-pinned-left-cols-container div[role="row"], .ag-pinned-right-cols-container div[role="row"]'), now = Date.now();
        rows.forEach(row => {
            const barcode = getRowBarcode(row);
            if (!barcode) { row.classList.remove('clicked-row-green'); return; }
            const val = localStorage.getItem(CLICKED_ROW_EXPIRY_PREFIX + barcode);
            if (val && now < parseInt(val, 10)) row.classList.add('clicked-row-green');
            else { if (val) localStorage.removeItem(CLICKED_ROW_EXPIRY_PREFIX + barcode); row.classList.remove('clicked-row-green'); }
        });
    }

    function setupPatientDetailToggle() {
        const detailTop = document.querySelector('.lo-view-detail-top'), btnArea = document.querySelector('.btn-area'); if (!detailTop || !btnArea || document.getElementById('custom-detail-toggle-btn')) return;
        const toggleBtn = document.createElement('button'); toggleBtn.id = 'custom-detail-toggle-btn'; toggleBtn.type = 'button'; toggleBtn.className = 'btn btn-sm';
        const updateUI = s => { if (s === 'hide') { toggleBtn.innerHTML = '<i class="fa fa-eye"></i> Show Patient Info'; toggleBtn.style.cssText = 'background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%) !important; color: white !important;'; } else { toggleBtn.innerHTML = '<i class="fa fa-eye-slash"></i> Hide Patient Info'; toggleBtn.style.cssText = 'background: linear-gradient(135deg, #d32f2f 0%, #a11f1f 100%) !important; color: white !important;'; } };
        updateUI(localStorage.getItem('labDetailTopVisibility') || 'show');
        toggleBtn.addEventListener('click', () => { const hidden = detailTop.style.display === 'none'; detailTop.style.display = hidden ? '' : 'none'; localStorage.setItem('labDetailTopVisibility', hidden ? 'show' : 'hide'); updateUI(hidden ? 'show' : 'hide'); window.enhancedGrid.triggerSummaryUpdate?.(); });
        btnArea.prepend(toggleBtn);
    }

    const fullPageUpdate = debounce(() => {
        const actionBtn = document.querySelector('div.lo-act-btn'); if (actionBtn?.parentElement) actionBtn.parentElement.removeAttribute('style');
        document.querySelectorAll('ag-grid-angular').forEach(grid => { if (grid.getAttribute(RESIZED_FLAG)) return; const api = grid.agGrid?.api || grid.__agGridComp?.api; if (api && typeof api.sizeColumnsToFit === 'function') { grid.style.width = GRID_WIDTH; grid.style.marginLeft = 'auto'; grid.style.marginRight = '0'; api.sizeColumnsToFit(); grid.setAttribute(RESIZED_FLAG, 'true'); } });
        document.querySelectorAll('div.accd-details-table-static.test-open, .card-header').forEach(el => { el.style.width = GRID_WIDTH; el.style.marginLeft = 'auto'; el.style.marginRight = '0'; });
        document.querySelectorAll('h6[translateid="test-results.Results"]').forEach(el => el.remove());
        const detailTop = document.querySelector('.lo-view-detail-top'); if (detailTop) detailTop.style.display = (localStorage.getItem('labDetailTopVisibility') || 'show') === 'hide' ? 'none' : '';
        setupPatientDetailToggle(); applyPersistentRowStyles();
        displayMrn(); scanAllLocationElements(); updateSummaryPosition(); updatePatientTypeBadge(); setupMenuNavigationObserver(); initColumnToggle();
    }, 100);

    // STICKY BARCODE (Stabilized — persists across Angular re-renders & iframe transitions)
    let lastKnownBarcode = '';

    function getLastBarcodeFromMemory() {
        let code = localStorage.getItem(BARCODE_KEY) || '';
        try {
            if (window.top && window.top !== window.self) {
                const topCode = window.top.localStorage.getItem(BARCODE_KEY);
                if (topCode) {
                    code = topCode;
                    if (localStorage.getItem(BARCODE_KEY) !== topCode) {
                        localStorage.setItem(BARCODE_KEY, topCode);
                    }
                }
            }
        } catch (e) {}
        if (code) lastKnownBarcode = code;
        return code || lastKnownBarcode;
    }

    function clearBarcodeBox(clearMemory = false) {
        const box = document.getElementById('barcode-display-box');
        if (box) box.remove();
        if (clearMemory) {
            lastKnownBarcode = '';
            localStorage.removeItem(BARCODE_KEY);
            try {
                if (window.top && window.top !== window.self) {
                    window.top.localStorage.removeItem(BARCODE_KEY);
                }
            } catch (e) {}
        }
    }

    function renderBarcodeGraphic(barcode) {
        if (!barcode) return;
        const textEl = document.getElementById('barcode-value-text');
        const svg = document.getElementById('barcode-svg');
        if (!textEl && !svg) return;
        if (textEl && svg && textEl.textContent === barcode && svg.dataset.renderedValue === barcode) return;
        if (textEl) textEl.textContent = barcode;
        if (svg && window.JsBarcode) {
            try {
                svg.innerHTML = '';
                JsBarcode(svg, barcode, { format: "CODE128", displayValue: false, height: 34, width: 2, margin: 0, background: "transparent" });
                svg.setAttribute('preserveAspectRatio', 'none');
                svg.dataset.renderedValue = barcode;
            } catch (err) {
                console.warn('[Barcode Display] JsBarcode render error:', err);
            }
        }
    }

    function insertBarcodeBox(barcode) {
        const stickyBtnSet = document.querySelector('.btn-area.stickey-btnset');
        const target = stickyBtnSet || document.querySelector('#custom-script-buttons') || document.querySelector('.test-open.mt-2');
        if (!barcode || !target) return;

        let box = document.getElementById('barcode-display-box');
        if (box) {
            if (document.body.contains(box) && target.nextElementSibling === box) {
                renderBarcodeGraphic(barcode);
                displayMrn();
                return;
            }
            box.remove();
        }

        box = document.createElement('div');
        box.id = 'barcode-display-box';
        box.style.cssText = 'width: 100%; z-index: 990;';

        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = 'text-transform: uppercase;';
        labelDiv.textContent = 'Barcode:';

        const valDiv = document.createElement('div');
        valDiv.id = 'barcode-value-text';
        valDiv.textContent = barcode;

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "barcode-svg";
        svg.style.cssText = 'display:block;';

        box.append(labelDiv, valDiv, svg);
        target.insertAdjacentElement('afterend', box);

        if (stickyBtnSet) {
            try {
                const style = window.getComputedStyle(stickyBtnSet);
                if (style.position === 'sticky' || style.position === 'fixed') {
                    Object.assign(box.style, {
                        position: 'sticky',
                        top: (stickyBtnSet.offsetHeight + (parseInt(style.top, 10) || 0)) + 'px',
                        left: '0',
                        zIndex: '999'
                    });
                }
            } catch (e) {}
        }

        renderBarcodeGraphic(barcode);
        displayMrn();
    }

    document.addEventListener('click', e => {
        const row = e.target.closest?.('.ag-row');
        if (row) {
            const barcode = getRowBarcode(row);
            if (!barcode) return;
            lastKnownBarcode = barcode;
            localStorage.setItem(BARCODE_KEY, barcode);
            localStorage.setItem(CLICKED_ROW_EXPIRY_PREFIX + barcode, String(Date.now() + CLICK_DURATION_MS));
            renderBarcodeGraphic(barcode);
            applyPersistentRowStyles();
            return;
        }

        const tpItem = e.target.closest?.('.tp-barcode-item');
        if (tpItem && tpItem.dataset.barcode && !e.target.closest('.tp-li-delete')) {
            const barcode = tpItem.dataset.barcode.trim();
            lastKnownBarcode = barcode;
            localStorage.setItem(BARCODE_KEY, barcode);
            renderBarcodeGraphic(barcode);
        }
    }, true);

    window.addEventListener('storage', e => {
        if (e.key === BARCODE_KEY) {
            if (e.newValue) {
                lastKnownBarcode = e.newValue;
                if (/\/lab\/.*\/0\//.test(location.href)) insertBarcodeBox(e.newValue);
            } else {
                clearBarcodeBox(false);
            }
        }
    });

    window.addEventListener('hashchange', () => {
        if (!/\/lab\/.*\/0\//.test(location.href)) {
            clearBarcodeBox(false);
        }
    });

    window.enhancedGrid.barcodeBoxUrlCheck = function() {
        const isDetailView = /\/lab\/.*\/0\//.test(location.href);
        if (!isDetailView) {
            clearBarcodeBox(false);
            return;
        }
        const barcode = getLastBarcodeFromMemory();
        if (barcode) {
            insertBarcodeBox(barcode);
        }
    };

    // AUTO VERIFY 2
    let isAutoVerifyEnabled = true, isVerificationProcessStarted = false, hasAutoClicked = false;
    window.enhancedGrid.autoVerify = {
        init: () => {
            GM_addStyle(`.auto-verify-toggle { display: inline-flex; align-items: center; gap: 12px; padding: 6px 10px; border: 1px solid #ccc; border-radius: 20px; background-color: #f8f9fa; cursor: pointer; transition: all 0.3s ease; user-select: none; } .auto-verify-toggle.is-active { border-color: #7ab5ff; background-color: #e7f1ff; animation: pulse-glow 2s infinite; } .auto-verify-toggle .toggle-label { font-size: 12px; font-weight: 600; color: #333; display: flex; align-items: center; gap: 6px; } .auto-verify-toggle .toggle-switch { position: relative; width: 40px; height: 22px; background-color: #ccc; border-radius: 11px; transition: background-color 0.3s ease; } .auto-verify-toggle.is-active .toggle-switch { background-color: #007bff; } .auto-verify-toggle .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background-color: white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.3s ease; } .auto-verify-toggle.is-active .toggle-thumb { transform: translateX(18px); } @keyframes pulse-glow { 0% { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0.3); } 70% { box-shadow: 0 0 0 8px rgba(0, 123, 255, 0); } 100% { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0); } }`);
            document.addEventListener('keydown', e => { if (e.key === 'F8' && !e.ctrlKey && (!document.querySelector('.modal-content h4.modal-title') || document.querySelector('.modal-content h4.modal-title').textContent.trim() !== 'Primary Verification') && !Array.from(document.querySelectorAll('div[col-id="ResultStatus"]')).some(c => c.textContent?.trim().includes('Resulted'))) document.querySelector('button.verify2-btn')?.click(); });
            document.addEventListener('click', e => { if (e.target.closest('button.verify1-btn')) { isVerificationProcessStarted = true; hasAutoClicked = false; } });
        },
        updateUI: () => {
            document.getElementById('autoVerifyToggleContainer')?.classList.toggle('is-active', isAutoVerifyEnabled);
            const btn2 = document.querySelector('button.verify2-btn'); if (btn2 && !btn2.dataset.redesigned) { btn2.textContent = 'VERIFY2 (F8)'; Object.assign(btn2.style, { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500' }); btn2.dataset.redesigned = 'true'; } if (btn2) btn2.style.borderColor = isAutoVerifyEnabled ? '#007bff' : '';
        },
        redesignHistory: () => { const btn = document.querySelector('button.backBtn[translateid="edit-lab-order.HistoryResults"]'); if (!btn || btn.dataset.redesigned) return; btn.innerHTML = `<span style="margin-right: 6px;">🕒</span> View History`; Object.assign(btn.style, { display: 'inline-flex', alignItems: 'center', fontWeight: '500' }); btn.dataset.redesigned = 'true'; },
        injectToggle: () => { const btn = document.querySelector('button.backBtn[translateid="edit-lab-order.HistoryResults"]'); if (!btn || document.getElementById('autoVerifyToggleContainer')) return; const container = document.createElement('div'); container.id = 'autoVerifyToggleContainer'; container.className = 'auto-verify-toggle'; container.innerHTML = `<span class="toggle-label"><span style="font-size: 14px;">🤖</span><span>AUTO VERIFY 2</span></span><div class="toggle-switch"><div class="toggle-thumb"></div></div>`; container.addEventListener('click', () => { isAutoVerifyEnabled = !isAutoVerifyEnabled; window.enhancedGrid.autoVerify.updateUI(); }); container.style.marginRight = '15px'; container.style.verticalAlign = 'middle'; btn.parentElement.insertBefore(container, btn); },
        resetState: () => { hasAutoClicked = false; isVerificationProcessStarted = false; }
    };
    function checkAndAutoClick() {
        if (!isAutoVerifyEnabled || !isVerificationProcessStarted || hasAutoClicked || (document.querySelector('.modal-content h4.modal-title')?.textContent.trim() === 'Primary Verification')) return;
        let target = false, safety = true;
        document.querySelectorAll('div[col-id="ResultStatus"]').forEach(c => { const txt = c.textContent?.trim() || ''; if (txt.includes('Resulted')) safety = false; if (txt.includes('Verified 1')) target = true; });
        if (safety && target) { document.querySelector('button.verify2-btn')?.click(); hasAutoClicked = true; }
    }

    function updateSummaryPosition() { const container = document.getElementById('test-summary-container'), barcodeBox = document.getElementById('barcode-display-box'); if (container && barcodeBox) { try { const styles = window.getComputedStyle(barcodeBox); if (styles.position === 'sticky' || styles.position === 'fixed') Object.assign(container.style, { position: 'sticky', top: ((parseInt(styles.top, 10) || 0) + barcodeBox.offsetHeight) + 'px', zIndex: '98', marginLeft: 'auto', marginRight: '0' }); } catch (e) {} } }
    const manageSummaryTableLifecycle = () => { if (/\/lab\/.*\/0\//.test(window.location.href)) { if (!document.getElementById('test-summary-container')) { const target = document.getElementById('barcode-display-box') || document.querySelector('.btn-area.stickey-btnset') || document.querySelector('.test-open.mt-2'); if (target) { const container = document.createElement('div'); container.id = 'test-summary-container'; target.insertAdjacentElement('afterend', container); updateSummaryPosition(); initializeModernSummaryTable(); } } } else document.getElementById('test-summary-container')?.remove(); };

    let lastSummaryUpdate = 0;
    function runAllUpdates() {
        fullPageUpdate();
        if (document.getElementById('test-summary-container') && (document.querySelector('.ag-center-cols-container .ag-row') || document.querySelector('.ag-row') || document.querySelector('.ag-overlay-no-rows-center'))) { const now = Date.now(); if (!window.enhancedGrid.summaryPopulated || (now - lastSummaryUpdate > 1000)) { window.enhancedGrid.triggerSummaryUpdate?.(); lastSummaryUpdate = now; window.enhancedGrid.summaryPopulated = true; } }
        window.enhancedGrid.autoVerify?.injectToggle(); window.enhancedGrid.autoVerify?.redesignHistory(); window.enhancedGrid.autoVerify?.updateUI();

        const wbWrapper = document.getElementById('wbSavedBatchesWrapper');
        if (wbWrapper) {
            const isSampleReceive = window.location.href.toLowerCase().includes('sample-receive') || document.getElementById('closebtn-smplrecieve');
            wbWrapper.style.display = isSampleReceive ? 'inline-block' : 'none';
        }
    }

    // ============================================
    // TELEPHONE EXTENSION OVERLAY MODULE (Integrated & Theme-Matched)
    // ============================================
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

    GM_addStyle(`
        .location-telephone-chip {
            display: inline-flex;
            align-items: center;
            border-radius: 6px;
            overflow: hidden;
            font-size: 13.5px;
            font-weight: 700;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
            border: 1.5px solid #b91c1c;
            cursor: default;
            vertical-align: middle;
            line-height: 1.25;
        }
        .loc-text {
            padding: 3px 10px;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: #ffffff;
            font-weight: 800;
        }
        .loc-tel {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            background: #f8fafc;
            color: #0f172a;
            border-left: 1.5px solid #cbd5e1;
        }
        .loc-tel::before {
            content: '☎';
            color: #b45309;
            font-size: 14px;
        }
        .tel-numbers {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 900;
            color: #000000;
        }
        .ag-cell .location-telephone-chip {
            font-size: 12px;
            border-radius: 5px;
            box-shadow: none;
        }
        .ag-cell .loc-text, .ag-cell .loc-tel {
            padding: 1px 7px;
        }
    `);

    function getExtensionsForLocation(location) {
        if (!location) return null;
        const normalized = location.toUpperCase().trim().split('/')[0].trim();
        const abbrevMatch = normalized.match(/\(([^)]+)\)/);
        if (abbrevMatch && WARD_EXTENSIONS[abbrevMatch[1].trim()]) return WARD_EXTENSIONS[abbrevMatch[1].trim()];
        if (WARD_EXTENSIONS[normalized]) return WARD_EXTENSIONS[normalized];

        const sortedKeys = Object.keys(WARD_EXTENSIONS).sort((a, b) => b.length - a.length);
        for (const ward of sortedKeys) {
            if (normalized.includes(ward)) return WARD_EXTENSIONS[ward];
        }
        return null;
    }

    function createUnifiedChip(locationText, extensions) {
        if (!locationText) locationText = 'Location';
        const hasExtensions = Array.isArray(extensions) && extensions.length > 0;
        const extensionList = hasExtensions ? extensions.join(', ') : 'Not Available';
        const titleText = hasExtensions
            ? `${locationText} — Extension(s): ${extensionList}`
            : `${locationText} — Extension Not Available`;

        const chip = document.createElement('span');
        chip.className = 'location-telephone-chip';
        chip.innerHTML = `
            <span class="loc-text">${esc(locationText)}</span>
            <span class="loc-tel" title="${esc(titleText)}">
                <span class="tel-numbers" style="${hasExtensions ? '' : 'color:#64748b !important;'}">${esc(extensionList)}</span>
            </span>`;
        return chip;
    }

    function enhanceLocationWithTelephone(element) {
        if (!element || element.id !== 'suite-location-display') return;
        let text = '';
        element.childNodes.forEach(n => { if (n.nodeType === 3) text += n.textContent; });
        text = text.trim();

        if (!text && !element.querySelector('.location-telephone-chip')) {
            text = element.textContent.trim();
        }
        if (!text || element.dataset.processedLocation === text) return;
        element.dataset.processedLocation = text;

        const extensions = getExtensionsForLocation(text);

        element.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
        element.querySelectorAll('.location-telephone-chip, .location-telephone').forEach(c => c.remove());

        const chip = createUnifiedChip(text, extensions);
        if (chip) {
            element.style.display = '';
            element.appendChild(chip);
        }
    }

    function extractCurrentUnitLocation() {
        const labelTd = document.querySelector('td[translateid="patient-detail.Location"], td[translateid="patient-detail.Ward"], td[translateid="patient-detail.Unit"]');
        if (labelTd?.nextElementSibling) {
            const raw = labelTd.nextElementSibling.textContent.trim();
            if (raw && raw !== '--' && raw !== '-') return raw;
        }
        const pc = document.querySelector('.patient-profile');
        if (pc) {
            const locNode = pc.querySelector('.patient-location, [translateid*="Location"] + td, [translateid*="Ward"] + td');
            if (locNode) {
                const raw = locNode.textContent.trim();
                if (raw && raw !== '--' && raw !== '-') return raw;
            }
            for (const div of pc.querySelectorAll('.mid')) {
                const label = div.querySelector('h6')?.textContent.trim().toUpperCase() || '';
                if (label.includes('LOCATION') || label.includes('WARD') || label.includes('UNIT')) {
                    const raw = (div.querySelector('span')?.textContent || '').trim();
                    if (raw && raw !== '--' && raw !== '-') return raw;
                }
            }
        }
        return '';
    }

    function syncPatientBannerLocation() {
        const box = document.getElementById('barcode-display-box');
        if (!box) return;
        const unitText = extractCurrentUnitLocation();
        let locEl = document.getElementById('suite-location-display');

        if (!unitText) {
            if (locEl) locEl.remove();
            return;
        }

        if (!locEl) {
            locEl = document.createElement('div');
            locEl.id = 'suite-location-display';
            box.appendChild(locEl);
        }

        if (locEl.dataset.processedLocation !== unitText) {
            delete locEl.dataset.processedLocation;
            locEl.innerHTML = '';
            locEl.textContent = unitText;
            enhanceLocationWithTelephone(locEl);
        }
    }

    const LOCATION_WATCH_SELECTOR = 'td[translateid="patient-detail.Location"] + td, td[translateid="patient-detail.Ward"] + td, td[translateid="patient-detail.Unit"] + td, .patient-profile .patient-location, #suite-location-display';

    function scanAllLocationElements() {
        syncPatientBannerLocation();
    }

    // PAGINATION
    const setDropdownValue = () => { const dropdown = document.getElementById("dropdownPaginationPageSize"); if (dropdown) { if (!Array.from(dropdown.options).find(opt => opt.value === "500")) { const newOption = document.createElement('option'); newOption.value = "500"; newOption.text = "500"; dropdown.appendChild(newOption); } if (dropdown.value !== "500") { dropdown.value = "500"; dropdown.dispatchEvent(new Event('change', { bubbles: true })); } } };
    window.addEventListener('load', setDropdownValue);

    // MASTER MUTATION OBSERVER
    const masterObserver = new MutationObserver(mutations => {
        let touchedDisabled = false;
        let locationChanged = false;
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') { touchedDisabled = true; continue; }
            if (mutation.type === 'characterData') {
                if (mutation.target.parentElement?.closest?.(LOCATION_WATCH_SELECTOR)) {
                    locationChanged = true;
                }
                continue;
            }
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 3) {
                    if (mutation.target?.closest?.(LOCATION_WATCH_SELECTOR)) {
                        locationChanged = true;
                    }
                    continue;
                }
                if (node.nodeType !== 1) continue;

                if (node.matches && node.matches('input')) { if (node.matches(RESULT_INPUT_SELECTOR)) removeNumericRestriction(node); }
                else if (node.querySelectorAll) node.querySelectorAll(RESULT_INPUT_SELECTOR).forEach(removeNumericRestriction);

                if ((node.matches && node.matches(LOCATION_WATCH_SELECTOR)) || (node.querySelectorAll && node.querySelectorAll(LOCATION_WATCH_SELECTOR).length > 0)) {
                    locationChanged = true;
                }

                if (node.id === "dropdownPaginationPageSize") setDropdownValue();
            }
        }
        if (locationChanged) syncPatientBannerLocation();
        if (touchedDisabled) enableModalSaveButton();
    });
    masterObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });

    // SAVE HOOK (staff counter + saved batches)
    const SAVE_BUTTON_SELECTOR = '#savebtn-smplrecieve';
    const SAVE_WAIT_TIMEOUT_MS = 4000;
    const CREDIT_ON_TIMEOUT = true;
    const pendingSaves = new Set();

    function isErrorAlertVisible() {
        const a = document.querySelector('div.alert.alert-danger');
        return !!(a && a.offsetParent !== null);
    }

    function waitForSaveResult(snapshot) {
        return new Promise(resolve => {
            const start = Date.now();
            const errorAtStart = isErrorAlertVisible();
            const poll = () => {
                if (!errorAtStart && isErrorAlertVisible()) return resolve(false);

                const tbody = document.querySelector('tbody[formarrayname="TubeTypeList"]');
                const rowsNow = tbody ? tbody.querySelectorAll('tr').length : 0;
                if (rowsNow < snapshot.rowCount) return resolve(true);

                const samplesNow = window.enhancedGrid.getSamplesCountFromPage?.();
                if (snapshot.currentSamples !== null && samplesNow !== null && samplesNow !== undefined && samplesNow > snapshot.currentSamples) return resolve(true);

                if (Date.now() - start > SAVE_WAIT_TIMEOUT_MS) return resolve(CREDIT_ON_TIMEOUT);
                setTimeout(poll, 150);
            };
            setTimeout(poll, 150);
        });
    }

    function finalizeSave(snapshot) {
        try { saveBatchFromSnapshot(snapshot); } catch (err) { console.warn('[Save Hook] batch save failed:', err); }
        try { window.enhancedGrid.countAndCreditFromSnapshot?.(snapshot); } catch (err) { console.warn('[Save Hook] staff credit failed:', err); }
        try { clearAllBarcodes(); } catch (err) {}

        const wbBtn = document.getElementById('wbSavedBatchesBtn');
        if (wbBtn) {
            wbBtn.style.transition = 'all 0.3s ease';
            wbBtn.style.boxShadow = '0 0 0 6px rgba(79, 70, 229, 0.4)';
            setTimeout(() => { if (wbBtn) wbBtn.style.boxShadow = '0 3px 8px rgba(79, 70, 229, 0.35)'; }, 1500);
        }
    }

    document.addEventListener('click', (e) => {
        const saveBtn = e.target.closest?.(SAVE_BUTTON_SELECTOR);
        if (!saveBtn || saveBtn.disabled) return;

        const snapshot = window.enhancedGrid.captureTableSaveSnapshot?.();
        if (!snapshot || snapshot.rowCount === 0) return;

        const key = snapshot.uniqueBarcodesList.join('|') || ('rows:' + snapshot.rowCount + ':' + snapshot.staffName);
        if (pendingSaves.has(key)) return;
        pendingSaves.add(key);

        waitForSaveResult(snapshot).then(ok => {
            pendingSaves.delete(key);
            if (ok) finalizeSave(snapshot);
        });
    }, true);

    setInterval(() => {
        if (document.hidden) return;
        unlockAgGridCells();
        checkAndAutoClick();
        if (/\/lab\/.*\/0\//.test(location.href)) {
            window.enhancedGrid.barcodeBoxUrlCheck?.();
            manageSummaryTableLifecycle();
            if (document.getElementById('test-summary-container') && document.querySelector('.ag-row')) window.enhancedGrid.triggerSummaryUpdate?.();
        }
        if (window.enhancedGrid.updateInlineBadge) window.enhancedGrid.updateInlineBadge(false);
    }, 1000);

    window.enhancedGrid.autoVerify.init();
    let lastUrl = location.href;
    const OWN_UI = '#test-summary-container, #rapidReceiveModal, #staffStatsPopup, #staffStatsResetModal, #staffInlineCountBadge, #wbSavedBatchesWrapper, #barcode-display-box, #lab-toast-msg';
    const onSpaMutation = debounce(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href; window.enhancedGrid.summaryPopulated = false; columnToggleDone = false;
            document.querySelectorAll('ag-grid-angular').forEach(grid => grid.removeAttribute(RESIZED_FLAG));
            window.enhancedGrid.autoVerify?.resetState(); initializeScript();
        }
        window.enhancedGrid.barcodeBoxUrlCheck?.(); manageSummaryTableLifecycle(); runAllUpdates();
    }, 250);
    const spaObserver = new MutationObserver(mutations => {
        const external = mutations.some(m => { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; return !el || !el.closest(OWN_UI); });
        if (external) onSpaMutation();
    });
    spaObserver.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { runAllUpdates(); initializeScript(); window.enhancedGrid.barcodeBoxUrlCheck?.(); manageSummaryTableLifecycle(); setDropdownValue(); scanAllLocationElements(); }, 500);

})();
