        // --- Page Elements ---
        const landingPage = document.getElementById('landing-page');
        const appPage = document.getElementById('app-page');
        const getStartedBtn = document.getElementById('get-started-btn');
        
        // --- App DOM Elements ---
        const initialGoalContainer = document.getElementById('initial-goal-container');
        const initialGoalInput = document.getElementById('initial-goal-input');
        const initialGoalError = document.getElementById('initial-goal-error');
        const analyzeGoalBtn = document.getElementById('analyze-goal-btn');
        const aiQuestionsContainer = document.getElementById('ai-questions-container');
        const resultContainer = document.getElementById('result-container');
        const loader = document.getElementById('loader');
        const loaderText = document.getElementById('loader-text');
        const errorMessage = document.getElementById('error-message');
        const roadmapOutput = document.getElementById('roadmap-output');
        const startOverBtn = document.getElementById('start-over-btn');
        const headerSubtitle = document.getElementById('header-subtitle');

        // --- State ---
        let originalGoal = '';
        let aiQuestions = [];

        // --- Page Transition Logic ---
        getStartedBtn.addEventListener('click', () => {
            landingPage.classList.add('hidden');
            appPage.classList.remove('hidden');
            appPage.classList.add('flex', 'fade-in');
        });
        
        // --- App Event Listeners ---
        analyzeGoalBtn.addEventListener('click', handleGoalAnalysis);
        startOverBtn.addEventListener('click', resetApp);
        
        // --- App Functions ---
        
        async function handleGoalAnalysis() {
            originalGoal = initialGoalInput.value.trim();
            if (!originalGoal) {
                initialGoalInput.classList.add('input-error');
                initialGoalError.classList.remove('hidden');
                return;
            }
            initialGoalInput.classList.remove('input-error');
            initialGoalError.classList.add('hidden');

            setLoading(true, "Analyzing your goal and preparing some questions...");
            initialGoalContainer.classList.add('hidden');
            resultContainer.classList.remove('hidden');

            const systemPrompt = `You are a helpful and insightful life and career coach. Your task is to analyze a user's goal and generate a few clarifying questions to better understand their situation, skills, and specific desires. Ask between 3 and 5 open-ended questions. The final question should always be about their available time commitment. Return the questions as a valid JSON object with a single key "questions" which is an array of strings. Example: { "questions": ["What is your current experience with [topic]?", "What aspects of [topic] are you most excited about?", "How much time can you realistically dedicate to this goal each week?"] }`;

            try {
                const responseText = await callGeminiAPI(originalGoal, systemPrompt, true);
                const responseJson = JSON.parse(responseText);
                
                if (responseJson.questions && Array.isArray(responseJson.questions)) {
                    aiQuestions = responseJson.questions;
                    displayAIQuestions(aiQuestions);
                } else {
                    throw new Error("AI response did not contain a valid 'questions' array.");
                }

            } catch (error) {
                console.error("Error generating questions:", error);
                showError(`The AI failed to generate questions. Please try rephrasing your goal. Details: ${error.message}`);
            } finally {
                setLoading(false);
            }
        }

        function displayAIQuestions(questions) {
            headerSubtitle.textContent = "Answer these questions for a more tailored plan.";
            aiQuestionsContainer.innerHTML = '';
            
            const form = document.createElement('div');
            form.className = 'dynamic-form space-y-5 fade-in';
            
            questions.forEach((q, index) => {
                const inputId = `ai-question-${index}`;
                form.innerHTML += `
                    <div>
                        <label for="${inputId}" class="block mb-2 font-semibold text-gray-300">${q}</label>
                        <textarea id="${inputId}" data-question="${q}" rows="2" class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" required></textarea>
                         <p id="error-${inputId}" class="text-red-400 text-sm mt-1 hidden">Please provide an answer.</p>
                    </div>
                `;
            });

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'mt-6 text-right';
            buttonContainer.innerHTML = `<button id="generate-roadmap-btn" class="w-full sm:w-auto bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 duration-200 btn-glow">Generate My Roadmap</button>`;
            
            form.appendChild(buttonContainer);
            aiQuestionsContainer.appendChild(form);
            aiQuestionsContainer.classList.remove('hidden');

            document.getElementById('generate-roadmap-btn').addEventListener('click', handleRoadmapGeneration);
        }

        async function handleRoadmapGeneration() {
            const answers = [];
            let allValid = true;

            aiQuestionsContainer.querySelectorAll('textarea').forEach(input => {
                const answer = input.value.trim();
                const errorEl = document.getElementById(`error-${input.id}`);
                if (!answer) {
                    input.classList.add('input-error');
                    errorEl.classList.remove('hidden');
                    allValid = false;
                } else {
                    input.classList.remove('input-error');
                    errorEl.classList.add('hidden');
                    answers.push({ question: input.dataset.question, answer });
                }
            });

            if (!allValid) return;

            setLoading(true, "Crafting your personalized roadmap...");
            aiQuestionsContainer.classList.add('hidden');

            const detailedPrompt = `Create a detailed, actionable, and encouraging roadmap for a user. Here is the information I've gathered:\n\n**Primary Goal:** ${originalGoal}\n\n**Clarifying Details (User's Answers):**\n${answers.map(a => `- Q: ${a.question}\n  - A: ${a.answer}`).join('\n')}\n\nPlease create a roadmap that takes all of this information into account.`;
            const systemPrompt = `You are an expert life and career coach. Create a detailed, actionable, and encouraging roadmap based on the user's goal and their answers. Instructions: 1. Start with a Personalized Motivational Summary. 2. Structure the Roadmap using Markdown H2 (##) for each phase. 3. Provide actionable steps in numbered lists. 4. Incorporate user's answers to make it personal. 5. Use bold for emphasis. 6. End with a positive conclusion under a "## Final Thoughts" heading.`;

            try {
                const roadmapMarkdown = await callGeminiAPI(detailedPrompt, systemPrompt);
                displayRoadmap(roadmapMarkdown);
            } catch (error) {
                console.error("Error generating roadmap:", error);
                showError(`The AI failed to create your roadmap. Please try again. Details: ${error.message}`);
            } finally {
                setLoading(false);
                startOverBtn.classList.remove('hidden');
            }
        }

        async function callGeminiAPI(prompt, systemPrompt, expectJson = false) {
            const apiKey = "AIzaSyBkiDrCwfnn642-D68YxaDxS_xccjeEsz8";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            };
            
            if (expectJson) {
                payload.generationConfig = { responseMimeType: "application/json" };
            }

            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                return candidate.content.parts[0].text;
            } else {
                throw new Error("The AI response was empty or malformed.");
            }
        }
        
        function displayRoadmap(md) {
            roadmapOutput.innerHTML = '';
            const sections = md.split(/\n?## /).filter(Boolean);

            if (sections.length === 0) {
                roadmapOutput.innerHTML = `<p class="text-gray-300">${md.replace(/\n/g, '<br>')}</p>`;
                return;
            }
            
            const intro = sections.shift().trim();
            const introElement = document.createElement('div');
            introElement.className = 'p-5 bg-blue-900/30 border-l-4 border-blue-500 rounded-r-lg fade-in';
            introElement.innerHTML = `<p class="text-lg text-gray-200">${intro.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
            roadmapOutput.appendChild(introElement);

            const phasesContainer = document.createElement('div');
            phasesContainer.className = 'space-y-6';

            sections.forEach(section => {
                const lines = section.split('\n').filter(line => line.trim() !== '');
                const title = lines.shift()?.trim() || 'Phase';
                
                const phaseCard = document.createElement('div');
                phaseCard.className = 'bg-gray-800/60 border border-gray-700 rounded-xl p-6 shadow-lg fade-in transition-transform transform hover:-translate-y-1 hover:shadow-blue-900/50';
                
                const isConclusion = !lines.some(l => /^\d+\./.test(l.trim()));

                if(isConclusion) {
                    phaseCard.classList.remove('bg-gray-800/60', 'border-gray-700');
                    phaseCard.classList.add('bg-green-900/30', 'border-l-4', 'border-green-500', 'rounded-r-lg', 'p-5');
                    phaseCard.innerHTML = `<h2 class="text-xl font-bold text-gray-100 mb-2">${title}</h2><p class="text-lg text-gray-200">${lines.join('<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`
                } else {
                    phaseCard.innerHTML = `
                        <h2 class="text-xl font-bold text-gray-100 mb-4 flex items-center">
                            <span class="text-blue-400 mr-3 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></span>
                            ${title}
                        </h2>
                        <ul class="space-y-4">
                            ${lines.map(line => {
                                const match = line.trim().match(/^\d+\.\s+(.*)/);
                                if (match) {
                                    return `<li class="flex items-start">
                                        <span class="text-green-400 mr-4 mt-1 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>
                                        <span class="text-gray-300">${match[1].replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-100">$1</strong>')}</span>
                                    </li>`;
                                }
                                return `<p class="text-gray-400 ml-9">${line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-200">$1</strong>')}</p>`;
                            }).join('')}
                        </ul>
                    `;
                }
                phasesContainer.appendChild(phaseCard);
            });
            roadmapOutput.appendChild(phasesContainer);
        }

        function resetApp() {
             originalGoal = '';
             aiQuestions = [];
             initialGoalInput.value = '';
             
             initialGoalContainer.classList.remove('hidden');
             aiQuestionsContainer.classList.add('hidden');
             aiQuestionsContainer.innerHTML = '';
             resultContainer.classList.add('hidden');
             roadmapOutput.innerHTML = '';
             startOverBtn.classList.add('hidden');
             hideError();
             headerSubtitle.textContent = "Your personal guide to achieving any goal.";
             // Reset to show the initial goal input again
             initialGoalContainer.classList.remove('hidden');
        }

        // --- Utility Functions ---

        function setLoading(isLoading, text = '') {
            if (isLoading) {
                loader.classList.remove('hidden');
                loader.classList.add('flex');
                loaderText.textContent = text;
            } else {
                loader.classList.add('hidden');
                loader.classList.remove('flex');
            }
        }
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
            setLoading(false);
            startOverBtn.classList.remove('hidden');
        }

        function hideError() {
            errorMessage.classList.add('hidden');
        }
        
        async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url, options);
                    if (response.status !== 429 && response.status < 500) {
                        return response;
                    }
                    throw new Error(`Server error or rate limit: ${response.status}`);
                } catch (error) {
                    if (i === retries - 1) throw error;
                    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                }
            }
        }
