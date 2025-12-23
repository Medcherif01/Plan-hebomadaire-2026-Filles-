# 📝 Instructions pour Ajouter le Workflow GitHub Actions

## ⚠️ Important

Le fichier de workflow `.github/workflows/weekly-reminders.yml` ne peut pas être poussé automatiquement par un GitHub App pour des raisons de sécurité. 

**Vous devez l'ajouter manuellement en tant qu'administrateur du repository.**

---

## 🚀 Méthode Rapide (Recommandée)

### Étape 1: Ajouter le fichier workflow

Le fichier existe déjà localement dans votre branche `genspark_ai_developer`. Pour l'ajouter à main:

```bash
# 1. Basculer sur la branche main
git checkout main

# 2. Créer le répertoire workflows si nécessaire
mkdir -p .github/workflows

# 3. Copier le fichier depuis genspark_ai_developer
git checkout genspark_ai_developer -- .github/workflows/weekly-reminders.yml

# 4. Ajouter et committer
git add .github/workflows/weekly-reminders.yml
git commit -m "chore: Ajout workflow GitHub Actions pour alertes hebdomadaires"

# 5. Pousser vers GitHub
git push origin main
```

### Étape 2: Configurer le secret GitHub

1. Allez sur **GitHub** → Votre repository → **Settings**
2. Dans le menu latéral: **Secrets and variables** → **Actions**
3. Cliquez sur **New repository secret**
4. Nom: `CRON_API_KEY`
5. Valeur: La même clé que celle configurée dans Vercel (minimum 32 caractères aléatoires)
6. Cliquez **Add secret**

### Étape 3: Vérifier que ça fonctionne

1. Allez sur **GitHub** → **Actions**
2. Vous devriez voir le workflow "Weekly Reminders"
3. Pour tester immédiatement:
   - Cliquez sur "Weekly Reminders"
   - Cliquez sur "Run workflow"
   - Sélectionnez la branche `main`
   - Cliquez "Run workflow"

---

## 📋 Contenu du Fichier Workflow

Si vous préférez créer le fichier manuellement, voici son contenu:

```yaml
name: Weekly Reminders

# 🕐 Déclencher le workflow tous les LUNDIS, toutes les 3 heures
on:
  schedule:
    # Lundi à 00:00 UTC
    - cron: '0 0 * * 1'
    # Lundi à 03:00 UTC
    - cron: '0 3 * * 1'
    # Lundi à 06:00 UTC
    - cron: '0 6 * * 1'
    # Lundi à 09:00 UTC
    - cron: '0 9 * * 1'
    # Lundi à 12:00 UTC
    - cron: '0 12 * * 1'
    # Lundi à 15:00 UTC
    - cron: '0 15 * * 1'
    # Lundi à 18:00 UTC
    - cron: '0 18 * * 1'
    # Lundi à 21:00 UTC
    - cron: '0 21 * * 1'
  
  # Permet aussi un déclenchement manuel depuis l'interface GitHub
  workflow_dispatch:

jobs:
  send-reminders:
    name: Envoyer les Rappels Hebdomadaires
    runs-on: ubuntu-latest
    
    steps:
      - name: 📅 Vérifier le jour
        id: check-day
        run: |
          DAY=$(date +%u)  # 1 = Lundi, 7 = Dimanche
          echo "day=$DAY" >> $GITHUB_OUTPUT
          if [ "$DAY" -eq 1 ]; then
            echo "✅ C'est lundi! Les alertes seront envoyées."
          else
            echo "⚠️ Pas lundi aujourd'hui. Aucune alerte envoyée."
          fi
      
      - name: 🔔 Envoyer les alertes
        if: steps.check-day.outputs.day == '1' || github.event_name == 'workflow_dispatch'
        run: |
          echo "🚀 Envoi des alertes aux enseignants..."
          RESPONSE=$(curl -s -X POST https://plan-hebdomadaire-2026-boys.vercel.app/api/send-weekly-reminders \
            -H "Content-Type: application/json" \
            -d "{\"apiKey\": \"${{ secrets.CRON_API_KEY }}\"}")
          
          echo "📊 Réponse du serveur:"
          echo "$RESPONSE" | jq '.'
          
          # Vérifier si la requête a réussi
          if echo "$RESPONSE" | jq -e '.notificationsSent' > /dev/null; then
            SENT=$(echo "$RESPONSE" | jq -r '.notificationsSent')
            WEEK=$(echo "$RESPONSE" | jq -r '.week')
            echo "✅ $SENT notification(s) envoyée(s) pour la semaine $WEEK"
          else
            echo "⚠️ Aucune notification envoyée ou erreur"
          fi
      
      - name: 📝 Résumé
        if: always()
        run: |
          echo "### 📋 Résumé de l'exécution" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Date:** $(date)" >> $GITHUB_STEP_SUMMARY
          echo "- **Jour:** $(date +%A)" >> $GITHUB_STEP_SUMMARY
          echo "- **Heure:** $(date +%H:%M) UTC" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          
          if [ "${{ steps.check-day.outputs.day }}" -eq 1 ] || [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
            echo "✅ Alertes envoyées avec succès" >> $GITHUB_STEP_SUMMARY
          else
            echo "⏭️ Sauté (pas lundi)" >> $GITHUB_STEP_SUMMARY
          fi
```

---

## ✅ Vérification Post-Installation

Une fois le workflow ajouté:

1. **Vérifier que le fichier existe:**
   ```bash
   ls -la .github/workflows/weekly-reminders.yml
   ```

2. **Vérifier qu'il est sur GitHub:**
   - Allez sur votre repository
   - Naviguez vers `.github/workflows/`
   - Le fichier doit apparaître

3. **Vérifier le secret:**
   - GitHub → Settings → Secrets and variables → Actions
   - `CRON_API_KEY` doit être listé

4. **Tester manuellement:**
   - GitHub → Actions → Weekly Reminders
   - Run workflow → main → Run workflow
   - Attendez 30 secondes et vérifiez le résultat

---

## 🐛 Dépannage

### Le workflow n'apparaît pas dans Actions

**Solution:** Le fichier doit être sur la branche `main` (ou `master`) pour apparaître.

### Erreur "401 Unauthorized"

**Cause:** La clé `CRON_API_KEY` est incorrecte ou manquante.

**Solution:** 
1. Vérifiez que le secret GitHub est bien configuré
2. Vérifiez que la valeur est identique à celle dans Vercel

### Le workflow ne se déclenche pas automatiquement

**Cause:** Les workflows CRON GitHub Actions peuvent avoir jusqu'à 15 minutes de retard.

**Solution:** Patientez ou déclenchez manuellement pour tester.

---

## 📚 Ressources

- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Syntaxe CRON](https://crontab.guru/)
- [Configuration des secrets GitHub](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**Une fois configuré, le workflow s'exécutera automatiquement tous les lundis toutes les 3 heures! 🚀**
