// api/index.js — v2, remplacement de Gemini par Groq pour un quota gratuit plus élevé

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
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

const MONGO_URL = process.env.MONGO_URL;
const WORD_TEMPLATE_URL = process.env.WORD_TEMPLATE_URL;
const LESSON_TEMPLATE_URL = process.env.LESSON_TEMPLATE_URL;

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
const englishTeachers = ['Jana','Amal','Farah','Tayba','Shanoja'];

const specificWeekDateRangesNode = {
  1:{start:'2025-08-31',end:'2025-09-04'}, 2:{start:'2025-09-07',end:'2025-09-11'}, 3:{start:'2025-09-14',end:'2025-09-18'}, 4:{start:'2025-09-21',end:'2025-09-25'}, 5:{start:'2025-09-28',end:'2025-10-02'}, 6:{start:'2025-10-05',end:'2025-10-09'}, 7:{start:'2025-10-12',end:'2025-10-16'}, 8:{start:'2025-10-19',end:'2025-10-23'}, 9:{start:'2025-10-26',end:'2025-10-30'},10:{start:'2025-11-02',end:'2025-11-06'},
  11:{start:'2025-11-09',end:'2025-11-13'},12:{start:'2025-11-16',end:'2025-11-20'}, 13:{start:'2025-11-23',end:'2025-11-27'},14:{start:'2025-11-30',end:'2025-12-04'}, 15:{start:'2025-12-07',end:'2025-12-11'},16:{start:'2025-12-14',end:'2025-12-18'}, 17:{start:'2025-12-21',end:'2025-12-25'},18:{start:'2026-01-18',end:'2026-01-22'}, 19:{start:'2026-01-25',end:'2026-01-29'},20:{start:'2026-02-01',end:'2026-02-05'},
  21:{start:'2026-02-08',end:'2026-02-12'},22:{start:'2026-02-15',end:'2026-02-19'}, 23:{start:'2026-02-22',end:'2026-02-26'},24:{start:'2026-03-01',end:'2026-03-05'}, 25:{start:'2026-03-29',end:'2026-04-02'},26:{start:'2026-04-05',end:'2026-04-09'}, 27:{start:'2026-04-12',end:'2026-04-16'},28:{start:'2026-04-19',end:'2026-04-23'}, 29:{start:'2026-04-26',end:'2026-04-30'},30:{start:'2026-05-03',end:'2026-05-07'},
  31:{start:'2026-05-10',end:'2026-05-14'}
};

const validUsers = {
  "Mohamed": "Alkawthar@1207", "Zohra": "Alkawthar@1207", "Jana": "Alkawthar@1207", "Aichetou": "Alkawthar@1207",
  "Amal": "Alkawthar@1207", "Amal Najar": "Alkawthar@1207", "Ange": "Alkawthar@1207", "Anouar": "Alkawthar@1207",
  "Emen": "Alkawthar@1207", "Farah": "Alkawthar@1207", "Fatima": "Alkawthar@1207", "Ghadah": "Alkawthar@1207",
  "Hana": "Alkawthar@1207", "Samira": "Alkawthar@1207", "Tayba": "Alkawthar@1207", "Shanoja": "Alkawthar@1207",
  "Sara": "Alkawthar@1207", "Souha": "Alkawthar@1207", "Inas": "Alkawthar@1207"
};

let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();
  cachedDb = db;
  return db;
}

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

// ======================= Sélection dynamique du modèle Groq ==================

async function resolveGroqModel() {
  // On utilise un modèle performant et gratuit sur Groq
  // llama-3.3-70b-versatile est excellent pour le raisonnement pédagogique
  return "llama-3.3-70b-versatile";
}

// ------------------------- Web Push Subscriptions -------------------------

app.post('/api/subscribe', async (req, res) => {
  try {
    const subscription = req.body.subscription;
    const username = req.body.username;
    if (!subscription || !username) {
      return res.status(400).json({ message: 'Subscription et username requis.' });
    }

    const db = await connectToDatabase();
    // Utiliser l'endpoint comme _id pour garantir l'unicité de l'abonnement
    await db.collection('subscriptions').updateOne(
      { _id: subscription.endpoint },
      { $set: { subscription: subscription, username: username, createdAt: new Date() } },
      { upsert: true }
    );

    res.status(201).json({ message: 'Abonnement enregistré.' });
  } catch (error) {
    console.error('Erreur MongoDB /subscribe:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/api/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body.endpoint;
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint requis.' });
    }

    const db = await connectToDatabase();
    await db.collection('subscriptions').deleteOne({ _id: endpoint });

    res.status(200).json({ message: 'Abonnement supprimé.' });
  } catch (error) {
    console.error('Erreur MongoDB /unsubscribe:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ------------------------- AI Lesson Plans (Groq) -------------------------

app.post('/api/generate-multiple-ai-lesson-plans', async (req, res) => {
  try {
    console.log('📚 [Multiple AI Lesson Plans] Nouvelle demande de génération multiple via Groq');
    
    const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(503).json({ message: "Le service IA n'est pas initialisé (Clé API manquante)." });
    }

    const lessonTemplateUrl = process.env.LESSON_TEMPLATE_URL || LESSON_TEMPLATE_URL;
    if (!lessonTemplateUrl) {
      return res.status(503).json({ message: "L'URL du modèle de leçon Word n'est pas configurée." });
    }

    const { week, rowsData } = req.body;
    if (!Array.isArray(rowsData) || rowsData.length === 0 || !week) {
      return res.status(400).json({ message: "Données invalides ou vides." });
    }

    console.log(`✅ [Multiple AI Lesson Plans] Génération de ${rowsData.length} plans pour semaine ${week}`);

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
    const filename = `Plans_Lecon_IA_S${week}_${rowsData.length}_fichiers.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    archive.pipe(res);

    const weekNumber = Number(week);
    const datesNode = specificWeekDateRangesNode[weekNumber];

    // Résoudre le modèle Groq
    const MODEL_NAME = await resolveGroqModel();
    console.log(`🤖 [Multiple AI] Modèle Groq: ${MODEL_NAME}`);

    let successCount = 0;
    let errorCount = 0;

    // Générer chaque plan de leçon
    for (let i = 0; i < rowsData.length; i++) {
      const rowData = rowsData[i];
      
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

        console.log(`📝 [${i+1}/${rowsData.length}] ${enseignant} | ${classe} | ${matiere}`);
        
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
          prompt = `أعد فقط JSON صالحًا. بدون Markdown أو أسوار كود أو تعليقات.\n\nبصفتك مساعدًا تربويًا خبيرًا، أنشئ خطة درس مفصلة باللغة العربية مدتها 45 دقيقة. قم ببناء الدرس في مراحل محددة زمنياً وادمج ملاحظات المعلم:\n- المادة: ${matiere}، الفصل: ${classe}، الموضوع: ${lecon}\n- أعمال الصف المخطط لها: ${travaux} \n- الدعم/المواد: ${support}\n- الواجبات المخطط لها: ${devoirsPrevus}\n\nاستخدم البنية التالية بالقيم المهنية والملموسة (المفاتيح كما هي بالإنجليزية):\n${jsonStructure}`;
        } else {
          prompt = `Renvoie UNIQUEMENT du JSON valide. Pas de markdown, pas de blocs de code, pas de commentaire.\n\nEn tant qu'assistant pédagogique expert, crée un plan de leçon détaillé de 45 minutes en français. Structure en phases chronométrées et intègre les notes de l'enseignant :\n- Matière : ${matiere}, Classe : ${classe}, Thème : ${lecon}\n- Travaux de classe : ${travaux}\n- Support/Matériel : ${support}\n- Devoirs prévus : ${devoirsPrevus}\n\nUtilise la structure JSON suivante (valeurs concrètes et professionnelles ; clés strictement identiques) :\n${jsonStructure}`;
        }

        // Appel API Groq (Format OpenAI)
        const API_URL = `https://api.groq.com/openai/v1/chat/completions`;
        const aiResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
              { role: "system", content: "You are a pedagogical assistant that outputs only valid JSON." },
              { role: "user", content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          throw new Error(`API Groq error: ${aiResponse.status} - ${errorBody}`);
        }

        const aiResult = await aiResponse.json();
        const rawContent = aiResult?.choices?.[0]?.message?.content || "";
        
        // Parser JSON
        let jsonData;
        try {
          jsonData = JSON.parse(rawContent);
        } catch (parseError) {
          console.error(`Erreur parsing JSON pour ${classe} ${matiere}:`, parseError);
          throw new Error("Format JSON invalide de l'IA");
        }

        // Générer le document Word
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, nullGetter: () => "" });

        // Formatter les données pour le template
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
        
        console.log(`✅ [${i+1}/${rowsData.length}] Généré: ${docFilename}`);

        // Groq est très rapide, mais on garde un petit délai de courtoisie
        if (i < rowsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        const classe = rowData[findKey(rowData, 'Classe')] || 'Unknown';
        const matiere = rowData[findKey(rowData, 'Matière')] || 'Unknown';
        const enseignant = rowData[findKey(rowData, 'Enseignant')] || 'Unknown';
        const lecon = rowData[findKey(rowData, 'Leçon')] || 'VIDE';
        
        console.error(`❌ Erreur pour ligne ${i+1}:`, error.message);
        errorCount++;
        
        const errorFilename = `ERREUR_${i+1}_${sanitizeForFilename(classe)}_${sanitizeForFilename(matiere)}.txt`;
        const errorContent = `❌ ERREUR DE GÉNÉRATION\n\nLigne: ${i+1}/${rowsData.length}\nClasse: ${classe}\nMatière: ${matiere}\nEnseignant: ${enseignant}\nErreur: ${error.message}`;
        archive.append(errorContent, { name: errorFilename });
      }
    }

    console.log(`📊 [Multiple AI] Résultat: ${successCount} succès, ${errorCount} erreurs`);
    archive.finalize();

  } catch (error) {
    console.error('❌ Erreur serveur /generate-multiple-ai-lesson-plans:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: `Erreur interne: ${error.message}` });
    }
  }
});

// ------------------------- Autres routes (inchangées) -------------------------

app.get('/api/get-plan/:week', async (req, res) => {
  try {
    const week = req.params.week;
    const db = await connectToDatabase();
    const plan = await db.collection('weeklyPlans').findOne({ week: week });
    if (!plan) return res.status(404).json({ message: 'Plan non trouvé.' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/api/save-plan', async (req, res) => {
  try {
    const { week, data, lastModifiedBy } = req.body;
    const db = await connectToDatabase();
    await db.collection('weeklyPlans').updateOne(
      { week: week },
      { $set: { data: data, lastModified: new Date(), lastModifiedBy: lastModifiedBy } },
      { upsert: true }
    );
    res.json({ message: 'Plan sauvegardé.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.get('/api/available-weekly-plans/:week', async (req, res) => {
  try {
    const week = req.params.week;
    const db = await connectToDatabase();
    const plans = await db.collection('generatedWeeklyPlans').find({ week: week }).toArray();
    const classes = plans.map(p => p.classe);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.get('/api/download-weekly-plan/:week/:classe', async (req, res) => {
  try {
    const { week, classe } = req.params;
    const db = await connectToDatabase();
    const plan = await db.collection('generatedWeeklyPlans').findOne({ week: week, classe: classe });
    
    if (!plan) return res.status(404).json({ message: 'Plan non trouvé.' });
    
    const buffer = Buffer.from(plan.fileData.buffer, 'base64');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Plan_hebdomadaire_S${week}_${classe}.docx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Route pour les notifications automatiques (Cron)
app.get('/api/cron/weekly-reminders', async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Dimanche, 1=Lundi...
    const hourOfDay = now.getUTCHours() + 3; // UTC+3 pour l'Arabie Saoudite
    
    console.log(`⏰ [Weekly Reminders] Exécution Cron: Jour=${dayOfWeek}, Heure=${hourOfDay}`);

    // Déterminer la semaine actuelle (logique simplifiée)
    const currentWeek = "18"; // À automatiser si besoin

    const db = await connectToDatabase();
    const planDocument = await db.collection('weeklyPlans').findOne({ week: currentWeek });

    if (!planDocument || !planDocument.data || planDocument.data.length === 0) {
      return res.status(200).json({ message: `Aucune donnée pour la semaine ${currentWeek}.` });
    }

    const incompleteTeachers = {};
    planDocument.data.forEach(item => {
      const teacher = item[findKey(item, 'Enseignant')];
      const taskVal = item[findKey(item, 'Travaux de classe')];
      const className = item[findKey(item, 'Classe')];
      if (teacher && className && (taskVal == null || String(taskVal).trim() === '')) {
        if (!incompleteTeachers[teacher]) incompleteTeachers[teacher] = new Set();
        incompleteTeachers[teacher].add(className);
      }
    });

    const teachersToNotify = Object.keys(incompleteTeachers);
    if (teachersToNotify.length === 0) {
      return res.status(200).json({ message: 'Tous les plans sont complets.' });
    }

    const subscriptions = await db.collection('pushSubscriptions').find({}).toArray();
    let sent = 0;

    for (const teacher of teachersToNotify) {
      const sub = subscriptions.find(s => s.username === teacher);
      if (sub && sub.subscription) {
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify({
            title: "Rappel Plan Hebdomadaire",
            body: `Bonjour ${teacher}, n'oubliez pas de compléter vos plans pour la semaine ${currentWeek}.`,
            data: { url: 'https://plan-hebdomadaire-2026-filles.vercel.app' }
          }));
          sent++;
        } catch (e) {
          if (e.statusCode === 410) await db.collection('pushSubscriptions').deleteOne({ username: teacher });
        }
      }
    }

    res.json({ message: `Rappels envoyés: ${sent}/${teachersToNotify.length}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
