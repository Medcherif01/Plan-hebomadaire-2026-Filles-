# 🔧 Guide de Dépannage - Problèmes de Connexion

## Problème: "La connexion ne s'établit pas !"

Si vous rencontrez des problèmes de connexion lors de la tentative de login, suivez ce guide étape par étape.

---

## 🔍 Diagnostic Rapide

### Option 1: Utiliser la page de diagnostic
1. Ouvrez dans votre navigateur : `https://votre-domaine.vercel.app/diagnostic.html`
2. Cliquez sur "Lancer tous les tests"
3. Analysez les résultats affichés

### Option 2: Vérification manuelle

#### 1. Vérifier que l'application est déployée
- Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
- Vérifiez que votre projet `Plan-hebdomadaire-2026-Garcons` est bien déployé
- Vérifiez qu'il n'y a pas d'erreurs de build

#### 2. Vérifier les variables d'environnement
Les variables suivantes **doivent être configurées** dans Vercel :

| Variable | Requis | Description |
|----------|--------|-------------|
| `MONGO_URL` | ✅ OUI | URL de connexion MongoDB (format: `mongodb+srv://...`) |
| `GEMINI_API_KEY` | ✅ OUI | Clé API Google Gemini pour génération de plans |
| `WORD_TEMPLATE_URL` | ✅ OUI | URL du modèle Word pour plans hebdomadaires |
| `LESSON_TEMPLATE_URL` | ✅ OUI | URL du modèle Word pour plans de leçon |
| `VAPID_PUBLIC_KEY` | ✅ OUI | Clé publique VAPID pour notifications push |
| `VAPID_PRIVATE_KEY` | ✅ OUI | Clé privée VAPID pour notifications push |
| `VAPID_SUBJECT` | ✅ OUI | Email de contact (ex: `mailto:admin@example.com`) |
| `CRON_API_KEY` | ⚠️ Optionnel | Pour sécuriser les CRON jobs |

**Comment configurer les variables d'environnement sur Vercel :**
1. Allez sur votre projet Vercel
2. Cliquez sur "Settings" → "Environment Variables"
3. Ajoutez chaque variable avec sa valeur
4. Cliquez sur "Save"
5. **Important:** Redéployez l'application après avoir ajouté/modifié les variables

#### 3. Vérifier les logs Vercel
1. Allez sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet
3. Cliquez sur "Deployments"
4. Cliquez sur le déploiement le plus récent
5. Allez dans l'onglet "Functions"
6. Sélectionnez la fonction `api/index.js`
7. Consultez les logs pour voir les erreurs

---

## 🐛 Erreurs Courantes et Solutions

### Erreur 1: "Délai d'attente dépassé"
**Symptôme:** Le bouton de connexion tourne pendant 10 secondes puis affiche une erreur.

**Causes possibles:**
- L'API n'est pas déployée ou ne répond pas
- Les variables d'environnement ne sont pas configurées
- Problème de connexion à MongoDB

**Solutions:**
1. Vérifiez que l'application est bien déployée sur Vercel
2. Testez l'endpoint health: `https://votre-domaine.vercel.app/api/health`
3. Vérifiez la variable `MONGO_URL` dans Vercel
4. Consultez les logs Vercel

### Erreur 2: "Erreur réseau"
**Symptôme:** Message "Erreur réseau. Impossible de contacter le serveur."

**Causes possibles:**
- Problème de connexion Internet
- CORS non configuré (normalement déjà fait)
- Firewall bloquant les requêtes

**Solutions:**
1. Vérifiez votre connexion Internet
2. Essayez depuis un autre navigateur
3. Désactivez temporairement extensions de navigateur/VPN
4. Vérifiez les CORS dans `api/index.js` (déjà configuré : `app.use(cors())`)

### Erreur 3: "Identifiants invalides"
**Symptôme:** Message "Identifiants invalides" immédiatement après le clic.

**Cause:** Le serveur répond mais les identifiants sont incorrects.

**Solution:** 
Vérifiez que vous utilisez l'un des comptes valides :
- **Mohamed** / Mohamed
- **Abas** / Abas
- **Jaber** / Jaber
- **Imad** / Imad
- **Kamel** / Kamel
- **Majed** / Majed
- **Mohamed Ali** / Mohamed Ali
- **Morched** / Morched
- **Saeed** / Saeed
- **Sami** / Sami
- **Sylvano** / Sylvano
- **Tonga** / Tonga
- **Oumarou** / Oumarou
- **Zine** / Zine
- **Youssouf** / Youssouf

*(Le mot de passe est identique au nom d'utilisateur)*

### Erreur 4: Erreur MongoDB
**Symptôme:** Logs Vercel montrent des erreurs MongoDB.

**Causes possibles:**
- Variable `MONGO_URL` manquante ou invalide
- Base de données MongoDB inaccessible
- Problème de whitelist IP dans MongoDB Atlas

**Solutions:**
1. Vérifiez la variable `MONGO_URL` dans Vercel
2. Si vous utilisez MongoDB Atlas:
   - Allez sur [MongoDB Atlas](https://cloud.mongodb.com/)
   - Projet → Database Access → Network Access
   - Ajoutez `0.0.0.0/0` pour autoriser toutes les IPs (recommandé pour Vercel)
3. Testez la connexion MongoDB avec un client (MongoDB Compass)

---

## 📋 Checklist de Vérification

- [ ] Application déployée sur Vercel sans erreurs de build
- [ ] Variable `MONGO_URL` configurée dans Vercel
- [ ] Variable `GEMINI_API_KEY` configurée dans Vercel
- [ ] Variables VAPID configurées dans Vercel
- [ ] MongoDB accessible (whitelist IP: `0.0.0.0/0`)
- [ ] Test de l'endpoint `/api/health` réussi
- [ ] Test de l'endpoint `/api/login` réussi
- [ ] Connexion Internet fonctionnelle
- [ ] Navigateur à jour et compatible

---

## 🆘 Besoin d'Aide Supplémentaire ?

### Informations à fournir :
1. **Résultat du diagnostic** : Copiez les résultats de `/diagnostic.html`
2. **Logs Vercel** : Copiez les logs de la fonction `api/index.js`
3. **Message d'erreur exact** : Capturez l'erreur affichée dans le navigateur
4. **Console navigateur** : Ouvrez la Console Développeur (F12) et copiez les erreurs

### Où trouver de l'aide :
- Consultez les logs Vercel pour plus de détails
- Vérifiez la documentation MongoDB Atlas
- Contactez l'administrateur système

---

## 🔄 Améliorations Apportées

### Gestion des erreurs améliorée (version actuelle)
- ✅ Timeout de 10 secondes pour éviter les attentes infinies
- ✅ Messages d'erreur détaillés et contextuels
- ✅ Logging côté serveur pour diagnostic
- ✅ Endpoint `/api/health` pour vérifier l'état du serveur
- ✅ Page `/diagnostic.html` pour tester la connectivité
- ✅ Logs de connexion détaillés dans l'API

### Prochaines étapes recommandées
- Mettre en place un système de monitoring (ex: Sentry, LogRocket)
- Ajouter des alertes automatiques en cas de panne
- Configurer un système de backup pour MongoDB

---

**Dernière mise à jour:** 2025-12-12
**Version:** 2.0 (avec diagnostic amélioré)
