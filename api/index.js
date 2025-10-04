const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const XLSX = require('xlsx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

// ========================================================================
// ========= NOUVELLES FONCTIONS D'AIDE POUR LA GÉNÉRATION WORD =========
// ========================================================================

/**
 * Détecte si une chaîne de caractères contient des caractères arabes.
 * @param {string} text Le texte à vérifier.
 * @returns {boolean} Vrai si du texte arabe est trouvé.
 */
const containsArabic = (text) => {
    if (typeof text !== 'string') return false;
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text);
};

/**
 * Formate le texte pour docxtemplater en gérant les sauts de ligne et le texte de droite à gauche (RTL) pour l'arabe.
 * @param {string} text Le texte brut à formater.
 * @returns {string} Une chaîne XML prête à être insérée dans un champ raw ('@...') de docxtemplater.
 */
const formatTextForWord = (text) => {
    if (!text || typeof text !== 'string') {
        return "";
    }
    const textWithLineBreaks = text.replace(/\r\n|\n|\r/g, '<w:br/>');
    if (containsArabic(text)) {
        return `<w:r><w:rPr><w:rtl/></w:rPr><w:t>${textWithLineBreaks}</w:t></w:r>`;
    }
    return `<w:r><w:t>${textWithLineBreaks}</w:t></w:r>`;
};


const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload());

const MONGO_URL = process.env.MONGO_URL;
const WORD_TEMPLATE_URL = process.env.WORD_TEMPLATE_URL;
const LESSON_TEMPLATE_URL = process.env.LESSON_TEMPLATE_URL;
let geminiModel;

if (!MONGO_URL) console.error('FATAL: MONGO_URL n\'est pas définie.');
if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log('✅ SDK Google Gemini initialisé.');
} else {
    console.warn('⚠️ GEMINI_API_KEY non défini. La fonctionnalité IA sera désactivée.');
}

const arabicTeachers = ['Majed', 'Jaber', 'Imad', 'Saeed'];
const englishTeachers = ['Kamel'];

const specificWeekDateRangesNode = {
  1:{start:'2025-08-31',end:'2025-09-04'}, 2:{start:'2025-09-07',end:'2025-09-11'}, 3:{start:'2025-09-14',end:'2025-09-18'}, 4:{start:'2025-09-21',end:'2025-09-25'}, 5:{start:'2025-09-28',end:'2025-10-02'}, 6:{start:'2025-10-05',end:'2025-10-09'}, 7:{start:'2025-10-12',end:'2025-10-16'}, 8:{start:'2025-10-19',end:'2025-10-23'}, 9:{start:'2025-10-26',end:'2025-10-30'},10:{start:'2025-11-02',end:'2025-11-06'}, 11:{start:'2025-11-09',end:'2025-11-13'},12:{start:'2025-11-16',end:'2025-11-20'}, 13:{start:'2025-11-23',end:'2025-11-27'},14:{start:'2025-11-30',end:'2025-12-04'}, 15:{start:'2025-12-07',end:'2025-12-11'},16:{start:'2025-12-14',end:'2025-12-18'}, 17:{start:'2025-12-21',end:'2025-12-25'},18:{start:'2025-12-28',end:'2026-01-01'}, 19:{start:'2026-01-04',end:'2026-01-08'},20:{start:'2026-01-11',end:'2026-01-15'}, 21:{start:'2026-01-18',end:'2026-01-22'},22:{start:'2026-01-25',end:'2026-01-29'}, 23:{start:'2026-02-01',end:'2026-02-05'},24:{start:'2026-02-08',end:'2026-02-12'}, 25:{start:'2026-02-15',end:'2026-02-19'},26:{start:'2026-02-22',end:'2026-02-26'}, 27:{start:'2026-03-01',end:'2026-03-05'},28:{start:'2026-03-08',end:'2026-03-12'}, 29:{start:'2026-03-15',end:'2026-03-19'},30:{start:'2026-03-22',end:'2026-03-26'}, 31:{start:'2026-03-29',end:'2026-04-02'},32:{start:'2026-04-05',end:'2026-04-09'}, 33:{start:'2026-04-12',end:'2026-04-16'},34:{start:'2026-04-19',end:'2026-04-23'}, 35:{start:'2026-04-26',end:'2026-04-30'},36:{start:'2026-05-03',end:'2026-05-07'}, 37:{start:'2026-05-10',end:'2026-05-14'},38:{start:'2026-05-17',end:'2025-05-21'}, 39:{start:'2026-05-24',end:'2026-05-28'},40:{start:'2026-05-31',end:'2026-06-04'}, 41:{start:'2026-06-07',end:'2026-06-11'},42:{start:'2026-06-14',end:'2026-06-18'}, 43:{start:'2026-06-21',end:'2026-06-25'},44:{start:'2026-06-28',end:'2026-07-02'}, 45:{start:'2026-07-05',end:'2026-07-09'},46:{start:'2026-07-12',end:'2026-07-16'}, 47:{start:'2026-07-19',end:'2026-07-23'},48:{start:'2026-07-26',end:'2026-07-30'}
};

const validUsers = {
   "Mohamed": "Mohamed", "Abas": "Abas", "Jaber": "Jaber", "Imad": "Imad", "Kamel": "Kamel",
    "Majed": "Majed", "Mohamed Ali": "Mohamed Ali", "Morched": "Morched",
    "Saeed": "Saeed", "Sami": "Sami", "Sylvano": "Sylvano", "Tonga": "Tonga", "Oumarou": "Oumarou", "Zine": "Zine"
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

function formatDateFrenchNode(date) { if (!date || isNaN(date.getTime())) return "Date invalide"; const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]; const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]; const dayName = days[date.getUTCDay()]; const dayNum = String(date.getUTCDate()).padStart(2, '0'); const monthName = months[date.getUTCMonth()]; const yearNum = date.getUTCFullYear(); return `${dayName} ${dayNum} ${monthName} ${yearNum}`; }
function getDateForDayNameNode(weekStartDate, dayName) { if (!weekStartDate || isNaN(weekStartDate.getTime())) return null; const dayOrder = { "Dimanche": 0, "Lundi": 1, "Mardi": 2, "Mercredi": 3, "Jeudi": 4 }; const offset = dayOrder[dayName]; if (offset === undefined) return null; const specificDate = new Date(Date.UTC(weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth(), weekStartDate.getUTCDate())); specificDate.setUTCDate(specificDate.getUTCDate() + offset); return specificDate; }
const findKey = (obj, target) => obj ? Object.keys(obj).find(k => k.trim().toLowerCase() === target.toLowerCase()) : undefined;

app.post('/api/login', (req, res) => { const { username, password } = req.body; if (validUsers[username] && validUsers[username] === password) { res.status(200).json({ success: true, username: username }); } else { res.status(401).json({ success: false, message: 'Identifiants invalides' }); } });
app.get('/api/plans/:week', async (req, res) => { const weekNumber = parseInt(req.params.week, 10); if (isNaN(weekNumber)) return res.status(400).json({ message: 'Semaine invalide.' }); try { const db = await connectToDatabase(); const planDocument = await db.collection('plans').findOne({ week: weekNumber }); if (planDocument) { res.status(200).json({ planData: planDocument.data || [], classNotes: planDocument.classNotes || {} }); } else { res.status(200).json({ planData: [], classNotes: {} }); } } catch (error) { console.error('Erreur MongoDB /plans/:week:', error); res.status(500).json({ message: 'Erreur serveur.' }); } });
app.post('/api/save-plan', async (req, res) => { const weekNumber = parseInt(req.body.week, 10); const data = req.body.data; if (isNaN(weekNumber) || !Array.isArray(data)) return res.status(400).json({ message: 'Données invalides.' }); try { const db = await connectToDatabase(); await db.collection('plans').updateOne({ week: weekNumber }, { $set: { data: data } }, { upsert: true }); res.status(200).json({ message: `Plan S${weekNumber} enregistré.` }); } catch (error) { console.error('Erreur MongoDB /save-plan:', error); res.status(500).json({ message: 'Erreur serveur.' }); } });
app.post('/api/save-notes', async (req, res) => { const weekNumber = parseInt(req.body.week, 10); const { classe, notes } = req.body; if (isNaN(weekNumber) || !classe) return res.status(400).json({ message: 'Données invalides.' }); try { const db = await connectToDatabase(); await db.collection('plans').updateOne({ week: weekNumber }, { $set: { [`classNotes.${classe}`]: notes } }, { upsert: true }); res.status(200).json({ message: 'Notes enregistrées.' }); } catch (error) { console.error('Erreur MongoDB /save-notes:', error); res.status(500).json({ message: 'Erreur serveur.' }); } });
app.post('/api/save-row', async (req, res) => { const weekNumber = parseInt(req.body.week, 10); const rowData = req.body.data; if (isNaN(weekNumber) || typeof rowData !== 'object') return res.status(400).json({ message: 'Données invalides.' }); try { const db = await connectToDatabase(); const updateFields = {}; const now = new Date(); for (const key in rowData) { updateFields[`data.$[elem].${key}`] = rowData[key]; } updateFields['data.$[elem].updatedAt'] = now; const arrayFilters = [{ "elem.Enseignant": rowData[findKey(rowData, 'Enseignant')], "elem.Classe": rowData[findKey(rowData, 'Classe')], "elem.Jour": rowData[findKey(rowData, 'Jour')], "elem.Période": rowData[findKey(rowData, 'Période')], "elem.Matière": rowData[findKey(rowData, 'Matière')] }]; const result = await db.collection('plans').updateOne({ week: weekNumber }, { $set: updateFields }, { arrayFilters: arrayFilters }); if (result.modifiedCount > 0 || result.matchedCount > 0) { res.status(200).json({ message: 'Ligne enregistrée.', updatedData: { updatedAt: now } }); } else { res.status(404).json({ message: 'Ligne non trouvée.' }); } } catch (error) { console.error('Erreur MongoDB /save-row:', error); res.status(500).json({ message: 'Erreur serveur.' }); } });
app.get('/api/all-classes', async (req, res) => { try { const db = await connectToDatabase(); const classes = await db.collection('plans').distinct('data.Classe', { 'data.Classe': { $ne: null, $ne: "" } }); res.status(200).json(classes.sort()); } catch (error) { console.error('Erreur MongoDB /api/all-classes:', error); res.status(500).json({ message: 'Erreur serveur.' }); } });

app.post('/api/generate-word', async (req, res) => {
    try {
        const { week, classe, data, notes } = req.body;
        const weekNumber = Number(week);
        if (!Number.isInteger(weekNumber) || !classe || !Array.isArray(data)) return res.status(400).json({ message: 'Données invalides.' });

        let templateBuffer;
        try {
            const response = await fetch(WORD_TEMPLATE_URL);
            if (!response.ok) throw new Error(`Échec modèle Word (${response.status})`);
            templateBuffer = Buffer.from(await response.arrayBuffer());
        } catch (e) {
            return res.status(500).json({ message: `Erreur récup modèle Word.` });
        }
        
        const zip = new PizZip(templateBuffer);
        
        // ===== CORRECTION APPLIQUÉE ICI =====
        // L'option "parser" a été supprimée.
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => ""
        });

        const groupedByDay = {};
        const dayOrder = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi"];
        const datesNode = specificWeekDateRangesNode[weekNumber];
        let weekStartDateNode = null;
        if (datesNode?.start) weekStartDateNode = new Date(datesNode.start + 'T00:00:00Z');
        if (!weekStartDateNode || isNaN(weekStartDateNode.getTime())) return res.status(500).json({ message: `Dates serveur manquantes pour S${weekNumber}.` });

        const sampleRow = data[0] || {};
        const jourKey = findKey(sampleRow, 'Jour'), periodeKey = findKey(sampleRow, 'Période'),
              matiereKey = findKey(sampleRow, 'Matière'), leconKey = findKey(sampleRow, 'Leçon'),
              travauxKey = findKey(sampleRow, 'Travaux de classe'), supportKey = findKey(sampleRow, 'Support'),
              devoirsKey = findKey(sampleRow, 'Devoirs');

        data.forEach(item => {
            const day = item[jourKey];
            if (day && dayOrder.includes(day)) {
                if (!groupedByDay[day]) groupedByDay[day] = [];
                groupedByDay[day].push(item);
            }
        });

        const joursData = dayOrder.map(dayName => {
            const dateOfDay = getDateForDayNameNode(weekStartDateNode, dayName);
            const formattedDate = dateOfDay ? formatDateFrenchNode(dateOfDay) : dayName;

            if (groupedByDay[dayName] && groupedByDay[dayName].length > 0) {
                const sortedEntries = groupedByDay[dayName].sort((a, b) => (parseInt(a[periodeKey], 10) || 0) - (parseInt(b[periodeKey], 10) || 0));
                
                const matieres = sortedEntries.map(item => ({
                    matiere: item[matiereKey] ?? "",
                    Lecon: formatTextForWord(item[leconKey] ?? ""),
                    travailDeClasse: formatTextForWord(item[travauxKey] ?? ""),
                    Support: formatTextForWord(item[supportKey] ?? ""),
                    devoirs: formatTextForWord(item[devoirsKey] ?? "")
                }));
                return { jourDateComplete: formattedDate, matieres: matieres };
            } else {
                return { jourDateComplete: formattedDate, matieres: [] };
            }
        });

        let plageSemaineText = `Semaine ${weekNumber}`;
        if (datesNode?.start && datesNode?.end) {
            const startD = new Date(datesNode.start + 'T00:00:00Z'), endD = new Date(datesNode.end + 'T00:00:00Z');
            if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                plageSemaineText = `du ${formatDateFrenchNode(startD)} au ${formatDateFrenchNode(endD)}`;
            }
        }

        const templateData = {
            classe: classe,
            semaine: weekNumber,
            plageSemaine: plageSemaineText,
            notes: formatTextForWord(notes || ""),
            jours: joursData
        };

        doc.render(templateData);

        const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        const filename = `Plan_hebdomadaire_S${weekNumber}_${classe.replace(/[^a-z0-9]/gi, '_')}.docx`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);

    } catch (error) {
        console.error('❌ Erreur serveur /generate-word:', error);
        if (!res.headersSent) res.status(500).json({ message: 'Erreur interne /generate-word.' });
    }
});

app.post('/api/generate-excel-workbook', async (req, res) => { try { const weekNumber = Number(req.body.week); if (!Number.isInteger(weekNumber)) return res.status(400).json({ message: 'Semaine invalide.' }); const db = await connectToDatabase(); const planDocument = await db.collection('plans').findOne({ week: weekNumber }); if (!planDocument?.data?.length) return res.status(404).json({ message: `Aucune donnée pour S${weekNumber}.` }); const finalHeaders = [ 'Enseignant', 'Jour', 'Période', 'Classe', 'Matière', 'Leçon', 'Travaux de classe', 'Support', 'Devoirs' ]; const formattedData = planDocument.data.map(item => { const row = {}; finalHeaders.forEach(header => { const itemKey = findKey(item, header); row[header] = itemKey ? item[itemKey] : ''; }); return row; }); const workbook = XLSX.utils.book_new(); const worksheet = XLSX.utils.json_to_sheet(formattedData, { header: finalHeaders }); worksheet['!cols'] = [ { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 45 }, { wch: 45 }, { wch: 25 }, { wch: 45 } ]; XLSX.utils.book_append_sheet(workbook, worksheet, `Plan S${weekNumber}`); const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }); const filename = `Plan_Hebdomadaire_S${weekNumber}_Complet.xlsx`; res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.send(buffer); } catch (error) { console.error('❌ Erreur serveur /generate-excel-workbook:', error); if (!res.headersSent) res.status(500).json({ message: 'Erreur interne Excel.' }); } });
app.post('/api/full-report-by-class', async (req, res) => { try { const { classe: requestedClass } = req.body; if (!requestedClass) return res.status(400).json({ message: 'Classe requise.' }); const db = await connectToDatabase(); const allPlans = await db.collection('plans').find({}).sort({ week: 1 }).toArray(); if (!allPlans || allPlans.length === 0) return res.status(404).json({ message: 'Aucune donnée.' }); const dataBySubject = {}; const monthsFrench = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]; allPlans.forEach(plan => { const weekNumber = plan.week; let monthName = 'N/A'; const weekDates = specificWeekDateRangesNode[weekNumber]; if (weekDates?.start) { try { const startDate = new Date(weekDates.start + 'T00:00:00Z'); monthName = monthsFrench[startDate.getUTCMonth()]; } catch (e) {} } (plan.data || []).forEach(item => { const itemClassKey = findKey(item, 'classe'); const itemSubjectKey = findKey(item, 'matière'); if (itemClassKey && item[itemClassKey] === requestedClass && itemSubjectKey && item[itemSubjectKey]) { const subject = item[itemSubjectKey]; if (!dataBySubject[subject]) dataBySubject[subject] = []; const row = { 'Mois': monthName, 'Semaine': weekNumber, 'Période': item[findKey(item, 'période')] || '', 'Leçon': item[findKey(item, 'leçon')] || '', 'Travaux de classe': item[findKey(item, 'travaux de classe')] || '', 'Support': item[findKey(item, 'support')] || '', 'Devoirs': item[findKey(item, 'devoirs')] || '' }; dataBySubject[subject].push(row); } }); }); const subjectsFound = Object.keys(dataBySubject); if (subjectsFound.length === 0) return res.status(404).json({ message: `Aucune donnée pour la classe '${requestedClass}'.` }); const workbook = XLSX.utils.book_new(); const headers = ['Mois', 'Semaine', 'Période', 'Leçon', 'Travaux de classe', 'Support', 'Devoirs']; subjectsFound.sort().forEach(subject => { const safeSheetName = subject.substring(0, 30).replace(/[*?:/\\\[\]]/g, '_'); const worksheet = XLSX.utils.json_to_sheet(dataBySubject[subject], { header: headers }); worksheet['!cols'] = [ { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 40 }, { wch: 25 }, { wch: 40 } ]; XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName); }); const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }); const filename = `Rapport_Complet_${requestedClass.replace(/[^a-z0-9]/gi, '_')}.xlsx`; res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.send(buffer); } catch (error) { console.error('❌ Erreur serveur /full-report-by-class:', error); if (!res.headersSent) res.status(500).json({ message: 'Erreur interne du rapport.' }); } });
app.post('/api/generate-ai-lesson-plan', async (req, res) => {
    try {
        if (!geminiModel) {
            return res.status(503).json({ message: "Le service IA n'est pas initialisé." });
        }
        if (!LESSON_TEMPLATE_URL) {
            return res.status(500).json({ message: "L'URL du modèle de plan de leçon n'est pas configurée (LESSON_TEMPLATE_URL)." });
        }

        const { week, rowData } = req.body;
        const weekNumber = Number(week);

        if (!rowData || typeof rowData !== 'object' || isNaN(weekNumber)) {
            return res.status(400).json({ message: "Les données sont manquantes ou le format de la semaine est invalide." });
        }
        
        const enseignant = rowData[findKey(rowData, 'Enseignant')] || '';
        const classe = rowData[findKey(rowData, 'Classe')] || '';
        const matiere = rowData[findKey(rowData, 'Matière')] || '';
        const lecon = rowData[findKey(rowData, 'Leçon')] || '';
        const jour = rowData[findKey(rowData, 'Jour')] || '';
        const seance = rowData[findKey(rowData, 'Période')] || '';
        const support = rowData[findKey(rowData, 'Support')] || 'Non spécifié';
        const travaux = rowData[findKey(rowData, 'Travaux de classe')] || 'Non spécifié';
        const devoirsPrevus = rowData[findKey(rowData, 'Devoirs')] || 'Non spécifié';
        
        let formattedDate = "";
        const datesNode = specificWeekDateRangesNode[weekNumber];
        if (jour && datesNode?.start) {
            const weekStartDateNode = new Date(datesNode.start + 'T00:00:00Z');
            if (!isNaN(weekStartDateNode.getTime())) {
                const dateOfDay = getDateForDayNameNode(weekStartDateNode, jour);
                if (dateOfDay) {
                    formattedDate = formatDateFrenchNode(dateOfDay);
                }
            }
        }
        
        const jsonStructure = `{
              "TitreUnite": "un titre d'unité pertinent pour la leçon",
              "Methodes": "liste des méthodes d'enseignement",
              "Outils": "liste des outils de travail",
              "Objectifs": "une liste concise des objectifs d'apprentissage (compétences, connaissances), séparés par des sauts de ligne (\\\\n). Commence chaque objectif par un tiret (-).",
              "etapes": [
                  { "phase": "Introduction", "duree": "5 min", "activite": "Description de l'activité d'introduction pour l'enseignant et les élèves." },
                  { "phase": "Activité Principale", "duree": "25 min", "activite": "Description de l'activité principale, en intégrant les 'travaux de classe' et le 'support' si possible." },
                  { "phase": "Synthèse", "duree": "10 min", "activite": "Description de l'activité de conclusion et de vérification des acquis." },
                  { "phase": "Clôture", "duree": "5 min", "activite": "Résumé rapide et annonce des devoirs." }
              ],
              "Ressources": "les ressources spécifiques à utiliser.",
              "Devoirs": "une suggestion de devoirs.",
              "DiffLents": "une suggestion pour aider les apprenants en difficulté.",
              "DiffTresPerf": "une suggestion pour stimuler les apprenants très performants.",
              "DiffTous": "une suggestion de différenciation pour toute la classe."
            }`;
            
        let prompt;
        if (englishTeachers.includes(enseignant)) {
            prompt = `As an expert pedagogical assistant, create a detailed 45-minute lesson plan in English. Structure the lesson into timed phases. Intelligently integrate the teacher's existing notes:
            - Subject: ${matiere}, Class: ${classe}, Lesson Topic: ${lecon}
            - Planned Classwork: ${travaux}
            - Mentioned Support/Materials: ${support}
            - Planned Homework: ${devoirsPrevus}
            Generate a response in valid JSON format only. The JSON structure must be as follows, with professional and concrete values in English: ${jsonStructure}`;
        } else if (arabicTeachers.includes(enseignant)) {
            prompt = `بصفتك مساعدًا تربويًا خبيرًا، قم بإنشاء خطة درس مفصلة باللغة العربية مدتها 45 دقيقة. قم ببناء الدرس في مراحل محددة بوقت. ادمج بذكاء ملاحظات المعلم الحالية:
            - المادة: ${matiere}, الفصل: ${classe}, موضوع الدرس: ${lecon}
            - عمل الفصل المخطط له: ${travaux}
            - الدعم / المواد المذكورة: ${support}
            - الواجبات المخطط لها: ${devoirsPrevus}
            قم بإنشاء استجابة بتنسيق JSON صالح فقط. يجب أن تكون بنية JSON على النحو التالي، مع قيم مهنية وملموسة باللغة العربية، مع الحفاظ على المفاتيح باللغة الإنجليزية: ${jsonStructure}`;
        } else {
            prompt = `En tant qu'assistant pédagogique expert, crée un plan de leçon détaillé de 45 minutes en français. Structure la leçon en phases chronométrées. Intègre de manière intelligente les notes existantes de l'enseignant :
            - Matière: ${matiere}, Classe: ${classe}, Thème de la leçon: ${lecon}
            - Travaux de classe prévus : ${travaux}
            - Support/Matériel mentionné : ${support}
            - Devoirs prévus : ${devoirsPrevus}
            Génère une réponse au format JSON valide uniquement. La structure JSON doit être la suivante, avec des valeurs concrètes et professionnelles en français : ${jsonStructure}`;
        }

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        let aiData;
        try {
            aiData = JSON.parse(text);
        } catch (e) {
            console.error("Erreur de parsing JSON de la réponse de l'IA:", text);
            return res.status(500).json({ message: "L'IA a retourné une réponse mal formée." });
        }

        let templateBuffer;
        try {
            const response = await fetch(LESSON_TEMPLATE_URL);
            if (!response.ok) throw new Error(`Échec modèle Word (${response.status})`);
            templateBuffer = Buffer.from(await response.arrayBuffer());
        } catch (e) {
            return res.status(500).json({ message: `Erreur récup modèle Word de plan de leçon.` });
        }

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
        
        const sanitizeForFilename = (str) => {
            if (typeof str !== 'string') str = String(str);
            const normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return normalized
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9-]/g, '_')
                .replace(/__+/g, '_');
        };
        
        const filename = `Plan de lecon-${sanitizeForFilename(matiere)}-${sanitizeForFilename(seance)}-${sanitizeForFilename(classe)}-Semaine${weekNumber}.docx`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);

    } catch (error) {
        console.error('❌ Erreur serveur /generate-ai-lesson-plan:', error);
        if (!res.headersSent) {
            const errorMessage = error.message || "Erreur interne.";
            res.status(500).json({ message: `Erreur interne lors de la génération IA: ${errorMessage}` });
        }
    }
});


module.exports = app;
