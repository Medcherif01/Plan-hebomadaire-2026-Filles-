# Système de Notifications Push - Plan Hebdomadaire

## Vue d'ensemble

Ce système permet d'envoyer automatiquement des notifications push aux enseignants de la section garçons qui n'ont pas complété leur plan hebdomadaire. Les notifications sont envoyées **chaque lundi à 9h00, 14h00 et 18h00 (heure d'Arabie Saoudite)** avec un son de bip et dans la langue de chaque enseignant (français, arabe ou anglais).

## Fonctionnalités

### ✅ Notifications Automatiques
- Vérification automatique **chaque lundi à 9h00, 14h00 et 18h00**
- Détection des enseignants avec travaux incomplets
- Envoi de notifications push personnalisées **multilingues** (FR/AR/EN)
- Son de bip audible même si le site n'est pas ouvert
- Liste des classes concernées pour chaque enseignant
- Notifications persistantes même si le navigateur est fermé (tant que l'utilisateur n'est pas déconnecté)

### ✅ Gestion Côté Utilisateur
- **Pas de bouton d'activation/désactivation** - Les notifications sont **automatiquement activées** lors de la connexion
- Permission demandée lors de la première utilisation
- Abonnement persistant (stocké en base de données)
- Notification de test disponible (administrateur uniquement)
- **Notifications actives tant que l'utilisateur ne se déconnecte pas**

### ✅ Sécurité
- Authentification par clé API pour le CRON
- Clés VAPID pour sécuriser les communications push
- Abonnements stockés de manière sécurisée en MongoDB

## Architecture

### Backend (`api/index.js`)

#### Endpoints de Notification

1. **POST `/api/subscribe-push`**
   - Enregistre l'abonnement push d'un utilisateur
   - Stocke dans MongoDB pour persistance
   - Paramètres : `{ username, subscription }`

2. **POST `/api/unsubscribe-push`**
   - Supprime l'abonnement push d'un utilisateur
   - Paramètres : `{ username }`

3. **GET `/api/vapid-public-key`**
   - Retourne la clé publique VAPID pour le frontend
   - Nécessaire pour créer l'abonnement push

4. **POST `/api/check-incomplete-and-notify`** (CRON)
   - Vérifie les plans incomplets de la semaine actuelle
   - Envoie des notifications aux enseignants concernés
   - Protégé par clé API : `{ apiKey: CRON_API_KEY }`

5. **POST `/api/test-notification`**
   - Envoie une notification de test à un utilisateur
   - Paramètres : `{ username }`

### Frontend

#### `public/notifications.js`
Module de gestion des notifications côté client :

- **`registerServiceWorker()`** : Enregistre le Service Worker
- **`requestNotificationPermission()`** : Demande la permission
- **`subscribeToPushNotifications(username)`** : S'abonne aux notifications
- **`unsubscribeFromPushNotifications(username)`** : Se désabonne
- **`isUserSubscribed()`** : Vérifie l'état de l'abonnement
- **`initializeNotifications(username)`** : Initialise tout automatiquement
- **`testNotification(username)`** : Teste l'envoi d'une notification
- **`createNotificationToggleButton(username, container)`** : Crée le bouton UI

#### `public/service-worker.js`
Service Worker pour gérer la réception des notifications push.

## Utilisation

### Pour les Enseignants

1. **Activation des Notifications**
   - Se connecter à l'application
   - Cliquer sur le bouton "🔔 Activer Notifications"
   - Accepter la demande de permission du navigateur
   - Un message de confirmation s'affiche

2. **Réception des Notifications**
   - **Chaque lundi à 9h00, 14h00 et 18h00**, une vérification automatique est effectuée
   - Si votre plan n'est pas complet, vous recevez une notification **dans votre langue** (FR/AR/EN)
   - La notification indique les classes concernées
   - **Un son de bip** est émis pour attirer votre attention
   - Cliquer sur la notification ouvre l'application
   - Les notifications fonctionnent même si l'application n'est pas ouverte

3. **Désactivation**
   - **Se déconnecter de l'application** pour ne plus recevoir de notifications
   - Les notifications sont réactivées automatiquement lors de la prochaine connexion

### Pour les Administrateurs

1. **Configuration des Variables d'Environnement**
   
   Sur Vercel, configurer :
   ```
   VAPID_PUBLIC_KEY=BDuAoL4lagqZmYl4BPdCFYBwRhoqGMrcWUFAbF1pMBWq2e0JOV6fL_WitURlXXhXTROGB2vYpnvgSDZfAoZq0Jo
   VAPID_PRIVATE_KEY=TVK1zF6o5s-SK3OQnGCMgu4KZCNxg3py4YA4sMqtItg
   VAPID_SUBJECT=mailto:admin@plan-hebdomadaire.com
   CRON_API_KEY=[Générer une clé aléatoire sécurisée]
   ```

2. **Test Manuel**
   
   Pour tester sans attendre le mardi :
   ```bash
   curl -X POST https://plan-hebdomadaire-2026-boys.vercel.app/api/check-incomplete-and-notify \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "VOTRE_CRON_API_KEY"}'
   ```

3. **Monitoring**
   - Consulter les logs Vercel pour voir les exécutions CRON
   - Vérifier la collection `pushSubscriptions` dans MongoDB
   - Tester l'envoi avec `/api/test-notification`

## Configuration CRON

Le CRON est configuré dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/check-incomplete-and-notify",
      "schedule": "0 6,11,15 * * 1"
    }
  ]
}
```

**Schedule** : `0 6,11,15 * * 1`
- `0` : Minute 0
- `6,11,15` : 6h00, 11h00 et 15h00 UTC = **9h00, 14h00 et 18h00** Arabia Standard Time (UTC+3)
- `*` : Tous les jours du mois
- `*` : Tous les mois
- `1` : **Lundi** (0=dimanche, 1=lundi, 2=mardi...)

⚠️ **Important** : Vercel CRON n'est disponible que sur les plans Pro. Pour les plans Hobby, utilisez les alternatives dans `CRON_SETUP.md`.

## Structure des Données

### Collection MongoDB : `pushSubscriptions`

```javascript
{
  username: "Majed",           // Nom de l'enseignant
  subscription: {              // Objet PushSubscription
    endpoint: "https://...",
    keys: {
      p256dh: "...",
      auth: "..."
    }
  },
  updatedAt: ISODate("...")    // Date de dernière mise à jour
}
```

### Format de Notification

```javascript
{
  title: "⚠️ Plan Hebdomadaire Incomplet",
  body: "Bonjour Majed, votre plan pour la semaine 15 est incomplet pour: PEI1, PEI2. Veuillez le compléter.",
  icon: "https://cdn.glitch.global/.../logo.png",
  data: {
    url: "https://plan-hebdomadaire-2026-boys.vercel.app",
    week: 15,
    teacher: "Majed",
    classes: "PEI1, PEI2"
  }
}
```

## Dépannage

### Problème : Notifications non reçues

**Solutions** :
1. Vérifier que l'utilisateur a bien activé les notifications
2. Vérifier la permission dans les paramètres du navigateur
3. Tester avec `/api/test-notification`
4. Vérifier les logs serveur pour les erreurs d'envoi
5. S'assurer que les clés VAPID sont correctement configurées

### Problème : CRON ne s'exécute pas

**Solutions** :
1. Vérifier que le projet est déployé en production (`vercel --prod`)
2. Vérifier que `vercel.json` contient la section `crons`
3. Consulter les logs Vercel → Functions pour voir les exécutions
4. Pour les plans Hobby, utiliser une alternative (GitHub Actions, cron-job.org)

### Problème : Erreur "Non autorisé" sur le CRON

**Solutions** :
1. Vérifier que `CRON_API_KEY` est identique dans :
   - Les variables d'environnement Vercel
   - Le body de la requête CRON
2. Générer une nouvelle clé si nécessaire

### Problème : Service Worker ne s'enregistre pas

**Solutions** :
1. Vérifier que le site est servi en HTTPS
2. Vérifier que `service-worker.js` est accessible à la racine
3. Consulter la console du navigateur pour les erreurs
4. Vider le cache et recharger la page

## Compatibilité Navigateur

✅ **Supporté** :
- Chrome/Edge (Desktop & Mobile)
- Firefox (Desktop & Mobile)
- Safari (Desktop & Mobile iOS 16.4+)
- Opera

❌ **Non supporté** :
- Internet Explorer
- Safari iOS < 16.4

## Sécurité et Confidentialité

- ✅ Les abonnements push sont stockés de manière sécurisée
- ✅ Seuls les enseignants concernés reçoivent des notifications
- ✅ Les données transitent par HTTPS uniquement
- ✅ L'endpoint CRON est protégé par clé API
- ✅ Les clés VAPID sont privées et ne sont jamais exposées côté client
- ✅ Respect du RGPD : les utilisateurs peuvent se désabonner à tout moment

## Support

Pour toute question ou problème :
1. Consulter les logs Vercel
2. Vérifier la documentation dans `CRON_SETUP.md`
3. Tester avec les endpoints de debug
4. Contacter l'administrateur système

---

**Date de dernière mise à jour** : Décembre 2024
**Version** : 1.0.0
