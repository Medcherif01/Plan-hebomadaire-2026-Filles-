// api/index.js — v2, base de données migrée de MongoDB vers Supabase (MCP)

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const archiver = require('archiver');
const webpush = require('web-push');

// ========================================================================
// ====================== AIDES POUR GÉNÉRATION WORD ======================
// ========================================================================

const xmlEscape = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
};

const containsArabic = (text) => {
  if (typeof text !== 'string') return false;
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
};

const formatTextForWord = (text, options = {}) => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return '<w:p/>';
  }
  
  // Nettoyer le texte : supprimer les espaces/sauts de ligne avant et après
  const cleanedText = text.trim();
  
  const { color, italic } = options;
  const runPropertiesParts = [];
  runPropertiesParts.push('<w:sz w:val="22"/><w:szCs w:val="22"/>');
  if (color) runPropertiesParts.push(`<w:color w:val="${color}"/>`);
  if (italic) runPropertiesParts.push('<w:i/><w:iCs w:val="true"/>');

  let paragraphProperties = '';
  if (containsArabic(cleanedText)) {
    // Pour le texte arabe : RTL + centré
    paragraphProperties = '<w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr>';
    runPropertiesParts.push('<w:rtl/>');
  }

  const runProperties = `<w:rPr>${runPropertiesParts.join('')}</w:rPr>`;
  
  // Conserver uniquement les sauts de ligne intentionnels de l'enseignant
  const lines = cleanedText.split(/\r\n|\n|\r/);
  const content = lines
    .map(line => `<w:t xml:space="preserve">${xmlEscape(line)}</w:t>`)
    .join('<w:br/>');
  return `<w:p>${paragraphProperties}<w:r>${runProperties}${content}</w:r></w:p>`;
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());

const WORD_TEMPLATE_URL = process.env.WORD_TEMPLATE_URL;
const LESSON_TEMPLATE_URL = process.env.LESSON_TEMPLATE_URL;

// ========================================================================
// ====================== CONNEXION SUPABASE (MCP) ========================
// ========================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables d\'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquantes.');
  }
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        // Force le bypass RLS via la clé service_role
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  });
  console.log('✅ Client Supabase initialisé');
  return supabaseClient;
}

// Helper : lancer une erreur si Supabase retourne une erreur
function checkSupabaseError(error, context) {
  if (error) {
    console.error(`❌ Erreur Supabase [${context}]:`, error);
    throw new Error(`Supabase error [${context}]: ${error.message}`);
  }
}

// ========================================================================

// Configuration Web Push (VAPID)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BDuAoL4lagqZmYl4BPdCFYBwRhoqGMrcWUFAbF1pMBWq2e0JOV6fL_WitURlXXhXTROGB2vYpnvgSDZfAoZq0Jo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'TVK1zF6o5s-SK3OQnGCMgu4KZCNxg3py4YA4sMqtItg';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@plan-hebdomadaire.com';

// Configuration de web-push avec les clés VAPID
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push VAPID configuré');
} else {
  console.warn('⚠️ Clés VAPID manquantes - notifications push désactivées');
}

const arabicTeachers = ['Sara', 'Amal Najar', 'Emen', 'Fatima', 'Ghadah', 'Hana'];
const englishTeachers = ['Jana','Amal','Farah','Tayba','Nana'];

const specificWeekDateRangesNode = {
  1:{start:'2025-08-31',end:'2025-09-04'}, 2:{start:'2025-09-07',end:'2025-09-11'}, 3:{start:'2025-09-14',end:'2025-09-18'}, 4:{start:'2025-09-21',end:'2025-09-25'}, 5:{start:'2025-09-28',end:'2025-10-02'}, 6:{start:'2025-10-05',end:'2025-10-09'}, 7:{start:'2025-10-12',end:'2025-10-16'}, 8:{start:'2025-10-19',end:'2025-10-23'}, 9:{start:'2025-10-26',end:'2025-10-30'},10:{start:'2025-11-02',end:'2025-11-06'},
  11:{start:'2025-11-09',end:'2025-11-13'},12:{start:'2025-11-16',end:'2025-11-20'}, 13:{start:'2025-11-23',end:'2025-11-27'},14:{start:'2025-11-30',end:'2025-12-04'}, 15:{start:'2025-12-07',end:'2025-12-11'},16:{start:'2025-12-14',end:'2025-12-18'}, 17:{start:'2025-12-21',end:'2025-12-25'},18:{start:'2026-01-18',end:'2026-01-22'}, 19:{start:'2026-01-25',end:'2026-01-29'},20:{start:'2026-02-01',end:'2026-02-05'},
  21:{start:'2026-02-08',end:'2026-02-12'},22:{start:'2026-02-15',end:'2026-02-19'}, 23:{start:'2026-02-22',end:'2026-02-26'},24:{start:'2026-03-01',end:'2026-03-05'}, 25:{start:'2026-03-29',end:'2026-04-02'},26:{start:'2026-04-05',end:'2026-04-09'}, 27:{start:'2026-04-12',end:'2026-04-16'},28:{start:'2026-04-19',end:'2026-04-23'}, 29:{start:'2026-04-26',end:'2026-04-30'},30:{start:'2026-05-03',end:'2026-05-07'},
  31:{start:'2026-05-10',end:'2026-05-14'}
};

const validUsers = {
  "Mohamed": "Mohamed", "Zohra": "Zohra", "Jana": "Jana", "Aichetou": "Aichetou",
  "Amal": "Amal", "Amal Najar": "Amal Najar", "Ange": "Ange", "Anouar": "Anouar",
  "Emen": "Emen", "Farah": "Farah", "Fatima": "Fatima", "Ghadah": "Ghadah",
  "Hana": "Hana", "Samira": "Samira", "Tayba": "Tayba", "Nana": "Nana",
  "Sara": "Sara", "Souha": "Souha", "Inas": "Inas"
};

function formatDateFrenchNode(date) {
  if (!date || isNaN(date.getTime())) return "Date invalide";
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const dayName = days[date.getUTCDay()];
  const dayNum = String(date.getUTCDate()).padStart(2, '0');
  const monthName = months[date.getUTCMonth()];
  const yearNum = date.getUTCFullYear();
  return `${dayName} ${dayNum} ${monthName} ${yearNum}`;
}
function extractDayNameFromString(dayString) {
  if (!dayString || typeof dayString !== 'string') return null;
  const trimmed = dayString.trim();
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi"];
  
  // Check if it's already just a day name
  if (dayNames.includes(trimmed)) {
    return trimmed;
  }
  
  // Extract day name from formatted date (e.g., "Dimanche 07 Décembre 2025")
  for (const dayName of dayNames) {
    if (trimmed.startsWith(dayName)) {
      return dayName;
    }
  }
  
  return null;
}

function getDateForDayNameNode(weekStartDate, dayName) {
  if (!weekStartDate || isNaN(weekStartDate.getTime())) return null;
  const dayOrder = { "Dimanche": 0, "Lundi": 1, "Mardi": 2, "Mercredi": 3, "Jeudi": 4 };
  const offset = dayOrder[dayName];
  if (offset === undefined) return null;
  const specificDate = new Date(Date.UTC(
    weekStartDate.getUTCFullYear(),
    weekStartDate.getUTCMonth(),
    weekStartDate.getUTCDate()
  ));
  specificDate.setUTCDate(specificDate.getUTCDate() + offset);
  return specificDate;
}
const findKey = (obj, target) => obj ? Object.keys(obj).find(k => k.trim().toLowerCase() === target.toLowerCase()) : undefined;

// ======================= Fonction utilitaire pour les noms de fichiers ==
const sanitizeForFilename = (str) => {
  if (typeof str !== 'string') str = String(str);
  const normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .replace(/__+/g, '_');
};

// ======================= Sélection dynamique du modèle ==================

/**
 * Liste les modèles disponibles via l'API v1 et retourne le premier modèle
 * correspondant à la liste de préférence ET supportant generateContent.
 *
 * On gère les changements de noms (EoL des 1.5, arrivée des 2.5, etc.).
 */
async function resolveGeminiModel(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Impossible de lister les modèles (HTTP ${resp.status}) ${body}`);
  }
  const json = await resp.json();
  const models = Array.isArray(json.models) ? json.models : [];

  // Préférence (ordre décroissant) – ajuste si besoin selon tes coûts/perf
  const preferredNames = [
    // Généraux actuels
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    // Anciennes séries (si encore exposées pour ta clé)
    "gemini-1.5-flash-001",
    "gemini-1.5-pro-002",
    "gemini-1.5-flash"
  ];

  const nameSet = new Map(models.map(m => [m.name, m]));
  // Cherche d'abord dans les préférés
  for (const short of preferredNames) {
    const full = `models/${short}`;
    const m = nameSet.get(full);
    if (m && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")) {
      return short;
    }
  }
  // Sinon, prends le premier qui supporte generateContent
  const any = models.find(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"));
  if (any) return any.name.replace(/^models\//, "");

  throw new Error("Aucun modèle compatible v1 trouvé pour votre clé (generateContent). Vérifiez l'accès de la clé et l'API activée.");
}

// ------------------------- Web Push Subscriptions (/api/subscribe) -------------------------

app.post('/api/subscribe', async (req, res) => {
  try {
    const subscription = req.body.subscription;
    const username = req.body.username;
    if (!subscription || !username) {
      return res.status(400).json({ message: 'Subscription et username requis.' });
    }

    const supabase = getSupabase();
    // Upsert: utiliser l'endpoint comme identifiant unique
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        id: subscription.endpoint,
        subscription: subscription,
        username: username,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    checkSupabaseError(error, 'subscribe upsert');

    res.status(201).json({ message: 'Abonnement enregistré.' });
  } catch (error) {
    console.error('Erreur Supabase /subscribe:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/api/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body.endpoint;
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint requis.' });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', endpoint);
    checkSupabaseError(error, 'unsubscribe delete');

    res.status(200).json({ message: 'Abonnement supprimé.' });
  } catch (error) {
    console.error('Erreur Supabase /unsubscribe:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ------------------------- Rappels Automatiques (Cron) -------------------------

// Fonction utilitaire pour déterminer la semaine actuelle
function getCurrentWeekNumber() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const week in specificWeekDateRangesNode) {
    const dates = specificWeekDateRangesNode[week];
    const startDate = new Date(dates.start + 'T00:00:00Z');
    const endDate = new Date(dates.end + 'T00:00:00Z');
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    if (today >= startDate && today <= endDate) {
      return parseInt(week, 10);
    }
  }
  return null;
}

app.get('/api/send-reminders', async (req, res) => {
  try {
    const weekNumber = getCurrentWeekNumber();
    if (!weekNumber) {
      console.log('⚠️ Semaine actuelle non définie dans la configuration.');
      return res.status(200).json({ message: 'Semaine actuelle non définie.' });
    }

    const supabase = getSupabase();

    // Récupérer le plan de la semaine
    const { data: planRows, error: planError } = await supabase
      .from('plans')
      .select('data')
      .eq('week', weekNumber)
      .maybeSingle();
    checkSupabaseError(planError, 'send-reminders plans select');

    if (!planRows || !planRows.data || planRows.data.length === 0) {
      console.log(`⚠️ Aucun plan trouvé pour la semaine ${weekNumber}.`);
      return res.status(200).json({ message: `Aucun plan trouvé pour la semaine ${weekNumber}.` });
    }

    // Identifier les enseignants avec au moins une leçon vide
    const teachersToRemind = new Set();
    const leconKey = findKey(planRows.data[0] || {}, 'Leçon');

    if (leconKey) {
      planRows.data.forEach(row => {
        const enseignantKey = findKey(row, 'Enseignant');
        const enseignant = enseignantKey ? row[enseignantKey] : null;
        const lecon = row[leconKey];
        if (enseignant && (!lecon || lecon.trim() === '')) {
          teachersToRemind.add(enseignant);
        }
      });
    }

    if (teachersToRemind.size === 0) {
      console.log(`✅ Tous les plans de la semaine ${weekNumber} semblent complets.`);
      return res.status(200).json({ message: 'Tous les plans sont complets. Aucun rappel envoyé.' });
    }

    console.log(`🔔 Enseignants à rappeler pour S${weekNumber}:`, Array.from(teachersToRemind));

    // Récupérer les abonnements pour ces enseignants
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .in('username', Array.from(teachersToRemind));
    checkSupabaseError(subError, 'send-reminders subscriptions select');

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ Aucun abonnement push trouvé pour les enseignants à rappeler.');
      return res.status(200).json({ message: 'Aucun abonnement push trouvé.' });
    }

    // Envoyer les notifications
    const notificationPayload = JSON.stringify({
      title: 'Rappel Plan Hebdomadaire',
      body: `Veuillez compléter votre plan de leçon pour la semaine ${weekNumber}.`,
      icon: '/icons/icon-192x192.png',
      data: { url: '/', week: weekNumber }
    });

    const sendPromises = subscriptions.map(sub => {
      return webpush.sendNotification(sub.subscription, notificationPayload)
        .then(() => console.log(`Notification envoyée à ${sub.username}`))
        .catch(async (error) => {
          console.error(`Échec envoi notification à ${sub.username}:`, error);
          if (error.statusCode === 410) {
            await supabase.from('subscriptions').delete().eq('id', sub.id);
            console.log(`Abonnement expiré pour ${sub.username} supprimé.`);
          }
        });
    });

    await Promise.allSettled(sendPromises);

    res.status(200).json({ 
      message: `${sendPromises.length} rappels tentés.`,
      teachersReminded: Array.from(teachersToRemind)
    });

  } catch (error) {
    console.error('❌ Erreur serveur /send-reminders:', error);
    res.status(500).json({ message: 'Erreur interne /send-reminders.' });
  }
});

// ------------------------- Auth & CRUD simples -------------------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

app.post('/api/login', (req, res) => {
  try {
    console.log('[LOGIN] Requête reçue de:', req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    const { username, password } = req.body;
    console.log('[LOGIN] Tentative pour utilisateur:', username);
    
    if (!username || !password) {
      console.log('[LOGIN] Username ou password manquant');
      return res.status(400).json({ success: false, message: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    if (validUsers[username] && validUsers[username] === password) {
      console.log('[LOGIN] Authentification réussie pour:', username);
      res.status(200).json({ success: true, username: username });
    } else {
      console.log('[LOGIN] Échec authentification pour:', username);
      res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }
  } catch (error) {
    console.error('[LOGIN] CRASH in /api/login:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
});

app.get('/api/plans/:week', async (req, res) => {
  const weekNumber = parseInt(req.params.week, 10);
  if (isNaN(weekNumber)) return res.status(400).json({ message: 'Semaine invalide.' });
  try {
    const supabase = getSupabase();

    // Récupérer le plan principal
    const { data: planRow, error: planError } = await supabase
      .from('plans')
      .select('data, class_notes')
      .eq('week', weekNumber)
      .maybeSingle();
    checkSupabaseError(planError, 'plans select');

    if (planRow) {
      // Récupérer les IDs des plans de leçon disponibles pour cette semaine
      const { data: lessonPlansRows, error: lpError } = await supabase
        .from('lesson_plans')
        .select('id')
        .eq('week', weekNumber);
      checkSupabaseError(lpError, 'lesson_plans ids select');

      const availableLessonPlanIds = new Set((lessonPlansRows || []).map(lp => lp.id));

      // Récupérer les plans Word hebdomadaires disponibles
      const { data: weeklyPlansRows, error: wpError } = await supabase
        .from('weekly_lesson_plans')
        .select('classe')
        .eq('week', weekNumber);
      checkSupabaseError(wpError, 'weekly_lesson_plans classe select');

      const availableWeeklyPlans = (weeklyPlansRows || []).map(p => p.classe);

      console.log(`📋 Plans disponibles pour S${weekNumber}:`, Array.from(availableLessonPlanIds));

      const enrichedData = (planRow.data || []).map(row => {
        const enseignant = row[findKey(row, 'Enseignant')] || '';
        const classe = row[findKey(row, 'Classe')] || '';
        const matiere = row[findKey(row, 'Matière')] || '';
        const periode = row[findKey(row, 'Période')] || '';
        const jour = row[findKey(row, 'Jour')] || '';

        const potentialLessonPlanId = `${weekNumber}_${enseignant}_${classe}_${matiere}_${periode}_${jour}`.replace(/\s+/g, '_');

        if (availableLessonPlanIds.has(potentialLessonPlanId)) {
          console.log(`✅ lessonPlanId trouvé: ${potentialLessonPlanId}`);
          return { ...row, lessonPlanId: potentialLessonPlanId };
        } else {
          console.log(`⚠️ lessonPlanId non trouvé: ${potentialLessonPlanId}`);
        }
        return row;
      });

      res.status(200).json({ 
        planData: enrichedData, 
        classNotes: planRow.class_notes || {},
        availableWeeklyPlans: availableWeeklyPlans
      });
    } else {
      res.status(200).json({ planData: [], classNotes: {}, availableWeeklyPlans: [] });
    }
  } catch (error) {
    console.error('Erreur Supabase /plans/:week:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/api/save-plan', async (req, res) => {
  const weekNumber = parseInt(req.body.week, 10);
  const data = req.body.data;
  if (isNaN(weekNumber) || !Array.isArray(data)) return res.status(400).json({ message: 'Données invalides.' });
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('plans')
      .upsert({ week: weekNumber, data: data, updated_at: new Date().toISOString() }, { onConflict: 'week' });
    checkSupabaseError(error, 'save-plan upsert');

    res.status(200).json({ message: `Plan S${weekNumber} enregistré.` });
  } catch (error) {
    console.error('Erreur Supabase /save-plan:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/api/save-notes', async (req, res) => {
  const weekNumber = parseInt(req.body.week, 10);
  const { classe, notes } = req.body;
  if (isNaN(weekNumber) || !classe) return res.status(400).json({ message: 'Données invalides.' });
  try {
    const supabase = getSupabase();

    // Récupérer les notes actuelles
    const { data: existing, error: selectError } = await supabase
      .from('plans')
      .select('class_notes')
      .eq('week', weekNumber)
      .maybeSingle();
    checkSupabaseError(selectError, 'save-notes select');

    const currentNotes = (existing && existing.class_notes) ? existing.class_notes : {};
    currentNotes[classe] = notes;

    const { error } = await supabase
      .from('plans')
      .upsert({ week: weekNumber, class_notes: currentNotes, updated_at: new Date().toISOString() }, { onConflict: 'week' });
    checkSupabaseError(error, 'save-notes upsert');

    res.status(200).json({ message: 'Notes enregistrées.' });
  } catch (error) {
    console.error('Erreur Supabase /save-notes:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/api/save-row', async (req, res) => {
  const weekNumber = parseInt(req.body.week, 10);
  const rowData = req.body.data;
  if (isNaN(weekNumber) || typeof rowData !== 'object') return res.status(400).json({ message: 'Données invalides.' });
  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Récupérer le plan actuel
    const { data: existing, error: selectError } = await supabase
      .from('plans')
      .select('data')
      .eq('week', weekNumber)
      .maybeSingle();
    checkSupabaseError(selectError, 'save-row select');

    if (!existing) {
      return res.status(404).json({ message: 'Plan non trouvé.' });
    }

    const planData = existing.data || [];

    // Trouver et mettre à jour la ligne correspondante
    const enseignantVal = rowData[findKey(rowData, 'Enseignant')];
    const classeVal = rowData[findKey(rowData, 'Classe')];
    const jourVal = rowData[findKey(rowData, 'Jour')];
    const periodeVal = rowData[findKey(rowData, 'Période')];
    const matiereVal = rowData[findKey(rowData, 'Matière')];

    let modified = false;
    const updatedData = planData.map(item => {
      if (
        item[findKey(item, 'Enseignant')] === enseignantVal &&
        item[findKey(item, 'Classe')] === classeVal &&
        item[findKey(item, 'Jour')] === jourVal &&
        item[findKey(item, 'Période')] === periodeVal &&
        item[findKey(item, 'Matière')] === matiereVal
      ) {
        modified = true;
        return { ...item, ...rowData, updatedAt: now };
      }
      return item;
    });

    if (!modified) {
      return res.status(404).json({ message: 'Ligne non trouvée.' });
    }

    const { error: updateError } = await supabase
      .from('plans')
      .update({ data: updatedData, updated_at: now })
      .eq('week', weekNumber);
    checkSupabaseError(updateError, 'save-row update');

    res.status(200).json({ message: 'Ligne enregistrée.', updatedData: { updatedAt: now } });
  } catch (error) {
    console.error('Erreur Supabase /save-row:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Correction : récupérer toutes les classes distinctes depuis Supabase
app.get('/api/all-classes', async (req, res) => {
  try {
    const supabase = getSupabase();

    // Récupérer tous les plans et extraire les classes
    const { data: plans, error } = await supabase
      .from('plans')
      .select('data');
    checkSupabaseError(error, 'all-classes select');

    const classesSet = new Set();
    (plans || []).forEach(plan => {
      (plan.data || []).forEach(item => {
        const classeKey = findKey(item, 'Classe');
        if (classeKey && item[classeKey] && item[classeKey].trim() !== '') {
          classesSet.add(item[classeKey]);
        }
      });
    });

    res.status(200).json(Array.from(classesSet).sort());
  } catch (error) {
    console.error('Erreur Supabase /api/all-classes:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// --------------------- Génération Word (plan hebdo) ---------------------

app.post('/api/generate-word', async (req, res) => {
  try {
    const { week, classe, data, notes } = req.body;
    const weekNumber = Number(week);
    if (!Number.isInteger(weekNumber) || !classe || !Array.isArray(data)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }

    let templateBuffer;
    try {
      const response = await fetch(WORD_TEMPLATE_URL);
      if (!response.ok) throw new Error(`Échec modèle Word (${response.status})`);
      templateBuffer = Buffer.from(await response.arrayBuffer());
    } catch (e) {
      console.error("Erreur de récupération du modèle Word:", e);
      return res.status(500).json({ message: `Erreur récup modèle Word.` });
    }

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      nullGetter: () => "",
    });

    const groupedByDay = {};
    const dayOrder = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi"];
    const datesNode = specificWeekDateRangesNode[weekNumber];
    let weekStartDateNode = null;
    if (datesNode?.start) {
      weekStartDateNode = new Date(datesNode.start + 'T00:00:00Z');
    }
    if (!weekStartDateNode || isNaN(weekStartDateNode.getTime())) {
      return res.status(500).json({ message: `Dates serveur manquantes pour S${weekNumber}.` });
    }

    const sampleRow = data[0] || {};
    const jourKey = findKey(sampleRow, 'Jour'),
          periodeKey = findKey(sampleRow, 'Période'),
          matiereKey = findKey(sampleRow, 'Matière'),
          leconKey = findKey(sampleRow, 'Leçon'),
          travauxKey = findKey(sampleRow, 'Travaux de classe'),
          supportKey = findKey(sampleRow, 'Support'),
          devoirsKey = findKey(sampleRow, 'Devoirs');

    data.forEach(item => {
      const day = item[jourKey];
      if (day && dayOrder.includes(day)) {
        if (!groupedByDay[day]) groupedByDay[day] = [];
        groupedByDay[day].push(item);
      }
    });

    const joursData = dayOrder.map(dayName => {
      if (!groupedByDay[dayName]) return null;

      const dateOfDay = getDateForDayNameNode(weekStartDateNode, dayName);
      const formattedDate = dateOfDay ? formatDateFrenchNode(dateOfDay) : dayName;
      const sortedEntries = groupedByDay[dayName].sort((a, b) => (parseInt(a[periodeKey], 10) || 0) - (parseInt(b[periodeKey], 10) || 0));

      const matieres = sortedEntries.map(item => ({
        matiere: item[matiereKey] ?? "",
        Lecon: formatTextForWord(item[leconKey], { color: 'FF0000' }),
        travailDeClasse: formatTextForWord(item[travauxKey]),
        Support: formatTextForWord(item[supportKey], { color: 'FF0000', italic: true }),
        devoirs: formatTextForWord(item[devoirsKey], { color: '0000FF', italic: true })
      }));

      return { jourDateComplete: formattedDate, matieres: matieres };
    }).filter(Boolean);

    let plageSemaineText = `Semaine ${weekNumber}`;
    if (datesNode?.start && datesNode?.end) {
      const startD = new Date(datesNode.start + 'T00:00:00Z');
      const endD = new Date(datesNode.end + 'T00:00:00Z');
      if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
        plageSemaineText = `du ${formatDateFrenchNode(startD)} à ${formatDateFrenchNode(endD)}`;
      }
    }

    const templateData = {
      semaine: weekNumber,
      classe: classe,
      jours: joursData,
      notes: formatTextForWord(notes),
      plageSemaine: plageSemaineText
    };

    doc.render(templateData);

    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `Plan_hebdomadaire_S${weekNumber}_${classe.replace(/[^a-z0-9]/gi, '_')}.docx`;

    // Enregistrement du plan de leçon dans Supabase
    try {
      const supabase = getSupabase();
      const lessonPlanId = `S${weekNumber}_${classe.replace(/[^a-z0-9]/gi, '_')}`;
      
      const { error: upsertError } = await supabase
        .from('weekly_lesson_plans')
        .upsert({
          id: lessonPlanId,
          week: weekNumber,
          classe: classe,
          filename: filename,
          file_data: buf.toString('base64'),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (upsertError) {
        console.error(`❌ Erreur lors de l'enregistrement du plan de leçon dans Supabase:`, upsertError);
      } else {
        console.log(`✅ Plan de leçon ${lessonPlanId} enregistré dans Supabase.`);
      }
    } catch (dbError) {
      console.error(`❌ Erreur lors de l'enregistrement du plan de leçon dans Supabase:`, dbError);
      // On continue pour envoyer le fichier même en cas d'échec de l'enregistrement
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buf);

  } catch (error) {
    console.error('❌ Erreur serveur /generate-word:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur interne /generate-word.' });
    }
  }
});

// --------------------- Génération ZIP (Plans de Leçon Multiples) ---------------------

app.post('/api/generate-weekly-plans-zip', async (req, res) => {
  try {
    const { week, classes, data, notes } = req.body;
    const weekNumber = Number(week);
    if (!Number.isInteger(weekNumber) || !Array.isArray(classes) || !Array.isArray(data)) {
      return res.status(400).json({ message: 'Données invalides (semaine, classes ou data manquantes).' });
    }

    // Configuration du ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = `Plans_Hebdomadaires_S${weekNumber}_${classes.length}_Classes.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    archive.pipe(res);

    const dayOrder = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi"];
    const datesNode = specificWeekDateRangesNode[weekNumber];
    let weekStartDateNode = null;
    if (datesNode?.start) {
      weekStartDateNode = new Date(datesNode.start + 'T00:00:00Z');
    }
    if (!weekStartDateNode || isNaN(weekStartDateNode.getTime())) {
      archive.abort();
      return res.status(500).json({ message: `Dates serveur manquantes pour S${weekNumber}.` });
    }

    let templateBuffer;
    try {
      const response = await fetch(WORD_TEMPLATE_URL);
      if (!response.ok) throw new Error(`Échec modèle Word (${response.status})`);
      templateBuffer = Buffer.from(await response.arrayBuffer());
    } catch (e) {
      console.error("Erreur de récupération du modèle Word:", e);
      archive.abort();
      return res.status(500).json({ message: `Erreur récup modèle Word.` });
    }

    let plageSemaineText = `Semaine ${weekNumber}`;
    if (datesNode?.start && datesNode?.end) {
      const startD = new Date(datesNode.start + 'T00:00:00Z');
      const endD = new Date(datesNode.end + 'T00:00:00Z');
      if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
        plageSemaineText = `du ${formatDateFrenchNode(startD)} à ${formatDateFrenchNode(endD)}`;
      }
    }

    const sampleRow = data[0] || {};
    const jourKey = findKey(sampleRow, 'Jour'),
          periodeKey = findKey(sampleRow, 'Période'),
          matiereKey = findKey(sampleRow, 'Matière'),
          leconKey = findKey(sampleRow, 'Leçon'),
          travauxKey = findKey(sampleRow, 'Travaux de classe'),
          supportKey = findKey(sampleRow, 'Support'),
          devoirsKey = findKey(sampleRow, 'Devoirs');

    for (const classe of classes) {
      const classData = data.filter(item => item[findKey(item, 'Classe')] === classe);
      const classNotes = notes[classe] || '';

      if (classData.length === 0) {
        console.warn(`Aucune donnée trouvée pour la classe ${classe}. Sautée.`);
        continue;
      }

      const groupedByDay = {};
      classData.forEach(item => {
        const day = item[jourKey];
        if (day && dayOrder.includes(day)) {
          if (!groupedByDay[day]) groupedByDay[day] = [];
          groupedByDay[day].push(item);
        }
      });

      const joursData = dayOrder.map(dayName => {
        if (!groupedByDay[dayName]) return null;

        const dateOfDay = getDateForDayNameNode(weekStartDateNode, dayName);
        const formattedDate = dateOfDay ? formatDateFrenchNode(dateOfDay) : dayName;
        const sortedEntries = groupedByDay[dayName].sort((a, b) => (parseInt(a[periodeKey], 10) || 0) - (parseInt(b[periodeKey], 10) || 0));

        const matieres = sortedEntries.map(item => ({
          matiere: item[matiereKey] ?? "",
          Lecon: formatTextForWord(item[leconKey], { color: 'FF0000' }),
          travailDeClasse: formatTextForWord(item[travauxKey]),
          Support: formatTextForWord(item[supportKey], { color: 'FF0000', italic: true }),
          devoirs: formatTextForWord(item[devoirsKey], { color: '0000FF', italic: true })
        }));

        return { jourDateComplete: formattedDate, matieres: matieres };
      }).filter(Boolean);

      const templateData = {
        semaine: weekNumber,
        classe: classe,
        jours: joursData,
        notes: formatTextForWord(classNotes),
        plageSemaine: plageSemaineText
      };

      // Créer une nouvelle instance de Docxtemplater pour chaque classe
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        nullGetter: () => "",
      });

      doc.render(templateData);

      const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const docxFilename = `Plan_hebdomadaire_S${weekNumber}_${classe.replace(/[^a-z0-9]/gi, '_')}.docx`;

      // Enregistrement du plan de leçon dans Supabase
      try {
        const supabase = getSupabase();
        const lessonPlanId = `S${weekNumber}_${classe.replace(/[^a-z0-9]/gi, '_')}`;
        
        const { error: upsertError } = await supabase
          .from('weekly_lesson_plans')
          .upsert({
            id: lessonPlanId,
            week: weekNumber,
            classe: classe,
            filename: docxFilename,
            file_data: buf.toString('base64'),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error(`❌ Erreur lors de l'enregistrement du plan de leçon dans Supabase:`, upsertError);
        } else {
          console.log(`✅ Plan de leçon ${lessonPlanId} enregistré dans Supabase.`);
        }
      } catch (dbError) {
        console.error(`❌ Erreur lors de l'enregistrement du plan de leçon dans Supabase:`, dbError);
      }
      
      // Ajouter le DOCX au ZIP
      archive.append(buf, { name: docxFilename });
    }

    archive.finalize();

  } catch (error) {
    console.error('❌ Erreur serveur /generate-weekly-plans-zip:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur interne /generate-weekly-plans-zip.' });
    }
  }
});

// --------------------- Téléchargement Plan de Leçon (DOCX) ---------------------

app.get('/api/download-weekly-plan/:week/:classe', async (req, res) => {
  try {
    const weekNumber = Number(req.params.week);
    const classe = req.params.classe;
    if (!Number.isInteger(weekNumber) || !classe) {
      return res.status(400).json({ message: 'Semaine ou classe invalide.' });
    }

    const lessonPlanId = `S${weekNumber}_${classe.replace(/[^a-z0-9]/gi, '_')}`;
    const supabase = getSupabase();

    const { data: planDoc, error } = await supabase
      .from('weekly_lesson_plans')
      .select('filename, file_data')
      .eq('id', lessonPlanId)
      .maybeSingle();
    checkSupabaseError(error, 'download-weekly-plan select');

    if (!planDoc || !planDoc.file_data) {
      console.log(`⚠️ Plan de leçon non trouvé pour ${lessonPlanId}`);
      return res.status(404).json({ message: 'Plan de leçon non généré ou non trouvé.' });
    }

    console.log(`✅ Plan de leçon trouvé pour ${lessonPlanId}. Envoi du fichier.`);
    const fileBuffer = Buffer.from(planDoc.file_data, 'base64');
    res.setHeader('Content-Disposition', `attachment; filename="${planDoc.filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(fileBuffer);

  } catch (error) {
    console.error('❌ Erreur serveur /download-weekly-plan:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur interne /download-weekly-plan.' });
    }
  }
});

// --------------------- Génération Excel (workbook) ---------------------

app.post('/api/generate-excel-workbook', async (req, res) => {
  try {
    const weekNumber = Number(req.body.week);
    if (!Number.isInteger(weekNumber)) return res.status(400).json({ message: 'Semaine invalide.' });

    const supabase = getSupabase();
    const { data: planRow, error } = await supabase
      .from('plans')
      .select('data')
      .eq('week', weekNumber)
      .maybeSingle();
    checkSupabaseError(error, 'generate-excel-workbook select');

    if (!planRow?.data?.length) return res.status(404).json({ message: `Aucune donnée pour S${weekNumber}.` });

    const finalHeaders = [ 'Enseignant', 'Jour', 'Période', 'Classe', 'Matière', 'Leçon', 'Travaux de classe', 'Support', 'Devoirs' ];
    const formattedData = planRow.data.map(item => {
      const row = {};
      finalHeaders.forEach(header => {
        const itemKey = findKey(item, header);
        row[header] = itemKey ? item[itemKey] : '';
      });
      return row;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedData, { header: finalHeaders });
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 20 },
      { wch: 45 }, { wch: 45 }, { wch: 25 }, { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, `Plan S${weekNumber}`);

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const filename = `Plan_Hebdomadaire_S${weekNumber}_Complet.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Erreur serveur /generate-excel-workbook:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur interne Excel.' });
  }
});

// --------------- Rapport Excel par classe (toutes semaines) ------------

app.post('/api/full-report-by-class', async (req, res) => {
  try {
    const { classe: requestedClass } = req.body;
    if (!requestedClass) return res.status(400).json({ message: 'Classe requise.' });

    const supabase = getSupabase();
    const { data: allPlans, error } = await supabase
      .from('plans')
      .select('week, data')
      .order('week', { ascending: true });
    checkSupabaseError(error, 'full-report-by-class select');

    if (!allPlans || allPlans.length === 0) return res.status(404).json({ message: 'Aucune donnée.' });

    const dataBySubject = {};
    const monthsFrench = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    allPlans.forEach(plan => {
      const weekNumber = plan.week;
      let monthName = 'N/A';
      const weekDates = specificWeekDateRangesNode[weekNumber];
      if (weekDates?.start) {
        try {
          const startDate = new Date(weekDates.start + 'T00:00:00Z');
          monthName = monthsFrench[startDate.getUTCMonth()];
        } catch (e) {}
      }

      (plan.data || []).forEach(item => {
        const itemClassKey = findKey(item, 'classe');
        const itemSubjectKey = findKey(item, 'matière');
        if (itemClassKey && item[itemClassKey] === requestedClass && itemSubjectKey && item[itemSubjectKey]) {
          const subject = item[itemSubjectKey];
          if (!dataBySubject[subject]) dataBySubject[subject] = [];
          const row = {
            'Mois': monthName,
            'Semaine': weekNumber,
            'Période': item[findKey(item, 'période')] || '',
            'Leçon': item[findKey(item, 'leçon')] || '',
            'Travaux de classe': item[findKey(item, 'travaux de classe')] || '',
            'Support': item[findKey(item, 'support')] || '',
            'Devoirs': item[findKey(item, 'devoirs')] || ''
          };
          dataBySubject[subject].push(row);
        }
      });
    });

    const subjectsFound = Object.keys(dataBySubject);
    if (subjectsFound.length === 0) return res.status(404).json({ message: `Aucune donnée pour la classe '${requestedClass}'.` });

    const workbook = XLSX.utils.book_new();
    const headers = ['Mois', 'Semaine', 'Période', 'Leçon', 'Travaux de classe', 'Support', 'Devoirs'];

    subjectsFound.sort().forEach(subject => {
      const safeSheetName = subject.substring(0, 30).replace(/[*?:/\\\[\]]/g, '_');
      const worksheet = XLSX.utils.json_to_sheet(dataBySubject[subject], { header: headers });
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 40 }, { wch: 25 }, { wch: 40 }
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const filename = `Rapport_Complet_${requestedClass.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Erreur serveur /full-report-by-class:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur interne du rapport.' });
  }
});

// --------------------- Génération IA (REST, v1, modèle dynamique) ------

app.post('/api/generate-ai-lesson-plan', async (req, res) => {
  try {
    console.log('📝 [AI Lesson Plan] Nouvelle demande de génération');
    
    // Support GROQ API (prioritaire) avec fallback vers GEMINI
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const USE_GROQ = GROQ_API_KEY ? true : false;
    
    if (!GROQ_API_KEY && !GEMINI_API_KEY) {
      console.error('❌ [AI Lesson Plan] Aucune clé API (GROQ ou GEMINI) disponible');
      return res.status(503).json({ message: "Le service IA n'est pas initialisé. Vérifiez les clés API GROQ ou GEMINI du serveur." });
    }
    
    console.log(`🔧 [AI Lesson Plan] Provider IA: ${USE_GROQ ? 'GROQ (llama-3.3-70b)' : 'GEMINI'}`);
    const AI_API_KEY = USE_GROQ ? GROQ_API_KEY : GEMINI_API_KEY;

    const lessonTemplateUrl = process.env.LESSON_TEMPLATE_URL || LESSON_TEMPLATE_URL;
    if (!lessonTemplateUrl) {
      console.error('❌ [AI Lesson Plan] URL du template de leçon manquante');
      return res.status(503).json({ message: "L'URL du modèle de leçon Word n'est pas configurée." });
    }

    const { week, rowData } = req.body;
    if (!rowData || typeof rowData !== 'object' || !week) {
      console.error('❌ [AI Lesson Plan] Données invalides:', { week, hasRowData: !!rowData });
      return res.status(400).json({ message: "Les données de la ligne ou de la semaine sont manquantes." });
    }
    
    console.log(`✅ [AI Lesson Plan] Génération pour semaine ${week}`);

    // Charger le modèle Word
    let templateBuffer;
    try {
      const response = await fetch(lessonTemplateUrl);
      if (!response.ok) throw new Error(`Échec du téléchargement du modèle Word (${response.status})`);
      templateBuffer = Buffer.from(await response.arrayBuffer());
    } catch (e) {
      console.error("Erreur de récupération du modèle Word:", e);
      return res.status(500).json({ message: "Impossible de récupérer le modèle de leçon depuis l'URL fournie." });
    }

    // Extraire données
    const enseignant = rowData[findKey(rowData, 'Enseignant')] || '';
    const classe = rowData[findKey(rowData, 'Classe')] || '';
    const matiere = rowData[findKey(rowData, 'Matière')] || '';
    const lecon = rowData[findKey(rowData, 'Leçon')] || '';
    const jour = rowData[findKey(rowData, 'Jour')] || '';
    const seance = rowData[findKey(rowData, 'Période')] || '';
    const support = rowData[findKey(rowData, 'Support')] || 'Non spécifié';
    const travaux = rowData[findKey(rowData, 'Travaux de classe')] || 'Non spécifié';
    const devoirsPrevus = rowData[findKey(rowData, 'Devoirs')] || 'Non spécifié';
    
    console.log(`📚 [AI Lesson Plan] Données: ${enseignant} | ${classe} | ${matiere} | ${lecon}`);

    // Date formatée
    let formattedDate = "";
    const weekNumber = Number(week);
    const datesNode = specificWeekDateRangesNode[weekNumber];
    if (jour && datesNode?.start) {
      const weekStartDateNode = new Date(datesNode.start + 'T00:00:00Z');
      if (!isNaN(weekStartDateNode.getTime())) {
        const dayName = extractDayNameFromString(jour);
        if (dayName) {
          const dateOfDay = getDateForDayNameNode(weekStartDateNode, dayName);
          if (dateOfDay) formattedDate = formatDateFrenchNode(dateOfDay);
        }
      }
    }

    // Prompt + structure JSON
    const jsonStructure = `{"TitreUnite":"un titre d'unité pertinent pour la leçon","Methodes":"liste des méthodes d'enseignement","Outils":"liste des outils de travail","Objectifs":"une liste concise des objectifs d'apprentissage (compétences, connaissances), séparés par des sauts de ligne (\\\\n). Commence chaque objectif par un tiret (-).","etapes":[{"phase":"Introduction","duree":"5 min","activite":"Description de l'activité d'introduction pour l'enseignant et les élèves."},{"phase":"Activité Principale","duree":"25 min","activite":"Description de l'activité principale, en intégrant les 'travaux de classe' et le 'support' si possible."},{"phase":"Synthèse","duree":"10 min","activite":"Description de l'activité de conclusion et de vérification des acquis."},{"phase":"Clôture","duree":"5 min","activite":"Résumé rapide et annonce des devoirs."}],"Ressources":"les ressources spécifiques à utiliser.","Devoirs":"une suggestion de devoirs.","DiffLents":"une suggestion pour aider les apprenants en difficulté.","DiffTresPerf":"une suggestion pour stimuler les apprenants très performants.","DiffTous":"une suggestion de différenciation pour toute la classe."}`;

    let prompt;
    if (englishTeachers.includes(enseignant)) {
      prompt = `Return ONLY valid JSON. No markdown, no code fences, no commentary.

As an expert pedagogical assistant, create a detailed 45-minute lesson plan in English. Structure the lesson into timed phases and integrate the teacher's existing notes:
- Subject: ${matiere}, Class: ${classe}, Lesson Topic: ${lecon}
- Planned Classwork: ${travaux}
- Mentioned Support/Materials: ${support}
- Planned Homework: ${devoirsPrevus}

Use the following JSON structure with professional, concrete values in English (keys exactly as specified):
${jsonStructure}`;
    } else if (arabicTeachers.includes(enseignant)) {
      prompt = `أعد فقط JSON صالحًا. بدون Markdown أو أسوار كود أو تعليقات.

بصفتك مساعدًا تربويًا خبيرًا، أنشئ خطة درس مفصلة باللغة العربية مدتها 45 دقيقة. قم ببناء الدرس في مراحل محددة زمنياً وادمج ملاحظات المعلم:
- المادة: ${matiere}، الفصل: ${classe}، الموضوع: ${lecon}
- أعمال الصف المخطط لها: ${travaux}
- الدعم/المواد: ${support}
- الواجبات المخطط لها: ${devoirsPrevus}

استخدم البنية التالية بالقيم المهنية والملموسة (المفاتيح كما هي بالإنجليزية):
${jsonStructure}`;
    } else {
      prompt = `Renvoie UNIQUEMENT du JSON valide. Pas de markdown, pas de blocs de code, pas de commentaire.

En tant qu'assistant pédagogique expert, crée un plan de leçon détaillé de 45 minutes en français. Structure en phases chronométrées et intègre les notes de l'enseignant :
- Matière : ${matiere}, Classe : ${classe}, Thème : ${lecon}
- Travaux de classe : ${travaux}
- Support/Matériel : ${support}
- Devoirs prévus : ${devoirsPrevus}

Utilise la structure JSON suivante (valeurs concrètes et professionnelles ; clés strictement identiques) :
${jsonStructure}`;
    }

    // === Configuration de l'API selon le provider ===
    let API_URL, requestBody, aiResponse;
    
    if (USE_GROQ) {
      // GROQ API (quota plus généreux)
      console.log('🤖 [AI Lesson Plan] Utilisation de GROQ API avec llama-3.3-70b-versatile');
      API_URL = 'https://api.groq.com/openai/v1/chat/completions';
      requestBody = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
      };
      
      console.log('🔄 [AI Lesson Plan] Appel à l\'API GROQ...');
      aiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(requestBody),
      });
    } else {
      // GEMINI API (fallback)
      console.log('🤖 [AI Lesson Plan] Résolution du modèle Gemini...');
      const MODEL_NAME = await resolveGeminiModel(GEMINI_API_KEY);
      console.log(`🤖 [AI Lesson Plan] Modèle sélectionné: ${MODEL_NAME}`);
      
      API_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
      requestBody = {
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ]
      };
      
      console.log('🔄 [AI Lesson Plan] Appel à l\'API Gemini...');
      aiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    }

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.json().catch(() => ({}));
      console.error(`❌ [AI Lesson Plan] Erreur de l'API ${USE_GROQ ? 'GROQ' : 'GEMINI'}:`, JSON.stringify(errorBody, null, 2));
      
      // Message spécifique pour quota dépassé
      if (aiResponse.status === 429) {
        const provider = USE_GROQ ? 'GROQ' : 'GEMINI';
        throw new Error(`⚠️ QUOTA API ${provider} DÉPASSÉ : Limite gratuite atteinte. Veuillez réessayer plus tard. Détails : ${errorBody.error?.message || 'Quota dépassé'}`);
      }
      
      throw new Error(`[${aiResponse.status} ${aiResponse.statusText}] ${errorBody.error?.message || "Erreur inconnue de l'API."}`);
    }
    
    console.log(`✅ [AI Lesson Plan] Réponse reçue de ${USE_GROQ ? 'GROQ' : 'GEMINI'}`);

    const aiResult = await aiResponse.json();

    // Extraction robuste du texte JSON renvoyé
    let text = "";
    try {
      if (USE_GROQ) {
        // Format GROQ (OpenAI-compatible)
        text = aiResult?.choices?.[0]?.message?.content?.trim();
      } else {
        // Format GEMINI
        text = aiResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text && Array.isArray(aiResult?.candidates?.[0]?.content?.parts)) {
          text = aiResult.candidates[0].content.parts.map(p => p.text || "").join("").trim();
        }
        if (!text && aiResult?.candidates?.[0]?.output_text) {
          text = String(aiResult.candidates[0].output_text).trim();
        }
      }
    } catch (_) {}

    if (!text) {
      console.error("Réponse IA vide ou non reconnue:", JSON.stringify(aiResult, null, 2));
      return res.status(500).json({ message: "Réponse IA vide ou non reconnue." });
    }

    // Parse JSON avec petit nettoyage si Markdown accidentel
    let aiData;
    try {
      aiData = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/^```json\s*|\s*```$/g, '').trim();
      aiData = JSON.parse(cleaned);
    }

    // Préparer le DOCX
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });

    let minutageString = "";
    let contenuString = "";
    if (aiData.etapes && Array.isArray(aiData.etapes)) {
      minutageString = aiData.etapes.map(e => e.duree || "").join('\n');
      contenuString = aiData.etapes.map(e => `▶ ${e.phase || ""}:\n${e.activite || ""}`).join('\n\n');
    }

    const templateData = {
      ...aiData,
      Semaine: week,
      Lecon: lecon,
      Matiere: matiere,
      Classe: classe,
      Jour: jour,
      Seance: seance,
      NomEnseignant: enseignant,
      Date: formattedDate,
      Deroulement: minutageString,
      Contenu: contenuString,
    };

    doc.render(templateData);
    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    // Format: Matière_Classe_Semaine_Séance_Enseignant.docx
    const filename = `${sanitizeForFilename(matiere)}_${sanitizeForFilename(classe)}_S${weekNumber}_P${sanitizeForFilename(seance)}_${sanitizeForFilename(enseignant)}.docx`;
    console.log(`📄 [AI Lesson Plan] Envoi du fichier: ${filename}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buf);
    console.log('✅ [AI Lesson Plan] Génération terminée avec succès');

  } catch (error) {
    console.error('❌ Erreur serveur /generate-ai-lesson-plan:', error);
    if (!res.headersSent) {
      const errorMessage = error.message || "Erreur interne.";
      res.status(500).json({ message: `Erreur interne lors de la génération IA: ${errorMessage}` });
    }
  }
});

// Sauvegarder un plan de leçon généré dans Supabase
app.post('/api/save-lesson-plan', async (req, res) => {
  try {
    console.log('💾 [Save Lesson Plan] Sauvegarde d\'un plan de leçon');
    
    const { week, rowData, fileBuffer, filename } = req.body;
    
    if (!week || !rowData || !fileBuffer || !filename) {
      return res.status(400).json({ message: 'Données manquantes pour la sauvegarde.' });
    }
    
    const supabase = getSupabase();
    
    const enseignant = rowData[findKey(rowData, 'Enseignant')] || '';
    const classe = rowData[findKey(rowData, 'Classe')] || '';
    const matiere = rowData[findKey(rowData, 'Matière')] || '';
    const periode = rowData[findKey(rowData, 'Période')] || '';
    const jour = rowData[findKey(rowData, 'Jour')] || '';
    
    const lessonPlanId = `${week}_${enseignant}_${classe}_${matiere}_${periode}_${jour}`.replace(/\s+/g, '_');
    
    const { error } = await supabase
      .from('lesson_plans')
      .upsert({
        id: lessonPlanId,
        week: Number(week),
        enseignant,
        classe,
        matiere,
        periode,
        jour,
        filename,
        file_buffer: fileBuffer, // déjà en base64 depuis le frontend
        row_data: rowData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    checkSupabaseError(error, 'save-lesson-plan upsert');
    
    console.log(`✅ [Save Lesson Plan] Plan sauvegardé: ${lessonPlanId}`);
    res.status(200).json({ success: true, message: 'Plan de leçon sauvegardé.', lessonPlanId });
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde plan de leçon:', error);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde du plan de leçon.' });
  }
});

// ============================================================================
// NOUVELLE ROUTE: Génération multiple de plans de leçon IA en ZIP
// ============================================================================
app.post('/api/generate-multiple-ai-lesson-plans', async (req, res) => {
  try {
    console.log('📚 [Multiple AI Lesson Plans] Nouvelle demande de génération multiple');
    
    // Support GROQ API (prioritaire) avec fallback vers GEMINI
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const USE_GROQ = GROQ_API_KEY ? true : false;
    
    if (!GROQ_API_KEY && !GEMINI_API_KEY) {
      return res.status(503).json({ message: "Le service IA n'est pas initialisé. Vérifiez les clés API GROQ ou GEMINI." });
    }
    
    console.log(`🔧 [Multiple AI] Provider IA: ${USE_GROQ ? 'GROQ (llama-3.3-70b)' : 'GEMINI'}`);

    const lessonTemplateUrl = process.env.LESSON_TEMPLATE_URL || LESSON_TEMPLATE_URL;
    if (!lessonTemplateUrl) {
      return res.status(503).json({ message: "L'URL du modèle de leçon Word n'est pas configurée." });
    }

    const { week, rowsData } = req.body;
    if (!Array.isArray(rowsData) || rowsData.length === 0 || !week) {
      return res.status(400).json({ message: "Données invalides ou vides." });
    }

    console.log(`✅ [Multiple AI Lesson Plans] Génération de ${rowsData.length} plans pour semaine ${week}`);

    // ⚡ FILTRER LES LIGNES AVEC LEÇONS VIDES AVANT DE COMMENCER
    const validRows = [];
    const skippedRows = [];
    
    for (let i = 0; i < rowsData.length; i++) {
      const rowData = rowsData[i];
      const lecon = rowData[findKey(rowData, 'Leçon')] || '';
      const enseignant = rowData[findKey(rowData, 'Enseignant')] || '';
      const classe = rowData[findKey(rowData, 'Classe')] || '';
      const matiere = rowData[findKey(rowData, 'Matière')] || '';
      
      if (!lecon || lecon.trim() === '' || lecon.trim().length < 3) {
        console.log(`⏭️  [${i+1}/${rowsData.length}] IGNORÉ (leçon vide): ${enseignant} | ${classe} | ${matiere}`);
        skippedRows.push({ index: i+1, enseignant, classe, matiere, reason: 'Leçon vide' });
      } else {
        validRows.push({ index: i, rowData });
      }
    }
    
    console.log(`📊 [Multiple AI] ${validRows.length} lignes valides, ${skippedRows.length} ignorées`);
    
    if (validRows.length === 0) {
      return res.status(400).json({ 
        message: "Aucune ligne avec une leçon valide à générer.",
        skipped: skippedRows
      });
    }

    // Charger le modèle Word une seule fois
    let templateBuffer;
    try {
      const response = await fetch(lessonTemplateUrl);
      if (!response.ok) throw new Error(`Échec téléchargement modèle (${response.status})`);
      templateBuffer = Buffer.from(await response.arrayBuffer());
    } catch (e) {
      console.error("Erreur récupération modèle:", e);
      return res.status(500).json({ message: "Impossible de récupérer le modèle de leçon." });
    }

    // Configuration du ZIP
    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = `Plans_Lecon_IA_S${week}_${validRows.length}_fichiers.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    archive.pipe(res);

    const weekNumber = Number(week);
    const datesNode = specificWeekDateRangesNode[weekNumber];

    // Résoudre le modèle selon le provider
    let MODEL_NAME;
    if (!USE_GROQ) {
      MODEL_NAME = await resolveGeminiModel(GEMINI_API_KEY);
      console.log(`🤖 [Multiple AI] Modèle GEMINI: ${MODEL_NAME}`);
    }

    let successCount = 0;
    let errorCount = 0;
    
    // Si des lignes ont été ignorées, ajouter un fichier récapitulatif
    if (skippedRows.length > 0) {
      const skipContent = `⏭️  LIGNES IGNORÉES (LEÇONS VIDES)\n\nTotal: ${skippedRows.length} ligne(s)\n\n` +
        skippedRows.map(r => `${r.index}. ${r.enseignant} | ${r.classe} | ${r.matiere}\n   Raison: ${r.reason}`).join('\n\n');
      archive.append(Buffer.from(skipContent, 'utf-8'), { name: '00_LIGNES_IGNOREES.txt' });
    }

    // Générer chaque plan de leçon (uniquement les lignes valides)
    for (let i = 0; i < validRows.length; i++) {
      const { index: originalIndex, rowData } = validRows[i];
      
      try {
        // Extraire données
        const enseignant = rowData[findKey(rowData, 'Enseignant')] || '';
        const classe = rowData[findKey(rowData, 'Classe')] || '';
        const matiere = rowData[findKey(rowData, 'Matière')] || '';
        const lecon = rowData[findKey(rowData, 'Leçon')] || '';
        const jour = rowData[findKey(rowData, 'Jour')] || '';
        const seance = rowData[findKey(rowData, 'Période')] || '';
        const support = rowData[findKey(rowData, 'Support')] || 'Non spécifié';
        const travaux = rowData[findKey(rowData, 'Travaux de classe')] || 'Non spécifié';
        const devoirsPrevus = rowData[findKey(rowData, 'Devoirs')] || 'Non spécifié';

        console.log(`📝 [${i+1}/${validRows.length}] (Ligne originale #${originalIndex+1}) ${enseignant} | ${classe} | ${matiere}`);
        console.log(`  ├─ Leçon: "${lecon.substring(0, 50)}${lecon.length > 50 ? '...' : ''}"`);
        console.log(`  ├─ Travaux: "${travaux.substring(0, 30)}${travaux.length > 30 ? '...' : ''}"`);
        console.log(`  └─ Support: "${support.substring(0, 30)}${support.length > 30 ? '...' : ''}"`);
        
        if (!lecon || lecon.trim() === '') {
          throw new Error('⚠️ Leçon vide - impossible de générer un plan de leçon sans contenu de leçon');
        }

        // Date formatée
        let formattedDate = "";
        if (jour && datesNode?.start) {
          const weekStartDateNode = new Date(datesNode.start + 'T00:00:00Z');
          if (!isNaN(weekStartDateNode.getTime())) {
            const dayName = extractDayNameFromString(jour);
            if (dayName) {
              const dateOfDay = getDateForDayNameNode(weekStartDateNode, dayName);
              if (dateOfDay) formattedDate = formatDateFrenchNode(dateOfDay);
            }
          }
        }

        // Prompt selon la langue de l'enseignant
        const jsonStructure = `{"TitreUnite":"un titre d'unité pertinent pour la leçon","Methodes":"liste des méthodes d'enseignement","Outils":"liste des outils de travail","Objectifs":"une liste concise des objectifs d'apprentissage (compétences, connaissances), séparés par des sauts de ligne (\\\\n). Commence chaque objectif par un tiret (-).","etapes":[{"phase":"Introduction","duree":"5 min","activite":"Description de l'activité d'introduction pour l'enseignant et les élèves."},{"phase":"Activité Principale","duree":"25 min","activite":"Description de l'activité principale, en intégrant les 'travaux de classe' et le 'support' si possible."},{"phase":"Synthèse","duree":"10 min","activite":"Description de l'activité de conclusion et de vérification des acquis."},{"phase":"Clôture","duree":"5 min","activite":"Résumé rapide et annonce des devoirs."}],"Ressources":"les ressources spécifiques à utiliser.","Devoirs":"une suggestion de devoirs.","DiffLents":"une suggestion pour aider les apprenants en difficulté.","DiffTresPerf":"une suggestion pour stimuler les apprenants très performants.","DiffTous":"une suggestion de différenciation pour toute la classe."}`;

        let prompt;
        if (englishTeachers.includes(enseignant)) {
          prompt = `Return ONLY valid JSON. No markdown, no code fences, no commentary.\n\nAs an expert pedagogical assistant, create a detailed 45-minute lesson plan in English. Structure the lesson into timed phases and integrate the teacher's existing notes:\n- Subject: ${matiere}, Class: ${classe}, Lesson Topic: ${lecon}\n- Planned Classwork: ${travaux}\n- Mentioned Support/Materials: ${support}\n- Planned Homework: ${devoirsPrevus}\n\nUse the following JSON structure with professional, concrete values in English (keys exactly as specified):\n${jsonStructure}`;
        } else if (arabicTeachers.includes(enseignant)) {
          prompt = `أعد فقط JSON صالحًا. بدون Markdown أو أسوار كود أو تعليقات.\n\nبصفتك مساعدًا تربويًا خبيرًا، أنشئ خطة درس مفصلة باللغة العربية مدتها 45 دقيقة. قم ببناء الدرس في مراحل محددة زمنياً وادمج ملاحظات المعلم:\n- المادة: ${matiere}، الفصل: ${classe}، الموضوع: ${lecon}\n- أعمال الصف المخطط لها: ${travaux}\n- الدعم/المواد: ${support}\n- الواجبات المخطط لها: ${devoirsPrevus}\n\nاستخدم البنية التالية بالقيم المهنية والملموسة (المفاتيح كما هي بالإنجليزية):\n${jsonStructure}`;
        } else {
          prompt = `Renvoie UNIQUEMENT du JSON valide. Pas de markdown, pas de blocs de code, pas de commentaire.\n\nEn tant qu'assistant pédagogique expert, crée un plan de leçon détaillé de 45 minutes en français. Structure en phases chronométrées et intègre les notes de l'enseignant :\n- Matière : ${matiere}, Classe : ${classe}, Thème : ${lecon}\n- Travaux de classe : ${travaux}\n- Support/Matériel : ${support}\n- Devoirs prévus : ${devoirsPrevus}\n\nUtilise la structure JSON suivante (valeurs concrètes et professionnelles ; clés strictement identiques) :\n${jsonStructure}`;
        }

        // Appel API selon le provider avec RETRY automatique
        let aiResponse, aiResult, rawContent;
        let retryCount = 0;
        const MAX_RETRIES = 3;
        
        while (retryCount <= MAX_RETRIES) {
          try {
            if (USE_GROQ) {
              // GROQ API
              const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
              aiResponse = await fetch(API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                  model: 'llama-3.3-70b-versatile',
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.7,
                  max_tokens: 2048
                })
              });
              
              if (!aiResponse.ok) {
                const errorBody = await aiResponse.json().catch(() => ({}));
                
                if (aiResponse.status === 429 && retryCount < MAX_RETRIES) {
                  const waitTime = Math.pow(2, retryCount) * 5000;
                  console.log(`⏳ [GROQ] Rate limit atteint, attente ${waitTime/1000}s avant retry ${retryCount+1}/${MAX_RETRIES}`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  retryCount++;
                  continue;
                }
                
                console.error(`❌ [GROQ Error] Status ${aiResponse.status}:`, JSON.stringify(errorBody, null, 2));
                throw new Error(`API GROQ error ${aiResponse.status}: ${errorBody.error?.message || JSON.stringify(errorBody)}`);
              }
              
              aiResult = await aiResponse.json();
              rawContent = aiResult?.choices?.[0]?.message?.content || "";
              
              if (!rawContent) {
                console.error('❌ [GROQ] Réponse vide:', JSON.stringify(aiResult, null, 2));
                throw new Error('GROQ a retourné une réponse vide');
              }
              
              break;
              
            } else {
              // GEMINI API
              const API_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
              aiResponse = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: prompt }] }]
                })
              });
              
              if (!aiResponse.ok) {
                const errorBody = await aiResponse.json().catch(() => ({}));
                
                if (aiResponse.status === 429 && retryCount < MAX_RETRIES) {
                  const waitTime = Math.pow(2, retryCount) * 5000;
                  console.log(`⏳ [GEMINI] Quota dépassé, attente ${waitTime/1000}s avant retry ${retryCount+1}/${MAX_RETRIES}`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  retryCount++;
                  continue;
                }
                
                console.error(`❌ [GEMINI Error] Status ${aiResponse.status}:`, JSON.stringify(errorBody, null, 2));
                
                if (aiResponse.status === 429) {
                  throw new Error(`⚠️ QUOTA GEMINI DÉPASSÉ (429): ${errorBody.error?.message || 'Limite atteinte'}`);
                }
                
                throw new Error(`API GEMINI error ${aiResponse.status}: ${errorBody.error?.message || JSON.stringify(errorBody)}`);
              }
              
              aiResult = await aiResponse.json();
              rawContent = aiResult?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              
              if (!rawContent) {
                console.error('❌ [GEMINI] Réponse vide:', JSON.stringify(aiResult, null, 2));
                throw new Error('GEMINI a retourné une réponse vide');
              }
              
              break;
            }
          } catch (fetchError) {
            if (retryCount < MAX_RETRIES) {
              const waitTime = Math.pow(2, retryCount) * 3000;
              console.log(`⏳ Erreur réseau, attente ${waitTime/1000}s avant retry ${retryCount+1}/${MAX_RETRIES}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retryCount++;
              continue;
            }
            throw fetchError;
          }
        }
        
        // Parser JSON
        let jsonData;
        try {
          const cleanedJson = rawContent.replace(/```json\n?|```\n?/g, '').trim();
          
          if (!cleanedJson) {
            throw new Error('Contenu JSON vide après nettoyage');
          }
          
          jsonData = JSON.parse(cleanedJson);
          
          if (!jsonData.TitreUnite && !jsonData.Objectifs && !jsonData.etapes) {
            throw new Error('Structure JSON invalide : champs essentiels manquants');
          }
        } catch (parseError) {
          console.error(`❌ Erreur parsing JSON pour ${classe} ${matiere}:`);
          console.error(`  - Message: ${parseError.message}`);
          console.error(`  - Contenu brut (100 premiers chars): ${rawContent.substring(0, 100)}`);
          throw new Error(`Format JSON invalide: ${parseError.message}`);
        }

        // Générer le document Word
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, nullGetter: () => "" });

        const minutageString = (jsonData.etapes || []).map(e =>
          `${e.phase || ""} (${e.duree || ""}):\n${e.activite || ""}`
        ).join('\n\n');

        const templateData = {
          TitreUnite: jsonData.TitreUnite || "",
          Methodes: jsonData.Methodes || "",
          Outils: jsonData.Outils || "",
          Objectifs: jsonData.Objectifs || "",
          Ressources: jsonData.Ressources || "",
          Devoirs: jsonData.Devoirs || "",
          DiffLents: jsonData.DiffLents || "",
          DiffTresPerf: jsonData.DiffTresPerf || "",
          DiffTous: jsonData.DiffTous || "",
          Classe: classe,
          Matiere: matiere,
          Lecon: lecon,
          Seance: seance,
          NomEnseignant: enseignant,
          Date: formattedDate,
          Deroulement: minutageString,
          Contenu: minutageString,
          Minutage: minutageString,
        };

        doc.render(templateData);
        const docBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        const docFilename = `${sanitizeForFilename(matiere)}_${sanitizeForFilename(classe)}_S${weekNumber}_P${sanitizeForFilename(seance)}_${sanitizeForFilename(enseignant)}.docx`;
        
        archive.append(docBuffer, { name: docFilename });
        successCount++;
        
        console.log(`✅ [${i+1}/${validRows.length}] Généré: ${docFilename}`);

        // Délai adaptatif pour éviter rate limit
        if (i < validRows.length - 1) {
          let delay = 3000;
          if (i >= 20) delay = 8000;
          else if (i >= 10) delay = 5000;
          
          console.log(`⏳ Pause de ${delay/1000}s avant la prochaine génération...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        const classe = rowData[findKey(rowData, 'Classe')] || 'Unknown';
        const matiere = rowData[findKey(rowData, 'Matière')] || 'Unknown';
        const enseignant = rowData[findKey(rowData, 'Enseignant')] || 'Unknown';
        const lecon = rowData[findKey(rowData, 'Leçon')] || 'VIDE';
        
        console.error(`❌ Erreur pour ligne ${i+1}:`, {
          error: error.message,
          stack: error.stack,
          classe,
          matiere,
          enseignant,
          lecon: lecon.substring(0, 50)
        });
        errorCount++;
        
        const errorFilename = `ERREUR_${String(i+1).padStart(2, '0')}_${sanitizeForFilename(classe)}_${sanitizeForFilename(matiere)}.txt`;
        const errorContent = `❌ ERREUR DE GÉNÉRATION - PLAN DE LEÇON IA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 INFORMATIONS DE LA LIGNE
  Ligne valide    : ${i+1}/${validRows.length}
  Ligne originale : ${originalIndex+1}/${rowsData.length}
  
👤 ENSEIGNANT     : ${enseignant}
📚 CLASSE         : ${classe}
📖 MATIÈRE        : ${matiere}

📝 LEÇON (premiers 300 caractères) :
${lecon.substring(0, 300)}${lecon.length > 300 ? '...' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ERREUR DÉTECTÉE :
${error.message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 STACK TRACE COMPLET :
${error.stack}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 DONNÉES COMPLÈTES DE LA LIGNE :
${JSON.stringify(rowData, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 SOLUTIONS POSSIBLES :
1. Vérifier que la clé API (GROQ ou GEMINI) est valide
2. Vérifier que le quota API n'est pas dépassé
3. Vérifier que la leçon contient suffisamment d'information
4. Réessayer la génération plus tard si c'est un problème de quota
5. Contacter le support si l'erreur persiste

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: ${new Date().toISOString()}
Provider IA: ${USE_GROQ ? 'GROQ (llama-3.3-70b-versatile)' : 'GEMINI'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        archive.append(Buffer.from(errorContent, 'utf-8'), { name: errorFilename });
      }
    }

    console.log(`📊 [Multiple AI] Résultat: ${successCount} succès, ${errorCount} erreurs`);
    
    const summaryContent = `📊 RÉCAPITULATIF DE GÉNÉRATION - PLANS DE LEÇON IA
    
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date de génération : ${new Date().toLocaleString('fr-FR')}
📦 Semaine            : ${week}
🔧 Provider IA        : ${USE_GROQ ? 'GROQ (llama-3.3-70b-versatile)' : 'GEMINI (' + (MODEL_NAME || 'N/A') + ')'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 STATISTIQUES :
  Lignes totales reçues  : ${rowsData.length}
  Lignes valides         : ${validRows.length}
  Lignes ignorées        : ${skippedRows.length} (leçons vides)
  
  ✅ Succès              : ${successCount}
  ❌ Erreurs             : ${errorCount}
  
  📊 Taux de réussite    : ${validRows.length > 0 ? Math.round((successCount / validRows.length) * 100) : 0}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorCount > 0 ? `⚠️  ATTENTION : ${errorCount} erreur(s) détectée(s)
Consultez les fichiers ERREUR_XX_*.txt pour plus de détails.

💡 CAUSES POSSIBLES DES ERREURS :
- Quota API dépassé (429)
- Problème de connexion réseau
- Format de réponse invalide de l'IA
- Données de leçon insuffisantes

🔑 SOLUTION : Configurer GROQ_API_KEY sur Vercel
GROQ offre un quota gratuit plus généreux que GEMINI.
Instructions : Voir README.md du projet
` : '🎉 Toutes les générations ont réussi !'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 CONTENU DU ZIP :
${skippedRows.length > 0 ? `  - 00_LIGNES_IGNOREES.txt (${skippedRows.length} lignes)\n` : ''}  - ${successCount} fichier(s) .docx (plans générés)
${errorCount > 0 ? `  - ${errorCount} fichier(s) ERREUR_*.txt (détails des erreurs)\n` : ''}  - 99_RECAPITULATIF.txt (ce fichier)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Généré par le système de gestion des plans hebdomadaires
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    archive.append(Buffer.from(summaryContent, 'utf-8'), { name: '99_RECAPITULATIF.txt' });
    
    archive.finalize();

  } catch (error) {
    console.error('❌ Erreur serveur /generate-multiple-ai-lesson-plans:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: `Erreur interne: ${error.message}` });
    }
  }
});

// Télécharger un plan de leçon depuis Supabase
app.get('/api/download-lesson-plan/:lessonPlanId', async (req, res) => {
  try {
    const { lessonPlanId } = req.params;
    console.log(`📥 [Download Lesson Plan] Téléchargement: ${lessonPlanId}`);
    
    const supabase = getSupabase();
    const { data: lessonPlan, error } = await supabase
      .from('lesson_plans')
      .select('filename, file_buffer')
      .eq('id', lessonPlanId)
      .maybeSingle();
    checkSupabaseError(error, 'download-lesson-plan select');
    
    if (!lessonPlan) {
      return res.status(404).json({ message: 'Plan de leçon introuvable.' });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${lessonPlan.filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(Buffer.from(lessonPlan.file_buffer, 'base64'));
    
    console.log(`✅ [Download Lesson Plan] Envoyé: ${lessonPlan.filename}`);
    
  } catch (error) {
    console.error('❌ Erreur téléchargement plan de leçon:', error);
    res.status(500).json({ message: 'Erreur lors du téléchargement du plan de leçon.' });
  }
});

// Obtenir la liste des plans de leçon pour une semaine spécifique
app.get('/api/lesson-plans/:week', async (req, res) => {
  try {
    const week = parseInt(req.params.week, 10);
    if (isNaN(week)) {
      return res.status(400).json({ message: 'Numéro de semaine invalide.' });
    }
    
    console.log(`📋 [Lesson Plans List] Récupération pour semaine ${week}`);
    
    const supabase = getSupabase();
    const { data: lessonPlans, error } = await supabase
      .from('lesson_plans')
      .select('id, week, enseignant, classe, matiere, periode, jour, filename, row_data, updated_at')
      .eq('week', week);
    checkSupabaseError(error, 'lesson-plans list select');
    
    console.log(`✅ [Lesson Plans List] ${(lessonPlans || []).length} plan(s) trouvé(s)`);
    res.status(200).json(lessonPlans || []);
    
  } catch (error) {
    console.error('❌ Erreur récupération liste plans de leçon:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des plans de leçon.' });
  }
});

// --------------------- Test de Rappels Forcé (Semaine 17) ---------------------

app.post('/api/test-weekly-reminders', async (req, res) => {
  try {
    const { apiKey, weekNumber } = req.body;
    const targetWeek = weekNumber || 17;
    
    const CRON_API_KEY = process.env.CRON_API_KEY || 'default-cron-key-change-me';
    if (apiKey !== CRON_API_KEY) {
      return res.status(401).json({ message: 'Non autorisé. Clé API invalide.' });
    }

    console.log(`🧪 [Test Reminders] Test forcé pour la semaine ${targetWeek}`);

    const supabase = getSupabase();
    const { data: planRow, error: planError } = await supabase
      .from('plans')
      .select('data')
      .eq('week', targetWeek)
      .maybeSingle();
    checkSupabaseError(planError, 'test-weekly-reminders plans select');
    
    if (!planRow || !planRow.data || planRow.data.length === 0) {
      return res.status(200).json({ 
        message: `Aucune donnée pour la semaine ${targetWeek}.`,
        week: targetWeek
      });
    }

    const incompleteTeachers = {};
    const planData = planRow.data;
    
    planData.forEach(item => {
      const teacher = item[findKey(item, 'Enseignant')];
      const taskVal = item[findKey(item, 'Travaux de classe')];
      const className = item[findKey(item, 'Classe')];
      
      if (teacher && className && (taskVal == null || String(taskVal).trim() === '')) {
        if (!incompleteTeachers[teacher]) {
          incompleteTeachers[teacher] = new Set();
        }
        incompleteTeachers[teacher].add(className);
      }
    });

    const teachersToNotify = Object.keys(incompleteTeachers);
    console.log(`📊 [Test Reminders] ${teachersToNotify.length} enseignants incomplets:`, teachersToNotify);

    if (teachersToNotify.length === 0) {
      return res.status(200).json({ 
        message: 'Tous les enseignants ont complété leurs plans.',
        week: targetWeek
      });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');
    checkSupabaseError(subError, 'test-weekly-reminders push_subscriptions select');
    
    let notificationsSent = 0;
    const notificationResults = [];

    for (const teacher of teachersToNotify) {
      const subscription = (subscriptions || []).find(sub => sub.username === teacher);
      
      if (subscription && subscription.subscription) {
        const classes = [...incompleteTeachers[teacher]].sort().join(', ');
        const lang = getTeacherLanguage(teacher);
        const msgs = notificationMessages[lang];
        
        const message = {
          title: msgs.reminderTitle,
          body: msgs.reminderBody(teacher, targetWeek),
          icon: '/logo.png',
          badge: '/logo.png',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          tag: `plan-reminder-${targetWeek}-${Date.now()}`,
          renotify: true,
          data: {
            url: 'https://plan-hebdomadaire-2026-boys.vercel.app',
            week: targetWeek,
            teacher: teacher,
            classes: classes,
            lang: lang,
            playSound: true,
            timestamp: new Date().toISOString()
          }
        };

        try {
          const payload = JSON.stringify(message);
          await webpush.sendNotification(subscription.subscription, payload);
          
          notificationResults.push({
            teacher: teacher,
            classes: classes,
            language: lang,
            status: 'sent'
          });
          
          notificationsSent++;
          console.log(`✅ [Test Reminders] Notification envoyée à ${teacher} (${lang})`);
        } catch (error) {
          console.error(`❌ [Test Reminders] Erreur notification pour ${teacher}:`, error);
          notificationResults.push({
            teacher: teacher,
            status: 'error',
            error: error.message
          });
          
          if (error.statusCode === 410) {
            console.log(`🗑️ Suppression de l'abonnement invalide pour ${teacher}`);
            await supabase.from('push_subscriptions').delete().eq('username', teacher);
          }
        }
      } else {
        console.log(`ℹ️ [Test Reminders] ${teacher} n'a pas d'abonnement push`);
        notificationResults.push({
          teacher: teacher,
          status: 'no_subscription'
        });
      }
    }

    res.status(200).json({
      message: `Test de rappel forcé terminé pour la semaine ${targetWeek}.`,
      week: targetWeek,
      incompleteCount: teachersToNotify.length,
      notificationsSent: notificationsSent,
      results: notificationResults
    });

  } catch (error) {
    console.error('❌ [Test Reminders] Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur serveur.',
      error: error.message 
    });
  }
});

// --------------------- Système de Notifications Push ---------------------

// Cache local des abonnements push
const pushSubscriptions = new Map();

// Sauvegarder un abonnement push
app.post('/api/subscribe-push', async (req, res) => {
  try {
    const { username, subscription } = req.body;
    if (!username || !subscription) {
      return res.status(400).json({ message: 'Username et subscription requis.' });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        username: username,
        subscription: subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: 'username' });
    checkSupabaseError(error, 'subscribe-push upsert');

    // Cache local
    pushSubscriptions.set(username, subscription);
    
    console.log(`✅ Abonnement push sauvegardé pour ${username}`);
    res.status(200).json({ message: 'Abonnement enregistré avec succès.' });
  } catch (error) {
    console.error('Erreur /subscribe-push:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Désabonner des notifications
app.post('/api/unsubscribe-push', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'Username requis.' });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('username', username);
    checkSupabaseError(error, 'unsubscribe-push delete');

    pushSubscriptions.delete(username);
    
    console.log(`✅ Désabonnement push pour ${username}`);
    res.status(200).json({ message: 'Désabonnement réussi.' });
  } catch (error) {
    console.error('Erreur /unsubscribe-push:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Messages multilingues pour les notifications
const notificationMessages = {
  fr: {
    title: '⚠️ Plan Hebdomadaire Incomplet',
    body: (teacher, week, classes) => `Bonjour ${teacher}, votre plan pour la semaine ${week} est incomplet pour: ${classes}. Veuillez le compléter.`,
    reminderTitle: '📋 Rappel: Finaliser le Plan Hebdomadaire',
    reminderBody: (teacher, week) => `Bonjour ${teacher}, n'oubliez pas de finaliser votre plan pour la semaine ${week}.`
  },
  ar: {
    title: '⚠️ الخطة الأسبوعية غير مكتملة',
    body: (teacher, week, classes) => `مرحباً ${teacher}، خطتك للأسبوع ${week} غير مكتملة للفصول: ${classes}. يرجى إكمالها.`,
    reminderTitle: '📋 تذكير: أكمل الخطة الأسبوعية',
    reminderBody: (teacher, week) => `مرحباً ${teacher}، لا تنسى إكمال خطتك للأسبوع ${week}.`
  },
  en: {
    title: '⚠️ Incomplete Weekly Plan',
    body: (teacher, week, classes) => `Hello ${teacher}, your plan for week ${week} is incomplete for: ${classes}. Please complete it.`,
    reminderTitle: '📋 Reminder: Finalize Weekly Plan',
    reminderBody: (teacher, week) => `Hello ${teacher}, don't forget to finalize your plan for week ${week}.`
  }
};

// Déterminer la langue d'un enseignant
function getTeacherLanguage(teacher) {
  if (arabicTeachers.includes(teacher)) return 'ar';
  if (englishTeachers.includes(teacher)) return 'en';
  return 'fr';
}

// Vérifier les enseignants incomplets et envoyer des notifications
app.post('/api/check-incomplete-and-notify', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (apiKey !== process.env.CRON_API_KEY) {
      return res.status(401).json({ message: 'Non autorisé.' });
    }

    const currentDate = new Date();
    let currentWeek = null;
    
    for (const [week, dates] of Object.entries(specificWeekDateRangesNode)) {
      const startDate = new Date(dates.start + 'T00:00:00Z');
      const endDate = new Date(dates.end + 'T23:59:59Z');
      
      if (currentDate >= startDate && currentDate <= endDate) {
        currentWeek = parseInt(week, 10);
        break;
      }
    }

    if (!currentWeek) {
      return res.status(200).json({ message: 'Aucune semaine active actuellement.' });
    }

    console.log(`📅 Vérification des plans incomplets pour la semaine ${currentWeek}`);

    const supabase = getSupabase();
    const { data: planRow, error: planError } = await supabase
      .from('plans')
      .select('data')
      .eq('week', currentWeek)
      .maybeSingle();
    checkSupabaseError(planError, 'check-incomplete plans select');
    
    if (!planRow || !planRow.data || planRow.data.length === 0) {
      return res.status(200).json({ message: `Aucune donnée pour la semaine ${currentWeek}.` });
    }

    const incompleteTeachers = {};
    const planData = planRow.data;
    
    planData.forEach(item => {
      const teacher = item[findKey(item, 'Enseignant')];
      const taskVal = item[findKey(item, 'Travaux de classe')];
      const className = item[findKey(item, 'Classe')];
      
      if (teacher && className && (taskVal == null || String(taskVal).trim() === '')) {
        if (!incompleteTeachers[teacher]) {
          incompleteTeachers[teacher] = new Set();
        }
        incompleteTeachers[teacher].add(className);
      }
    });

    const teachersToNotify = Object.keys(incompleteTeachers);
    console.log(`📊 ${teachersToNotify.length} enseignants avec plans incomplets:`, teachersToNotify);

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');
    checkSupabaseError(subError, 'check-incomplete push_subscriptions select');
    
    let notificationsSent = 0;
    const notificationResults = [];

    for (const teacher of teachersToNotify) {
      const subscription = (subscriptions || []).find(sub => sub.username === teacher);
      
      if (subscription && subscription.subscription) {
        const classes = [...incompleteTeachers[teacher]].sort().join(', ');
        const lang = getTeacherLanguage(teacher);
        const msgs = notificationMessages[lang];
        
        const message = {
          title: msgs.title,
          body: msgs.body(teacher, currentWeek, classes),
          icon: '/logo.png',
          badge: '/logo.png',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          tag: `plan-reminder-${currentWeek}`,
          data: {
            url: 'https://plan-hebdomadaire-2026-boys.vercel.app',
            week: currentWeek,
            teacher: teacher,
            classes: classes,
            lang: lang,
            playSound: true
          }
        };

        try {
          const payload = JSON.stringify(message);
          await webpush.sendNotification(subscription.subscription, payload);
          
          notificationResults.push({
            teacher: teacher,
            classes: classes,
            language: lang,
            status: 'sent',
            message: message
          });
          
          notificationsSent++;
          console.log(`✅ Notification envoyée à ${teacher} (${lang}) pour ${classes}`);
        } catch (error) {
          console.error(`❌ Erreur notification pour ${teacher}:`, error);
          notificationResults.push({
            teacher: teacher,
            status: 'error',
            error: error.message
          });
          
          if (error.statusCode === 410) {
            console.log(`🗑️ Suppression de l'abonnement invalide pour ${teacher}`);
            await supabase.from('push_subscriptions').delete().eq('username', teacher);
          }
        }
      } else {
        console.log(`ℹ️ ${teacher} n'a pas d'abonnement push`);
        notificationResults.push({
          teacher: teacher,
          status: 'no_subscription'
        });
      }
    }

    res.status(200).json({
      message: `Vérification terminée pour la semaine ${currentWeek}.`,
      week: currentWeek,
      incompleteCount: teachersToNotify.length,
      notificationsSent: notificationsSent,
      results: notificationResults
    });

  } catch (error) {
    console.error('❌ Erreur /check-incomplete-and-notify:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Endpoint pour tester les notifications manuellement
app.post('/api/test-notification', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username requis.' });
    }

    const supabase = getSupabase();
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('username', username)
      .maybeSingle();
    checkSupabaseError(error, 'test-notification select');
    
    if (!subscription) {
      return res.status(404).json({ message: `Aucun abonnement trouvé pour ${username}.` });
    }

    console.log(`🧪 Test de notification pour ${username}`);
    
    const testMessage = {
      title: '🧪 Test de Notification',
      body: `Bonjour ${username}, ceci est un test de notification push. Si vous voyez ce message, les notifications fonctionnent correctement !`,
      icon: '/logo.png',
      data: {
        url: 'https://plan-hebdomadaire-2026-boys.vercel.app',
        teacher: username
      }
    };

    try {
      const payload = JSON.stringify(testMessage);
      await webpush.sendNotification(subscription.subscription, payload);
      
      res.status(200).json({ 
        message: 'Notification de test envoyée avec succès.',
        username: username,
        hasSubscription: true
      });
    } catch (pushError) {
      console.error('❌ Erreur envoi notification test:', pushError);
      
      if (pushError.statusCode === 410) {
        console.log(`🗑️ Suppression de l'abonnement invalide pour ${username}`);
        await supabase.from('push_subscriptions').delete().eq('username', username);
      }
      
      throw new Error(`Échec d'envoi: ${pushError.message}`);
    }

  } catch (error) {
    console.error('❌ Erreur /test-notification:', error);
    res.status(500).json({ 
      message: 'Erreur serveur.',
      error: error.message 
    });
  }
});

// Endpoint pour obtenir la clé publique VAPID (nécessaire pour le frontend)
app.get('/api/vapid-public-key', (req, res) => {
  res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
});

// ✅ FONCTIONNALITÉ 3: Système d'alertes automatiques hebdomadaires
app.post('/api/send-weekly-reminders', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    const CRON_API_KEY = process.env.CRON_API_KEY || 'default-cron-key-change-me';
    if (apiKey !== CRON_API_KEY) {
      return res.status(401).json({ message: 'Non autorisé. Clé API invalide.' });
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    console.log(`📅 [Weekly Reminders] Vérification: ${now.toISOString()} - Jour: ${dayOfWeek}, Heure: ${hourOfDay}`);

    if (dayOfWeek < 1 || dayOfWeek > 4) {
      return res.status(200).json({ 
        message: 'Alerte désactivée (hors période Lundi-Jeudi).',
        day: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayOfWeek],
        timestamp: now.toISOString()
      });
    }

    let currentWeek = null;
    
    for (const [week, dates] of Object.entries(specificWeekDateRangesNode)) {
      const startDate = new Date(dates.start + 'T00:00:00Z');
      const endDate = new Date(dates.end + 'T23:59:59Z');
      
      if (now >= startDate && now <= endDate) {
        currentWeek = parseInt(week, 10);
        break;
      }
    }

    if (!currentWeek) {
      return res.status(200).json({ message: 'Aucune semaine active actuellement.' });
    }

    console.log(`📅 [Weekly Reminders] Semaine active: ${currentWeek}`);

    const supabase = getSupabase();
    const { data: planRow, error: planError } = await supabase
      .from('plans')
      .select('data')
      .eq('week', currentWeek)
      .maybeSingle();
    checkSupabaseError(planError, 'send-weekly-reminders plans select');
    
    if (!planRow || !planRow.data || planRow.data.length === 0) {
      return res.status(200).json({ 
        message: `Aucune donnée pour la semaine ${currentWeek}.`,
        week: currentWeek
      });
    }

    const incompleteTeachers = {};
    const planData = planRow.data;
    
    planData.forEach(item => {
      const teacher = item[findKey(item, 'Enseignant')];
      const taskVal = item[findKey(item, 'Travaux de classe')];
      const className = item[findKey(item, 'Classe')];
      
      if (teacher && className && (taskVal == null || String(taskVal).trim() === '')) {
        if (!incompleteTeachers[teacher]) {
          incompleteTeachers[teacher] = new Set();
        }
        incompleteTeachers[teacher].add(className);
      }
    });

    const teachersToNotify = Object.keys(incompleteTeachers);
    console.log(`📊 [Weekly Reminders] ${teachersToNotify.length} enseignants incomplets:`, teachersToNotify);

    if (teachersToNotify.length === 0) {
      return res.status(200).json({ 
        message: 'Tous les enseignants ont complété leurs plans.',
        week: currentWeek,
        timestamp: now.toISOString()
      });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');
    checkSupabaseError(subError, 'send-weekly-reminders push_subscriptions select');
    
    let notificationsSent = 0;
    const notificationResults = [];

    for (const teacher of teachersToNotify) {
      const subscription = (subscriptions || []).find(sub => sub.username === teacher);
      
      if (subscription && subscription.subscription) {
        const classes = [...incompleteTeachers[teacher]].sort().join(', ');
        const lang = getTeacherLanguage(teacher);
        const msgs = notificationMessages[lang];
        
        const message = {
          title: msgs.reminderTitle,
          body: msgs.reminderBody(teacher, currentWeek),
          icon: '/logo.png',
          badge: '/logo.png',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          tag: `plan-reminder-${currentWeek}-${Date.now()}`,
          renotify: true,
          data: {
            url: 'https://plan-hebdomadaire-2026-boys.vercel.app',
            week: currentWeek,
            teacher: teacher,
            classes: classes,
            lang: lang,
            playSound: true,
            timestamp: now.toISOString()
          }
        };

        try {
          const payload = JSON.stringify(message);
          await webpush.sendNotification(subscription.subscription, payload);
          
          notificationResults.push({
            teacher: teacher,
            classes: classes,
            language: lang,
            status: 'sent',
            timestamp: now.toISOString()
          });
          
          notificationsSent++;
          console.log(`✅ [Weekly Reminders] Notification envoyée à ${teacher} (${lang})`);
        } catch (error) {
          console.error(`❌ [Weekly Reminders] Erreur notification pour ${teacher}:`, error);
          notificationResults.push({
            teacher: teacher,
            status: 'error',
            error: error.message
          });
          
          if (error.statusCode === 410) {
            console.log(`🗑️ Suppression de l'abonnement invalide pour ${teacher}`);
            await supabase.from('push_subscriptions').delete().eq('username', teacher);
          }
        }
      } else {
        console.log(`ℹ️ [Weekly Reminders] ${teacher} n'a pas d'abonnement push`);
        notificationResults.push({
          teacher: teacher,
          status: 'no_subscription'
        });
      }
    }

    res.status(200).json({
      message: `Rappels hebdomadaires envoyés pour la semaine ${currentWeek}.`,
      week: currentWeek,
      day: 'Lundi',
      hour: hourOfDay,
      incompleteCount: teachersToNotify.length,
      notificationsSent: notificationsSent,
      timestamp: now.toISOString(),
      results: notificationResults
    });

  } catch (error) {
    console.error('❌ [Weekly Reminders] Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur serveur.',
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;

// ============================================================================
// NOUVELLE ROUTE: Notification en temps réel pour enseignants incomplets
// ============================================================================
app.post('/api/notify-incomplete-teachers', async (req, res) => {
  try {
    const { week, incompleteTeachers } = req.body;
    
    if (!week || !incompleteTeachers || typeof incompleteTeachers !== 'object') {
      return res.status(400).json({ message: 'Paramètres invalides.' });
    }

    const supabase = getSupabase();
    const teachersToNotify = Object.keys(incompleteTeachers);
    
    if (teachersToNotify.length === 0) {
      return res.status(200).json({ 
        message: 'Aucun enseignant incomplet.',
        notificationsSent: 0 
      });
    }

    console.log(`🔔 Notification en temps réel pour ${teachersToNotify.length} enseignants incomplets`);

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');
    checkSupabaseError(subError, 'notify-incomplete-teachers push_subscriptions select');
    
    let notificationsSent = 0;
    const notificationResults = [];

    for (const teacher of teachersToNotify) {
      const subscription = (subscriptions || []).find(sub => sub.username === teacher);
      
      if (subscription && subscription.subscription) {
        const classes = Array.isArray(incompleteTeachers[teacher]) 
          ? incompleteTeachers[teacher].join(', ')
          : incompleteTeachers[teacher];
        
        const lang = getTeacherLanguage(teacher);
        const msgs = notificationMessages[lang];
        
        const message = {
          title: msgs.title,
          body: msgs.body(teacher, week, classes),
          icon: '/logo.png',
          badge: '/logo.png',
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          tag: `plan-alert-${week}-${Date.now()}`,
          data: {
            url: 'https://plan-hebdomadaire-2026-boys.vercel.app',
            week: week,
            teacher: teacher,
            classes: classes,
            lang: lang,
            playSound: true
          }
        };

        try {
          const payload = JSON.stringify(message);
          await webpush.sendNotification(subscription.subscription, payload);
          
          notificationResults.push({
            teacher: teacher,
            classes: classes,
            language: lang,
            status: 'sent'
          });
          
          notificationsSent++;
          console.log(`✅ Notification envoyée à ${teacher} (${lang})`);
        } catch (error) {
          console.error(`❌ Erreur notification pour ${teacher}:`, error);
          notificationResults.push({
            teacher: teacher,
            status: 'error',
            error: error.message
          });
          
          if (error.statusCode === 410) {
            console.log(`🗑️ Suppression abonnement invalide pour ${teacher}`);
            await supabase.from('push_subscriptions').delete().eq('username', teacher);
          }
        }
      } else {
        console.log(`⚠️ Pas d'abonnement push pour ${teacher}`);
        notificationResults.push({
          teacher: teacher,
          status: 'no_subscription'
        });
      }
    }

    res.status(200).json({
      message: `Notifications envoyées: ${notificationsSent}/${teachersToNotify.length}`,
      notificationsSent: notificationsSent,
      totalIncomplete: teachersToNotify.length,
      results: notificationResults
    });

  } catch (error) {
    console.error('❌ Erreur /notify-incomplete-teachers:', error);
    res.status(500).json({ 
      message: 'Erreur serveur.',
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
