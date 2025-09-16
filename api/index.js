// ========================================================================
// ========= FONCTION IA MISE À JOUR AVEC PLANIFICATION DÉTAILLÉE =========
// ========================================================================
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
        
        let prompt;
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
            
        if (englishTeachers.includes(enseignant)) {
            prompt = `As an expert pedagogical assistant...`; // Le prompt reste le même
        } else if (arabicTeachers.includes(enseignant)) {
            prompt = `بصفتك مساعدًا تربويًا خبيرًا...`; // Le prompt reste le même
        } else {
            prompt = `En tant qu'assistant pédagogique expert...`; // Le prompt reste le même
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
        
        // ======================= NOUVELLE CORRECTION (Début) =======================
        /**
         * Nettoie une chaîne de caractères pour l'utiliser dans un nom de fichier.
         * Supprime les accents, remplace les espaces par des tirets,
         * et supprime tous les autres caractères non alphanumériques.
         * @param {string} str La chaîne à nettoyer.
         * @returns {string} La chaîne nettoyée.
         */
        const sanitizeFilename = (str) => {
            if (typeof str !== 'string') str = String(str);
            // Sépare les caractères de leurs accents
            const normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            // Remplace les espaces et les caractères non valides
            return normalized
                .replace(/\s+/g, '-') // Remplace les espaces par des tirets
                .replace(/[^a-zA-Z0-9-.]/g, '_') // Remplace les caractères invalides par un underscore
                .replace(/__+/g, '_'); // Évite les underscores multiples
        };
        
        // Construit le nom de fichier de base
        const baseFilename = `plan de lecon - ${matiere} - ${seance} - ${classe} - S${week}`;
        
        // Nettoie le nom de fichier complet et ajoute l'extension
        const filename = `${sanitizeFilename(baseFilename)}.docx`;
        // ======================= NOUVELLE CORRECTION (Fin) =========================

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
