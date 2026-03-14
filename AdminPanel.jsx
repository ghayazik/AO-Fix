import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────
   Clé localStorage pour persister les utilisateurs
───────────────────────────────────────────────────────────────────── */
export const USERS_STORAGE_KEY = "ao_manager_users";

/* Utilisateurs par défaut (chargés si localStorage vide) */
export const DEFAULT_USERS = [
  { id: "u1", login: "admin",    password: "Admin2026!",  nom: "Administrateur",     role: "admin",  actif: true,  createdAt: "2026-01-01" },
  { id: "u2", login: "ghazi",    password: "AO2026#Maroc",nom: "Ghazi El Yousfi",    role: "admin",  actif: true,  createdAt: "2026-01-01" },
  { id: "u3", login: "equipe1",  password: "Equipe2026!", nom: "Equipe Commerciale", role: "user",   actif: true,  createdAt: "2026-01-01" },
  { id: "u4", login: "equipe2",  password: "Offres2026!", nom: "Equipe Technique",   role: "user",   actif: true,  createdAt: "2026-01-01" },
];

/* ─── Helpers ────────────────────────────────────────────────────── */
export const loadUsers = () => {
  try {
    const s = localStorage.getItem(USERS_STORAGE_KEY);
    return s ? JSON.parse(s) : DEFAULT_USERS;
  } catch { return DEFAULT_USERS; }
};

export const saveUsers = (users) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const genId = () => "u" + Date.now() + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);

/* ─── Styles communs ─────────────────────────────────────────────── */
const S = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 30% 10%, #0d1f4a 0%, #060e1e 55%, #020810 100%)",
    fontFamily: "'Trebuchet MS', Arial, sans-serif",
    color: "#e8f0fe",
    padding: "0 0 60px",
  },
  grid: {
    position: "fixed", inset: 0, pointerEvents: "none",
    backgroundImage: "linear-gradient(rgba(30,58,95,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(30,58,95,.13) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
  },
  header: {
    background: "rgba(7,16,30,.96)",
    borderBottom: "1px solid #1e3a5f",
    padding: "0 32px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    height: 60, position: "sticky", top: 0, zIndex: 100,
    backdropFilter: "blur(16px)",
  },
  card: {
    background: "rgba(7,16,30,.92)",
    border: "1px solid #1e3a5f",
    borderRadius: 14,
    padding: "24px 28px",
  },
  input: {
    width: "100%", boxSizing: "border-box",
    background: "#050d1a", border: "1.5px solid #1e3a5f", borderRadius: 9,
    padding: "10px 13px", color: "#e8f0fe", fontSize: 13,
    fontFamily: "'Trebuchet MS', sans-serif", outline: "none",
    caretColor: "#F59E0B", transition: "border-color .2s",
  },
  label: {
    fontSize: 10, fontWeight: 700, color: "#5a7da0",
    textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5,
    display: "block",
  },
  btnPrimary: {
    padding: "10px 20px", borderRadius: 9, border: "none",
    background: "linear-gradient(135deg,#1a3a6a,#0f2240)",
    color: "#7dd3fc", fontWeight: 700, fontSize: 13,
    fontFamily: "'Trebuchet MS', sans-serif", cursor: "pointer",
    transition: "all .2s",
  },
  btnDanger: {
    padding: "7px 14px", borderRadius: 8, border: "1px solid #7f1d1d",
    background: "transparent", color: "#f87171", fontSize: 12,
    fontFamily: "'Trebuchet MS', sans-serif", cursor: "pointer",
  },
  btnGhost: {
    padding: "7px 14px", borderRadius: 8, border: "1px solid #1e3a5f",
    background: "transparent", color: "#5a7da0", fontSize: 12,
    fontFamily: "'Trebuchet MS', sans-serif", cursor: "pointer",
  },
};

/* ─── Composant principal ─────────────────────────────────────────── */
export default function AdminPanel({ currentUser, onBack }) {
  const [users,    setUsers]    = useState(loadUsers);
  const [view,     setView]     = useState("list");   // "list" | "create" | "edit"
  const [editUser, setEditUser] = useState(null);
  const [toast,    setToast]    = useState(null);
  const [confirm,  setConfirm]  = useState(null);     // { id, nom }
  const [search,   setSearch]   = useState("");

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const persist = (next) => { setUsers(next); saveUsers(next); };

  const handleCreate = (data) => {
    if (users.find(u => u.login.toLowerCase() === data.login.toLowerCase())) {
      return "Ce login existe déjà.";
    }
    persist([...users, { ...data, id: genId(), createdAt: today(), actif: true }]);
    showToast(`Utilisateur « ${data.nom} » créé avec succès.`);
    setView("list");
    return null;
  };

  const handleEdit = (data) => {
    const conflict = users.find(u => u.login.toLowerCase() === data.login.toLowerCase() && u.id !== data.id);
    if (conflict) return "Ce login est déjà utilisé par un autre compte.";
    persist(users.map(u => u.id === data.id ? { ...u, ...data } : u));
    showToast(`Utilisateur « ${data.nom} » mis à jour.`);
    setView("list");
    return null;
  };

  const handleToggleActif = (id) => {
    const u = users.find(x => x.id === id);
    if (u?.id === currentUser.id) { showToast("Impossible de désactiver votre propre compte.", "err"); return; }
    persist(users.map(x => x.id === id ? { ...x, actif: !x.actif } : x));
    showToast(u.actif ? `${u.nom} désactivé.` : `${u.nom} activé.`);
  };

  const handleDelete = (id) => {
    const u = users.find(x => x.id === id);
    if (u?.id === currentUser.id) { showToast("Impossible de supprimer votre propre compte.", "err"); return; }
    persist(users.filter(x => x.id !== id));
    showToast(`Utilisateur « ${u.nom} » supprimé.`);
    setConfirm(null);
  };

  const handleResetPwd = (id) => {
    const pwd = "Reset" + Math.random().toString(36).slice(2, 8).toUpperCase() + "!";
    persist(users.map(u => u.id === id ? { ...u, password: pwd } : u));
    showToast(`Nouveau mot de passe : ${pwd}`, "info");
  };

  const filtered = users.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.login.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:  users.length,
    admins: users.filter(u => u.role === "admin").length,
    actifs: users.filter(u => u.actif).length,
  };

  return (
    <div style={S.page}>
      <div style={S.grid} />

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack} style={{ ...S.btnGhost, fontSize: 11, padding: "6px 12px" }}>
            ← Retour à l'app
          </button>
          <div style={{ width: 1, height: 24, background: "#1e3a5f" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#e8f0fe", lineHeight: 1 }}>Administration</div>
              <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 2 }}>Gestion des utilisateurs</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#3a5a7a" }}>Connecté : </span>
          <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>👑 {currentUser.nom}</span>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          background: toast.type === "err" ? "#2a0a0a" : toast.type === "info" ? "#0a1f40" : "#052e16",
          border: "1px solid " + (toast.type === "err" ? "#7f1d1d" : toast.type === "info" ? "#1e4a8c" : "#166534"),
          borderRadius: 12, padding: "14px 20px", maxWidth: 360,
          boxShadow: "0 8px 24px rgba(0,0,0,.6)",
          color: toast.type === "err" ? "#f87171" : toast.type === "info" ? "#7dd3fc" : "#6ee7b7",
          fontSize: 13, fontWeight: 600,
          animation: "slideIn .3s ease",
        }}>
          {toast.type === "err" ? "⚠ " : toast.type === "info" ? "🔑 " : "✓ "}{toast.msg}
        </div>
      )}

      {/* ── Modale confirmation suppression ── */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ ...S.card, maxWidth: 380, width: "90%" }}>
            <div style={{ fontSize: 22, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Supprimer l'utilisateur ?</div>
            <div style={{ fontSize: 13, color: "#5a7da0", marginBottom: 20 }}>
              Cette action est irréversible. <strong style={{ color: "#e8f0fe" }}>{confirm.nom}</strong> ne pourra plus se connecter.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(null)} style={S.btnGhost}>Annuler</button>
              <button onClick={() => handleDelete(confirm.id)} style={{ ...S.btnDanger, background: "#2a0a0a" }}>
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contenu principal ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px", position: "relative", zIndex: 1 }}>

        {view === "list" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { icon: "👥", label: "Utilisateurs total", val: stats.total, col: "#7dd3fc" },
                { icon: "✅", label: "Comptes actifs",      val: stats.actifs, col: "#6ee7b7" },
                { icon: "👑", label: "Administrateurs",     val: stats.admins, col: "#F59E0B" },
              ].map(s => (
                <div key={s.label} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, padding: "18px 22px" }}>
                  <span style={{ fontSize: 28 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.col, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: "#3a5a7a", marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Barre recherche + bouton créer */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3a5a7a", fontSize: 14 }}>🔍</span>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par nom ou login..."
                  style={{ ...S.input, paddingLeft: 36 }}
                  onFocus={e => e.target.style.borderColor = "#F59E0B"}
                  onBlur={e  => e.target.style.borderColor = "#1e3a5f"}
                />
              </div>
              <button onClick={() => setView("create")} style={{ ...S.btnPrimary, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>＋</span> Créer un utilisateur
              </button>
            </div>

            {/* Table des utilisateurs */}
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              {/* En-tête table */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 120px 160px",
                padding: "12px 20px", borderBottom: "1px solid #1e3a5f",
                background: "#060e1a",
              }}>
                {["Nom complet", "Login", "Rôle", "Statut", "Créé le", "Actions"].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#3a5a7a", textTransform: "uppercase", letterSpacing: ".08em" }}>{h}</div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#2a4a6a", fontSize: 13 }}>
                  Aucun utilisateur trouvé.
                </div>
              )}

              {filtered.map((u, idx) => (
                <div key={u.id} style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 120px 160px",
                  padding: "14px 20px", alignItems: "center",
                  borderBottom: idx < filtered.length - 1 ? "1px solid #0d1e38" : "none",
                  background: u.id === currentUser.id ? "rgba(245,158,11,.04)" : "transparent",
                  transition: "background .15s",
                }}>
                  {/* Nom */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: u.role === "admin" ? "linear-gradient(135deg,#1a3a6a,#2a5a9a)" : "linear-gradient(135deg,#1a2a4a,#0f1e38)",
                      border: "1.5px solid " + (u.role === "admin" ? "#3a7aaf" : "#1e3a5f"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0,
                    }}>
                      {u.role === "admin" ? "👑" : "👤"}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e8f0fe" }}>
                        {u.nom}
                        {u.id === currentUser.id && <span style={{ fontSize: 9, color: "#F59E0B", marginLeft: 6, background: "#2a1a00", border: "1px solid #b45309", borderRadius: 8, padding: "1px 6px" }}>vous</span>}
                      </div>
                    </div>
                  </div>

                  {/* Login */}
                  <div style={{ fontSize: 12, color: "#7aa3cc", fontFamily: "monospace" }}>
                    @{u.login}
                  </div>

                  {/* Rôle */}
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: u.role === "admin" ? "#0d2040" : "#0a1628",
                      color: u.role === "admin" ? "#F59E0B" : "#5a7da0",
                      border: "1px solid " + (u.role === "admin" ? "#b45309" : "#1e3a5f"),
                    }}>
                      {u.role === "admin" ? "Admin" : "Utilisateur"}
                    </span>
                  </div>

                  {/* Statut */}
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: u.actif ? "#052e16" : "#1a0a0a",
                      color: u.actif ? "#6ee7b7" : "#f87171",
                      border: "1px solid " + (u.actif ? "#166534" : "#7f1d1d"),
                    }}>
                      {u.actif ? "● Actif" : "○ Inactif"}
                    </span>
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11, color: "#3a5a7a" }}>{u.createdAt}</div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setEditUser(u); setView("edit"); }}
                      title="Modifier" style={{ ...S.btnGhost, padding: "6px 10px", fontSize: 13 }}>✏️</button>
                    <button onClick={() => handleToggleActif(u.id)}
                      title={u.actif ? "Désactiver" : "Activer"}
                      style={{ ...S.btnGhost, padding: "6px 10px", fontSize: 13,
                        borderColor: u.actif ? "#b45309" : "#166534",
                        color: u.actif ? "#fcd34d" : "#6ee7b7" }}>
                      {u.actif ? "⏸" : "▶"}
                    </button>
                    <button onClick={() => setConfirm({ id: u.id, nom: u.nom })}
                      title="Supprimer"
                      style={{ ...S.btnDanger, padding: "6px 10px", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Légende actions */}
            <div style={{ marginTop: 14, display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { icon:"✏️", desc:"Modifier nom, login, mot de passe, rôle" },
                { icon:"⏸/▶", desc:"Activer / Désactiver le compte" },
                { icon:"🗑", desc:"Supprimer définitivement" },
              ].map(l => (
                <div key={l.icon} style={{ fontSize: 10, color: "#2a4a6a", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{l.icon}</span><span>{l.desc}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(view === "create" || view === "edit") && (
          <UserForm
            key={view + (editUser?.id || "")}
            initial={view === "edit" ? editUser : null}
            onSubmit={view === "create" ? handleCreate : handleEdit}
            onCancel={() => { setView("list"); setEditUser(null); }}
            onResetPwd={view === "edit" ? () => handleResetPwd(editUser.id) : null}
            isEdit={view === "edit"}
          />
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  );
}

/* ─── Formulaire création / édition ──────────────────────────────── */
function UserForm({ initial, onSubmit, onCancel, onResetPwd, isEdit }) {
  const [nom,      setNom]      = useState(initial?.nom      || "");
  const [login,    setLogin]    = useState(initial?.login    || "");
  const [password, setPassword] = useState(initial?.password || "");
  const [role,     setRole]     = useState(initial?.role     || "user");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [pwdGen,   setPwdGen]   = useState(false);

  const generatePwd = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p); setShowPwd(true); setPwdGen(true);
    setTimeout(() => setPwdGen(false), 2000);
  };

  const validate = () => {
    if (!nom.trim())                       return "Le nom complet est requis.";
    if (!login.trim())                     return "Le login est requis.";
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(login)) return "Login invalide (3-30 caractères, lettres/chiffres/._-)";
    if (!isEdit && password.length < 6)    return "Le mot de passe doit contenir au moins 6 caractères.";
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    const data = { nom: nom.trim(), login: login.trim().toLowerCase(), password, role };
    if (isEdit) data.id = initial.id;
    const result = onSubmit(data);
    if (result) setError(result);
  };

  const inS = {
    ...S.input,
    onFocus: e => e.target.style.borderColor = "#F59E0B",
    onBlur:  e => e.target.style.borderColor = "#1e3a5f",
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Titre */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <span style={{ fontSize: 26 }}>{isEdit ? "✏️" : "➕"}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#e8f0fe" }}>
            {isEdit ? "Modifier l'utilisateur" : "Créer un utilisateur"}
          </div>
          <div style={{ fontSize: 11, color: "#3a5a7a", marginTop: 2 }}>
            {isEdit ? `Modification de ${initial.nom}` : "Remplissez tous les champs requis"}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Nom */}
          <div>
            <label style={S.label}>Nom complet *</label>
            <input value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex: Mohamed Alami" {...inS} />
          </div>

          {/* Login */}
          <div>
            <label style={S.label}>Login (identifiant de connexion) *</label>
            <input value={login} onChange={e => setLogin(e.target.value)}
              placeholder="Ex: m.alami" {...inS} />
            <div style={{ fontSize: 10, color: "#2a4a6a", marginTop: 4 }}>
              3 à 30 caractères · lettres, chiffres, point, tiret, underscore · pas d'espaces
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label style={S.label}>
              Mot de passe {isEdit ? "(laisser vide = inchangé)" : "*"}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={isEdit ? "Nouveau mot de passe (optionnel)" : "Minimum 6 caractères"}
                  style={{ ...S.input, paddingRight: 40 }}
                  onFocus={e => e.target.style.borderColor = "#F59E0B"}
                  onBlur={e  => e.target.style.borderColor = "#1e3a5f"}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#3a5a7a", fontSize:15, padding:0 }}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
              <button type="button" onClick={generatePwd}
                style={{ ...S.btnGhost, whiteSpace: "nowrap", fontSize: 11, padding: "10px 12px",
                  borderColor: pwdGen ? "#6ee7b7" : "#1e3a5f",
                  color: pwdGen ? "#6ee7b7" : "#5a7da0" }}>
                {pwdGen ? "✓ Copié !" : "🎲 Générer"}
              </button>
            </div>
            {showPwd && password && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#F59E0B", background: "#1a0d00", border: "1px solid #b45309", borderRadius: 7, padding: "6px 10px" }}>
                🔑 Mot de passe : <strong>{password}</strong> — notez-le avant de sauvegarder
              </div>
            )}
          </div>

          {/* Rôle */}
          <div>
            <label style={S.label}>Rôle</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { val:"user",  icon:"👤", label:"Utilisateur",   desc:"Accès complet à l'app AO" },
                { val:"admin", icon:"👑", label:"Administrateur", desc:"Accès app + panneau admin" },
              ].map(r => (
                <div key={r.val} onClick={() => setRole(r.val)}
                  style={{
                    border: "2px solid " + (role === r.val ? (r.val === "admin" ? "#b45309" : "#1e4a8c") : "#1e3a5f"),
                    borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                    background: role === r.val ? (r.val === "admin" ? "#1a0d00" : "#060e2a") : "transparent",
                    transition: "all .2s",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{r.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: role === r.val ? "#e8f0fe" : "#5a7da0" }}>{r.label}</span>
                    {role === r.val && <span style={{ marginLeft:"auto", fontSize:12, color: r.val==="admin"?"#F59E0B":"#7dd3fc" }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#3a5a7a" }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div style={{ background:"#2a0a0a", border:"1px solid #7f1d1d", borderRadius:9, padding:"10px 14px", fontSize:12, color:"#f87171" }}>
              ⚠ {error}
            </div>
          )}

          {/* Boutons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            {isEdit && onResetPwd && (
              <button type="button" onClick={onResetPwd}
                style={{ ...S.btnGhost, marginRight:"auto", borderColor:"#b45309", color:"#fcd34d" }}>
                🔑 Réinitialiser le mot de passe
              </button>
            )}
            <button type="button" onClick={onCancel} style={S.btnGhost}>Annuler</button>
            <button type="submit" style={S.btnPrimary}>
              {isEdit ? "💾 Sauvegarder" : "✅ Créer l'utilisateur"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
