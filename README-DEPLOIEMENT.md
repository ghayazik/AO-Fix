# 🏛 AO Manager Maroc — Guide de déploiement

## Structure du projet

```
ao-manager-deploy/
├── src/
│   ├── main.jsx          ← Point d'entrée React
│   ├── Root.jsx          ← Orchestrateur Login + App + Session
│   ├── Login.jsx         ← Écran de connexion (modifiez les users ici)
│   └── App.jsx           ← Application principale AO Manager
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.js
├── vercel.json           ← Config Vercel
├── netlify.toml          ← Config Netlify
└── .gitignore
```

---

## ① Modifier les utilisateurs (AVANT déploiement)

Ouvrez `src/Login.jsx` et modifiez le tableau `USERS` :

```js
export const USERS = [
  { login: "ghazi",    password: "VotreMotDePasse!", nom: "Ghazi El Yousfi",  role: "admin" },
  { login: "utilisateur1", password: "Pass2026!",   nom: "Nom Prénom",       role: "user"  },
  // Ajoutez autant d'utilisateurs que nécessaire
];
```

> ⚠️ **Rôles** : `"admin"` affiche une couronne 👑, `"user"` affiche 👤.  
> Les deux rôles ont accès à toutes les fonctionnalités dans cette version.

---

## ② Prérequis locaux

- **Node.js 18+** — téléchargez sur [nodejs.org](https://nodejs.org)
- **npm** (inclus avec Node.js)
- **Git** — téléchargez sur [git-scm.com](https://git-scm.com)

Vérifiez : `node --version` → doit afficher v18.x ou supérieur.

---

## ③ Installation et test local

```bash
# 1. Aller dans le dossier
cd ao-manager-deploy

# 2. Installer les dépendances
npm install

# 3. Lancer en local (http://localhost:5173)
npm run dev

# 4. Build de production
npm run build
```

---

## ④ Déploiement sur Vercel (recommandé — 5 min)

### Option A — Via l'interface web (le plus simple)

1. Créez un compte sur [vercel.com](https://vercel.com) (gratuit)
2. Poussez votre dossier sur GitHub :
   ```bash
   git init
   git add .
   git commit -m "AO Manager Maroc v1"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/ao-manager.git
   git push -u origin main
   ```
3. Sur Vercel → **"Add New Project"** → importez votre repo GitHub
4. Vercel détecte automatiquement Vite — cliquez **Deploy**
5. ✅ Votre app est en ligne sur `https://ao-manager-xxxx.vercel.app`

### Option B — Via CLI Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Domaine personnalisé

Dans Vercel → Settings → Domains → ajoutez `ao.votreentreprise.ma`

---

## ⑤ Déploiement sur Netlify (alternative — 5 min)

### Option A — Glisser-déposer (le plus simple, sans Git)

```bash
npm run build   # génère le dossier dist/
```

1. Allez sur [app.netlify.com](https://app.netlify.com)
2. **Sites** → glissez-déposez le dossier `dist/` dans la zone de dépôt
3. ✅ L'app est en ligne immédiatement

### Option B — Via Git (déploiement auto à chaque push)

1. Poussez sur GitHub (voir ci-dessus)
2. Netlify → **"Add new site"** → **"Import from Git"**
3. Build command : `npm run build` | Publish directory : `dist`
4. **Deploy site**

---

## ⑥ Sécurité importante

| Point | Action recommandée |
|---|---|
| Mots de passe | Changez tous les mots de passe par défaut avant déploiement |
| HTTPS | Vercel et Netlify activent HTTPS automatiquement ✅ |
| Clé API Claude | Chaque utilisateur saisit sa propre clé dans l'app (non stockée en base) |
| Accès | Partagez l'URL uniquement en interne (pas d'indexation Google si domaine non listé) |

---

## ⑦ Mettre à jour l'application

Pour mettre à jour (modifier `App.jsx`, ajouter des utilisateurs, etc.) :

```bash
# Modifier les fichiers
git add .
git commit -m "Mise à jour : [description]"
git push
```

Vercel/Netlify redéploie automatiquement en 1-2 minutes.

---

## ⑧ Questions fréquentes

**Q : L'app est-elle accessible depuis mobile ?**  
R : Oui, elle fonctionne sur navigateur mobile, mais l'interface est optimisée desktop.

**Q : Les données AO sont-elles sauvegardées ?**  
R : Actuellement en mémoire (session). Lors d'un rechargement, les données se réinitialisent.  
Pour une persistance réelle → ajouter une base de données (voir Option persistance ci-dessous).

**Q : Combien d'utilisateurs simultanés ?**  
R : Le plan gratuit Vercel/Netlify supporte des centaines d'utilisateurs simultanés sans problème.

**Q : Peut-on restreindre l'accès à certaines IPs ?**  
R : Sur Vercel Pro et Netlify Pro uniquement. Sur le plan gratuit, l'URL est accessible depuis partout (protégée par login/mot de passe).

---

## ⑨ Option persistance des données (évolution future)

Pour sauvegarder les AO, décisions et avancements entre sessions, deux options simples :

- **localStorage** — persistance navigateur par utilisateur (simple, pas de serveur)
- **Supabase** — base PostgreSQL gratuite, API REST, pas de serveur à gérer

Demandez la version avec persistance si nécessaire.

---

## Support

Application développée avec **React 18 + Vite + Claude API** (Anthropic)  
Conforme aux pratiques des marchés publics marocains — **Décret n° 2-12-349**
