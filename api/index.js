const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());

const MONGO_URL = process.env.MONGO_URL;
const WORD_TEMPLATE_URL = process.env.WORD_TEMPLATE_URL;
let geminiModel;

if (!MONGO_URL) console.error("FATAL: MONGO_URL n'est pas définie.");
if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    console.log('✅ SDK Google Gemini initialisé.');
} else {
    console.warn('⚠️ GEMINI_API_KEY non défini. La fonctionnalité IA sera désactivée.');
}

const specificWeekDateRangesNode = {
  1:{start:'2025-08-31',end:'2025-09-04'},2:{start:'2025-09-07',end:'2025-09-11'},3:{start:'2025-09-14',end:'2025-09-18'},
  4:{start:'2025-09-21',end:'2025-09-25'},5:{start:'2025-09-28',end:'2025-10-02'},6:{start:'2025-10-05',end:'2025-10-09'},
  7:{start:'2025-10-12',end:'2025-10-16'},8:{start:'2025-10-19',end:'2025-10-23'},9:{start:'2025-10-26',end:'2025-10-30'},
 10:{start:'2025-11-02',end:'2025-11-06'},11:{start:'2025-11-09',end:'2025-11-13'},12:{start:'2025-11-16',end:'2025-11-20'},
 13:{start:'2025-11-23',end:'2025-11-27'},14:{start:'2025-11-30',end:'2025-12-04'},15:{start:'2025-12-07',end:'2025-12-11'},
 16:{start:'2025-12-14',end:'2025-12-18'},17:{start:'2025-12-21',end:'2025-12-25'},18:{start:'2025-12-28',end:'2026-01-01'},
 19:{start:'2026-01-04',end:'2026-01-08'},20:{start:'2026-01-11',end:'2026-01-15'},21:{start:'2026-01-18',end:'2026-01-22'},
 22:{start:'2026-01-25',end:'2026-01-29'},23:{start:'2026-02-01',end:'2026-02-05'},24:{start:'2026-02-08',end:'2026-02-12'},
 25:{start:'2026-02-15',end:'2026-02-19'},26:{start:'2026-02-22',end:'2026-02-26'},27:{start:'2026-03-01',end:'2026-03-05'},
 28:{start:'2026-03-08',end:'2026-03-12'},29:{start:'2026-03-15',end:'2026-03-19'},30:{start:'2026-03-22',end:'2026-03-26'},
 31:{start:'2026-03-29',end:'2026-04-02'},32:{start:'2026-04-05',end:'2026-04-09'},33:{start:'2026-04-12',end:'2026-04-16'},
 34:{start:'2026-04-19',end:'2026-04-23'},35:{start:'2026-04-26',end:'2026-04-30'},36:{start:'2026-05-03',end:'2026-05-07'},
 37:{start:'2026-05-10',end:'2026-05-14'},38:{start:'2026-05-17',end:'2026-05-21'},39:{start:'2026-05-24',end:'2026-05-28'},
 40:{start:'2026-05-31',end:'2026-06-04'},41:{start:'2026-06-07',end:'2026-06-11'},42:{start:'2026-06-14',end:'2026-06-18'},
 43:{start:'2026-06-21',end:'2026-06-25'},44:{start:'2026-06-28',end:'2026-07-02'},45:{start:'2026-07-05',end:'2026-07-09'},
 46:{start:'2026-07-12',end:'2026-07-16'},47:{start:'2026-07-19',end:'2026-07-23'},48:{start:'2026-07-26',end:'2026-07-30'}
};

const validUsers = {
  "Abeer": "Abeer","Aichetou": "Aichetou","Amal": "Amal","Amal Najar": "Amal Najar",
  "Ange": "Ange","Anouar": "Anouar","Emen": "Emen","Farah": "Farah","Fatima": "Fatima",
  "Ghadah": "Ghadah","Hana": "Hana","Nada": "Nada","Raghd": "Raghd","Salma": "Salma",
  "Sara": "Sara","Souha": "Souha","Takwa": "Takwa","Zohra": "Zohra",
  // Ajoutez Mohamed pour qu'il puisse se connecter
  "Mohamed": "Mohamed"
};

let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  cachedDb = client.db();
  return cachedDb;
}

function formatDateFrenchNode(date) {
  if (!date || isNaN(date.getTime())) return "Date invalide";
  const days = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  return `${days[date.getUTCDay()]} ${String(date.getUTCDate()).padStart(2,'0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function getDateForDayNameNode(weekStartDate, dayName) {
  if (!weekStartDate || isNaN(weekStartDate.getTime())) return null;
  const dayOrder = { "Dimanche":0,"Lundi":1,"Mardi":2,"Mercredi":3,"Jeudi":4 };
  const offset = dayOrder[dayName];
  if (offset === undefined) return null;
  const d = new Date(Date.UTC(weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth(), weekStartDate.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

const findKey = (obj, target) => obj ? Object.keys(obj).find(k => k.trim().toLowerCase() === target.toLowerCase()) : undefined;


// ==========================================================
// ===== AJOUT DE LA ROUTE DE CONNEXION MANQUANTE (/login) =====
// ==========================================================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Nom d'utilisateur et mot de passe requis." });
  }

  // Vérifie si l'utilisateur existe et si le mot de passe est correct
  // (le mot de passe est le même que le nom d'utilisateur)
  if (validUsers[username] && validUsers[username] === password) {
    console.log(`✅ Connexion réussie pour: ${username}`);
    res.json({ success: true, username: username });
  } else {
    console.log(`❌ Échec de la connexion pour: ${username}`);
    res.status(401).json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect." });
  }
});
// ==========================================================
// ================= FIN DE L'AJOUT =========================
// ==========================================================


// ===== ROUTE IA =====
app.post('/api/generate-ai-lesson-plan', async (req, res) => {
  try {
    if (!geminiModel) {
      return res.status(503).json({ message: "Le service IA n'est pas initialisé. Vérifiez la clé API du serveur." });
    }

    const { week, rowData } = req.body;
    if (!rowData || typeof rowData !== 'object' || !week) {
      return res.status(400).json({ message: "Les données de la ligne ou de la semaine sont manquantes." });
    }

    const enseignant = rowData[findKey(rowData, 'Enseignant')] || 'N/A';
    const classe = rowData[findKey(rowData, 'Classe')] || 'N/A';
    const matiere = rowData[findKey(rowData, 'Matière')] || 'N/A';
    const lecon = rowData[findKey(rowData, 'Leçon')] || 'Non spécifié';
    const travaux = rowData[findKey(rowData, 'Travaux de classe')] || 'Non spécifié';
    const support = rowData[findKey(rowData, 'Support')] || 'Non spécifié';

    const prompt = `
En tant qu'assistant pédagogique expert, génère un plan de leçon détaillé.
- Matière: ${matiere}
- Classe: ${classe}
- Thème: ${lecon}
- Activité: ${travaux}
- Support: ${support}

Le plan doit contenir :
Titre de la Leçon:: ...
Objectifs d'Apprentissage:: ...
Matériel Requis:: ...
Déroulement de la Séance (Étapes):: ...
Méthode d'Évaluation:: ...
Différenciation Pédagogique:: ...
(Format texte brut, listes avec "-")
`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();

    const plan = {};
    const lines = text.split('\n').filter(l => l.trim() !== '');
    let currentSection = null;
    lines.forEach(line => {
      const m = line.match(/^(.*?)::/);
      if (m && m[1]) {
        currentSection = m[1].trim();
        const content = line.replace(/^(.*?)::/, '').trim();
        plan[currentSection] = content ? [content] : [];
      } else if (currentSection) {
        plan[currentSection].push(line.trim());
      }
    });

    const wsData = [
      ["Plan de Leçon Généré par IA"], [],
      ["Contexte de la Leçon"],
      ["Matière", matiere],
      ["Classe", classe],
      ["Leçon", lecon],
      ["Travaux prévus", travaux],
      []
    ];

    ["Titre de la Leçon","Objectifs d'Apprentissage","Matériel Requis",
     "Déroulement de la Séance (Étapes)","Méthode d'Évaluation","Différenciation Pédagogique"]
    .forEach(section => {
      if (plan[section]) {
        wsData.push([section]);
        plan[section].forEach(it => wsData.push(["", it]));
        wsData.push([]);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{wch:30},{wch:80}];
    ws['!merges'] = [
      {s:{r:0,c:0}, e:{r:0,c:1}},
      {s:{r:2,c:0}, e:{r:2,c:1}}
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plan IA");
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const filename = `Plan_IA_S${week}_${matiere.replace(/[^a-z0-9]/gi,'_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);

  } catch (err) {
    console.error('❌ Erreur serveur /generate-ai-lesson-plan:', err);
    if (!res.headersSent) res.status(500).json({ message: `Erreur interne lors de la génération IA: ${err.message}` });
  }
});

// Exporter l'app
module.exports = app;
