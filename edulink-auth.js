/* =====================================================
   EduLink — Jour 4 : Auth, Rôles, Notifs, Utilisateurs
   Fichier séparé pour éviter la troncature Cloudflare
   ===================================================== */

// ── Utilisateurs (en prod → table Supabase auth.users) ──
var USERS_DB = [
  { id:'u1', email:'admin@edulink.bj',  mdp:'admin123',  prenom:'Serge',    nom:'AHOUNOU', role:'admin',      avatar:'SA', actif:true,  lastLogin:null },
  { id:'u2', email:'compta@edulink.bj', mdp:'compta123', prenom:'Fatima',   nom:'BONI',    role:'comptable',  avatar:'FB', actif:true,  lastLogin:null },
  { id:'u3', email:'prof@edulink.bj',   mdp:'prof123',   prenom:'Rodrigue', nom:'DOSSOU',  role:'enseignant', avatar:'RD', actif:true,  lastLogin:null },
  { id:'u4', email:'parent@edulink.bj', mdp:'parent123', prenom:'Marie',    nom:'ADJOVI',  role:'parent',     avatar:'MA', actif:true,  lastLogin:null },
  { id:'u5', email:'etud@edulink.bj',   mdp:'etud123',   prenom:'Kofi',     nom:'BAGRI',   role:'etudiant',   avatar:'KB', actif:false, lastLogin:null },
];

// ── Permissions par rôle ──
var ROLE_PERMISSIONS = {
  admin:      { pages:['dashboard','etudiants','presences','notes','emploi','messages','discipline','paiements','documents','rapports','utilisateurs'], label:'Administrateur', color:'#7c3aed' },
  enseignant: { pages:['dashboard','etudiants','presences','notes','emploi','messages'], label:'Enseignant', color:'#059669' },
  comptable:  { pages:['dashboard','paiements','rapports','etudiants'], label:'Comptable', color:'#d97706' },
  parent:     { pages:['dashboard','notes','messages','presences'], label:'Parent / Tuteur', color:'#1d4ed8' },
  etudiant:   { pages:['dashboard','notes','presences','emploi'], label:'Étudiant', color:'#6b7280' },
};

var currentUser = null;
var toutesLesNotifs = [];
var notifIdCounter = 1;
var tousLesUtilisateurs = [].concat(USERS_DB);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTHENTIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fillDemo(email, mdp) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-pwd').value = mdp;
}

function seConnecter() {
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  var mdp   = document.getElementById('login-pwd').value;
  var errEl = document.getElementById('login-error');
  var btn   = document.getElementById('login-btn');

  errEl.style.display = 'none';
  if (!email || !mdp) {
    errEl.textContent = 'Remplissez l\'e-mail et le mot de passe.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Connexion...';

  setTimeout(function() {
    var user = null;
    for (var i = 0; i < USERS_DB.length; i++) {
      if (USERS_DB[i].email === email && USERS_DB[i].mdp === mdp) {
        user = USERS_DB[i];
        break;
      }
    }
    if (!user) {
      errEl.textContent = 'E-mail ou mot de passe incorrect.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Se connecter →';
      return;
    }
    if (!user.actif) {
      errEl.textContent = 'Ce compte est désactivé. Contactez un administrateur.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Se connecter →';
      return;
    }
    user.lastLogin = new Date().toISOString();
    currentUser = user;
    try { sessionStorage.setItem('edulink_user', JSON.stringify(user)); } catch(e) {}
    ouvrirSession();
  }, 500);
}

function ouvrirSession() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-main').style.display = 'flex';

  var perms = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.admin;
  document.getElementById('nav-avatar').textContent    = currentUser.avatar;
  document.getElementById('nav-user-name').textContent = currentUser.prenom + ' ' + currentUser.nom;
  document.getElementById('nav-user-role').textContent = perms.label;

  var allNav = {
    dashboard:'nav-dashboard', etudiants:'nav-etudiants', presences:'nav-presences',
    notes:'nav-notes', emploi:'nav-emploi', messages:'nav-messages',
    discipline:'nav-discipline', paiements:'nav-paiements', documents:'nav-documents',
    rapports:'nav-rapports', utilisateurs:'nav-utilisateurs'
  };
  Object.keys(allNav).forEach(function(page) {
    var el = document.getElementById(allNav[page]);
    if (el) el.style.display = perms.pages.indexOf(page) !== -1 ? 'flex' : 'none';
  });

  genererNotifications();
  afficherNotifsNav();

  // Charger les données de base puis ouvrir la première page
  if (typeof chargerEcoles === 'function') {
    chargerEcoles().then(function() {
      var firstPage = perms.pages[0] || 'dashboard';
      showPage(firstPage);
    }).catch(function() {
      var firstPage = perms.pages[0] || 'dashboard';
      showPage(firstPage);
    });
  } else {
    var firstPage = perms.pages[0] || 'dashboard';
    showPage(firstPage);
  }
  showToast('Bienvenue, ' + currentUser.prenom + ' ! 👋', 'success');
}

function seDeconnecter() {
  currentUser = null;
  try { sessionStorage.removeItem('edulink_user'); } catch(e) {}
  document.getElementById('app-main').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pwd').value   = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-btn').disabled = false;
  document.getElementById('login-btn').textContent = 'Se connecter →';
  toutesLesNotifs = [];
}

function checkSession() {
  try {
    var saved = sessionStorage.getItem('edulink_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        ouvrirSession();
      } catch(e) {
        try { sessionStorage.removeItem('edulink_user'); } catch(e2) {}
      }
    }
  } catch(e) {
    console.warn('sessionStorage indisponible.');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GESTION UTILISATEURS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function chargerUtilisateurs() {
  var counts = { admin:0, enseignant:0, comptable:0, parent:0, etudiant:0 };
  tousLesUtilisateurs.forEach(function(u) {
    if (counts[u.role] !== undefined) counts[u.role]++;
  });
  document.getElementById('cnt-admins').textContent  = counts.admin;
  document.getElementById('cnt-profs').textContent   = counts.enseignant;
  document.getElementById('cnt-comptas').textContent = counts.comptable;
  document.getElementById('cnt-parents').textContent = counts.parent + counts.etudiant;

  var ecole = tousLesEcoles ? tousLesEcoles.find(function(e){ return e.id === currentEcoleId; }) : null;
  var nom = ecole ? ecole.nom : '';
  var nomEl = document.getElementById('sub-ecole-util-nom');
  if (nomEl) nomEl.textContent = nom;

  afficherUtilisateurs(tousLesUtilisateurs);
}

function afficherUtilisateurs(liste) {
  var tbody = document.getElementById('tbody-utilisateurs');
  if (!tbody) return;
  var roleColors  = { admin:'purple', enseignant:'green', comptable:'amber', parent:'blue', etudiant:'gray' };
  var roleLabels  = { admin:'Administrateur', enseignant:'Enseignant', comptable:'Comptable', parent:'Parent', etudiant:'Étudiant' };
  if (!liste.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Aucun utilisateur.</td></tr>';
    return;
  }
  tbody.innerHTML = liste.map(function(u) {
    var sameUser = currentUser && u.id === currentUser.id;
    return '<tr>' +
      '<td><div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:34px;height:34px;border-radius:50%;background:#c97c1a;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">' + u.avatar + '</div>' +
        '<strong style="font-size:13px">' + u.prenom + ' ' + u.nom + '</strong></div></td>' +
      '<td style="font-size:12px;color:#6b7280">' + u.email + '</td>' +
      '<td><span class="badge ' + (roleColors[u.role]||'gray') + '">' + (roleLabels[u.role]||u.role) + '</span></td>' +
      '<td><span class="badge ' + (u.actif?'green':'red') + '">' + (u.actif?'Actif':'Inactif') + '</span></td>' +
      '<td style="font-size:12px;color:#6b7280">' + (u.lastLogin ? fmtDateTime(u.lastLogin) : 'Jamais') + '</td>' +
      '<td><div style="display:flex;gap:6px">' +
        '<button class="btn-sm ' + (u.actif?'btn-red':'btn-green') + '" onclick="toggleUserActif(\'' + u.id + '\')">' + (u.actif?'Désactiver':'Activer') + '</button>' +
        (!sameUser ? '<button class="btn-sm btn-secondary" onclick="supprimerUser(\'' + u.id + '\')">Supprimer</button>' : '') +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function filtrerUtilisateurs(q) {
  var f = q.toLowerCase();
  afficherUtilisateurs(tousLesUtilisateurs.filter(function(u) {
    return u.nom.toLowerCase().indexOf(f)!==-1 || u.prenom.toLowerCase().indexOf(f)!==-1 || u.email.toLowerCase().indexOf(f)!==-1;
  }));
}

function toggleEtudiantField() {
  var role  = document.getElementById('input-user-role').value;
  var field = document.getElementById('user-etudiant-field');
  field.style.display = (role==='etudiant'||role==='parent') ? 'block' : 'none';
  if (field.style.display === 'block') remplirSelect('input-user-etudiant', true);
}

function creerUtilisateur() {
  var prenom = document.getElementById('input-user-prenom').value.trim();
  var nom    = document.getElementById('input-user-nom').value.trim();
  var email  = document.getElementById('input-user-email').value.trim().toLowerCase();
  var mdp    = document.getElementById('input-user-mdp').value;
  var role   = document.getElementById('input-user-role').value;

  if (!prenom||!nom||!email||!mdp) { showToast('Remplissez tous les champs.','error'); return; }
  if (mdp.length < 6) { showToast('Mot de passe : 6 caractères minimum.','error'); return; }
  var exists = USERS_DB.filter(function(u){ return u.email===email; }).length > 0;
  if (exists) { showToast('Cet e-mail est déjà utilisé.','error'); return; }

  var newUser = {
    id:'u'+Date.now(), email:email, mdp:mdp, prenom:prenom, nom:nom, role:role,
    avatar:(prenom[0]||'?')+(nom[0]||'?'), actif:true, lastLogin:null
  };
  USERS_DB.push(newUser);
  tousLesUtilisateurs = [].concat(USERS_DB);
  fermerModal('modal-user');
  ['input-user-prenom','input-user-nom','input-user-email','input-user-mdp'].forEach(function(id){
    document.getElementById(id).value='';
  });
  showToast('Utilisateur créé ! ' + email,'success');
  chargerUtilisateurs();
  ajouterNotif('info','👤 Nouvel utilisateur', prenom+' '+nom+' ('+role+') ajouté.');
}

function toggleUserActif(id) {
  var u = USERS_DB.filter(function(x){ return x.id===id; })[0];
  if (!u) return;
  u.actif = !u.actif;
  tousLesUtilisateurs = [].concat(USERS_DB);
  showToast(u.actif ? u.prenom+' réactivé.' : u.prenom+' désactivé.', u.actif?'success':'info');
  chargerUtilisateurs();
}

function supprimerUser(id) {
  var idx = -1;
  for (var i=0;i<USERS_DB.length;i++) { if(USERS_DB[i].id===id){idx=i;break;} }
  if (idx===-1) return;
  var u = USERS_DB[idx];
  USERS_DB.splice(idx,1);
  tousLesUtilisateurs = [].concat(USERS_DB);
  showToast(u.prenom+' supprimé.','info');
  chargerUtilisateurs();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ajouterNotif(type, title, msg) {
  toutesLesNotifs.unshift({ id:notifIdCounter++, type:type, title:title, msg:msg, lu:false, time:new Date() });
  afficherNotifsNav();
}

function genererNotifications() {
  toutesLesNotifs = [];
  var today = new Date().toLocaleDateString('fr-FR');
  ajouterNotif('absence',  '🚫 Absence détectée',    'BAGRI Sadou absent en Finance — '+today);
  ajouterNotif('paiement', '💳 Factures en attente',  'Des factures arrivent à échéance cette semaine.');
  ajouterNotif('system',   '🎓 Bienvenue sur EduLink','Connexion réussie. Bonne journée !');
  ajouterNotif('message',  '✉️ Message non lu',       'Vous avez des messages non lus dans la messagerie.');
}

function afficherNotifsNav() {
  var nonLus = toutesLesNotifs.filter(function(n){ return !n.lu; }).length;
  var badge  = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent   = nonLus > 9 ? '9+' : nonLus;
    badge.style.display = nonLus > 0 ? 'flex' : 'none';
  }
}

function afficherNotifsPanel() {
  var list = document.getElementById('notif-list');
  if (!list) return;
  if (!toutesLesNotifs.length) {
    list.innerHTML = '<div class="notif-empty">🔔<br><br>Aucune notification</div>';
    return;
  }
  var icons = { absence:'🚫', paiement:'💳', message:'✉️', system:'⚙️', incident:'⚠️', info:'ℹ️' };
  list.innerHTML = toutesLesNotifs.map(function(n) {
    var diff = Math.floor((Date.now()-new Date(n.time))/1000);
    var t = diff<60?'À l\'instant':diff<3600?'Il y a '+Math.floor(diff/60)+' min':diff<86400?'Il y a '+Math.floor(diff/3600)+' h':new Date(n.time).toLocaleDateString('fr-FR');
    return '<div class="notif-item ' + (n.lu?'':'unread') + '" onclick="marquerLuNotif('+n.id+')">' +
      '<div class="ni-ico">' + (icons[n.type]||'🔔') + '</div>' +
      '<div class="ni-body">' +
        '<div class="ni-title">' + n.title + '</div>' +
        '<div class="ni-msg">'   + n.msg   + '</div>' +
        '<div class="ni-time">'  + t       + '</div>' +
      '</div></div>';
  }).join('');
}

function marquerLuNotif(id) {
  var n = toutesLesNotifs.filter(function(x){ return x.id===id; })[0];
  if (n) n.lu = true;
  afficherNotifsNav();
  afficherNotifsPanel();
}

function toutMarquerLu() {
  toutesLesNotifs.forEach(function(n){ n.lu=true; });
  afficherNotifsNav();
  afficherNotifsPanel();
  showToast('Toutes les notifications lues ✓','success');
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POLLING (nouvelles données toutes les 60s)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
setInterval(function() {
  if (!currentUser || typeof db === 'undefined') return;
  var today = new Date().toISOString().split('T')[0];
  db.from('absences').select('*',{count:'exact',head:true}).eq('date_absence',today).then(function(res) {
    var nbAbs = res.count || 0;
    var alreadyNotif = toutesLesNotifs.filter(function(n){ return n.type==='absence' && !n.lu; }).length > 0;
    if (nbAbs > 0 && !alreadyNotif) {
      ajouterNotif('absence','🚫 Nouvelles absences', nbAbs+' absence(s) aujourd\'hui.');
    }
  });
}, 60000);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.addEventListener('DOMContentLoaded', function() {
  checkSession();
});
