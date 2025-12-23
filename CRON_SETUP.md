# Configuration du CRON pour les Notifications Automatiques

## Vue d'ensemble

Le système de notifications push envoie automatiquement des alertes aux enseignants qui n'ont pas complété leur plan hebdomadaire. Ces notifications sont envoyées **chaque mardi** à 9h00.

## Configuration sur Vercel (Recommandé)

Vercel ne supporte pas directement les CRON jobs traditionnels, mais offre **Vercel Cron Jobs** qui est la solution idéale pour notre cas.

### Étape 1 : Créer le fichier vercel.json

Le fichier `vercel.json` doit contenir la configuration suivante :

```json
{
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"
    }
  ],
  "crons": [
    {
      "path": "/api/check-incomplete-and-notify",
      "schedule": "0 9 * * 2"
    }
  ]
}
```

### Étape 2 : Configurer les variables d'environnement sur Vercel

Dans le dashboard Vercel, ajoutez les variables d'environnement suivantes :

1. `MONGO_URL` - URL de connexion MongoDB
2. `WORD_TEMPLATE_URL` - URL du modèle Word
3. `LESSON_TEMPLATE_URL` - URL du modèle de leçon
4. `GEMINI_API_KEY` - Clé API Google Gemini
5. `VAPID_PUBLIC_KEY` - Clé publique VAPID (générée)
6. `VAPID_PRIVATE_KEY` - Clé privée VAPID (générée)
7. `VAPID_SUBJECT` - mailto:admin@plan-hebdomadaire.com
8. `CRON_API_KEY` - Une clé aléatoire sécurisée (ex: générez avec `openssl rand -hex 32`)

### Étape 3 : Format de la requête CRON

Le endpoint `/api/check-incomplete-and-notify` attend :
- **Méthode** : POST
- **Headers** : `Content-Type: application/json`
- **Body** : `{ "apiKey": "VOTRE_CRON_API_KEY" }`

### Étape 4 : Déployer

```bash
vercel --prod
```

Les CRON jobs Vercel s'exécuteront automatiquement selon le schedule défini.

## Configuration Alternative : GitHub Actions

Si vous ne pouvez pas utiliser Vercel Cron, vous pouvez utiliser GitHub Actions :

### Créer `.github/workflows/weekly-notifications.yml` :

```yaml
name: Weekly Notification Check

on:
  schedule:
    # Tous les mardis à 9h00 UTC (ajustez selon votre fuseau horaire)
    - cron: '0 9 * * 2'
  workflow_dispatch: # Permet de déclencher manuellement

jobs:
  send-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notification check
        run: |
          curl -X POST https://plan-hebdomadaire-2026-boys.vercel.app/api/check-incomplete-and-notify \
            -H "Content-Type: application/json" \
            -d '{"apiKey": "${{ secrets.CRON_API_KEY }}"}'
```

N'oubliez pas d'ajouter `CRON_API_KEY` dans les Secrets de votre repository GitHub.

## Configuration Alternative : Service Externe (EasyCron, cron-job.org)

### Utilisation de cron-job.org (Gratuit)

1. Créez un compte sur https://cron-job.org
2. Créez un nouveau job avec les paramètres suivants :
   - **URL** : `https://plan-hebdomadaire-2026-boys.vercel.app/api/check-incomplete-and-notify`
   - **Méthode** : POST
   - **Headers** : 
     - `Content-Type: application/json`
   - **Body** :
     ```json
     {
       "apiKey": "VOTRE_CRON_API_KEY"
     }
     ```
   - **Schedule** : Chaque mardi à 9:00
   - **Timezone** : Sélectionnez votre fuseau horaire (ex: Asia/Riyadh pour l'Arabie Saoudite)

## Test Manuel

Pour tester le système sans attendre le mardi :

### Via curl :

```bash
curl -X POST https://plan-hebdomadaire-2026-boys.vercel.app/api/check-incomplete-and-notify \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "VOTRE_CRON_API_KEY"}'
```

### Via l'interface admin :

Vous pouvez ajouter un bouton admin dans l'interface pour déclencher manuellement la vérification.

## Fuseau Horaire

**Important** : Le schedule CRON `0 9 * * 2` signifie :
- **0** : À la minute 0
- **9** : À 9 heures du matin
- ***** : Tous les jours du mois
- ***** : Tous les mois
- **2** : Le mardi (0 = dimanche, 1 = lundi, 2 = mardi, etc.)

⚠️ **Attention** : Vercel Cron utilise le fuseau horaire UTC. Pour l'Arabie Saoudite (UTC+3), un cron à `0 9 * * 2` s'exécutera à 12h00 heure locale.

Pour exécuter à 9h00 heure d'Arabie Saoudite, utilisez :
```json
"schedule": "0 6 * * 2"
```
(6h00 UTC = 9h00 Arabia Standard Time)

## Monitoring et Logs

- Les logs sont visibles dans le dashboard Vercel sous "Functions" → "Logs"
- Chaque exécution du CRON apparaîtra dans les logs
- Les notifications envoyées sont enregistrées avec le statut de chaque enseignant

## Dépannage

### Le CRON ne s'exécute pas
1. Vérifiez que `vercel.json` contient bien la section `crons`
2. Vérifiez que le projet est déployé en production (`vercel --prod`)
3. Les CRON Vercel ne fonctionnent que sur les plans Pro (gratuit pour hobby avec limites)

### Les notifications ne sont pas reçues
1. Vérifiez que les clés VAPID sont correctement configurées
2. Vérifiez que l'enseignant est bien abonné aux notifications
3. Consultez les logs serveur pour voir les erreurs d'envoi
4. Testez avec l'endpoint `/api/test-notification`

### Erreur d'authentification
- Vérifiez que `CRON_API_KEY` est identique côté CRON et dans les variables d'environnement Vercel

## Sécurité

- ✅ L'endpoint `/api/check-incomplete-and-notify` est protégé par une clé API
- ✅ Utilisez HTTPS uniquement
- ✅ Ne partagez jamais la clé CRON_API_KEY
- ✅ Régénérez la clé CRON_API_KEY régulièrement
