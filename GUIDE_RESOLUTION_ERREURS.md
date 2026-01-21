# 🔧 Guide de Résolution des Erreurs - Génération Plans de Leçon IA

## 📊 Problème Identifié

Lors de la génération multiple de plans de leçon, vous avez observé :
- ✅ **3 fichiers Word générés** (~320 KB chacun) - **SUCCÈS**
- ❌ **23 fichiers texte d'erreur** (<1 KB) - **ÉCHECS**

## 🎯 Solutions Implémentées

### 1️⃣ **Filtrage Automatique des Leçons Vides**

**Problème** : Beaucoup de lignes avaient des leçons vides → appels API inutiles → erreurs

**Solution** : 
- Le système filtre maintenant automatiquement les lignes avec leçons vides **AVANT** d'appeler l'API
- Ces lignes sont listées dans un fichier `00_LIGNES_IGNOREES.txt` dans le ZIP

**Bénéfice** :
- ❌ Évite les appels API pour des leçons vides
- ✅ Réduit le nombre d'erreurs
- ✅ Économise le quota API

---

### 2️⃣ **Amélioration des Messages d'Erreur**

**Avant** :
```
Erreur de génération: ...
(fichier de 45 bytes sans détails)
```

**Maintenant** :
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ ERREUR DE GÉNÉRATION - PLAN DE LEÇON IA

📍 INFORMATIONS DE LA LIGNE
  Ligne valide    : 5/12
  Ligne originale : 18/39
  
👤 ENSEIGNANT     : Mohamed
📚 CLASSE         : PEI2
📖 MATIÈRE        : Maths

📝 LEÇON : [Contenu complet affiché]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ERREUR DÉTECTÉE :
⚠️ QUOTA GEMINI DÉPASSÉ (429): Rate limit exceeded

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 SOLUTIONS POSSIBLES :
1. Configurer GROQ_API_KEY sur Vercel (quota plus généreux)
2. Attendre demain pour réinitialisation quota GEMINI
3. Upgrader compte Google AI Studio
...
```

---

### 3️⃣ **Fichier Récapitulatif Automatique**

Chaque génération inclut maintenant un fichier `99_RECAPITULATIF.txt` avec :

```
📊 RÉCAPITULATIF DE GÉNÉRATION

📅 Date : 21/01/2026 08:30:15
📦 Semaine : 18
🔧 Provider IA : GEMINI (gemini-2.5-flash)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 STATISTIQUES :
  Lignes totales reçues  : 39
  Lignes valides         : 12
  Lignes ignorées        : 27 (leçons vides)
  
  ✅ Succès              : 3
  ❌ Erreurs             : 9
  
  📊 Taux de réussite    : 25%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ATTENTION : 9 erreur(s) détectée(s)

💡 CAUSE PRINCIPALE : Quota API GEMINI dépassé (429)
🔑 SOLUTION : Configurer GROQ_API_KEY sur Vercel
```

---

## 🚀 Solution Principale : Configurer GROQ API

### Pourquoi GROQ ?

| Critère | GEMINI (actuel) | GROQ (recommandé) |
|---------|-----------------|-------------------|
| Quota gratuit | 20 requêtes/jour | Beaucoup plus généreux |
| Vitesse | Rapide | Très rapide |
| Coût | Gratuit limité | Gratuit généreux |
| Modèle | gemini-2.5-flash | llama-3.3-70b-versatile |

### ⚙️ Configuration sur Vercel

#### Étape 1 : Obtenir une clé GROQ

1. Aller sur https://console.groq.com/
2. Créer un compte (gratuit)
3. Aller dans **"API Keys"**
4. Cliquer sur **"Create API Key"**
5. Copier la clé (format : `gsk_...`)

#### Étape 2 : Configurer sur Vercel

1. Aller sur **Vercel Dashboard**
2. Sélectionner votre projet
3. Aller dans **Settings** → **Environment Variables**
4. Cliquer sur **Add New**
5. Remplir :
   - **Key** : `GROQ_API_KEY`
   - **Value** : `gsk_votre_cle_ici`
   - **Environments** : Cocher **Production**, **Preview**, **Development**
6. Cliquer sur **Save**

#### Étape 3 : Redéployer

1. Aller dans **Deployments**
2. Cliquer sur **⋮** (trois points) sur le dernier déploiement
3. Cliquer sur **Redeploy**

⏱️ Attendre 2-3 minutes pour le déploiement

---

## 📁 Structure du ZIP Généré

Maintenant, quand vous générez plusieurs plans, le ZIP contient :

```
Plans_Lecon_IA_S18_12_fichiers.zip
│
├── 00_LIGNES_IGNOREES.txt          ← Liste des leçons vides ignorées
│
├── Maths_PEI1_S18_P2_Souha.docx    ← ✅ Plan généré (succès)
├── Sciences_PEI1_S18_P2_Souha.docx ← ✅ Plan généré (succès)
├── Sciences_PEI1_S18_P3_Souha.docx ← ✅ Plan généré (succès)
│
├── ERREUR_04_PEI1_Maths.txt        ← ❌ Détails erreur ligne 4
├── ERREUR_05_PEI1_Maths.txt        ← ❌ Détails erreur ligne 5
├── ...                              ← Autres erreurs
│
└── 99_RECAPITULATIF.txt            ← 📊 Statistiques finales
```

---

## 🔍 Diagnostic des Erreurs Fréquentes

### Erreur 1 : "API GEMINI error 429"
**Cause** : Quota GEMINI dépassé (20 requêtes/jour max)  
**Solution** : Configurer `GROQ_API_KEY` (voir ci-dessus)

### Erreur 2 : "Leçon vide"
**Cause** : La cellule "Leçon" est vide ou contient moins de 3 caractères  
**Solution** : Remplir la colonne "Leçon" avant de générer

### Erreur 3 : "Format JSON invalide"
**Cause** : L'IA a retourné un format incorrect  
**Solution** : Réessayer (rare, généralement temporaire)

### Erreur 4 : "GROQ/GEMINI a retourné une réponse vide"
**Cause** : Problème temporaire de l'API  
**Solution** : Réessayer dans quelques minutes

---

## 📊 Statistiques Attendues

### Avec GEMINI (sans GROQ configuré)
- ✅ **Succès** : ~20 plans/jour maximum
- ❌ **Erreurs** : Après 20 requêtes → 429 quota exceeded
- ⏱️ **Vitesse** : ~5 secondes/plan

### Avec GROQ (configuré)
- ✅ **Succès** : Beaucoup plus (plusieurs centaines/jour)
- ❌ **Erreurs** : Très rares
- ⏱️ **Vitesse** : ~3-5 secondes/plan

---

## ✅ Checklist de Vérification

Avant de générer plusieurs plans, vérifiez :

- [ ] La colonne **"Leçon"** est remplie pour chaque ligne
- [ ] Vous n'avez pas dépassé le quota API du jour
- [ ] Vous avez configuré `GROQ_API_KEY` sur Vercel (recommandé)
- [ ] Vous filtrez ou triez le tableau pour ne générer que les lignes souhaitées

---

## 🆘 Support

Si le problème persiste après :
1. Configuration de GROQ_API_KEY
2. Vérification des leçons non vides
3. Attente de 24h pour réinitialisation quota

Consultez les fichiers d'erreur détaillés dans le ZIP pour diagnostiquer le problème exact.

---

**Dernière mise à jour** : 21/01/2026  
**Lien GitHub** : https://github.com/Medcherif01/Plan-hebomadaire-2026-Filles-
