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

let currentSearchQuery = '';
let currentPage = 1;

searchBtn.addEventListener('click', () => performSearch(1));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(1);
});

async function performSearch(page = 1) {
    const query = searchInput.value.trim();
    if (!query) return;

    currentSearchQuery = query;
    currentPage = page;

    // Check if it's a direct URL or ID
    const directId = extractVideoId(query);
    if (directId) {
        renderDirectResult(directId, query);
        return;
    }

    if (page === 1) {
        searchResults.innerHTML = '<div class="placeholder-text">Scanning YouTube...</div>';
    } else {
        const loadBtn = document.getElementById('load-more-btn');
        if (loadBtn) loadBtn.textContent = 'Loading...';
    }

    let success = false;
    for (const instance of INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}`);
            if (!response.ok) continue;
            
            const data = await response.json();
            if (data && data.length > 0) {
                renderResults(data, page > 1);
                success = true;
                break;
            }
        } catch (error) {
            console.warn(`Instance ${instance} failed, trying next...`);
        }
    }

    if (!success) {
        if (page === 1) {
            searchResults.innerHTML = '<div class="placeholder-text">All nodes busy. Try again shortly.</div>';
        } else {
            const loadBtn = document.getElementById('load-more-btn');
            if (loadBtn) loadBtn.textContent = 'Failed. Try again.';
        }
    }
}

function renderResults(items, append = false) {
    if (!append) {
        searchResults.innerHTML = '';
    } else {
        // Remove existing load more button before appending
        const loadBtn = document.getElementById('load-more-btn');
        if (loadBtn) loadBtn.remove();
    }
    
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

    // Add Load More Button
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'load-more-btn';
    loadMoreBtn.className = 'btn-retro';
    loadMoreBtn.style.width = '100%';
    loadMoreBtn.style.marginTop = '10px';
    loadMoreBtn.textContent = 'Load More';
    loadMoreBtn.onclick = () => performSearch(currentPage + 1);
    searchResults.appendChild(loadMoreBtn);
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
