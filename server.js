require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();

const upload = multer({
  storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json());

app.use("/music", express.static(__dirname + "/music"));
app.use("/covers", express.static(__dirname + "/covers"));

app.use(express.static(__dirname));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log("CLOUD NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API KEY:", process.env.CLOUDINARY_API_KEY);
console.log("SECRET EXISTE:", !!process.env.CLOUDINARY_API_SECRET);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

  console.log("MONGO_URI =>", process.env.MONGO_URI);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const playlistSchema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true
    },

    user_id: {
        type: String,
        default: null
    },

    descripcion: {
        type: String,
        default: ""
    },

    publica: {
        type: Boolean,
        default: false
    },

    canciones: {
        type: [String],
        default: []
    },

    fecha_creacion: {
        type: Date,
        default: Date.now
    }

});

const Playlist = mongoose.model("Playlist", playlistSchema);

const historySchema = new mongoose.Schema({

    user_id: {
        type: String,
        required: true
    },

    song_id: {
        type: String,
        required: true
    },

    fecha_reproduccion: {
        type: Date,
        default: Date.now
    },

    completada: {
        type: Boolean,
        default: false
    },

    origen: {
        type: String,
        default: "biblioteca"
    }

});

const History = mongoose.model("History", historySchema);

const recommendationSchema = new mongoose.Schema({

    user_id: String,

    algoritmo: String,

    canciones: [String],

    fecha_generada: {
        type: Date,
        default: Date.now
    }

});

const Recommendation = mongoose.model(
    "Recommendation",
    recommendationSchema
);


// ===== OBTENER PLAYLISTS =====
app.get("/playlists", async (req, res) => {

    try {

        const playlists = await Playlist.find();

        const resultado = {};

        playlists.forEach(p => {
            resultado[p.nombre] = p.canciones;
        });

        res.json(resultado);

    } catch(err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });
    }
});

// ===== GUARDAR PLAYLISTS =====
app.post("/playlists", async (req, res) => {

    try {

        const data = req.body;

        await Playlist.deleteMany({});

        const docs = Object.entries(data).map(([nombre, canciones]) => ({
            nombre,
            canciones
        }));

        if (docs.length > 0) {
            await Playlist.insertMany(docs);
        }

        res.json({
            ok: true
        });

    } catch(err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });
    }
});

// ===== ELIMINAR =====
app.delete("/playlists/:nombre", async (req, res) => {

    try {

        await Playlist.deleteOne({
            nombre: req.params.nombre
        });

        res.json({
            ok: true
        });

    } catch(err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });
    }
});

//songs
const songSchema = new mongoose.Schema({

    id: {
        type: String,
        required: true
    },

    titulo: {
        type: String,
        required: true
    },

    artista: {
        type: String,
        default: "Desconocido"
    },

    album: {
        type: String,
        default: "Sin álbum"
    },

    genero: {
        type: String,
        default: "Desconocido"
    },

    audioUrl: {
        type: String,
        required: true
    },

    portadaUrl: {
        type: String,
        default: null
    },

    duracion: {
        type: Number,
        default: 0
    },

    reproducciones: {
        type: Number,
        default: 0
    },

    likes: {
        type: Number,
        default: 0
    },

    tipo: {
        type: String,
        default: "global"
    },

    user_id: {
        type: String,
        default: null
    },

    fecha_agregada: {
        type: Date,
        default: Date.now
    }

});

const Song = mongoose.model("Song", songSchema);

//User
const userSchema = new mongoose.Schema({

    nombre: {
        type: String,
        required: true
    },

    username: {
        type: String,
        required: true,
        unique: true
    },

    correo: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    edad: Number,

    genero: String,

    perfil_musical: {

        generos_favoritos: {
            type: [String],
            default: []
        },

        artistas_favoritos: {
            type: [String],
            default: []
        },

        nivel_actividad: {
            type: Number,
            default: 0
        }

    },

    fecha_registro: {
        type: Date,
        default: Date.now
    },

    ultimo_acceso: {
        type: Date,
        default: Date.now
    }

});

const User = mongoose.model("User", userSchema);

app.post("/songs", async (req, res) => {
  try {

    console.log("BODY RECIBIDO:");
    console.log(req.body);

    const song = new Song(req.body);

    await song.save();

    console.log("SONG GUARDADA");

    res.json({ ok: true });

  } catch (err) {

    console.log("ERROR:");
    console.log(err);

    res.status(500).json({
      error: err.message
    });
  }
});

//enpoints//
app.get("/songs", async (req, res) => {

    try {

        const songs = await Song.find();

        res.json(songs);

    } catch(err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

});

//history

app.post("/history", async (req,res)=>{

    try{

        console.log(req.body);

        const history = new History(req.body);

        await history.save();

        res.json({
            ok:true
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

});