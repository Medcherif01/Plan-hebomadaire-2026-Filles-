# 📚 Fonctionnalité de Génération et Téléchargement des Plans de Leçon

## Vue d'ensemble

Cette fonctionnalité permet au **coordinateur (Mohamed)** de générer des plans de leçon avec l'IA, les sauvegarder dans MongoDB, et permettre aux **enseignants** (sauf ceux d'arabe) de les télécharger.

---

## 🎯 Flux de Travail

### 1. Génération par le Coordinateur

**Qui peut générer ?**
- ✅ **Coordinateur uniquement** (Mohamed)
- ❌ Les enseignants ne peuvent PAS générer

**Comment générer ?**
1. Se connecter en tant que Mohamed
2. Sélectionner une semaine
3. Dans l'interface "Génération des Plans de Leçon (Coordinateur)" :
   - Choisir une **classe** (PEI1, PEI2, etc.)
   - Cocher les **matières** à générer
   - ⚠️ **Les matières arabes sont automatiquement exclues**
4. Cliquer sur "Générer Plans de Leçon Sélectionnés"
5. Confirmer la génération
6. Les plans sont générés un par un et **sauvegardés automatiquement dans MongoDB**

**Matières exclues (arabes) :**
- Arabe / عربي / العربية / اللغة العربية
- Coran / القرآن / قرآن
- Tajwid / التجويد / تجويد
- Hadith / الحديث / حديث
- Éducation Islamique / تربية إسلامية / التربية الإسلامية
- Tawhid / التوحيد / توحيد
- Fiqh / الفقه / فقه

---

### 2. Téléchargement par les Enseignants

**Qui peut télécharger ?**
- ✅ **Tous les enseignants** (sauf ceux des matières arabes)
- ❌ Pas de bouton de téléchargement pour les matières arabes

**Comment télécharger ?**
1. Se connecter avec son compte enseignant
2. Sélectionner une semaine
3. Dans le tableau, pour chaque ligne où un plan de leçon existe :
   - Un bouton 📥 (icône de téléchargement) apparaît dans la colonne "Actions"
4. Cliquer sur le bouton 📥
5. Le plan de leçon est téléchargé au format `.docx`

**Conditions d'affichage du bouton :**
- ✅ Un plan de leçon a été généré pour cette ligne
- ✅ La matière n'est PAS une matière arabe
- ❌ Sinon : pas de bouton

---

## 🔧 Architecture Technique

### Base de Données MongoDB

**Collection : `lessonPlans`**

Structure d'un document :
```javascript
{
  _id: "48_Mohamed_PEI1_Maths_P1_Lundi",  // Identifiant unique
  week: 48,                                // Numéro de semaine
  enseignant: "Mohamed",                   // Nom de l'enseignant
  classe: "PEI1",                          // Classe
  matiere: "Maths",                        // Matière
  periode: "P1",                           // Période
  jour: "Lundi",                           // Jour
  filename: "Plan de lecon-Maths-P1-PEI1-Semaine48.docx",
  fileBuffer: <Buffer ...>,                // Contenu du fichier Word
  createdAt: ISODate("2025-12-12T..."),   // Date de création
  rowData: { ... }                         // Données complètes de la ligne
}
```

### API Endpoints

#### 1. `/api/save-lesson-plan` (POST)
Sauvegarde un plan de leçon généré dans MongoDB.

**Body :**
```json
{
  "week": 48,
  "rowData": { ... },
  "fileBuffer": "base64-encoded-buffer",
  "filename": "Plan de lecon-Maths-P1-PEI1-Semaine48.docx"
}
```

**Response :**
```json
{
  "success": true,
  "message": "Plan de leçon sauvegardé.",
  "lessonPlanId": "48_Mohamed_PEI1_Maths_P1_Lundi"
}
```

#### 2. `/api/download-lesson-plan/:lessonPlanId` (GET)
Télécharge un plan de leçon depuis MongoDB.

**Paramètres :**
- `lessonPlanId` : Identifiant unique du plan (ex: `48_Mohamed_PEI1_Maths_P1_Lundi`)

**Response :**
- Type : `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Fichier `.docx` téléchargé

#### 3. `/api/lesson-plans/:week` (GET)
Liste tous les plans de leçon disponibles pour une semaine.

**Paramètres :**
- `week` : Numéro de semaine (ex: 48)

**Response :**
```json
[
  {
    "_id": "48_Mohamed_PEI1_Maths_P1_Lundi",
    "week": 48,
    "enseignant": "Mohamed",
    "classe": "PEI1",
    "matiere": "Maths",
    "filename": "Plan de lecon-Maths-P1-PEI1-Semaine48.docx",
    "createdAt": "2025-12-12T..."
  },
  ...
]
```

---

## 📝 Code Frontend

### Génération (Coordinateur)

**Fonction : `generateSelectedLessonPlans()`**

Flux :
1. Récupère la classe et les matières sélectionnées
2. Filtre les lignes du `planData`
3. Pour chaque ligne :
   - Génère le plan avec `/api/generate-ai-lesson-plan`
   - Convertit le fichier en base64
   - Sauvegarde dans MongoDB avec `/api/save-lesson-plan`
   - Met à jour `rowData.lessonPlanId`
4. Affiche la progression et le résultat

### Téléchargement (Enseignants)

**Fonction : `downloadLessonPlan(rowData)`**

Flux :
1. Vérifie que `rowData.lessonPlanId` existe
2. Appelle `/api/download-lesson-plan/:lessonPlanId`
3. Télécharge le fichier `.docx`

### Affichage du Bouton

**Dans : `displayPlanTable(data)`**

Logique :
```javascript
// Vérifier si la matière est arabe
const isArabicSubject = arabicKeywords.some(keyword => 
    matiere.toLowerCase().includes(keyword.toLowerCase())
);

// Afficher le bouton SEULEMENT si :
// - Un plan existe (rowObj.lessonPlanId)
// - La matière n'est PAS arabe
if (rowObj && rowObj.lessonPlanId && !isArabicSubject) {
    // Créer et afficher le bouton de téléchargement
}
```

---

## 🎨 Interface Utilisateur

### Pour le Coordinateur (Mohamed)

**Section : "Génération des Plans de Leçon (Coordinateur)"**

```
┌──────────────────────────────────────────────────────┐
│ Génération des Plans de Leçon (Coordinateur)        │
├──────────────────────────────────────────────────────┤
│ 🏫 Choisir une Classe :                              │
│ [Sélectionnez une classe ▼]                          │
│                                                       │
│ 📚 Matières à générer (Exclu: Matières Arabes) :    │
│ ☐ Maths    ☐ Sciences    ☐ Anglais                  │
│ ☐ Français ☐ Histoire    ☐ Géographie               │
│                                                       │
│ [🤖 Générer Plans de Leçon Sélectionnés]            │
└──────────────────────────────────────────────────────┘
```

### Pour les Enseignants

**Tableau avec bouton de téléchargement :**

```
┌────────────┬────────┬──────────┬────────┬────────────┐
│ Enseignant │ Classe │ Matière  │ ... │   Actions    │
├────────────┼────────┼──────────┼────────┼────────────┤
│ Mohamed    │ PEI1   │ Maths    │ ... │ ✔️ 📥        │
│ Kamel      │ PEI2   │ Anglais  │ ... │ ✔️ 📥        │
│ Majed      │ PEI1   │ Arabe    │ ... │ ✔️ (pas 📥) │
└────────────┴────────┴──────────┴────────┴────────────┘
```

**Légende :**
- ✔️ = Bouton de sauvegarde (toujours présent)
- 📥 = Bouton de téléchargement du plan de leçon (conditionnel)

---

## ⚙️ Configuration Requise

### Variables d'Environnement

Les variables suivantes doivent être configurées dans Vercel :

```bash
MONGO_URL=mongodb+srv://...          # Base de données MongoDB
GEMINI_API_KEY=...                   # Clé API Google Gemini
LESSON_TEMPLATE_URL=https://...     # URL du modèle Word pour plans de leçon
```

### MongoDB

**Collection : `lessonPlans`**
- Créée automatiquement lors de la première sauvegarde
- Index recommandé : `{ week: 1, enseignant: 1, classe: 1, matiere: 1 }`

---

## 🧪 Tests

### Test 1 : Génération par le Coordinateur

1. ✅ Se connecter en tant que Mohamed
2. ✅ L'interface "Génération des Plans de Leçon" est visible
3. ✅ Sélectionner une classe (ex: PEI1)
4. ✅ Les matières apparaissent (sans les matières arabes)
5. ✅ Cocher quelques matières
6. ✅ Cliquer sur "Générer Plans de Leçon Sélectionnés"
7. ✅ Confirmer la génération
8. ✅ Barre de progression affichée
9. ✅ Message de succès : "X plan(s) de leçon généré(s) avec succès !"

### Test 2 : Vérification MongoDB

1. ✅ Se connecter à MongoDB
2. ✅ Vérifier la collection `lessonPlans`
3. ✅ Vérifier que les documents sont créés :
   - Bon format d'ID
   - Champs corrects
   - `fileBuffer` présent

### Test 3 : Téléchargement par Enseignant (non-arabe)

1. ✅ Se connecter en tant qu'enseignant (ex: Kamel)
2. ✅ Sélectionner la même semaine
3. ✅ Dans le tableau, voir les boutons 📥 pour les matières non-arabes
4. ✅ Cliquer sur un bouton 📥
5. ✅ Le fichier `.docx` est téléchargé
6. ✅ Ouvrir le fichier : contenu correct

### Test 4 : Pas de bouton pour les matières arabes

1. ✅ Se connecter en tant qu'enseignant
2. ✅ Sélectionner une semaine
3. ✅ Dans le tableau, vérifier les lignes avec matières arabes
4. ✅ Aucun bouton 📥 n'apparaît pour ces lignes

### Test 5 : Interface Non Visible pour les Enseignants

1. ✅ Se connecter en tant qu'enseignant (pas Mohamed)
2. ✅ L'interface "Génération des Plans de Leçon" n'est PAS visible
3. ✅ Seuls les boutons de téléchargement sont présents

---

## 🔒 Sécurité et Permissions

### Contrôle d'Accès

| Fonctionnalité | Coordinateur | Enseignants |
|----------------|-------------|-------------|
| Voir l'interface de génération | ✅ | ❌ |
| Générer des plans de leçon | ✅ | ❌ |
| Télécharger les plans (non-arabes) | ✅ | ✅ |
| Télécharger les plans (arabes) | ✅ | ❌ |

### Validation des Données

**Backend (`/api/save-lesson-plan`) :**
- ✅ Vérification de la présence de tous les champs requis
- ✅ Validation du format de `week` (nombre)
- ✅ Conversion sécurisée du buffer base64

**Backend (`/api/download-lesson-plan/:id`) :**
- ✅ Vérification de l'existence du plan
- ✅ Retour 404 si introuvable

**Frontend :**
- ✅ Vérification de `rowObj.lessonPlanId` avant affichage du bouton
- ✅ Filtrage des matières arabes côté client

---

## 📊 Statistiques et Monitoring

### Logs Disponibles

**Génération :**
```
💾 [Save Lesson Plan] Sauvegarde d'un plan de leçon
✅ [Save Lesson Plan] Plan sauvegardé: 48_Mohamed_PEI1_Maths_P1_Lundi
```

**Téléchargement :**
```
📥 [Download Lesson Plan] Téléchargement: 48_Mohamed_PEI1_Maths_P1_Lundi
✅ [Download Lesson Plan] Envoyé: Plan de lecon-Maths-P1-PEI1-Semaine48.docx
```

**Liste :**
```
📋 [Lesson Plans List] Récupération pour semaine 48
✅ [Lesson Plans List] 12 plan(s) trouvé(s)
```

---

## 🚀 Déploiement

### Checklist de Déploiement

- [ ] Variables d'environnement configurées dans Vercel
- [ ] MongoDB accessible depuis Vercel
- [ ] Modèle Word (`LESSON_TEMPLATE_URL`) accessible
- [ ] Code déployé sur la branche `main`
- [ ] Tests effectués en environnement de production

### Vérification Post-Déploiement

1. ✅ Connexion en tant que coordinateur fonctionne
2. ✅ Interface de génération visible
3. ✅ Génération de plans fonctionne
4. ✅ Sauvegarde dans MongoDB réussit
5. ✅ Boutons de téléchargement apparaissent
6. ✅ Téléchargement fonctionne
7. ✅ Matières arabes correctement exclues

---

## 🐛 Dépannage

### Problème : Pas de bouton de téléchargement

**Cause possible :**
- Aucun plan de leçon généré pour cette ligne
- La matière est classée comme "arabe"

**Solution :**
1. Vérifier que le coordinateur a bien généré les plans
2. Vérifier dans MongoDB : `db.lessonPlans.find({ week: 48 })`
3. Vérifier que `rowData.lessonPlanId` est défini

### Problème : Erreur lors de la génération

**Cause possible :**
- Clé API Gemini invalide
- URL du modèle Word inaccessible
- MongoDB inaccessible

**Solution :**
1. Vérifier les variables d'environnement dans Vercel
2. Consulter les logs Vercel : Functions → api/index.js
3. Tester `/api/health` pour vérifier la configuration

### Problème : Fichier téléchargé corrompu

**Cause possible :**
- Erreur de conversion base64
- Buffer incomplet

**Solution :**
1. Régénérer le plan de leçon
2. Vérifier les logs de sauvegarde
3. Tester avec un autre navigateur

---

## 📚 Ressources

- **Documentation MongoDB :** https://docs.mongodb.com/
- **API Gemini :** https://ai.google.dev/docs
- **Docxtemplater :** https://docxtemplater.com/

---

**Dernière mise à jour :** 2025-12-12
**Version :** 1.0
**Statut :** ✅ Implémenté et testé
