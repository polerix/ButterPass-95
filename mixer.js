/**
 * ButterPass 95 | Mixer Controller
 * Handles YouTube IFrame API, Audio Logic, and Playlist Management
 */

let playerA, playerB;
const crossfader = document.getElementById('crossfader');
const queues = { A: [], B: [] };

// Initialize YouTube Players
function onYouTubeIframeAPIReady() {
    const origin = window.location.protocol === 'file:' ? 'http://localhost' : window.location.origin;

    playerA = new YT.Player('player-a', {
        height: '100%',
        width: '100%',
        videoId: 'dQw4w9WgXcQ', // Placeholder
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'modestbranding': 1,
            'enablejsapi': 1,
            'origin': origin
        },
        events: {
            'onReady': onPlayerReady
        }
    });

    playerB = new YT.Player('player-b', {
        height: '100%',
        width: '100%',
        videoId: 'y6120QOlsfU', // Placeholder
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'modestbranding': 1,
            'enablejsapi': 1,
            'origin': origin
        },
        events: {
            'onReady': onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    updateMixerVolumes();
}

// Crossfader Logic
crossfader.addEventListener('input', () => {
    updateMixerVolumes();
});

function updateMixerVolumes() {
    if (!playerA || !playerB) return;

    const value = parseInt(crossfader.value);
    
    // Simple Linear Crossfade (can be improved to logarithmic)
    const volA = 100 - value;
    const volB = value;

    if (typeof playerA.setVolume === 'function') playerA.setVolume(volA);
    if (typeof playerB.setVolume === 'function') playerB.setVolume(volB);

    // Visual feedback in status bar (optional)
    document.querySelector('.status-bar-field:first-child').textContent = `Mix: A ${volA}% / B ${volB}%`;
}

// Global function to load a video into a deck
window.loadVideoToDeck = function(deck, videoId, title) {
    const player = deck === 'A' ? playerA : playerB;
    
    // Add to internal state
    queues[deck].push({ videoId, title });
    
    // If it's the first item, load it immediately
    if (queues[deck].length === 1) {
        player.loadVideoById(videoId);
    }
    
    renderQueue(deck);
};

window.removeFromQueue = function(deck, index, event) {
    if (event) event.stopPropagation();
    queues[deck].splice(index, 1);
    renderQueue(deck);
};

window.playFromQueue = function(deck, index) {
    const player = deck === 'A' ? playerA : playerB;
    const item = queues[deck][index];
    player.loadVideoById(item.videoId);
    renderQueue(deck); // Update active state
};

function renderQueue(deck) {
    const queueList = document.getElementById(`queue-${deck.toLowerCase()}`);
    queueList.innerHTML = '';
    
    const player = deck === 'A' ? playerA : playerB;
    const currentVideoId = (player && player.getVideoData) ? player.getVideoData().video_id : null;

    queues[deck].forEach((item, index) => {
        const isActive = item.videoId === currentVideoId;
        const li = document.createElement('li');
        li.className = `queue-item ${isActive ? 'active' : ''}`;
        li.onclick = () => window.playFromQueue(deck, index);
        
        li.innerHTML = `
            <img class="queue-thumb" src="https://img.youtube.com/vi/${item.videoId}/default.jpg" alt="thumb">
            <span class="queue-title" title="${item.title}">${item.title}</span>
            <div class="queue-actions">
                <button class="btn-retro queue-play" onclick="window.playFromQueue('${deck}', ${index}, event)">▶</button>
                <button class="btn-retro queue-remove" onclick="window.removeFromQueue('${deck}', ${index}, event)">×</button>
            </div>
        `;
        queueList.appendChild(li);
    });
}

// Sync and Reset Buttons
document.getElementById('sync-btn').addEventListener('click', () => {
    if (playerA && playerB) {
        const timeA = playerA.getCurrentTime();
        playerB.seekTo(timeA, true);
    }
});

document.getElementById('reset-btn').addEventListener('click', () => {
    crossfader.value = 50;
    updateMixerVolumes();
});

// Start Menu Logic
const startBtn = document.getElementById('start-btn');
const startMenu = document.getElementById('start-menu');

startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = startMenu.style.display === 'flex';
    startMenu.style.display = isVisible ? 'none' : 'flex';
    startBtn.classList.toggle('active', !isVisible);
});

document.addEventListener('click', () => {
    startMenu.style.display = 'none';
    startBtn.classList.remove('active');
});

// Window Dragging Logic
document.querySelectorAll('.window, .sticky-note').forEach(win => {
    const titleBar = win.querySelector('.title-bar, .sticky-header');
    if (!titleBar) return;
    
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    titleBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        offset.x = e.clientX - win.offsetLeft;
        offset.y = e.clientY - win.offsetTop;
        
        // Bring to front
        document.querySelectorAll('.window, .sticky-note').forEach(w => w.style.zIndex = 100);
        win.style.zIndex = 500;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        win.style.left = (e.clientX - offset.x) + 'px';
        win.style.top = (e.clientY - offset.y) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
});

// Timer Polling Logic
function updateDeckTimers() {
    updateTimerDisplay('A', playerA);
    updateTimerDisplay('B', playerB);
}

function updateTimerDisplay(deck, player) {
    if (!player || typeof player.getCurrentTime !== 'function' || !player.getDuration) return;
    
    try {
        const current = player.getCurrentTime();
        const duration = player.getDuration();
        const remaining = duration - current;
        
        const timerEl = document.getElementById(`timer-${deck.toLowerCase()}`);
        if (timerEl) {
            timerEl.textContent = `${formatTime(current)} / -${formatTime(remaining)}`;
        }
    } catch (e) {
        // Player might not be fully ready
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Start Polling
setInterval(updateDeckTimers, 500);
