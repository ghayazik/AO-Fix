import { useState, useEffect } from "react";
import Login from "./Login.jsx";
import App from "./App.jsx";
import AdminPanel, { loadUsers } from "./AdminPanel.jsx";

const SESSION_KEY = "ao_manager_session";

export default function Root() {
  const [user,  setUser]  = useState(null);
  const [view,  setView]  = useState("app");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const sessionUser = JSON.parse(saved);
        const users = loadUsers();
        const fresh = users.find(u => u.id === sessionUser.id && u.actif);
        if (fresh) setUser(fresh);
        else sessionStorage.removeItem(SESSION_KEY);
      }
    } catch(_) {}
    setReady(true);
  }, []);

  const handleLogin = (u) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
    setUser(u); setView("app");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null); setView("app");
  };

  const checkCredentials = (login, password) => {
    const users = loadUsers();
    return users.find(
      u => u.login.toLowerCase() === login.trim().toLowerCase()
        && u.password === password
        && u.actif
    ) || null;
  };

  if (!ready) return null;
  if (!user)  return <Login onLogin={handleLogin} checkCredentials={checkCredentials} />;

  if (view === "admin" && user.role === "admin") {
    return <AdminPanel currentUser={user} onBack={() => setView("app")} />;
  }

  return (
    <div style={{ position:"relative" }}>
      <UserBar user={user} onLogout={handleLogout} onAdmin={user.role==="admin" ? ()=>setView("admin") : null} />
      <App />
    </div>
  );
}

function UserBar({ user, onLogout, onAdmin }) {
  const [open, setOpen] = useState(false);
  const ff = "'Trebuchet MS',Arial,sans-serif";

  return (
    <>
      {open && <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setOpen(false)} />}
      <div style={{position:"fixed",top:0,right:0,zIndex:9999}}>
        <button onClick={()=>setOpen(v=>!v)} style={{
          background:"rgba(7,16,30,.97)", border:"none",
          borderLeft:"1px solid #1e3a5f", borderBottom:"1px solid #1e3a5f",
          borderRadius:"0 0 0 12px", padding:"8px 16px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:8,
          color:"#e8f0fe", fontSize:11, fontFamily:ff, backdropFilter:"blur(12px)",
        }}>
          <span style={{fontSize:15}}>{user.role==="admin"?"👑":"👤"}</span>
          <span style={{fontWeight:700}}>{user.nom}</span>
          <span style={{color:"#3a5a7a",fontSize:9}}>{open?"▴":"▾"}</span>
        </button>

        {open && (
          <div style={{
            position:"absolute",top:"100%",right:0,
            background:"#07101e", border:"1px solid #1e3a5f",
            borderRadius:"0 0 12px 12px", minWidth:220,
            boxShadow:"0 12px 40px rgba(0,0,0,.8)", overflow:"hidden",
          }}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #1e3a5f",background:"#060e1a"}}>
              <div style={{fontSize:13,color:"#e8f0fe",fontWeight:700}}>{user.nom}</div>
              <div style={{fontSize:10,color:"#3a5a7a",marginTop:3}}>@{user.login}</div>
              <div style={{marginTop:6}}>
                <span style={{
                  fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,
                  background:user.role==="admin"?"#1a0d00":"#0a1628",
                  color:user.role==="admin"?"#F59E0B":"#5a7da0",
                  border:"1px solid "+(user.role==="admin"?"#b45309":"#1e3a5f"),
                }}>
                  {user.role==="admin"?"👑 Administrateur":"👤 Utilisateur"}
                </span>
              </div>
            </div>

            {onAdmin && (
              <button onClick={()=>{setOpen(false);onAdmin();}} style={{
                width:"100%",padding:"12px 18px",background:"transparent",border:"none",
                borderBottom:"1px solid #0f2540",color:"#F59E0B",fontSize:12,
                cursor:"pointer",textAlign:"left",fontFamily:ff,
                display:"flex",alignItems:"center",gap:10,
              }}
              onMouseEnter={e=>e.currentTarget.style.background="#1a0d00"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                🛡️ Panneau d'administration
              </button>
            )}

            <button onClick={()=>{setOpen(false);onLogout();}} style={{
              width:"100%",padding:"12px 18px",background:"transparent",border:"none",
              color:"#f87171",fontSize:12,cursor:"pointer",
              textAlign:"left",fontFamily:ff,display:"flex",alignItems:"center",gap:10,
            }}
            onMouseEnter={e=>e.currentTarget.style.background="#2a0a0a"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              🚪 Se déconnecter
            </button>
          </div>
        )}
      </div>
    </>
  );
}
