# 🔍 Guide de Test et Débogage

## ✅ Corrections Déployées

**Commit**: `12b701e`  
**Date**: 2025-12-14  
**Status**: Déployé sur production

## 🐛 Problèmes Corrigés

### 1. Modal sans checkboxes ✅
**Problème**: La modal s'ouvrait vide (pas de liste de classes/matières)  
**Cause**: Appel `populateLessonPlanClasses()` manquant dans `openLessonPlanModal()`  
**Solution**: Ajouté l'appel dans la fonction d'ouverture

### 2. Bouton téléchargement manquant 🔍
**Problème**: Bouton 📥 n'apparaît ni pour coordinateur ni pour enseignants  
**Cause probable**: `lessonPlanId` n'est pas enrichi correctement dans les données  
**Solution**: Ajout de logs de débogage pour diagnostiquer

## 🧪 Tests à Effectuer

### Étape 1: Attendre le Redéploiement
1. ⏳ Attendre **2-3 minutes** pour le redéploiement Vercel
2. 🔍 Vérifier dashboard Vercel → Status "Ready"
3. 🗑️ **Vider le cache navigateur** (TRÈS IMPORTANT)
   - Chrome/Edge: `Ctrl+Shift+Del` → Cocher "Images et fichiers en cache" → Effacer
   - Ou: Ouvrir en **navigation privée** (Ctrl+Shift+N)
4. 🔄 Rafraîchir la page avec `Ctrl+F5`

### Étape 2: Test de la Modal (Coordinateur)
1. ✅ Se connecter avec `Mohamed` / `Mohamed`
2. ✅ Sélectionner **Semaine 16** (ou une autre)
3. ✅ Cliquer sur le bouton **"Générer Plans de Leçon"**
4. ✅ **Vérifier que la modal s'ouvre**
5. ✅ **Vérifier que les classes apparaissent** dans la colonne gauche
   - Devrait afficher: السادس (PEI1), الاول متوسط (PEI2), etc.
6. ✅ **Cocher 1 ou 2 classes**
7. ✅ **Vérifier que les matières apparaissent** dans la colonne droite
   - Devrait afficher: Maths, Sciences, Anglais, etc.
   - **NE DEVRAIT PAS** afficher: Arabe, Coran, Tajwid, etc.
8. ✅ **Cocher 1 ou 2 matières**
9. ✅ **Vérifier le compteur** en bas: "X classe(s) et Y matière(s) sélectionnées"

📸 **Si problème**: Faire une capture d'écran et envoyer

### Étape 3: Ouvrir la Console du Navigateur
**TRÈS IMPORTANT pour le debug!**

1. 🔧 Appuyer sur **F12** (ou Clic droit → "Inspecter")
2. 📊 Aller dans l'onglet **"Console"**
3. 🔍 Chercher les messages:
   - Messages normaux en blanc/noir
   - ⚠️ Avertissements en jaune
   - ❌ Erreurs en rouge

### Étape 4: Test Génération
1. ✅ Dans la modal, cliquer **"Générer Plans de Leçon"**
2. ✅ Confirmer dans la popup
3. ⏳ Attendre la barre de progression
4. ✅ Vérifier message de succès
5. ✅ **Vérifier que la modal se ferme automatiquement**

### Étape 5: Vérifier Console pour Logs
Après génération, dans la console (F12), chercher:

#### Messages attendus:
```
✅ Plan 1/4 sauvegardé
✅ Plan 2/4 sauvegardé
...
✅ 4 plan(s) de leçon généré(s) et sauvegardé(s) avec succès !
```

### Étape 6: Test Bouton Téléchargement
1. 🔄 Le tableau devrait se recharger automatiquement
2. 🔍 **Chercher la colonne "Actions"** dans le tableau
3. 👀 **Chercher le bouton 📥** (icône téléchargement)

#### Dans la Console (F12), chercher ces logs:

**Si bouton apparaît** (normal):
```
✅ Bouton téléchargement ajouté pour: 16_Mohamed_PEI1_Maths_1_Dimanche
✅ Bouton téléchargement ajouté pour: 16_Kamel_PEI1_Sciences_2_Lundi
...
```

**Si bouton n'apparaît PAS** (problème):
```
⚠️ Pas de lessonPlanId pour: {Enseignant: "Mohamed", Classe: "PEI1", ...}
```

**Si matière arabe exclue** (normal):
```
⚠️ Matière arabe exclue: Arabe
⚠️ Matière arabe exclue: القرآن
```

### Étape 7: Test Téléchargement (Si bouton visible)
1. ✅ Cliquer sur le bouton 📥
2. ✅ Vérifier qu'un fichier `.docx` se télécharge
3. ✅ Ouvrir le fichier pour vérifier le contenu

### Étape 8: Test Enseignant
1. ✅ Se déconnecter
2. ✅ Se connecter avec `Kamel` / `Kamel`
3. ✅ Sélectionner **la même semaine** (ex: Semaine 16)
4. 🔍 **Chercher le bouton 📥** dans la colonne Actions
5. 📋 **Noter dans la console** les messages debug

## 📸 Informations à Collecter

Si le bouton 📥 n'apparaît toujours pas, envoyez-moi:

### 1. Capture d'écran du tableau
- Montrer la colonne "Actions"
- Montrer qu'il n'y a pas de bouton 📥

### 2. Capture d'écran de la Console (F12)
Chercher et copier ces messages:
```
⚠️ Pas de lessonPlanId pour: ...
✅ Bouton téléchargement ajouté pour: ...
```

### 3. Réponse API
Dans la console, chercher:
```
fetchPlanData S16 pour Mohamed
```
Puis dans l'onglet "Réseau" (Network), chercher:
```
plans/16
```
Cliquer dessus → Onglet "Réponse" → Copier le JSON

## 🔧 Diagnostic Rapide

### Problème 1: Modal vide
**Symptôme**: Modal s'ouvre mais pas de checkboxes  
**Cause probable**: Cache navigateur  
**Solution**: Vider cache + Ctrl+F5

### Problème 2: Pas de matières après sélection classe
**Symptôme**: Cocher classe → rien dans colonne matières  
**Cause**: Aucune matière non-arabe pour cette classe  
**Solution**: Tester avec une autre classe (PEI1, PEI2)

### Problème 3: Bouton 📥 manquant
**Symptôme**: Pas de bouton téléchargement après génération  
**Cause probable**: `lessonPlanId` non enrichi dans l'API  
**Solution**: Vérifier logs console (voir ci-dessus)

## 📞 Aide au Débogage

Pour m'aider à corriger, envoyez:

1. ✅ Capture modal (avec ou sans checkboxes)
2. ✅ Capture tableau (colonne Actions)
3. ✅ Copie des logs console (F12)
4. ✅ Réponse API `/api/plans/16` (onglet Réseau)

## 🎯 Résultats Attendus

### ✅ Si tout fonctionne:
```
Console:
✅ Bouton téléchargement ajouté pour: 16_Mohamed_PEI1_Maths_1_Dimanche
✅ Bouton téléchargement ajouté pour: 16_Mohamed_PEI1_Sciences_2_Lundi
...

Tableau:
│ Actions      │
│ 💾 📥       │  ← Bouton téléchargement visible
```

### ❌ Si problème persiste:
```
Console:
⚠️ Pas de lessonPlanId pour: {Enseignant: "Mohamed", ...}
⚠️ Pas de lessonPlanId pour: {Enseignant: "Kamel", ...}

Tableau:
│ Actions      │
│ 💾          │  ← Pas de bouton 📥
```

## 🚀 Prochaines Actions

1. **Tester** selon ce guide
2. **Noter** les résultats (captures + logs)
3. **Envoyer** les informations si problème persiste
4. Je **corrigerai** en fonction des logs

---

**Date**: 2025-12-14  
**Version**: Debug v1.0  
**Commit**: 12b701e
