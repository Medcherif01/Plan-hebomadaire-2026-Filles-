# 🔍 Comment Voir les Logs Vercel

## ✅ Logs Backend Ajoutés

**Commit**: `beb8843`  
**Ce qui a été ajouté**: Logs détaillés dans le backend pour comprendre pourquoi `lessonPlanId` n'est pas ajouté

## 📊 Logs Attendus

Quand vous chargez une semaine, le backend va logger:

```
📋 Plans disponibles pour S16: [
  "16_Mohamed_PEI1_Maths_1_Dimanche",
  "16_Kamel_PEI1_Sciences_2_Lundi",
  ...
]

✅ lessonPlanId trouvé: 16_Mohamed_PEI1_Maths_1_Dimanche
⚠️ lessonPlanId non trouvé: 16_Mohamed_PEI2_Anglais_3_Mardi
```

## 🌐 Voir les Logs Vercel (2 Méthodes)

### Méthode 1: Via Dashboard Vercel

1. 🔗 Aller sur: https://vercel.com/dashboard
2. 🔍 Cliquer sur le projet: **Plan-hebdomadaire-2026-Garcons**
3. 📊 Cliquer sur l'onglet **"Deployments"** (Déploiements)
4. ✅ Cliquer sur le déploiement le plus récent (en haut, avec badge "Ready")
5. 🪵 Cliquer sur l'onglet **"Runtime Logs"** (Logs d'exécution)
6. 🔄 Rafraîchir les logs en temps réel
7. 📝 Effectuer une action sur le site (ex: charger Semaine 16)
8. 👀 Voir les logs apparaître en temps réel

### Méthode 2: Via CLI Vercel (Plus Avancé)

Si vous avez Vercel CLI installé:
```bash
vercel logs --follow
```

## 🧪 Test pour Générer les Logs

1. ⏳ **Attendre 2-3 minutes** pour le redéploiement Vercel
2. 🗑️ **Vider le cache** navigateur
3. 🔐 **Se connecter** avec Mohamed/Mohamed
4. 📅 **Sélectionner Semaine 16**
5. 📊 **Ouvrir les logs Vercel** (voir méthode 1 ci-dessus)
6. 🔄 **Rafraîchir** la page (Ctrl+F5)
7. 👀 **Observer les logs** qui apparaissent

## 📸 Logs à Copier

Dans les logs Vercel, cherchez et **copiez** ces sections:

### Section 1: Plans Disponibles
```
📋 Plans disponibles pour S16: [...]
```
**Ceci montre tous les plans sauvegardés dans MongoDB**

### Section 2: Comparaison
```
✅ lessonPlanId trouvé: ...
⚠️ lessonPlanId non trouvé: ...
```
**Ceci montre pourquoi certains boutons apparaissent et d'autres non**

## 🎯 Ce Que Nous Cherchons

### ✅ Si les logs montrent:
```
📋 Plans disponibles pour S16: []
```
**Problème**: Aucun plan n'a été sauvegardé dans MongoDB  
**Solution**: Il faut d'abord générer des plans avec la modal

### ✅ Si les logs montrent:
```
📋 Plans disponibles pour S16: [
  "16_Mohamed_PEI1_Maths_1_Dimanche"
]
⚠️ lessonPlanId non trouvé: 16_Mohamed_PEI1_Maths_1_Dimanche
```
**Problème**: Les IDs ne correspondent pas exactement  
**Solution**: Il y a une différence dans la construction de l'ID (espaces, accents, etc.)

### ✅ Si les logs montrent:
```
📋 Plans disponibles pour S16: [
  "16_Mohamed_PEI1_Maths_1_Dimanche"
]
✅ lessonPlanId trouvé: 16_Mohamed_PEI1_Maths_1_Dimanche
```
**Parfait!** Le bouton devrait apparaître

## 🔧 Workflow de Test Complet

```
1. Attendre redéploiement Vercel (2-3 min)
   ↓
2. Vider cache navigateur
   ↓
3. Ouvrir logs Vercel (Dashboard → Deployments → Runtime Logs)
   ↓
4. Se connecter Mohamed/Mohamed
   ↓
5. Sélectionner Semaine 16
   ↓
6. Observer logs Vercel en temps réel
   ↓
7. Ouvrir modal + Générer des plans (si aucun plan existe)
   ↓
8. Attendre fin génération
   ↓
9. Observer logs: "💾 [Save Lesson Plan] Plan sauvegardé: ..."
   ↓
10. Recharger la page (Ctrl+F5)
    ↓
11. Observer logs: "📋 Plans disponibles..." et "✅ lessonPlanId trouvé..."
    ↓
12. Vérifier bouton 📥 dans le tableau
```

## 📋 Informations à M'envoyer

**Copiez et envoyez-moi**:

1. **Section "Plans disponibles"** des logs Vercel:
```
📋 Plans disponibles pour S16: [...]
```

2. **Tous les messages "trouvé" ou "non trouvé"**:
```
✅ lessonPlanId trouvé: ...
⚠️ lessonPlanId non trouvé: ...
```

3. **Capture d'écran** de la colonne "Actions" dans le tableau

## 🚀 Liens Rapides

- 🌐 Dashboard Vercel: https://vercel.com/dashboard
- 📊 Projet: Plan-hebdomadaire-2026-Garcons
- 🪵 Logs: Deployments → Latest → Runtime Logs

---

**Date**: 2025-12-14  
**Commit**: beb8843  
**Status**: Logs backend déployés
