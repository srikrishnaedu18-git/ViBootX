(() => {
  "use strict";

  const SELECT_ID = "courseId";
  let isFiltering = false;
  let currentMode = "all";

  // Map of course IDs to auto-search keywords
  const autoSearchMap = {
    VL_IMAT205L_00100: "discrete",
    VL_ISTS201P_00100: "qualitative",
    VL_ISTS202P_00100: "quantitative",
    VL_ISWE208L_00100: "optimization",
    VL_ISWE209L_00100: "data mining",
    VL_ISWE302L_00100: "artificial intelligence",
    VL_ISWE302P_00100: "ai lab",
    VL_ISWE305L_00100: "software testing",
    VL_ISWE305P_00100: "testing lab",
    VL_ISWE306L_00100: "project management",
    VL_ISWE309L_00100: "cloud computing",
    VL_ISWE401L_00100: "embedded systems",
    VL_ISWE401P_00100: "iot lab",
    VL_ISWE403L_00100: "configuration management",
    VL_ISWE405L_00100: "network security",
    VL_ISWE406L_00100: "agile devops",
    VL_ISWE406P_00100: "devops lab",
    VL_ISWE412L_00100: "priya",
  };

  // Detect semester by text or data-semestr
  function getSemesterType(option) {
    const text = (option.textContent || "").toLowerCase();
    const semCode = option.getAttribute("data-semestr") || "";

    if (text.includes("winter semester") || semCode === "VL20252605") {
      return "winter";
    }

    if (text.includes("fall semester") || semCode === "VL20252601") {
      return "fall";
    }

    return "unknown";
  }

  function getSelectElement() {
    return document.getElementById(SELECT_ID);
  }

  function saveOriginalOptions(select) {
    if (select.dataset.originalOptionsSaved === "true") return;

    const originalOptions = Array.from(select.options).map((opt) => ({
      value: opt.value,
      text: opt.textContent,
      html: opt.outerHTML,
    }));

    select.dataset.originalOptions = JSON.stringify(originalOptions);
    select.dataset.originalOptionsSaved = "true";
  }

  function restoreOriginalOptions(select) {
    const raw = select.dataset.originalOptions;
    if (!raw) return;

    const originalOptions = JSON.parse(raw);
    select.innerHTML = "";

    originalOptions.forEach((item) => {
      select.insertAdjacentHTML("beforeend", item.html);
    });
  }

  function filterOptions(mode, triggerPage = false) {
    const select = getSelectElement();
    if (!select) return;

    if (isFiltering) return;
    isFiltering = true;

    try {
      saveOriginalOptions(select);
      const currentValue = select.value;

      restoreOriginalOptions(select);

      const allOptions = Array.from(select.options);

      // Keep placeholder always
      const placeholderOptions = allOptions.filter((opt) => !opt.value);
      const semesterOptions = allOptions.filter((opt) => opt.value);

      let filteredOptions = semesterOptions;

      if (mode === "winter") {
        filteredOptions = semesterOptions.filter(
          (opt) => getSemesterType(opt) === "winter",
        );
      } else if (mode === "fall") {
        filteredOptions = semesterOptions.filter(
          (opt) => getSemesterType(opt) === "fall",
        );
      }

      select.innerHTML = "";

      placeholderOptions.forEach((opt) => {
        select.appendChild(opt);
      });

      filteredOptions.forEach((opt) => {
        select.appendChild(opt);
      });

      const valueStillExists = Array.from(select.options).some(
        (opt) => opt.value === currentValue,
      );

      if (valueStillExists) {
        select.value = currentValue;
      } else {
        // Keep placeholder selected instead of auto-triggering course detail.
        select.value = "";
      }

      if (triggerPage && select.value) {
        triggerPageChange(select);
      }

      updateActiveButton(mode);
      localStorage.setItem("semesterToggleMode", mode);
      updateNote(select, mode);
      currentMode = mode;
    } finally {
      isFiltering = false;
    }
  }

  function triggerPageChange(select) {
    select.dispatchEvent(new Event("change", { bubbles: true }));

    if (typeof window.getCourseDetail === "function") {
      try {
        window.getCourseDetail(select);
      } catch (err) {
        console.warn("getCourseDetail call failed:", err);
      }
    }
  }

  function updateActiveButton(mode) {
    const buttons = document.querySelectorAll(".semester-toggle-btn");
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  function updateNote(select, mode) {
    const note = document.getElementById("semester-toggle-note");
    if (!note) return;

    const count = Array.from(select.options).filter((opt) => opt.value).length;
    const label =
      mode === "all"
        ? "All semesters"
        : mode === "winter"
          ? "Winter only"
          : "Fall only";

    note.textContent = `${label} • ${count} course(s) shown`;
  }

  function applyMaterialTableAutoSearch() {
    const select = getSelectElement();
    if (!select) return;

    const autoKeyword = autoSearchMap[select.value] || "";
    const searchInput = document.querySelector(
      "#materialTable_filter input[type='search']",
    );
    if (!searchInput) return;

    searchInput.value = autoKeyword;
    const inputEvent = new Event("input", { bubbles: true });
    searchInput.dispatchEvent(inputEvent);

    if (window.jQuery && window.jQuery.fn.dataTable) {
      const table = window.jQuery("#materialTable").DataTable();
      if (table && typeof table.search === "function") {
        table.search(autoKeyword).draw();
      }
    }
  }

  function createToggleUI() {
    if (document.getElementById("semester-toggle-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "semester-toggle-wrapper";

    wrapper.innerHTML = `
      <div id="semester-toggle-minimize" title="Minimize / Expand">−</div>
      <div id="semester-toggle-mini-label">Semester Filter</div>
      <div id="semester-toggle-title">Semester Filter</div>
      <div id="semester-toggle-buttons">
        <button class="semester-toggle-btn" data-mode="all">All</button>
        <button class="semester-toggle-btn" data-mode="winter">Winter</button>
        <button class="semester-toggle-btn" data-mode="fall">Fall</button>
      </div>
      <div id="semester-toggle-note">Waiting for course dropdown...</div>
    `;

    // Insert into card header instead of body
    const header = document.querySelector(
      ".card-header.primaryBorderTop.row.align-items-center.justify-content-between",
    );
    if (header) {
      const container = document.createElement("div");
      container.className = "col-auto ms-auto d-flex align-items-center";
      container.appendChild(wrapper);
      header.appendChild(container);
    } else {
      document.body.appendChild(wrapper);
    }

    wrapper.querySelectorAll(".semester-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        filterOptions(mode, true);
      });
    });

    const minimizeBtn = document.getElementById("semester-toggle-minimize");
    minimizeBtn.addEventListener("click", () => {
      wrapper.classList.toggle("minimized");
      minimizeBtn.textContent = wrapper.classList.contains("minimized")
        ? "+"
        : "−";
    });
  }

  function initWhenReady() {
    const select = getSelectElement();
    if (!select) return false;

    createToggleUI();
    saveOriginalOptions(select);

    const savedMode = localStorage.getItem("semesterToggleMode") || "all";
    filterOptions(savedMode, false);
    applyMaterialTableAutoSearch();

    // Listen for course selection changes
    select.addEventListener("change", applyMaterialTableAutoSearch);

    return true;
  }

  function watchForDropdown() {
    const observer = new MutationObserver((mutations) => {
      if (isFiltering) return;

      const select = getSelectElement();
      const needsReapply = mutations.some((m) => {
        if (m.type !== "childList") return false;
        const hasCourseNode = Array.from(m.addedNodes).some((node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (node.id === SELECT_ID) return true;
          return Boolean(
            node.querySelector && node.querySelector(`#${SELECT_ID}`),
          );
        });
        if (hasCourseNode) return true;

        const changedSelect = m.target && m.target.id === SELECT_ID;
        return changedSelect;
      });

      if (!select || !needsReapply) return;

      createToggleUI();

      if (select.dataset.originalOptionsSaved !== "true") {
        saveOriginalOptions(select);
      }

      const savedMode = localStorage.getItem("semesterToggleMode") || "all";

      if (savedMode !== currentMode || !select.dataset.originalOptionsSaved) {
        filterOptions(savedMode, false);
      }

      applyMaterialTableAutoSearch();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function boot() {
    initWhenReady();
    watchForDropdown();
  }

  boot();
})();
