/**
 * ButterPass 95 | Crate (Local History)
 */

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

let crateHistory = [];

try {
    const saved = localStorage.getItem('butterpass_crate');
    if (saved) {
        crateHistory = JSON.parse(saved);
        // Remove local files because blob URLs expire on page reload
        crateHistory = crateHistory.filter(item => !item.isLocal);
    }
} catch (e) {
    console.warn('Could not load crate history');
}

function saveCrate() {
    localStorage.setItem('butterpass_crate', JSON.stringify(crateHistory.filter(item => !item.isLocal)));
}

window.addToCrate = function(videoId, title, isLocal, url = null) {
    const existingIndex = crateHistory.findIndex(item => 
        (isLocal && item.url === url) || (!isLocal && item.videoId === videoId)
    );
    
    if (existingIndex !== -1) {
        const item = crateHistory.splice(existingIndex, 1)[0];
        // Update title if needed
        item.title = title;
        crateHistory.unshift(item);
    } else {
        crateHistory.unshift({
            videoId,
            title,
            isLocal,
            url,
            addedAt: Date.now()
        });
    }
    saveCrate();
    renderCrate();
};

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('input', performSearch); // Instant offline search

function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    const directId = extractVideoId(query);
    if (directId && query.includes('http')) {
        window.addToCrate(directId, 'Pasted YouTube Link', false);
        searchInput.value = '';
        return;
    }

    renderCrate(query);
}

function renderCrate(filterQuery = '') {
    searchResults.innerHTML = '';
    
    if (crateHistory.length === 0) {
        searchResults.innerHTML = '<div class="placeholder-text">Your crate is empty. Drag and drop local files or YouTube URLs here!</div>';
        return;
    }

    const filtered = crateHistory.filter(item => {
        if (!filterQuery) return true;
        return item.title.toLowerCase().includes(filterQuery) || 
               (!item.isLocal && item.videoId.toLowerCase().includes(filterQuery));
    });

    if (filtered.length === 0) {
        searchResults.innerHTML = '<div class="placeholder-text">No matches in crate.</div>';
        return;
    }

    filtered.forEach(item => {
        const thumb = item.isLocal ? 'https://win98icons.alexmeub.com/icons/png/video_file-0.png' : `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
        const sourceParam = item.isLocal ? item.url : item.videoId;
        
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="result-thumb-container">
                <img class="result-thumb" src="${thumb}" alt="thumb">
            </div>
            <div class="result-info">
                <div class="search-result-title" title="${item.title}">${item.title}</div>
                <div class="result-channel">${item.isLocal ? 'Local File (Expires on Reload)' : 'YouTube History'}</div>
                <div class="search-result-actions">
                    <button class="btn-retro" onclick="window.loadVideoToDeck('A', '${sourceParam}', '${item.title.replace(/'/g, "\\'")}', ${item.isLocal})">Deck A</button>
                    <button class="btn-retro" onclick="window.loadVideoToDeck('B', '${sourceParam}', '${item.title.replace(/'/g, "\\'")}', ${item.isLocal})">Deck B</button>
                    <button class="btn-retro" onclick="window.removeFromCrate('${item.videoId}', ${item.isLocal}, '${item.url}')" style="flex: 0; padding: 2px 5px; color: red;" title="Remove">×</button>
                </div>
            </div>
        `;
        searchResults.appendChild(div);
    });
}

window.removeFromCrate = function(videoId, isLocal, url) {
    crateHistory = crateHistory.filter(item => {
        if (isLocal) return item.url !== url;
        return item.videoId !== videoId;
    });
    saveCrate();
    performSearch();
};

function extractVideoId(input) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = input.match(regex);
    if (match) return match[1];
    if (input.length === 11 && !input.includes(' ')) return input;
    return null;
}

window.handleManualLoad = function(deck) {
    const input = document.getElementById('manual-url').value.trim();
    const videoId = extractVideoId(input);
    if (videoId) {
        window.loadVideoToDeck(deck, videoId, 'Manual Entry');
        document.getElementById('manual-window').style.display = 'none';
        document.getElementById('manual-url').value = '';
    } else {
        alert('Invalid YouTube URL or Video ID');
    }
};

// Drag and Drop Logic
searchResults.addEventListener('dragover', (e) => {
    e.preventDefault();
    searchResults.classList.add('drag-active');
});

searchResults.addEventListener('dragleave', () => {
    searchResults.classList.remove('drag-active');
});

searchResults.addEventListener('drop', (e) => {
    e.preventDefault();
    searchResults.classList.remove('drag-active');
    
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
            const fileUrl = URL.createObjectURL(file);
            window.addToCrate('local', file.name, true, fileUrl);
        }
        return;
    }

    const data = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (data) {
        const videoId = extractVideoId(data);
        if (videoId) {
            window.addToCrate(videoId, 'Dropped YouTube Link', false);
        }
    }
});

// Render initial crate
renderCrate();

// Local Drive Export
window.exportCrateToLocalDrive = async function() {
    const statusEl = document.getElementById('settings-status');
    try {
        if (!window.showSaveFilePicker) {
            // Fallback for unsupported browsers
            const blob = new Blob([JSON.stringify(crateHistory, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'butterpass_crate.json';
            a.click();
            URL.revokeObjectURL(url);
            statusEl.textContent = 'Downloaded butterpass_crate.json';
            return;
        }

        // File System Access API
        const handle = await window.showSaveFilePicker({
            suggestedName: 'butterpass_crate.json',
            types: [{
                description: 'JSON File',
                accept: {'application/json': ['.json']}
            }]
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(crateHistory, null, 2));
        await writable.close();
        statusEl.textContent = 'Successfully saved to local drive!';
    } catch (err) {
        console.error(err);
        statusEl.textContent = 'Save cancelled or failed.';
    }
};
