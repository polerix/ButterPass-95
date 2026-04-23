/**
 * ButterPass 95 | Sync Module
 * Handles shared state for requests via npoint.io
 */

const syncStatus = document.getElementById('sync-status');
const notepad = document.getElementById('notepad-text');
const qrContainer = document.getElementById('qrcode');

let binId = localStorage.getItem('butterpass_bin_id');

// Improved URL detection for GitHub Pages vs Local File
function getRequestPageUrl(id) {
    let baseUrl = window.location.href.split('#')[0].split('?')[0];
    if (baseUrl.endsWith('index.html')) {
        baseUrl = baseUrl.replace('index.html', '');
    }
    return `${baseUrl}requests.html?bin=${id}`;
}

async function initSync() {
    // Show a placeholder QR even before sync is ready
    qrContainer.innerHTML = '<div style="font-size:8px; padding:10px;">Initializing Sync...</div>';

    if (!binId) {
        try {
            const response = await fetch('https://api.npoint.io/bins', {
                method: 'POST',
                body: JSON.stringify({ requests: [] }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            binId = data.binId;
            localStorage.setItem('butterpass_bin_id', binId);
        } catch (error) {
            console.warn('Sync server unreachable. QR code will link to local requests page.');
            binId = 'offline';
        }
    }

    // Generate QR Code
    qrContainer.innerHTML = ''; // Clear placeholder
    const qrUrl = getRequestPageUrl(binId);
    
    try {
        new QRCode(qrContainer, {
            text: qrUrl,
            width: 100,
            height: 100,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        syncStatus.textContent = binId === 'offline' ? 'Offline Mode' : 'Sync Active';
        syncStatus.style.color = binId === 'offline' ? 'orange' : 'green';
    } catch (e) {
        qrContainer.innerHTML = '<div style="font-size:8px; color:red;">QR Error</div>';
    }

    if (binId !== 'offline') {
        setInterval(fetchUpdates, 5000);
    }
    
    notepad.addEventListener('input', debounce(pushUpdates, 2000));
}

async function fetchUpdates() {
    if (binId === 'offline') return;
    try {
        const response = await fetch(`https://api.npoint.io/${binId}`);
        const data = await response.json();
        if (data.requests && data.requests.join('\n') !== notepad.value) {
            if (document.activeElement !== notepad) {
                notepad.value = data.requests.join('\n');
            }
        }
    } catch (error) {
        console.warn('Update fetch failed');
    }
}

async function pushUpdates() {
    if (binId === 'offline') return;
    try {
        const requests = notepad.value.split('\n').filter(line => line.trim() !== '');
        await fetch(`https://api.npoint.io/${binId}`, {
            method: 'POST',
            body: JSON.stringify({ requests }),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to push updates');
    }
}

function debounce(func, wait) {
    let timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, arguments), wait);
    };
}

// Start Sync
initSync();
