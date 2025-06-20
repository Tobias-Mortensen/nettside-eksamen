const express = require("express");
const path = require("path");
const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const port = 3200;
const server = http.createServer(app);

/** Serverer statiske filer fra public-mappen */
app.use(express.static(path.join(__dirname, "public")));

/** Middleware for å tolke JSON- og URL-kodet data */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Konfigurerer sesjonshåndtering */
app.use(
    session({
        secret: "ecodatahemmeligNøkkel",
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
);

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect("/login");
    }
}

/** Kobler til SQLite-database */
const db = new sqlite3.Database("datamaskin.db", (err) => {
    if (err) {
        console.error("Feil ved tilkobling til database:", err.message);
    } else {
        console.log("Koblet til SQLite-database.");
    }
});

// Opprett tabellen Enhet hvis den ikke finnes
const createEnhetTable = `CREATE TABLE IF NOT EXISTS Enhet (
    ID INTEGER PRIMARY KEY,
    modell TEXT,
    serienummer TEXT,
    status TEXT,
    "batteri-helse" TEXT,
    "skjerm-størrelse" TEXT
);`;
db.run(createEnhetTable, (err) => {
    if (err) {
        console.error("Feil ved oppretting av Enhet-tabell:", err.message);
    }
});

/** Rute: Viser forsiden (kun for autentiserte brukere) */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "view", "index.html"));
});


/** Rute: Viser innloggingssiden */
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "view", "login.html"));
});

/** Rute: Viser siden for å opprette ny bruker */
app.get("/ny-bruker", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "view", "ny-bruker.html"));
});

app.get("/registrer", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "view", "registrer-enhet.html"));
});

/** Rute: Viser privat side (kun for autentiserte brukere) */
app.get("/privat", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "view", "privat.html"));
});

// Oppdater enhet
app.post("/oppdater-enhet", (req, res) => {
    const { id, modell, serienummer, status, "batteri-helse": batteriHelse, "skjerm-størrelse": skjermStorrelse } = req.body;
    const sql = `UPDATE Enhet SET modell=?, serienummer=?, status=?, "batteri-helse"=?, "skjerm-størrelse"=? WHERE ID=?`;
    db.run(sql, [modell, serienummer, status, batteriHelse, skjermStorrelse, id], function (err) {
        if (err) {
            console.error("Databasefeil:", err.message);
        }
        res.redirect("/privat");
    });
});

// Slett enhet
app.post("/slett-enhet", (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM Enhet WHERE id=?", [id], function (err) {
        if (err) {
            console.error("Databasefeil:", err.message);
        }
        res.redirect("/privat");
    });
});

/** Rute: Logger ut brukeren og avslutter sesjonen */
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.clearCookie("connect.sid");
    res.redirect("/login");
});

/**
 * Rute: Håndterer innlogging
 * Sjekker epost og passord mot databasen
 */
app.post("/login", async (req, res) => {
    const { epost, passord } = req.body;
    if (!epost || !passord) {
        return res.redirect("/login?error=Mangler data fra skjema");
    }
    const sql = "SELECT * FROM Bruker WHERE Epost = ?";
    db.get(sql, [epost], async (err, row) => {
        if (err) {
            console.error("Databasefeil:", err.message);
            return res.redirect("/login?error=En uventet feil har oppstått");
        }
        if (row && await bcrypt.compare(passord, row.Passord)) {
            req.session.user = {
                id: row.ID_bruker,
                navn: row.Navn,
                epost: row.Epost
            };
            res.redirect("/privat");
        } else {
            res.redirect("/login?error=Ugyldig epost eller passord");
        }
    });
});

/**
 * Rute: Håndterer registrering av ny bruker
 * Lagrer brukeren i databasen med kryptert passord
 */
app.post("/ny-bruker", async (req, res) => {
    const { epost, navn, passord } = req.body;
    if (!epost || !passord || !navn) {
        return res.redirect("/login?error=Mangler data fra skjema");
    }
    const sql = "INSERT INTO Bruker (Navn, Epost, Passord) VALUES (?, ?, ?)";
    const hashedPassword = await bcrypt.hash(passord, 10);
    db.run(sql, [navn, epost, hashedPassword], function (err) {
        if (err) {
            console.error("Databasefeil:", err.message);
            return res.redirect("/login?error=En uventet feil har oppstått");
        }
        req.session.user = { id: this.lastID, navn, epost };
        res.redirect("/?melding=Bruker opprettet");
    });
});

/**
 * Rute: Håndterer registrering av enhet
 * Lagrer enheten i databasen
 */
app.post("/registrer-enhet", (req, res) => {
    const { modell, serienummer, status, "batteri-helse": batteriHelse, "skjerm-størrelse": skjermStorrelse } = req.body;
    console.log("Mottatt fra skjema:", { modell, serienummer, status, batteriHelse, skjermStorrelse });
    if (!modell || !batteriHelse || !serienummer || !status || !skjermStorrelse) {
        return res.status(400).send("Mangler data fra skjema");
    }
    const sql = `INSERT INTO Enhet (modell, serienummer, status, "batteri-helse", "skjerm-størrelse") VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [modell, serienummer, status, batteriHelse, skjermStorrelse], function (err) {
        if (err) {
            console.error("Databasefeil:", err.message);
            return res.status(500).send("Databasefeil: " + err.message);
        }
        console.log("Enhet lagt til i databasen, id:", this.lastID);
        res.redirect("/privat");
    });
});

// API endpoint for all devices (enheter)
app.get('/api/enheter', isAuthenticated, (req, res) => {
    db.all('SELECT * FROM Enhet', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Husk å sette opp view engine for EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "view"));

/** Starter serveren */
server.listen(port, () => {
    console.log(`Server kjører på http://localhost:${port}`);
});
