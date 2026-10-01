/**
 * ViBootX Popup — Multi-Account Carousel & Credential Manager
 *
 * Supports sliding through multiple accounts (e.g. main account, friend accounts)
 * like a smartphone screen. The last slide is always an empty template with
 * placeholders to add a new friend's credentials.
 *
 * Clicking the right arrow at the dead right end advances slides, and at the end
 * wraps back around to the main page.
 */

"use strict";

const STORAGE_KEYS = {
  username:       "vibootx_username",
  password:       "vibootx_password",
  autosubmit:     "vibootx_autosubmit",
  dashboardMarks: "vibootx_dashboard_marks",
  accounts:       "vibootx_accounts",
  activeIndex:    "vibootx_active_account_idx",
};

const DEFAULT_ACCOUNTS = [
  { username: "Xpytncgswkl", password: "14Sept2018", label: "My Account" },
];

let accounts = [];
let activeIndex = 0;
let currentSlide = 0;

// DOM Elements
const trackEl          = document.getElementById("vx-carousel-track");
const dotsContainer    = document.getElementById("vx-dots");
const badgeEl          = document.getElementById("vx-account-badge");
const autosubmitEl     = document.getElementById("vx-autosubmit");
const dashboardMarksEl = document.getElementById("vx-dashboard-marks");

/* ── SVG Icons ────────────────────────────────────────────── */
const ICONS = {
  arrowRight: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>`,
  arrowLeft: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>`,
  eyeOpen: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,
  eyeOff: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`,
};

/* ── Persistence ─────────────────────────────────────────── */
function persistState() {
  const currentAcc = accounts[activeIndex] || accounts[0];
  chrome.storage.local.set({
    [STORAGE_KEYS.accounts]:    accounts,
    [STORAGE_KEYS.activeIndex]: activeIndex,
    [STORAGE_KEYS.username]:    currentAcc ? currentAcc.username : "",
    [STORAGE_KEYS.password]:    currentAcc ? currentAcc.password : "",
    [STORAGE_KEYS.autosubmit]:  autosubmitEl.checked,
  });
}

/* ── Render Carousel ─────────────────────────────────────── */
function renderCarousel() {
  trackEl.innerHTML = "";
  dotsContainer.innerHTML = "";

  const totalSlides = accounts.length + 1; // +1 for the empty "Add New" slide

  // 1. Build Saved Account Slides
  accounts.forEach((acc, idx) => {
    const slide = createSlideElement({
      index: idx,
      isNew: false,
      username: acc.username,
      password: acc.password,
      label: idx === 0 ? "My Account" : `Friend ${idx}`,
      totalSlides: totalSlides,
    });
    trackEl.appendChild(slide);

    const dot = document.createElement("span");
    dot.className = `vx-dot-item ${idx === currentSlide ? "active" : ""}`;
    dot.title = `Go to ${idx === 0 ? "Main Account" : "Friend " + idx}`;
    dot.addEventListener("click", () => goToSlide(idx));
    dotsContainer.appendChild(dot);
  });

  // 2. Build the Last Slide: Empty Template for Adding a Friend
  const newSlide = createSlideElement({
    index: accounts.length,
    isNew: true,
    username: "",
    password: "",
    label: "+ Add Friend",
    totalSlides: totalSlides,
  });
  trackEl.appendChild(newSlide);

  const newDot = document.createElement("span");
  newDot.className = `vx-dot-item new-dot ${accounts.length === currentSlide ? "active" : ""}`;
  newDot.title = "Add new friend account";
  newDot.addEventListener("click", () => goToSlide(accounts.length));
  dotsContainer.appendChild(newDot);

  updateSlidePosition();
}

/* ── Slide Factory ───────────────────────────────────────── */
function createSlideElement({ index, isNew, username, password, label, totalSlides }) {
  const slide = document.createElement("div");
  slide.className = "vx-slide";
  slide.dataset.index = index;

  const showLeftArrow = index > 0;
  const usernamePlaceholder = isNew ? "Add username" : "e.g. 22BCE0000";
  const passwordPlaceholder = isNew ? "Enter password" : "••••••••••";
  const saveBtnText = isNew ? "+ Add Account" : "Save credentials";

  slide.innerHTML = `
    <!-- Username Field -->
    <div class="vx-field">
      <div class="vx-field-label-row">
        <label>Username</label>
        <span class="vx-slide-tag">${isNew ? "New Slot" : (index === 0 ? "Main" : "Friend")}</span>
      </div>
      <div class="vx-username-row">
        <div class="vx-input-row vx-input-grow">
          <input
            type="text"
            class="vx-input-username"
            value="${escapeHtml(username)}"
            placeholder="${usernamePlaceholder}"
            autocomplete="off"
            spellcheck="false"
          >
        </div>
        <!-- Right Arrow Navigation Button at Dead Right End -->
        <div class="vx-nav-group">
          ${showLeftArrow ? `
            <button class="vx-arrow-btn vx-arrow-prev" title="Previous account" type="button">
              ${ICONS.arrowLeft}
            </button>
          ` : ""}
          <button class="vx-arrow-btn vx-arrow-next" title="${index === totalSlides - 1 ? 'Back to Main Account' : 'Next account'}" type="button">
            ${ICONS.arrowRight}
          </button>
        </div>
      </div>
    </div>

    <!-- Password Field -->
    <div class="vx-field">
      <div class="vx-field-label-row">
        <label>Password</label>
      </div>
      <div class="vx-input-row">
        <input
          type="password"
          class="vx-input-password"
          value="${escapeHtml(password)}"
          placeholder="${passwordPlaceholder}"
          autocomplete="off"
        >
        <button class="vx-eye" title="Show / hide password" type="button">
          ${ICONS.eyeOpen}
        </button>
      </div>
    </div>

    <!-- Actions Row -->
    <div class="vx-actions">
      <button class="vx-btn-save ${isNew ? 'is-new-save' : ''}" type="button">
        ${saveBtnText}
      </button>
      ${(!isNew && index > 0) ? `
        <button class="vx-btn-delete" title="Delete this friend account" type="button">
          Remove
        </button>
      ` : ""}
      <span class="vx-status"></span>
    </div>
  `;

  // Attach event handlers inside this slide
  const userInput = slide.querySelector(".vx-input-username");
  const passInput = slide.querySelector(".vx-input-password");
  const eyeBtn    = slide.querySelector(".vx-eye");
  const saveBtn   = slide.querySelector(".vx-btn-save");
  const statusEl  = slide.querySelector(".vx-status");
  const nextBtn   = slide.querySelector(".vx-arrow-next");
  const prevBtn   = slide.querySelector(".vx-arrow-prev");
  const deleteBtn = slide.querySelector(".vx-btn-delete");

  // Next Arrow (at dead right end of Username row)
  nextBtn.addEventListener("click", () => {
    const nextIdx = (currentSlide + 1) % totalSlides;
    goToSlide(nextIdx);
  });

  // Prev Arrow (if present)
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const prevIdx = (currentSlide - 1 + totalSlides) % totalSlides;
      goToSlide(prevIdx);
    });
  }

  // Eye toggle
  eyeBtn.addEventListener("click", () => {
    const isHidden = passInput.type === "password";
    passInput.type = isHidden ? "text" : "password";
    eyeBtn.innerHTML = isHidden ? ICONS.eyeOff : ICONS.eyeOpen;
  });

  // Save handler
  function handleSave() {
    const u = userInput.value.trim();
    const p = passInput.value;

    if (isNew) {
      if (!u) {
        userInput.focus();
        showStatus(statusEl, "Enter a username", "#f87171");
        return;
      }
      accounts.push({
        username: u,
        password: p,
        label: `Friend ${accounts.length}`,
      });
      activeIndex = accounts.length - 1;
      currentSlide = activeIndex;
      persistState();
      renderCarousel();
      showStatus(statusEl, "✓ Added!", "#22c55e");
    } else {
      accounts[index].username = u;
      accounts[index].password = p;
      activeIndex = index;
      persistState();
      updateBadge();
      showStatus(statusEl, "✓ Saved", "#22c55e");
    }
  }

  saveBtn.addEventListener("click", handleSave);

  // Save on Enter key
  [userInput, passInput].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSave();
    });
  });

  // Delete handler
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      accounts.splice(index, 1);
      activeIndex = Math.max(0, index - 1);
      currentSlide = activeIndex;
      persistState();
      renderCarousel();
    });
  }

  return slide;
}

/* ── Navigation & Slide Position ─────────────────────────── */
function goToSlide(targetIndex) {
  const totalSlides = accounts.length + 1;
  currentSlide = (targetIndex + totalSlides) % totalSlides;
  updateSlidePosition();

  // If switched to an existing saved account, make it active for auto-login
  if (currentSlide < accounts.length) {
    activeIndex = currentSlide;
    persistState();
  }
}

function updateSlidePosition() {
  trackEl.style.transform = `translateX(-${currentSlide * 100}%)`;

  // Update dots
  const allDots = dotsContainer.querySelectorAll(".vx-dot-item");
  allDots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentSlide);
  });

  updateBadge();
}

function updateBadge() {
  if (currentSlide < accounts.length) {
    const acc = accounts[currentSlide];
    const isMain = currentSlide === 0;
    badgeEl.textContent = `${isMain ? "Account 1" : "Friend " + currentSlide} • Active`;
    badgeEl.classList.remove("is-new");
  } else {
    badgeEl.textContent = "+ New Friend Account";
    badgeEl.classList.add("is-new");
  }
}

function showStatus(el, text, color) {
  if (!el) return;
  el.textContent = text;
  if (color) el.style.color = color;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 2200);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ── Mobile Touch & Mouse Swipe Support ─────────────────── */
let touchStartX = 0;
let touchStartY = 0;
let isDragging  = false;

trackEl.addEventListener("mousedown", (e) => {
  if (e.target.closest("input, button")) return;
  touchStartX = e.clientX;
  isDragging = true;
});

window.addEventListener("mouseup", (e) => {
  if (!isDragging) return;
  isDragging = false;
  const diff = touchStartX - e.clientX;
  if (Math.abs(diff) > 40) {
    if (diff > 0) goToSlide(currentSlide + 1); // Dragged left -> slide right
    else goToSlide(currentSlide - 1);          // Dragged right -> slide left
  }
});

trackEl.addEventListener("touchstart", (e) => {
  if (e.target.closest("input, button")) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

trackEl.addEventListener("touchend", (e) => {
  const diffX = touchStartX - e.changedTouches[0].clientX;
  const diffY = touchStartY - e.changedTouches[0].clientY;
  if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 0) goToSlide(currentSlide + 1);
    else goToSlide(currentSlide - 1);
  }
}, { passive: true });

/* ── Auto Submit & Dashboard Marks Toggles ────────────────── */
autosubmitEl.addEventListener("change", () => {
  chrome.storage.local.set({ [STORAGE_KEYS.autosubmit]: autosubmitEl.checked });
});

if (dashboardMarksEl) {
  dashboardMarksEl.addEventListener("change", () => {
    chrome.storage.local.set({ [STORAGE_KEYS.dashboardMarks]: dashboardMarksEl.checked });
  });
}

/* ── Initialization ──────────────────────────────────────── */
chrome.storage.local.get(
  [
    STORAGE_KEYS.accounts,
    STORAGE_KEYS.activeIndex,
    STORAGE_KEYS.username,
    STORAGE_KEYS.password,
    STORAGE_KEYS.autosubmit,
    STORAGE_KEYS.dashboardMarks,
  ],
  (result) => {
    if (Array.isArray(result[STORAGE_KEYS.accounts]) && result[STORAGE_KEYS.accounts].length > 0) {
      accounts = result[STORAGE_KEYS.accounts];
    } else if (result[STORAGE_KEYS.username]) {
      accounts = [
        {
          username: result[STORAGE_KEYS.username],
          password: result[STORAGE_KEYS.password] || "",
          label: "My Account",
        },
      ];
    } else {
      accounts = [...DEFAULT_ACCOUNTS];
    }

    activeIndex = typeof result[STORAGE_KEYS.activeIndex] === "number"
      ? Math.max(0, Math.min(result[STORAGE_KEYS.activeIndex], accounts.length - 1))
      : 0;

    currentSlide = activeIndex;

    autosubmitEl.checked = result[STORAGE_KEYS.autosubmit] === true;
    if (dashboardMarksEl) {
      // Default to enabled (true) if unset
      dashboardMarksEl.checked = result[STORAGE_KEYS.dashboardMarks] !== false;
    }

    renderCarousel();
  }
);
