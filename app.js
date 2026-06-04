const audio = new Audio();
let current = 0;
let currentPlaylist = null;

// ========== SHUFFLE Y REPEAT ==========
let shuffleMode = false;
let repeatMode = false;

// ========== AUTO GUARDADO ==========
let autoSaveInterval = null;

// ========== WEB AUDIO FALLBACK ==========
let webAudioContext = null;
let webAudioSource = null;
let webAudioProgressInterval = null;

// ========== VISTA ÁLBUMES ==========
let vistaActual = 'tracks';
let listaOriginalAlbums = [];

// ========== SISTEMA DE NOTIFICACIONES ==========
function showToast(message, type = 'info', duration = 2500) {
    const toast = document.getElementById('custom-toast');
    if (toast) toast.remove();
    
    const newToast = document.createElement('div');
    newToast.id = 'custom-toast';
    newToast.className = 'toast-notification';
    if (type === 'error') newToast.classList.add('error');
    if (type === 'warning') newToast.classList.add('warning');
    
    let prefix = '';
    if (type === 'error') prefix = 'ERR: ';
    else if (type === 'warning') prefix = 'WARN: ';
    
    newToast.textContent = prefix + message;
    document.body.appendChild(newToast);
    
    newToast.offsetHeight;
    newToast.classList.add('show');
    
    setTimeout(() => {
        newToast.classList.remove('show');
        setTimeout(() => newToast.remove(), 300);
    }, duration);
}

function showConfirm(message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: #0a0a0c;
        border: 1px solid #2a2a2e;
        border-radius: 24px;
        padding: 28px;
        min-width: 320px;
        text-align: center;
    `;
    
    dialog.innerHTML = `
        <p style="margin-bottom: 24px; color: #fff; font-size: 15px;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="confirm-yes" style="background: #00f0ff; color: #000; border: none; padding: 10px 28px; border-radius: 40px; cursor: pointer; font-weight:600;">Aceptar</button>
            <button id="confirm-no" style="background: #2a2a2e; color: #fff; border: none; padding: 10px 28px; border-radius: 40px; cursor: pointer;">Cancelar</button>
        </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    document.getElementById('confirm-yes').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };
    document.getElementById('confirm-no').onclick = () => {
        modal.remove();
        if (onCancel) onCancel();
    };
}

function showPrompt(message, placeholder, onResult) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: #0a0a0c;
        border: 1px solid #2a2a2e;
        border-radius: 24px;
        padding: 28px;
        min-width: 340px;
    `;
    
    dialog.innerHTML = `
        <p style="margin-bottom: 20px; color: #fff; font-size: 15px;">${message}</p>
        <input id="prompt-input" type="text" placeholder="${placeholder || ''}" style="width: 100%; padding: 12px; background: #1a1a1e; border: 1px solid #2a2a2e; color: #fff; border-radius: 40px; margin-bottom: 24px; outline:none;">
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="prompt-cancel" style="background: #2a2a2e; color: #fff; border: none; padding: 8px 20px; border-radius: 40px; cursor: pointer;">Cancelar</button>
            <button id="prompt-ok" style="background: #00f0ff; color: #000; border: none; padding: 8px 20px; border-radius: 40px; cursor: pointer; font-weight:600;">Aceptar</button>
        </div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    const input = document.getElementById('prompt-input');
    input.focus();
    
    document.getElementById('prompt-ok').onclick = () => {
        const value = input.value;
        modal.remove();
        if (onResult) onResult(value);
    };
    document.getElementById('prompt-cancel').onclick = () => {
        modal.remove();
        if (onResult) onResult(null);
    };
    
    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            document.getElementById('prompt-ok').click();
        }
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatTime(s) {
    if (isNaN(s) || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// ========== RENDER CANCIONES ==========
function renderTracks() {
    const container = document.getElementById('tracks-container');
    if (!CURRENT_LIST || CURRENT_LIST.length === 0) {
        container.innerHTML = `<div class="empty-state-large"><div class="empty-icon">♪</div><p>No hay canciones. Carga una carpeta con música</p><button class="btn-primary" onclick="cargarCarpeta()">Seleccionar carpeta</button></div>`;
        document.getElementById('track-stats').innerHTML = '';
        return;
    }
    
    container.innerHTML = CURRENT_LIST.map((t, i) => `
        <div class="track-row" onclick="playIndex(${i})">
            <div>
                <div class="track-title">${escapeHtml(t.titulo)}</div>
                <div class="track-album">${escapeHtml(t.album)}</div>
            </div>
            <button class="btn-add" onclick="event.stopPropagation(); agregarTrack('${t.id}')" title="Añadir a playlist">+</button>
        </div>
    `).join('');
    
    document.getElementById('track-stats').innerHTML = `${CURRENT_LIST.length} canciones`;
}

// ========== PLAY ==========
async function playIndex(i) {
    if (i < 0 || i >= CURRENT_LIST.length) return;
    current = i;
    const t = CURRENT_LIST[i];

console.log("TRACK:", t);
console.log("TRACK ID:", t.id);

registrarReproduccion(t.id);


    if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
    if (webAudioContext) {
        try {
            if (webAudioSource) webAudioSource.stop();
            await webAudioContext.close();
        } catch(e) {}
        webAudioContext = null;
        webAudioSource = null;
    }

   if (audio.src) {
    try {
        URL.revokeObjectURL(audio.src);
    } catch(e) {}
}

if (t.archivoRaw) {

    audio.src = URL.createObjectURL(t.archivoRaw);

} else if (t.archivoRemoto) {

    audio.src = t.archivoRemoto;

} else {

    showToast("No existe archivo de audio", "error");
    return;
}
    
    document.getElementById('current-song-title').innerText = t.titulo;
    document.getElementById('player-artwork').style.backgroundImage = t.portada ? `url(${t.portada})` : 'none';
    document.getElementById('player-artwork').style.backgroundSize = 'cover';
    document.getElementById('player-artwork').style.backgroundPosition = 'center';
    document.getElementById('main-play-btn').innerHTML = "⏸";
    
    try {
        await audio.play();
    } catch (err) {
        console.warn("Normal mode failed, using Web Audio:", err);
        await playWithWebAudioFallback(t);
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: t.titulo,
            artist: t.album,
            artwork: [{ src: t.portada || '', sizes: '512x512' }]
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => saltar(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => saltar(1));
        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    }
    
    setTimeout(() => guardarSesion(), 100);

}

async function playWithWebAudioFallback(track) {
    try {
        audio.pause();
        
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        webAudioContext = new AudioContextClass();
        const arrayBuffer = await track.archivoRaw.arrayBuffer();
        const audioBuffer = await webAudioContext.decodeAudioData(arrayBuffer);
        
        webAudioSource = webAudioContext.createBufferSource();
        webAudioSource.buffer = audioBuffer;
        webAudioSource.connect(webAudioContext.destination);
        webAudioSource.start();
        
        document.getElementById('current-song-title').innerText = track.titulo;
        document.getElementById('main-play-btn').innerHTML = "⏸";
        
        webAudioSource.onended = () => {
            if (repeatMode && !shuffleMode) {
                playIndex(current);
            } else {
                saltar(1);
            }
        };
        
        startWebAudioProgress(audioBuffer.duration);
        
    } catch (err) {
        console.error("Web Audio failed:", err);
        showToast(`No se puede reproducir "${track.titulo}"`, "error");
        document.getElementById('main-play-btn').innerHTML = "▶";
    }
}

function startWebAudioProgress(duration) {
    if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
    
    let startTime = performance.now() / 1000;
    let pausedTime = 0;
    let isPaused = false;
    
    const updateProgress = () => {
        if (!webAudioContext || !webAudioSource) return;
        
        let elapsed;
        if (webAudioContext.state === 'running') {
            if (isPaused) {
                startTime = (performance.now() / 1000) - pausedTime;
                isPaused = false;
            }
            elapsed = (performance.now() / 1000) - startTime;
        } else {
            if (!isPaused) {
                pausedTime = (performance.now() / 1000) - startTime;
                isPaused = true;
            }
            elapsed = pausedTime;
        }
        
        elapsed = Math.min(elapsed, duration);
        const pct = (elapsed / duration) * 100;
        
        document.getElementById('progress-fill').style.width = Math.min(100, pct) + "%";
        document.getElementById('time-display').innerHTML = `${formatTime(elapsed)} / ${formatTime(duration)}`;
        
        if (elapsed < duration) {
            webAudioProgressInterval = setTimeout(updateProgress, 100);
        }
    };
    
    updateProgress();
}

function togglePlay() {
    if (webAudioContext) {
        if (webAudioContext.state === 'running') {
            webAudioContext.suspend();
            document.getElementById('main-play-btn').innerHTML = "▶";
        } else {
            webAudioContext.resume();
            document.getElementById('main-play-btn').innerHTML = "⏸";
            if (webAudioSource && webAudioSource.buffer) {
                if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
                startWebAudioProgress(webAudioSource.buffer.duration);
            }
        }
        return;
    }
    
    if (!audio.src) return;
    if (audio.paused) { 
        audio.play(); 
        document.getElementById('main-play-btn').innerHTML = "⏸"; 
    } else { 
        audio.pause(); 
        document.getElementById('main-play-btn').innerHTML = "▶"; 
    }
}

function saltar(dir) {
    if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
    if (webAudioContext) {
        try {
            if (webAudioSource) webAudioSource.stop();
            webAudioContext.close();
        } catch(e) {}
        webAudioContext = null;
        webAudioSource = null;
    }
    
    if (shuffleMode && dir === 1) {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * CURRENT_LIST.length);
        } while (newIndex === current && CURRENT_LIST.length > 1);
        playIndex(newIndex);
        return;
    }
    
    if (repeatMode && dir === 1 && current + 1 >= CURRENT_LIST.length) {
        playIndex(0);
        return;
    }
    
    playIndex(current + dir);
}

function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    
    if (webAudioContext && webAudioSource && webAudioSource.buffer) {
        const duration = webAudioSource.buffer.duration;
        const newTime = pct * duration;
        const wasPlaying = (webAudioContext.state === 'running');
        
        const newSource = webAudioContext.createBufferSource();
        newSource.buffer = webAudioSource.buffer;
        newSource.connect(webAudioContext.destination);
        newSource.start(0, newTime);
        
        try { webAudioSource.stop(); } catch(e) {}
        webAudioSource = newSource;
        
        if (wasPlaying) webAudioContext.resume();
        else webAudioContext.suspend();
        
        webAudioSource.onended = () => {
            if (repeatMode && !shuffleMode) playIndex(current);
            else saltar(1);
        };
        
        if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
        startWebAudioProgress(duration);
        return;
    }
    
    if (audio.duration && !isNaN(audio.duration)) {
        audio.currentTime = pct * audio.duration;
    }
}

audio.ontimeupdate = () => {
    if (audio.duration && !webAudioContext) {
        const pct = (audio.currentTime / audio.duration) * 100;
        document.getElementById('progress-fill').style.width = pct + "%";
        document.getElementById('time-display').innerHTML = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
};

function ajustarVolumen(v) { 
    audio.volume = parseFloat(v);
    localStorage.setItem('player_volume', v);
}

function cargarVolumen() {
    const vol = localStorage.getItem('player_volume');
    if (vol !== null) {
        audio.volume = parseFloat(vol);
        const slider = document.getElementById('volume-slider');
        if (slider) slider.value = vol;
    }
}

function buscarTrack() {
    const q = document.getElementById('buscador').value.toLowerCase().trim();
    if (!q) {
        CURRENT_LIST = TRACKS;
    } else {
        CURRENT_LIST = TRACKS.filter(t => 
            t.titulo.toLowerCase().includes(q) || 
            t.album.toLowerCase().includes(q)
        );
    }
    renderTracks();
    document.getElementById('search-count').innerHTML = `${CURRENT_LIST.length} canciones`;
}

// ========== PLAYLISTS ==========
function verPlaylist(nombre)  {
    const p = getPlaylists();
    const tracksGuardados = p[nombre] || [];
    
    let cancionesEncontradas = [];
    
    for (const item of tracksGuardados) {
        let track = null;
        
        if (typeof item === 'object' && item.id) {
            track = TRACKS.find(t => t.id === item.id);
        }
        if (!track && typeof item === 'object' && item.titulo) {
            track = TRACKS.find(t => t.titulo === item.titulo);
        }
        if (!track && typeof item === 'string' && item.length > 30) {
            track = TRACKS.find(t => t.id === item);
        }
        if (!track && typeof item === 'string') {
            track = TRACKS.find(t => t.titulo === item);
        }
        
        if (track) {
            cancionesEncontradas.push(track);
        }
    }
    
    if (cancionesEncontradas.length === 0 && tracksGuardados.length > 0) {
        showToast(`No se encontraron canciones para "${nombre}"`, "warning");
    }
    
    CURRENT_LIST = cancionesEncontradas;
    renderTracks();
    currentPlaylist = nombre;
    document.querySelector('.btn-back').style.display = "flex";
    
    const toast = document.getElementById('current-view-toast');
    toast.innerHTML = `Viendo playlist: ${nombre} (${cancionesEncontradas.length} canciones)`;
    toast.style.opacity = '1';
    setTimeout(() => toast.style.opacity = '0', 2000);
}

function volverBiblioteca() {
    CURRENT_LIST = TRACKS;
    renderTracks();
    currentPlaylist = null;
    document.querySelector('.btn-back').style.display = "none";
    // Restaurar botón de vista si estaba en álbumes
    vistaActual = 'tracks';
    const toggleBtn = document.getElementById('toggle-view-btn');
    if (toggleBtn) toggleBtn.innerHTML = '🎵 Ver álbumes';
}

async function agregarTrack(id){
    const playlists = getPlaylists();
    const playlistNames = Object.keys(playlists);
    const track = TRACKS.find(t => t.id === id);
    
    if (!track) {
        showToast("Error: No se encontró la canción", "error");
        return;
    }
    
    if (playlistNames.length === 0) {
        showConfirm("No hay playlists. ¿Crear una ahora?", () => {
            showPrompt("Nombre de la nueva playlist:", "Mi playlist", (nombre) => {
                if (nombre) {
                    crearPlaylist(nombre);
                    setTimeout(() => agregarTrack(id), 100);
                }
            });
        });
        return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    const panel = document.createElement('div');
    panel.style.cssText = `
        background: var(--bg-card);
        border-radius: 24px;
        width: 300px;
        max-width: 90%;
        max-height: 70%;
        overflow: auto;
        padding: 20px;
    `;
    
    panel.innerHTML = `
        <h3 style="margin-bottom: 16px; color: var(--accent);">Añadir a playlist</h3>
        ${playlistNames.map(n => `
            <div class="playlist-opt" data-name="${n.replace(/"/g, '&quot;')}" style="
                padding: 12px;
                margin: 4px 0;
                cursor: pointer;
                border-radius: 12px;
                background: var(--border-light);
                text-align: center;
            ">${escapeHtml(n)}</div>
        `).join('')}
        <div class="playlist-opt" id="new-playlist-opt" style="
            padding: 12px;
            margin-top: 12px;
            cursor: pointer;
            border-radius: 12px;
            background: var(--accent-glow);
            text-align: center;
            color: var(--accent);
        ">+ Crear nueva playlist</div>
        <button id="close-modal-btn" style="
            margin-top: 16px;
            width: 100%;
            padding: 10px;
            background: var(--border-light);
            border: none;
            border-radius: 12px;
            cursor: pointer;
            color: var(--text-primary);
        ">Cancelar</button>
    `;
    
    modal.appendChild(panel);
    document.body.appendChild(modal);
    
    document.querySelectorAll('.playlist-opt').forEach(opt => {
    if (opt.id !== 'new-playlist-opt') {

        opt.onclick = async () => {

            const nombre = opt.getAttribute('data-name');

            const playlistsActuales = getPlaylists();

            const yaExiste = playlistsActuales[nombre].some(item => {
                if (typeof item === 'object') {
                    return item.id === id;
                }

                return item === id || item === track.titulo;
            });

            if (!yaExiste) {

                playlistsActuales[nombre].push({
                    id: id,
                    titulo: track.titulo
                });

                await guardarPlaylists(playlistsActuales);

                renderPlaylists();

                showToast(`"${track.titulo}" añadida a "${nombre}"`, "info");

            } else {

                showToast(`Esta canción ya está en "${nombre}"`, "warning");

            }

            modal.remove();
        };
    }
});
    
    document.getElementById('new-playlist-opt').onclick = () => {
        modal.remove();
        showPrompt("Nombre de la nueva playlist:", "Mi playlist", (nombre) => {
            if (nombre) {
                crearPlaylist(nombre);
                setTimeout(() => agregarTrack(id), 200);
            }
        });
    };
    
    document.getElementById('close-modal-btn').onclick = () => modal.remove();
}

function exportarPlaylist() {
    if (!currentPlaylist) {
        showToast("Abre una playlist primero", "warning");
        return;
    }
    
    const playlists = getPlaylists();
    const trackItems = playlists[currentPlaylist] || [];
    const tracks = TRACKS.filter(t => trackItems.some(item => {
        if (typeof item === 'object') return item.id === t.id;
        return item === t.id || item === t.titulo;
    }));
    
    if (tracks.length === 0) {
        showToast("La playlist está vacía", "warning");
        return;
    }
    
    let m3uContent = "#EXTM3U\n";
    tracks.forEach(track => {
        m3uContent += `#EXTINF:0,${track.titulo} - ${track.album}\n`;
        m3uContent += `${track.titulo}.mp3\n`;
    });
    
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPlaylist}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`"${currentPlaylist}" exportada`, "info");
}

async function importarM3U(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const lines = e.target.result.split(/\r?\n/);
        let playlistName = file.name.replace(/\.m3u$/i, '');
        
        showPrompt("Nombre para la playlist:", playlistName, (nombre) => {
            if (!nombre) return;
            
            const rutas = lines.filter(line => line && !line.startsWith('#'));
            const addedTracks = [];
            
            rutas.forEach(ruta => {
                let nombreArchivo = ruta.split(/[\\\/]/).pop().replace(/\.[^/.]+$/, '');
                nombreArchivo = decodeURIComponent(nombreArchivo);
                const track = TRACKS.find(t => 
                    t.titulo.toLowerCase() === nombreArchivo.toLowerCase() ||
                    t.titulo.toLowerCase().includes(nombreArchivo.toLowerCase())
                );
                if (track && !addedTracks.includes(track.id)) addedTracks.push(track.id);
            });
            
            if (addedTracks.length > 0) {
                let playlists = getPlaylists();
                playlists[nombre] = [...new Set([...(playlists[nombre] || []), ...addedTracks])];
                guardarPlaylists(playlists);
                renderPlaylists();
                showToast(`Importada "${nombre}" (${addedTracks.length} canciones)`, "info");
            } else {
                showToast("No se encontraron canciones coincidentes", "warning");
            }
        });
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ========== SHUFFLE / REPEAT ==========
function toggleShuffle() {
    shuffleMode = !shuffleMode;
    const btn = document.getElementById('shuffle-btn');
    if (shuffleMode) {
        btn.classList.add('active');
        showToast("Modo aleatorio activado", "info");
    } else {
        btn.classList.remove('active');
        showToast("Modo aleatorio desactivado", "info");
    }
}

function toggleRepeat() {
    repeatMode = !repeatMode;
    const btn = document.getElementById('repeat-btn');
    if (repeatMode) {
        btn.classList.add('active');
        showToast("Modo repetición activado", "info");
    } else {
        btn.classList.remove('active');
        showToast("Modo repetición desactivado", "info");
    }
}

// ========== BOTONES +10 / -10 ==========
function adelantar10() {
    if (webAudioContext && webAudioSource && webAudioSource.buffer) {
        const currentTime = webAudioContext.currentTime;
        const duration = webAudioSource.buffer.duration;
        let newTime = currentTime + 10;
        if (newTime >= duration) {
            saltar(1);
            return;
        }
        const wasPlaying = webAudioContext.state === 'running';
        const newSource = webAudioContext.createBufferSource();
        newSource.buffer = webAudioSource.buffer;
        newSource.connect(webAudioContext.destination);
        newSource.start(0, newTime);
        webAudioSource.stop();
        webAudioSource = newSource;
        if (wasPlaying) webAudioContext.resume();
        if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
        startWebAudioProgress(duration);
        showToast("Adelantar +10 segundos", "info");
    } else if (audio.duration) {
        let newTime = audio.currentTime + 10;
        if (newTime >= audio.duration) {
            saltar(1);
            return;
        }
        audio.currentTime = newTime;
        showToast("Adelantar +10 segundos", "info");
    }
}

function retroceder10() {
    if (webAudioContext && webAudioSource && webAudioSource.buffer) {
        const currentTime = webAudioContext.currentTime;
        let newTime = Math.max(0, currentTime - 10);
        const wasPlaying = webAudioContext.state === 'running';
        const newSource = webAudioContext.createBufferSource();
        newSource.buffer = webAudioSource.buffer;
        newSource.connect(webAudioContext.destination);
        newSource.start(0, newTime);
        webAudioSource.stop();
        webAudioSource = newSource;
        if (wasPlaying) webAudioContext.resume();
        if (webAudioProgressInterval) clearInterval(webAudioProgressInterval);
        startWebAudioProgress(webAudioSource.buffer.duration);
        showToast("Retroceder -10 segundos", "info");
    } else if (audio.duration) {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        showToast("Retroceder -10 segundos", "info");
    }
}

// ========== VISTA ÁLBUMES CORREGIDA ==========
function toggleVista() {
    if (vistaActual === 'tracks') {
        // Guardar lista actual antes de cambiar
        listaOriginalAlbums = [...CURRENT_LIST];
        vistaActual = 'albums';
        renderAlbums();
        const btn = document.getElementById('toggle-view-btn');
        if (btn) btn.innerHTML = '🎨 Ver canciones';
    } else {
        vistaActual = 'tracks';
        // Restaurar lista original si existe
        if (listaOriginalAlbums.length > 0 && CURRENT_LIST !== listaOriginalAlbums) {
            CURRENT_LIST = listaOriginalAlbums;
        }
        renderTracks();
        const btn = document.getElementById('toggle-view-btn');
        if (btn) btn.innerHTML = '🎵 Ver álbumes';
    }
}

function renderAlbums() {
    const container = document.getElementById('tracks-container');
    const albumsMap = new Map();
    
    // Usar TRACKS completo para mostrar todos los álbumes
    const sourceList = CURRENT_LIST.length > 0 ? CURRENT_LIST : TRACKS;
    
    sourceList.forEach(track => {
        if (!albumsMap.has(track.album)) {
            albumsMap.set(track.album, {
                nombre: track.album,
                portada: track.portada,
                canciones: []
            });
        }
        albumsMap.get(track.album).canciones.push(track);
    });
    
    const albums = Array.from(albumsMap.values());
    
    if (albums.length === 0) {
        container.innerHTML = `<div class="empty-state-large"><div class="empty-icon">🎵</div><p>No hay álbumes para mostrar</p></div>`;
        return;
    }
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; padding: 8px;">
            ${albums.map(album => `
                <div class="album-card" data-album="${escapeHtml(album.nombre).replace(/"/g, '&quot;')}" style="
                    background: var(--bg-card);
                    border-radius: 16px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-align: center;
                    border: 1px solid var(--border-color);
                ">
                    <div style="
                        width: 100%;
                        aspect-ratio: 1;
                        background: ${album.portada ? `url(${album.portada}) center/cover` : 'linear-gradient(135deg, var(--accent-glow), var(--bg-tertiary))'};
                        border-radius: 12px;
                        margin-bottom: 12px;
                    "></div>
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(album.nombre)}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${album.canciones.length} canciones</div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.querySelectorAll('.album-card').forEach(card => {
        card.onclick = (e) => {
            e.stopPropagation();
            const albumNombre = card.getAttribute('data-album');
            const albumTracks = TRACKS.filter(t => t.album === albumNombre);
            CURRENT_LIST = albumTracks;
            renderTracks();
            // Cambiar vista a tracks pero mantener botón correcto
            vistaActual = 'tracks';
            const toggleBtn = document.getElementById('toggle-view-btn');
            if (toggleBtn) toggleBtn.innerHTML = '🎵 Ver álbumes';
            showToast(`Mostrando álbum: ${albumNombre} (${albumTracks.length} canciones)`, "info");
        };
        card.onmouseenter = () => { card.style.transform = 'translateY(-4px)'; card.style.borderColor = 'var(--accent)'; };
        card.onmouseleave = () => { card.style.transform = 'translateY(0)'; card.style.borderColor = 'var(--border-color)'; };
    });
}

function crearBotonVista() {
    let btn = document.getElementById('toggle-view-btn');
    if (!btn) {
        const header = document.querySelector('.tracks-panel .panel-header');
        if (header) {
            btn = document.createElement('button');
            btn.id = 'toggle-view-btn';
            btn.className = 'icon-btn';
            btn.onclick = toggleVista;
            btn.innerHTML = '🎵 Ver álbumes';
            header.appendChild(btn);
        }
    }
}

// ========== SESIÓN ==========
function guardarSesion() {
    try {
        const session = {
            lastTrackIndex: current,
            lastTrackId: CURRENT_LIST[current]?.id,
            lastTime: audio.currentTime || 0,
            volume: audio.volume,
            shuffleMode: shuffleMode,
            repeatMode: repeatMode,
            timestamp: Date.now()
        };
        localStorage.setItem('high_fidelity_session', JSON.stringify(session));
    } catch(e) {}
}

function guardarSesionManual() {
    guardarSesion();
    showToast("Posición guardada", "info");
}

async function cargarSesion() {
    const session = localStorage.getItem('high_fidelity_session');
    if (!session) return;
    
    const data = JSON.parse(session);
    if (Date.now() - data.timestamp > 86400000) return;
    if (TRACKS.length === 0) {
        setTimeout(cargarSesion, 500);
        return;
    }
    
    showConfirm(`Reanudar última sesión?\n\n${new Date(data.timestamp).toLocaleTimeString()}`, async () => {
        audio.volume = data.volume;
        document.getElementById('volume-slider').value = data.volume;
        
        shuffleMode = data.shuffleMode || false;
        repeatMode = data.repeatMode || false;
        if (shuffleMode) document.getElementById('shuffle-btn')?.classList.add('active');
        if (repeatMode) document.getElementById('repeat-btn')?.classList.add('active');
        
        if (data.lastTrackIndex < CURRENT_LIST.length) {
            await playIndex(data.lastTrackIndex);
            setTimeout(() => {
                if (audio.duration && data.lastTime < audio.duration) {
                    audio.currentTime = data.lastTime;
                }
            }, 200);
        }
        showToast("Sesión restaurada", "info");
    });
}

function iniciarAutoGuardado() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        if (TRACKS.length > 0 && audio.src) guardarSesion();
    }, 15000);
}

audio.addEventListener('pause', () => {
    if (TRACKS.length > 0 && audio.src) guardarSesion();
});

audio.onended = () => {
    if (repeatMode && !shuffleMode) playIndex(current);
    else saltar(1);
};

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {

    await cargarCancionesMongo();

    cargarVolumen();

    if (typeof renderPlaylists === 'function') {
        renderPlaylists();
    }

    setTimeout(() => {

        if (TRACKS.length > 0) {

            iniciarAutoGuardado();

            cargarSesion();

        }

        crearBotonVista();

    }, 500);

});