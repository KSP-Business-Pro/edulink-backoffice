// ══════════════════════════════════════════════════════════════════════════
//  CERTIFICATS & ATTESTATIONS  ★ JOUR 18
// ══════════════════════════════════════════════════════════════════════════

// ── Constantes ─────────────────────────────────────────────────────────────
const CERT_TYPES = {
  attestation_inscription: { label:"Attestation d'inscription", ico:'📋', color:'#1e3a5f', badgeCls:'blue' },
  releve_notes:            { label:'Relevé de notes officiel',   ico:'📊', color:'#d97706', badgeCls:'amber' },
  certificat_scolarite:    { label:'Certificat de scolarité',    ico:'🎓', color:'#059669', badgeCls:'green' },
  diplome_provisoire:      { label:'Diplôme provisoire',         ico:'🏆', color:'#7c3aed', badgeCls:'purple' },
};

// ── État ───────────────────────────────────────────────────────────────────
let tousLesCertificats = [];

// ── Chargement principal ───────────────────────────────────────────────────
async function chargerCertificats() {
  document.getElementById('tbody-certificats').innerHTML =
    '<tr><td colspan="7" class="loading">Chargement...</td></tr>';

  await chargerStatsCertificats();

  let q = db.from('certificats')
    .select('*, etudiants(nom, prenom, matricule, filiere, niveau)')
    .order('created_at', { ascending: false });
  if (currentEcoleId) q = q.eq('ecole_id', currentEcoleId);

  const { data, error } = await q;
  if (error && error.code === '42P01') {
    // Table n'existe pas encore
    document.getElementById('tbody-certificats').innerHTML =
      '<tr><td colspan="7" class="empty-state" style="padding:2rem">⚠️ Table <code>certificats</code> inexistante — Exécutez le script SQL Jour 18 dans Supabase.</td></tr>';
    return;
  }
  tousLesCertificats = data || [];
  afficherCertificats(tousLesCertificats);
}

async function chargerStatsCertificats() {
  if (!currentEcoleId) return;
  const { data } = await db.from('certificats')
    .select('type').eq('ecole_id', currentEcoleId);
  const all = data || [];
  const c = { att:0, rel:0, cer:0, dip:0 };
  all.forEach(x => {
    if (x.type === 'attestation_inscription') c.att++;
    else if (x.type === 'releve_notes')       c.rel++;
    else if (x.type === 'certificat_scolarite') c.cer++;
    else if (x.type === 'diplome_provisoire') c.dip++;
  });
  const setEl = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setEl('cs-total',       all.length);
  setEl('cs-attestations', c.att + c.cer);
  setEl('cs-releves',     c.rel);
  setEl('cs-diplomes',    c.dip);
  setEl('ct-att-ins',     c.att);
  setEl('ct-releve',      c.rel);
  setEl('ct-scol',        c.cer);
  setEl('ct-diplo',       c.dip);
}

function afficherCertificats(liste) {
  const tbody = document.getElementById('tbody-certificats');
  if (!liste?.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="padding:2.5rem">📜<br><br>Aucun document émis pour le moment.</td></tr>';
    return;
  }
  tbody.innerHTML = liste.map(c => {
    const t = CERT_TYPES[c.type] || { label:c.type, ico:'📄', color:'#6b7280', badgeCls:'gray' };
    const stCls = c.statut === 'emis' ? 'blue' : c.statut === 'signe' ? 'green' : 'gray';
    const e = c.etudiants;
    return `<tr>
      <td><span class="cert-ref">${c.reference}</span></td>
      <td><strong>${e ? e.nom+' '+e.prenom : '—'}</strong>
        ${e?.matricule ? `<br><span style="font-size:10.5px;color:#9ca3af">${e.matricule}</span>` : ''}</td>
      <td>${t.ico} <span style="font-weight:600;color:${t.color}">${t.label}</span>
        ${c.periode ? `<br><span class="badge gray" style="font-size:9.5px">${c.periode}</span>` : ''}</td>
      <td style="font-size:12px;color:#6b7280">${c.delivre_par||'—'}</td>
      <td>${fmtDate(c.created_at)}</td>
      <td><span class="badge ${stCls}">${c.statut}</span></td>
      <td>
        <button class="btn-sm btn-blue" onclick="retelechargerCertificat('${c.id}')">⬇ PDF</button>
        ${c.statut !== 'annule'
          ? `<button class="btn-sm btn-red" style="margin-top:3px" onclick="annulerCertificatDB('${c.id}')">✕</button>`
          : ''}
      </td>
    </tr>`;
  }).join('');
}

function filtrerCertificats() {
  const q  = document.getElementById('search-certificats').value.toLowerCase();
  const ft = document.getElementById('filter-cert-type').value;
  const fs = document.getElementById('filter-cert-statut').value;
  const liste = tousLesCertificats.filter(c => {
    const txt = ((c.etudiants?.nom||'') + ' ' + (c.etudiants?.prenom||'') + ' ' + c.reference).toLowerCase();
    return (!q || txt.includes(q)) && (!ft || c.type === ft) && (!fs || c.statut === fs);
  });
  afficherCertificats(liste);
}

// ── Modal : émission ───────────────────────────────────────────────────────
function ouvrirModalCertificat(type = 'attestation_inscription') {
  // Remplir étudiant
  const sel = document.getElementById('input-cert-etudiant');
  if (sel) {
    const opts = tousLesEtudiants.map(e =>
      `<option value="${e.id}">${e.nom} ${e.prenom} — ${e.filiere} ${e.niveau}</option>`
    ).join('');
    sel.innerHTML = '<option value="">— Sélectionner un étudiant —</option>' + opts;
  }
  document.getElementById('input-cert-type').value = type;
  document.getElementById('input-cert-signe').value = '';
  document.getElementById('input-cert-obs').value   = '';
  onChangeCertType();
  ouvrirModal('modal-certificat');
}

function onChangeCertType() {
  const type = document.getElementById('input-cert-type').value;
  const pg   = document.getElementById('cert-periode-group');
  if (pg) pg.style.display = (type === 'releve_notes') ? 'block' : 'none';
}

async function emettreNouvCertificat() {
  const type       = document.getElementById('input-cert-type').value;
  const etudiantId = document.getElementById('input-cert-etudiant').value;
  const periode    = document.getElementById('input-cert-periode')?.value || 'S1';
  const signe      = document.getElementById('input-cert-signe').value.trim();
  const obs        = document.getElementById('input-cert-obs').value.trim();

  if (!etudiantId) { showToast('Sélectionnez un étudiant.', 'error'); return; }
  if (!signe)      { showToast('Indiquez le signataire.', 'error'); return; }

  const btn = document.getElementById('btn-emettre-cert');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Génération...'; }

  try {
    const reference = genCertRef();
    const etudiant  = tousLesEtudiants.find(e => e.id === etudiantId);
    const ecole     = tousLesEcoles.find(e => e.id === currentEcoleId);

    const payload = {
      ecole_id:     currentEcoleId,
      etudiant_id:  etudiantId,
      type,
      reference,
      statut:       'emis',
      periode:      type === 'releve_notes' ? periode : null,
      delivre_par:  signe,
      observations: obs || null,
    };

    // Calculer moyenne si relevé
    if (type === 'releve_notes') {
      const { data: notes } = await db.from('notes')
        .select('note,coefficient').eq('etudiant_id', etudiantId).eq('periode', periode);
      if (notes?.length) {
        let totalPts=0, totalCoeff=0;
        notes.forEach(n => { totalPts+=n.note*(n.coefficient||1); totalCoeff+=(n.coefficient||1); });
        const moy = totalCoeff>0 ? totalPts/totalCoeff : 0;
        payload.note_generale = parseFloat(moy.toFixed(2));
        payload.mention = getApp(moy).label;
      }
    }

    // Sauvegarder en DB (best-effort)
    const { data: saved } = await db.from('certificats').insert([payload]).select().single()
      .catch(() => ({ data: null }));

    // Générer le PDF
    await genererPDFCertificat({ ...payload, id: saved?.id }, etudiant, ecole, periode);

    fermerModal('modal-certificat');
    showToast('📜 Document officiel généré et téléchargé !', 'success');
    chargerCertificats();
  } catch(err) {
    showToast('Erreur génération : ' + err.message, 'error');
    console.error('[Certificats]', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📜 Générer & Télécharger le PDF'; }
  }
}

function genCertRef() {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(-2);
  const mm  = String(now.getMonth()+1).padStart(2,'0');
  const dd  = String(now.getDate()).padStart(2,'0');
  const rnd = Math.random().toString(36).slice(2,6).toUpperCase();
  return `CERT-${yy}${mm}${dd}-${rnd}`;
}

async function retelechargerCertificat(id) {
  const cert = tousLesCertificats.find(c => c.id === id);
  if (!cert) { showToast('Introuvable.', 'error'); return; }
  // On enrichit avec les données étudiant si nécessaire
  const etudiant = tousLesEtudiants.find(e => e.id === cert.etudiant_id)
                || cert.etudiants;
  const ecole = tousLesEcoles.find(e => e.id === currentEcoleId);
  await genererPDFCertificat(cert, etudiant, ecole, cert.periode);
  showToast('📥 PDF retéléchargé !', 'success');
}

async function annulerCertificatDB(id) {
  if (!confirm('Annuler ce document ? Il restera en historique mais sera marqué annulé.')) return;
  const { error } = await db.from('certificats').update({ statut:'annule' }).eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Document annulé.', 'info');
  chargerCertificats();
}

function exporterCertificatsCSV() {
  if (!tousLesCertificats.length) { showToast('Aucun document à exporter.', 'error'); return; }
  const header = 'Référence,Type,Étudiant,Matricule,Signataire,Statut,Période,Date';
  const rows = tousLesCertificats.map(c => {
    const t = CERT_TYPES[c.type]?.label || c.type;
    const e = c.etudiants;
    return [c.reference, t, (e?e.nom+' '+e.prenom:'—'), (e?.matricule||'—'),
            (c.delivre_par||'—'), c.statut, (c.periode||'—'), fmtDate(c.created_at)]
      .map(v => '"'+String(v||'').replace(/"/g,'""')+'"').join(',');
  }).join('\n');
  const blob = new Blob(['\ufeff'+header+'\n'+rows], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: `EduLink_Certificats_${new Date().toISOString().split('T')[0]}.csv`
  });
  a.click();
  showToast('✅ Export CSV généré', 'success');
}


// ════════════════════════════════════════════════════════════════════════════
//  GÉNÉRATION PDF CERTIFICATS  ★ JOUR 18
// ════════════════════════════════════════════════════════════════════════════

async function genererPDFCertificat(cert, etudiant, ecole, periode) {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) { showToast('jsPDF non chargé', 'error'); return; }

  const doc = new JsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();   // 210
  const ph  = doc.internal.pageSize.getHeight();  // 297

  // Couleurs école
  const prim = certHexToRgb(ecole?.couleur_primaire   || '#1e3a5f');
  const sec  = certHexToRgb(ecole?.couleur_secondaire || '#0f6e56');
  const acc  = certHexToRgb(ecole?.couleur_accent     || '#c97c1a');

  const nomEcole  = ecole?.nom  || 'Établissement';
  const typeEcole = ecole?.type || 'Établissement';

  // ── Header décoratif ─────────────────────────────────────────────────────
  doc.setFillColor(...prim);
  doc.rect(0, 0, pw, 38, 'F');

  // Bande accent en bas du header
  doc.setFillColor(...acc);
  doc.rect(0, 33, pw, 5, 'F');

  // Fond logo blanc
  doc.setFillColor(255,255,255);
  doc.roundedRect(11, 7, 24, 24, 3, 3, 'F');
  doc.setTextColor(...prim);
  doc.setFontSize(20);
  doc.text('🎓', 23, 22, { align:'center' });

  // Nom école
  doc.setTextColor(255,255,255);
  doc.setFontSize(14);
  doc.setFont('helvetica','bold');
  doc.text(pdfSafe(nomEcole), 42, 17);
  doc.setFontSize(8);
  doc.setFont('helvetica','normal');
  doc.text(pdfSafe(typeEcole) + '  ·  République du Bénin', 42, 24);
  doc.setFontSize(7);
  doc.setFont('helvetica','italic');
  doc.text(pdfSafe(ecole?.slogan || 'Excellence · Intégrité · Innovation'), 42, 30);

  // Année académique (bande accent)
  doc.setFillColor(...acc);
  doc.setTextColor(255,255,255);
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.text('Année académique ' + certGetAnnee(), pw/2, 36, { align:'center' });

  let y = 48;

  // ── Titre du document ─────────────────────────────────────────────────────
  const tc = CERT_TYPES[cert.type] || { label: cert.type };
  doc.setTextColor(...prim);
  doc.setFontSize(17);
  doc.setFont('helvetica','bold');
  doc.text(pdfSafe(tc.label.toUpperCase()), pw/2, y, { align:'center' });

  // Ligne accent sous le titre
  const tW = doc.getTextWidth(tc.label.toUpperCase()) * 0.62;
  doc.setDrawColor(...acc);
  doc.setLineWidth(1);
  doc.line(pw/2 - tW/2, y+2.5, pw/2 + tW/2, y+2.5);

  y += 11;

  // ── Bandeau de référence ──────────────────────────────────────────────────
  doc.setFillColor(239,246,255);
  doc.roundedRect(14, y, pw-28, 10, 2, 2, 'F');
  doc.setTextColor(30,58,95);
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.text('N° Réf. : ', 20, y+6.5);
  doc.setFont('courier','bold');
  doc.text(cert.reference, 36, y+6.5);
  doc.setFont('helvetica','normal');
  doc.setTextColor(107,114,128);
  doc.text('Délivré le ' + new Date().toLocaleDateString('fr-FR'), pw-18, y+6.5, { align:'right' });

  y += 16;

  // ── Corps selon le type ────────────────────────────────────────────────────
  if (cert.type === 'attestation_inscription' || cert.type === 'certificat_scolarite') {
    y = certDrawBodyAttestation(doc, cert, etudiant, nomEcole, y, pw, ph, prim, sec, acc);
  } else if (cert.type === 'releve_notes') {
    y = await certDrawBodyReleve(doc, cert, etudiant, nomEcole, y, pw, ph, prim, sec, acc, periode);
  } else if (cert.type === 'diplome_provisoire') {
    y = certDrawBodyDiplome(doc, cert, etudiant, nomEcole, y, pw, ph, prim, sec, acc);
  }

  // ── Bloc signature + QR ────────────────────────────────────────────────────
  const sigY = Math.max(y + 12, ph - 70);
  certDrawSignature(doc, cert, sigY, pw, prim, sec, acc);
  certDrawQR(doc, cert.reference, pw - 52, sigY - 2, 38, prim);

  // ── Pied de page ────────────────────────────────────────────────────────────
  doc.setFillColor(...prim);
  doc.rect(0, ph-12, pw, 12, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(7);
  doc.setFont('helvetica','normal');
  doc.text(pdfSafe(nomEcole) + '  ·  Document officiel  ·  Bénin', pw/2, ph-7.5, { align:'center' });
  doc.text('Vérification en ligne : edulink.bj/verifier/' + cert.reference, pw/2, ph-3.8, { align:'center' });

  // ── Filigrane OFFICIEL ────────────────────────────────────────────────────
  try {
    doc.setGState(new doc.GState({ opacity:0.035 }));
    doc.setTextColor(...prim);
    doc.setFontSize(60);
    doc.setFont('helvetica','bold');
    doc.text('OFFICIEL', pw/2, ph/2, { align:'center', angle:30 });
    doc.setGState(new doc.GState({ opacity:1 }));
  } catch(_) {}

  // Sauvegarde
  const nomFichier = pdfSafe(`EduLink_${tc.label.replace(/[\s']/g,'_')}_${etudiant?.nom||'Etudiant'}_${cert.reference}.pdf`);
  doc.save(nomFichier);
}

// ── Corps : Attestation d'inscription / Certificat de scolarité ────────────
function certDrawBodyAttestation(doc, cert, etudiant, nomEcole, y, pw, ph, prim, sec, acc) {
  const isScol = cert.type === 'certificat_scolarite';

  // Texte introductif
  const intro = isScol
    ? `Le Directeur Général de ${pdfSafe(nomEcole)} soussigné certifie que :`
    : `Nous soussignés, ${pdfSafe(cert.delivre_par||'La Direction')} de ${pdfSafe(nomEcole)},\natlestons par la présente que :`;
  doc.setTextColor(55,65,81);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  const introL = doc.splitTextToSize(intro, pw-28);
  doc.text(introL, 14, y);
  y += introL.length * 5.5 + 6;

  // Bloc étudiant encadré
  const bh = 42;
  doc.setFillColor(249,250,251);
  doc.setDrawColor(...sec);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, pw-28, bh, 3, 3, 'FD');

  // Avatar circulaire avec initiales
  doc.setFillColor(...prim);
  doc.circle(27, y + bh/2, 9, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(10);
  doc.setFont('helvetica','bold');
  const ini = ((etudiant?.prenom?.[0]||'')+(etudiant?.nom?.[0]||'')).toUpperCase();
  doc.text(ini, 27, y + bh/2 + 1.5, { align:'center' });

  // Données étudiant
  doc.setTextColor(17,24,39);
  doc.setFontSize(14);
  doc.setFont('helvetica','bold');
  doc.text(pdfSafe((etudiant?.prenom||'') + ' ' + (etudiant?.nom||'')), 42, y+13);

  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.setTextColor(107,114,128);
  doc.text('Matricule : ' + pdfSafe(etudiant?.matricule||'—'), 42, y+21);
  doc.text('Filière : ' + pdfSafe(etudiant?.filiere||'—') + '   ·   Niveau : ' + pdfSafe(etudiant?.niveau||'—'), 42, y+27);

  // Pastille statut
  doc.setFillColor(...sec);
  doc.roundedRect(42, y+31, 34, 7, 3, 3, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.text('INSCRIT(E) — ACTIF(VE)', 59, y+36, { align:'center' });

  y += bh + 10;

  // Corps principal
  const annee = certGetAnnee();
  const corps = isScol
    ? `${pdfSafe((etudiant?.prenom||'')+' '+(etudiant?.nom||''))} est régulièrement inscrit(e) et suit ` +
      `les cours à ${pdfSafe(nomEcole)} pour l'année académique ${annee}, en ${pdfSafe(etudiant?.filiere||'—')}, ` +
      `niveau ${pdfSafe(etudiant?.niveau||'—')}.\n\n` +
      `Ce certificat de scolarité est délivré à la demande de l'intéressé(e) pour servir de justificatif ` +
      `officiel auprès de toute administration, institution ou organisme.`
    : `${pdfSafe((etudiant?.prenom||'')+' '+(etudiant?.nom||''))}, titulaire du matricule ` +
      `${pdfSafe(etudiant?.matricule||'—')}, est régulièrement inscrit(e) et suit les cours à ` +
      `${pdfSafe(nomEcole)} pour l'année académique ${annee}, en ${pdfSafe(etudiant?.filiere||'—')}, ` +
      `niveau ${pdfSafe(etudiant?.niveau||'—')}.\n\n` +
      `La présente attestation est délivrée à sa demande pour servir et valoir ce que de droit, ` +
      `notamment pour toute démarche administrative, institutionnelle ou professionnelle.`;

  doc.setTextColor(55,65,81);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  const lines = doc.splitTextToSize(pdfSafe(corps), pw-28);
  doc.text(lines, 14, y);
  y += lines.length * 5.5 + 8;

  if (cert.observations) {
    doc.setFillColor(255,248,230);
    doc.setDrawColor(...acc);
    doc.setLineWidth(0.4);
    doc.roundedRect(14, y, pw-28, 13, 2, 2, 'FD');
    doc.setTextColor(107,114,128);
    doc.setFontSize(8.5);
    doc.setFont('helvetica','italic');
    const obsL = doc.splitTextToSize('Observations : ' + pdfSafe(cert.observations), pw-36);
    doc.text(obsL, 18, y+8);
    y += 20;
  }
  return y;
}

// ── Corps : Relevé de notes ────────────────────────────────────────────────
async function certDrawBodyReleve(doc, cert, etudiant, nomEcole, y, pw, ph, prim, sec, acc, periode) {
  // Entête étudiant
  doc.setFillColor(249,250,251);
  doc.roundedRect(14, y, pw-28, 20, 2, 2, 'F');
  doc.setTextColor(30,58,95);
  doc.setFontSize(10);
  doc.setFont('helvetica','bold');
  doc.text(pdfSafe((etudiant?.prenom||'')+' '+(etudiant?.nom||'')), 22, y+8);
  doc.setFont('helvetica','normal');
  doc.setFontSize(8.5);
  doc.setTextColor(107,114,128);
  doc.text('Matricule : '+(etudiant?.matricule||'—')+'   ·   '+(etudiant?.filiere||'—')+' — '+(etudiant?.niveau||'—'), 22, y+14.5);
  doc.setTextColor(30,58,95);
  doc.setFontSize(9);
  doc.setFont('helvetica','bold');
  const pLabel = typeof labelPeriodeBulletin === 'function' ? labelPeriodeBulletin(periode) : periode;
  doc.text('Période : ' + pdfSafe(pLabel||periode), pw-18, y+11, { align:'right' });
  y += 26;

  // Charger les notes
  const { data: notes } = await db.from('notes')
    .select('*')
    .eq('etudiant_id', etudiant?.id || cert.etudiant_id)
    .eq('periode', periode)
    .order('matiere');

  if (!notes?.length) {
    doc.setTextColor(156,163,175);
    doc.setFontSize(10);
    doc.text('Aucune note disponible pour cette période.', pw/2, y+10, { align:'center' });
    return y + 25;
  }

  let totalPts=0, totalCoeff=0;
  notes.forEach(n => { totalPts+=n.note*(n.coefficient||1); totalCoeff+=(n.coefficient||1); });
  const moy = totalCoeff>0 ? totalPts/totalCoeff : 0;

  // Tableau des notes
  doc.autoTable({
    startY: y,
    head: [['Matière', 'Note /20', 'Coefficient', 'Points', 'Mention']],
    body: [
      ...notes.map(n => {
        const a = getApp(n.note);
        return [pdfSafe(n.matiere||'—'), n.note+'/20', n.coefficient||1, (n.note*(n.coefficient||1)).toFixed(2), a.label];
      }),
      ['MOYENNE GÉNÉRALE',
        { content: moy.toFixed(2)+'/20', styles:{ fontStyle:'bold', textColor: pdfMentionColor ? pdfMentionColor(moy) : [30,58,95] } },
        totalCoeff, totalPts.toFixed(2),
        { content: typeof pdfMentionLabel==='function' ? pdfMentionLabel(moy) : getApp(moy).label, styles:{fontStyle:'bold'} }
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor:prim, textColor:[255,255,255], fontSize:9, fontStyle:'bold' },
    bodyStyles: { fontSize:9 },
    alternateRowStyles: { fillColor:[249,250,251] },
    didParseCell: (d) => { if (d.row.index === notes.length) { d.cell.styles.fillColor=[239,246,255]; d.cell.styles.fontStyle='bold'; } },
    margin: { left:14, right:14 }
  });
  y = doc.lastAutoTable.finalY + 8;

  // Bloc résumé
  const a = getApp(moy);
  doc.setFillColor(239,246,255);
  doc.roundedRect(14, y, pw-28, 14, 2, 2, 'F');
  doc.setTextColor(...prim);
  doc.setFontSize(11);
  doc.setFont('helvetica','bold');
  doc.text(`Moyenne générale : ${moy.toFixed(2)}/20  ·  Mention : ${a.label}`, pw/2, y+9, { align:'center' });
  y += 20;

  if (cert.observations) {
    doc.setTextColor(107,114,128);
    doc.setFontSize(8.5);
    doc.setFont('helvetica','italic');
    doc.text('Observations : ' + pdfSafe(cert.observations), 14, y);
    y += 8;
  }
  return y;
}

// ── Corps : Diplôme provisoire ─────────────────────────────────────────────
function certDrawBodyDiplome(doc, cert, etudiant, nomEcole, y, pw, ph, prim, sec, acc) {
  // Double cadre décoratif
  doc.setDrawColor(...acc);
  doc.setLineWidth(1.5);
  doc.rect(8, y-4, pw-16, 96, 'D');
  doc.setDrawColor(...prim);
  doc.setLineWidth(0.5);
  doc.rect(11, y-1, pw-22, 90, 'D');

  y += 8;

  // Texte introductif centré
  const lines = [
    `Le Directeur Général de ${pdfSafe(nomEcole)}`,
    '',
    'Vu les résultats et le parcours académique de :',
    '',
    pdfSafe((etudiant?.prenom||'') + ' ' + (etudiant?.nom||'')),
    '',
    `Matricule : ${pdfSafe(etudiant?.matricule||'—')}`,
    '',
    'Certifie que l\'intéressé(e) a satisfait aux exigences requises pour l\'obtention du :',
    '',
    `DIPLÔME DE ${pdfSafe((etudiant?.filiere||'').toUpperCase())}`,
    `NIVEAU ${pdfSafe(etudiant?.niveau||'—')}`,
    '',
    'Dans l\'attente de la délivrance du diplôme définitif, le présent document',
    'provisoire lui est remis pour faire valoir ses droits.',
  ];

  lines.forEach((line, i) => {
    if (line === pdfSafe((etudiant?.prenom||'')+' '+(etudiant?.nom||''))) {
      doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...prim);
    } else if (line.startsWith('DIPLÔME')) {
      doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...sec);
    } else if (line.startsWith('NIVEAU')) {
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...sec);
    } else {
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(55,65,81);
    }
    if (line) doc.text(line, pw/2, y, { align:'center' });
    y += line ? 6.5 : 3;
  });

  y += 8;
  if (cert.observations) {
    doc.setFillColor(249,250,251);
    doc.roundedRect(14, y, pw-28, 13, 2, 2, 'F');
    doc.setTextColor(107,114,128);
    doc.setFontSize(8.5);
    doc.setFont('helvetica','italic');
    doc.text('Mention : ' + pdfSafe(cert.observations), 18, y+8);
    y += 20;
  }
  return y;
}

// ── Bloc signature ─────────────────────────────────────────────────────────
function certDrawSignature(doc, cert, y, pw, prim, sec, acc) {
  doc.setDrawColor(229,231,235);
  doc.setLineWidth(0.3);
  doc.line(14, y, pw-14, y);
  y += 9;

  doc.setTextColor(107,114,128);
  doc.setFontSize(8);
  doc.setFont('helvetica','normal');
  doc.text('Fait à Cotonou, le ' + new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }), 14, y);
  y += 10;

  // Cadre signature
  doc.setDrawColor(209,213,219);
  doc.setLineWidth(0.35);
  doc.rect(14, y, 74, 26, 'D');
  doc.setFillColor(249,250,251);
  doc.rect(14, y, 74, 8, 'F');
  doc.setTextColor(30,58,95);
  doc.setFontSize(8);
  doc.setFont('helvetica','bold');
  doc.text('Le Signataire', 51, y+5.5, { align:'center' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica','normal');
  doc.setTextColor(107,114,128);
  const signL = doc.splitTextToSize(pdfSafe(cert.delivre_par||'La Direction'), 68);
  doc.text(signL, 51, y+16, { align:'center' });

  // Cachet officiel
  doc.setDrawColor(...prim);
  doc.setLineWidth(0.5);
  doc.circle(pw-35, y+13, 14, 'D');
  doc.setDrawColor(...acc);
  doc.setLineWidth(0.3);
  doc.circle(pw-35, y+13, 11, 'D');
  doc.setTextColor(...prim);
  doc.setFontSize(6);
  doc.setFont('helvetica','bold');
  doc.text('CACHET', pw-35, y+11, { align:'center' });
  doc.text('OFFICIEL', pw-35, y+15, { align:'center' });
  doc.setFontSize(4.5);
  doc.setFont('helvetica','normal');
  doc.text('EduLink — Bénin', pw-35, y+19.5, { align:'center' });
}

// ── QR Code visuel ─────────────────────────────────────────────────────────
function certDrawQR(doc, reference, x, y, size, prim) {
  // Fond blanc avec bordure
  doc.setFillColor(255,255,255);
  doc.setDrawColor(...prim);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, size, size+7, 2, 2, 'FD');

  const inner = size - 6;
  const xi = x + 3;
  const yi = y + 3;
  const cell = inner / 11;

  // Pixel art QR
  const p = [
    [1,1,1,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0],
    [1,0,1,1,1,0,1,0,1,1,1],
    [1,0,1,1,1,0,1,0,0,0,1],
    [1,0,0,0,0,0,1,0,1,0,0],
    [1,1,1,1,1,1,1,0,0,1,1],
    [0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,0,1,0,1,0,1,0],
    [0,1,0,0,1,0,1,1,0,0,1],
    [1,0,1,0,0,1,0,0,1,0,0],
    [0,1,1,0,1,0,1,0,0,1,1],
  ];

  doc.setFillColor(20,20,20);
  p.forEach((row, ri) => {
    row.forEach((val, ci) => {
      if (val) doc.rect(xi+ci*cell, yi+ri*cell, cell-0.15, cell-0.15, 'F');
    });
  });

  // Texte référence sous QR
  doc.setTextColor(107,114,128);
  doc.setFontSize(5);
  doc.setFont('courier','normal');
  doc.text(reference, x+size/2, y+size+5, { align:'center' });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function certHexToRgb(hex) {
  if (!hex || hex.length < 7) return [30,58,95];
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function certGetAnnee() {
  const now = new Date();
  const y   = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}/${y+1}` : `${y-1}/${y}`;
}

// ══ FIN CERTIFICATS & ATTESTATIONS  ★ JOUR 18 ══════════════════════════════
