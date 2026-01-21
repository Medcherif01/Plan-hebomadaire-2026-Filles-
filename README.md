# Plan Hebdomadaire 2026 - Application Web

Application de gestion des plans hebdomadaires avec génération automatique de plans de leçon par IA.

## 🚀 Déploiement

### Variables d'environnement Vercel

Pour activer la génération de plans de leçon par IA, configurez les variables d'environnement suivantes sur Vercel :

#### Option 1 : GROQ API (Recommandé - Quota plus généreux)
```
GROQ_API_KEY=gsk_votre_cle_groq_ici
```

**Obtenir une clé GROQ :**
1. Créer un compte sur https://console.groq.com/
2. Aller dans "API Keys"
3. Créer une nouvelle clé API
4. Copier la clé (format : `gsk_...`)
5. L'ajouter dans Vercel → Settings → Environment Variables

**Avantages GROQ :**
- Quota gratuit plus élevé que Gemini
- Modèle rapide : llama-3.3-70b-versatile
- Pas de limite stricte de 20 requêtes/jour

#### Option 2 : Google Gemini API (Fallback)
```
GEMINI_API_KEY=votre_cle_gemini_ici
```

**Note :** Si `GROQ_API_KEY` est définie, elle sera utilisée en priorité. Gemini sera utilisé uniquement comme fallback si GROQ n'est pas disponible.

#### Autres variables requises
```
MONGO_URL=mongodb+srv://...
WORD_TEMPLATE_URL=https://...
LESSON_TEMPLATE_URL=https://...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

## 📝 Fonctionnalités

### Génération de Plans de Leçon IA
- **Bouton disquette** : Génère un plan de leçon pour une seule ligne
- **Bouton global violet** : "Générer Plans de Leçon (Affichés)" - génère tous les plans affichés dans le tableau et les télécharge en ZIP

### Endpoints API
- `/api/generate-ai-lesson-plan` : Génération simple d'un plan
- `/api/generate-multiple-ai-lesson-plans` : Génération multiple en ZIP

## 🔧 Technologies
- **Backend** : Node.js, Express, MongoDB
- **IA** : GROQ API (llama-3.3-70b) ou Google Gemini
- **Templates** : Docxtemplater pour la génération Word
- **Déploiement** : Vercel

## 📚 Documentation
Les plans de leçon générés incluent :
- Titre d'unité
- Méthodes d'enseignement
- Outils pédagogiques
- Objectifs d'apprentissage
- Étapes chronométrées (45 min)
- Ressources et devoirs
- Différenciation pédagogique

---

**Dernière mise à jour:** 2026-01-21
# Build: 20260121-072644

# Deploy: 2026-01-21 11:24:15
