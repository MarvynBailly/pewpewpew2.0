// ── Scoreboard ───────────────────────────────────────────
// Uses Firebase Realtime Database REST API — no SDK needed.

const FIREBASE_URL  = "https://pewpewpew2-97853-default-rtdb.firebaseio.com";
const SCORE_LIMIT   = 10;

// ── Integrity token ───────────────────────────────────────
// djb2 hash of (score|time|name|salt).
// Firebase Rules can't verify crypto, so this is checked client-side on read.
// It filters out scores submitted directly via the REST API without the token,
// deterring casual console cheaters without requiring a server.
const _SALT = "ppp2_k7x9mQ3z";

function _makeToken(score, timeMs, name) {
    const str = `${score}|${Math.floor(timeMs)}|${name.trim()}|${_SALT}`;
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h |= 0;
    }
    return (h >>> 0).toString(36);
}

// ── Firebase helpers ──────────────────────────────────────
async function _submitScore(name, score, timeMs) {
    const entry = {
        name:  name.trim().slice(0, 20),
        score: Math.floor(score),
        time:  Math.floor(timeMs),
        token: _makeToken(Math.floor(score), Math.floor(timeMs), name),
    };
    const res = await fetch(`${FIREBASE_URL}/scores.json`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function _fetchTopScores() {
    // orderBy + limitToLast requires ".indexOn": ["score"] in Firebase Rules
    const url = `${FIREBASE_URL}/scores.json?orderBy="score"&limitToLast=${SCORE_LIMIT}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data) return [];
    return Object.values(data)
        .filter(e => {
            // Basic type check
            if (typeof e.score !== "number" || typeof e.name !== "string") return false;
            // Verify integrity token — entries without the correct token are silently dropped
            return e.token === _makeToken(e.score, e.time, e.name);
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, SCORE_LIMIT);
}

// ── Helpers ───────────────────────────────────────────────
function _fmt(ms) {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function _esc(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── DOM overlay (built once, shown/hidden) ────────────────
let _overlay    = null;
let _listEl     = null;
let _nameInput  = null;
let _submitBtn  = null;
let _submitForm = null;

let _currentScore     = 0;
let _currentTime      = 0;
let _scoreSubmitted   = false; // reset each new game

function _buildOverlay() {
    if (_overlay) return;

    // ── Outer overlay (full canvas cover) ──────────────────
    _overlay = document.createElement("div");
    Object.assign(_overlay.style, {
        display:        "none",
        position:       "absolute",
        inset:          "0",
        background:     "rgba(0, 0, 0, 0.82)",
        zIndex:         "100",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "monospace",
    });

    // ── Panel ───────────────────────────────────────────────
    const panel = document.createElement("div");
    Object.assign(panel.style, {
        background:   "rgba(8, 8, 24, 0.97)",
        border:       "1.5px solid rgba(255, 200, 60, 0.45)",
        borderRadius: "10px",
        padding:      "28px 36px",
        width:        "480px",
        color:        "#fff",
        boxSizing:    "border-box",
    });

    // Title
    const title = document.createElement("h2");
    title.textContent = "SCOREBOARD";
    Object.assign(title.style, {
        margin:        "0 0 18px",
        textAlign:     "center",
        fontSize:      "20px",
        letterSpacing: "5px",
        color:         "rgba(255, 210, 60, 0.95)",
    });
    panel.appendChild(title);

    // Score list container
    _listEl = document.createElement("div");
    Object.assign(_listEl.style, { minHeight: "220px", marginBottom: "18px" });
    panel.appendChild(_listEl);

    // ── Submit form ─────────────────────────────────────────
    _submitForm = document.createElement("div");
    Object.assign(_submitForm.style, {
        display:      "flex",
        gap:          "8px",
        marginBottom: "10px",
    });

    _nameInput = document.createElement("input");
    _nameInput.type        = "text";
    _nameInput.placeholder = "Enter your name";
    _nameInput.maxLength   = 20;
    Object.assign(_nameInput.style, {
        flex:         "1",
        background:   "rgba(255, 255, 255, 0.07)",
        border:       "1px solid rgba(255, 200, 60, 0.4)",
        borderRadius: "4px",
        color:        "#fff",
        fontFamily:   "monospace",
        fontSize:     "14px",
        padding:      "7px 10px",
        outline:      "none",
    });
    _submitForm.appendChild(_nameInput);

    _submitBtn = document.createElement("button");
    _submitBtn.textContent = "SUBMIT";
    Object.assign(_submitBtn.style, {
        background:    "rgba(255, 200, 60, 0.12)",
        border:        "1px solid rgba(255, 200, 60, 0.55)",
        borderRadius:  "4px",
        color:         "rgba(255, 210, 60, 0.95)",
        fontFamily:    "monospace",
        fontSize:      "14px",
        fontWeight:    "bold",
        padding:       "7px 18px",
        cursor:        "pointer",
        letterSpacing: "1px",
    });
    _submitBtn.addEventListener("click", _onSubmit);
    _submitForm.appendChild(_submitBtn);
    panel.appendChild(_submitForm);

    // Back button
    const backBtn = document.createElement("button");
    backBtn.textContent = "BACK";
    Object.assign(backBtn.style, {
        display:       "block",
        width:         "100%",
        background:    "rgba(255, 255, 255, 0.06)",
        border:        "1px solid rgba(255, 255, 255, 0.22)",
        borderRadius:  "4px",
        color:         "rgba(255, 255, 255, 0.65)",
        fontFamily:    "monospace",
        fontSize:      "14px",
        fontWeight:    "bold",
        padding:       "9px",
        cursor:        "pointer",
        letterSpacing: "2px",
    });
    backBtn.addEventListener("click", hideScoreboard);
    panel.appendChild(backBtn);

    _overlay.appendChild(panel);

    // Mount inside .canvas-wrap so it overlays the canvas exactly
    const wrap = document.querySelector(".canvas-wrap");
    if (wrap) {
        wrap.style.position = "relative";
        wrap.appendChild(_overlay);
    } else {
        document.body.appendChild(_overlay);
    }
}

async function _onSubmit() {
    const name = _nameInput.value.trim();
    if (!name) { _nameInput.focus(); return; }
    if (_scoreSubmitted) return;

    _submitBtn.textContent = "...";
    _submitBtn.disabled    = true;
    _nameInput.disabled    = true;

    try {
        await _submitScore(name, _currentScore, _currentTime);
        _scoreSubmitted           = true;
        _submitForm.style.display = "none";
        _loadScores();
    } catch (err) {
        console.error("Score submit failed:", err);
        _submitBtn.textContent = "FAILED";
        _submitBtn.disabled    = false;
        _nameInput.disabled    = false;
    }
}

function _renderScores(scores) {
    if (scores.length === 0) {
        _listEl.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.35);padding:50px 0;margin:0">No scores yet — be the first!</p>`;
        return;
    }

    const COL = "display:grid;grid-template-columns:32px 1fr 64px 64px;gap:6px;padding:6px 4px;font-size:13px";
    const BORDER_B = "border-bottom:1px solid rgba(255,255,255,0.07)";

    const header = `<div style="${COL};${BORDER_B};color:rgba(255,200,60,0.65);font-size:11px;letter-spacing:2px;padding-bottom:8px;margin-bottom:2px">
        <span>#</span><span>NAME</span><span style="text-align:right">SCORE</span><span style="text-align:right">TIME</span>
    </div>`;

    const rows = scores.map((s, i) => {
        const gold = i === 0;
        const col  = gold ? "rgba(255,220,60,0.95)" : "rgba(255,255,255,0.82)";
        return `<div style="${COL};${BORDER_B};color:${col}">
            <span>${gold ? "★" : i + 1}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(s.name)}</span>
            <span style="text-align:right">${s.score}</span>
            <span style="text-align:right">${_fmt(s.time)}</span>
        </div>`;
    }).join("");

    _listEl.innerHTML = header + rows;
}

async function _loadScores() {
    _listEl.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.35);padding:50px 0;margin:0">Loading...</p>`;
    try {
        _renderScores(await _fetchTopScores());
    } catch (err) {
        console.error("Fetch scores failed:", err);
        _listEl.innerHTML = `<p style="text-align:center;color:rgba(255,80,60,0.75);padding:50px 0;margin:0">Could not load scores</p>`;
    }
}

// ── Public API ────────────────────────────────────────────
function showScoreboard(currentScore, currentTime) {
    _buildOverlay();
    _currentScore = currentScore;
    _currentTime  = currentTime;

    // Show submit form only if the player has a score and hasn't submitted yet
    if (_scoreSubmitted || currentScore === 0) {
        _submitForm.style.display = "none";
    } else {
        _submitForm.style.display = "flex";
        _nameInput.value          = "";
        _nameInput.disabled       = false;
        _submitBtn.textContent    = "SUBMIT";
        _submitBtn.disabled       = false;
    }

    _overlay.style.display = "flex";
    _loadScores();
}

function hideScoreboard() {
    if (_overlay) _overlay.style.display = "none";
}

// Call this when the player starts a new game
function resetScoreboardSession() {
    _scoreSubmitted = false;
}
