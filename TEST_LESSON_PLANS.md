# 🧪 Guide de Test - Plans de Leçon

## Problème Identifié et Résolu

**Problème :** Les boutons de téléchargement 📥 n'apparaissaient pas dans le tableau.

**Cause :** Quand les données étaient chargées depuis MongoDB (`/api/plans/:week`), le champ `lessonPlanId` n'était pas inclus.

**Solution :** L'endpoint `/api/plans/:week` a été modifié pour :
1. Récupérer les plans de leçon disponibles depuis la collection `lessonPlans`
2. Enrichir automatiquement chaque ligne avec `lessonPlanId` si un plan existe
3. Les boutons s'affichent maintenant correctement

---

## 🔄 Mise à Jour Déployée

**Commit :** `951a7b2`
**Status :** ✅ Poussé sur `main`
**Vercel :** Redéploiement automatique en cours (2-3 minutes)

---

## 📋 Procédure de Test Complète

### ÉTAPE 1 : Générer des Plans de Leçon (Coordinateur)

**Prérequis :**
- Vercel a terminé le redéploiement (attendez 2-3 minutes)
- Vider le cache du navigateur (Ctrl+Shift+Delete)

**Actions :**

1. **Se connecter en tant que Mohamed**
   - Username : `Mohamed`
   - Password : `Mohamed`

2. **Vérifier que l'interface est visible**
   - Après connexion, descendre dans la page
   - Section "**Génération des Plans de Leçon (Coordinateur)**" doit être visible
   - Si pas visible : vérifier que vous êtes bien connecté en tant que Mohamed

3. **Sélectionner une semaine**
   - Dans le menu déroulant en haut : Choisir "Semaine 16" (ou la semaine actuelle)

4. **Générer des plans de test**
   - Dans "Choisir une Classe" : Sélectionner `PEI1`
   - Attendre que les matières s'affichent
   - **Vérifier que les matières arabes sont ABSENTES** (Arabe, Coran, etc.)
   - Cocher 2-3 matières (ex: Maths, Sciences, Français)
   - Cliquer sur "**Générer Plans de Leçon Sélectionnés**"
   - Confirmer la génération dans la popup
   - **Attendre la fin** (barre de progression)
   - Message de succès : "X plan(s) de leçon généré(s) avec succès !"

**Résultat attendu :**
```
✅ Interface visible pour Mohamed
✅ Classes disponibles dans le menu
✅ Matières affichées (SANS les matières arabes)
✅ Génération fonctionne
✅ Message de succès affiché
✅ Barre de progression visible pendant la génération
```

---

### ÉTAPE 2 : Vérifier MongoDB (Optionnel mais recommandé)

**Outil :** MongoDB Compass ou MongoDB Atlas Web UI

**Connexion :**
```
URL : [Votre MONGO_URL depuis les variables d'environnement Vercel]
Base de données : [Le nom de votre base]
Collection : lessonPlans
```

**Vérifications :**

1. **Ouvrir la collection `lessonPlans`**
2. **Vérifier qu'il y a des documents** (au moins 2-3 si vous avez généré)
3. **Vérifier la structure d'un document :**
   ```json
   {
     "_id": "16_Mohamed_PEI1_Maths_P1_Lundi",  // Format correct ?
     "week": 16,                                 // Numéro correct ?
     "enseignant": "Mohamed",                    // Nom correct ?
     "classe": "PEI1",                           // Classe correcte ?
     "matiere": "Maths",                         // Matière correcte ?
     "periode": "P1",                            // Période correcte ?
     "jour": "Lundi",                            // Jour correct ?
     "filename": "Plan de lecon-Maths-...",      // Nom de fichier présent ?
     "fileBuffer": { "$binary": "..." },         // Buffer présent ?
     "createdAt": "2025-12-12T...",              // Date présente ?
     "rowData": { ... }                          // Données complètes ?
   }
   ```

**Résultat attendu :**
```
✅ Collection 'lessonPlans' existe
✅ Au moins 2-3 documents présents
✅ Structure correcte (tous les champs présents)
✅ fileBuffer contient des données (non vide)
```

---

### ÉTAPE 3 : Télécharger en tant qu'Enseignant

**Actions :**

1. **Se déconnecter** (bouton "Déconnecter" en haut à droite)

2. **Se reconnecter en tant qu'enseignant**
   - Username : `Kamel` (ou un autre enseignant non-arabe)
   - Password : `Kamel` (identique au username)

3. **Sélectionner la même semaine**
   - Menu déroulant : Choisir "Semaine 16" (la même que vous avez utilisée pour générer)

4. **Chercher le tableau de données**
   - Descendre dans la page
   - Le tableau affiche toutes les lignes pour cette semaine

5. **Vérifier les boutons de téléchargement 📥**
   - Dans la colonne "**Actions**" (dernière colonne à droite)
   - Chercher les lignes où vous avez généré des plans (ex: PEI1, Maths)
   - **Un bouton 📥 (icône de téléchargement) doit être visible**
   - Ce bouton est à DROITE du bouton ✔️ (sauvegarde)

6. **Cliquer sur un bouton 📥**
   - Message : "Téléchargement du plan de leçon..."
   - Le fichier `.docx` se télécharge automatiquement
   - Message de succès : "Plan de leçon téléchargé avec succès !"

7. **Ouvrir le fichier téléchargé**
   - Ouvrir avec Microsoft Word ou LibreOffice
   - Vérifier que le contenu est correct :
     - Titre, classe, matière
     - Plan de leçon détaillé
     - Phases (Introduction, Activité Principale, Synthèse, Clôture)

**Résultat attendu :**
```
✅ Boutons 📥 visibles dans la colonne Actions
✅ Boutons présents UNIQUEMENT pour les lignes avec plans générés
✅ Clic sur 📥 → Téléchargement immédiat
✅ Fichier .docx téléchargé
✅ Contenu du fichier correct et complet
```

**Exemple visuel du tableau :**
```
┌──────────┬────────┬──────────┬─────┬─────────────────┐
│Enseignant│ Classe │ Matière  │ ... │    Actions      │
├──────────┼────────┼──────────┼─────┼─────────────────┤
│ Mohamed  │ PEI1   │ Maths    │ ... │ ✔️ 📥 ← ICI !  │
│ Mohamed  │ PEI1   │ Sciences │ ... │ ✔️ 📥 ← ICI !  │
│ Kamel    │ PEI2   │ Anglais  │ ... │ ✔️ (pas encore) │
└──────────┴────────┴──────────┴─────┴─────────────────┘
```

---

### ÉTAPE 4 : Vérifier l'Exclusion des Matières Arabes

**Actions :**

1. **Toujours connecté en tant qu'enseignant (ex: Kamel)**

2. **Dans le tableau, chercher les lignes avec matières arabes :**
   - Arabe / عربي
   - Coran / القرآن
   - Hadith / الحديث
   - Tajwid / التجويد
   - Éducation Islamique / تربية إسلامية

3. **Vérifier qu'il N'Y A PAS de bouton 📥 pour ces lignes**
   - Même si un plan a été généré
   - Seul le bouton ✔️ doit être visible

**Résultat attendu :**
```
✅ Pas de bouton 📥 pour les matières arabes
✅ Bouton ✔️ présent (sauvegarde normale)
✅ Fonctionnalité normale pour les autres colonnes
```

---

### ÉTAPE 5 : Test avec un Enseignant Arabe (Optionnel)

**Actions :**

1. **Se déconnecter et se reconnecter**
   - Username : `Majed` (ou `Jaber`, `Imad`, `Saeed` - enseignants arabes)
   - Password : `Majed`

2. **Sélectionner la même semaine**

3. **Vérifier le tableau**
   - Toutes les matières arabes : **PAS de bouton 📥**
   - Matières non-arabes (si l'enseignant en a) : **Bouton 📥 visible**

**Résultat attendu :**
```
✅ Filtrage fonctionne aussi pour les enseignants arabes
✅ Ils ne peuvent télécharger que les plans des matières non-arabes
```

---

## 🔍 Dépannage

### Problème 1 : Interface de génération pas visible

**Symptôme :** Après connexion en tant que Mohamed, pas de section "Génération des Plans de Leçon"

**Solutions :**
1. Vérifier que vous êtes bien connecté en tant que `Mohamed` (pas Mohamed Ali)
2. Vider le cache du navigateur (Ctrl+Shift+Delete)
3. Recharger la page (Ctrl+F5)
4. Vérifier les logs de la console (F12 → Console)

---

### Problème 2 : Pas de bouton 📥 après génération

**Symptôme :** Plans générés mais pas de bouton de téléchargement

**Solutions :**
1. **Attendre le redéploiement Vercel** (2-3 minutes après le push)
2. **Vider le cache du navigateur** obligatoirement
3. **Recharger la page** (Ctrl+F5)
4. **Vérifier MongoDB** : Plans bien sauvegardés ?
5. **Vérifier la console** (F12) : Erreurs JavaScript ?
6. **Tester l'endpoint manuellement** :
   ```bash
   curl https://votre-domaine.vercel.app/api/lesson-plans/16
   ```
   Doit retourner la liste des plans disponibles

---

### Problème 3 : Erreur lors du téléchargement

**Symptôme :** Clic sur 📥 → Erreur affichée

**Solutions :**
1. **Vérifier les logs Vercel** :
   - Dashboard → Deployments → Functions → api/index.js
   - Chercher les logs commençant par `[Download Lesson Plan]`
2. **Vérifier MongoDB** :
   - Le document existe dans la collection `lessonPlans` ?
   - Le champ `fileBuffer` contient des données ?
3. **Tester l'endpoint directement** :
   ```bash
   curl -I https://votre-domaine.vercel.app/api/download-lesson-plan/16_Mohamed_PEI1_Maths_P1_Lundi
   ```
   Doit retourner un status 200

---

### Problème 4 : Fichier téléchargé corrompu

**Symptôme :** Fichier `.docx` ne s'ouvre pas ou est vide

**Solutions :**
1. **Régénérer le plan** (coordinateur)
2. **Vérifier la taille du fichier** téléchargé (doit être > 10 KB)
3. **Essayer un autre navigateur**
4. **Vérifier MongoDB** : `fileBuffer` contient bien des données binaires

---

### Problème 5 : Boutons visibles pour matières arabes

**Symptôme :** Bouton 📥 affiché pour Arabe/Coran/etc.

**Solutions :**
1. Vérifier le code frontend (`public/script.js` ligne ~240)
2. Vérifier la liste `arabicKeywords`
3. Ajouter des mots-clés manquants si nécessaire

---

## 📊 Checklist Complète de Validation

### Avant de considérer la fonctionnalité validée :

**Génération (Coordinateur) :**
- [ ] Interface visible pour Mohamed uniquement
- [ ] Sélection classe fonctionne
- [ ] Matières affichées (sans arabes)
- [ ] Génération fonctionne sans erreur
- [ ] Message de succès affiché
- [ ] Barre de progression visible

**Sauvegarde MongoDB :**
- [ ] Collection `lessonPlans` créée
- [ ] Documents sauvegardés correctement
- [ ] Structure complète (tous les champs)
- [ ] `fileBuffer` contient des données

**Téléchargement (Enseignants) :**
- [ ] Boutons 📥 visibles pour plans existants
- [ ] Boutons absents pour matières arabes
- [ ] Clic sur 📥 déclenche téléchargement
- [ ] Fichier `.docx` téléchargé
- [ ] Contenu du fichier correct

**Sécurité & Permissions :**
- [ ] Interface génération invisible pour enseignants
- [ ] Filtrage matières arabes fonctionnel
- [ ] Pas de bouton 📥 pour matières arabes
- [ ] Téléchargement fonctionne uniquement si plan existe

---

## 🎓 Notes Importantes

### Délai de Propagation
Après un push sur GitHub :
- Vercel détecte automatiquement le changement
- Build et déploiement : **2-3 minutes**
- Propagation CDN : **~30 secondes supplémentaires**
- **Total : ~3-4 minutes** avant que les changements soient actifs

### Cache Navigateur
**TOUJOURS vider le cache après un déploiement :**
- Chrome/Edge : `Ctrl+Shift+Delete` → Cocher "Cache" → Effacer
- Firefox : `Ctrl+Shift+Delete` → Cocher "Cache" → Effacer
- Ou : Navigation privée (`Ctrl+Shift+N` / `Ctrl+Shift+P`)

### Format des IDs de Plans
Les IDs sont générés selon ce format :
```
{week}_{enseignant}_{classe}_{matiere}_{periode}_{jour}
```
Les espaces sont remplacés par `_`

Exemple :
```
16_Mohamed_PEI1_Maths_P1_Lundi
```

---

## 📞 Support

Si après avoir suivi tous ces tests, un problème persiste :

**Informations à fournir :**
1. Résultat de chaque étape de test (✅ ou ❌)
2. Captures d'écran de l'erreur
3. Logs de la console navigateur (F12 → Console)
4. Logs Vercel (Functions → api/index.js)
5. Vérification MongoDB (nombre de documents dans `lessonPlans`)

---

**Date du guide :** 2025-12-12
**Version :** 1.1 (avec correction boutons invisibles)
**Commit actuel :** `951a7b2`
