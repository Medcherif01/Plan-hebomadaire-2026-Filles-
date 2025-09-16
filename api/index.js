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
        // ======================= CORRECTION 1 (Début) =======================
        // Définir weekNumber qui était manquant et valider les entrées.
        const weekNumber = Number(week);
        if (!rowData || typeof rowData !== 'object' || isNaN(weekNumber)) {
            return res.status(400).json({ message: "Les données sont manquantes ou le format de la semaine est invalide." });
        }
        // ======================= CORRECTION 1 (Fin) =========================
        
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
        const datesNode = specificWeekDateRangesNode[weekNumber]; // Maintenant, weekNumber est défini
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
            Date: formattedDate, // Date était vide, maintenant elle est remplie
            Deroulement: minutageString,
            Contenu: contenuString,
        };

        doc.render(templateData);

        const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        
        // ======================= CORRECTION 2 (Début) =======================
        // Fonction simple pour nettoyer les noms pour le fichier
        const sanitize = (str) => str.replace(/[^a-z0-9-]/gi, '_').replace(/_+/g, '_');
        
        const filename = `plan de lecon - ${sanitize(matiere)} - ${sanitize(seance)} - ${sanitize(classe)} - S${week}.docx`;
        // ======================= CORRECTION 2 (Fin) =========================

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
