/**
 * ViBootX — Marks View Dashboard Integration & Cleaner
 *
 * 1. Injects a scrollable Marks View card on the main dashboard right below Course Data.
 * 2. Formats tables to show:
 *    - Upper table: Sl.No., Course Title, Faculty, Slot ONLY.
 *    - Below / Sub-table: Sl.No., Mark Title, Max. Mark, Scored Mark, Weightage Mark ONLY.
 * 3. Styles with a sleek custom scrollbar.
 * 4. Preloaded with Fall Semester 2026-27 data for instant zero-wait display,
 *    and dynamically fetches live updates from VTOP.
 */

(function () {
  "use strict";

  const CACHE_KEY = "vibootx_cached_marks";
  const DASHBOARD_MARKS_KEY = "vibootx_dashboard_marks";
  let dashboardMarksEnabled = true;
  let isFetching = false;
  let hasInitiatedInitialFetch = false;

  // Read toggle setting immediately on load
  chrome.storage.local.get(DASHBOARD_MARKS_KEY, (res) => {
    dashboardMarksEnabled = res[DASHBOARD_MARKS_KEY] !== false;
    if (!dashboardMarksEnabled) {
      document.getElementById("vx-dashboard-marks-card")?.remove();
    }
  });

  // React to toggle changes in popup without needing page refresh
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && DASHBOARD_MARKS_KEY in changes) {
      dashboardMarksEnabled = changes[DASHBOARD_MARKS_KEY].newValue !== false;
      if (!dashboardMarksEnabled) {
        document.getElementById("vx-dashboard-marks-card")?.remove();
      } else {
        injectDashboardWidget();
      }
    }
  });

  /* ── Fallback Initial Dataset (Fall Semester 2026-27) ─────────────── */
  const DEFAULT_SEMESTER_ID = "VL20262701";
  const DEFAULT_SEMESTER_NAME = "Fall Semester 2026-27";

  const DEFAULT_SEMESTERS = [
    { id: "VL20262701", name: "Fall Semester 2026-27", selected: true },
    { id: "VL20252607", name: "Summer Semester 2025-26", selected: false },
    { id: "VL20252605", name: "Winter Semester 2025-26", selected: false },
    { id: "VL20252601", name: "Fall Semester 2025-26", selected: false },
    { id: "VL20242507", name: "Summer Semester 2024-25", selected: false },
    { id: "VL20242505", name: "Winter Semester 2024-25", selected: false },
    { id: "VL20242501", name: "Fall Semester 2024-25", selected: false },
    { id: "VL20232407", name: "Summer Semester 2023-24", selected: false },
    { id: "VL20232405", name: "Winter Semester 2023-24", selected: false },
  ];

  const DEFAULT_COURSES = [
    {
      sno: "1",
      classNbr: "VL2026270100234",
      code: "ISTS301P",
      title: "Advanced Competitive Coding - I",
      faculty: "ETHNUS (APT)",
      slot: "G2+TG2",
      marks: [
        { sno: "1", title: "Assessment - 1", maxMark: "15", scoredMark: "14.0", weightageMark: "14" },
        { sno: "2", title: "Continuous Assessment Test - I", maxMark: "30", scoredMark: "30.0", weightageMark: "15" }
      ]
    },
    {
      sno: "2",
      classNbr: "VL2026270100271",
      code: "ISWE311L",
      title: "Software Industrialization and Economics",
      faculty: "GUNASEKARAN V",
      slot: "G1+TG1",
      marks: [
        { sno: "1", title: "Continuous Assessment Test - I", maxMark: "50", scoredMark: "35.0", weightageMark: "10.5" },
        { sno: "2", title: "Digital Assignment - I", maxMark: "10", scoredMark: "9.0", weightageMark: "9" },
        { sno: "3", title: "Quiz - I", maxMark: "10", scoredMark: "7.0", weightageMark: "7" }
      ]
    },
    {
      sno: "3",
      classNbr: "VL2026270102174",
      code: "ISWE402L",
      title: "Software Metrics",
      faculty: "RAHAMATHUNNISA U",
      slot: "B2+TB2",
      marks: [
        { sno: "1", title: "Continuous Assessment Test - I", maxMark: "50", scoredMark: "26.0", weightageMark: "7.8" }
      ]
    },
    {
      sno: "4",
      classNbr: "VL2026270102180",
      code: "ISWE404L",
      title: "Design Patterns",
      faculty: "CHANDRASEGAR.T",
      slot: "C2+TC2",
      marks: [
        { sno: "1", title: "Continuous Assessment Test - I", maxMark: "50", scoredMark: "42.0", weightageMark: "12.6" },
        { sno: "2", title: "Quiz - I", maxMark: "10", scoredMark: "7.0", weightageMark: "7" }
      ]
    },
    {
      sno: "5",
      classNbr: "VL2026270102191",
      code: "ISWE410L",
      title: "Machine Learning",
      faculty: "SRINIVASAN  P",
      slot: "D2",
      marks: [
        { sno: "1", title: "Continuous Assessment Test - I", maxMark: "50", scoredMark: "36.0", weightageMark: "10.8" }
      ]
    },
    {
      sno: "6",
      classNbr: "VL2026270102198",
      code: "ISWE410P",
      title: "Machine Learning Lab",
      faculty: "SRINIVASAN  P",
      slot: "L27+L28",
      marks: [
        { sno: "1", title: "Assessment - 1", maxMark: "10", scoredMark: "9.0", weightageMark: "9" },
        { sno: "2", title: "Assessment - 2", maxMark: "10", scoredMark: "10.0", weightageMark: "10" },
        { sno: "3", title: "Assessment - 3", maxMark: "10", scoredMark: "10.0", weightageMark: "10" },
        { sno: "4", title: "Assessment - 4", maxMark: "10", scoredMark: "8.0", weightageMark: "8" },
        { sno: "5", title: "Assessment - 5", maxMark: "10", scoredMark: "9.5", weightageMark: "9.5" },
        { sno: "6", title: "Assessment - 6", maxMark: "10", scoredMark: "9.0", weightageMark: "9" }
      ]
    },
    {
      sno: "7",
      classNbr: "VL2026270102208",
      code: "ISWE411L",
      title: "Deep Learning",
      faculty: "SRIVATHSAVA M",
      slot: "F2+TF2",
      marks: [
        { sno: "1", title: "Continuous Assessment Test - I", maxMark: "50", scoredMark: "44.0", weightageMark: "13.2" }
      ]
    },
    {
      sno: "8",
      classNbr: "VL2026270102242",
      code: "ISWE407L",
      title: "User Interface and User Experience Design",
      faculty: "SANTHOSH KUMAR S V N",
      slot: "A2+TA2",
      marks: [
        { sno: "1", title: "Continuous Assessment Test - I", maxMark: "50", scoredMark: "37.0", weightageMark: "11.1" }
      ]
    },
    {
      sno: "9",
      classNbr: "VL2026270102302",
      code: "ISWE407P",
      title: "User Interface and User Experience Design Lab",
      faculty: "SANTHOSH KUMAR S V N",
      slot: "L29+L30",
      marks: [
        { sno: "1", title: "Assessment - 1", maxMark: "10", scoredMark: "10.0", weightageMark: "10" },
        { sno: "2", title: "Assessment - 2", maxMark: "10", scoredMark: "9.0", weightageMark: "9" },
        { sno: "3", title: "Assessment - 3", maxMark: "10", scoredMark: "9.0", weightageMark: "9" },
        { sno: "4", title: "Assessment - 4", maxMark: "10", scoredMark: "9.0", weightageMark: "9" }
      ]
    }
  ];

  let currentCourses = [...DEFAULT_COURSES];
  let currentSemesters = [...DEFAULT_SEMESTERS];
  let activeSemesterId = DEFAULT_SEMESTER_ID;
  let activeSemesterName = DEFAULT_SEMESTER_NAME;

  /* ── Auth Session Helper ─────────────────────────────────────────── */
  function getAuthSession() {
    const authId =
      document.getElementById("authorizedIDX")?.value ||
      document.getElementById("authorizedID")?.value ||
      document.querySelector('input[name="authorizedID"]')?.value ||
      document.querySelector('input[name="authorizedIDX"]')?.value ||
      "";

    const csrf =
      document.querySelector('input[name="_csrf"]')?.value ||
      document.querySelector('input[name="csrf"]')?.value ||
      "";

    return { authId, csrf };
  }

  function getVtopUrl(endpoint) {
    const clean = endpoint.replace(/^\/?(vtop\/)?/, "");
    return window.location.origin + "/vtop/" + clean;
  }

  /* ── HTML Parser for Marks & Semesters ──────────────────────────── */
  function parseMarksFromDocument(doc) {
    // 1. Parse Available Semesters from select#semesterSubId
    const semSelect = doc.getElementById("semesterSubId");
    const semesters = [];
    let selectedSemId = "";
    let selectedSemName = "";

    if (semSelect) {
      Array.from(semSelect.options).forEach((opt) => {
        if (!opt.value) return; // skip '-- Choose Semester --'
        const isSel = opt.selected || opt.hasAttribute("selected");
        semesters.push({
          id: opt.value,
          name: opt.textContent.trim(),
          selected: isSel,
        });
        if (isSel && !selectedSemId) {
          selectedSemId = opt.value;
          selectedSemName = opt.textContent.trim();
        }
      });
    }

    // 2. Parse Courses and Nested Marks Table
    const tableRoot =
      doc.querySelector("#fixedTableContainer table.customTable") ||
      doc.querySelector("table.customTable");

    const courses = [];
    if (tableRoot) {
      const contentRows = Array.from(tableRoot.querySelectorAll("tr.tableContent"));

      for (let i = 0; i < contentRows.length; i++) {
        const row = contentRows[i];
        const cells = Array.from(row.children).filter((c) => c.tagName === "TD");

        // Main course row (contains 8 or 9 cells)
        if (cells.length >= 8) {
          const course = {
            sno: cells[0]?.textContent?.trim() || String(courses.length + 1),
            classNbr: cells[1]?.textContent?.trim() || "",
            code: cells[2]?.textContent?.trim() || "",
            title: cells[3]?.textContent?.trim() || "",
            type: cells[4]?.textContent?.trim() || "",
            faculty: cells[6]?.textContent?.trim() || "",
            slot: cells[7]?.textContent?.trim() || "",
            marks: [],
          };

          // Check if subsequent row contains the nested level-1 marks table
          const nextRow = contentRows[i + 1];
          if (nextRow && nextRow.querySelector("table.customTable-level1")) {
            const subTable = nextRow.querySelector("table.customTable-level1");
            const markRows = subTable.querySelectorAll("tr.tableContent-level1");

            markRows.forEach((mRow) => {
              const mCells = Array.from(mRow.children).filter((c) => c.tagName === "TD");
              if (mCells.length >= 6) {
                // Keep: Sl.No, Mark Title, Max. Mark, Scored Mark, Weightage Mark
                course.marks.push({
                  sno: mCells[0]?.textContent?.trim() || "",
                  title: mCells[1]?.textContent?.trim() || "",
                  maxMark: mCells[2]?.textContent?.trim() || "",
                  scoredMark: mCells[5]?.textContent?.trim() || "-",
                  weightageMark: mCells[6]?.textContent?.trim() || "-",
                });
              }
            });
            i++; // skip the nested table row
          }

          courses.push(course);
        }
      }
    }

    return { semesters, courses, selectedSemId, selectedSemName };
  }

  /* ── Network Fetcher ─────────────────────────────────────────────── */
  async function fetchMarks(semesterSubId = "") {
    if (isFetching) return null;
    const { authId, csrf } = getAuthSession();
    if (!authId || !csrf) return null;

    isFetching = true;
    try {
      const targetSem = semesterSubId || activeSemesterId || DEFAULT_SEMESTER_ID;

      // 1. Initial menu call to get the page / verify menu session
      const menuUrl = getVtopUrl("examinations/StudentMarkView");
      const menuBody = `verifyMenu=true&authorizedID=${encodeURIComponent(authId)}&_csrf=${encodeURIComponent(csrf)}&nocache=${Date.now()}`;

      const menuRes = await fetch(menuUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: menuBody,
      });

      if (!menuRes.ok) throw new Error("HTTP error on StudentMarkView: " + menuRes.status);
      const menuText = await menuRes.text();

      const parser = new DOMParser();
      const menuDoc = parser.parseFromString(menuText, "text/html");
      const menuParsed = parseMarksFromDocument(menuDoc);

      if (menuParsed.semesters && menuParsed.semesters.length > 0) {
        currentSemesters = menuParsed.semesters;
      }

      // If menu call already returned courses directly, use them!
      if (menuParsed.courses && menuParsed.courses.length > 0) {
        currentCourses = menuParsed.courses;
        if (menuParsed.selectedSemId) activeSemesterId = menuParsed.selectedSemId;
        if (menuParsed.selectedSemName) activeSemesterName = menuParsed.selectedSemName;
        saveCache();
        return menuParsed;
      }

      // 2. Fetch marks for specific semester
      const semEndpoints = [
        "examinations/doStudentMarkView",
        "examinations/doViewExamMark",
        "examinations/StudentMarkView",
      ];

      for (const ep of semEndpoints) {
        try {
          const semUrl = getVtopUrl(ep);
          const semBody = `semesterSubId=${encodeURIComponent(targetSem)}&authorizedID=${encodeURIComponent(authId)}&_csrf=${encodeURIComponent(csrf)}&verifyMenu=true&x=${encodeURIComponent(new Date().toUTCString())}&nocache=${Date.now()}`;

          const semRes = await fetch(semUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
            body: semBody,
          });

          if (semRes.ok) {
            const semText = await semRes.text();
            const semDoc = parser.parseFromString(semText, "text/html");
            const semParsed = parseMarksFromDocument(semDoc);

            if (semParsed.courses && semParsed.courses.length > 0) {
              currentCourses = semParsed.courses;
              activeSemesterId = targetSem;
              const matched = currentSemesters.find((s) => s.id === targetSem);
              if (matched) activeSemesterName = matched.name;
              saveCache();
              return semParsed;
            }
          }
        } catch (_) {}
      }

      return null;
    } catch (err) {
      console.warn("ViBootX: Marks fetch error:", err);
      return null;
    } finally {
      isFetching = false;
    }
  }

  function saveCache() {
    chrome.storage.local.set({
      [CACHE_KEY]: {
        courses: currentCourses,
        semesters: currentSemesters,
        activeSemesterId,
        activeSemesterName,
        time: Date.now(),
      },
    });
  }

  /* ── Render HTML for Dashboard Widget ───────────────────────────── */
  function buildDashboardWidgetHtml(courses, semesters, activeSemName) {
    if (!courses || courses.length === 0) {
      return `
        <div class="vx-empty-marks">
          No marks published yet for ${escapeHtml(activeSemName || "this semester")}.
        </div>`;
    }

    let cardsHtml = "";
    courses.forEach((c) => {
      // Calculate total weightage / scored if available
      let totalWeightage = 0;
      let hasWeightage = false;

      if (c.marks && c.marks.length > 0) {
        c.marks.forEach((m) => {
          const w = parseFloat(m.weightageMark);
          if (!isNaN(w)) {
            totalWeightage += w;
            hasWeightage = true;
          }
        });
      }

      // Build small marks table under the heading
      let subtableContent = "";
      if (c.marks && c.marks.length > 0) {
        let rows = "";
        c.marks.forEach((m) => {
          rows += `
            <tr>
              <td class="text-center text-muted text-nowrap" style="width: 50px;">${escapeHtml(m.sno)}</td>
              <td class="fw-semibold text-dark">${escapeHtml(m.title)}</td>
              <td class="text-center text-secondary text-nowrap">${escapeHtml(m.maxMark)}</td>
              <td class="text-center vx-mark-scored text-nowrap">${escapeHtml(m.scoredMark)}</td>
              <td class="text-center vx-mark-weightage text-nowrap">${escapeHtml(m.weightageMark)}</td>
            </tr>`;
        });

        subtableContent = `
          <table class="table table-sm vx-compact-table">
            <thead>
              <tr>
                <th style="width: 50px;" class="text-center text-nowrap">Sl.No.</th>
                <th>Mark Title</th>
                <th class="text-center text-nowrap">Max. Mark</th>
                <th class="text-center text-nowrap">Scored Mark</th>
                <th class="text-center text-nowrap">Weightage Mark</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>`;
      } else {
        subtableContent = `
          <div class="vx-no-marks-box">
            <span>No marks posted yet for this course</span>
          </div>`;
      }

      // Summary pill (e.g. Total Wt: 29)
      let summaryPill = "";
      if (hasWeightage) {
        const roundedW = Math.round(totalWeightage * 100) / 100;
        summaryPill = `<span class="vx-total-weightage-pill" title="Total Weightage Scored">Total Wt: <strong>${roundedW}</strong></span>`;
      }

      cardsHtml += `
        <div class="vx-subject-card">
          <!-- Heading as Subject Title Bar -->
          <div class="vx-subject-header">
            <div class="vx-sh-left">
              <span class="vx-sh-sno">${escapeHtml(c.sno)}</span>
              <div class="vx-sh-title-wrap">
                <span class="vx-sh-title">${escapeHtml(c.title)}</span>
                ${c.code ? `<span class="vx-sh-code">${escapeHtml(c.code)}</span>` : ""}
              </div>
            </div>
            <div class="vx-sh-right">
              ${c.faculty ? `<span class="vx-sh-faculty" title="Faculty"><span class="vx-sh-label">Faculty:</span> ${escapeHtml(c.faculty)}</span>` : ""}
              ${c.slot ? `<span class="vx-sh-slot" title="Slot">${escapeHtml(c.slot)}</span>` : ""}
              ${summaryPill}
            </div>
          </div>

          <!-- Under Rows: Small Table with Mark Information -->
          <div class="vx-subject-body">
            ${subtableContent}
          </div>
        </div>`;
    });

    return `
      <div class="vx-marks-scroll-container">
        ${cardsHtml}
      </div>`;
  }

  /* ── Dashboard Widget Injector ───────────────────────────────────── */
  async function injectDashboardWidget() {
    if (!dashboardMarksEnabled) {
      document.getElementById("vx-dashboard-marks-card")?.remove();
      return;
    }

    const courseDataCard = document.getElementById("course-data");
    const pagewrapper = document.getElementById("b5-pagewrapper");
    if (!courseDataCard && !pagewrapper) return;

    const existingWidget = document.getElementById("vx-dashboard-marks-card");
    if (existingWidget) {
      // Ensure Marks box stays on TOP, above attendance (#course-data)
      if (courseDataCard && courseDataCard.previousElementSibling !== existingWidget) {
        courseDataCard.insertAdjacentElement("beforebegin", existingWidget);
      }
      return;
    }

    // Load cached marks if available
    try {
      const cached = await new Promise((r) => chrome.storage.local.get(CACHE_KEY, r));
      const cachedData = cached ? cached[CACHE_KEY] : null;
      if (cachedData && cachedData.courses && cachedData.courses.length > 0) {
        currentCourses = cachedData.courses;
        if (cachedData.semesters) currentSemesters = cachedData.semesters;
        if (cachedData.activeSemesterId) activeSemesterId = cachedData.activeSemesterId;
        if (cachedData.activeSemesterName) activeSemesterName = cachedData.activeSemesterName;
      }
    } catch (_) {}

    // Create the widget card container ONCE
    const widgetCard = document.createElement("div");
    widgetCard.id = "vx-dashboard-marks-card";
    widgetCard.className = "card border-2 mb-3 p-0 shadow-sm border-3";

    // Build Card Skeleton with Initial Marks
    widgetCard.innerHTML = `
      <div class="card-header d-flex flex-column flex-md-row align-items-center justify-content-between primaryBorderTop">
        <div class="d-flex align-items-center gap-2">
          <span class="fs-6 fontcolor3 text-nowrap fw-bold">CURRENT SEMESTER MARKS</span>
          <span class="badge bg-primary bg-opacity-10 text-primary fw-bold" id="vx-marks-sem-badge">
            ${escapeHtml(activeSemesterName)}
          </span>
        </div>
        <div class="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <select id="vx-marks-sem-select" class="form-select form-select-sm" style="width: auto; max-width: 220px; font-size: 11px;">
            ${currentSemesters
              .map(
                (s) =>
                  `<option value="${escapeHtml(s.id)}" ${s.id === activeSemesterId ? "selected" : ""}>
                    ${escapeHtml(s.name)}
                  </option>`
              )
              .join("")}
          </select>
          <button id="vx-marks-refresh-btn" class="btn btn-sm btn-outline-primary" style="padding: 2px 8px;" title="Refresh marks">
            ↻
          </button>
        </div>
      </div>
      <div class="card-body p-0 small" id="vx-marks-card-body">
        ${buildDashboardWidgetHtml(currentCourses, currentSemesters, activeSemesterName)}
      </div>`;

    // Insert right before #course-data (Marks box on top, attendance box below)
    if (courseDataCard) {
      courseDataCard.insertAdjacentElement("beforebegin", widgetCard);
    } else {
      const row = pagewrapper.querySelector(".row.p-1") || pagewrapper;
      row.prepend(widgetCard);
    }

    bindWidgetControls();

    // Fetch fresh marks live from server in background
    if (!hasInitiatedInitialFetch) {
      hasInitiatedInitialFetch = true;
      setTimeout(async () => {
        const fresh = await fetchMarks(activeSemesterId);
        if (fresh && fresh.courses && fresh.courses.length > 0) {
          renderDashboardMarks();
        }
      }, 300);
    }
  }

  function renderDashboardMarks() {
    const cardBody = document.getElementById("vx-marks-card-body");
    const semBadge = document.getElementById("vx-marks-sem-badge");
    const semSelect = document.getElementById("vx-marks-sem-select");

    if (semBadge && activeSemesterName) {
      semBadge.textContent = activeSemesterName;
    }

    if (semSelect && currentSemesters.length > 0) {
      semSelect.innerHTML = currentSemesters
        .map(
          (s) =>
            `<option value="${escapeHtml(s.id)}" ${s.id === activeSemesterId ? "selected" : ""}>
              ${escapeHtml(s.name)}
            </option>`
        )
        .join("");
    }

    if (cardBody) {
      cardBody.innerHTML = buildDashboardWidgetHtml(
        currentCourses,
        currentSemesters,
        activeSemesterName
      );
    }
  }

  function bindWidgetControls() {
    const refreshBtn = document.getElementById("vx-marks-refresh-btn");
    const semSelect = document.getElementById("vx-marks-sem-select");

    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = "0.5";
        await fetchMarks(activeSemesterId);
        renderDashboardMarks();
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
      };
    }

    if (semSelect) {
      semSelect.onchange = async () => {
        const chosen = semSelect.value;
        if (!chosen || chosen === activeSemesterId) return;
        activeSemesterId = chosen;
        const matched = currentSemesters.find((s) => s.id === chosen);
        if (matched) activeSemesterName = matched.name;

        renderDashboardMarks();
        await fetchMarks(activeSemesterId);
        renderDashboardMarks();
      };
    }
  }

  /* ── Dedicated Marks Page Enhancer (#studentMarkView) ────────────── */
  function enhanceDedicatedMarksPage() {
    const tableContainer = document.getElementById("fixedTableContainer");
    if (!tableContainer) return;

    if (!tableContainer.classList.contains("vx-styled")) {
      tableContainer.classList.add("vx-styled");

      // Adjust colspan on subtable td elements from 9 to 4
      const colspanTds = tableContainer.querySelectorAll("tr.tableContent > td[colspan]");
      colspanTds.forEach((td) => {
        td.setAttribute("colspan", "4");
      });

      // Parse and cache the marks from this page
      const parsed = parseMarksFromDocument(document);
      if (parsed.courses.length > 0) {
        currentCourses = parsed.courses;
        if (parsed.semesters.length > 0) currentSemesters = parsed.semesters;
        if (parsed.selectedSemId) activeSemesterId = parsed.selectedSemId;
        if (parsed.selectedSemName) activeSemesterName = parsed.selectedSemName;
        saveCache();
      }
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ── Safe Periodic Check ─────────────────────────────────────────── */
  let isChecking = false;
  function checkAndRun() {
    if (isChecking) return;
    isChecking = true;

    try {
      if (document.getElementById("course-data") || document.getElementById("b5-pagewrapper")) {
        injectDashboardWidget();
      }

      if (document.getElementById("studentMarkView") || document.getElementById("fixedTableContainer")) {
        enhanceDedicatedMarksPage();
      }
    } finally {
      isChecking = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndRun, { once: true });
  } else {
    checkAndRun();
  }

  // Periodic poll every 2s for SPA transitions
  window.setInterval(checkAndRun, 2000);
})();
