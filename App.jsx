import { useState, useRef, useEffect, createContext, useContext } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════════════════ */
const MODEL = "claude-opus-4-5";
const ExportCtx = createContext({ emailDest: "", exportMode: "local" });

const TENDERS_INIT = [
  {
    id: "ao1", reference: "MEN/2026/IT/045", statut: "Ouvert", secteur: "Informatique",
    titre: "Fourniture et installation d equipements informatiques",
    organisme: "Ministere de l Education Nationale", budget: "2 500 000 MAD",
    dateLimite: "2026-04-15", region: "Rabat", type: "Appel d offres ouvert",
    description: "Fourniture, installation et mise en service d equipements informatiques pour les etablissements scolaires publics. Formation du personnel et maintenance 2 ans incluses.",
    criteres: ["Capacite technique", "References similaires", "Prix", "Delai"],
    documents: ["CPS", "RC", "Bordereau des prix", "CCAG-T"],
    sourceNotes: "", srcFileName: "", srcContent: "", decision: null, etapes: {}
  },
  {
    id: "ao2", reference: "ONDA/2026/SI/012", statut: "Ouvert", secteur: "Digital SI",
    titre: "Developpement d une plateforme numerique de gestion RH",
    organisme: "Office National des Aeroports", budget: "4 800 000 MAD",
    dateLimite: "2026-04-20", region: "Casablanca", type: "Appel d offres ouvert",
    description: "Conception, developpement et deploiement d une plateforme digitale integree de gestion RH incluant conges, paie, evaluation, formation et recrutement. Compatible SAP existant.",
    criteres: ["Architecture technique", "Experience equipe", "Methodologie", "Prix"],
    documents: ["CPS", "RC", "CCAG-EMO", "Specifications fonctionnelles"],
    sourceNotes: "", srcFileName: "", srcContent: "", decision: null, etapes: {}
  },
  {
    id: "ao3", reference: "BAM/2026/SEC/008", statut: "Ouvert", secteur: "Cybersecurite",
    titre: "Prestations de cybersecurite et audit SI",
    organisme: "Bank Al-Maghrib", budget: "1 200 000 MAD",
    dateLimite: "2026-04-25", region: "Rabat", type: "Appel d offres restreint",
    description: "Audit de securite complet du SI : tests d intrusion, audit de code, conformite PCI-DSS et ISO 27001, SOC externe 24/7.",
    criteres: ["Certifications CISSP CISM", "References bancaires", "Methodologie", "Prix"],
    documents: ["CPS", "RC", "NDA", "Bordereau des prix"],
    sourceNotes: "", srcFileName: "", srcContent: "", decision: null, etapes: {}
  },
  {
    id: "ao4", reference: "ANRC/2026/CLOUD/003", statut: "Nouveau", secteur: "Cloud",
    titre: "Maintenance et support des infrastructures cloud",
    organisme: "Agence Nationale du Registre du Commerce", budget: "900 000 MAD",
    dateLimite: "2026-05-01", region: "Casablanca", type: "Appel d offres ouvert",
    description: "Maintenance des infrastructures cloud Azure et AWS, support N2/N3, gestion des incidents, optimisation FinOps.",
    criteres: ["Certifications cloud", "SLA propose", "Equipe dediee", "Prix"],
    documents: ["CPS", "RC", "CCAG-T", "Annexe SLA"],
    sourceNotes: "", srcFileName: "", srcContent: "", decision: null, etapes: {}
  }
];

const SECTEURS = ["Tous", "Informatique", "Digital SI", "Cybersecurite", "Cloud", "Autres"];
const STATUTS  = ["Tous", "Ouvert", "Nouveau", "Cloture"];

/* ═══════════════════════════════════════════════════════════════════════════
   API CLAUDE
═══════════════════════════════════════════════════════════════════════════ */
const callClaude = async (system, userMsg, apiKey) => {
  if (!apiKey || !apiKey.startsWith("sk-")) throw new Error("Cle API invalide. Configurez-la dans l onglet API.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userMsg }]
    })
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error("Erreur API " + r.status + " : " + err.slice(0, 200));
  }
  const d = await r.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
};

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT PDF NATIF
═══════════════════════════════════════════════════════════════════════════ */
const buildPDF = (tender, text, docType) => {
  const fin   = docType === "financiere";
  const title = fin ? "OFFRE FINANCIERE" : "OFFRE TECHNIQUE";
  const esc   = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const strip = s => String(s || "").replace(/\*\*/g, "").replace(/[\r\n]+/g, " ").trim();
  const dl    = new Date(tender.dateLimite).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const infoRows = [
    ["Reference AO", tender.reference], ["Organisme", tender.organisme],
    ["Budget", tender.budget], ["Date limite", dl],
    ["Region", tender.region], ["Type", tender.type]
  ].map(([l, v]) =>
    "<div class='row'><span class='rl'>" + esc(l) + "</span><span class='rv'>" + esc(strip(v)) + "</span></div>"
  ).join("");

  let body = "";
  (text || "").split("\n").forEach(line => {
    const t = line.trim();
    if (!t) { body += "<div class='sp'></div>"; return; }
    if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(t)) { body += "<h2 class='h2'>" + esc(strip(t)) + "</h2>"; return; }
    if (/^\d+\.\s/.test(t))                 { body += "<h3 class='h3'>" + esc(strip(t)) + "</h3>"; return; }
    if (t[0] === "-" || t.charCodeAt(0) === 8226) {
      body += "<p class='bul'>&#8226; " + esc(strip(t.replace(/^[-\u2022]\s*/, ""))) + "</p>"; return;
    }
    body += "<p class='txt'>" + esc(strip(t)) + "</p>";
  });

  return [
    "<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'>",
    "<title>" + esc(title) + " - " + esc(tender.reference) + "</title>",
    "<style>",
    "*{box-sizing:border-box;margin:0;padding:0}",
    "body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111;padding:20mm}",
    ".cov{background:#0D1B3E;color:#fff;padding:40px;margin:-20mm -20mm 28px;text-align:center}",
    ".ct{font-size:26pt;font-weight:bold;margin:10px 0}",
    ".cs{font-size:10.5pt;color:#C8D8F0;margin:5px 0}",
    ".co{font-size:13pt;color:#F59E0B;margin-top:12px;font-weight:bold}",
    ".ref{background:#1A3A6A;color:#C8D8F0;font-size:8pt;padding:3px 9px;margin-top:7px;display:inline-block;border-radius:3px}",
    ".h1{font-size:14pt;font-weight:bold;color:#0D1B3E;border-bottom:2.5px solid #C87B00;padding-bottom:5px;margin:18px 0 10px}",
    ".h2{font-size:12pt;font-weight:bold;color:#0D1B3E;border-bottom:1px solid #C87B00;padding-bottom:3px;margin:13px 0 6px}",
    ".h3{font-size:10.5pt;font-weight:bold;color:#1A3A6A;margin:10px 0 4px}",
    ".txt{font-size:10pt;line-height:1.75;margin:3px 0}",
    ".bul{font-size:10pt;line-height:1.6;margin:2px 0 2px 18px}",
    ".sp{height:8px}",
    ".row{display:flex;border:1px solid #ddd;margin:1px 0}",
    ".rl{background:#1A3A6A;color:#fff;font-weight:bold;font-size:9pt;padding:5px 9px;min-width:155px;width:155px}",
    ".rv{background:#F0F4FF;font-size:9pt;padding:5px 9px;flex:1}",
    ".sig{display:flex;gap:10px;margin-top:10px}",
    ".sigbox{flex:1;border:1px solid #ddd;padding:12px;min-height:80px}",
    ".sigtitle{font-weight:bold;font-size:9pt;color:#0D1B3E;margin-bottom:8px}",
    ".ftr{font-size:7pt;color:#999;text-align:center;margin-top:24px;border-top:1px solid #ddd;padding-top:6px}",
    "@media print{body{padding:14mm}@page{size:A4;margin:0}.cov{margin:-14mm -14mm 22px}}",
    "</style></head><body>",
    "<div class='cov'>",
    "<div class='cs'>ROYAUME DU MAROC</div>",
    "<div class='ct'>" + esc(title) + "</div>",
    "<div class='cs'>" + (fin ? "Proposition Financiere" : "Proposition Technique") + " — Marches Publics Marocains</div>",
    "<div class='co'>" + esc(tender.organisme) + "</div>",
    "<div class='ref'>Ref : " + esc(tender.reference) + "</div>",
    "</div>",
    "<h1 class='h1'>" + esc(strip(tender.titre)) + "</h1>",
    "<h2 class='h2'>IDENTIFICATION DU MARCHE</h2>",
    infoRows,
    "<div class='sp'></div>",
    "<h2 class='h2'>CONTENU DE L OFFRE</h2>",
    body,
    "<div class='sp'></div>",
    "<h2 class='h2'>SIGNATURES</h2>",
    "<div class='sig'>",
    "<div class='sigbox'><div class='sigtitle'>Pour " + esc(tender.organisme) + "</div>Nom : ___________________<br/>Date : ___________________<br/>Cachet :</div>",
    "<div class='sigbox'><div class='sigtitle'>Pour le Soumissionnaire</div>Raison sociale : __________<br/>Date : ___________________<br/>Cachet :</div>",
    "</div>",
    "<p class='ftr'>Genere le " + today + " | AO Manager Maroc | Decret n 2-12-349</p>",
    "<" + "script>window.onload=function(){setTimeout(function(){window.print();},300);};</" + "script>",
    "</body></html>"
  ].join("");
};

const dlHTML = (html, filename) => {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1500);
};

const exportPDF = (tender, text, docType, emailDest, mode) => {
  const html     = buildPDF(tender, text, docType);
  const safeName = (tender.reference||"ao").replace(/[^a-zA-Z0-9-]/g,"_");
  dlHTML(html, safeName + "_" + docType + ".html");
  if (mode === "email" && emailDest) {
    setTimeout(() => {
      const sub = encodeURIComponent("AO " + tender.reference + " — " + docType + " — " + tender.organisme);
      const bod = encodeURIComponent(
        "Bonjour,\n\nVeuillez trouver en piece jointe le document " + docType + " pour l AO :\n" +
        "Ref : " + tender.reference + " | " + tender.organisme + "\n\nCordialement"
      );
      window.location.href = "mailto:" + encodeURIComponent(emailDest) + "?subject=" + sub + "&body=" + bod;
    }, 1000);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANTS UI GÉNÉRIQUES
═══════════════════════════════════════════════════════════════════════════ */
const Spin = () => (
  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
    {[0, 0.3, 0.6].map((d, i) => (
      <span key={i} style={{
        display: "inline-block", width: 5, height: 5, borderRadius: "50%",
        background: "currentColor",
        animation: "pulse 1.2s ease-in-out " + d + "s infinite"
      }} />
    ))}
  </span>
);

const Btn = ({ onClick, disabled, color = "#7dd3fc", bg, border, children, style }) => (
  <button
    onClick={onClick}
    disabled={!!disabled}
    style={{
      padding: "9px 16px", borderRadius: 9, border: "1px solid " + (border || color),
      background: bg || "transparent", color, cursor: disabled ? "not-allowed" : "pointer",
      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
      display: "flex", alignItems: "center", gap: 7,
      opacity: disabled ? 0.5 : 1, transition: "opacity .2s",
      ...style
    }}
  >
    {children}
  </button>
);

/* Input CONTROLÉ simple — fiable, sans bug de flush */
const Input = ({ label, value, onChange, placeholder, type = "text", hint, successMsg, style }) => {
  const valid = type === "email" && value ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          background: "#050d1a", border: "1.5px solid " + (valid === false ? "#ef4444" : valid ? "#10b981" : "#1e3a5f"),
          borderRadius: 9, padding: "9px 12px", color: "#e8f0fe", fontSize: 13,
          fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box",
          caretColor: "#F59E0B", transition: "border-color .2s", ...(style || {})
        }}
        onFocus={e => e.target.style.borderColor = "#F59E0B"}
        onBlur={e => e.target.style.borderColor = valid === false ? "#ef4444" : valid ? "#10b981" : "#1e3a5f"}
      />
      {valid && successMsg && <div style={{ fontSize: 10, color: "#10b981" }}>{successMsg}</div>}
      {hint && <div style={{ fontSize: 10, color: "#3a5a7a" }}>{hint}</div>}
    </div>
  );
};

/* Textarea CONTROLÉE */
const Textarea = ({ label, value, onChange, placeholder, rows = 4, hint }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>}
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={{
        background: "#050d1a", border: "1.5px solid #1e3a5f", borderRadius: 9,
        padding: "9px 12px", color: "#e8f0fe", fontSize: 12, fontFamily: "inherit",
        outline: "none", width: "100%", boxSizing: "border-box",
        caretColor: "#F59E0B", resize: "vertical", lineHeight: 1.7,
        transition: "border-color .2s"
      }}
      onFocus={e => e.target.style.borderColor = "#F59E0B"}
      onBlur={e => e.target.style.borderColor = "#1e3a5f"}
    />
    {hint && <div style={{ fontSize: 10, color: "#3a5a7a" }}>{hint}</div>}
  </div>
);

/* Bouton export PDF (hors du composant AnalysisPanel pour éviter recréation) */
const PdfBtn = ({ tender, content, docType, label }) => {
  const { emailDest, exportMode } = useContext(ExportCtx);
  const [st, setSt]       = useState("idle");
  const [menu, setMenu]   = useState(false);

  const go = mode => {
    setMenu(false);
    try {
      exportPDF(tender, content, docType, emailDest, mode);
      setSt(mode === "email" ? "email" : "ok");
      setTimeout(() => setSt("idle"), 3000);
    } catch (e) {
      alert("Erreur export : " + e.message);
    }
  };

  const handleClick = () => {
    if (emailDest && exportMode === "ask") setMenu(m => !m);
    else if (exportMode === "email" && emailDest) go("email");
    else go("local");
  };

  const col = st === "email" ? "#c4b5fd" : st === "ok" ? "#6ee7b7" : "#fcd34d";
  const bg  = st === "email" ? "#1a0f3a"  : st === "ok" ? "#0d3a2a"  : "linear-gradient(135deg,#7c2d12,#92400e)";
  const bd  = st === "email" ? "#7c3aed"  : st === "ok" ? "#6ee7b7"  : "#b45309";
  const hm  = !!(emailDest && exportMode === "ask");

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div style={{ display: "flex" }}>
        <button onClick={handleClick}
          style={{ background: bg, border: "1px solid " + bd, borderRadius: hm ? "9px 0 0 9px" : 9, padding: "9px 15px", cursor: "pointer", color: col, display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, fontFamily: "inherit", borderRight: hm ? "none" : undefined }}>
          📄 {st === "email" ? "Email pret !" : st === "ok" ? "Telecharge !" : label}
        </button>
        {hm && (
          <button onClick={() => setMenu(m => !m)}
            style={{ background: bg, border: "1px solid " + bd, borderLeft: "1px solid rgba(255,255,255,.15)", borderRadius: "0 9px 9px 0", padding: "9px 10px", cursor: "pointer", color: col, fontSize: 11, fontFamily: "inherit" }}>
            {menu ? "▴" : "▾"}
          </button>
        )}
      </div>
      {menu && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 9, minWidth: 210, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,.7)", overflow: "hidden" }}>
          <button onClick={() => go("local")} style={{ width: "100%", padding: "11px 15px", background: "transparent", border: "none", borderBottom: "1px solid #0f2540", color: "#7dd3fc", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>💾 Enregistrer en PDF</button>
          <button onClick={() => go("email")} style={{ width: "100%", padding: "11px 15px", background: "transparent", border: "none", color: "#c4b5fd", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>✉️ Envoyer a {emailDest}</button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANTS MÉTIER
═══════════════════════════════════════════════════════════════════════════ */
const StatusBadge = ({ s }) => {
  const cfg = { Ouvert: ["#6ee7b7", "#052e16"], Nouveau: ["#fcd34d", "#2a1a00"], Cloture: ["#f87171", "#2a0a0a"] };
  const [col, bg] = cfg[s] || ["#a8c5e0", "#0a1628"];
  return <span style={{ background: bg, color: col, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{s}</span>;
};

const TenderCard = ({ tender, onSelect, selected }) => {
  const days      = Math.ceil((new Date(tender.dateLimite) - new Date()) / 86400000);
  const etapes    = tender.etapes || {};
  const doneCount = Object.values(etapes).filter(Boolean).length;
  const pct       = PIPELINE ? Math.round(doneCount / PIPELINE.length * 100) : 0;
  const ef        = tender.etatFinal;
  const dec       = tender.decision;
  const efData    = {
    gagne:     { c:"#6ee7b7", b:"#052e16", bd:"#166534", i:"🏆" },
    perdu:     { c:"#f87171", b:"#2a0a0a", bd:"#7f1d1d", i:"😔" },
    abandonne: { c:"#fcd34d", b:"#2a1a00", bd:"#b45309", i:"⏹️" }
  };
  return (
    <div onClick={() => onSelect(tender)}
      style={{ background: selected ? "#0d2040" : "#0a1628",
        border: "1px solid " + (selected ? "#3a7aaf" : ef ? (efData[ef]?.bd||"#1e3a5f") : "#1e3a5f"),
        borderRadius: 12, padding: 14, cursor: "pointer", marginBottom: 8, transition: "all .2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700 }}>{tender.reference}</span>
        {ef
          ? <span style={{ fontSize:10, fontWeight:700, color:efData[ef]?.c, background:efData[ef]?.b, border:"1px solid "+efData[ef]?.bd, borderRadius:10, padding:"2px 8px" }}>{efData[ef]?.i} {ef==="gagne"?"Gagné":ef==="perdu"?"Perdu":"Abandonné"}</span>
          : dec === "go"   ? <span style={{ fontSize:10, color:"#6ee7b7", background:"#052e16", border:"1px solid #166534", borderRadius:10, padding:"2px 8px", fontWeight:700 }}>✅ GO</span>
          : dec === "nogo" ? <span style={{ fontSize:10, color:"#f87171", background:"#2a0a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"2px 8px", fontWeight:700 }}>🚫 NO GO</span>
          : <StatusBadge s={tender.statut} />}
      </div>
      <div style={{ fontSize: 12, color: "#e8f0fe", fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>{tender.titre}</div>
      <div style={{ fontSize: 11, color: "#7dd3fc", marginBottom: 7 }}>{tender.organisme}</div>
      {dec === "go" && pct > 0 && (
        <div style={{ marginBottom:7 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#3a5a7a", marginBottom:3 }}>
            <span>{ef ? (efData[ef]?.i + " " + (ef==="gagne"?"Gagné":ef==="perdu"?"Perdu":"Abandonné")) : "Avancement"}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ background:"#0a2040", borderRadius:10, height:5, overflow:"hidden" }}>
            <div style={{ width:pct+"%", height:"100%",
              background: ef==="gagne" ? "linear-gradient(90deg,#059669,#6ee7b7)" :
                          ef==="perdu" ? "linear-gradient(90deg,#dc2626,#f87171)" :
                          ef==="abandonne" ? "linear-gradient(90deg,#d97706,#fcd34d)" :
                          "linear-gradient(90deg,#1a5c8c,#7dd3fc)",
              transition:"width .3s" }} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 600 }}>{tender.budget}</span>
        <span style={{ fontSize: 10, color: days < 7 ? "#f87171" : days < 14 ? "#fcd34d" : "#5a7da0" }}>J-{days}</span>
      </div>
    </div>
  );
};

/* Onglet Source */
const SourceTab = ({ tender, onSave, apiKey }) => {
  const [notes,   setNotes]   = useState(tender.sourceNotes || "");
  const [fname,   setFname]   = useState(tender.srcFileName || "");
  const [fcont,   setFcont]   = useState(tender.srcContent  || "");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [saved,   setSaved]   = useState(false);
  const fileRef = useRef(null);

  const handleFile = async f => {
    if (!f) return;
    setFname(f.name); setFcont("");
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (["txt","md","csv","json","xml","html","js","ts","log","jsx"].includes(ext)) {
      setFcont((await f.text()).slice(0, 12000));
    } else {
      setFcont("[" + f.name + " — " + Math.round(f.size / 1024) + " Ko]");
    }
  };

  const extract = async () => {
    const src = [notes, fcont].filter(Boolean).join("\n\n---\n\n").trim();
    if (!src)     { alert("Ajoutez du contenu dans les notes ou importez un fichier."); return; }
    if (!apiKey)  { alert("Configurez votre cle API Claude dans l onglet API."); return; }
    setLoading(true); setResult(null);
    try {
      const sys = "Tu es expert marches publics Maroc. Extrais les informations de cet AO en JSON strict : {reference,titre,organisme,budget,dateLimite,region,secteur,description,criteres:[],documents:[],synthese}. Reponds UNIQUEMENT en JSON, sans markdown.";
      const txt = await callClaude(sys, "Analyse cet AO :\n\n" + src.slice(0, 10000), apiKey);
      const m = txt.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/);
      setResult(m ? JSON.parse(m[0]) : { synthese: txt });
    } catch (e) {
      setResult({ synthese: "Erreur : " + e.message });
    } finally { setLoading(false); }
  };

  const save = () => {
    onSave(tender.id, { sourceNotes: notes, srcFileName: fname, srcContent: fcont });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Textarea label="Notes / Texte AO" value={notes} onChange={e => setNotes(e.target.value)} rows={5}
        placeholder="Collez ici : URL, texte de l AO, contacts, informations complementaires..."
        hint="Tout contenu textuel relatif a cet AO" />
      {/* Zone fichier */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Fichier source</div>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#F59E0B"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "#1e3a5f"; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#1e3a5f"; handleFile(e.dataTransfer.files[0]); }}
          style={{ border: "2px dashed #1e3a5f", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", background: "#060e1a", transition: "border-color .2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#F59E0B"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#1e3a5f"}
        >
          <div style={{ fontSize: 22, marginBottom: 5 }}>{fname ? "📄" : "📂"}</div>
          {fname
            ? <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>{fname} {fcont && <span style={{ color: "#3a7a5a" }}>— {fcont.length} car.</span>}</div>
            : <div><div style={{ fontSize: 12, color: "#5a7da0" }}>Cliquer ou glisser un fichier</div><div style={{ fontSize: 10, color: "#2a4a6a", marginTop: 3 }}>TXT · CSV · JSON · HTML · MD</div></div>
          }
        </div>
        <input ref={fileRef} type="file" style={{ display: "none" }} accept=".txt,.md,.csv,.json,.xml,.html,.log,.jsx,.js,.ts"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {fname && <button onClick={() => { setFname(""); setFcont(""); }} style={{ marginTop: 5, background: "transparent", border: "none", cursor: "pointer", color: "#f87171", fontSize: 11, fontFamily: "inherit", padding: 0 }}>✕ Retirer le fichier</button>}
      </div>
      {/* Boutons */}
      <Btn onClick={extract} disabled={(!notes && !fcont) || loading}
        color="#7dd3fc" bg="linear-gradient(135deg,#1a4a7c,#0f2f52)" border="#1a4a7c"
        style={{ justifyContent: "center" }}>
        {loading ? <><Spin /> Lecture IA en cours...</> : <>⚡ Extraire et analyser l AO</>}
      </Btn>
      {result && (
        <div style={{ background: "#070f1e", border: "1px solid #1a3a5c", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>AO Identifie</div>
          {result.titre    && <div style={{ fontSize: 13, color: "#e8f0fe", fontWeight: 700, marginBottom: 5 }}>{result.titre}</div>}
          {result.organisme && <div style={{ fontSize: 11, color: "#7dd3fc", marginBottom: 3 }}>{result.organisme}</div>}
          {result.budget    && <div style={{ fontSize: 11, color: "#6ee7b7", marginBottom: 3 }}>{result.budget}</div>}
          {result.synthese  && <div style={{ fontSize: 11, color: "#a8c5e0", lineHeight: 1.6, marginTop: 6 }}>{result.synthese}</div>}
        </div>
      )}
      <Btn onClick={save} color={saved ? "#6ee7b7" : "#5a7da0"} border={saved ? "#6ee7b7" : "#1e3a5f"} bg={saved ? "#0d3a2a" : "transparent"} style={{ justifyContent: "center" }}>
        {saved ? "✓ Sources sauvegardees" : "Sauvegarder les sources"}
      </Btn>
    </div>
  );
};

/* Onglet Analyse / Offre — composant INDÉPENDANT (pas imbriqué) */
const GenTab = ({ tender, apiKey, genType, content, setContent, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const CONFIGS = {
    analysis: {
      color: "#7dd3fc", bg: "linear-gradient(135deg,#1a4a7c,#0f2f52)", border: "#1a4a7c",
      label: "Analyser avec Claude",
      system: "Tu es expert marches publics Maroc (Decret n 2-12-349). Analyse strategiquement cet appel d offres : evaluation des opportunites et risques, analyse de la concurrence probable, recommandations strategiques, decision GO/NOGO motivee. Utilise des titres **Titre** et sous-sections bien structurees."
    },
    technique: {
      color: "#7dd3fc", bg: "linear-gradient(135deg,#1a4a7c,#0f2f52)", border: "#1a4a7c",
      label: "Generer l offre technique",
      system: "Tu es expert marches publics Maroc. Redige une offre technique professionnelle et detaillee pour cet appel d offres. Inclus : presentation de la societe, comprehension du besoin, methodologie detaillee, organisation du projet, equipe proposee, planning, references similaires, garanties de qualite. Utilise des titres **Titre**, sous-sections numerotees, puces pour les listes. Minimum 1500 mots."
    },
    financiere: {
      color: "#6ee7b7", bg: "linear-gradient(135deg,#1a5c3a,#0d3a22)", border: "#1a5c3a",
      label: "Generer l offre financiere",
      system: "Tu es expert marches publics Maroc. Redige une offre financiere professionnelle pour cet appel d offres. Inclus : recapitulatif des prestations, tableau de prix detaille par poste, conditions de paiement, validite de l offre, conditions financieres. Utilise des titres **Titre** et un tableau de prix structure."
    }
  };

  const cfg = CONFIGS[genType];
  const src = [tender.sourceNotes, tender.srcContent].filter(Boolean).join("\n\n").slice(0, 8000);

  const generate = async () => {
    if (!apiKey) { setError("Configurez votre cle API dans l onglet API de la sidebar."); return; }
    setError(""); setLoading(true);
    try {
      const context = JSON.stringify({
        reference: tender.reference, titre: tender.titre, organisme: tender.organisme,
        budget: tender.budget, dateLimite: tender.dateLimite, region: tender.region,
        criteres: tender.criteres, documents: tender.documents, description: tender.description
      });
      const userMsg = "Appel d offres :\n" + context + (src ? "\n\nSources et contexte :\n" + src : "");
      const result = await callClaude(cfg.system, userMsg, apiKey);
      setContent(result);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div style={{ background: "#2a0a0a", border: "1px solid #7f1d1d", borderRadius: 9, padding: "10px 14px", fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
          ⚠ {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn onClick={generate} disabled={loading} color={cfg.color} bg={cfg.bg} border={cfg.border}>
          {loading ? <><Spin /> Generation en cours...</> : <>⚡ {cfg.label}</>}
        </Btn>
        {content && !loading && (
          <PdfBtn tender={tender} content={content} docType={genType} label={"Telecharger " + (genType === "financiere" ? "Fin." : "Tech.")} />
        )}
      </div>
      {content && (
        <div style={{ background: "#070f1e", border: "1px solid #1a3a5c", borderRadius: 10, padding: 16, whiteSpace: "pre-wrap", fontSize: 12, color: "#c8daf0", lineHeight: 1.85, maxHeight: 520, overflowY: "auto" }}>
          {content}
        </div>
      )}
      {!content && !loading && (
        <div style={{ background: "#0a1628", border: "1px dashed #1e3a5f", borderRadius: 10, padding: 24, textAlign: "center", color: "#3a5a7a" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚡</div>
          <div style={{ fontSize: 12 }}>Cliquez sur le bouton ci-dessus pour generer le document avec Claude {MODEL}</div>
          {!apiKey && <div style={{ fontSize: 11, color: "#f87171", marginTop: 8 }}>⚠ Configurez d abord votre cle API dans la sidebar (onglet API)</div>}
        </div>
      )}
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════════════════
   PDF DOSSIER DE RÉPONSE COMPLET (GO confirmé)
═══════════════════════════════════════════════════════════════════════════ */
const buildDossierPDF = (tender, sections) => {
  const esc   = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const strip = s => String(s||"").replace(/\*\*/g,"").replace(/[\r\n]+/g," ").trim();
  const today = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  const dl    = new Date(tender.dateLimite).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});

  const renderSection = (text, accentColor) => {
    let html = "";
    (text||"").split("\n").forEach(line => {
      const t = line.trim();
      if(!t){ html += "<div class=\'sp\'></div>"; return; }
      if(/^\*\*[^*]+\*\*\s*:?\s*$/.test(t)){ html += "<h3 class=\'sh\'>" + esc(strip(t)) + "</h3>"; return; }
      if(/^\d+\.\s/.test(t))           { html += "<h4 class=\'sn\'>" + esc(strip(t)) + "</h4>"; return; }
      if(t[0]==="-"||t.charCodeAt(0)===8226){ html += "<p class=\'bul\'>&#8226; " + esc(strip(t.replace(/^[-\u2022]\s*/,""))) + "</p>"; return; }
      html += "<p class=\'txt\'>" + esc(strip(t)) + "</p>";
    });
    return html;
  };

  const infoRows = [
    ["Reference AO", tender.reference],["Organisme", tender.organisme],
    ["Budget", tender.budget],["Date limite", dl],
    ["Region", tender.region],["Type", tender.type]
  ].map(([l,v]) => "<div class=\'row\'><span class=\'rl\'>" + esc(l) + "</span><span class=\'rv\'>" + esc(strip(v)) + "</span></div>").join("");

  const css = [
    "*{box-sizing:border-box;margin:0;padding:0}",
    "body{font-family:Arial,sans-serif;font-size:10.5pt;color:#111;padding:20mm}",
    ".cov{background:linear-gradient(135deg,#0D1B3E,#1a3a6a);color:#fff;padding:50px 40px;margin:-20mm -20mm 0;text-align:center;page-break-after:always}",
    ".logo{font-size:36pt;margin-bottom:12px}",
    ".ct{font-size:24pt;font-weight:bold;margin:8px 0;letter-spacing:-.5px}",
    ".cs{font-size:11pt;color:#C8D8F0;margin:5px 0}",
    ".co{font-size:14pt;color:#F59E0B;margin-top:16px;font-weight:bold}",
    ".ref{background:rgba(255,255,255,.15);color:#fff;font-size:9pt;padding:4px 12px;margin-top:10px;display:inline-block;border-radius:4px}",
    ".go-badge{background:#059669;color:#fff;font-size:11pt;font-weight:bold;padding:6px 20px;border-radius:20px;margin-top:14px;display:inline-block}",
    ".toc{padding:30px 0;page-break-after:always}",
    ".toc-title{font-size:16pt;font-weight:bold;color:#0D1B3E;border-bottom:3px solid #F59E0B;padding-bottom:8px;margin-bottom:20px}",
    ".toc-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dotted #ddd;font-size:11pt}",
    ".toc-num{font-weight:bold;color:#0D1B3E;min-width:30px}",
    ".toc-label{flex:1;color:#1F2937}",
    ".toc-page{color:#F59E0B;font-weight:bold}",
    ".sec{page-break-before:always;padding-top:10px}",
    ".sec-header{background:linear-gradient(135deg,#0D1B3E,#1a3a6a);color:#fff;padding:16px 20px;margin:-10px -20mm 20px;border-radius:0}",
    ".sec-num{font-size:9pt;color:#F59E0B;font-weight:bold;text-transform:uppercase;letter-spacing:.1em}",
    ".sec-title{font-size:15pt;font-weight:bold;margin-top:4px}",
    ".sh{font-size:12pt;font-weight:bold;color:#0D1B3E;border-bottom:1.5px solid #F59E0B;padding-bottom:4px;margin:14px 0 7px}",
    ".sn{font-size:11pt;font-weight:bold;color:#1a3a6a;margin:10px 0 4px}",
    ".txt{font-size:10pt;line-height:1.8;margin:3px 0;color:#1F2937}",
    ".bul{font-size:10pt;line-height:1.7;margin:2px 0 2px 18px;color:#1F2937}",
    ".sp{height:9px}",
    ".row{display:flex;border:1px solid #ddd;margin:1px 0}",
    ".rl{background:#0D1B3E;color:#fff;font-weight:bold;font-size:9pt;padding:6px 10px;min-width:160px;width:160px}",
    ".rv{background:#F0F4FF;font-size:9pt;padding:6px 10px;flex:1}",
    ".sig{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}",
    ".sigbox{border:1px solid #ddd;padding:14px;min-height:90px}",
    ".sigtitle{font-weight:bold;font-size:9pt;color:#0D1B3E;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:5px}",
    ".ftr{font-size:7pt;color:#999;text-align:center;margin-top:24px;border-top:1px solid #ddd;padding-top:6px}",
    ".score-box{display:inline-flex;align-items:center;gap:10px;background:#f0fdf4;border:2px solid #059669;border-radius:10px;padding:10px 18px;margin:10px 0}",
    ".score-val{font-size:22pt;font-weight:bold;color:#059669}",
    ".score-lbl{font-size:10pt;color:#065f46}",
    "@media print{body{padding:14mm}@page{size:A4;margin:0}.cov{margin:-14mm -14mm 0}.sec-header{margin:-10px -14mm 20px}}"
  ].join("");

  const sectionHTML = (sections||[]).map((sec,i) => {
    const num = String(i+2).padStart(2,"0");
    return [
      "<div class=\'sec\'>",
      "<div class=\'sec-header\'>",
      "<div class=\'sec-num\'>Section " + (i+2) + " / " + (sections.length+1) + "</div>",
      "<div class=\'sec-title\'>" + esc(sec.titre) + "</div>",
      "</div>",
      renderSection(sec.contenu, "#0D1B3E"),
      "</div>"
    ].join("");
  }).join("");

  const tocHTML = (sections||[]).map((sec,i) => {
    return "<div class=\'toc-item\'><span class=\'toc-num\'>" + (i+2) + ".</span><span class=\'toc-label\'>" + esc(sec.titre) + "</span><span class=\'toc-page\'>—</span></div>";
  }).join("");

  return [
    "<!DOCTYPE html><html lang=\'fr\'><head><meta charset=\'UTF-8\'>",
    "<title>Dossier de Reponse — " + esc(tender.reference) + "</title>",
    "<style>" + css + "</style></head><body>",
    // Page de garde
    "<div class=\'cov\'>",
    "<div class=\'logo\'>🏛</div>",
    "<div class=\'ct\'>DOSSIER DE RÉPONSE</div>",
    "<div class=\'cs\'>Appel d Offres · Marches Publics Marocains</div>",
    "<div class=\'co\'>" + esc(tender.organisme) + "</div>",
    "<div class=\'ref\'>" + esc(tender.reference) + " | " + esc(tender.titre.slice(0,60)) + "</div>",
    "<div class=\'go-badge\'>✓ DÉCISION : GO</div>",
    "<div style=\'color:#a8c5e0;font-size:9pt;margin-top:16px\'>Decret n° 2-12-349 | Confidentiel Soumissionnaire | " + today + "</div>",
    "</div>",
    // Table des matières
    "<div class=\'toc\'>",
    "<div class=\'toc-title\'>Table des matières</div>",
    "<div class=\'toc-item\'><span class=\'toc-num\'>1.</span><span class=\'toc-label\'>Identification du marché</span><span class=\'toc-page\'>—</span></div>",
    tocHTML,
    "</div>",
    // Section 1 : Identification
    "<div class=\'sec\'>",
    "<div class=\'sec-header\'>",
    "<div class=\'sec-num\'>Section 1 / " + (sections.length+1) + "</div>",
    "<div class=\'sec-title\'>Identification du Marché</div>",
    "</div>",
    infoRows,
    "<div class=\'sp\'></div>",
    "<div class=\'sh\'>Critères d évaluation</div>",
    "<div style=\'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0\'>" + (tender.criteres||[]).map(c=>"<span style=\'background:#e0f2fe;color:#0D1B3E;border-radius:15px;padding:3px 10px;font-size:9pt;border:1px solid #bae6fd\'>" + esc(c) + "</span>").join("") + "</div>",
    "<div class=\'sh\'>Documents requis</div>",
    "<div style=\'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0\'>" + (tender.documents||[]).map(d=>"<span style=\'background:#faf5ff;color:#581c87;border-radius:15px;padding:3px 10px;font-size:9pt;border:1px solid #e9d5ff\'>" + esc(d) + "</span>").join("") + "</div>",
    "</div>",
    // Sections IA
    sectionHTML,
    // Signatures
    "<div class=\'sec\' style=\'page-break-before:always\'>",
    "<div class=\'sh\'>Engagements et Signatures</div>",
    "<div class=\'sig\'>",
    "<div class=\'sigbox\'><div class=\'sigtitle\'>Pour " + esc(tender.organisme) + "</div>Nom : _______________<br/>Titre : _______________<br/>Date : _______________<br/>Cachet et Signature :</div>",
    "<div class=\'sigbox\'><div class=\'sigtitle\'>Pour le Soumissionnaire</div>Raison sociale : ______<br/>Nom & Titre : _________<br/>Date : _______________<br/>Cachet et Signature :</div>",
    "</div>",
    "<p class=\'ftr\'>Dossier genere le " + today + " | AO Manager Maroc | Confidentiel | Decret n 2-12-349</p>",
    "</div>",
    "<" + "script>window.onload=function(){setTimeout(function(){window.print();},400);};</" + "script>",
    "</body></html>"
  ].join("");
};
/* ═══════════════════════════════════════════════════════════════════════════
   ONGLET EXPERTS LINKEDIN
═══════════════════════════════════════════════════════════════════════════ */
const COMP_PRESETS = [
  "Gestion de projet","Chef de projet SI","Architecte SI","Cybersecurite",
  "ERP / SAP","Developpement logiciel","Cloud / DevOps","Data / BI",
  "Reseau & Infrastructure","AMOA","Audit IT","HACCP / Qualite",
  "Marches publics","Ingenierie agroalimentaire","Finance","RH / Formation",
  "Juridique","Conduite du changement","Management de transition","Lean / Six Sigma"
];
const ZONES_GEO = [
  { value:"Maroc",        label:"Maroc (national)"   },
  { value:"Casablanca",   label:"Casablanca"          },
  { value:"Rabat",        label:"Rabat"               },
  { value:"Marrakech",    label:"Marrakech"           },
  { value:"Fes",          label:"Fes"                 },
  { value:"Tanger",       label:"Tanger"              },
  { value:"Agadir",       label:"Agadir"              },
  { value:"France",       label:"France"              },
  { value:"Belgique",     label:"Belgique"            },
  { value:"Canada",       label:"Canada"              },
  { value:"International",label:"International"       },
];

const ExpertsTab = ({ tender, apiKey }) => {
  const [showMoteur,   setShowMoteur]   = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [experts,      setExperts]      = useState(null);
  // Critères
  const [zone,        setZone]        = useState("Maroc");
  const [experience,  setExperience]  = useState("tous");
  const [nbProfils,   setNbProfils]   = useState(4);
  const [motsCles,    setMotsCles]    = useState("");
  const [competences, setCompetences] = useState([]);
  const [customComp,  setCustomComp]  = useState("");

  const toggleComp = c => setCompetences(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);
  const addCustom = () => {
    const v = customComp.trim();
    if (v && !competences.includes(v)) { setCompetences(cs => [...cs, v]); setCustomComp(""); }
  };

  const safeParseJSON = txt => {
    try {
      const clean = txt.replace(/```json|```/g,"").trim();
      const m = clean.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch(_) { return null; }
  };

  const findExperts = async () => {
    if (!apiKey) { alert("Configurez votre cle API dans l onglet API."); return; }
    setLoading(true); setExperts(null); setShowMoteur(false);
    try {
      const zoneCtx  = zone === "International" ? "toutes zones geographiques (Maroc + international)" : zone;
      const compCtx  = competences.length > 0 ? competences.join(", ") : "competences pertinentes pour cet AO";
      const expCtx   = experience === "tous" ? "tout niveau" : experience === "senior" ? "profil senior 10+ ans" : "profil junior/intermediaire 3-7 ans";
      const kwCtx    = motsCles.trim() ? " Mots-cles supplementaires : " + motsCles.trim() + "." : "";
      const sys = "Tu es expert RH et marches publics marocains. Identifie " + nbProfils + " profils experts pour cet appel d offres selon les criteres indiques. Reponds UNIQUEMENT en JSON minifie sur une seule ligne, sans retour a la ligne dans les valeurs, sans apostrophe dans les strings : {\"profils\":[{\"titre\":\"...\",\"specialite\":\"...\",\"competences\":[\"...\"],\"experience\":\"...\",\"zone\":\"...\",\"keywords_linkedin\":\"...\",\"tip\":\"...\"}],\"conseil\":\"...\"}";
      const user = "AO : " + tender.titre + " | Organisme : " + tender.organisme + " | Secteur : " + tender.secteur + " | Criteres AO : " + tender.criteres.join(", ") + " | Zone geographique : " + zoneCtx + " | Competences recherchees : " + compCtx + " | Niveau experience : " + expCtx + "." + kwCtx;
      const txt = await callClaude(sys, user, apiKey);
      const parsed = safeParseJSON(txt);
      setExperts(parsed || { conseil: txt.slice(0, 500) });
    } catch(e) {
      setExperts({ conseil: "Erreur : " + e.message });
    } finally { setLoading(false); }
  };

  const selStyle = { background:"#060e1a", border:"1.5px solid #1e3a5f", borderRadius:8, padding:"7px 10px", color:"#e8f0fe", fontSize:11, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", cursor:"pointer" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Moteur de recherche */}
      {showMoteur && (
        <div style={{ background:"#070f1e", border:"1px solid #2a1a5c", borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#c4b5fd", textTransform:"uppercase", letterSpacing:".06em" }}>🎯 Moteur de recherche experts</div>

          {/* Zone + Expérience */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#7aa3cc", textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>Zone géographique</div>
              <select value={zone} onChange={e=>setZone(e.target.value)} style={selStyle}>
                {ZONES_GEO.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#7aa3cc", textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>Niveau d expérience</div>
              <select value={experience} onChange={e=>setExperience(e.target.value)} style={selStyle}>
                <option value="tous">Tous niveaux</option>
                <option value="junior">Junior / Inter. (3-7 ans)</option>
                <option value="senior">Senior (10+ ans)</option>
              </select>
            </div>
          </div>

          {/* Nombre de profils */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7aa3cc", textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>
              Nombre de profils : <span style={{ color:"#c4b5fd", fontSize:12 }}>{nbProfils}</span>
            </div>
            <input type="range" min={2} max={8} value={nbProfils} onChange={e=>setNbProfils(+e.target.value)}
              style={{ width:"100%", accentColor:"#7c3aed", cursor:"pointer" }} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#3a5a7a", marginTop:2 }}>
              <span>2</span><span>8</span>
            </div>
          </div>

          {/* Compétences presets */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7aa3cc", textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>Compétences clés</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {COMP_PRESETS.map(c => (
                <button key={c} onClick={() => toggleComp(c)}
                  style={{ padding:"3px 9px", borderRadius:20, border:"1px solid " + (competences.includes(c) ? "#7c3aed" : "#1e3a5f"),
                    background: competences.includes(c) ? "#2a1a5c" : "transparent",
                    color: competences.includes(c) ? "#c4b5fd" : "#5a7da0",
                    cursor:"pointer", fontSize:10, fontFamily:"inherit", transition:"all .15s" }}>
                  {c}
                </button>
              ))}
            </div>
            {/* Compétence personnalisée */}
            <div style={{ display:"flex", gap:6, marginTop:7 }}>
              <input value={customComp} onChange={e=>setCustomComp(e.target.value)}
                placeholder="Ajouter une competence..."
                onKeyDown={e=>{ if(e.key==="Enter") addCustom(); }}
                style={{ flex:1, background:"#050d1a", border:"1.5px solid #1e3a5f", borderRadius:8, padding:"6px 10px", color:"#e8f0fe", fontSize:11, fontFamily:"inherit", outline:"none", caretColor:"#F59E0B" }}
                onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
              <button onClick={addCustom} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #3a1a7c", background:"#1a0a3a", color:"#c4b5fd", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>+ Ajouter</button>
            </div>
            {competences.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                {competences.map(c => (
                  <span key={c} style={{ background:"#2a1a5c", color:"#c4b5fd", borderRadius:20, padding:"2px 8px", fontSize:10, display:"flex", alignItems:"center", gap:4 }}>
                    {c}
                    <button onClick={()=>toggleComp(c)} style={{ background:"none", border:"none", cursor:"pointer", color:"#7c3aed", padding:0, fontSize:12, lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mots-clés libres */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7aa3cc", textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>Mots-clés supplémentaires</div>
            <input value={motsCles} onChange={e=>setMotsCles(e.target.value)} placeholder="Ex : certification PMP, bilingue francais-arabe..."
              style={{ background:"#050d1a", border:"1.5px solid #1e3a5f", borderRadius:8, padding:"8px 10px", color:"#e8f0fe", fontSize:11, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", caretColor:"#F59E0B" }}
              onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
          </div>

          {/* Bouton */}
          <button onClick={findExperts} disabled={loading}
            style={{ padding:"11px 0", borderRadius:10, border:"none", background:loading?"#111827":"linear-gradient(135deg,#2a1a4a,#1a0f3a)", color:loading?"#374151":"#c4b5fd", cursor:loading?"not-allowed":"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:loading?.6:1 }}>
            {loading ? <><Spin /> Identification en cours...</> : <>👥 Trouver les experts LinkedIn</>}
          </button>
        </div>
      )}

      {/* Résultats */}
      {experts && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {/* Conseil général */}
          {experts.conseil && (
            <div style={{ background:"#0a1628", border:"1px solid #2a1a5c", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#c4b5fd", textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>💡 Conseil de recrutement</div>
              <p style={{ margin:0, fontSize:12, color:"#c4b5fd", lineHeight:1.65 }}>{experts.conseil}</p>
            </div>
          )}

          {/* Profils */}
          {(experts.profils || []).map((prof, i) => {
            const kwEnc = encodeURIComponent((prof.keywords_linkedin || prof.titre || "").replace(/'/g," "));
            const zoneEnc = encodeURIComponent(zone === "International" ? "" : zone);
            const liUrl = "https://www.linkedin.com/search/results/people/?keywords=" + kwEnc + (zoneEnc ? "&geoUrn=" + zoneEnc : "");
            return (
              <div key={i} style={{ background:"#07101e", border:"1px solid #1e3a5f", borderRadius:12, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, color:"#e8f0fe", fontWeight:700 }}>{prof.titre}</div>
                    <div style={{ fontSize:11, color:"#c4b5fd", marginTop:2 }}>{prof.specialite}</div>
                  </div>
                  <span style={{ background:"#0a1628", color:"#7dd3fc", borderRadius:6, padding:"2px 8px", fontSize:10, whiteSpace:"nowrap" }}>{prof.experience || prof.zone}</span>
                </div>
                {prof.competences && prof.competences.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                    {prof.competences.map((c,j) => (
                      <span key={j} style={{ background:"#0a2040", color:"#7dd3fc", borderRadius:15, padding:"2px 7px", fontSize:10 }}>{c}</span>
                    ))}
                  </div>
                )}
                {prof.tip && (
                  <div style={{ fontSize:11, color:"#a8c5e0", lineHeight:1.55, marginBottom:8, fontStyle:"italic" }}>💡 {prof.tip}</div>
                )}
                <a href={liUrl} target="_blank" rel="noreferrer"
                  style={{ display:"inline-flex", alignItems:"center", gap:6, background:"linear-gradient(135deg,#0a66c2,#084fa0)", border:"none", borderRadius:8, padding:"7px 13px", color:"#fff", fontSize:11, fontWeight:700, textDecoration:"none", cursor:"pointer" }}>
                  🔗 Rechercher sur LinkedIn
                </a>
              </div>
            );
          })}

          {/* Boutons bas */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={findExperts}
              style={{ flex:1, padding:"9px 0", borderRadius:9, border:"1px solid #2a1a5c", background:"transparent", color:"#7aa3cc", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              🔄 Relancer la recherche
            </button>
            <button onClick={() => { setShowMoteur(true); setExperts(null); }}
              style={{ flex:1, padding:"9px 0", borderRadius:9, border:"1px solid #1e3a5f", background:"transparent", color:"#5a7da0", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              ⚙ Modifier les critères
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ONGLET DOSSIER DE RÉPONSE (GO uniquement) — génération multi-sections
═══════════════════════════════════════════════════════════════════════════ */
const DossierTab = ({ tender, apiKey, onSave }) => {
  const ETAPES = [
    { id: "strategie",   label: "Analyse stratégique approfondie",
      icon: "🎯", color: "#7dd3fc",
      system: "Tu es un expert senior en appels d offres publics marocains (Decret 2-12-349). Realise une ANALYSE STRATEGIQUE COMPLETE et APPROFONDIE de cet AO. Structure ta reponse avec ces sections obligatoires en utilisant **Titre:** pour chaque titre : **Contexte et enjeux strategiques:** (analyse du marche, positionnement de l organisme, enjeux politiques et economiques) **Analyse de la demande:** (besoins reels vs exprimes, attentes implicites, perimetre exact des prestations) **Evaluation des opportunites:** (points forts de notre candidature, avantages concurrentiels, facteurs cles de succes) **Analyse des risques:** (risques techniques, financiers, calendaires, mitigation proposee) **Analyse concurrentielle:** (profil probable des concurrents, differenciateurs, positionnement prix) **Criteres de scoring detailles:** (analyse de chaque critere de notation, ponderation probable, strategie de maximisation) **Decision GO confirme:** (score d opportunite /100, justification detaillee, conditions de succes) Sois tres analytique, precis, utilise des faits et des chiffres. Minimum 800 mots." },
    { id: "note_methodo", label: "Note méthodologique",
      icon: "📐", color: "#c4b5fd",
      system: "Tu es expert en ingenierie de reponse aux appels d offres marocains. Redige une NOTE METHODOLOGIQUE COMPLETE et PROFESSIONNELLE. Utilise **Titre:** pour chaque section. Sections obligatoires : **Comprehension du cahier des charges:** (reformulation precise des besoins, objectifs du projet, livrables attendus) **Methodologie d intervention:** (approche globale, phases detaillees, jalons, points de controle) **Organisation du projet:** (structure de gouvernance, organigramme equipe, roles et responsabilites, RACI) **Planning previsionnel detaille:** (Gantt par phase, durees, dependances, chemin critique) **Outils et moyens techniques:** (outils utilises, environnements, licences, infrastructure) **Gestion de la qualite:** (normes appliquees, processus de validation, indicateurs KPI, recette) **Gestion des risques projet:** (registre des risques, probabilite/impact, plan de mitigation) **Livrables et jalons:** (liste exhaustive des livrables, formats, conditions d acceptation) Minimum 1200 mots, tone professionnel et structure rigoureuse." },
    { id: "offre_tech",  label: "Offre technique complète",
      icon: "⚙️", color: "#6ee7b7",
      system: "Tu es expert en redaction d offres techniques pour les marches publics marocains. Redige une OFFRE TECHNIQUE COMPLETE, DETAILLEE et DIFFERENTIANCIANTE. Utilise **Titre:** pour chaque section. Sections obligatoires : **Presentation de la societe soumissionnaire:** (historique, chiffres cles, references sectorielles, certifications, capacite financiere) **Comprehension de la mission:** (analyse fine du besoin, valeur ajoutee proposee, vision du projet) **Solution technique proposee:** (description detaillee de la solution, architecture, composantes, innovations) **Equipe projet proposee:** (CV synthetiques des profils cles, experience pertinente, disponibilite, organigramme) **References similaires:** (au moins 3 projets similaires avec organisme, budget, resultats obtenus) **Plan d assurance qualite:** (certifications ISO, processus internes, controles, tests) **Conditions de mise en oeuvre:** (prerequis, conditions d acces, ressources a la charge du client) **Valeur ajoutee et differenciateurs:** (pourquoi nous, innovation, retour sur investissement) Minimum 1500 mots. Ton professionnel, persuasif et factuel." },
    { id: "offre_fin",   label: "Offre financière détaillée",
      icon: "💰", color: "#fcd34d",
      system: "Tu es expert comptable et financier specialise en marches publics marocains. Redige une OFFRE FINANCIERE COMPLETE, TRANSPARENTE et COMPETITIVE. Utilise **Titre:** pour chaque section. Sections obligatoires : **Recapitulatif executif de l offre financiere:** (montant total HT et TTC, synthese en une page) **Decomposition detaillee du prix:** (tableau par lot/phase/poste avec quantite, unite, prix unitaire, sous-total) **Details par phase de projet:** (cout de chaque phase, justification) **Charges de personnel:** (jours/hommes par profil, TJM, total) **Frais et debours:** (deplacement, hebergement, licences, infrastructure) **Modalites de paiement proposees:** (echeancier lie aux jalons, pourcentages, conditions de facturation) **Validite et conditions de l offre:** (duree de validite, conditions de revision des prix, penalites) **Analyse comparative et positionnement prix:** (justification de la competitivite, valeur delivree vs prix) Inclus des tableaux structures. Montant coherent avec le budget indique de l AO. Minimum 800 mots." },
    { id: "exec_summary", label: "Synthèse exécutive & lettre de soumission",
      icon: "📜", color: "#f87171",
      system: "Tu es directeur commercial expert en marches publics marocains. Redige une SYNTHESE EXECUTIVE PERCUTANTE et une LETTRE DE SOUMISSION OFFICIELLE. Utilise **Titre:** pour chaque section. Sections obligatoires : **Lettre de soumission officielle:** (lettre formelle adressant a l organisme, engagement formel du soumissionnaire, references legales au Decret 2-12-349, signature) **Synthese executif (Executive Summary):** (resume en 1 page de toute l offre : qui nous sommes, ce que nous proposons, notre valeur differenciante, notre prix, pourquoi nous choisir) **Points cles de notre offre:** (les 5 arguments decisifs, benefices concrets pour l organisme) **Engagements et garanties:** (engagements contractuels, garanties de bonne execution, references) **Prochaines etapes:** (planning de validation, contacts cles, disponibilite pour soutenance) Ton: assertif, professionnel, persuasif. Doit donner envie de nous choisir. Minimum 600 mots." }
  ];

  const [etapesData, setEtapesData] = useState({});
  const [loadingEtape, setLoadingEtape] = useState(null);
  const [errorEtape,   setErrorEtape]   = useState(null);
  const [generating,   setGenerating]   = useState(false);
  const [progress,     setProgress]     = useState(0);

  useEffect(() => { setEtapesData({}); setLoadingEtape(null); setErrorEtape(null); setProgress(0); }, [tender.id]);

  const src = [tender.sourceNotes, tender.srcContent].filter(Boolean).join("\n\n").slice(0, 8000);
  const aoCtx = "AO: " + tender.reference + " | " + tender.titre + " | Organisme: " + tender.organisme +
    " | Budget: " + tender.budget + " | Secteur: " + tender.secteur + " | Region: " + tender.region +
    " | Date limite: " + tender.dateLimite + " | Criteres: " + (tender.criteres||[]).join(", ") +
    " | Documents: " + (tender.documents||[]).join(", ") + " | Description: " + (tender.description||"").slice(0,500);

  const genEtape = async (etape) => {
    if (!apiKey) { setErrorEtape("Cle API manquante — configurez dans l onglet API."); return; }
    setLoadingEtape(etape.id); setErrorEtape(null);
    try {
      const userMsg = aoCtx + (src ? "\n\nDOCUMENTS SOURCE:\n" + src : "") +
        "\n\nGENERE UNE REPONSE LONGUE, COMPLETE ET PROFESSIONNELLE pour ce marche public.";
      const result = await callClaude(etape.system, userMsg, apiKey);
      setEtapesData(prev => ({ ...prev, [etape.id]: result }));
    } catch(e) {
      setErrorEtape("Erreur etape " + etape.label + " : " + e.message);
    } finally { setLoadingEtape(null); }
  };

  const genAll = async () => {
    if (!apiKey) { setErrorEtape("Cle API manquante."); return; }
    setGenerating(true); setErrorEtape(null); setProgress(0);
    for (let i = 0; i < ETAPES.length; i++) {
      setLoadingEtape(ETAPES[i].id);
      try {
        const userMsg = aoCtx + (src ? "\n\nDOCUMENTS SOURCE:\n" + src : "") +
          "\n\nGENERE UNE REPONSE LONGUE, COMPLETE ET PROFESSIONNELLE pour ce marche public.";
        const result = await callClaude(ETAPES[i].system, userMsg, apiKey);
        setEtapesData(prev => ({ ...prev, [ETAPES[i].id]: result }));
      } catch(e) {
        setErrorEtape("Erreur sur " + ETAPES[i].label + ": " + e.message);
      }
      setLoadingEtape(null);
      setProgress(Math.round((i+1)/ETAPES.length*100));
    }
    setGenerating(false);
  };

  const exportDossier = () => {
    const sections = ETAPES
      .filter(e => etapesData[e.id])
      .map(e => ({ titre: e.icon + " " + e.label, contenu: etapesData[e.id] }));
    if (!sections.length) { alert("Generez au moins une section avant d exporter."); return; }
    const html     = buildDossierPDF(tender, sections);
    const safeName = (tender.reference||"ao").replace(/[^a-zA-Z0-9-]/g,"_");
    dlHTML(html, safeName + "_dossier_reponse.html");
  };

  const completedCount = ETAPES.filter(e => etapesData[e.id]).length;
  const isAllDone = completedCount === ETAPES.length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Bandeau statut */}
      <div style={{ background:"linear-gradient(135deg,#052e16,#0a3d1f)", border:"1px solid #166534", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22 }}>✅</span>
          <div>
            <div style={{ fontSize:13, color:"#6ee7b7", fontWeight:700 }}>Décision GO confirmée</div>
            <div style={{ fontSize:11, color:"#a7f3d0" }}>Génération du dossier de réponse complet — {ETAPES.length} sections</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, color:"#6ee7b7" }}>{completedCount}<span style={{ fontSize:12, color:"#3a7a5a" }}>/{ETAPES.length}</span></div>
            <div style={{ fontSize:9, color:"#3a7a5a" }}>SECTIONS</div>
          </div>
          <button onClick={exportDossier}
            style={{ padding:"10px 18px", borderRadius:10, border:"none", background: isAllDone ? "linear-gradient(135deg,#0D1B3E,#1a3a6a)" : "#111827",
              color: isAllDone ? "#7dd3fc" : "#374151", cursor: isAllDone ? "pointer" : "not-allowed",
              fontSize:12, fontWeight:700, fontFamily:"inherit", display:"flex", alignItems:"center", gap:7 }}>
            📄 Exporter PDF complet
          </button>
        </div>
      </div>

      {/* Bouton tout générer */}
      {!isAllDone && (
        <button onClick={genAll} disabled={generating}
          style={{ padding:"13px 0", borderRadius:12, border:"none",
            background: generating ? "#111827" : "linear-gradient(135deg,#1a3a6a,#0f2240)",
            color: generating ? "#374151" : "#7dd3fc",
            cursor: generating ? "not-allowed" : "pointer",
            fontSize:13, fontWeight:700, fontFamily:"inherit",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            opacity: generating ? 0.7 : 1 }}>
          {generating
            ? <><Spin /> Génération en cours... {progress}% — Ne fermez pas cette fenêtre</>
            : <>⚡ Générer tout le dossier ({ETAPES.length} sections avec Claude)</>}
        </button>
      )}
      {isAllDone && (
        <div style={{ textAlign:"center", padding:"10px 0", fontSize:12, color:"#6ee7b7", fontWeight:700 }}>
          ✓ Dossier complet — Cliquez sur "Exporter PDF complet" pour télécharger
        </div>
      )}

      {/* Barre de progression */}
      {generating && (
        <div style={{ background:"#0a1628", borderRadius:20, height:8, overflow:"hidden" }}>
          <div style={{ width:progress+"%", height:"100%", background:"linear-gradient(90deg,#1a5c8c,#7dd3fc)", transition:"width .4s" }} />
        </div>
      )}

      {/* Erreur */}
      {errorEtape && (
        <div style={{ background:"#2a0a0a", border:"1px solid #7f1d1d", borderRadius:9, padding:"10px 14px", fontSize:12, color:"#f87171" }}>
          ⚠ {errorEtape}
        </div>
      )}

      {/* Étapes individuelles */}
      {ETAPES.map(etape => {
        const done    = !!etapesData[etape.id];
        const loading = loadingEtape === etape.id;
        return (
          <div key={etape.id} style={{ background:"#070f1e", border:"1px solid " + (done ? etape.color + "40" : "#1e3a5f"), borderRadius:12, overflow:"hidden" }}>
            {/* En-tête étape */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background: done ? "#060f1a" : "transparent" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:16 }}>{etape.icon}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color: done ? etape.color : "#e8f0fe" }}>{etape.label}</div>
                  {done && <div style={{ fontSize:10, color:"#3a7a5a", marginTop:2 }}>✓ {Math.round((etapesData[etape.id]||"").length/100)/10} Ko généré</div>}
                </div>
              </div>
              <button onClick={() => genEtape(etape)} disabled={loading || generating}
                style={{ padding:"7px 14px", borderRadius:8, border:"1px solid " + etape.color + "50",
                  background: done ? "#0a2040" : "transparent",
                  color: loading ? "#374151" : etape.color,
                  cursor: (loading||generating) ? "not-allowed" : "pointer",
                  fontSize:11, fontFamily:"inherit", fontWeight:600,
                  display:"flex", alignItems:"center", gap:6, opacity: (loading||generating) ? 0.5 : 1 }}>
                {loading ? <><Spin /> Génération...</> : done ? "🔄 Régénérer" : "⚡ Générer"}
              </button>
            </div>
            {/* Contenu */}
            {loading && (
              <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#5a7da0", borderTop:"1px solid #1e3a5f" }}>
                <Spin /> Analyse approfondie en cours avec Claude...
              </div>
            )}
            {done && !loading && (
              <div style={{ borderTop:"1px solid #1a3a5f", padding:"14px 16px", whiteSpace:"pre-wrap", fontSize:11.5, color:"#c8daf0", lineHeight:1.85, maxHeight:380, overflowY:"auto" }}>
                {etapesData[etape.id]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ONGLET AVANCEMENT — pipeline avec étapes cochables
═══════════════════════════════════════════════════════════════════════════ */
const PIPELINE = [
  { id:"go",          label:"Décision GO",                   icon:"✅", group:"preparation",  color:"#6ee7b7", desc:"AO retenu, décision de répondre prise",               requiresGo: false  },
  { id:"kick",        label:"Réunion de lancement",           icon:"🚀", group:"preparation",  color:"#6ee7b7", desc:"Equipe mobilisée, responsabilités définies",           requiresGo: true   },
  { id:"questions",   label:"Questions au maître d ouvrage",  icon:"❓", group:"preparation",  color:"#6ee7b7", desc:"Questions officielles envoyées (si applicable)",       requiresGo: true   },
  { id:"dossier_dl",  label:"Dossier AO téléchargé",         icon:"📥", group:"preparation",  color:"#6ee7b7", desc:"CPS, plans, annexes récupérés",                        requiresGo: true   },
  { id:"analyse_cps", label:"Analyse du CPS terminée",        icon:"🔍", group:"redaction",    color:"#7dd3fc", desc:"Cahier des charges lu et analysé en détail",           requiresGo: true   },
  { id:"offre_tech",  label:"Offre technique rédigée",        icon:"📝", group:"redaction",    color:"#7dd3fc", desc:"Note méthodologique et offre tech finalisées",         requiresGo: true   },
  { id:"offre_fin",   label:"Offre financière rédigée",       icon:"💰", group:"redaction",    color:"#7dd3fc", desc:"BPU/DQE/tableau de prix finalisés",                   requiresGo: true   },
  { id:"relecture",   label:"Relecture & validation interne", icon:"✏️", group:"redaction",    color:"#7dd3fc", desc:"Double-check qualité par un tiers",                   requiresGo: true   },
  { id:"assemblage",  label:"Assemblage du dossier",          icon:"📁", group:"depot",        color:"#c4b5fd", desc:"Tous les documents regroupés et vérifiés",             requiresGo: true   },
  { id:"signature",   label:"Signature et cachet",            icon:"✍️", group:"depot",        color:"#c4b5fd", desc:"Documents signés et légalisés",                       requiresGo: true   },
  { id:"depot",       label:"Dépôt de l offre",               icon:"📮", group:"depot",        color:"#c4b5fd", desc:"Offre déposée avant la date limite",                  requiresGo: true   },
  { id:"accusé",      label:"Accusé de réception",            icon:"🧾", group:"depot",        color:"#c4b5fd", desc:"Confirmation de dépôt obtenue",                       requiresGo: true   },
  { id:"ouverture",   label:"Séance d ouverture",             icon:"📂", group:"evaluation",   color:"#fcd34d", desc:"Présent à la séance d ouverture des plis",            requiresGo: true   },
  { id:"negociation", label:"Négociation / clarifications",   icon:"🤝", group:"evaluation",   color:"#fcd34d", desc:"Réponse aux questions complémentaires",               requiresGo: true   },
  { id:"resultat",    label:"Résultat de l appel d offres",   icon:"🏆", group:"resultat",     color:"#F59E0B", desc:"Décision officielle notifiée par l organisme",        requiresGo: true   },
];

const GROUPES = [
  { id:"preparation", label:"Préparation",  color:"#6ee7b7", bg:"#052e16", border:"#166534" },
  { id:"redaction",   label:"Rédaction",    color:"#7dd3fc", bg:"#0a1e40", border:"#1e4a8c" },
  { id:"depot",       label:"Dépôt",        color:"#c4b5fd", bg:"#1a0a3a", border:"#4a1a8c" },
  { id:"evaluation",  label:"Évaluation",   color:"#fcd34d", bg:"#2a1a00", border:"#b45309" },
  { id:"resultat",    label:"Résultat",     color:"#F59E0B", bg:"#1a0d00", border:"#92400e" },
];

const ETATS_FINAUX = [
  { id:"gagne",     label:"AO Gagné",     icon:"🏆", color:"#6ee7b7", bg:"linear-gradient(135deg,#052e16,#0a3d1f)", border:"#059669" },
  { id:"perdu",     label:"AO Perdu",     icon:"😔", color:"#f87171", bg:"linear-gradient(135deg,#2a0a0a,#3a0f0f)", border:"#dc2626" },
  { id:"abandonne", label:"Abandonné",    icon:"⏹️", color:"#fcd34d", bg:"linear-gradient(135deg,#2a1a00,#3a2000)", border:"#d97706" },
];

const AvancementTab = ({ tender, onSave }) => {
  const etapes    = tender.etapes || {};
  const decision  = tender.decision || null;
  const etatFinal = tender.etatFinal || null;
  const [notesEtape, setNotesEtape] = useState(tender.notesAvancement || "");
  const [notesSaved, setNotesSaved] = useState(false);

  const toggle = (id) => {
    if (etatFinal) return; // plus de modifs si état final
    const next = { ...etapes, [id]: !etapes[id] };
    onSave(tender.id, { etapes: next });
  };
  const setFinal = (id) => {
    if (etatFinal === id) {
      onSave(tender.id, { etatFinal: null });
    } else {
      onSave(tender.id, { etatFinal: id });
    }
  };
  const saveNotes = () => {
    onSave(tender.id, { notesAvancement: notesEtape });
    setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000);
  };

  // Stats
  const doneCount = PIPELINE.filter(e => etapes[e.id]).length;
  const pct       = Math.round(doneCount / PIPELINE.length * 100);

  // Couleur état final dans la barre d avancement
  const barColor  = etatFinal === "gagne" ? "#059669" : etatFinal === "perdu" ? "#dc2626" : etatFinal === "abandonne" ? "#d97706" : "#3b82f6";

  const inS = { background:"#050d1a", border:"1.5px solid #1e3a5f", borderRadius:8, padding:"8px 10px",
    color:"#e8f0fe", fontSize:11, fontFamily:"inherit", outline:"none", width:"100%",
    boxSizing:"border-box", caretColor:"#F59E0B", resize:"vertical", lineHeight:1.6 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── Bandeau statut global ── */}
      <div style={{ background:"#070f1e", border:"1px solid #1e3a5f", borderRadius:12, padding:"14px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#e8f0fe" }}>Progression globale</div>
            <div style={{ fontSize:10, color:"#5a7da0", marginTop:2 }}>{doneCount} / {PIPELINE.length} étapes complétées</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:800, color: etatFinal==="gagne" ? "#6ee7b7" : etatFinal==="perdu" ? "#f87171" : etatFinal==="abandonne" ? "#fcd34d" : "#7dd3fc" }}>{pct}%</div>
          </div>
        </div>
        {/* Barre de progression */}
        <div style={{ background:"#0a1628", borderRadius:20, height:10, overflow:"hidden", position:"relative" }}>
          <div style={{ width:pct+"%", height:"100%",
            background: etatFinal==="gagne" ? "linear-gradient(90deg,#059669,#6ee7b7)" :
                        etatFinal==="perdu" ? "linear-gradient(90deg,#dc2626,#f87171)" :
                        etatFinal==="abandonne" ? "linear-gradient(90deg,#d97706,#fcd34d)" :
                        "linear-gradient(90deg,#1a5c8c,#7dd3fc)",
            transition:"width .4s ease", borderRadius:20 }} />
        </div>
        {/* Jalon rapide */}
        <div style={{ display:"flex", gap:4, marginTop:10, flexWrap:"wrap" }}>
          {GROUPES.map(g => {
            const etapesGroupe = PIPELINE.filter(e => e.group === g.id);
            const doneGroupe   = etapesGroupe.filter(e => etapes[e.id]).length;
            const allDone      = doneGroupe === etapesGroupe.length;
            return (
              <span key={g.id} style={{ fontSize:10, padding:"3px 8px", borderRadius:12,
                background: allDone ? g.bg : "#0a1628",
                color: allDone ? g.color : "#3a5a7a",
                border:"1px solid " + (allDone ? g.border : "#1e3a5f"),
                fontWeight: allDone ? 700 : 400 }}>
                {allDone ? "✓ " : ""}{g.label} {doneGroupe}/{etapesGroupe.length}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Avertissement si pas GO ── */}
      {decision !== "go" && (
        <div style={{ background:"#1a0d00", border:"1px solid #92400e", borderRadius:9, padding:"10px 14px", fontSize:11, color:"#fcd34d" }}>
          ⚠ Décision GO requise pour activer le pipeline. Rendez-vous dans l onglet <strong>🚦 GO / NO GO</strong>.
        </div>
      )}

      {/* ── État final ── */}
      {etatFinal && (
        <div style={{ background: ETATS_FINAUX.find(e=>e.id===etatFinal)?.bg, border:"2px solid "+ETATS_FINAUX.find(e=>e.id===etatFinal)?.border, borderRadius:14, padding:"18px 20px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:6 }}>{ETATS_FINAUX.find(e=>e.id===etatFinal)?.icon}</div>
          <div style={{ fontSize:16, fontWeight:800, color:ETATS_FINAUX.find(e=>e.id===etatFinal)?.color }}>
            {ETATS_FINAUX.find(e=>e.id===etatFinal)?.label}
          </div>
          <button onClick={() => setFinal(etatFinal)}
            style={{ marginTop:10, background:"transparent", border:"1px solid #1e3a5f", borderRadius:8, padding:"5px 14px", color:"#5a7da0", cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>
            Modifier le résultat
          </button>
        </div>
      )}

      {/* ── Groupes + étapes ── */}
      {GROUPES.map(groupe => {
        const etapesGroupe = PIPELINE.filter(e => e.group === groupe.id);
        return (
          <div key={groupe.id} style={{ background:"#070f1e", border:"1px solid #1e3a5f", borderRadius:12, overflow:"hidden" }}>
            {/* En-tête groupe */}
            <div style={{ background:"linear-gradient(135deg,#0a1628,#07101e)", borderBottom:"1px solid #1e3a5f", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:11, fontWeight:700, color:groupe.color, textTransform:"uppercase", letterSpacing:".06em" }}>
                {groupe.label}
              </div>
              <div style={{ fontSize:10, color:"#3a5a7a" }}>
                {etapesGroupe.filter(e => etapes[e.id]).length}/{etapesGroupe.length}
              </div>
            </div>
            {/* Étapes */}
            {etapesGroupe.map((etape, idx) => {
              const done      = !!etapes[etape.id];
              const locked    = etape.requiresGo && decision !== "go";
              const isFinalEt = etatFinal && groupe.id === "resultat";
              return (
                <div key={etape.id}
                  onClick={() => !locked && !etatFinal && toggle(etape.id)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
                    borderBottom: idx < etapesGroupe.length-1 ? "1px solid #0d1e38" : "none",
                    background: done ? "#060e1a" : "transparent",
                    cursor: locked || etatFinal ? "not-allowed" : "pointer",
                    opacity: locked ? 0.35 : 1,
                    transition:"background .15s" }}>
                  {/* Checkbox */}
                  <div style={{ width:22, height:22, borderRadius:6, flexShrink:0,
                    background: done ? etape.color : "transparent",
                    border:"2px solid " + (done ? etape.color : "#2a4a6a"),
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all .2s", boxShadow: done ? "0 0 8px "+etape.color+"60" : "none" }}>
                    {done && <span style={{ fontSize:13, lineHeight:1, color:"#060e1e", fontWeight:900 }}>✓</span>}
                  </div>
                  {/* Icône */}
                  <span style={{ fontSize:15, flexShrink:0 }}>{etape.icon}</span>
                  {/* Texte */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight: done ? 700 : 400, color: done ? "#e8f0fe" : "#7aa3cc", lineHeight:1.3 }}>{etape.label}</div>
                    <div style={{ fontSize:10, color: done ? "#3a7a5a" : "#2a4a6a", marginTop:2 }}>{etape.desc}</div>
                  </div>
                  {/* Badge fait */}
                  {done && <span style={{ fontSize:9, background:"#052e16", color:"#6ee7b7", borderRadius:10, padding:"2px 7px", whiteSpace:"nowrap", flexShrink:0 }}>Fait</span>}
                  {locked && <span style={{ fontSize:9, color:"#2a4a6a", flexShrink:0 }}>🔒</span>}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── État final boutons ── */}
      {decision === "go" && !etatFinal && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#F59E0B", textTransform:"uppercase", letterSpacing:".06em", marginBottom:10 }}>Résultat final de l AO</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {ETATS_FINAUX.map(ef => (
              <button key={ef.id} onClick={() => setFinal(ef.id)}
                style={{ padding:"14px 8px", borderRadius:12, border:"1px solid #1e3a5f",
                  background:"#070f1e", color:"#5a7da0",
                  cursor:"pointer", fontFamily:"inherit", transition:"all .2s",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}
                onMouseEnter={e => { e.currentTarget.style.background=ef.bg.replace("linear-gradient","linear-gradient"); e.currentTarget.style.borderColor=ef.border; e.currentTarget.style.color=ef.color; }}
                onMouseLeave={e => { e.currentTarget.style.background="#070f1e"; e.currentTarget.style.borderColor="#1e3a5f"; e.currentTarget.style.color="#5a7da0"; }}>
                <span style={{ fontSize:22 }}>{ef.icon}</span>
                <span style={{ fontSize:11, fontWeight:700 }}>{ef.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Notes d avancement ── */}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:"#7aa3cc", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Notes d avancement</div>
        <textarea value={notesEtape} onChange={e => setNotesEtape(e.target.value)}
          placeholder="Contacts, compte-rendu de réunion, points de blocage..."
          rows={3} style={inS}
          onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
        <button onClick={saveNotes}
          style={{ marginTop:6, background: notesSaved ? "#0d3a2a" : "transparent", border:"1px solid " + (notesSaved ? "#6ee7b7" : "#1e3a5f"),
            borderRadius:8, padding:"7px 14px", color: notesSaved ? "#6ee7b7" : "#5a7da0",
            cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
          {notesSaved ? "✓ Notes sauvegardées" : "Sauvegarder les notes"}
        </button>
      </div>

    </div>
  );
};

/* Panneau principal d'analyse */
const AnalysisPanel = ({ tender, apiKey, onSave }) => {
  const [tab,      setTab]      = useState("detail");
  const [analysis, setAnalysis] = useState("");
  const [tech,     setTech]     = useState("");
  const [fin,      setFin]      = useState("");

  // Reset quand on change d'AO
  useEffect(() => { setTab("detail"); setAnalysis(""); setTech(""); setFin(""); }, [tender.id]);

  const decision = tender.decision || null;

  const TABS = [
    { k: "detail",      l: "📋 Détail"     },
    { k: "gonogo",      l: "🚦 GO / NO GO" },
    { k: "avancement",  l: "📊 Avancement" },
    { k: "source",      l: "📎 Docs"       },
    { k: "analysis",    l: "🔍 Analyse"    },
    { k: "technique",   l: "📝 Tech."      },
    { k: "financiere",  l: "💰 Fin."       },
    { k: "dossier",     l: "📄 Dossier"    },
    { k: "experts",     l: "👥 Experts"    }
  ];

  const ts = k => {
    const isGo   = k === "dossier" && decision !== "go";
    const active = tab === k;
    return {
      padding: "8px 10px", border: "none",
      borderBottom: active ? "2px solid #F59E0B" : "2px solid transparent",
      borderRadius: "6px 6px 0 0",
      background: active ? "#0a1e3a" : "transparent",
      color: isGo ? "#2a4a6a" : active ? "#e8f0fe" : "#5a7da0",
      cursor: isGo ? "not-allowed" : "pointer",
      fontSize: 11, fontFamily: "inherit", fontWeight: active ? 700 : 400,
      whiteSpace: "nowrap", transition: "all .15s", flexShrink: 0,
      opacity: isGo ? 0.4 : 1
    };
  };

  const days = Math.ceil((new Date(tender.dateLimite) - new Date()) / 86400000);

  const goBadge = decision === "go"
    ? { text: "✅ GO", bg: "#052e16", color: "#6ee7b7", border: "#166534" }
    : decision === "nogo"
    ? { text: "🚫 NO GO", bg: "#2a0a0a", color: "#f87171", border: "#7f1d1d" }
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#07101e", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
        {/* Bandeau Source */}
        <div style={{ background: "#080f1c", borderBottom: "1px solid #1a3a5f", padding: "7px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#5a7da0", textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}>📎 Sources</span>
          {tender.sourceUrl
            ? <a href={tender.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#7dd3fc", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔗 {tender.sourceUrl}</a>
            : <span style={{ fontSize: 11, color: "#2a4a6a", fontStyle: "italic" }}>Aucune URL</span>}
          {tender.sourceDossier && <span style={{ fontSize: 11, color: "#6ee7b7", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>📁 {tender.sourceDossier}</span>}
          {tender.srcFileName   && <span style={{ fontSize: 10, background: "#0a2040", color: "#7dd3fc", borderRadius: 5, padding: "2px 8px" }}>📄 {tender.srcFileName}</span>}
          {goBadge && <span style={{ marginLeft:"auto", background: goBadge.bg, color: goBadge.color, border:"1px solid " + goBadge.border, borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700 }}>{goBadge.text}</span>}
        </div>
        {/* Titre + onglets */}
        <div style={{ padding: "14px 24px 0" }}>
          <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700, marginBottom: 3 }}>{tender.reference}</div>
          <div style={{ fontSize: 15, color: "#e8f0fe", fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>{tender.titre}</div>
          <div style={{ fontSize: 12, color: "#7dd3fc", marginBottom: 12 }}>{tender.organisme} · {tender.budget}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => { if (t.k === "dossier" && decision !== "go") return; setTab(t.k); }} style={ts(t.k)}>
                {t.l}{t.k === "dossier" && decision !== "go" ? " 🔒" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Corps */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── DÉTAIL ── */}
        {tab === "detail" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: "#a8c5e0", lineHeight: 1.75 }}>{tender.description}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Region", tender.region, "#7dd3fc"], ["Type", tender.type, "#c4b5fd"],
                ["Date limite", new Date(tender.dateLimite).toLocaleDateString("fr-FR"), "#fcd34d"],
                ["Echeance", "J-" + days, days < 7 ? "#f87171" : days < 14 ? "#fcd34d" : "#6ee7b7"]
              ].map(([l, v, col]) => (
                <div key={l} style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: "#5a7da0", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>{l}</div>
                  <div style={{ fontSize: 13, color: col, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            {[["Criteres d evaluation", "#6ee7b7", tender.criteres], ["Documents requis", "#c4b5fd", tender.documents]].map(([label, color, items]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 7 }}>{label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(items||[]).map(x => <span key={x} style={{ background: "#0a1628", color, border: "1px solid " + color + "40", borderRadius: 20, padding: "3px 10px", fontSize: 11 }}>{x}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── GO / NO GO ── */}
        {tab === "gonogo" && (
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ fontSize:12, color:"#a8c5e0", lineHeight:1.7 }}>
              Évaluez la pertinence de cet AO avant d engager des ressources. La décision GO débloque le <strong style={{ color:"#7dd3fc" }}>Dossier de réponse complet</strong>.
            </div>

            {/* Critères d'évaluation */}
            <div style={{ background:"#070f1e", border:"1px solid #1e3a5f", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#fcd34d", textTransform:"uppercase", letterSpacing:".06em", marginBottom:12 }}>Grille d évaluation GO / NO GO</div>
              {[
                ["🎯 Adéquation avec notre cœur de métier",     "Secteur: " + tender.secteur],
                ["💰 Budget estimé suffisant",                   "Budget déclaré: " + tender.budget],
                ["⏱ Délai de réponse réaliste",                 "Date limite: " + new Date(tender.dateLimite).toLocaleDateString("fr-FR") + " (J-" + days + ")"],
                ["🏆 Critères favorables",                       (tender.criteres||[]).slice(0,3).join(", ") || "—"],
                ["📄 Documents requis maîtrisés",                (tender.documents||[]).length + " document(s) requis"],
                ["🌍 Zone géographique couverte",                tender.region || "Non précisée"],
              ].map(([label, detail], i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #1e3a5f" }}>
                  <div>
                    <div style={{ fontSize:12, color:"#e8f0fe" }}>{label}</div>
                    <div style={{ fontSize:10, color:"#5a7da0", marginTop:2 }}>{detail}</div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <span style={{ fontSize:16 }}>{["✅","💛","✅","💛","✅","✅"][i]}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Décision actuelle */}
            {decision && (
              <div style={{ background: decision==="go" ? "#052e16" : "#2a0a0a", border:"1px solid " + (decision==="go" ? "#166534" : "#7f1d1d"), borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{decision==="go" ? "✅" : "🚫"}</div>
                <div style={{ fontSize:16, fontWeight:800, color: decision==="go" ? "#6ee7b7" : "#f87171" }}>
                  Décision actuelle : {decision==="go" ? "GO — Nous répondons à cet AO" : "NO GO — AO écarté"}
                </div>
                <div style={{ fontSize:11, color: decision==="go" ? "#a7f3d0" : "#fca5a5", marginTop:6 }}>
                  {decision==="go" ? "L onglet Dossier est débloqué — générez votre réponse complète" : "Cet AO n apparaît plus dans la liste principale"}
                </div>
              </div>
            )}

            {/* Boutons GO / NO GO */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <button
                onClick={() => onSave(tender.id, { decision: "go" })}
                style={{ padding:"18px 0", borderRadius:14, border:"2px solid " + (decision==="go" ? "#059669" : "#1e3a5f"),
                  background: decision==="go" ? "linear-gradient(135deg,#052e16,#0a3d1f)" : "#070f1e",
                  color: decision==="go" ? "#6ee7b7" : "#3a5a7a",
                  cursor:"pointer", fontFamily:"inherit", transition:"all .2s",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:32 }}>✅</span>
                <span style={{ fontSize:14, fontWeight:800 }}>GO</span>
                <span style={{ fontSize:10, textAlign:"center", lineHeight:1.4 }}>Nous répondons à cet AO<br/>Débloque le Dossier complet</span>
              </button>
              <button
                onClick={() => onSave(tender.id, { decision: "nogo" })}
                style={{ padding:"18px 0", borderRadius:14, border:"2px solid " + (decision==="nogo" ? "#dc2626" : "#1e3a5f"),
                  background: decision==="nogo" ? "linear-gradient(135deg,#2a0a0a,#3a0f0f)" : "#070f1e",
                  color: decision==="nogo" ? "#f87171" : "#3a5a7a",
                  cursor:"pointer", fontFamily:"inherit", transition:"all .2s",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:32 }}>🚫</span>
                <span style={{ fontSize:14, fontWeight:800 }}>NO GO</span>
                <span style={{ fontSize:10, textAlign:"center", lineHeight:1.4 }}>AO non retenu<br/>Masqué dans la liste</span>
              </button>
            </div>

            {/* Accès rapide si GO */}
            {decision === "go" && (
              <button onClick={() => setTab("dossier")}
                style={{ padding:"13px 0", borderRadius:12, border:"none", background:"linear-gradient(135deg,#1a3a6a,#0f2240)", color:"#7dd3fc", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                📄 Accéder au Dossier de réponse →
              </button>
            )}
          </div>
        )}

        {tab === "avancement" && <AvancementTab tender={tender} onSave={onSave} />}
        {tab === "source"    && <SourceTab tender={tender} onSave={onSave} apiKey={apiKey} />}
        {tab === "analysis"  && <GenTab tender={tender} apiKey={apiKey} genType="analysis"  content={analysis}  setContent={setAnalysis} onSave={onSave} />}
        {tab === "technique" && <GenTab tender={tender} apiKey={apiKey} genType="technique" content={tech}      setContent={setTech}     onSave={onSave} />}
        {tab === "financiere"&& <GenTab tender={tender} apiKey={apiKey} genType="financiere"content={fin}       setContent={setFin}      onSave={onSave} />}
        {tab === "dossier"   && <DossierTab tender={tender} apiKey={apiKey} onSave={onSave} />}
        {tab === "experts"   && <ExpertsTab tender={tender} apiKey={apiKey} />}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   APP PRINCIPALE
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [tenders,  setTenders]  = useState(TENDERS_INIT);
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState("");
  const [secteur,  setSecteur]  = useState("Tous");
  const [statut,   setStatut]   = useState("Tous");
  const [sideTab,  setSideTab]  = useState("ao");
  const [apiKey,   setApiKey]   = useState("");
  const [email,    setEmail]    = useState("");
  const [expMode,  setExpMode]  = useState("local");
  const [showNogo, setShowNogo] = useState(false);

  // États pour l'import d'un nouvel AO
  const [importMode,    setImportMode]    = useState("file"); // "file" | "url"
  const [importUrl,     setImportUrl]     = useState("");
  const [importFile,    setImportFile]    = useState(null);
  const [importContent, setImportContent] = useState("");
  const [importDossier, setImportDossier] = useState("");
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null); // AO extrait avant confirmation
  const [importError,   setImportError]   = useState("");
  const importFileRef = useRef(null);

  const filtered = tenders.filter(t => {
    if (!showNogo && t.decision === "nogo") return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.titre.toLowerCase().includes(s) && !t.organisme.toLowerCase().includes(s) && !t.reference.toLowerCase().includes(s)) return false;
    }
    if (secteur !== "Tous" && t.secteur !== secteur) return false;
    if (statut  !== "Tous" && t.statut  !== statut)  return false;
    return true;
  });

  const updateTender = (id, data) => setTenders(ts => ts.map(t => t.id === id ? { ...t, ...data } : t));

  // Lecture d'un fichier local pour import
  const handleImportFile = async f => {
    if (!f) return;
    setImportFile(f); setImportContent(""); setImportResult(null); setImportError("");
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (["txt","md","csv","json","xml","html","js","ts","log"].includes(ext)) {
      setImportContent((await f.text()).slice(0, 14000));
    } else {
      setImportContent("[Fichier binaire : " + f.name + " — " + Math.round(f.size/1024) + " Ko]");
    }
    // Pré-remplir le dossier avec le nom du fichier
    setImportDossier(f.name);
  };

  // Extraction IA et création d'un nouvel AO
  const runImport = async () => {
    setImportError(""); setImportResult(null);
    if (!apiKey) { setImportError("Configurez votre cle API dans l onglet API."); return; }
    const src = importMode === "url" ? ("URL source : " + importUrl) : importContent;
    if (!src.trim()) { setImportError("Aucun contenu a analyser."); return; }
    setImporting(true);
    try {
      const sys = "Tu es expert marches publics Maroc. A partir du contenu fourni, extrais les informations de cet appel d offres et reponds UNIQUEMENT en JSON strict sans markdown :\n{\"reference\":\"...\",\"titre\":\"...\",\"organisme\":\"...\",\"budget\":\"...\",\"dateLimite\":\"YYYY-MM-DD\",\"region\":\"...\",\"secteur\":\"...\",\"type\":\"...\",\"description\":\"...\",\"criteres\":[],\"documents\":[]}\nSi une info est manquante, mets une valeur vide ou une estimation raisonnable.";
      const txt = await callClaude(sys, src.slice(0, 12000), apiKey);
      const clean = txt.replace(/```json|```/g,"").trim();
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Impossible d extraire les donnees. Verifiez le contenu source.");
      const parsed = JSON.parse(m[0]);
      // Valider la date
      if (!parsed.dateLimite || isNaN(new Date(parsed.dateLimite))) {
        parsed.dateLimite = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
      }
      setImportResult(parsed);
    } catch(e) {
      setImportError(e.message);
    } finally { setImporting(false); }
  };

  // Confirmer l'ajout de l'AO importé
  const confirmImport = () => {
    if (!importResult) return;
    const newId = "ao" + Date.now();
    const newAO = {
      id: newId,
      reference:    importResult.reference    || "REF/" + Date.now(),
      titre:        importResult.titre        || "Nouvel AO",
      organisme:    importResult.organisme    || "",
      budget:       importResult.budget       || "",
      dateLimite:   importResult.dateLimite   || new Date(Date.now()+30*86400000).toISOString().slice(0,10),
      region:       importResult.region       || "",
      type:         importResult.type         || "Appel d offres ouvert",
      secteur:      importResult.secteur      || "Autres",
      description:  importResult.description  || "",
      criteres:     importResult.criteres     || [],
      documents:    importResult.documents    || [],
      sourceUrl:    importMode === "url" ? importUrl : "",
      sourceDossier:importMode === "file" ? importDossier : "",
      sourceNotes:  "",
      srcFileName:  importFile ? importFile.name : "",
      srcContent:   importContent.slice(0, 12000),
      decision:     null
    };
    setTenders(ts => [newAO, ...ts]);
    setSelected(newAO);
    // Reset
    setImportResult(null); setImportUrl(""); setImportFile(null);
    setImportContent(""); setImportDossier(""); setImportError("");
    setSideTab("ao");
  };

  const SI = { background: "#060e1e", border: "1px solid #1e3a5f", borderRadius: 8, padding: "7px 10px", color: "#e8f0fe", fontSize: 11, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer" };
  // Style input pour onglet Source sidebar
  const iS = { background: "#050d1a", border: "1.5px solid #1e3a5f", borderRadius: 8, padding: "8px 10px", color: "#e8f0fe", fontSize: 11, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", caretColor: "#F59E0B", transition: "border-color .2s" };

  const stab = k => ({
    padding: "9px 0", background: "transparent", border: "none",
    borderBottom: sideTab === k ? "2px solid #F59E0B" : "2px solid transparent",
    color: sideTab === k ? "#F59E0B" : "#5a7da0",
    cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, flex: 1
  });

  const stats = [
    ["Total", tenders.length, "#7dd3fc"],
    ["Ouverts", tenders.filter(t => t.statut === "Ouvert").length, "#6ee7b7"],
    ["Nouveaux", tenders.filter(t => t.statut === "Nouveau").length, "#fcd34d"],
    ["Urgents", tenders.filter(t => Math.ceil((new Date(t.dateLimite) - new Date()) / 86400000) < 7).length, "#f87171"]
  ];

  return (
    <ExportCtx.Provider value={{ emailDest: email, exportMode: expMode }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.25;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0a1628; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
      `}</style>
      <div style={{ display: "flex", height: "100vh", background: "#060e1e", color: "#e8f0fe", fontFamily: "Arial, sans-serif", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 265, background: "#07101e", borderRight: "1px solid #1e3a5f", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid #1e3a5f" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#e8f0fe", marginBottom: 2 }}>🏛 AO Manager Maroc</div>
            <div style={{ fontSize: 10, color: "#3a5a7a" }}>Marchés publics · {MODEL}</div>
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #1e3a5f", padding: "0 6px" }}>
            <button onClick={() => setSideTab("ao")}     style={stab("ao")}>📋 AO</button>
            <button onClick={() => setSideTab("api")}    style={stab("api")}>🔑 API</button>
            <button onClick={() => setSideTab("config")} style={stab("config")}>⚙ Config</button>
            <button onClick={() => setSideTab("source")} style={stab("source")}>📎 Source</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {sideTab === "ao" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {stats.map(([l, v, c]) => (
                    <div key={l} style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: 9, color: "#5a7da0", marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#4a6a8a", lineHeight: 1.6, padding: "9px 10px", background: "#0a1628", borderRadius: 8, border: "1px solid #1e3a5f" }}>
                  <strong style={{ color: "#7dd3fc" }}>Export documents :</strong> un fichier <strong style={{ color: "#F59E0B" }}>.html</strong> est telecharge. Ouvrez-le dans Chrome puis <strong style={{ color: "#F59E0B" }}>Ctrl+P → Enregistrer en PDF</strong>.
                </div>
              </div>
            )}
            {sideTab === "api" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input label="Cle API Claude" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..." hint="Cle locale, non envoyee a Anthropic" />
                {apiKey && (
                  <div style={{ fontSize: 10, color: apiKey.startsWith("sk-") ? "#6ee7b7" : "#f87171" }}>
                    {apiKey.startsWith("sk-") ? "✓ Format valide — " + apiKey.length + " car." : "⚠ Format incorrect (doit commencer par sk-)"}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "#3a5a7a", lineHeight: 1.5, padding: "8px 10px", background: "#0a1628", borderRadius: 8, border: "1px solid #1e3a5f" }}>
                  Modele actif : <strong style={{ color: "#7dd3fc" }}>{MODEL}</strong><br />
                  Obtenez votre cle sur <strong style={{ color: "#F59E0B" }}>console.anthropic.com</strong>
                </div>
              </div>
            )}
            {sideTab === "config" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Input label="Email destinataire" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="nom@societe.ma" successMsg="Adresse email valide" />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Mode export PDF</div>
                  {[["local", "💾", "Local", "Ouvre directement la fenetre PDF"],
                    ["ask",   "🔀", "Choisir", "Propose local ou email a l export"],
                    ["email", "✉️", "Email",  "Telecharge + propose envoi email"]
                  ].map(([v, em, l, d]) => (
                    <label key={v} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 10px", borderRadius: 8, background: expMode === v ? "#0a2040" : "transparent", border: "1px solid " + (expMode === v ? "#3a7aaf" : "transparent"), cursor: "pointer", marginBottom: 4 }}>
                      <input type="radio" name="expmode" value={v} checked={expMode === v} onChange={() => setExpMode(v)} style={{ marginTop: 2, accentColor: "#F59E0B" }} />
                      <div>
                        <div style={{ fontSize: 12, color: "#e8f0fe", fontWeight: 600 }}>{em} {l}</div>
                        <div style={{ fontSize: 10, color: "#5a7da0", marginTop: 1 }}>{d}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {sideTab === "source" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ── SECTION : AO SÉLECTIONNÉ ── */}
                {selected && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Sources de l AO actif</div>
                    <div style={{ fontSize: 11, color: "#e8f0fe", fontWeight: 600, lineHeight: 1.4, padding: "7px 10px", background: "#0a1628", borderRadius: 7, border: "1px solid #1e3a5f" }}>
                      {selected.reference}<br/>
                      <span style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 400 }}>{selected.organisme}</span>
                    </div>
                    {/* URL */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>URL marchespublics.gov.ma</div>
                      <input type="url" value={selected.sourceUrl || ""}
                        onChange={e => updateTender(selected.id, { sourceUrl: e.target.value })}
                        placeholder="https://www.marchespublics.gov.ma/..."
                        style={iS} onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
                      {selected.sourceUrl && (
                        <a href={selected.sourceUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: "#7dd3fc", textDecoration: "none", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          🔗 Ouvrir
                        </a>
                      )}
                    </div>
                    {/* Dossier */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Dossier local</div>
                      <input type="text" value={selected.sourceDossier || ""}
                        onChange={e => updateTender(selected.id, { sourceDossier: e.target.value })}
                        placeholder="C:/Users/Ghazi/AO/..."
                        style={iS} onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
                      {selected.sourceDossier && <div style={{ fontSize: 10, color: "#6ee7b7", marginTop: 3 }}>📁 {selected.sourceDossier}</div>}
                    </div>
                    {/* Notes */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Notes</div>
                      <textarea value={selected.sourceNotes || ""}
                        onChange={e => updateTender(selected.id, { sourceNotes: e.target.value })}
                        placeholder="Contacts, remarques..." rows={2}
                        style={{ ...iS, resize: "vertical", lineHeight: 1.6 }}
                        onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
                    </div>
                  </div>
                )}

                {/* Séparateur */}
                <div style={{ borderTop: "1px solid #1e3a5f", paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                    ➕ Importer un nouvel AO
                  </div>

                  {/* Toggle Fichier / URL */}
                  <div style={{ display: "flex", background: "#060e1a", borderRadius: 8, border: "1px solid #1e3a5f", marginBottom: 12, overflow: "hidden" }}>
                    {[["file","📁 Fichier local"],["url","🔗 URL"]].map(([m,l]) => (
                      <button key={m} onClick={() => { setImportMode(m); setImportResult(null); setImportError(""); }}
                        style={{ flex: 1, padding: "8px 0", background: importMode===m ? "#0a2040" : "transparent", border: "none",
                          borderBottom: importMode===m ? "2px solid #F59E0B" : "2px solid transparent",
                          color: importMode===m ? "#e8f0fe" : "#5a7da0", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: importMode===m ? 700 : 400 }}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* Import Fichier */}
                  {importMode === "file" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <div
                        onClick={() => importFileRef.current?.click()}
                        onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#F59E0B";}}
                        onDragLeave={e=>{e.currentTarget.style.borderColor="#1e3a5f";}}
                        onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="#1e3a5f";handleImportFile(e.dataTransfer.files[0]);}}
                        style={{ border: "2px dashed #1e3a5f", borderRadius: 9, padding: "14px 10px", textAlign: "center", cursor: "pointer", background: "#060e1a", transition: "border-color .2s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#F59E0B"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="#1e3a5f"}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{importFile ? "📄" : "📂"}</div>
                        {importFile
                          ? <div style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>{importFile.name}<br/><span style={{ color: "#3a7a5a", fontWeight: 400 }}>{importContent.length} car. lus</span></div>
                          : <div><div style={{ fontSize: 11, color: "#5a7da0" }}>Cliquer ou glisser le dossier AO</div><div style={{ fontSize: 10, color: "#2a4a6a", marginTop: 2 }}>TXT · PDF texte · HTML · MD · JSON</div></div>}
                      </div>
                      <input ref={importFileRef} type="file" style={{ display:"none" }}
                        accept=".txt,.md,.csv,.json,.xml,.html,.log,.htm"
                        onChange={e=>{const f=e.target.files?.[0];if(f)handleImportFile(f);}} />
                      {importFile && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Chemin / Dossier local</div>
                          <input type="text" value={importDossier}
                            onChange={e=>setImportDossier(e.target.value)}
                            placeholder="C:/Users/Ghazi/AO/dossier..."
                            style={iS} onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
                        </div>
                      )}
                      {importFile && <button onClick={()=>{setImportFile(null);setImportContent("");setImportResult(null);setImportError("");}} style={{ background:"transparent",border:"none",cursor:"pointer",color:"#f87171",fontSize:10,fontFamily:"inherit",padding:0,textAlign:"left" }}>✕ Retirer le fichier</button>}
                    </div>
                  )}

                  {/* Import URL */}
                  {importMode === "url" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#7aa3cc", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>URL de l AO</div>
                      <input type="url" value={importUrl} onChange={e=>setImportUrl(e.target.value)}
                        placeholder="https://www.marchespublics.gov.ma/..."
                        style={iS} onFocus={e=>e.target.style.borderColor="#F59E0B"} onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
                      <div style={{ fontSize: 10, color: "#3a5a7a", lineHeight: 1.5, padding: "7px 9px", background: "#0a1628", borderRadius: 7, border: "1px solid #1e3a5f" }}>
                        L URL sera enregistree comme source. Claude extraira les donnees a partir de l adresse fournie.
                      </div>
                    </div>
                  )}

                  {/* Erreur */}
                  {importError && (
                    <div style={{ background: "#2a0a0a", border: "1px solid #7f1d1d", borderRadius: 7, padding: "8px 10px", fontSize: 11, color: "#f87171", marginTop: 6 }}>
                      ⚠ {importError}
                    </div>
                  )}

                  {/* Bouton extraction IA */}
                  <button onClick={runImport}
                    disabled={importing || (importMode==="file" ? !importContent : !importUrl)}
                    style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 9, border: "none",
                      background: importing || (importMode==="file" ? !importContent : !importUrl) ? "#111827" : "linear-gradient(135deg,#1a5c3a,#0d3a22)",
                      color: importing || (importMode==="file" ? !importContent : !importUrl) ? "#374151" : "#6ee7b7",
                      cursor: importing || (importMode==="file" ? !importContent : !importUrl) ? "not-allowed" : "pointer",
                      fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      opacity: importing || (importMode==="file" ? !importContent : !importUrl) ? 0.5 : 1 }}>
                    {importing ? <><Spin /> Extraction IA...</> : <>⚡ Extraire et creer l AO</>}
                  </button>

                  {/* Aperçu du résultat avant confirmation */}
                  {importResult && (
                    <div style={{ background: "#060e1a", border: "1px solid #1a5c3a", borderRadius: 10, padding: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>AO extrait — apercu</div>
                      <div style={{ fontSize: 12, color: "#e8f0fe", fontWeight: 700, lineHeight: 1.4 }}>{importResult.titre || "—"}</div>
                      <div style={{ fontSize: 11, color: "#7dd3fc" }}>{importResult.organisme || "—"}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {importResult.budget && <span style={{ fontSize: 10, color: "#6ee7b7", background: "#052e16", borderRadius: 5, padding: "2px 7px" }}>{importResult.budget}</span>}
                        {importResult.dateLimite && <span style={{ fontSize: 10, color: "#fcd34d", background: "#2a1a00", borderRadius: 5, padding: "2px 7px" }}>Limite : {importResult.dateLimite}</span>}
                        {importResult.secteur && <span style={{ fontSize: 10, color: "#c4b5fd", background: "#1a0a3a", borderRadius: 5, padding: "2px 7px" }}>{importResult.secteur}</span>}
                      </div>
                      {importResult.reference && <div style={{ fontSize: 10, color: "#5a7da0" }}>Ref : {importResult.reference}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={confirmImport}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a5c8c,#0f3a5c)", color: "#7dd3fc", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
                          ✓ Ajouter cet AO
                        </button>
                        <button onClick={() => { setImportResult(null); setImportError(""); }}
                          style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #1e3a5f", background: "transparent", color: "#5a7da0", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── LISTE AO ── */}
        <div style={{ width: 305, display: "flex", flexDirection: "column", borderRight: "1px solid #1e3a5f", flexShrink: 0 }}>
          <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid #1e3a5f", display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 9, padding: "7px 11px" }}>
              🔍
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un AO..."
                style={{ background: "transparent", border: "none", outline: "none", color: "#e8f0fe", fontSize: 12, flex: 1, fontFamily: "inherit" }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#5a7da0", padding: 0, fontSize: 14 }}>✕</button>}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <select value={secteur} onChange={e => setSecteur(e.target.value)} style={SI}>
                {SECTEURS.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={statut} onChange={e => setStatut(e.target.value)} style={SI}>
                {STATUTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => setShowNogo(v => !v)}
              style={{ background: showNogo ? "#2a0a0a" : "transparent", border:"1px solid " + (showNogo ? "#7f1d1d" : "#1e3a5f"), borderRadius:8, padding:"5px 10px", color: showNogo ? "#f87171" : "#3a5a7a", cursor:"pointer", fontSize:10, fontFamily:"inherit", textAlign:"left" }}>
              {showNogo ? "🚫 Masquer les NO GO" : "👁 Afficher les NO GO"}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {filtered.length === 0
              ? <div style={{ textAlign: "center", color: "#3a5a7a", fontSize: 12, marginTop: 40 }}>Aucun AO trouve</div>
              : filtered.map(t => <TenderCard key={t.id} tender={t} onSelect={setSelected} selected={selected?.id === t.id} />)
            }
          </div>
        </div>

        {/* ── PANNEAU DETAIL ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          {selected
            ? <AnalysisPanel tender={selected} apiKey={apiKey} onSave={updateTender} />
            : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: "#3a5a7a" }}>
                <div style={{ fontSize: 52 }}>🏛</div>
                <div style={{ fontSize: 16, color: "#5a7da0", fontWeight: 600 }}>Selectionnez un appel d offres</div>
                <div style={{ fontSize: 12, color: "#2a4a6a" }}>Marches publics marocains · Analyse IA · Export PDF</div>
                {!apiKey && (
                  <div style={{ fontSize: 11, color: "#F59E0B", background: "#1a0d00", border: "1px solid #b45309", borderRadius: 8, padding: "8px 14px", marginTop: 6 }}>
                    ⚠ Pensez a configurer votre cle API dans l onglet <strong>🔑 API</strong>
                  </div>
                )}
              </div>
            )
          }
        </div>
      </div>
    </ExportCtx.Provider>
  );
}
