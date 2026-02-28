// ========================================
// Study Gate Keeper — Background Service Worker
// ========================================

const DEFAULT_ALLOWED_SITES = ["udemy.com", "coursera.org", "accounts.google.com"];

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.get(null, function (data) {
        if (!data.allowedSites) {
            chrome.storage.local.set({ allowedSites: DEFAULT_ALLOWED_SITES });
        }
        if (!data.stats) {
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
            });
        }
        if (!data.settings) {
            chrome.storage.local.set({
                settings: {
                    enabled: true,
                    timerMinutes: 5,
                    dailyLimit: 10,
                    geminiApiKey: ""
                }
            });
        }
        if (!data.studyTopics) {
            chrome.storage.local.set({ studyTopics: [] });
        }
        if (!data.tempAllowed) {
            chrome.storage.local.set({ tempAllowed: [] });
        }
    });
});

// ========================================
// Track study topics from Udemy/Coursera
// ========================================
chrome.webNavigation.onCompleted.addListener(function (details) {
    if (details.frameId !== 0) return;

    let url = new URL(details.url);
    let hostname = url.hostname;

    // Only track Udemy and Coursera pages
    let isStudySite = hostname.includes("udemy.com") || hostname.includes("coursera.org");
    if (!isStudySite) return;

    // Get the page title to extract the course/topic
    chrome.tabs.get(details.tabId, function (tab) {
        if (tab && tab.title) {
            let title = tab.title.replace(/ \| Udemy| \| Coursera| - Online Courses/gi, "").trim();
            if (title.length > 5) {
                chrome.storage.local.get("studyTopics", function (data) {
                    let topics = data.studyTopics || [];
                    // Avoid duplicates, keep last 20 topics
                    if (!topics.includes(title)) {
                        topics.unshift(title);
                        if (topics.length > 20) topics = topics.slice(0, 20);
                        chrome.storage.local.set({ studyTopics: topics });
                    }
                });
            }
        }
    });
});

// ========================================
// Main Navigation Blocker
// ========================================
chrome.webNavigation.onBeforeNavigate.addListener(function (details) {
    if (details.frameId !== 0) return;

    let url;
    try {
        url = new URL(details.url);
    } catch (e) {
        return;
    }

    let hostname = url.hostname;

    // Don't block chrome:// or extension pages
    if (url.protocol === "chrome-extension:" || url.protocol === "chrome:" || url.protocol === "about:") return;

    // Don't block empty or new tab pages
    if (!hostname || hostname === "newtab") return;

    // Check settings and allowed sites
    chrome.storage.local.get(["allowedSites", "settings", "tempAllowed", "stats"], function (data) {
        let settings = data.settings || { enabled: true, timerMinutes: 5, dailyLimit: 10 };
        let allowedSites = data.allowedSites || DEFAULT_ALLOWED_SITES;
        let tempAllowed = data.tempAllowed || [];
        let stats = data.stats || {};

        // If blocker is disabled, allow everything
        if (!settings.enabled) return;

        // Check if permanently allowed
        let isAllowed = allowedSites.some(function (site) {
            return hostname.includes(site);
        });
        if (isAllowed) return;

        // Clean up expired temp entries
        let now = Date.now();
        let timerMs = (settings.timerMinutes || 5) * 60 * 1000;
        tempAllowed = tempAllowed.filter(function (entry) {
            return now - entry.time < timerMs;
        });
        chrome.storage.local.set({ tempAllowed: tempAllowed });

        // Check temp allowed
        let isTempAllowed = tempAllowed.some(function (entry) {
            return details.url === entry.url;
        });
        if (isTempAllowed) return;

        // Reset daily counter if new day
        if (stats.dailyDate !== new Date().toDateString()) {
            stats.dailyDate = new Date().toDateString();
            stats.dailyUnlocks = 0;
        }

        // Track blocked domain
        let domain = hostname.replace("www.", "");
        if (!stats.blockedDomains) stats.blockedDomains = {};
        stats.blockedDomains[domain] = (stats.blockedDomains[domain] || 0) + 1;
        stats.totalBlocks = (stats.totalBlocks || 0) + 1;
        chrome.storage.local.set({ stats: stats });

        // Redirect to block page
        let blockUrl = chrome.runtime.getURL("block.html") +
            "?original=" + encodeURIComponent(details.url) +
            "&domain=" + encodeURIComponent(domain);

        chrome.tabs.update(details.tabId, { url: blockUrl });
    });
});
