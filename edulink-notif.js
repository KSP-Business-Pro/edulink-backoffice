/* =====================================================================
   EduLink — Notifications Email (Brevo API)
   Brevo gratuit : 300 emails/jour
   Config : renseigner BREVO_API_KEY et EMAIL_EXPEDITEUR ci-dessous
   ===================================================================== */

var NOTIF_CONFIG = {
  brevoApiKey:    'VOTRE_CLE_BREVO_ICI',   // https://app.brevo.com → API Keys
  emailExpediteur: 'noreply@edulink.bj',
  nomExpediteur:   'EduLink Bénin',
  actif: false  // passer à true après avoir configuré la clé
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FONCTION CENTRALE : envoyer un email via Brevo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function envoyerEmailBrevo(opts) {
  if (!NOTIF_CONFIG.actif) {
    console.log('[EduLink Notif] Email simulé (Brevo non configuré):', opts);
    return { ok: false, simule: true };
  }
  if (!NOTIF_CONFIG.brevoApiKey || NOTIF_CONFIG.brevoApiKey === 'VOTRE_CLE_BREVO_ICI') {
    console.warn('[EduLink Notif] Clé Brevo manquante. Configurez NOTIF_CONFIG.brevoApiKey');
    return { ok: false, erreur: 'cle_manquante' };
  }

  try {
    var res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': NOTIF_CONFIG.brevoApiKey
      },
      body: JSON.stringify({
        sender:   { name: NOTIF_CONFIG.nomExpediteur, email: NOTIF_CONFIG.emailExpediteur },
        to:       opts.destinataires,
        subject:  opts.objet,
        htmlContent: opts.html
      })
    });
    var data = await res.json();
    if (res.ok) {
      console.log('[EduLink Notif] Email envoyé à', opts.destinataires.map(function(d){ return d.email; }).join(', '));
      return { ok: true, messageId: data.messageId };
    } else {
      console.error('[EduLink Notif] Erreur Brevo:', data);
      return { ok: false, erreur: data };
    }
  } catch (e) {
    console.error('[EduLink Notif] Fetch error:', e);
    return { ok: false, erreur: e.message };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TEMPLATES EMAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function templateBase(titre, contenu, couleur) {
  couleur = couleur || '#1e3a5f';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<style>body{font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px}' +
  '.card{background:#fff;border-radius:12px;max-width:600px;margin:0 auto;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)}' +
  '.header{background:'+couleur+';color:#fff;padding:24px 32px}' +
  '.header h1{margin:0;font-size:22px}.header p{margin:6px 0 0;opacity:.8;font-size:13px}' +
  '.body{padding:28px 32px;color:#374151;line-height:1.6;font-size:14px}' +
  '.footer{background:#f9fafb;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb}' +
  '.btn{display:inline-block;background:'+couleur+';color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px}' +
  '.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700}' +
  '.red{background:#fee2e2;color:#dc2626}.green{background:#dcfce7;color:#059669}.amber{background:#fef9c3;color:#d97706}' +
  '</style></head><body>' +
  '<div class="card">' +
  '<div class="header"><h1>🎓 EduLink</h1><p>' + titre + '</p></div>' +
  '<div class="body">' + contenu + '</div>' +
  '<div class="footer">EduLink — Plateforme de gestion scolaire · Bénin<br>Ce message est automatique, merci de ne pas y répondre.</div>' +
  '</div></body></html>';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NOTIFICATIONS MÉTIER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. Absence détectée → notifier le parent
async function notifAbsenceParent(opts) {
  // opts: { parentEmail, parentNom, etudiantNom, matiere, date, statut, ecoleNom }
  var couleur = opts.statut === 'absent' ? '#dc2626' : '#d97706';
  var contenu =
    '<p>Bonjour <strong>' + opts.parentNom + '</strong>,</p>' +
    '<p>Nous vous informons que votre enfant <strong>' + opts.etudiantNom + '</strong> ' +
    'a été enregistré(e) <span class="badge ' + (opts.statut==='absent'?'red':'amber') + '">' + opts.statut + '</span> ' +
    'lors du cours de <strong>' + opts.matiere + '</strong> le <strong>' + opts.date + '</strong>.</p>' +
    '<p>Si cette absence est justifiée, veuillez contacter l\'administration de ' + opts.ecoleNom + ' dans les plus brefs délais.</p>' +
    '<p>Vous pouvez également consulter le détail via le portail parents :</p>' +
    '<a class="btn" href="edulink-portail.html">Accéder au portail</a>';

  return envoyerEmailBrevo({
    destinataires: [{ email: opts.parentEmail, name: opts.parentNom }],
    objet: '🚫 Absence de ' + opts.etudiantNom + ' — ' + opts.matiere,
    html:  templateBase('Notification d\'absence', contenu, couleur)
  });
}

// 2. Facture impayée → rappel
async function notifFactureImpayee(opts) {
  // opts: { parentEmail, parentNom, etudiantNom, reference, montant, echeance, ecoleNom }
  var contenu =
    '<p>Bonjour <strong>' + opts.parentNom + '</strong>,</p>' +
    '<p>Nous vous rappelons que la facture <strong>' + opts.reference + '</strong> ' +
    'd\'un montant de <strong>' + opts.montant + ' FCFA</strong> pour <strong>' + opts.etudiantNom + '</strong> ' +
    'arrive à échéance le <strong>' + opts.echeance + '</strong>.</p>' +
    '<p>Merci de procéder au règlement avant cette date pour éviter tout désagrément.</p>' +
    '<table style="border-collapse:collapse;width:100%;margin:16px 0">' +
    '<tr style="background:#f9fafb"><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Référence</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + opts.reference + '</td></tr>' +
    '<tr><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Montant</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + opts.montant + ' FCFA</td></tr>' +
    '<tr style="background:#f9fafb"><td style="padding:8px 12px;font-weight:600;border:1px solid #e5e7eb">Echéance</td><td style="padding:8px 12px;border:1px solid #e5e7eb"><strong style="color:#dc2626">' + opts.echeance + '</strong></td></tr>' +
    '</table>' +
    '<a class="btn" href="edulink-portail.html">Voir ma facture</a>';

  return envoyerEmailBrevo({
    destinataires: [{ email: opts.parentEmail, name: opts.parentNom }],
    objet: '💳 Rappel de paiement — ' + opts.reference,
    html:  templateBase('Rappel de paiement', contenu, '#d97706')
  });
}

// 3. Bulletin disponible → notifier
async function notifBulletinDisponible(opts) {
  // opts: { parentEmail, parentNom, etudiantNom, periode, moyenne, ecoleNom }
  var couleur = parseFloat(opts.moyenne) >= 10 ? '#059669' : '#dc2626';
  var contenu =
    '<p>Bonjour <strong>' + opts.parentNom + '</strong>,</p>' +
    '<p>Le bulletin de notes de <strong>' + opts.etudiantNom + '</strong> ' +
    'pour la période <strong>' + opts.periode + '</strong> est disponible.</p>' +
    '<div style="text-align:center;padding:20px;background:#f9fafb;border-radius:10px;margin:16px 0">' +
    '<div style="font-size:40px;font-weight:800;color:' + couleur + '">' + opts.moyenne + '/20</div>' +
    '<div style="font-size:14px;color:#6b7280;margin-top:4px">Moyenne générale — ' + opts.periode + '</div>' +
    '</div>' +
    '<a class="btn" href="edulink-portail.html" style="background:' + couleur + '">Consulter le bulletin complet</a>';

  return envoyerEmailBrevo({
    destinataires: [{ email: opts.parentEmail, name: opts.parentNom }],
    objet: '📊 Bulletin ' + opts.periode + ' disponible — ' + opts.etudiantNom,
    html:  templateBase('Bulletin de notes disponible', contenu, couleur)
  });
}

// 4. Incident disciplinaire → notifier
async function notifIncident(opts) {
  // opts: { parentEmail, parentNom, etudiantNom, typeIncident, severite, date, ecoleNom }
  var couleur = opts.severite==='haute'?'#dc2626':opts.severite==='moyenne'?'#d97706':'#6b7280';
  var contenu =
    '<p>Bonjour <strong>' + opts.parentNom + '</strong>,</p>' +
    '<p>Nous vous informons qu\'un incident a été enregistré concernant votre enfant <strong>' + opts.etudiantNom + '</strong> ' +
    'le <strong>' + opts.date + '</strong> à ' + opts.ecoleNom + '.</p>' +
    '<div style="border-left:4px solid ' + couleur + ';padding:12px 16px;background:#f9fafb;margin:16px 0;border-radius:0 8px 8px 0">' +
    '<div><strong>Type :</strong> ' + opts.typeIncident + '</div>' +
    '<div style="margin-top:4px"><strong>Sévérité :</strong> <span style="color:' + couleur + ';font-weight:700">' + opts.severite.toUpperCase() + '</span></div>' +
    '</div>' +
    '<p>Nous vous invitons à prendre contact avec l\'administration pour en discuter.</p>';

  return envoyerEmailBrevo({
    destinataires: [{ email: opts.parentEmail, name: opts.parentNom }],
    objet: '⚠️ Incident signalé — ' + opts.etudiantNom,
    html:  templateBase('Notification d\'incident', contenu, couleur)
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BOUTON ENVOI RAPIDE (depuis le back-office)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function envoyerRappelsPaiement() {
  if (typeof db === 'undefined') { showToast('Supabase non disponible.', 'error'); return; }

  showToast('Envoi des rappels en cours...', 'info');

  var res = await db.from('factures')
    .select('*, etudiants(nom, prenom, email)')
    .in('statut', ['en_attente', 'retard'])
    .order('date_echeance');

  if (!res.data || !res.data.length) { showToast('Aucune facture impayee.', 'info'); return; }

  var envoyes = 0;
  for (var i = 0; i < res.data.length; i++) {
    var f = res.data[i];
    if (!f.etudiants || !f.etudiants.email) continue;
    await notifFactureImpayee({
      parentEmail:  f.etudiants.email,
      parentNom:    'Parent de ' + f.etudiants.nom + ' ' + f.etudiants.prenom,
      etudiantNom:  f.etudiants.nom + ' ' + f.etudiants.prenom,
      reference:    f.reference,
      montant:      new Intl.NumberFormat('fr-FR').format(f.montant_total - f.montant_paye),
      echeance:     f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '—',
      ecoleNom:     'EduLink'
    });
    envoyes++;
  }

  if (NOTIF_CONFIG.actif) {
    showToast(envoyes + ' rappel(s) envoye(s) !', 'success');
  } else {
    showToast(envoyes + ' rappel(s) simule(s) (Brevo non configure).', 'info');
  }
  ajouterNotif('paiement', 'Rappels envoyes', envoyes + ' email(s) de rappel envoyes aux parents.');
}

async function envoyerNotifAbsencesJour() {
  if (typeof db === 'undefined') { showToast('Supabase non disponible.', 'error'); return; }

  var today = new Date().toISOString().split('T')[0];
  var res = await db.from('absences')
    .select('*, etudiants(nom, prenom, email)')
    .eq('date_absence', today)
    .eq('parent_notifie', false);

  if (!res.data || !res.data.length) { showToast('Toutes les absences ont ete notifiees.', 'info'); return; }

  var envoyes = 0;
  for (var i = 0; i < res.data.length; i++) {
    var a = res.data[i];
    if (!a.etudiants || !a.etudiants.email) continue;
    await notifAbsenceParent({
      parentEmail:  a.etudiants.email,
      parentNom:    'Parent de ' + a.etudiants.nom,
      etudiantNom:  a.etudiants.nom + ' ' + a.etudiants.prenom,
      matiere:      a.matiere,
      date:         new Date(a.date_absence).toLocaleDateString('fr-FR'),
      statut:       a.statut,
      ecoleNom:     'EduLink'
    });
    // Marquer comme notifié
    await db.from('absences').update({ parent_notifie: true }).eq('id', a.id);
    envoyes++;
  }

  showToast(envoyes + ' parent(s) notifie(s) !', 'success');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MODAL DE CONFIGURATION BREVO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ouvrirConfigNotif() {
  var modal = document.getElementById('modal-notif-config');
  if (modal) {
    var inp = document.getElementById('input-brevo-key');
    if (inp) inp.value = NOTIF_CONFIG.brevoApiKey !== 'VOTRE_CLE_BREVO_ICI' ? NOTIF_CONFIG.brevoApiKey : '';
    modal.classList.add('open');
  }
}

function sauvegarderConfigNotif() {
  var key = (document.getElementById('input-brevo-key').value||'').trim();
  var exp = (document.getElementById('input-brevo-email').value||'').trim();
  if (!key) { if(typeof showToast==='function') showToast('Entrez votre cle Brevo.','error'); return; }
  NOTIF_CONFIG.brevoApiKey      = key;
  NOTIF_CONFIG.actif            = true;
  if (exp) NOTIF_CONFIG.emailExpediteur = exp;
  try { localStorage.setItem('edulink_brevo_key', key); if(exp) localStorage.setItem('edulink_brevo_email', exp); } catch(e) {}
  fermerModal('modal-notif-config');
  if(typeof showToast==='function') showToast('Configuration Brevo sauvegardee !','success');
}

// Charger config sauvegardee
(function loadBrevoConfig() {
  try {
    var k = localStorage.getItem('edulink_brevo_key');
    var e = localStorage.getItem('edulink_brevo_email');
    if (k) { NOTIF_CONFIG.brevoApiKey = k; NOTIF_CONFIG.actif = true; }
    if (e)   NOTIF_CONFIG.emailExpediteur = e;
  } catch(err) {}
})();
