(() => {
  "use strict";

  const SELECT_ID = "courseId";
  const STORAGE_KEYS = {
    mode: "vibootx_semester_mode",
    accordion: "vibootx_accordion_expanded",
    winter: "vibootx_winter_mappings",
    fall: "vibootx_fall_mappings",
  };

  let currentMode = "all";
  let isAccordionExpanded = true;
  let winterMappings = [];
  let fallMappings = [];

  let activeSelect = null;
  let currentHeaderHost = null;
  let bindInterval = null;
  const originalOptionsCache = new WeakMap();
  const saveFeedbackTimers = new Map();

  function makeId() {
    return `vx_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getSelectElement() {
    return document.getElementById(SELECT_ID);
  }

  function getHeaderAnchor() {
    return document.querySelector(
      ".card-header.primaryBorderTop.row.align-items-center.justify-content-between",
    );
  }

  function getMaterialSearchInput() {
    return document.querySelector("#materialTable_filter input[type='search']");
  }

  function getBucketMappings(bucket) {
    return bucket === "winter" ? winterMappings : fallMappings;
  }

  function setBucketMappings(bucket, value) {
    if (bucket === "winter") {
      winterMappings = value;
    } else {
      fallMappings = value;
    }
  }

  function cleanStoredMappings(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : makeId(),
        subject: String(item.subject || ""),
        faculty: String(item.faculty || ""),
        isSaved: Boolean(item.isSaved),
        isDirty: Boolean(item.isDirty),
      }))
      .filter(
        (item) => item.subject.trim() || item.faculty.trim() || !item.isSaved,
      );
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.mode,
      STORAGE_KEYS.accordion,
      STORAGE_KEYS.winter,
      STORAGE_KEYS.fall,
    ]);

    currentMode = result[STORAGE_KEYS.mode] || "all";
    isAccordionExpanded = result[STORAGE_KEYS.accordion] !== false;
    winterMappings = cleanStoredMappings(result[STORAGE_KEYS.winter]);
    fallMappings = cleanStoredMappings(result[STORAGE_KEYS.fall]);
  }

  async function persistSettings() {
    await chrome.storage.local.set({
      [STORAGE_KEYS.mode]: currentMode,
      [STORAGE_KEYS.accordion]: isAccordionExpanded,
      [STORAGE_KEYS.winter]: winterMappings,
      [STORAGE_KEYS.fall]: fallMappings,
    });
  }

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

  function getSelectedCourseSemester(select) {
    const selected = select?.selectedOptions?.[0];
    return selected ? getSemesterType(selected) : "unknown";
  }

  function getRelevantMappingsForSelectedCourse(select) {
    const semester = getSelectedCourseSemester(select);

    if (semester === "winter") return winterMappings;
    if (semester === "fall") return fallMappings;

    if (currentMode === "winter") return winterMappings;
    if (currentMode === "fall") return fallMappings;

    return [];
  }

  function saveOriginalOptions(select) {
    if (!select || originalOptionsCache.has(select)) return;

    const options = Array.from(select.options).map((opt) => ({
      html: opt.outerHTML,
    }));

    originalOptionsCache.set(select, options);
  }

  function restoreOriginalOptions(select) {
    const original = originalOptionsCache.get(select);
    if (!select || !original) return;

    select.innerHTML = "";
    for (const item of original) {
      select.insertAdjacentHTML("beforeend", item.html);
    }
  }

  function updateActiveModeButtons() {
    const buttons = document.querySelectorAll(".semester-toggle-btn");
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === currentMode);
    });
  }

  function updateAccordionUi() {
    const accordion = document.getElementById("semester-toggle-accordion");
    const chevron = document.getElementById("semester-toggle-chevron");
    if (!accordion || !chevron) return;

    accordion.classList.toggle("expanded", isAccordionExpanded);
    chevron.textContent = isAccordionExpanded ? "▾" : "▸";
    chevron.setAttribute(
      "aria-label",
      isAccordionExpanded ? "Collapse Auto Search" : "Expand Auto Search",
    );
    chevron.title = isAccordionExpanded
      ? "Collapse Auto Search"
      : "Expand Auto Search";
  }

  function injectPanel() {
    const header = getHeaderAnchor();
    if (!header) return;

    header.classList.add("vibootx-header-layout");

    const existingHost = document.getElementById("vibootx-host");
    const existingWrapper = document.getElementById("semester-toggle-wrapper");

    if (existingHost && existingWrapper && currentHeaderHost === header) return;

    if (existingHost) existingHost.remove();

    const host = document.createElement("div");
    host.id = "vibootx-host";

    const wrapper = document.createElement("div");
    wrapper.id = "semester-toggle-wrapper";
    wrapper.innerHTML = `
      <div id="semester-toggle-top">
        <div id="semester-toggle-title">Semester Filter</div>
        <div id="semester-toggle-buttons">
          <button class="semester-toggle-btn" data-mode="all" type="button">All</button>
          <button class="semester-toggle-btn" data-mode="winter" type="button">Winter</button>
          <button class="semester-toggle-btn" data-mode="fall" type="button">Fall</button>
        </div>
        <button id="semester-toggle-chevron" type="button">▾</button>
      </div>

      <div id="semester-toggle-accordion">
        <div id="semester-toggle-accordion-inner">
          <div id="auto-search-panel">
            <div id="auto-search-header">
              <div id="auto-search-title">Auto Search</div>
              <div id="auto-search-subtitle"></div>
            </div>
            <div id="auto-search-rows-scroll">
              <div id="auto-search-rows"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    host.appendChild(wrapper);
    header.appendChild(host);
    currentHeaderHost = header;

    wrapper.querySelectorAll(".semester-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await onModeChange(btn.dataset.mode);
      });
    });

    wrapper
      .querySelector("#semester-toggle-chevron")
      .addEventListener("click", async () => {
        isAccordionExpanded = !isAccordionExpanded;
        updateAccordionUi();
        await persistSettings();
      });

    updateActiveModeButtons();
    updateAccordionUi();
    renderAutoSearchRows();
  }

  async function onModeChange(mode) {
    currentMode = mode;
    filterOptions(mode);
    renderAutoSearchRows();
    updateActiveModeButtons();
    await persistSettings();
  }

  function filterOptions(mode) {
    const select = getSelectElement();
    if (!select) return;

    saveOriginalOptions(select);
    const previousValue = select.value;

    restoreOriginalOptions(select);

    const allOptions = Array.from(select.options);
    const placeholderOptions = allOptions.filter((opt) => !opt.value);
    const realOptions = allOptions.filter((opt) => opt.value);

    let filteredOptions = realOptions;
    if (mode === "winter") {
      filteredOptions = realOptions.filter(
        (opt) => getSemesterType(opt) === "winter",
      );
    } else if (mode === "fall") {
      filteredOptions = realOptions.filter(
        (opt) => getSemesterType(opt) === "fall",
      );
    }

    select.innerHTML = "";
    placeholderOptions.forEach((opt) => select.appendChild(opt));
    filteredOptions.forEach((opt) => select.appendChild(opt));

    const stillExists = Array.from(select.options).some(
      (opt) => opt.value === previousValue,
    );

    if (stillExists) {
      select.value = previousValue;
    } else {
      select.value = "";
    }

    applyMaterialTableAutoSearchWithRetry();
  }

  function findMappingMatch(courseText, list) {
    const normalizedCourse = normalizeText(courseText);
    if (!normalizedCourse) return null;

    return (
      list.find((item) => {
        const subject = normalizeText(item.subject);
        return subject && item.isSaved && normalizedCourse.includes(subject);
      }) || null
    );
  }

  function applyMaterialTableAutoSearchWithRetry(attempt = 0) {
    const select = getSelectElement();
    const selected = select?.selectedOptions?.[0];
    if (!select || !selected || !selected.value) return;

    const mappings = getRelevantMappingsForSelectedCourse(select);
    const match = findMappingMatch(selected.textContent || "", mappings);
    if (!match) return;

    const searchInput = getMaterialSearchInput();
    if (!searchInput) {
      if (attempt < 8) {
        setTimeout(
          () => applyMaterialTableAutoSearchWithRetry(attempt + 1),
          250,
        );
      }
      return;
    }

    const keyword = String(match.faculty || "").trim();
    searchInput.value = keyword;
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("keyup", { bubbles: true }));

    if (window.jQuery && window.jQuery.fn?.dataTable) {
      try {
        const table = window.jQuery("#materialTable").DataTable();
        if (table && typeof table.search === "function") {
          table.search(keyword).draw();
        }
      } catch (_err) {}
    }
  }

  function bindSelect(select) {
    if (!select) return;

    if (activeSelect !== select) {
      activeSelect = select;
      saveOriginalOptions(select);

      if (!select.dataset.vibootxBound) {
        select.addEventListener("change", () => {
          applyMaterialTableAutoSearchWithRetry();
        });
        select.dataset.vibootxBound = "true";
      }
    }

    filterOptions(currentMode);
  }

  function getReadableModeSubtitle() {
    if (currentMode === "winter") return "Editing Winter mappings";
    if (currentMode === "fall") return "Editing Fall mappings";
    return "Viewing Winter first, then Fall";
  }

  function getActionStateClass(mapping) {
    if (!mapping.isSaved) return "grey-tick";
    return mapping.isDirty ? "green-edit" : "grey-edit";
  }

  function getActionStateIcon(mapping) {
    if (!mapping.isSaved) return "✓";
    return "✎";
  }

  function clearFeedbackTimer(mappingId) {
    const existing = saveFeedbackTimers.get(mappingId);
    if (existing) {
      clearTimeout(existing);
      saveFeedbackTimers.delete(mappingId);
    }
  }

  function ensureEditableBucketHasDraft(bucket) {
    const list = getBucketMappings(bucket);
    const hasDraft = list.some((item) => !item.isSaved);
    if (hasDraft) return;

    setBucketMappings(bucket, [
      ...list,
      {
        id: makeId(),
        subject: "",
        faculty: "",
        isSaved: false,
        isDirty: false,
      },
    ]);
  }

  function pruneEmptyDrafts(bucket) {
    const list = getBucketMappings(bucket);
    const drafts = list.filter((item) => !item.isSaved);

    if (drafts.length <= 1) return;

    let keptDraft = false;
    const next = [];

    for (const item of list) {
      if (item.isSaved) {
        next.push(item);
        continue;
      }

      const isEmpty = !item.subject.trim() && !item.faculty.trim();
      if (isEmpty) {
        if (!keptDraft) {
          next.push(item);
          keptDraft = true;
        }
      } else {
        next.push(item);
      }
    }

    setBucketMappings(bucket, next);
  }

  function queueRender() {
    requestAnimationFrame(() => {
      renderAutoSearchRows();
    });
  }

  function flashFirstSaveThenSettle(bucket, mappingId) {
    clearFeedbackTimer(mappingId);

    const timer = setTimeout(async () => {
      const next = getBucketMappings(bucket).map((item) => {
        if (item.id !== mappingId) return item;
        return { ...item, isSaved: true, isDirty: false };
      });

      setBucketMappings(bucket, next);
      await persistSettings();
      queueRender();
      saveFeedbackTimers.delete(mappingId);
    }, 650);

    saveFeedbackTimers.set(mappingId, timer);
  }

  async function saveRow(bucket, mappingId) {
    const list = getBucketMappings(bucket);
    const target = list.find((item) => item.id === mappingId);
    if (!target) return;

    const subject = target.subject.trim();
    const faculty = target.faculty.trim();

    if (!subject || !faculty) return;

    const wasSavedBefore = target.isSaved;

    const next = list.map((item) => {
      if (item.id !== mappingId) return item;
      return {
        ...item,
        subject,
        faculty,
        isSaved: true,
        isDirty: false,
      };
    });

    setBucketMappings(bucket, next);

    if (!wasSavedBefore) {
      ensureEditableBucketHasDraft(bucket);
      await persistSettings();
      queueRender();
      flashFirstSaveThenSettle(bucket, mappingId);
      return;
    }

    await persistSettings();
    queueRender();
    applyMaterialTableAutoSearchWithRetry();
  }

  async function updateRowField(bucket, mappingId, field, value) {
    let changed = false;

    const next = getBucketMappings(bucket).map((item) => {
      if (item.id !== mappingId) return item;

      const updated = { ...item, [field]: value };

      if (item.isSaved) {
        updated.isDirty =
          normalizeText(updated.subject) !== normalizeText(item.subject) ||
          normalizeText(updated.faculty) !== normalizeText(item.faculty)
            ? true
            : item.isDirty;
      }

      changed = true;
      return updated;
    });

    if (!changed) return;

    setBucketMappings(bucket, next);

    const target = next.find((item) => item.id === mappingId);
    if (
      target &&
      !target.isSaved &&
      (target.subject.trim() || target.faculty.trim())
    ) {
      ensureEditableBucketHasDraft(bucket);
    }

    pruneEmptyDrafts(bucket);
    await persistSettings();
    queueRender();
  }

  async function removeUnsavedEmptyRow(bucket, mappingId) {
    const list = getBucketMappings(bucket);
    const target = list.find((item) => item.id === mappingId);
    if (!target) return;

    if (target.isSaved) return;
    if (target.subject.trim() || target.faculty.trim()) return;

    const drafts = list.filter((item) => !item.isSaved);
    if (drafts.length <= 1) return;

    setBucketMappings(
      bucket,
      list.filter((item) => item.id !== mappingId),
    );

    ensureEditableBucketHasDraft(bucket);
    await persistSettings();
    queueRender();
  }

  async function reorderWithinBucket(bucket, draggedId, targetId) {
    const list = [...getBucketMappings(bucket)];
    const fromIndex = list.findIndex((item) => item.id === draggedId);
    const toIndex = list.findIndex((item) => item.id === targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    setBucketMappings(bucket, list);
    await persistSettings();
    queueRender();
  }

  function updateRowButtonVisual(button, mapping) {
    button.className = `action-btn ${getActionStateClass(mapping)}`;
    button.textContent = getActionStateIcon(mapping);

    if (!mapping.isSaved) {
      button.title = "Save new mapping";
    } else if (mapping.isDirty) {
      button.title = "Save changes";
    } else {
      button.title = "Saved mapping";
    }
  }

  function makeEditableRow(mapping, bucket) {
    const row = document.createElement("div");
    row.className = "auto-search-row";
    row.dataset.id = mapping.id;
    row.draggable = true;

    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    dragHandle.textContent = "⋮";
    dragHandle.title = "Drag to reorder";
    row.appendChild(dragHandle);

    const subjectInput = document.createElement("input");
    subjectInput.type = "text";
    subjectInput.placeholder = "Subject name";
    subjectInput.value = mapping.subject;
    row.appendChild(subjectInput);

    const facultyInput = document.createElement("input");
    facultyInput.type = "text";
    facultyInput.placeholder = "Faculty keyword";
    facultyInput.value = mapping.faculty;
    row.appendChild(facultyInput);

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    updateRowButtonVisual(actionBtn, mapping);
    row.appendChild(actionBtn);

    subjectInput.addEventListener("input", async (e) => {
      await updateRowField(bucket, mapping.id, "subject", e.target.value);
    });

    facultyInput.addEventListener("input", async (e) => {
      await updateRowField(bucket, mapping.id, "faculty", e.target.value);
    });

    subjectInput.addEventListener("blur", async () => {
      await removeUnsavedEmptyRow(bucket, mapping.id);
    });

    facultyInput.addEventListener("blur", async () => {
      await removeUnsavedEmptyRow(bucket, mapping.id);
    });

    actionBtn.addEventListener("click", async () => {
      await saveRow(bucket, mapping.id);
    });

    row.addEventListener("dragstart", (e) => {
      row.classList.add("dragging");
      e.dataTransfer.setData("text/plain", mapping.id);
      e.dataTransfer.effectAllowed = "move";
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === mapping.id) return;
      await reorderWithinBucket(bucket, draggedId, mapping.id);
    });

    return row;
  }

  function makeReadonlyRow(mapping, bucketLabel) {
    const row = document.createElement("div");
    row.className = "auto-search-readonly-row";

    const badge = document.createElement("div");
    badge.className = `auto-search-badge ${bucketLabel}`;
    badge.textContent = bucketLabel;
    row.appendChild(badge);

    const subjectCell = document.createElement("div");
    subjectCell.className = "auto-search-readonly-cell";
    subjectCell.title = mapping.subject || "";
    subjectCell.textContent = mapping.subject || "—";
    row.appendChild(subjectCell);

    const facultyCell = document.createElement("div");
    facultyCell.className = "auto-search-readonly-cell";
    facultyCell.title = mapping.faculty || "";
    facultyCell.textContent = mapping.faculty || "—";
    row.appendChild(facultyCell);

    return row;
  }

  function renderAutoSearchRows() {
    const rowsRoot = document.getElementById("auto-search-rows");
    const subtitle = document.getElementById("auto-search-subtitle");
    if (!rowsRoot || !subtitle) return;

    subtitle.textContent = getReadableModeSubtitle();
    rowsRoot.innerHTML = "";

    if (currentMode === "all") {
      const winterSaved = winterMappings.filter((item) => item.isSaved);
      const fallSaved = fallMappings.filter((item) => item.isSaved);

      if (!winterSaved.length && !fallSaved.length) {
        const empty = document.createElement("div");
        empty.className = "auto-search-empty";
        empty.textContent =
          "No saved mappings yet. Switch to Winter or Fall to add mappings.";
        rowsRoot.appendChild(empty);
        return;
      }

      const note = document.createElement("div");
      note.className = "auto-search-mode-note";
      note.textContent =
        "All mode shows combined mappings. To add, edit, or reorder rows, switch to Winter or Fall.";
      rowsRoot.appendChild(note);

      winterSaved.forEach((item) =>
        rowsRoot.appendChild(makeReadonlyRow(item, "winter")),
      );
      fallSaved.forEach((item) =>
        rowsRoot.appendChild(makeReadonlyRow(item, "fall")),
      );
      return;
    }

    const bucket = currentMode;
    ensureEditableBucketHasDraft(bucket);

    getBucketMappings(bucket).forEach((mapping) => {
      rowsRoot.appendChild(makeEditableRow(mapping, bucket));
    });
  }

  function bootstrapBindings() {
    injectPanel();

    const select = getSelectElement();
    if (select) {
      bindSelect(select);
    }
  }

  async function init() {
    await loadSettings();
    bootstrapBindings();

    bindInterval = window.setInterval(() => {
      bootstrapBindings();
    }, 1200);
  }

  init().catch((err) => {
    console.error("ViBootX failed to initialize:", err);
  });
})();
