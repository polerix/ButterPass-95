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

window.addToCrate = function(videoId, title, isLocal, url = null, thumbData = null) {
    const existingIndex = crateHistory.findIndex(item => 
        (isLocal && item.url === url) || (!isLocal && item.videoId === videoId)
    );
    
    if (existingIndex !== -1) {
        const item = crateHistory.splice(existingIndex, 1)[0];
        // Update title if needed
        item.title = title;
        if (thumbData) item.thumb = thumbData;
        crateHistory.unshift(item);
    } else {
        crateHistory.unshift({
            videoId,
            title,
            isLocal,
            url,
            thumb: thumbData,
            addedAt: Date.now()
        });
    }
    saveCrate();
    renderCrate();
};

async function generateVideoThumbnail(url) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.crossOrigin = 'anonymous';
        video.onloadeddata = () => {
            video.currentTime = 2; // Seek to 2 seconds
        };
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        video.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 3000); // 3 second timeout
    });
}

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
        searchResults.innerHTML = '<div class="placeholder-text">Your WAREHOUSE is empty. Scan a local folder, or drag and drop files/URLs here!</div>';
        return;
    }

    const filtered = crateHistory.filter(item => {
        if (!filterQuery) return true;
        return item.title.toLowerCase().includes(filterQuery) || 
               (!item.isLocal && item.videoId.toLowerCase().includes(filterQuery));
    });

    if (filtered.length === 0) {
        searchResults.innerHTML = '<div class="placeholder-text">No matches in WAREHOUSE.</div>';
        return;
    }

    filtered.forEach(item => {
        let thumb = `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
        if (item.isLocal) {
            thumb = item.thumb || (item.title.toLowerCase().endsWith('.mp3') || item.title.toLowerCase().endsWith('.wav') || item.title.toLowerCase().endsWith('.ogg') 
                ? 'https://win98icons.alexmeub.com/icons/png/cd_audio_cd_a-0.png' 
                : 'https://win98icons.alexmeub.com/icons/png/movie_maker-0.png');
        }
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
        const isVideo = file.type.startsWith('video/');
        if (isVideo || file.type.startsWith('audio/')) {
            const fileUrl = URL.createObjectURL(file);
            window.addToCrate('local', file.name, true, fileUrl);
            
            if (isVideo) {
                generateVideoThumbnail(fileUrl).then(thumbData => {
                    if (thumbData) {
                        const item = crateHistory.find(i => i.url === fileUrl);
                        if (item) {
                            item.thumb = thumbData;
                            performSearch();
                        }
                    }
                });
            }
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

// WAREHOUSE Local Scanning
window.scanLocalWarehouse = async function() {
    const statusEl = document.getElementById('settings-status');
    if (!window.showDirectoryPicker) {
        statusEl.textContent = 'Browser does not support folder scanning.';
        return;
    }
    
    try {
        const dirHandle = await window.showDirectoryPicker({
            id: 'butterpass_warehouse',
            mode: 'read'
        });
        
        statusEl.textContent = 'Scanning directory...';
        let foundCount = 0;
        
        // Recursive search for media files
        async function scanDirectory(handle, currentPath) {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const name = entry.name.toLowerCase();
                    if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.ogg')) {
                        const file = await entry.getFile();
                        const url = URL.createObjectURL(file);
                        
                        // Tag title with the parent folder name (Crates inside Crates)
                        let title = file.name;
                        if (currentPath) {
                            title = `[${currentPath}] ${title}`;
                        }
                        
                        // We use file.name as videoId for local files
                        const isVideo = name.endsWith('.mp4') || name.endsWith('.webm');
                        window.addToCrate('local', title, true, url);
                        
                        if (isVideo) {
                            // Generate thumb asynchronously
                            generateVideoThumbnail(url).then(thumbData => {
                                if (thumbData) {
                                    const item = crateHistory.find(i => i.url === url);
                                    if (item) {
                                        item.thumb = thumbData;
                                        // Quick DOM update if visible
                                        performSearch();
                                    }
                                }
                            });
                        }
                        
                        foundCount++;
                    }
                } else if (entry.kind === 'directory') {
                    // Recursive call
                    await scanDirectory(entry, entry.name);
                }
            }
        }
        
        await scanDirectory(dirHandle, dirHandle.name);
        
        statusEl.textContent = `Scan complete! Added ${foundCount} playable files to WAREHOUSE.`;
        document.getElementById('search-input').value = '';
        renderCrate();
        
    } catch (err) {
        console.error(err);
        if (err.name !== 'AbortError') {
            statusEl.textContent = 'Error scanning folder.';
        } else {
            statusEl.textContent = 'Scan cancelled.';
        }
    }
};

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
