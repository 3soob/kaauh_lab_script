// ==UserScript==
// @name         Manual Confirm Patient Report Uploader (Multi-File Batching - KAAUH)
// @namespace    http://tampermonkey.net/
// @version      1.10
// @updateURL    https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/Manual%20Confirm%20Patient%20Report%20Uploader%20%28Multi-File%20Batching%20-%20KAAUH%29.js
// @downloadURL  https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/Manual%20Confirm%20Patient%20Report%20Uploader%20%28Multi-File%20Batching%20-%20KAAUH%29.js
// @description  Groups multiple PDFs per MRN, selects Chemistry Lab on both dropdowns, uploads in one batch, appends _reported, and is visible strictly on #/documents
// @match        *://his.kaauh.org/lab/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

(function () {
    'use strict';

    const BRIDGE_API = 'http://127.0.0.1:5000/api';
    const REQUIRED_HASH_PATH = '#/documents';

    let patientQueue = [];
    let currentIndex = 0;
    let isProcessing = false;
    let skipRequested = false;
    let cancelCurrentWait = null;

    const sleep = (ms) => {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            cancelCurrentWait = () => {
                clearTimeout(timer);
                resolve();
            };
        });
    };

    const waitForElement = (selector, timeout = 15000) => {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (skipRequested) {
                    clearInterval(timer);
                    reject(new Error('SKIPPED_BY_USER'));
                    return;
                }
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    reject(new Error(`Timeout waiting for selector: ${selector}`));
                }
            }, 300);

            cancelCurrentWait = () => {
                clearInterval(timer);
                reject(new Error('SKIPPED_BY_USER'));
            };
        });
    };

    async function clearAndSetAngularInput(inputElement, value) {
        inputElement.focus();
        inputElement.value = '';
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true }));
        inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', keyCode: 8, bubbles: true }));
        await sleep(150);

        inputElement.value = value;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setAngularSelectValue(selectElement, targetValue) {
        if (!selectElement) return;

        let matched = false;
        for (let i = 0; i < selectElement.options.length; i++) {
            const opt = selectElement.options[i];
            if (opt.value === targetValue || opt.text.trim() === targetValue) {
                selectElement.selectedIndex = i;
                opt.selected = true;
                matched = true;
                break;
            }
        }

        if (matched) {
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            console.warn(`Option "${targetValue}" not found in dropdown.`);
        }
    }

    function fetchFileBlob(filename) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${BRIDGE_API}/file/${encodeURIComponent(filename)}`,
                responseType: 'blob',
                onload: (response) => {
                    if (response.status === 200) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`Failed to load ${filename}: ${response.statusText}`));
                    }
                },
                onerror: reject
            });
        });
    }

    function markFilesAsReported(filenames) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${BRIDGE_API}/mark_reported`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ filenames }),
                onload: (response) => {
                    if (response.status === 200) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(new Error(`Server error renaming files: ${response.statusText}`));
                    }
                },
                onerror: reject
            });
        });
    }

    function tryCloseModal() {
        const closeBtn = document.querySelector('#upload-close')
            || document.querySelector("button[aria-label='Close'].nova-modal__close");
        if (closeBtn) {
            closeBtn.click();
            console.log('Upload modal closed.');
        }
    }

    function waitForUserToClickUpload() {
        return new Promise(async (resolve, reject) => {
            try {
                const uploadConfirmBtn = await waitForElement('#upload-files');

                const originalBoxShadow = uploadConfirmBtn.style.boxShadow;
                uploadConfirmBtn.style.boxShadow = '0 0 10px 3px #198754';

                const onClickHandler = () => {
                    cleanup();
                    resolve();
                };

                const cleanup = () => {
                    uploadConfirmBtn.removeEventListener('click', onClickHandler);
                    uploadConfirmBtn.style.boxShadow = originalBoxShadow;
                };

                uploadConfirmBtn.addEventListener('click', onClickHandler, { once: true });

                cancelCurrentWait = () => {
                    cleanup();
                    reject(new Error('SKIPPED_BY_USER'));
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    async function processCurrentPatient() {
        skipRequested = false;

        if (currentIndex >= patientQueue.length) {
            updateStatus('All patients processed!', '#198754');
            isProcessing = false;
            setButtonStates(false, false);
            return;
        }

        const task = patientQueue[currentIndex];
        updateStatus(`[${currentIndex + 1}/${patientQueue.length}] Preparing MRN ${task.id} (${task.count} file${task.count > 1 ? 's' : ''})...`, '#0d6efd');
        setButtonStates(true, true);

        try {
            // 1. Clear and enter MRN
            const mrnInput = await waitForElement('#enterMRN');
            await clearAndSetAngularInput(mrnInput, task.id);
            await sleep(300);

            // 2. Press Enter to search
            mrnInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            mrnInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
            await sleep(1500);

            // 3. Click "Upload Documents"
            const openUploadBtn = document.querySelector("button[translateid='documents.UploadDocuments']")
                || Array.from(document.querySelectorAll('button.btn-success')).find(b => b.innerText.includes('Upload Documents'));

            if (!openUploadBtn) {
                throw new Error('Upload Documents button not found.');
            }
            openUploadBtn.click();
            await sleep(1000);

            // 4. Attach all PDFs for this MRN
            const fileInput = await waitForElement(".file_upload_div input[type='file']");
            const dataTransfer = new DataTransfer();

            updateStatus(`Downloading ${task.count} file(s) for MRN ${task.id}...`, '#0d6efd');
            for (const fname of task.filenames) {
                const blob = await fetchFileBlob(fname);
                const file = new File([blob], fname, { type: 'application/pdf' });
                dataTransfer.items.add(file);
            }

            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(600);

            // 5. Select "Chemistry Lab" on both dropdowns
            await waitForElement('select#changeAttribute');
            const attributeSelects = document.querySelectorAll('select#changeAttribute');
            attributeSelects.forEach((selectEl) => {
                setAngularSelectValue(selectEl, 'Chemistry Lab');
            });

            // 6. Wait for user upload confirmation or abort
            updateStatus(`[${currentIndex + 1}/${patientQueue.length}] ${task.count} file(s) attached! Click "Upload" or "Skip"`, '#d63384');
            await waitForUserToClickUpload();

            // 7. Wait 5s for submission
            updateStatus(`Uploaded! Waiting 5s before closing...`, '#fd7e14');
            await sleep(5000);

            // 8. Close modal
            tryCloseModal();

            // 9. Mark all files for this MRN as reported
            updateStatus(`Renaming ${task.count} file(s) with suffix _reported...`, '#6c757d');
            try {
                await markFilesAsReported(task.filenames);
                console.log(`Successfully renamed ${task.filenames.length} file(s) for MRN ${task.id}`);
            } catch (renameErr) {
                console.error('Failed to rename files:', renameErr);
            }

            await sleep(1000);

            // Advance index to next patient
            currentIndex++;
            processCurrentPatient();

        } catch (err) {
            if (err.message === 'SKIPPED_BY_USER') {
                updateStatus(`Aborted MRN ${task.id}. Advancing to next...`, '#e65100');
                tryCloseModal();
                await sleep(800);
                currentIndex++;
                processCurrentPatient();
            } else {
                console.error('Error during upload flow:', err);
                updateStatus(`Stopped on MRN ${task.id}: ${err.message}`, '#dc3545');
                isProcessing = false;
                setButtonStates(false, false);
            }
        }
    }

    function abortCurrentOperation() {
        if (!isProcessing) return;
        skipRequested = true;
        if (typeof cancelCurrentWait === 'function') {
            cancelCurrentWait();
        }
    }

    function setButtonStates(queueActive, canSkip) {
        const startBtn = document.getElementById('tm-start-btn');
        const skipBtn = document.getElementById('tm-skip-btn');
        if (startBtn) {
            startBtn.disabled = queueActive;
            startBtn.innerText = queueActive ? 'Queue Active' : 'Load & Start Queue';
        }
        if (skipBtn) {
            skipBtn.disabled = !canSkip;
            skipBtn.style.opacity = canSkip ? '1' : '0.5';
            skipBtn.style.cursor = canSkip ? 'pointer' : 'not-allowed';
        }
    }

    function updateStatus(text, color = '#333') {
        const statusEl = document.getElementById('tm-status-text');
        if (statusEl) {
            statusEl.innerText = text;
            statusEl.style.color = color;
        }
    }

    function makeDraggable(element, handle) {
        let posX = 0, posY = 0, initialMouseX = 0, initialMouseY = 0;

        handle.onmousedown = (e) => {
            e.preventDefault();
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };
            document.onmousemove = (ev) => {
                ev.preventDefault();
                posX = initialMouseX - ev.clientX;
                posY = initialMouseY - ev.clientY;
                initialMouseX = ev.clientX;
                initialMouseY = ev.clientY;

                const currentTop = element.offsetTop - posY;
                const currentLeft = element.offsetLeft - posX;

                element.style.bottom = 'auto';
                element.style.right = 'auto';
                element.style.top = `${Math.max(10, Math.min(window.innerHeight - element.offsetHeight - 10, currentTop))}px`;
                element.style.left = `${Math.max(10, Math.min(window.innerWidth - element.offsetWidth - 10, currentLeft))}px`;
            };
        };
    }

    // Controls visibility based on current Angular hash route
    function checkRouteVisibility() {
        const panel = document.getElementById('tm-control-panel');
        if (!panel) return;

        const currentHash = window.location.hash || '';
        if (currentHash.startsWith(REQUIRED_HASH_PATH)) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    function injectUI() {
        if (document.getElementById('tm-control-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'tm-control-panel';
        panel.style.position = 'fixed';
        panel.style.top = '120px';
        panel.style.right = '30px';
        panel.style.zIndex = '999999';
        panel.style.background = '#ffffff';
        panel.style.border = '1px solid #ced4da';
        panel.style.borderRadius = '8px';
        panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
        panel.style.padding = '0';
        panel.style.minWidth = '330px';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.overflow = 'hidden';
        panel.style.display = 'none'; // Controlled by checkRouteVisibility

        panel.innerHTML = `
            <div id="tm-drag-handle" style="display:flex; justify-content:space-between; align-items:center; background:#f8f9fa; border-bottom:1px solid #dee2e6; padding:10px 14px; cursor:move; user-select:none;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="color:#6c757d; font-size:14px;">⠿</span>
                    <strong style="font-size:13px; color:#212529;">Report Workflow Queue</strong>
                </div>
                <span id="tm-queue-count" style="font-size:11px; color:#6c757d; background:#e9ecef; padding:2px 6px; border-radius:10px;">0 patients</span>
            </div>
            <div style="padding:14px; display:flex; flex-direction:column; gap:10px;">
                <div id="tm-status-text" style="font-size:12px; color:#495057; line-height:1.4;">
                    Click "Load & Start" to begin queue.
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="tm-start-btn" style="flex:2; padding:8px 12px; background:#198754; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600;">
                        Load & Start Queue
                    </button>
                    <button id="tm-skip-btn" disabled style="flex:1; padding:8px 12px; background:#dc3545; color:#fff; border:none; border-radius:4px; cursor:not-allowed; font-size:12px; font-weight:600; opacity:0.5;">
                        Skip / Abort ⏭
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        const handle = document.getElementById('tm-drag-handle');
        makeDraggable(panel, handle);

        const startBtn = document.getElementById('tm-start-btn');
        const skipBtn = document.getElementById('tm-skip-btn');
        const countSpan = document.getElementById('tm-queue-count');

        startBtn.onclick = async () => {
            if (isProcessing) return;

            startBtn.disabled = true;
            startBtn.innerText = 'Loading...';

            try {
                const res = await fetch(`${BRIDGE_API}/files`);
                patientQueue = await res.json();
                currentIndex = 0;

                const totalFiles = patientQueue.reduce((acc, p) => acc + p.count, 0);
                countSpan.innerText = `${patientQueue.length} pts (${totalFiles} files)`;

                if (patientQueue.length > 0) {
                    isProcessing = true;
                    processCurrentPatient();
                } else {
                    updateStatus('No un-reported PDF files found.', '#ffc107');
                    setButtonStates(false, false);
                }
            } catch (err) {
                updateStatus('Cannot reach local server at 127.0.0.1:5000.', '#dc3545');
                setButtonStates(false, false);
                startBtn.innerText = 'Retry';
            }
        };

        skipBtn.onclick = () => {
            abortCurrentOperation();
        };

        // Initial route check
        checkRouteVisibility();
    }

    // Listen for SPA route transitions
    window.addEventListener('hashchange', checkRouteVisibility);
    window.addEventListener('popstate', checkRouteVisibility);

    // Periodic safety check for Angular silent router navigations
    setInterval(checkRouteVisibility, 600);

    window.addEventListener('load', injectUI);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        injectUI();
    }
})();
