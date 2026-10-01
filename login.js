/**
 * ViBootX — VTOP Login Automation
 *
 * Handles two pages:
 *   1. /vtop/open/page  → auto-clicks the "Student" login button
 *   2. /vtop/login      → fills username, password, solves captcha, focuses submit
 *
 * Credentials are read from chrome.storage.local (set via the popup).
 * Defaults: username = "Xpytncgswkl", password = "14Sept2018"
 */

(function () {
  "use strict";

  /* ── Storage keys & defaults ─────────────────────────────────────── */

  const STORAGE_KEYS = {
    username:    "vibootx_username",
    password:    "vibootx_password",
    autosubmit:  "vibootx_autosubmit",
    accounts:    "vibootx_accounts",
    activeIndex: "vibootx_active_account_idx",
  };
  const DEFAULT_USERNAME = "Xpytncgswkl";
  const DEFAULT_PASSWORD = "14Sept2018";

  /* ── Captcha selectors (real VTOP login page) ────────────────────── */

  const CAPTCHA_IMG_SELECTORS = [
    ".form-control.img-fluid.bg-light.border-0",   // primary — confirmed in page HTML
    "#captcha_id",
    'img[alt="vtopCaptcha"]',
    'img[src*="captcha" i]',
  ];

  const CAPTCHA_INPUT_SELECTORS = [
    "#captchaStr",             // primary — confirmed in page HTML
    "#captchaString",
    "#captchaStringProgInfo",
    "#captchaCheck",
    'input[name="captchaStr"]',
  ];

  const REFRESH_SELECTORS = [
    "#button-addon2",           // primary — the green refresh button in page HTML
    "#refreshCaptchaProcess",
    "#captchaRefresh",
  ];

  // Submit button — onclick variants and fallbacks seen on VTOP pages
  const SUBMIT_SELECTORS = [
    'button[onclick*="callGoogleValidation"]',  // Google reCAPTCHA flow
    'button[onclick*="callBuiltValidation"]',   // Built-in captcha flow
    'button[onclick*="Validation"]',
    'button[type="submit"].btn-primary',
    'button.btn-primary.float-end',
    '#vtopLoginForm button[type="submit"]',
    '#vtopLoginForm button[type="button"]',
    'button[type="submit"]',
    'input[type="submit"]',
  ];

  const POLL_MS  = 250;
  const POLL_MAX = 30_000;

  /* ── Helpers ─────────────────────────────────────────────────────── */

  function qs(selectorList, root = document) {
    for (const sel of selectorList) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (_) {}
    }
    return null;
  }

  function waitFor(selectorList, timeoutMs = POLL_MAX) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        const el = qs(selectorList);
        if (el) return resolve(el);
        if (Date.now() - start > timeoutMs)
          return reject(new Error("ViBootX: element not found: " + selectorList[0]));
        setTimeout(check, POLL_MS);
      })();
    });
  }

  // React/Angular-compatible value setter
  function fillInput(el, value) {
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (setter) {
      setter.call(el, value);
      el.dispatchEvent(new Event("input",  { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.value = value;
    }
    return true;
  }

  function loadCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [
          STORAGE_KEYS.username,
          STORAGE_KEYS.password,
          STORAGE_KEYS.autosubmit,
          STORAGE_KEYS.accounts,
          STORAGE_KEYS.activeIndex,
        ],
        (result) => {
          let u = result[STORAGE_KEYS.username];
          let p = result[STORAGE_KEYS.password];

          // Fallback to active account from accounts array if available
          if (Array.isArray(result[STORAGE_KEYS.accounts]) && result[STORAGE_KEYS.accounts].length > 0) {
            const idx = typeof result[STORAGE_KEYS.activeIndex] === "number"
              ? Math.max(0, Math.min(result[STORAGE_KEYS.activeIndex], result[STORAGE_KEYS.accounts].length - 1))
              : 0;
            const activeAcc = result[STORAGE_KEYS.accounts][idx];
            if (activeAcc && activeAcc.username) {
              u = activeAcc.username;
              p = activeAcc.password;
            }
          }

          resolve({
            username: u !== undefined && u !== "" ? u : DEFAULT_USERNAME,
            password: p !== undefined && p !== "" ? p : DEFAULT_PASSWORD,
            autosubmit: result[STORAGE_KEYS.autosubmit] === true,
          });
        }
      );
    });
  }

  /* ── UI Pill ─────────────────────────────────────────────────────── */

  let pillEl = null, pillDotEl = null, pillTextEl = null;

  function createPill() {
    if (document.getElementById("vibootx-login-pill")) {
      pillEl     = document.getElementById("vibootx-login-pill");
      pillDotEl  = pillEl.querySelector(".vibootx-pill-dot");
      pillTextEl = pillEl.querySelector(".vibootx-pill-text");
      return;
    }
    pillEl = document.createElement("div");
    pillEl.id = "vibootx-login-pill";

    pillDotEl = document.createElement("div");
    pillDotEl.className = "vibootx-pill-dot";

    const title = document.createElement("span");
    title.className = "vibootx-pill-title";
    title.textContent = "ViBootX";

    pillTextEl = document.createElement("span");
    pillTextEl.className = "vibootx-pill-text";
    pillTextEl.textContent = "Starting…";

    pillEl.appendChild(pillDotEl);
    pillEl.appendChild(title);
    pillEl.appendChild(pillTextEl);
    document.body.appendChild(pillEl);
  }

  function setPill(state, text) {
    if (!pillEl) return;
    ["success", "error", "working"].forEach((s) => {
      pillEl.classList.remove("vibootx-pill-" + s);
      pillDotEl.classList.remove(s);
    });
    if (state) {
      pillEl.classList.add("vibootx-pill-" + state);
      pillDotEl.classList.add(state);
    }
    if (text !== undefined) pillTextEl.textContent = text;
  }

  /* ═══════════════════════════════════════════════════════════════════
   *  PAGE 1 — /vtop/open/page
   *  Auto-click the Student submit button
   * ═══════════════════════════════════════════════════════════════════ */

  async function handleLandingPage() {
    createPill();
    setPill(null, "Looking for Student login…");

    try {
      // The Student card contains an img with src ending in "students.png"
      // Its sibling div has the submit button
      const studentImg = await waitFor([
        'img[src*="students"]',
        'img[src*="student"]',
      ], 10_000);

      // Walk up to the flex container, then find the submit button inside it
      const card = studentImg.closest(".d-flex") || studentImg.closest("form") || studentImg.parentElement;
      const btn  = card?.querySelector('button[type="submit"]')
                || document.querySelector('button[type="submit"].btn-primary');

      if (!btn) {
        setPill("error", "Student button not found");
        return;
      }

      setPill("working", "Clicking Student login…");
      await new Promise((r) => setTimeout(r, 600)); // brief pause so user sees it
      btn.click();
      setPill("success", "→ Navigating to login…");
    } catch (err) {
      setPill("error", "Landing page handler failed");
      console.error("ViBootX landing:", err);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
   *  PAGE 2 — /vtop/login
   *  1. Fill username + password
   *  2. Solve captcha → fill captchaStr
   *  3. Re-solve on captcha refresh
   * ═══════════════════════════════════════════════════════════════════ */

  async function solveCaptcha(imgEl) {
    // Wait until VTOPCaptchaSolver is ready (nn_model.js + captcha_solver.js load first)
    let waited = 0;
    while (!window.VTOPCaptchaSolver && waited < 8000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }
    if (!window.VTOPCaptchaSolver) throw new Error("VTOPCaptchaSolver not loaded");

    const src = imgEl.src || imgEl.getAttribute("src") || "";
    if (!src) throw new Error("Captcha image has no src");
    return await window.VTOPCaptchaSolver.solveFromImage(src);
  }

  async function clickSubmit() {
    const submitBtn = qs(SUBMIT_SELECTORS);
    if (!submitBtn) return false;

    // If button is temporarily disabled, wait briefly for it to enable
    if (submitBtn.disabled) {
      const start = Date.now();
      while (submitBtn.disabled && Date.now() - start < 2000) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    submitBtn.click();
    return true;
  }

  async function solveAndFill(imgEl) {
    setPill("working", "Solving captcha…");
    try {
      const solved = await solveCaptcha(imgEl);
      const input  = qs(CAPTCHA_INPUT_SELECTORS);
      if (input) {
        fillInput(input, solved);

        // Re-read auto-submit setting live (user may have just toggled it)
        const { autosubmit } = await loadCredentials();

        if (autosubmit) {
          setPill("working", `✓ ${solved} — submitting…`);
          await new Promise((r) => setTimeout(r, 400)); // brief pause
          const clicked = await clickSubmit();
          if (clicked) {
            setPill("success", `✓ ${solved} — submitted!`);
          } else {
            setPill("success", `✓ ${solved} — submit btn not found`);
          }
        } else {
          setPill("success", `✓ ${solved} — ready, press Submit`);
          // Just focus the button so Enter key works
          const submitBtn = qs(SUBMIT_SELECTORS);
          if (submitBtn) submitBtn.focus();
        }
      } else {
        setPill("error", `Solved ${solved} — input not found`);
      }
    } catch (err) {
      setPill("error", "Captcha solve failed");
      console.error("ViBootX captcha:", err);
    }
  }

  function watchCaptchaRefresh(imgEl) {
    // Watch the image src for changes (captcha refresh updates the data URI)
    const observer = new MutationObserver(() => solveAndFill(qs(CAPTCHA_IMG_SELECTORS) || imgEl));
    observer.observe(imgEl, { attributes: true, attributeFilter: ["src"] });

    // Also hook the refresh button click
    const refreshBtn = qs(REFRESH_SELECTORS);
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        setPill("working", "Captcha refreshed, solving…");
        setTimeout(async () => {
          const fresh = qs(CAPTCHA_IMG_SELECTORS);
          if (fresh) await solveAndFill(fresh);
        }, 1000);
      }, { capture: true });
    }
  }

  async function handleLoginPage() {
    createPill();

    // 1. Load credentials
    setPill(null, "Loading credentials…");
    const { username, password } = await loadCredentials();

    // 2. Wait for the form fields to appear
    try {
      await waitFor(["#username", "#vtopLoginForm"], 15_000);
    } catch (_) {
      setPill("error", "Login form not found");
      return;
    }

    // 3. Fill username (VTOP forces uppercase via onkeyup — we match that)
    const userEl = document.getElementById("username");
    const passEl = document.getElementById("password");

    if (userEl) fillInput(userEl, username.toUpperCase());
    if (passEl) fillInput(passEl, password);

    setPill(null, `Filled ${username} — checking for captcha…`);

    // 4. Probe for captcha image (short timeout: 2.5s)
    let imgEl = null;
    try {
      imgEl = await waitFor(CAPTCHA_IMG_SELECTORS, 2500);
    } catch (_) {
      // No captcha present within 2.5s
    }

    if (imgEl) {
      setPill("working", "Captcha found — solving…");
      try {
        // Wait for captcha image to have a proper src (data URI)
        await new Promise((resolve) => {
          const check = () => {
            const src = imgEl.src || imgEl.getAttribute("src") || "";
            if (src && (src.length > 100 || src.startsWith("data:"))) return resolve();
            setTimeout(check, 200);
          };
          check();
          setTimeout(resolve, 4000); // fallback
        });

        await solveAndFill(imgEl);
        watchCaptchaRefresh(imgEl);
      } catch (err) {
        setPill("error", "Captcha handling failed");
        console.error("ViBootX login captcha:", err);
      }
    } else {
      // Captcha is not present on this page
      const { autosubmit } = await loadCredentials();
      if (autosubmit) {
        setPill("working", "No captcha needed — submitting…");
        await new Promise((r) => setTimeout(r, 400));
        const clicked = await clickSubmit();
        if (clicked) {
          setPill("success", "Credentials submitted!");
        } else {
          setPill("error", "Submit button not found");
        }
      } else {
        setPill("success", "Credentials filled — press Submit");
        const submitBtn = qs(SUBMIT_SELECTORS);
        if (submitBtn) submitBtn.focus();
      }
    }
  }

  /* ── Router — decide which page we're on ─────────────────────────── */

  async function init() {
    if (!document.body) {
      await new Promise((r) => {
        if (document.readyState !== "loading") return r();
        document.addEventListener("DOMContentLoaded", r, { once: true });
      });
    }

    const path = window.location.pathname;

    if (path.includes("/open/page") || path === "/vtop/" || path === "/vtop") {
      await handleLandingPage();
    } else if (
      path.includes("/login") ||
      path.includes("/vtop/login") ||
      path.includes("initialProcess")
    ) {
      await handleLoginPage();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
