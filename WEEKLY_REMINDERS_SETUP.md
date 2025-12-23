# ⏰ Configuration des Alertes Automatiques Hebdomadaires

## 📋 Vue d'ensemble

Ce système envoie des alertes push automatiques aux enseignants qui n'ont pas rempli leurs plans hebdomadaires.

**Fonctionnement:**
- ✅ Les alertes sont envoyées **UNIQUEMENT le LUNDI**
- ✅ Fréquence: **TOUTES LES 3 HEURES** (de 00:00 à 23:59)
- ✅ Les alertes s'arrêtent automatiquement quand l'enseignant remplit son plan
- ✅ Support multilingue (Français, Arabe, Anglais)

---

## 🔧 Configuration Requise

### 1. Variables d'Environnement Vercel

Ajoutez ces variables dans Vercel → Settings → Environment Variables:

```bash
# Clé API pour sécuriser le endpoint CRON
CRON_API_KEY=votre-cle-secrete-aleatoire-ici

# Clés VAPID pour Web Push (déjà configurées normalement)
VAPID_PUBLIC_KEY=votre-cle-publique
VAPID_PRIVATE_KEY=votre-cle-privee
VAPID_SUBJECT=mailto:admin@plan-hebdomadaire.com
```

**⚠️ IMPORTANT:** Générez une clé `CRON_API_KEY` sécurisée (minimum 32 caractères aléatoires).

---

## 🤖 Méthode 1: GitHub Actions (RECOMMANDÉ)

Cette méthode utilise GitHub Actions pour déclencher les alertes automatiquement.

### Configuration:

1. **Créer le fichier de workflow:**

Le fichier `.github/workflows/weekly-reminders.yml` est déjà créé dans ce repository.

2. **Ajouter le secret GitHub:**

   - Allez sur votre repository GitHub
   - Settings → Secrets and variables → Actions
   - Cliquez sur "New repository secret"
   - Nom: `CRON_API_KEY`
   - Valeur: La même clé que celle configurée dans Vercel
   - Cliquez "Add secret"

3. **Le workflow s'exécutera automatiquement:**
   - ✅ Tous les LUNDIS uniquement
   - ✅ Toutes les 3 heures: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 (UTC)
   - ✅ Peut aussi être déclenché manuellement depuis l'onglet "Actions"

### Vérifier que ça fonctionne:

1. Allez sur GitHub → Actions
2. Vous devriez voir le workflow "Weekly Reminders"
3. Les exécutions apparaîtront dans l'historique

---

## 🌐 Méthode 2: Service CRON Externe (Alternative)

Si vous préférez un service externe, utilisez **cron-job.org** ou **EasyCron**.

### Configuration avec cron-job.org:

1. **Créer un compte sur** [cron-job.org](https://cron-job.org)

2. **Créer un nouveau cronjob:**
   - Title: `Weekly Reminders - Plan Hebdomadaire`
   - URL: `https://votre-app.vercel.app/api/send-weekly-reminders`
   - Method: `POST`
   - Request Body (JSON):
     ```json
     {
       "apiKey": "votre-cle-secrete-ici"
     }
     ```

3. **Configurer le planning:**
   - Schedule: `Every 3 hours on Monday`
   - Ou expression CRON: `0 */3 * * 1`
   - Timezone: UTC ou votre timezone locale

4. **Activer le job**

---

## 🧪 Test Manuel

Pour tester les alertes manuellement:

### Option 1: Via cURL

```bash
curl -X POST https://votre-app.vercel.app/api/send-weekly-reminders \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "votre-cle-secrete"}'
```

### Option 2: Via Postman

- Method: POST
- URL: `https://votre-app.vercel.app/api/send-weekly-reminders`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
  ```json
  {
    "apiKey": "votre-cle-secrete-ici"
  }
  ```

### Option 3: Via l'interface web

Un bouton de test peut être ajouté dans l'interface admin si nécessaire.

---

## 📊 Monitoring et Logs

### Consulter les logs Vercel:

1. Allez sur Vercel Dashboard
2. Sélectionnez votre projet
3. Onglet "Functions" → Sélectionnez `api/index.js`
4. Filtrez les logs avec: `[Weekly Reminders]`

### Logs à surveiller:

```
✅ [Weekly Reminders] Notification envoyée à Mohamed (fr)
📊 [Weekly Reminders] 5 enseignants incomplets: ["Mohamed", "Kamel", ...]
⚠️ Pas lundi aujourd'hui. Aucune alerte envoyée.
```

---

## 🎯 Comportement du Système

### Quand les alertes sont envoyées:

1. ✅ **Jour**: Uniquement le LUNDI
2. ✅ **Heure**: Toutes les 3 heures (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
3. ✅ **Condition**: L'enseignant a au moins un "Travaux de classe" vide

### Quand les alertes s'arrêtent:

1. ✅ L'enseignant remplit tous ses "Travaux de classe"
2. ✅ La semaine se termine (passage à la semaine suivante)
3. ✅ Ce n'est plus lundi

### Messages d'alerte (multilingue):

**Français:**
```
📋 Rappel: Finaliser le Plan Hebdomadaire
Bonjour Mohamed, n'oubliez pas de finaliser votre plan pour la semaine 15.
```

**Arabe:**
```
📋 تذكير: أكمل الخطة الأسبوعية
مرحباً Mohamed، لا تنسى إكمال خطتك للأسبوع 15.
```

**Anglais:**
```
📋 Reminder: Finalize Weekly Plan
Hello Kamel, don't forget to finalize your plan for week 15.
```

---

## 🔒 Sécurité

1. **Clé API**: Seules les requêtes avec la bonne `CRON_API_KEY` sont acceptées
2. **Rate Limiting**: Maximum 1 exécution toutes les 3 heures
3. **Validation**: Vérification du jour de la semaine côté serveur

---

## ❓ FAQ

### Q: Les alertes se répètent-elles si l'enseignant ne fait rien?
✅ Oui, toutes les 3 heures le lundi jusqu'à ce qu'il remplisse son plan.

### Q: L'enseignant peut-il désactiver les alertes?
❌ Non, les alertes sont obligatoires pour garantir que les plans soient remplis. Mais il peut refuser les notifications push dans son navigateur.

### Q: Que se passe-t-il si un enseignant n'a pas activé les notifications?
⚠️ Il n'y aura pas d'alerte pour cet enseignant (statut: `no_subscription` dans les logs).

### Q: Les alertes fonctionnent-elles même si le navigateur est fermé?
✅ Oui! Grâce aux Service Workers, les notifications arrivent même si l'application n'est pas ouverte.

---

## 📞 Support

Pour toute question ou problème:
- Consultez les logs Vercel
- Vérifiez les variables d'environnement
- Testez manuellement l'endpoint avec cURL
- Vérifiez que les enseignants ont bien activé les notifications

---

**Dernière mise à jour:** 2025-12-15  
**Version:** 1.0  
**Statut:** ✅ Opérationnel
