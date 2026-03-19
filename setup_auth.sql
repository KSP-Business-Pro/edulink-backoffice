-- ═══════════════════════════════════════════════════════════════
--  EduLink Jour 5 — Supabase Auth Setup
--  Exécuter dans : Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Table profiles (liée à auth.users) ──────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id       UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  prenom   TEXT NOT NULL DEFAULT '',
  nom      TEXT NOT NULL DEFAULT '',
  role     TEXT NOT NULL DEFAULT 'etudiant'
             CHECK (role IN ('admin','enseignant','comptable','parent','etudiant')),
  avatar   TEXT    DEFAULT 'US',
  actif    BOOLEAN DEFAULT true,
  ecole_id UUID    REFERENCES public.ecoles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. RLS désactivé pour le développement ─────────────────────
--      (Activer + policies en production)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- ── 3. Trigger : créer profil automatiquement à l'inscription ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, prenom, nom, role, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'nom',    'EduLink'),
    COALESCE(NEW.raw_user_meta_data->>'role',   'etudiant'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', 'UE')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. Créer les 5 comptes de démonstration ────────────────────
--      Via la fonction admin (nécessite service_role dans Dashboard)
--
--  Aller dans : Dashboard → Authentication → Users → "Add user"
--  Créer manuellement :
--    admin@edulink.bj       / admin123    → role: admin
--    compta@edulink.bj      / compta123   → role: comptable
--    prof@edulink.bj        / prof123     → role: enseignant
--    parent@edulink.bj      / parent123   → role: parent
--    etud@edulink.bj        / etud123     → role: etudiant
--
--  Puis mettre à jour les profils :

UPDATE public.profiles SET prenom='Serge',    nom='AHOUNOU', role='admin',      avatar='SA', actif=true
  WHERE id = (SELECT id FROM auth.users WHERE email='admin@edulink.bj'    LIMIT 1);

UPDATE public.profiles SET prenom='Fatima',   nom='BONI',    role='comptable',  avatar='FB', actif=true
  WHERE id = (SELECT id FROM auth.users WHERE email='compta@edulink.bj'   LIMIT 1);

UPDATE public.profiles SET prenom='Rodrigue', nom='DOSSOU',  role='enseignant', avatar='RD', actif=true
  WHERE id = (SELECT id FROM auth.users WHERE email='prof@edulink.bj'     LIMIT 1);

UPDATE public.profiles SET prenom='Marie',    nom='ADJOVI',  role='parent',     avatar='MA', actif=true
  WHERE id = (SELECT id FROM auth.users WHERE email='parent@edulink.bj'   LIMIT 1);

UPDATE public.profiles SET prenom='Kofi',     nom='BAGRI',   role='etudiant',   avatar='KB', actif=false
  WHERE id = (SELECT id FROM auth.users WHERE email='etud@edulink.bj'     LIMIT 1);

-- ── 5. Vérification ────────────────────────────────────────────
SELECT p.prenom, p.nom, p.role, p.actif, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role;
