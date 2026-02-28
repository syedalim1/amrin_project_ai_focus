// ========================================
// Study Gate Keeper — Block Page Logic
// Gemini AI-Powered Question Engine
// ========================================


// ---- Motivational Quotes ----
const quotes = [
    '"The secret of getting ahead is getting started." — Mark Twain',
    '"Focus on being productive instead of busy." — Tim Ferriss',
    '"Education is the most powerful weapon you can use to change the world." — Nelson Mandela',
    '"An investment in knowledge pays the best interest." — Benjamin Franklin',
    '"Study hard, for the well is deep, and our brains are shallow." — Richard Baxter',
    '"The beautiful thing about learning is that no one can take it away from you." — B.B. King',
    '"Success is the sum of small efforts, repeated day in and day out." — Robert Collier',
    '"Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',
    '"Believe you can and you\'re halfway there." — Theodore Roosevelt',
    '"Push yourself, because no one else is going to do it for you."',
];

// ---- State ----
let selectedQuestion = null;
let isAiQuestion = false;

// ========================================
// Init
// ========================================
document.addEventListener("DOMContentLoaded", function () {
    setupPage();
});

async function setupPage() {
    displayBlockedDomain();
    displayRandomQuote();
    loadFooterStats();
    await loadQuestion();

    // Event listeners
    document.getElementById("submitBtn").addEventListener("click", checkAnswer);
    document.getElementById("answer").addEventListener("keydown", function (e) {
        if (e.key === "Enter") checkAnswer();
    });
}

// ---- Show blocked domain ----
function displayBlockedDomain() {
    let params = new URLSearchParams(window.location.search);
    let domain = params.get("domain") || "Unknown Site";
    document.getElementById("blockedDomain").textContent = "🚫 " + domain;
}

// ---- Random quote ----
function displayRandomQuote() {
    let q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById("quote").textContent = q;
}

// ---- Load stats into footer ----
function loadFooterStats() {
    chrome.storage.local.get(["stats", "settings"], function (data) {
        let stats = data.stats || {};
        let settings = data.settings || {};
        document.getElementById("streak").textContent = stats.streak || 0;
        document.getElementById("dailyCount").textContent = stats.dailyUnlocks || 0;
        document.getElementById("dailyLimit").textContent = settings.dailyLimit || 10;

        // Check if daily limit reached
        let dailyLimit = settings.dailyLimit || 10;
        if ((stats.dailyUnlocks || 0) >= dailyLimit && stats.dailyDate === new Date().toDateString()) {
            showDailyLimitReached();
        }
    });
}

// ---- Daily limit reached ----
function showDailyLimitReached() {
    document.querySelector(".question-section").innerHTML = `
    <div class="limit-reached">
      <h2>🚫 Daily Limit Reached</h2>
      <p>You've used all your unlocks for today.</p>
      <p style="margin-top:10px; color: #6366f1; font-size: 13px;">Come back tomorrow and study hard! 💪</p>
    </div>
  `;
    document.getElementById("aiBadge").style.display = "none";
}

// ========================================
// Load Question (AI Only)
// ========================================
async function loadQuestion() {
    setAiStatus("loading", "⏳ Preparing AI question...");

    let data = await getStorageData(["settings", "studyTopics"]);
    let settings = data.settings || {};
    let studyTopics = data.studyTopics || [];
    let apiKey = settings.geminiApiKey || "AIzaSyBkGhGr4JWIjsq5GGOPmevYcN8IQbxLo0s";

    if (apiKey && studyTopics.length > 0) {
        // Try Gemini AI
        let aiQuestion = await fetchGeminiQuestion(apiKey, studyTopics);
        if (aiQuestion) {
            selectedQuestion = { q: aiQuestion.question, a: aiQuestion.answer, category: "🤖 AI — Based on your studies" };
            isAiQuestion = true;
            renderQuestion();
            setAiStatus("active", "🤖 Gemini AI — Based on your studies");
            return;
        }
        // AI failed
        setAiStatus("error", "⚠️ AI error — check console or API quota");
    } else {
        if (!apiKey) {
            setAiStatus("error", "ℹ️ Add Gemini API key in popup for AI questions");
        } else if (studyTopics.length === 0) {
            setAiStatus("error", "ℹ️ Visit Udemy/Coursera first to enable AI questions");
        }
    }

    // AI is the only source now
    selectedQuestion = null;
    isAiQuestion = false;
    document.getElementById("question").textContent = "AI Question Unavailable. Please configure Gemini API and study topics.";
    document.getElementById("questionBadge").textContent = "⚠️ Error";
    document.getElementById("answer").disabled = true;
    document.getElementById("submitBtn").disabled = true;
}

// ---- Render the question ----
function renderQuestion() {
    document.getElementById("question").textContent = selectedQuestion.q;
    document.getElementById("questionBadge").textContent = selectedQuestion.category;
    document.getElementById("answer").disabled = false;
    document.getElementById("submitBtn").disabled = false;
}

// ---- AI Status indicator ----
function setAiStatus(state, text) {
    let dot = document.getElementById("aiBadge").querySelector(".ai-dot");
    document.getElementById("aiStatus").textContent = text;
    dot.className = "ai-dot";
    if (state === "active") dot.classList.add("active");
    if (state === "error") dot.classList.add("error");
}

// ========================================
// Gemini API Call
// ========================================
async function fetchGeminiQuestion(apiKey, studyTopics) {
    // Use the 3 most recent study topics as context
    let topicsContext = studyTopics.slice(0, 3).join(", ");
    let prompt = `The user is studying: "${topicsContext}".
Generate 1 VERY EASY, basic, child-level quiz question related to these topics.
Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{"question": "your very simple question here", "answer": "the obvious answer (1-3 words)"}
The question must be extremely simple and obvious.`;

    // ✅ Correct: use header for API key, not URL param
    // ✅ Correct: current stable model as per Google AI docs
    const GEMINI_MODEL = "gemini-3-flash-preview";
    let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    try {
        let response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey          // ✅ API key via header (correct per docs)
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000  // 🚀 Increased to fix MAX_TOKENS cutoff
                }
            })
        });

        if (!response.ok) {
            let errData = await response.json().catch(() => ({}));
            console.error("[StudyGate] Gemini API error:", response.status, errData);
            return null;
        }

        let result = await response.json();
        let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log("[StudyGate] Gemini raw response:", text);

        // Parse JSON from response
        let jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            let parsed = JSON.parse(jsonMatch[0]);
            if (parsed.question && parsed.answer) {
                return { question: parsed.question, answer: parsed.answer.toLowerCase().trim() };
            }
        }
        return null;
    } catch (e) {
        console.error("Gemini API error:", e);
        return null;
    }
}

// ========================================
// AI Answer Evaluation
// ========================================
async function evaluateAnswerWithAI(apiKey, question, expectedAnswer, userAnswer) {
    let prompt = `Question: "${question}"
Expected correct answer: "${expectedAnswer}"
User's typed answer: "${userAnswer}"

Is the user's answer essentially correct? Forgive minor spelling mistakes, typos, or slight phrasing differences.
Respond ONLY with valid JSON in this exact format:
{"isCorrect": true} OR {"isCorrect": false}`;

    const GEMINI_MODEL = "gemini-3-flash-preview";
    let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    try {
        let response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
            })
        });

        if (!response.ok) return null;

        let result = await response.json();
        let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

        let jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            let parsed = JSON.parse(jsonMatch[0]);
            return parsed.isCorrect === true;
        }
        return null;
    } catch (e) {
        console.error("[StudyGate] AI Eval error:", e);
        return null;
    }
}

// ========================================
// Check Answer
// ========================================
async function checkAnswer() {
    if (!selectedQuestion) return;

    let userAnswer = document.getElementById("answer").value.toLowerCase().trim();
    if (!userAnswer) return;

    // Show loading text on button
    let btnText = document.getElementById("btnText");
    let btnLoader = document.getElementById("btnLoader");
    let originalBtnText = btnText.textContent;
    btnText.textContent = "Checking...";
    document.getElementById("answer").disabled = true;
    document.getElementById("submitBtn").disabled = true;

    let isCorrect = false;

    // Try to use AI to grade the answer
    let data = await getStorageData(["settings"]);
    let apiKey = (data.settings && data.settings.geminiApiKey) ? data.settings.geminiApiKey : "";

    if (apiKey) {
        // AI Grading (handles typos)
        let aiJudgment = await evaluateAnswerWithAI(apiKey, selectedQuestion.q, selectedQuestion.a, userAnswer);

        if (aiJudgment !== null) {
            isCorrect = aiJudgment;
        } else {
            // Fallback if AI grading fails
            isCorrect = basicTextMatch(userAnswer, selectedQuestion.a);
        }
    } else {
        // No API key, use basic text match
        isCorrect = basicTextMatch(userAnswer, selectedQuestion.a);
    }

    // Reset button
    btnText.textContent = originalBtnText;

    if (isCorrect) {
        handleCorrectAnswer();
    } else {
        handleWrongAnswer();
    }
}

// Basic fallback matching
function basicTextMatch(user, expected) {
    user = user.toLowerCase().trim();
    expected = expected.toLowerCase().trim();
    return user.includes(expected) || expected.includes(user);
}

// ---- Correct Answer ----
function handleCorrectAnswer() {
    // Update stats
    chrome.storage.local.get("stats", function (data) {
        let stats = data.stats || {};
        let today = new Date().toDateString();

        stats.correctAnswers = (stats.correctAnswers || 0) + 1;
        stats.streak = (stats.streak || 0) + 1;
        stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak);

        // Daily unlock counter
        if (stats.dailyDate !== today) {
            stats.dailyDate = today;
            stats.dailyUnlocks = 0;
        }
        stats.dailyUnlocks = (stats.dailyUnlocks || 0) + 1;

        chrome.storage.local.set({ stats: stats });
    });

    // Visual feedback
    document.getElementById("answer").disabled = true;
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("error").textContent = "";
    document.getElementById("success").classList.remove("hidden");
    document.getElementById("success").textContent = "✅ Correct! Redirecting...";
    document.querySelector(".container").classList.add("success-glow");

    // Show countdown
    let countdown = 2;
    let interval = setInterval(function () {
        countdown--;
        document.getElementById("success").textContent = "✅ Correct! Redirecting in " + countdown + "s...";
        if (countdown <= 0) {
            clearInterval(interval);
            redirectToOriginal();
        }
    }, 1000);
}

// ---- Wrong Answer ----
function handleWrongAnswer() {
    // Update stats
    chrome.storage.local.get("stats", function (data) {
        let stats = data.stats || {};
        stats.wrongAnswers = (stats.wrongAnswers || 0) + 1;
        stats.streak = 0; // Reset streak
        chrome.storage.local.set({ stats: stats });
    });

    // Visual feedback
    let errorEl = document.getElementById("error");
    errorEl.textContent = "❌ Wrong answer! Try again.";
    document.getElementById("answer").classList.add("shake");
    document.getElementById("answer").value = "";

    setTimeout(function () {
        document.getElementById("answer").classList.remove("shake");
        document.getElementById("answer").focus();
    }, 600);
}

// ---- Redirect to original URL ----
function redirectToOriginal() {
    let params = new URLSearchParams(window.location.search);
    let originalUrl = params.get("original");
    if (!originalUrl) return;

    // Save to tempAllowed so background.js won't re-block it
    chrome.storage.local.get(["tempAllowed", "settings"], function (data) {
        let tempAllowed = data.tempAllowed || [];
        let settings = data.settings || {};
        tempAllowed.push({ url: originalUrl, time: Date.now() });
        chrome.storage.local.set({ tempAllowed: tempAllowed }, function () {
            window.location.href = originalUrl;
        });
    });
}

// ========================================
// Utility
// ========================================
function getStorageData(keys) {
    return new Promise(function (resolve) {
        chrome.storage.local.get(keys, function (data) {
            resolve(data);
        });
    });
}
