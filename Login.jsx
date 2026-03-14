import { useState } from "react";

/* Login reçoit checkCredentials depuis Root (vérifie contre localStorage) */
export default function Login({ onLogin, checkCredentials }) {
  const [login,    setLogin]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    setTimeout(() => {
      const user = checkCredentials(login, password);
      if (user) {
        onLogin(user);
      } else {
        setError("Identifiants incorrects ou compte inactif.");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
      setLoading(false);
    }, 400);
  };

  const iBase = {
    width:"100%", boxSizing:"border-box",
    background:"#0a1628", border:"1.5px solid #1e3a5f", borderRadius:10,
    padding:"12px 14px", color:"#e8f0fe", fontSize:14,
    fontFamily:"'Trebuchet MS',sans-serif", outline:"none", caretColor:"#F59E0B",
    transition:"border-color .2s",
  };

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"radial-gradient(ellipse at 30% 20%, #0d1f4a 0%, #060e1e 60%, #020810 100%)",
      fontFamily:"'Trebuchet MS',Arial,sans-serif",
    }}>
      {/* Grille déco */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(30,58,95,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(30,58,95,.18) 1px, transparent 1px)",
        backgroundSize:"40px 40px",
      }} />
      <div style={{position:"fixed",top:"10%",left:"20%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle, rgba(245,158,11,.06) 0%, transparent 70%)",pointerEvents:"none"}} />
      <div style={{position:"fixed",bottom:"15%",right:"15%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle, rgba(59,130,246,.05) 0%, transparent 70%)",pointerEvents:"none"}} />

      {/* Carte */}
      <div style={{
        position:"relative", zIndex:10,
        background:"rgba(7,16,30,.92)", border:"1px solid #1e3a5f",
        borderRadius:20, padding:"48px 44px", width:"100%", maxWidth:420,
        backdropFilter:"blur(20px)",
        boxShadow:"0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(245,158,11,.08)",
        animation: shake ? "shake .5s ease" : "none",
      }}>
        {/* En-tête */}
        <div style={{textAlign:"center", marginBottom:36}}>
          <div style={{fontSize:44,marginBottom:10,filter:"drop-shadow(0 0 12px rgba(245,158,11,.5))"}}>🏛</div>
          <div style={{fontSize:22,fontWeight:800,color:"#e8f0fe",letterSpacing:"-.3px",marginBottom:4}}>AO Manager Maroc</div>
          <div style={{fontSize:12,color:"#3a5a7a",letterSpacing:".12em",textTransform:"uppercase"}}>
            Marchés publics · Accès sécurisé
          </div>
          <div style={{width:48,height:2,background:"linear-gradient(90deg,transparent,#F59E0B,transparent)",margin:"14px auto 0"}} />
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#5a7da0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Identifiant</div>
            <input type="text" value={login} onChange={e=>setLogin(e.target.value)}
              placeholder="Votre login" autoComplete="username" style={iBase}
              onFocus={e=>e.target.style.borderColor="#F59E0B"}
              onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
          </div>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#5a7da0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Mot de passe</div>
            <div style={{position:"relative"}}>
              <input type={showPwd?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Votre mot de passe" autoComplete="current-password"
                style={{...iBase,paddingRight:44}}
                onFocus={e=>e.target.style.borderColor="#F59E0B"}
                onBlur={e=>e.target.style.borderColor="#1e3a5f"} />
              <button type="button" onClick={()=>setShowPwd(v=>!v)}
                style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#3a5a7a",fontSize:16,padding:0}}>
                {showPwd?"🙈":"👁"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{background:"#2a0a0a",border:"1px solid #7f1d1d",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#f87171",lineHeight:1.5}}>
              ⚠ {error}
            </div>
          )}

          <button type="submit" disabled={loading||!login||!password} style={{
            marginTop:6, padding:"14px 0", borderRadius:12, border:"none",
            background: loading||!login||!password ? "#111827" : "linear-gradient(135deg,#1a3a6a 0%,#0f2240 50%,#1a4a2a 100%)",
            color: loading||!login||!password ? "#374151" : "#e8f0fe",
            fontSize:14, fontWeight:700, fontFamily:"'Trebuchet MS',sans-serif",
            cursor: loading||!login||!password ? "not-allowed" : "pointer",
            transition:"all .2s", letterSpacing:".04em",
            boxShadow: loading||!login||!password ? "none" : "0 4px 16px rgba(245,158,11,.15)",
          }}>
            {loading ? "Vérification..." : "Se connecter →"}
          </button>
        </form>

        <div style={{marginTop:28,textAlign:"center",fontSize:10,color:"#1e3a5f",lineHeight:1.7}}>
          Accès réservé aux collaborateurs autorisés<br/>
          <span style={{color:"#2a4a6a"}}>Décret n° 2-12-349 · Confidentiel entreprise</span>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)} 40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  );
}
