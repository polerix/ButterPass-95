/**
 * ButterPass 95 | Mixer Controller
 * Handles YouTube IFrame API, Local Files, and Audio Logic
 */

let playerA, playerB;
const crossfader = document.getElementById('crossfader');
let queues = { A: [], B: [] };

// Rehydrate queues from localStorage
try {
    const saved = localStorage.getItem('butterpass_queues');
    if (saved) queues = JSON.parse(saved);
} catch (e) {
    console.warn('Could not load saved queues');
}

// Persist queues to localStorage
function saveQueues() {
    localStorage.setItem('butterpass_queues', JSON.stringify(queues));
}

// Initialize YouTube Players
function onYouTubeIframeAPIReady() {
    const origin = window.location.protocol === 'file:' ? 'http://localhost' : window.location.origin;

    playerA = new YT.Player('player-a', {
        height: '100%',
        width: '100%',
        videoId: 'dQw4w9WgXcQ', // Placeholder
        playerVars: {
            'autoplay': 0, 'controls': 1, 'modestbranding': 1, 'enablejsapi': 1, 'origin': origin
        },
        events: { 'onReady': onPlayerReady }
    });

    playerB = new YT.Player('player-b', {
        height: '100%',
        width: '100%',
        videoId: 'y6120QOlsfU', // Placeholder
        playerVars: {
            'autoplay': 0, 'controls': 1, 'modestbranding': 1, 'enablejsapi': 1, 'origin': origin
        },
        events: { 'onReady': onPlayerReady }
    });
}

function onPlayerReady(event) {
    updateMixerVolumes();
    renderQueue('A');
    renderQueue('B');
}

// Crossfader Logic
crossfader.addEventListener('input', updateMixerVolumes);

function updateMixerVolumes() {
    const value = parseInt(crossfader.value);
    const x = value / 100; // 0 to 1

    // Equal-power crossfade (Cosine curve)
    const volA = Math.round(Math.cos(x * 0.5 * Math.PI) * 100);
    const volB = Math.round(Math.cos((1.0 - x) * 0.5 * Math.PI) * 100);

    setPlayerVolume('A', volA);
    setPlayerVolume('B', volB);

    document.querySelector('.status-bar-field:first-child').textContent = `Mix: A ${Math.round(100 - value)}% / B ${value}%`;
}

function setPlayerVolume(deck, vol) {
    // YouTube
    const ytPlayer = deck === 'A' ? playerA : playerB;
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
        if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
        ytPlayer.setVolume(vol);
    }

    // Local
    const localPlayer = document.getElementById(`local-player-${deck.toLowerCase()}`);
    if (localPlayer) {
        localPlayer.muted = false;
        localPlayer.volume = vol / 100;
    }
}

// Global function to load a video into a deck
window.loadVideoToDeck = function(deck, source, title, isLocal = false) {
    queues[deck].push({ source, title, isLocal });
    saveQueues();
    if (queues[deck].length === 1) {
        window.playFromQueue(deck, 0);
    }
    renderQueue(deck);
};

window.playFromQueue = function(deck, index, event) {
    if (event) event.stopPropagation();
    const item = queues[deck][index];
    const ytId = `player-${deck.toLowerCase()}`;
    const localId = `local-player-${deck.toLowerCase()}`;
    const ytEl = document.getElementById(ytId);
    const localEl = document.getElementById(localId);

    if (item.isLocal) {
        ytEl.style.display = 'none';
        localEl.style.display = 'block';
        localEl.src = item.source;
        localEl.play();
    } else {
        localEl.style.display = 'none';
        localEl.pause();
        ytEl.style.display = 'block';
        const player = deck === 'A' ? playerA : playerB;
        if (player && player.loadVideoById) player.loadVideoById(item.source);
    }
    
    // Mark as active in state
    queues[deck].forEach((q, i) => q.active = (i === index));
    saveQueues();
    renderQueue(deck);
};

window.removeFromQueue = function(deck, index, event) {
    if (event) event.stopPropagation();
    queues[deck].splice(index, 1);
    saveQueues();
    renderQueue(deck);
};

function renderQueue(deck) {
    const queueList = document.getElementById(`queue-${deck.toLowerCase()}`);
    queueList.innerHTML = '';

    queues[deck].forEach((item, index) => {
        const thumb = item.isLocal ? 'https://win98icons.alexmeub.com/icons/png/video_file-0.png' : `https://img.youtube.com/vi/${item.source}/default.jpg`;
        const li = document.createElement('li');
        li.className = `queue-item ${item.active ? 'active' : ''}`;
        li.onclick = () => window.playFromQueue(deck, index);
        
        li.innerHTML = `
            <img class="queue-thumb" src="${thumb}" alt="thumb">
            <span class="queue-title" title="${item.title}">${item.title}</span>
            <div class="queue-actions">
                <button class="btn-retro queue-play" onclick="window.playFromQueue('${deck}', ${index}, event)">▶</button>
                <button class="btn-retro queue-remove" onclick="window.removeFromQueue('${deck}', ${index}, event)">×</button>
            </div>
        `;
        queueList.appendChild(li);
    });
}

function updateDeckTimers() {
    updateTimerDisplay('A');
    updateTimerDisplay('B');
    updateEQ();
}

function updateEQ() {
    const eqFills = document.querySelectorAll('.eq-fill');
    if (!eqFills.length) return;

    // Check if any deck is playing
    let playingVol = 0;
    const volA = 100 - parseInt(crossfader.value);
    const volB = parseInt(crossfader.value);

    // YouTube state: 1 = playing. Local state: !paused
    const ytA = playerA && playerA.getPlayerState && playerA.getPlayerState() === 1;
    const ytB = playerB && playerB.getPlayerState && playerB.getPlayerState() === 1;
    const locA = document.getElementById('local-player-a');
    const locB = document.getElementById('local-player-b');
    
    const isPlayingA = ytA || (locA && !locA.paused && locA.currentTime > 0);
    const isPlayingB = ytB || (locB && !locB.paused && locB.currentTime > 0);

    if (isPlayingA) playingVol = Math.max(playingVol, volA);
    if (isPlayingB) playingVol = Math.max(playingVol, volB);

    eqFills.forEach(fill => {
        if (playingVol > 0) {
            // Random bounce based on volume level
            const randomH = Math.random() * 0.5 + 0.5; // 50-100% of target
            fill.style.height = `${playingVol * randomH}%`;
        } else {
            fill.style.height = '0%';
        }
    });
}


function updateTimerDisplay(deck) {
    const ytPlayer = deck === 'A' ? playerA : playerB;
    const localPlayer = document.getElementById(`local-player-${deck.toLowerCase()}`);
    let current = 0, duration = 0;

    if (localPlayer && localPlayer.style.display !== 'none') {
        current = localPlayer.currentTime;
        duration = localPlayer.duration || 0;
    } else if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
        current = ytPlayer.getCurrentTime();
        duration = ytPlayer.getDuration() || 0;
    }

    const remaining = duration - current;
    const timerEl = document.getElementById(`timer-${deck.toLowerCase()}`);
    if (timerEl) {
        timerEl.textContent = `${formatTime(current)} / -${formatTime(remaining)}`;
    }
}


function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

setInterval(updateDeckTimers, 200); // Faster polling for EQ


// Sync, Reset, and UI Logic
document.getElementById('sync-btn').addEventListener('click', () => {
    // Complex sync for hybrid is hard, simple implementation:
    if (playerA && playerB) playerB.seekTo(playerA.getCurrentTime(), true);
});

document.getElementById('reset-btn').addEventListener('click', () => {
    crossfader.value = 50;
    updateMixerVolumes();
});

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

document.querySelectorAll('.window, .sticky-note').forEach(win => {
    const titleBar = win.querySelector('.title-bar, .sticky-header');
    if (!titleBar) return;
    let isDragging = false, offset = { x: 0, y: 0 };
    titleBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        offset.x = e.clientX - win.offsetLeft;
        offset.y = e.clientY - win.offsetTop;
        document.querySelectorAll('.window, .sticky-note').forEach(w => w.style.zIndex = 100);
        win.style.zIndex = 500;
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        win.style.left = (e.clientX - offset.x) + 'px';
        win.style.top = (e.clientY - offset.y) + 'px';
    });
    document.addEventListener('mouseup', () => isDragging = false);
});

window.resizeMixer = function(size) {
    const mixer = document.getElementById('mixer-window');
    if (size === 'small') {
        mixer.style.width = '700px';
    } else if (size === 'medium') {
        mixer.style.width = '900px';
    } else if (size === 'large') {
        mixer.style.width = '1200px';
    }
};

