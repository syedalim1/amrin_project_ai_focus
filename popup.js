// ========================================
// Study Gate Keeper — Popup Dashboard JS
// ========================================

document.addEventListener("DOMContentLoaded", function () {
    loadStats();
    loadSettings();
    loadTopics();
    setupEventListeners();
});

// ========================================
// Load Data
// ========================================
function loadStats() {
    chrome.storage.local.get("stats", function (data) {
        var stats = data.stats || {};
        document.getElementById("totalBlocks").textContent = stats.totalBlocks || 0;
        document.getElementById("correctAnswers").textContent = stats.correctAnswers || 0;
        document.getElementById("wrongAnswers").textContent = stats.wrongAnswers || 0;
        document.getElementById("streak").textContent = stats.streak || 0;

        // Daily unlocks
        var dailyUnlocks = stats.dailyUnlocks || 0;
        document.getElementById("dailyUnlocks").textContent = dailyUnlocks;

        chrome.storage.local.get("settings", function (sData) {
            var limit = (sData.settings && sData.settings.dailyLimit) || 10;
            document.getElementById("dailyLimit").textContent = limit;
            var pct = Math.min((dailyUnlocks / limit) * 100, 100);
            document.getElementById("dailyProgress").style.width = pct + "%";
        });
    });
}

function loadSettings() {
    chrome.storage.local.get("settings", function (data) {
        var settings = data.settings || {};

        // Toggle
        document.getElementById("toggleEnabled").checked = settings.enabled !== false;

        // API key
        if (settings.geminiApiKey) {
            document.getElementById("apiKey").value = settings.geminiApiKey;
        }

        // Timer buttons
        var timerMinutes = settings.timerMinutes || 5;
        var btns = document.querySelectorAll(".timer-btn");
        btns.forEach(function (btn) {
            btn.classList.remove("active");
            if (parseInt(btn.getAttribute("data-minutes")) === timerMinutes) {
                btn.classList.add("active");
            }
        });
    });
}

function loadTopics() {
    chrome.storage.local.get("studyTopics", function (data) {
        var topics = data.studyTopics || [];
        var list = document.getElementById("topicsList");

        if (topics.length === 0) {
            list.innerHTML = '<p class="empty-text">Visit Udemy or Coursera to detect topics...</p>';
            return;
        }

        list.innerHTML = "";
        topics.slice(0, 10).forEach(function (topic) {
            var div = document.createElement("div");
            div.className = "topic-item";
            div.textContent = "📖 " + topic;
            list.appendChild(div);
        });
    });
}


// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Toggle
    document.getElementById("toggleEnabled").addEventListener("change", function () {
        chrome.storage.local.get("settings", function (data) {
            var settings = data.settings || {};
            settings.enabled = document.getElementById("toggleEnabled").checked;
            chrome.storage.local.set({ settings: settings });
        });
    });

    // Save API Key
    document.getElementById("saveApiKey").addEventListener("click", function () {
        var key = document.getElementById("apiKey").value.trim();
        chrome.storage.local.get("settings", function (data) {
            var settings = data.settings || {};
            settings.geminiApiKey = key;
            chrome.storage.local.set({ settings: settings }, function () {
                var btn = document.getElementById("saveApiKey");
                btn.textContent = "✓ Saved";
                btn.style.background = "linear-gradient(135deg, #22c55e, #16a34a)";
                setTimeout(function () {
                    btn.textContent = "Save";
                    btn.style.background = "";
                }, 2000);
            });
        });
    });

    // AI Studio link
    document.getElementById("aiStudioLink").addEventListener("click", function () {
        chrome.tabs.create({ url: "https://aistudio.google.com/apikey" });
    });

    // Timer buttons
    document.querySelectorAll(".timer-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var minutes = parseInt(btn.getAttribute("data-minutes"));
            chrome.storage.local.get("settings", function (data) {
                var settings = data.settings || {};
                settings.timerMinutes = minutes;
                chrome.storage.local.set({ settings: settings });
            });
            document.querySelectorAll(".timer-btn").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
        });
    });

    // Reset stats
    document.getElementById("resetStats").addEventListener("click", function () {
        chrome.storage.local.set({
            stats: {
                totalBlocks: 0,
                correctAnswers: 0,
                wrongAnswers: 0,
                streak: 0,
                bestStreak: 0,
                dailyUnlocks: 0,
                dailyDate: new Date().toDateString(),
                blockedDomains: {}
            }
        }, function () {
            loadStats();
        });
    });
}


