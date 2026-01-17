# 🔐 Déconnexion Automatique - Mise à Jour du Mot de Passe

## Vue d'ensemble

Ce système permet de forcer la déconnexion de tous les utilisateurs actuellement connectés afin qu'ils se reconnectent avec un nouveau mot de passe.

---

## 🎯 Fonctionnalités

### Système de Version d'Authentification

Le système utilise une **version d'authentification** (`AUTH_VERSION`) pour gérer les sessions utilisateurs :

- **Version actuelle** : `AUTH_VERSION = 2`
- Chaque fois qu'un utilisateur se connecte, sa version d'authentification est stockée dans `localStorage`
- Au chargement de la page, le système vérifie si la version stockée correspond à la version actuelle
- Si les versions ne correspondent pas, l'utilisateur est automatiquement déconnecté

---

## 🔧 Fonctionnement Technique

### 1. Stockage de la Version

Lors d'une connexion réussie :
```javascript
localStorage.setItem('loggedInUser', result.username);
localStorage.setItem('authVersion', AUTH_VERSION.toString());
```

### 2. Vérification au Chargement

Au chargement de la page (`DOMContentLoaded`) :
```javascript
const savedUser = localStorage.getItem('loggedInUser');
const savedAuthVersion = localStorage.getItem('authVersion');

if (savedUser && savedAuthVersion && parseInt(savedAuthVersion) === AUTH_VERSION) {
    // ✅ Version valide - Connexion automatique
    initializeApp(savedUser);
} else {
    // ❌ Version obsolète - Déconnexion automatique
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('authVersion');
    
    // Affichage d'un message informatif
    errorDiv.textContent = '⚠️ Mise à jour de sécurité : Veuillez vous reconnecter avec le nouveau mot de passe.';
}
```

### 3. Nettoyage lors de la Déconnexion

Lors d'une déconnexion manuelle :
```javascript
localStorage.removeItem('loggedInUser');
localStorage.removeItem('authVersion');
```

---

## 📋 Scénarios d'Utilisation

### Scénario 1 : Nouvel Utilisateur

1. L'utilisateur se connecte pour la première fois
2. Version `AUTH_VERSION = 2` stockée dans `localStorage`
3. Connexion réussie ✅

### Scénario 2 : Utilisateur Existant (Ancien Mot de Passe)

1. L'utilisateur était connecté avec `AUTH_VERSION = 1` (ou aucune version)
2. Au chargement de la page, détection de version obsolète
3. Déconnexion automatique avec message informatif :
   ```
   ⚠️ Mise à jour de sécurité : Veuillez vous reconnecter avec le nouveau mot de passe.
   ```
4. L'utilisateur se reconnecte avec le **nouveau mot de passe**
5. Version `AUTH_VERSION = 2` stockée
6. Connexion réussie ✅

### Scénario 3 : Utilisateur Déjà à Jour

1. L'utilisateur s'était déjà reconnecté avec le nouveau mot de passe
2. Version `AUTH_VERSION = 2` présente dans `localStorage`
3. Connexion automatique ✅

---

## 🚀 Comment Forcer une Nouvelle Déconnexion

Si vous devez à nouveau forcer tous les utilisateurs à se reconnecter (par exemple, pour un nouveau changement de mot de passe) :

### Étape 1 : Modifier la Version

Dans `public/script.js`, ligne ~17 :
```javascript
const AUTH_VERSION = 3; // Incrémenter à 3, 4, 5, etc.
```

### Étape 2 : Commiter et Pousser

```bash
git add public/script.js
git commit -m "chore: Incrémenter AUTH_VERSION pour forcer nouvelle déconnexion"
git push origin main
```

### Étape 3 : Attendre le Déploiement

Vercel redéploiera automatiquement l'application après le push sur `main`.

### Étape 4 : Mise à Jour des Mots de Passe (Backend)

Si nécessaire, mettez à jour les mots de passe dans `api/index.js` :
```javascript
const validUsers = {
  "Mohamed": "NouveauMotDePasse",
  "Zohra": "NouveauMotDePasse",
  // ... etc.
};
```

---

## ✅ Avantages de cette Approche

### 1. **Déconnexion Immédiate**
- Dès que l'utilisateur rafraîchit la page ou revient sur l'application
- Pas besoin de vider manuellement le cache

### 2. **Message Informatif**
- L'utilisateur comprend pourquoi il a été déconnecté
- Message clair : "Mise à jour de sécurité"

### 3. **Pas de Conflit**
- Anciens et nouveaux utilisateurs ne se mélangent pas
- Système de version garantit la cohérence

### 4. **Facile à Gérer**
- Un simple changement de numéro de version
- Pas de manipulation complexe de la base de données

### 5. **Transparent pour les Nouveaux Utilisateurs**
- Les nouveaux utilisateurs ne voient aucun message d'erreur
- Connexion normale avec le nouveau mot de passe

---

## 🔍 Vérification

### Tester la Déconnexion Automatique

1. **Simulation d'un ancien utilisateur** :
   ```javascript
   // Dans la console du navigateur
   localStorage.setItem('loggedInUser', 'Mohamed');
   localStorage.setItem('authVersion', '1'); // Ancienne version
   location.reload();
   ```
   
   **Résultat attendu** : Déconnexion automatique avec message informatif

2. **Simulation d'un utilisateur à jour** :
   ```javascript
   // Dans la console du navigateur
   localStorage.setItem('loggedInUser', 'Mohamed');
   localStorage.setItem('authVersion', '2'); // Version actuelle
   location.reload();
   ```
   
   **Résultat attendu** : Connexion automatique réussie

---

## 📊 Logs et Débogage

### Logs Console

Le système affiche des logs détaillés :

```
✅ Connexion automatique :
"Utilisateur trouvé dans la session : 'Mohamed'. Connexion automatique."

🔴 Déconnexion automatique :
"🔴 Version d'authentification obsolète. Déconnexion automatique pour mise à jour du mot de passe."
```

### Vérifier le localStorage

```javascript
// Dans la console du navigateur
console.log('User:', localStorage.getItem('loggedInUser'));
console.log('Version:', localStorage.getItem('authVersion'));
```

---

## 🛡️ Sécurité

### Bonnes Pratiques

1. **Incrémenter progressivement** : `1 → 2 → 3 → ...`
2. **Documenter les changements** : Notez pourquoi vous avez incrémenté
3. **Coordonner avec le backend** : Mettez à jour les mots de passe côté serveur avant d'incrémenter
4. **Tester avant le déploiement** : Vérifiez que tout fonctionne en local

### Limites

- ⚠️ Basé sur `localStorage` : Si un utilisateur vide son cache, il devra se reconnecter
- ⚠️ Pas de notification push : Les utilisateurs ne sont déconnectés que lors du rechargement de la page

---

## 📝 Historique des Versions

| Version | Date       | Raison                                    |
|---------|------------|-------------------------------------------|
| 1       | Initial    | Version initiale sans système de version  |
| 2       | 2026-01-17 | Mise à jour mot de passe `Alkawthar@1207` |
| 3       | À venir    | Prochaine mise à jour si nécessaire       |

---

## 🤝 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs console du navigateur (F12)
2. Vérifiez le `localStorage` :
   ```javascript
   localStorage.getItem('authVersion')
   ```
3. Videz le cache et rechargez :
   - Chrome/Edge : `Ctrl + Shift + Delete`
   - Firefox : `Ctrl + Shift + Delete`
4. Essayez en navigation privée

---

**Date de mise en place** : 2026-01-17  
**Commit** : `feat: Déconnexion automatique pour mise à jour mot de passe`  
**Statut** : ✅ Déployé sur la branche `main`  
**Vercel** : Le redéploiement se fait automatiquement après le push

---

*Ce système garantit que tous les utilisateurs utilisent le même mot de passe sans confusion.*
