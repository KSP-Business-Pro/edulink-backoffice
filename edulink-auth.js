/* =====================================================================
   EduLink — Auth Jour 5 : Supabase Auth + fallback demo
   ===================================================================== */

var ROLE_PERMISSIONS = {
  admin:      { pages:['dashboard','etudiants','presences','notes','emploi','messages','discipline','paiements','documents','rapports','utilisateurs'], label:'Administrateur', color:'#7c3aed' },
  enseignant: { pages:['dashboard','etudiants','presences','notes','emploi','messages'], label:'Enseignant', color:'#059669' },
  comptable:  { pages:['dashboard','paiements','rapports','etudiants'], label:'Comptable', color:'#d97706' },
  parent:     { pages:['dashboard','notes','messages','presences'], label:'Parent / Tuteur', color:'#1d4ed8' },
  etudiant:   { pages:['dashboard','notes','presences','emploi'], label:'Etudiant', color:'#6b7280' },
};

var DEMO_USERS = [
  { email:'admin@edulink.bj',  mdp:'admin123',  prenom:'Serge',    nom:'AHOUNOU', role:'admin',      avatar:'SA', actif:true  },
  { email:'compta@edulink.bj', mdp:'compta123', prenom:'Fatima',   nom:'BONI',    role:'comptable',  avatar:'FB', actif:true  },
  { email:'prof@edulink.bj',   mdp:'prof123',   prenom:'Rodrigue', nom:'DOSSOU',  role:'enseignant', avatar:'RD', actif:true  },
  { email:'parent@edulink.bj', mdp:'parent123', prenom:'Marie',    nom:'ADJOVI',  role:'parent',     avatar:'MA', actif:true  },
  { email:'etud@edulink.bj',   mdp:'etud123',   prenom:'Kofi',     nom:'BAGRI',   role:'etudiant',   avatar:'KB', actif:false },
];

var currentUser = null;
var toutesLesNotifs = [];
var notifIdCounter = 1;
var tousLesUtilisateurs = DEMO_USERS.slice();

function fillDemo(email, mdp) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-pwd').value   = mdp;
}

function setLoginLoading(on) {
  var btn = document.getElementById('login-btn');
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? 'Connexion...' : 'Se connecter';
}

function showLoginError(msg) {
  var el = document.getElementById('login-error');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
}

function hideLoginError() {
  var el = document.getElementById('login-error');
  if (el) el.style.display = 'none';
}

// ━━━━━━ CONNEXION ━━━━━━
function seConnecter() {
  var email = (document.getElementById('login-email').value || '').trim().toLowerCase();
  var mdp   = (document.getElementById('login-pwd').value   || '');
  hideLoginError();
  if (!email || !mdp) { showLoginError('Remplissez email et mot de passe.'); return; }
  setLoginLoading(true);

  if (typeof db !== 'undefined' && db.auth) {
    db.auth.signInWithPassword({ email: email, password: mdp })
      .then(function(res) {
        if (res.error) {
          fallbackDemo(email, mdp);
        } else {
          chargerProfilSupabase(res.data.user);
        }
      })
      .catch(function() { fallbackDemo(email, mdp); });
  } else {
    setTimeout(function() { fallbackDemo(email, mdp); }, 400);
  }
}

function fallbackDemo(email, mdp) {
  var found = null;
  for (var i = 0; i < DEMO_USERS.length; i++) {
    if (DEMO_USERS[i].email === email && DEMO_USERS[i].mdp === mdp) { found = DEMO_USERS[i]; break; }
  }
  if (!found) { setLoginLoading(false); showLoginError('E-mail ou mot de passe incorrect.'); return; }
  if (!found.actif) { setLoginLoading(false); showLoginError('Compte desactive. Contactez un administrateur.'); return; }
  currentUser = { id:'demo', email:found.email, prenom:found.prenom, nom:found.nom, role:found.role, avatar:found.avatar, actif:true, source:'demo' };
  try { sessionStorage.setItem('edulink_user', JSON.stringify(currentUser)); } catch(e) {}
  ouvrirSession();
}

function chargerProfilSupabase(authUser) {
  var meta = authUser.user_metadata || {};
  if (typeof db !== 'undefined') {
    db.from('profiles').select('*').eq('id', authUser.id).single()
      .then(function(res) {
        var p = (res.data) ? res.data : null;
        currentUser = {
          id:     authUser.id,
          email:  authUser.email,
          prenom: p ? p.prenom : (meta.prenom || authUser.email.split('@')[0]),
          nom:    p ? p.nom    : (meta.nom    || ''),
          role:   p ? p.role   : (meta.role   || 'etudiant'),
          avatar: p ? (p.avatar || ((p.prenom||'?')[0]+(p.nom||'?')[0])) : (meta.avatar || 'US'),
          actif:  p ? p.actif  : true,
          source: 'supabase'
        };
        if (!currentUser.actif) {
          db.auth.signOut();
          setLoginLoading(false);
          showLoginError('Compte desactive. Contactez un administrateur.');
          return;
        }
        try { sessionStorage.setItem('edulink_user', JSON.stringify(currentUser)); } catch(e) {}
        ouvrirSession();
      })
      .catch(function() {
        currentUser = { id:authUser.id, email:authUser.email, prenom:meta.prenom||authUser.email.split('@')[0], nom:meta.nom||'', role:meta.role||'etudiant', avatar:meta.avatar||'US', actif:true, source:'supabase' };
        try { sessionStorage.setItem('edulink_user', JSON.stringify(currentUser)); } catch(e) {}
        ouvrirSession();
      });
  }
}

// ━━━━━━ SESSION ━━━━━━
function ouvrirSession() {
  setLoginLoading(false);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-main').style.display     = 'flex';

  var perms = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.etudiant;
  var navAvatar = document.getElementById('nav-avatar');
  var navName   = document.getElementById('nav-user-name');
  var navRole   = document.getElementById('nav-user-role');
  if (navAvatar) navAvatar.textContent = currentUser.avatar || '?';
  if (navName)   navName.textContent   = currentUser.prenom + ' ' + currentUser.nom;
  if (navRole)   navRole.textContent   = perms.label;

  var srcBadge = document.getElementById('auth-source-badge');
  if (srcBadge) {
    srcBadge.textContent   = currentUser.source === 'supabase' ? 'Supabase Auth' : 'Mode demo';
    srcBadge.style.color   = currentUser.source === 'supabase' ? '#059669' : '#c97c1a';
    srcBadge.style.display = 'block';
  }

  var allNav = { dashboard:'nav-dashboard', etudiants:'nav-etudiants', presences:'nav-presences', notes:'nav-notes', emploi:'nav-emploi', messages:'nav-messages', discipline:'nav-discipline', paiements:'nav-paiements', documents:'nav-documents', rapports:'nav-rapports', utilisateurs:'nav-utilisateurs' };
  Object.keys(allNav).forEach(function(page) {
    var el = document.getElementById(allNav[page]);
    if (el) el.style.display = perms.pages.indexOf(page) !== -1 ? 'flex' : 'none';
  });

  genererNotifications();
  afficherNotifsNav();

  var firstPage = perms.pages[0] || 'dashboard';
  if (typeof chargerEcoles === 'function') {
    chargerEcoles().then(function() { showPage(firstPage); }).catch(function() { showPage(firstPage); });
  } else {
    showPage(firstPage);
  }
  if (typeof showToast === 'function') showToast('Bienvenue, ' + currentUser.prenom + ' !', 'success');
}

function seDeconnecter() {
  if (typeof db !== 'undefined' && db.auth && currentUser && currentUser.source === 'supabase') {
    db.auth.signOut();
  }
  currentUser = null;
  toutesLesNotifs = [];
  try { sessionStorage.removeItem('edulink_user'); } catch(e) {}
  document.getElementById('app-main').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pwd').value   = '';
  hideLoginError();
}

function checkSession() {
  if (typeof db !== 'undefined' && db.auth) {
    db.auth.getSession().then(function(res) {
      if (res.data && res.data.session && res.data.session.user) {
        chargerProfilSupabase(res.data.session.user);
      } else {
        checkSessionStorage();
      }
    }).catch(function() { checkSessionStorage(); });
  } else {
    checkSessionStorage();
  }
}

function checkSessionStorage() {
  try {
    var s = sessionStorage.getItem('edulink_user');
    if (s) { currentUser = JSON.parse(s); ouvrirSession(); }
  } catch(e) {}
}

// ━━━━━━ UTILISATEURS ━━━━━━
function chargerUtilisateurs() {
  var tbody = document.getElementById('tbody-utilisateurs');
  if (!tbody) return;

  var rC = { admin:'purple', enseignant:'green', comptable:'amber', parent:'blue', etudiant:'gray' };
  var rL = { admin:'Administrateur', enseignant:'Enseignant', comptable:'Comptable', parent:'Parent', etudiant:'Etudiant' };

  if (typeof db !== 'undefined') {
    db.from('profiles').select('*').order('nom')
      .then(function(res) {
        if (res.data && res.data.length > 0) {
          tousLesUtilisateurs = res.data.map(function(p) {
            return { id:p.id, email:'—', prenom:p.prenom, nom:p.nom, role:p.role, avatar:p.avatar||((p.prenom||'?')[0]+(p.nom||'?')[0]), actif:p.actif, lastLogin:null, source:'supabase' };
          });
        } else {
          tousLesUtilisateurs = DEMO_USERS.slice();
        }
        updateUserCounts();
        afficherUtilisateurs(tousLesUtilisateurs);
      })
      .catch(function() {
        tousLesUtilisateurs = DEMO_USERS.slice();
        updateUserCounts();
        afficherUtilisateurs(tousLesUtilisateurs);
      });
  } else {
    tousLesUtilisateurs = DEMO_USERS.slice();
    updateUserCounts();
    afficherUtilisateurs(tousLesUtilisateurs);
  }

  var ecole = (typeof tousLesEcoles !== 'undefined') ? tousLesEcoles.find(function(e){ return e.id === currentEcoleId; }) : null;
  var nomEl = document.getElementById('sub-ecole-util-nom');
  if (nomEl) nomEl.textContent = ecole ? ecole.nom : '';
}

function updateUserCounts() {
  var c = { admin:0, enseignant:0, comptable:0, parent:0, etudiant:0 };
  tousLesUtilisateurs.forEach(function(u) { if (c[u.role] !== undefined) c[u.role]++; });
  ['admins','profs','comptas','parents'].forEach(function(k, i) {
    var keys = ['admin','enseignant','comptable','parentetudiant'];
    var el = document.getElementById('cnt-' + k);
    if (el) el.textContent = k === 'parents' ? (c.parent + c.etudiant) : c[['admin','enseignant','comptable'][i]];
  });
}

function afficherUtilisateurs(liste) {
  var tbody = document.getElementById('tbody-utilisateurs');
  if (!tbody || !liste) return;
  var rC = { admin:'purple', enseignant:'green', comptable:'amber', parent:'blue', etudiant:'gray' };
  var rL = { admin:'Administrateur', enseignant:'Enseignant', comptable:'Comptable', parent:'Parent', etudiant:'Etudiant' };
  if (!liste.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading">Aucun utilisateur.</td></tr>'; return; }
  tbody.innerHTML = liste.map(function(u) {
    var isMe = currentUser && u.id === currentUser.id;
    return '<tr><td><div style="display:flex;align-items:center;gap:10px">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:#c97c1a;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">'+(u.avatar||'?')+'</div>' +
      '<div><strong>'+u.prenom+' '+u.nom+'</strong></div></div></td>' +
      '<td style="font-size:12px;color:#6b7280">'+u.email+'</td>' +
      '<td><span class="badge '+(rC[u.role]||'gray')+'">'+(rL[u.role]||u.role)+'</span></td>' +
      '<td><span class="badge '+(u.actif?'green':'red')+'">'+(u.actif?'Actif':'Inactif')+'</span></td>' +
      '<td style="font-size:12px;color:#6b7280">'+(u.lastLogin?u.lastLogin:'Jamais')+'</td>' +
      '<td>'+(isMe?'<span style="font-size:11px;color:#6b7280">Vous</span>':'<button class="btn-sm '+(u.actif?'btn-red':'btn-green')+'" onclick="toggleUserActif(\''+u.id+'\')">'+(u.actif?'Desactiver':'Activer')+'</button>')+'</td>' +
    '</tr>';
  }).join('');
}

function filtrerUtilisateurs(q) {
  var f = q.toLowerCase();
  afficherUtilisateurs(tousLesUtilisateurs.filter(function(u) {
    return (u.nom||'').toLowerCase().indexOf(f)!==-1||(u.prenom||'').toLowerCase().indexOf(f)!==-1||(u.email||'').toLowerCase().indexOf(f)!==-1;
  }));
}

function toggleEtudiantField() {
  var role  = document.getElementById('input-user-role').value;
  var field = document.getElementById('user-etudiant-field');
  if (field) field.style.display = (role==='etudiant'||role==='parent') ? 'block' : 'none';
}

function creerUtilisateur() {
  var prenom = (document.getElementById('input-user-prenom').value||'').trim();
  var nom    = (document.getElementById('input-user-nom').value||'').trim();
  var email  = (document.getElementById('input-user-email').value||'').trim().toLowerCase();
  var mdp    = (document.getElementById('input-user-mdp').value||'');
  var role   = (document.getElementById('input-user-role').value||'etudiant');
  if (!prenom||!nom||!email||!mdp) { if(typeof showToast==='function') showToast('Remplissez tous les champs.','error'); return; }
  if (mdp.length < 6) { if(typeof showToast==='function') showToast('Mot de passe : 6 caracteres minimum.','error'); return; }
  var avatar = (prenom[0]||'?').toUpperCase()+(nom[0]||'?').toUpperCase();
  DEMO_USERS.push({ email:email, mdp:mdp, prenom:prenom, nom:nom, role:role, avatar:avatar, actif:true });
  fermerModal('modal-user');
  ['input-user-prenom','input-user-nom','input-user-email','input-user-mdp'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  if(typeof showToast==='function') showToast('Utilisateur cree : '+email,'success');
  ajouterNotif('info','Nouvel utilisateur', prenom+' '+nom+' ('+role+') ajoute.');
  chargerUtilisateurs();
}

function toggleUserActif(id) {
  var u = tousLesUtilisateurs.find(function(x){ return x.id===id; });
  if (!u) return;
  u.actif = !u.actif;
  if (typeof db !== 'undefined' && u.source === 'supabase') {
    db.from('profiles').update({ actif: u.actif }).eq('id', id);
  }
  if(typeof showToast==='function') showToast((u.actif?u.prenom+' reactivé.':u.prenom+' desactivé.'), u.actif?'success':'info');
  chargerUtilisateurs();
}

// ━━━━━━ NOTIFS IN-APP ━━━━━━
function ajouterNotif(type, title, msg) {
  toutesLesNotifs.unshift({ id:notifIdCounter++, type:type, title:title, msg:msg, lu:false, time:new Date() });
  afficherNotifsNav();
}

function genererNotifications() {
  toutesLesNotifs = [];
  ajouterNotif('absence','Absence detectee','BAGRI Sadou absent en Finance aujourd\'hui.');
  ajouterNotif('system','Bienvenue sur EduLink','Connexion reussie. Bonne journee !');
}

function afficherNotifsNav() {
  var nonLus = toutesLesNotifs.filter(function(n){ return !n.lu; }).length;
  var badge  = document.getElementById('notif-badge');
  if (badge) { badge.textContent = nonLus>9?'9+':nonLus; badge.style.display = nonLus>0?'flex':'none'; }
}

function afficherNotifsPanel() {
  var list = document.getElementById('notif-list');
  if (!list) return;
  if (!toutesLesNotifs.length) { list.innerHTML = '<div class="notif-empty">Aucune notification</div>'; return; }
  list.innerHTML = toutesLesNotifs.map(function(n) {
    var diff = Math.floor((Date.now()-new Date(n.time))/1000);
    var t = diff<60?"A l'instant":diff<3600?"Il y a "+Math.floor(diff/60)+" min":"Il y a "+Math.floor(diff/3600)+" h";
    return '<div class="notif-item '+(n.lu?'':'unread')+'" onclick="marquerLuNotif('+n.id+')">' +
      '<div class="ni-body"><div class="ni-title">'+n.title+'</div><div class="ni-msg">'+n.msg+'</div><div class="ni-time">'+t+'</div></div></div>';
  }).join('');
}

function marquerLuNotif(id) {
  var n = toutesLesNotifs.find(function(x){ return x.id===id; });
  if (n) n.lu = true;
  afficherNotifsNav(); afficherNotifsPanel();
}

function toutMarquerLu() {
  toutesLesNotifs.forEach(function(n){ n.lu=true; });
  afficherNotifsNav(); afficherNotifsPanel();
  if(typeof showToast==='function') showToast('Toutes les notifications lues','success');
}

function ouvrirNotifPanel() {
  afficherNotifsPanel();
  document.getElementById('notif-panel').classList.add('open');
  document.getElementById('notif-overlay').classList.add('open');
}

function fermerNotifPanel() {
  document.getElementById('notif-panel').classList.remove('open');
  document.getElementById('notif-overlay').classList.remove('open');
}

setInterval(function() {
  if (!currentUser || typeof db === 'undefined') return;
  var today = new Date().toISOString().split('T')[0];
  db.from('absences').select('*',{count:'exact',head:true}).eq('date_absence',today).then(function(res) {
    var nb = res.count||0;
    if (nb>0 && !toutesLesNotifs.find(function(n){ return n.type==='absence'&&!n.lu; })) {
      ajouterNotif('absence','Nouvelles absences', nb+' absence(s) aujourd\'hui.');
    }
  });
}, 60000);

window.addEventListener('DOMContentLoaded', function() { checkSession(); });
