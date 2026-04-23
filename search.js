/**
 * ButterPass 95 | Search Module
 * Powered by Invidious API (No Key Required)
 */

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

// List of public Invidious instances to rotate if one is down
const INSTANCES = [
    'https://yewtu.be',
    'https://invidious.flokinet.to',
    'https://inv.riverside.rocks',
    'https://invidious.lunar.icu'
];

searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Check if it's a direct URL or ID
    const directId = extractVideoId(query);
    if (directId) {
        renderDirectResult(directId, query);
        return;
    }

    searchResults.innerHTML = '<div class="placeholder-text">Scanning YouTube...</div>';

    let success = false;
    for (const instance of INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
            if (!response.ok) continue;
            
            const data = await response.json();
            if (data && data.length > 0) {
                renderResults(data);
                success = true;
                break;
            }
        } catch (error) {
            console.warn(`Instance ${instance} failed, trying next...`);
        }
    }

    if (!success) {
        searchResults.innerHTML = '<div class="placeholder-text">All nodes busy. Try again shortly.</div>';
    }
}

function renderResults(items) {
    searchResults.innerHTML = '';
    
    items.forEach(item => {
        const videoId = item.videoId;
        const title = item.title;
        const channel = item.author;
        const duration = formatDuration(item.lengthSeconds);
        const thumb = item.videoThumbnails ? item.videoThumbnails.find(t => t.quality === 'medium' || t.quality === 'default').url : '';
        
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="result-thumb-container">
                <img class="result-thumb" src="${thumb}" alt="thumb">
                <span class="result-duration">${duration}</span>
            </div>
            <div class="result-info">
                <div class="search-result-title" title="${title}">${title}</div>
                <div class="result-channel">${channel}</div>
                <div class="search-result-actions">
                    <button class="btn-retro" onclick="window.loadVideoToDeck('A', '${videoId}', '${title.replace(/'/g, "\\'")}')">Deck A</button>
                    <button class="btn-retro" onclick="window.loadVideoToDeck('B', '${videoId}', '${title.replace(/'/g, "\\'")}')">Deck B</button>
                </div>
            </div>
        `;
        searchResults.appendChild(div);
    });
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
        h > 0 ? h : null,
        m.toString().padStart(h > 0 ? 2 : 1, '0'),
        s.toString().padStart(2, '0')
    ].filter(Boolean).join(':');
}

// Fallback Helper Functions
function extractVideoId(input) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = input.match(regex);
    if (match) return match[1];
    if (input.length === 11 && !input.includes(' ')) return input;
    return null;
}

function renderDirectResult(videoId, title, blobUrl = null) {
    const isLocal = videoId === 'local';
    const thumb = isLocal ? 'https://win98icons.alexmeub.com/icons/png/video_file-0.png' : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    
    searchResults.innerHTML = `
        <div class="placeholder-text" style="margin-bottom: 10px;">${isLocal ? 'Local File Detected' : 'Direct Link Detected'}:</div>
        <div class="search-result-item">
            <div class="result-thumb-container">
                <img class="result-thumb" src="${thumb}" alt="thumb">
            </div>
            <div class="result-info">
                <div class="search-result-title">${title}</div>
                <div class="result-channel">${isLocal ? 'Desktop File' : 'Manual Entry'}</div>
                <div class="search-result-actions">
                    <button class="btn-retro" onclick="window.loadVideoToDeck('A', '${isLocal ? blobUrl : videoId}', '${title.replace(/'/g, "\\'")}', ${isLocal})">Deck A</button>
                    <button class="btn-retro" onclick="window.loadVideoToDeck('B', '${isLocal ? blobUrl : videoId}', '${title.replace(/'/g, "\\'")}', ${isLocal})">Deck B</button>
                </div>
            </div>
        </div>
    `;
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
    
    // Handle Local Files
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
            const fileUrl = URL.createObjectURL(file);
            renderDirectResult('local', file.name, fileUrl);
        }
        return;
    }

    const data = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (data) {
        const videoId = extractVideoId(data);
        if (videoId) {
            renderDirectResult(videoId, data);
        }
    }
});
