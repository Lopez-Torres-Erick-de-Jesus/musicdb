let TRACKS = [];
let CURRENT_LIST = [];

async function cargarCarpeta() {
  try {
    const dir = await window.showDirectoryPicker();
    TRACKS = [];
    await scanDir(dir);
    CURRENT_LIST = [...TRACKS];
    renderTracks();
    renderPlaylists();

    showToast(`Cargadas ${TRACKS.length} canciones`, "info");

    if (typeof cargarSesion === "function") {
      setTimeout(() => cargarSesion(), 500);
    }

    if (typeof iniciarAutoGuardado === "function") {
      iniciarAutoGuardado();
    }
  } catch (err) {
    console.error("Error:", err);
    showToast("Acceso denegado o cancelado", "error");
  }
}

async function scanDir(dir, album = dir.name) {
  let cover = null;
  let localTracks = [];

  for await (const entry of dir.values()) {
    if (entry.kind === "file") {
      if (/folder\.jpg|cover\.jpg|album\.jpg|artwork\.jpg/i.test(entry.name)) {
        const file = await entry.getFile();
        cover = URL.createObjectURL(file);
        const songData = {
          id: songData.id,

          titulo: songData.titulo,

          album: album,
        };

        await fetch("/songs", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(songData),
        });
      }

      if (/\.(mp3|flac|wav|m4a|ogg)$/i.test(entry.name)) {
        const file = await entry.getFile();

        const songData = {
          id: crypto.randomUUID(),

          titulo: entry.name.replace(/\.[^/.]+$/, ""),

          album: album,
        };

        try {
          const response = await fetch("/songs", {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify(songData),
          });

          const result = await response.json();

          console.log(songs);

          console.log("SONG GUARDADA:");
          console.log(result);
        } catch (err) {
          console.error("ERROR GUARDANDO SONG:");
          console.error(err);
        }

        localTracks.push({
          id: songData.id,

          titulo: songData.titulo,

          album: songData.album,

          archivoRaw: file,

          portada: null,
        });
      }
    } else if (entry.kind === "directory") {
      await scanDir(entry, entry.name);
    }
  }

  localTracks.forEach((t) => (t.portada = cover));

  TRACKS.push(...localTracks);
}

async function cargarCancionesMongo() {

    try {

        const response = await fetch(
            "/songs"
        );

        const songs = await response.json();

        console.log(songs);

        TRACKS = songs.map(song => ({
            id: song.id,
            titulo: song.titulo,
            album: song.album,
            artista: song.artista,
            portada: song.portada || null,

            archivoRaw: null,

            archivoRemoto: song.audioUrl

        }));

        console.log(TRACKS);

        CURRENT_LIST = [...TRACKS];

        renderTracks();

        showToast(
            `${TRACKS.length} canciones cargadas desde MongoDB`,
            "info"
        );

    } catch(err) {

        console.error(err);

        showToast(
            "Error cargando canciones desde MongoDB",
            "error"
        );

    }

}

// =========================
// PLAYLISTS LOCALSTORAGE
// =========================

function getPlaylists() {
  return JSON.parse(localStorage.getItem("playlists") || "{}");
}
async function guardarPlaylists(data) {
  localStorage.setItem("playlists", JSON.stringify(data));

  try {
    const response = await fetch("/playlists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

function crearPlaylist(nombre) {
  if (!nombre) return;

  let p = getPlaylists();

  if (!p[nombre]) {
    p[nombre] = [];

    guardarPlaylists(p);

    renderPlaylists();

    showToast(`Playlist "${nombre}" creada`, "info");
  } else {
    showToast(`Ya existe una playlist con nombre "${nombre}"`, "warning");
  }
}

function crearPlaylistPrompt() {
  showPrompt("Nombre de la nueva playlist:", "Mi playlist", (nombre) => {
    if (nombre) {
      crearPlaylist(nombre);
    }
  });
}

function renderPlaylists() {
  const container = document.getElementById("playlists-container");

  const p = getPlaylists();

  const playlistNames = Object.keys(p);

  if (playlistNames.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                No hay playlists
                <br>
                <button 
                    class="btn-secondary" 
                    style="margin-top:12px"
                    onclick="crearPlaylistPrompt()"
                >
                    + Crear primera
                </button>
            </div>
        `;

    return;
  }

  container.innerHTML = playlistNames
    .map((n) => {
      const cantidad = Array.isArray(p[n]) ? p[n].length : 0;

      return `
            <div class="playlist-row" data-playlist="${escapeHtml(n).replace(/"/g, "&quot;")}">

                <span 
                    class="playlist-name" 
                    style="flex:1; cursor:pointer;"
                >
                    ${escapeHtml(n)}
                </span>

                <div class="playlist-actions">

                    <span class="playlist-count">
                        ${cantidad}
                    </span>

                    <button 
                        class="btn-playlist-del" 
                        data-name="${escapeHtml(n).replace(/"/g, "&quot;")}" 
                        title="Eliminar playlist"
                    >
                        X
                    </button>

                </div>
            </div>
        `;
    })
    .join("");

  document.querySelectorAll(".playlist-row").forEach((row) => {
    const playlistName = row.getAttribute("data-playlist");

    const nameSpan = row.querySelector(".playlist-name");

    const deleteBtn = row.querySelector(".btn-playlist-del");

    if (nameSpan) {
      nameSpan.onclick = (e) => {
        e.stopPropagation();

        verPlaylist(playlistName);
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = (e) => {
        e.stopPropagation();

        borrarPlaylist(playlistName);
      };
    }
  });
}

function borrarPlaylist(n) {
  showConfirm(`Eliminar la playlist "${n}"?`, () => {
    let p = getPlaylists();

    delete p[n];

    guardarPlaylists(p);

    renderPlaylists();

    if (window.currentPlaylist === n) {
      if (typeof volverBiblioteca === "function") {
        volverBiblioteca();
      }
    }

    showToast(`Playlist "${n}" eliminada`, "info");
  });
}

function escapeHtml(str) {
  if (!str) return "";

  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";

    if (m === "<") return "&lt;";

    if (m === ">") return "&gt;";

    return m;
  });
}


// =========================
// RECOMENDATION
// =========================


async function registrarReproduccion(songId){

    console.log("SONG ID:", songId);

    try{

        const response = await fetch(
            "/history",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({
                    user_id:"demo",
                    song_id:songId,
                    origen:"biblioteca"
                })
            }
        );

        const data = await response.json();

        console.log("RESPUESTA:", data);

    }catch(err){

        console.error(err);

    }

}