/**
 * Impact Framework — Pure Direct Drag & Drop, Zero Animation, Zero Shadows
 * Permanent Integrated Docs Silk Smooth Typing Engine
 */

"use strict";

if (typeof window !== "undefined" && typeof document !== "undefined") {

const QUADRANTS = ["q1", "q2", "q3", "q4"];
const STORAGE_KEY = "impact-framework-tasks.v1";

const DEFAULT_TASKS = {
  q1: [
    { id: "t-1", text: "Fix high priority user onboarding friction", done: false },
    { id: "t-2", text: "Ship core value feature to early adopters", done: false }
  ],
  q2: [
    { id: "t-3", text: "Redesign full system database architecture", done: false },
    { id: "t-4", text: "Build automated test & deployment pipeline", done: false }
  ],
  q3: [
    { id: "t-5", text: "Weekly operational review & vendor replies", done: false },
    { id: "t-6", text: "Coordinate routine team sync schedule", done: false }
  ],
  q4: [
    { id: "t-7", text: "Re-organize non-critical document folders", done: false },
    { id: "t-8", text: "Clean up old temporary export files", done: false }
  ]
};

let state = loadState();
let editingId = null;
let editingSubtaskId = null;
let activeSubInputTaskId = null;

// Multi-Device Sync & Auth Session State
const AUTH_STORAGE_KEY = "impact_framework_auth_session";
const SHADOW_ACCOUNTS_KEY = "impact_framework_shadow_accounts";
let isApplyingRemoteUpdate = false;
let isInitialized = false;
let pushSyncTimer = null;
let heartbeatTimer = null;
let lastSyncedAt = null;

// Offscreen canvas for microsecond-precise character width measurements
const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

// Automatically request persistent browser storage so it is never purged
if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

function uid(prefix = "t") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_TASKS));
    const parsed = JSON.parse(raw);
    const out = {};
    let totalCount = 0;
    for (const q of QUADRANTS) {
      out[q] = Array.isArray(parsed[q])
        ? parsed[q].filter((t) => t && typeof t.text === "string").map((t) => {
            let subtasks = [];
            if (Array.isArray(t.subtasks)) {
              subtasks = t.subtasks.map((s) => ({
                id: s.id || uid("sub"),
                text: s.text || "",
                done: !!s.done
              }));
            } else if (Array.isArray(t.bullets)) {
              subtasks = t.bullets.map((b) => ({
                id: uid("sub"),
                text: typeof b === "string" ? b : (b.text || ""),
                done: false
              }));
            }
            return {
              id: t.id || uid(),
              text: t.text,
              done: !!t.done,
              collapsed: typeof t.collapsed === "boolean" ? t.collapsed : false,
              subtasks: subtasks
            };
          })
        : [];
      totalCount += out[q].length;
    }
    if (totalCount === 0 && !localStorage.getItem("impact_board_explicitly_emptied")) {
      return JSON.parse(JSON.stringify(DEFAULT_TASKS));
    }
    return out;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_TASKS));
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!isApplyingRemoteUpdate && isInitialized) {
    scheduleCloudPush();
    broadcastLocalUpdate();
  }
}

function render() {
  for (const q of QUADRANTS) {
    const list = document.querySelector(`.task-list[data-quadrant="${q}"]`);
    if (!list) continue;
    list.textContent = "";
    state[q].forEach((task, index) => {
      list.appendChild(createTaskElement(q, task, index));
    });
  }
  save();

  // If a sub-checklist input is active, focus it automatically
  if (activeSubInputTaskId) {
    requestAnimationFrame(() => {
      const input = document.querySelector(`.task[data-id="${activeSubInputTaskId}"] .subtask-input-active`);
      if (input) {
        input.focus();
      }
    });
  }
}

function createTaskElement(q, task, index) {
  const hasSubtasks = Array.isArray(task.subtasks) && task.subtasks.length > 0;
  const isExpanded = !task.collapsed;

  const li = document.createElement("li");
  li.className = "task" + (task.done ? " done" : "") + (hasSubtasks ? " has-subtasks" : "") + (isExpanded && hasSubtasks ? " expanded" : "");
  li.dataset.id = task.id;
  li.dataset.quadrant = q;

  const numText = typeof index === "number" ? `${index + 1}.` : "";

  // Editing Mode with smooth Docs Silk caret
  if (editingId === task.id) {
    const headerRow = document.createElement("div");
    headerRow.className = "task-header-row";

    if (numText) {
      const num = document.createElement("span");
      num.className = "task-num";
      num.textContent = numText;
      headerRow.appendChild(num);
    }

    const wrap = document.createElement("div");
    wrap.className = "smooth-input-wrap";
    wrap.style.flex = "1";

    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = task.text;
    input.setAttribute("aria-label", "Edit task headline");

    const caret = document.createElement("span");
    caret.className = "smooth-caret";

    wrap.append(input, caret);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        commitEdit(q, task.id, input.value);
      } else if (e.key === "Escape") {
        editingId = null;
        document.body.classList.remove("shift-bottom-active");
        render();
      }
    });

    input.addEventListener("blur", () => commitEdit(q, task.id, input.value));
    headerRow.appendChild(wrap);
    li.appendChild(headerRow);

    requestAnimationFrame(() => {
      if (q === "q3" || q === "q4") {
        document.body.classList.add("shift-bottom-active");
      }
      input.focus();
      input.select();
      bindSmoothCaret(input, caret);
    });
    return li;
  }

  // -------------------------------------------------------------------------
  // Main Task Header Row
  // -------------------------------------------------------------------------
  const headerRow = document.createElement("div");
  headerRow.className = "task-header-row";

  // Fold Button (only if has subtasks or expanding to add them)
  let foldBtn = null;
  if (hasSubtasks || (isExpanded && activeSubInputTaskId === task.id)) {
    foldBtn = document.createElement("button");
    foldBtn.className = "btn-fold-toggle" + (isExpanded ? " open" : "");
    foldBtn.innerHTML = "&#9654;"; // ▶
    foldBtn.title = isExpanded ? "Collapse subtasks" : "Expand subtasks";
    foldBtn.setAttribute("aria-label", "Toggle subtasks");
    foldBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      task.collapsed = !task.collapsed;
      render();
    });
  }

  // Task Number (1, 2, 3...)
  const num = document.createElement("span");
  num.className = "task-num";
  num.textContent = numText;

  // Task Text (Headline)
  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  text.title = "Click to expand & add subtasks • Double-click to edit headline";

  // Single-click expands & opens subtask input; Double-click edits headline
  let headlineClickTimer = null;
  text.addEventListener("click", (e) => {
    e.stopPropagation();
    if (editingId === task.id) return;
    clearTimeout(headlineClickTimer);
    headlineClickTimer = setTimeout(() => {
      task.collapsed = false;
      activeSubInputTaskId = task.id;
      render();
    }, 220);
  });

  text.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    clearTimeout(headlineClickTimer);
    editingId = task.id;
    activeSubInputTaskId = null;
    render();
  });

  // Mobile double-tap detection
  let lastTap = 0;
  text.addEventListener("touchend", (e) => {
    const currentTime = Date.now();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      e.preventDefault();
      clearTimeout(headlineClickTimer);
      editingId = task.id;
      activeSubInputTaskId = null;
      render();
    }
    lastTap = currentTime;
  });

  // Progress Badge Pill (only shown when task has subtasks)
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const allDone = subtasks.length > 0 && doneCount === subtasks.length;

  let progressPill = null;
  if (subtasks.length > 0) {
    progressPill = document.createElement("span");
    progressPill.className = "task-progress-pill" + (allDone ? " all-done" : "");
    progressPill.textContent = `${doneCount}/${subtasks.length} done`;
    progressPill.title = isExpanded ? "Click to collapse subtasks" : "Click to expand subtasks";
    progressPill.addEventListener("click", (e) => {
      e.stopPropagation();
      task.collapsed = !task.collapsed;
      render();
    });
  }

  // Actions Container (Delete button + Square Checkbox at far right)
  const actions = document.createElement("div");
  actions.className = "task-actions";

  // Delete button (subtle × icon)
  const delBtn = document.createElement("button");
  delBtn.className = "btn-delete";
  delBtn.title = "Delete task";
  delBtn.setAttribute("aria-label", "Delete task");
  delBtn.textContent = "\u00D7";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeTask(q, task.id);
  });

  // Square Checkbox at the FAR RIGHT END
  const doneBtn = document.createElement("button");
  doneBtn.className = "task-done-square";
  doneBtn.title = task.done ? "Mark as active" : "Mark as done";
  doneBtn.setAttribute("aria-label", "Toggle done");
  doneBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    task.done = !task.done;
    if (task.done) {
      // Automatically move completed task to the bottom of its quadrant section
      const idx = state[q].findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        const [movedTask] = state[q].splice(idx, 1);
        state[q].push(movedTask);
      }
      logTaskToGoogleSheets("Completed", q, task.text);
    } else {
      // When unmarked as done, move it before the first completed task
      const idx = state[q].findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        const [movedTask] = state[q].splice(idx, 1);
        const firstDoneIdx = state[q].findIndex((other) => other.done);
        if (firstDoneIdx !== -1) {
          state[q].splice(firstDoneIdx, 0, movedTask);
        } else {
          state[q].push(movedTask);
        }
      }
    }
    render();
  });

  actions.append(delBtn, doneBtn);
  if (foldBtn) headerRow.appendChild(foldBtn);
  headerRow.appendChild(num);
  headerRow.appendChild(text);
  if (progressPill) headerRow.appendChild(progressPill);
  headerRow.appendChild(actions);
  li.appendChild(headerRow);

  // -------------------------------------------------------------------------
  // Sub-Checklist Tray (Accordion Content)
  // -------------------------------------------------------------------------
  const isInputActive = activeSubInputTaskId === task.id;
  if (isExpanded && (hasSubtasks || isInputActive)) {
    const tray = document.createElement("div");
    tray.className = "subtask-tray";

    // Subtask List Wrapper
    const subListWrapper = document.createElement("div");
    subListWrapper.className = "subtask-list-wrapper";

    subtasks.forEach((sub, subIdx) => {
      const subItem = document.createElement("div");
      subItem.className = `subtask-item ${sub.done ? "done" : ""}`;
      subItem.dataset.subId = sub.id;
      subItem.dataset.subIdx = subIdx;

      // Drag Grip Handle
      const grip = document.createElement("span");
      grip.className = "subtask-grip";
      grip.innerHTML = "&#8942;&#8942;"; // ⋮⋮
      grip.title = "Drag to reorder subtask up/down";

      // Mini Sub-Checkbox
      const subChk = document.createElement("button");
      subChk.className = "subtask-checkbox";
      subChk.title = sub.done ? "Mark active" : "Mark done";
      subChk.setAttribute("aria-label", "Toggle subtask done");
      subChk.addEventListener("click", (e) => {
        e.stopPropagation();
        sub.done = !sub.done;
        render();
      });

      // Text / Inline Edit Mode
      if (editingSubtaskId === sub.id) {
        const editSubInput = document.createElement("input");
        editSubInput.className = "subtask-edit-input";
        editSubInput.value = sub.text;

        function commitSubEdit() {
          const val = editSubInput.value.trim();
          if (val) sub.text = val;
          else task.subtasks.splice(subIdx, 1);
          editingSubtaskId = null;
          render();
        }

        editSubInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") commitSubEdit();
          else if (e.key === "Escape") {
            editingSubtaskId = null;
            render();
          }
        });
        editSubInput.addEventListener("blur", commitSubEdit);

        subItem.append(grip, subChk, editSubInput);
        subListWrapper.appendChild(subItem);

        requestAnimationFrame(() => {
          editSubInput.focus();
          editSubInput.select();
        });
      } else {
        const subText = document.createElement("span");
        subText.className = "subtask-text";
        subText.textContent = sub.text;
        subText.title = "Double-click to edit subtask";

        // Double-click to edit subtask
        subText.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          editingSubtaskId = sub.id;
          activeSubInputTaskId = null;
          render();
        });

        // Mobile double-tap detection
        let subLastTap = 0;
        subText.addEventListener("touchend", (e) => {
          const cur = Date.now();
          if (cur - subLastTap < 300) {
            e.preventDefault();
            editingSubtaskId = sub.id;
            activeSubInputTaskId = null;
            render();
          }
          subLastTap = cur;
        });

        // Delete subtask button
        const subDel = document.createElement("button");
        subDel.className = "btn-subtask-del";
        subDel.textContent = "\u00D7";
        subDel.title = "Delete subtask";
        subDel.setAttribute("aria-label", "Delete subtask");
        subDel.addEventListener("click", (e) => {
          e.stopPropagation();
          task.subtasks.splice(subIdx, 1);
          render();
        });

        subItem.append(grip, subChk, subText, subDel);
        subListWrapper.appendChild(subItem);

        // Bind Subtask Pointer Drag & Drop Reordering
        setupSubtaskDrag(subItem, grip, task);
      }
    });

    tray.appendChild(subListWrapper);

    // + Add Sub-Checklist Item Input / Button
    const addWrap = document.createElement("div");
    addWrap.className = "add-subtask-wrap";

    if (isInputActive) {
      const dummyChk = document.createElement("div");
      dummyChk.className = "subtask-checkbox";
      dummyChk.style.opacity = "0.4";

      const subInput = document.createElement("input");
      subInput.type = "text";
      subInput.className = "subtask-input-active";
      subInput.placeholder = "+ Add sub-checklist item (Enter = next)...";
      subInput.setAttribute("aria-label", "Add sub-checklist item");

      let isSubmitting = false;

      function commitSubtask(textVal, keepOpen) {
        if (isSubmitting) return;
        isSubmitting = true;
        const val = (textVal || "").trim();
        if (val) {
          if (!task.subtasks) task.subtasks = [];
          task.subtasks.push({
            id: uid("sub"),
            text: val,
            done: false
          });
        }
        activeSubInputTaskId = keepOpen && val ? task.id : null;
        render();
      }

      subInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = subInput.value;
          subInput.value = ""; // clear immediately so blur sees empty
          commitSubtask(val, true); // keep open for continuous typing
        } else if (e.key === "Escape" || (e.key === "Backspace" && subInput.value === "")) {
          subInput.value = "";
          commitSubtask("", false); // close
        }
      });

      // Blur / click outside finalizes what was added
      subInput.addEventListener("blur", () => {
        if (isSubmitting) return;
        const val = subInput.value;
        subInput.value = "";
        commitSubtask(val, false); // close on blur
      });

      addWrap.append(dummyChk, subInput);
    } else {
      const addTriggerBtn = document.createElement("button");
      addTriggerBtn.type = "button";
      addTriggerBtn.className = "btn-add-subtask-trigger";
      addTriggerBtn.innerHTML = "<span>+</span> <span>Add sub-checklist item...</span>";
      addTriggerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeSubInputTaskId = task.id;
        render();
      });

      addWrap.appendChild(addTriggerBtn);
    }

    tray.appendChild(addWrap);
    li.appendChild(tray);
  }

  // Setup Manual Pointer Drag
  setupPointerDrag(li, q, task);

  return li;
}

function commitEdit(q, id, value) {
  if (editingId !== id) return;
  editingId = null;
  document.body.classList.remove("shift-bottom-active");
  const text = value.trim();
  const task = state[q].find((t) => t.id === id);
  if (task && text) {
    task.text = text;
  } else if (task && !text) {
    removeTask(q, id);
    return;
  }
  render();
}

function removeTask(q, id) {
  const task = state[q].find((t) => t.id === id);
  const taskText = task ? task.text : "";
  state[q] = state[q].filter((t) => t.id !== id);
  let totalRemaining = 0;
  for (const qKey of QUADRANTS) {
    totalRemaining += state[qKey].length;
  }
  if (totalRemaining === 0) {
    localStorage.setItem("impact_board_explicitly_emptied", "true");
  }
  render();
  if (taskText) {
    logTaskToGoogleSheets("Deleted", q, taskText);
  }
}

// ==============================================================================
// CLIENT TELEMETRY & ANALYTICS HELPER
// ==============================================================================

// Track page load time for session duration calculation
window._impactSessionStart = window._impactSessionStart || Date.now();

// Helper: Formatted Session Duration (e.g., 42s, 3m 15s)
function getSessionDuration() {
  const diffSec = Math.max(0, Math.floor((Date.now() - (window._impactSessionStart || Date.now())) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}m ${secs}s`;
}

// Helper: Screen Orientation (Portrait / Landscape)
function getScreenOrientation() {
  try {
    if (window.screen && window.screen.orientation && window.screen.orientation.type) {
      const type = window.screen.orientation.type;
      if (type.includes("portrait")) return "Portrait";
      if (type.includes("landscape")) return "Landscape";
      return type;
    }
  } catch (e) {}
  return window.innerWidth >= window.innerHeight ? "Landscape" : "Portrait";
}

// Helper: Network Speed & Connection Info
function getNetworkSpeed() {
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      const parts = [];
      if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
      if (conn.downlink) parts.push(`${conn.downlink} Mbps`);
      if (conn.rtt) parts.push(`${conn.rtt}ms RTT`);
      if (parts.length > 0) return parts.join(" • ");
    }
  } catch (e) {}
  return navigator.onLine ? "Online" : "Offline";
}

// Helper: Parse Operating System accurately
function getClientOS() {
  const ua = navigator.userAgent || "";
  if (/windows phone/i.test(ua)) return "Windows Phone";
  if (/win(dows )?nt 10\.0/i.test(ua)) return "Windows 10/11";
  if (/win(dows )?nt 6\.3/i.test(ua)) return "Windows 8.1";
  if (/win(dows )?nt 6\.2/i.test(ua)) return "Windows 8";
  if (/win(dows )?nt 6\.1/i.test(ua)) return "Windows 7";
  if (/windows/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9\.]+)/i);
    return match ? `Android ${match[1]}` : "Android";
  }
  if (/ipad|iphone|ipod/i.test(ua)) {
    const match = ua.match(/OS\s([0-9_]+)/i);
    return match ? `iOS ${match[1].replace(/_/g, ".")}` : "iOS";
  }
  if (/macintosh|mac os x/i.test(ua)) {
    const match = ua.match(/Mac OS X\s([0-9_]+)/i);
    return match ? `macOS ${match[1].replace(/_/g, ".")}` : "macOS";
  }
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown OS";
}

// Helper: Parse Browser and Major Version
function getClientBrowser() {
  const ua = navigator.userAgent || "";
  let name = "Unknown Browser";
  let version = "";

  if (/edg\/([0-9\.]+)/i.test(ua)) {
    name = "Edge";
    version = ua.match(/edg\/([0-9\.]+)/i)[1].split(".")[0];
  } else if (/opr\/([0-9\.]+)/i.test(ua) || /opera/i.test(ua)) {
    name = "Opera";
    version = (ua.match(/opr\/([0-9\.]+)/i) || [])[1] || "";
  } else if (/samsungbrowser\/([0-9\.]+)/i.test(ua)) {
    name = "Samsung Internet";
    version = ua.match(/samsungbrowser\/([0-9\.]+)/i)[1].split(".")[0];
  } else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) {
    name = "Chrome";
    const m = ua.match(/(?:chrome|crios)\/([0-9\.]+)/i);
    version = m ? m[1].split(".")[0] : "";
  } else if (/firefox|fxios/i.test(ua)) {
    name = "Firefox";
    const m = ua.match(/(?:firefox|fxios)\/([0-9\.]+)/i);
    version = m ? m[1].split(".")[0] : "";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    name = "Safari";
    const m = ua.match(/version\/([0-9\.]+)/i);
    version = m ? m[1].split(".")[0] : "";
  }

  return version ? `${name} ${version}` : name;
}

// Helper: Device Category
function getDeviceType() {
  const ua = navigator.userAgent || "";
  const width = window.innerWidth || screen.width;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "Tablet";
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua) || width <= 768) {
    return "Mobile";
  }
  return "Desktop";
}

// Helper: Visit count tracker (persisted in localStorage)
function getVisitCount() {
  let count = 1;
  try {
    count = parseInt(localStorage.getItem("impact_visit_count") || "0", 10);
    if (!sessionStorage.getItem("impact_session_counted")) {
      count += 1;
      localStorage.setItem("impact_visit_count", count.toString());
      sessionStorage.setItem("impact_session_counted", "1");
    }
  } catch (e) {}
  return count || 1;
}

// Pre-fetch IP Geolocation on app load and cache in sessionStorage
function prefetchGeoData() {
  try {
    const cached = sessionStorage.getItem("impact_geo_data");
    if (cached) return;
    fetch("https://ipwho.is/")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success !== false) {
          sessionStorage.setItem(
            "impact_geo_data",
            JSON.stringify({
              ip: data.ip || "",
              city: data.city || "",
              region: data.region || "",
              country: data.country || "",
              country_code: data.country_code || "",
              isp: (data.connection && (data.connection.isp || data.connection.org)) || "",
              timezone: (data.timezone && data.timezone.id) || ""
            })
          );
        }
      })
      .catch(() => {});
  } catch (e) {}
}

// Helper to gather complete telemetry snapshot
function getClientTelemetry() {
  let geo = {};
  try {
    geo = JSON.parse(sessionStorage.getItem("impact_geo_data") || "{}");
  } catch (e) {}

  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch (e) {
    timezone = geo.timezone || "";
  }

  let referrer = "Direct";
  try {
    if (document.referrer) {
      const parsed = new URL(document.referrer);
      referrer = parsed.hostname || document.referrer;
    }
  } catch (e) {
    referrer = document.referrer || "Direct";
  }

  const dpr = window.devicePixelRatio ? `@${window.devicePixelRatio}x` : "";
  const screenRes = `${window.screen.width}x${window.screen.height} ${dpr}`.trim();

  return {
    os: getClientOS(),
    browser: getClientBrowser(),
    device: getDeviceType(),
    screen_resolution: screenRes,
    screen_orientation: getScreenOrientation(),
    network_speed: getNetworkSpeed(),
    session_duration: getSessionDuration(),
    timezone: timezone || "Asia/Kolkata",
    language: navigator.language || (navigator.languages && navigator.languages[0]) || "en",
    referrer: referrer,
    visit_count: getVisitCount(),
    ip: geo.ip || "",
    city: geo.city || "",
    region: geo.region || "",
    country: geo.country || "",
    country_code: geo.country_code || "",
    isp: geo.isp || ""
  };
}

// Persistent Anonymous User ID
function getAnonymousUserId() {
  let uid = localStorage.getItem("impact_framework_anon_uid");
  if (!uid) {
    uid = "usr_" + Math.random().toString(36).substring(2, 7) + Date.now().toString(36).slice(-3);
    try {
      localStorage.setItem("impact_framework_anon_uid", uid);
    } catch (e) {}
  }
  return uid;
}

const QUADRANT_NAMES = {
  q1: "High Impact, Easy (Do First)",
  q2: "High Impact, Hard (Schedule)",
  q3: "Low Impact, Easy (Delegate)",
  q4: "Low Impact, Hard (Eliminate)"
};

// Silent Background Task Logger to Google Sheets (NO Email Sent)
function logTaskToGoogleSheets(action, q, text) {
  if (!text || !text.trim()) return;
  const url = (window.IMPACT_CONFIG && window.IMPACT_CONFIG.googleWebhookUrl) || 
    "https://script.google.com/macros/s/AKfycbxA0SIv6IiO-fkWbSUiV6Vwp6XmwFutVEeCjgPmPiQQlTNuiIZ5uqlJrlIvOOGlUvaK/exec";
  if (!url) return;

  const telemetry = getClientTelemetry();

  const payload = {
    type: "task",
    uid: getAnonymousUserId(),
    action: action || "Added", // "Added" | "Completed" | "Deleted"
    quadrant: q,
    quadrant_title: QUADRANT_NAMES[q] || q,
    task_text: text.trim(),

    // Telemetry & Visitor Analytics
    city: telemetry.city,
    region: telemetry.region,
    country: telemetry.country,
    country_code: telemetry.country_code,
    isp: telemetry.isp,
    ip: telemetry.ip,
    device: telemetry.device,
    os: telemetry.os,
    browser: telemetry.browser,
    screen_resolution: telemetry.screen_resolution,
    screen_orientation: telemetry.screen_orientation,
    network_speed: telemetry.network_speed,
    session_duration: telemetry.session_duration,
    timezone: telemetry.timezone,
    language: telemetry.language,
    referrer: telemetry.referrer,
    visit_count: telemetry.visit_count,

    app_version: "v1.2.0",
    timestamp: new Date().toISOString()
  };

  try {
    fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (err) {}
}

function initAddForms() {
  document.querySelectorAll(".add-form").forEach((form) => {
    const q = form.dataset.quadrant;
    const input = form.querySelector("input");
    const caret = form.querySelector(".smooth-caret");

    if (input && caret) {
      bindSmoothCaret(input, caret);
    }

    // On mobile: when focusing Q3 or Q4 (bottom row), shift UI up so input sits clearly above keypad
    input.addEventListener("focus", () => {
      if (q === "q3" || q === "q4") {
        document.body.classList.add("shift-bottom-active");
      } else {
        document.body.classList.remove("shift-bottom-active");
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        const active = document.activeElement;
        const activeQuadrant = active?.closest("[data-quadrant]")?.dataset?.quadrant;
        if (activeQuadrant !== "q3" && activeQuadrant !== "q4") {
          document.body.classList.remove("shift-bottom-active");
        }
      }, 60);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      localStorage.removeItem("impact_board_explicitly_emptied");
      const newTask = {
        id: uid(),
        text,
        done: false,
        collapsed: false,
        subtasks: []
      };
      state[q].unshift(newTask);
      input.value = "";
      activeSubInputTaskId = newTask.id; // Automatically open tray and focus + add sub-checklist item!
      render();

      // Silent sync to Google Sheet "User Tasks" tab
      logTaskToGoogleSheets("ADDED", q, text);

      // On mobile view: dismiss keypad and slide UI back down smoothly
      if (window.innerWidth <= 640 || "ontouchstart" in window) {
        input.blur();
        document.body.classList.remove("shift-bottom-active");
      } else {
        input.focus();
      }
    });
  });
}

/* ==========================================================================
   Google Docs Silk Smooth Caret Engine (Gliding Cursor & Fluid Backspace)
   ========================================================================== */
function bindSmoothCaret(input, caret) {
  let typingTimer = null;

  function updateCaretPosition() {
    const style = window.getComputedStyle(input);
    measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    const cursorPos = input.selectionStart || 0;
    const textBefore = input.value.slice(0, cursorPos);
    const measuredWidth = measureCtx.measureText(textBefore).width;

    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const newLeft = Math.round(paddingLeft + measuredWidth);

    caret.style.left = `${newLeft}px`;

    // Caret stays solid during active typing/backspacing, pulses when paused
    caret.classList.add("visible", "typing");
    caret.classList.remove("blinking");

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      caret.classList.remove("typing");
      caret.classList.add("blinking");
    }, 450);
  }

  input.addEventListener("focus", () => {
    caret.classList.add("visible");
    updateCaretPosition();
  });

  input.addEventListener("blur", () => {
    caret.classList.remove("visible", "typing", "blinking");
    clearTimeout(typingTimer);
  });

  input.addEventListener("input", updateCaretPosition);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" || e.key.startsWith("Arrow")) {
      requestAnimationFrame(updateCaretPosition);
    }
  });

  input.addEventListener("click", updateCaretPosition);
  input.addEventListener("keyup", updateCaretPosition);
}

/* ==========================================================================
   Subtask Pointer Drag & Drop Reordering (Up & Down within parent task)
   ========================================================================== */
function setupSubtaskDrag(subItem, gripEl, task) {
  gripEl.addEventListener("pointerdown", (e) => {
    e.stopPropagation();

    const startY = e.clientY;
    const subId = subItem.dataset.subId;
    const subIdx = parseInt(subItem.dataset.subIdx, 10);
    let isDragging = false;
    let floatingEl = null;
    let dropIndicator = null;
    let insertIndex = subIdx;
    const trayWrapper = subItem.closest(".subtask-list-wrapper");
    if (!trayWrapper) return;

    function onPointerMove(moveEvt) {
      const dy = moveEvt.clientY - startY;
      if (!isDragging && Math.abs(dy) > 3) {
        isDragging = true;
        const rect = subItem.getBoundingClientRect();

        floatingEl = document.createElement("div");
        floatingEl.className = "dragged-subtask-floating";
        floatingEl.style.width = rect.width + "px";
        floatingEl.style.left = rect.left + "px";
        floatingEl.style.top = (moveEvt.clientY - 12) + "px";
        floatingEl.innerHTML = subItem.innerHTML;
        document.body.appendChild(floatingEl);

        subItem.classList.add("being-dragged");
        dropIndicator = document.createElement("div");
        dropIndicator.className = "drop-indicator-line";
      }

      if (isDragging && floatingEl) {
        floatingEl.style.top = (moveEvt.clientY - 12) + "px";

        const siblings = [...trayWrapper.querySelectorAll(".subtask-item:not(.being-dragged)")];
        let found = false;

        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];
          const sRect = sib.getBoundingClientRect();
          if (moveEvt.clientY < sRect.top + sRect.height / 2) {
            trayWrapper.insertBefore(dropIndicator, sib);
            insertIndex = parseInt(sib.dataset.subIdx, 10);
            found = true;
            break;
          }
        }

        if (!found) {
          trayWrapper.appendChild(dropIndicator);
          insertIndex = task.subtasks.length;
        }
      }
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (isDragging) {
        if (floatingEl && floatingEl.parentNode) floatingEl.parentNode.removeChild(floatingEl);
        if (dropIndicator && dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);

        const fromIdx = task.subtasks.findIndex(s => s.id === subId);
        if (fromIdx !== -1) {
          const [moved] = task.subtasks.splice(fromIdx, 1);
          let targetIdx = insertIndex;
          if (fromIdx < targetIdx) targetIdx = Math.max(0, targetIdx - 1);
          if (targetIdx > task.subtasks.length) targetIdx = task.subtasks.length;
          task.subtasks.splice(targetIdx, 0, moved);
        }
        render();
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  });
}

/* ==========================================================================
   Pure Manual Pointer Drag & Drop (Zero Shadow, Zero Ghosting, Zero Animation)
   ========================================================================== */
function setupPointerDrag(li, fromQuadrant, task) {
  li.addEventListener("pointerdown", (e) => {
    if (editingId === task.id || e.target.closest("button, input, .subtask-tray")) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    let floatingEl = null;
    let dropIndicator = null;
    let currentTargetQuadrant = fromQuadrant;
    let currentInsertIndex = state[fromQuadrant].findIndex((t) => t.id === task.id);
    let offsetX = 0;
    let offsetY = 0;

    function onPointerMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true;

        const rect = li.getBoundingClientRect();
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;

        // Solid physical card
        floatingEl = document.createElement("div");
        floatingEl.className = "dragged-task-floating" + (task.done ? " done" : "");
        floatingEl.style.width = rect.width + "px";
        floatingEl.style.left = (moveEvent.clientX - offsetX) + "px";
        floatingEl.style.top = (moveEvent.clientY - offsetY) + "px";

        const numSpan = document.createElement("span");
        numSpan.className = "task-num";
        numSpan.textContent = li.querySelector(".task-num")?.textContent || "";

        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = task.text;

        const square = document.createElement("div");
        square.className = "task-done-square";

        floatingEl.append(numSpan, textSpan, square);
        document.body.appendChild(floatingEl);

        // Completely hide original from list
        li.classList.add("being-dragged");

        dropIndicator = document.createElement("div");
        dropIndicator.className = "drop-indicator-line";
      }

      if (isDragging && floatingEl) {
        floatingEl.style.left = (moveEvent.clientX - offsetX) + "px";
        floatingEl.style.top = (moveEvent.clientY - offsetY) + "px";

        const elemBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const quad = elemBelow ? elemBelow.closest(".quadrant") : null;

        if (quad) {
          currentTargetQuadrant = quad.dataset.quadrant;
          const list = quad.querySelector(".task-list");
          const visibleTasks = [...list.querySelectorAll(".task:not(.being-dragged)")];

          let foundTarget = false;
          for (let i = 0; i < visibleTasks.length; i++) {
            const item = visibleTasks[i];
            const itemRect = item.getBoundingClientRect();
            if (moveEvent.clientY < itemRect.top + itemRect.height / 2) {
              list.insertBefore(dropIndicator, item);
              const targetId = item.dataset.id;
              currentInsertIndex = state[currentTargetQuadrant].findIndex((t) => t.id === targetId);
              foundTarget = true;
              break;
            }
          }

          if (!foundTarget) {
            list.appendChild(dropIndicator);
            currentInsertIndex = state[currentTargetQuadrant].length;
          }
        }
      }
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (isDragging) {
        if (floatingEl && floatingEl.parentNode) {
          floatingEl.parentNode.removeChild(floatingEl);
        }
        if (dropIndicator && dropIndicator.parentNode) {
          dropIndicator.parentNode.removeChild(dropIndicator);
        }

        const fromIndex = state[fromQuadrant].findIndex((t) => t.id === task.id);
        if (fromIndex !== -1) {
          const [movedTask] = state[fromQuadrant].splice(fromIndex, 1);

          if (fromQuadrant === currentTargetQuadrant && fromIndex < currentInsertIndex) {
            currentInsertIndex = Math.max(0, currentInsertIndex - 1);
          }

          if (currentInsertIndex < 0 || currentInsertIndex > state[currentTargetQuadrant].length) {
            currentInsertIndex = state[currentTargetQuadrant].length;
          }

          state[currentTargetQuadrant].splice(currentInsertIndex, 0, movedTask);
        }

        render();
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  });
}

/* ==========================================================================
   Contact Drawer Controller (Depth Parallax Entry & Distractionless Rating)
   ========================================================================== */
function initContactDrawer() {
  const contactBtn = document.getElementById("contactBtn");
  const drawer = document.getElementById("contactDrawer");
  const overlay = document.getElementById("drawerOverlay");
  const closeBtn = document.getElementById("drawerCloseBtn");
  const copyBtn = document.getElementById("copyEmailBtn");
  const starsBar = document.getElementById("starsBar");
  const ratingFeedback = document.getElementById("ratingFeedback");

  if (!contactBtn || !drawer || !overlay) return;

  const GMAIL = "nandanbhole72@gmail.com";
  const RATING_KEY = "impact-framework-user-rating";

  function openDrawer() {
    overlay.classList.add("open");
    drawer.classList.add("open");
    document.body.classList.add("drawer-open");
  }

  function closeDrawer() {
    overlay.classList.remove("open");
    drawer.classList.remove("open");
    document.body.classList.remove("drawer-open");
  }

  contactBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // 1-Click Email Copy
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(GMAIL).then(() => {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = "<span>Copied! ✓</span>";
        copyBtn.style.background = "#27ae60";
        copyBtn.style.color = "#ffffff";
        copyBtn.style.borderColor = "#27ae60";
        setTimeout(() => {
          copyBtn.innerHTML = originalHtml;
          copyBtn.style.background = "";
          copyBtn.style.color = "";
          copyBtn.style.borderColor = "";
        }, 1800);
      });
    });
  }

  const GOOGLE_WEBHOOK_URL = (window.IMPACT_CONFIG && window.IMPACT_CONFIG.googleWebhookUrl) || 
    "https://script.google.com/macros/s/AKfycbxA0SIv6IiO-fkWbSUiV6Vwp6XmwFutVEeCjgPmPiQQlTNuiIZ5uqlJrlIvOOGlUvaK/exec";

  // Floating Focus Card Modal Elements
  const focusModalBackdrop = document.getElementById("focusReviewBackdrop");
  const focusCloseBtn = document.getElementById("focusReviewCloseBtn");
  const focusCancelBtn = document.getElementById("focusReviewCancelBtn");
  const focusPostBtn = document.getElementById("focusReviewPostBtn");
  const focusTextarea = document.getElementById("focusReviewText");
  const focusCharCounter = document.getElementById("focusCharCounter");
  const focusStarsRow = document.getElementById("focusStarsRow");
  const focusStarBtns = focusStarsRow ? focusStarsRow.querySelectorAll(".focus-star-btn") : [];
  const writeReviewLink = document.getElementById("writeReviewLink");

  let activeModalRating = 5;

  // Clear any previously locked rating so user can rate repeatedly
  try {
    localStorage.removeItem(RATING_KEY);
  } catch (e) {}

  // Distractionless Star Rating & Modal Trigger
  if (starsBar) {
    const starBtns = starsBar.querySelectorAll(".rate-star-btn, .star-btn");

    starBtns.forEach((btn) => {
      const rating = parseInt(btn.dataset.rating, 10);

      // Hover feedback on Section 3 stars
      btn.addEventListener("pointerenter", () => {
        starBtns.forEach((s) => {
          const r = parseInt(s.dataset.rating, 10);
          s.classList.toggle("hovered", r <= rating);
        });
      });

      // Tapping any star opens the Floating Focus Card modal
      btn.addEventListener("click", () => {
        openFocusModal(rating || 5);
      });
    });

    starsBar.addEventListener("pointerleave", () => {
      starBtns.forEach((s) => s.classList.remove("hovered"));
    });

    function highlightStars(val) {
      starBtns.forEach((s) => {
        const r = parseInt(s.dataset.rating, 10);
        s.classList.toggle("active", r <= val);
        s.classList.remove("hovered");
      });
    }

    // "Write a review" link also opens the modal
    if (writeReviewLink) {
      writeReviewLink.addEventListener("click", (e) => {
        e.preventDefault();
        openFocusModal(5);
      });
    }

    // Modal Star Handlers
    focusStarBtns.forEach((btn) => {
      const r = parseInt(btn.dataset.rating, 10);

      btn.addEventListener("pointerenter", () => {
        highlightModalStars(r);
      });

      btn.addEventListener("click", () => {
        activeModalRating = r;
        highlightModalStars(r);
      });
    });

    if (focusStarsRow) {
      focusStarsRow.addEventListener("pointerleave", () => {
        highlightModalStars(activeModalRating);
      });
    }

    function highlightModalStars(val) {
      focusStarBtns.forEach((btn) => {
        const r = parseInt(btn.dataset.rating, 10);
        btn.classList.toggle("active", r <= val);
      });
    }

    // Modal Character Counter
    if (focusTextarea && focusCharCounter) {
      focusTextarea.addEventListener("input", () => {
        const len = focusTextarea.value.length;
        focusCharCounter.textContent = `${len}/500`;
        focusCharCounter.classList.toggle("limit-near", len > 450);
      });
    }

    // Modal Open & Close Functions
    function openFocusModal(rating) {
      activeModalRating = rating || 5;
      highlightModalStars(activeModalRating);
      if (focusModalBackdrop) {
        focusModalBackdrop.classList.add("is-open");
        focusModalBackdrop.setAttribute("aria-hidden", "false");
      }
      setTimeout(() => {
        if (focusTextarea) focusTextarea.focus();
      }, 150);
    }

    function closeFocusModal() {
      if (focusModalBackdrop) {
        focusModalBackdrop.classList.remove("is-open");
        focusModalBackdrop.setAttribute("aria-hidden", "true");
      }
    }

    if (focusCloseBtn) focusCloseBtn.addEventListener("click", closeFocusModal);
    if (focusCancelBtn) focusCancelBtn.addEventListener("click", closeFocusModal);
    if (focusModalBackdrop) {
      focusModalBackdrop.addEventListener("click", (e) => {
        if (e.target === focusModalBackdrop) closeFocusModal();
      });
    }

    // Post Review Handler (Optimized for both mobile touch and desktop click)
    let isSubmitting = false;

    function handlePostReview(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isSubmitting) return;
      isSubmitting = true;

      const rating = activeModalRating || 5;
      const reviewText = focusTextarea ? focusTextarea.value.trim() : "";
      const isMobile = window.innerWidth <= 768;

      // Blur textarea immediately so mobile keypad dismisses
      if (focusTextarea) focusTextarea.blur();

      // Visual feedback on the button
      if (focusPostBtn) {
        focusPostBtn.textContent = "Posting...";
        focusPostBtn.style.opacity = "0.7";
      }

      const telemetry = getClientTelemetry();

      // Build Payload for Google Sheets & Gmail
      const payload = {
        type: "review",
        uid: getAnonymousUserId(),
        rating: rating,
        review: reviewText,
        character_count: reviewText.length,

        // Telemetry & Visitor Analytics
        city: telemetry.city,
        region: telemetry.region,
        country: telemetry.country,
        country_code: telemetry.country_code,
        isp: telemetry.isp,
        ip: telemetry.ip,
        device: telemetry.device,
        os: telemetry.os,
        browser: telemetry.browser,
        screen_resolution: telemetry.screen_resolution,
        screen_orientation: telemetry.screen_orientation,
        network_speed: telemetry.network_speed,
        session_duration: telemetry.session_duration,
        timezone: telemetry.timezone,
        language: telemetry.language,
        referrer: telemetry.referrer,
        visit_count: telemetry.visit_count,

        app_version: "v1.2.0",
        timestamp: new Date().toISOString()
      };

      // Fire sync to Google Sheets & Instant Gmail
      sendReviewToGoogleSheetsAndGmail(payload);

      // Show feedback without permanently locking rating in localStorage
      highlightStars(rating);
      if (ratingFeedback) {
        ratingFeedback.textContent = `Thank you. Your ${rating}-star review was posted.`;
      }

      if (focusTextarea) focusTextarea.value = "";
      if (focusCharCounter) focusCharCounter.textContent = "0/500";

      setTimeout(() => {
        closeFocusModal();
        if (focusPostBtn) {
          focusPostBtn.textContent = "Post";
          focusPostBtn.style.opacity = "1";
        }
        isSubmitting = false;
      }, 300);

      // Reset stars after 3.5 seconds so user can rate repeatedly
      setTimeout(() => {
        highlightStars(0);
        if (ratingFeedback) {
          ratingFeedback.textContent = "";
        }
      }, 3500);
    }

    if (focusPostBtn) {
      focusPostBtn.addEventListener("pointerdown", handlePostReview);
      focusPostBtn.addEventListener("click", handlePostReview);
    }

    // Helper: Async sync to Google Sheets & Instant Gmail
    function sendReviewToGoogleSheetsAndGmail(payload) {
      // 1. Safe local persistent backup
      try {
        const existing = JSON.parse(localStorage.getItem("impact-framework-reviews-backup") || "[]");
        existing.push(payload);
        localStorage.setItem("impact-framework-reviews-backup", JSON.stringify(existing));
      } catch (e) {}

      // 2. Dispatch to Google Apps Script Webhook
      const url = GOOGLE_WEBHOOK_URL;
      if (!url) return;

      const jsonPayload = JSON.stringify(payload);

      // Direct POST fetch with text/plain (Bypasses sendBeacon 302 drops on mobile)
      try {
        fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: jsonPayload
        }).catch((err) => {
          console.warn("Background review sync warning:", err);
        });
      } catch (err) {
        console.warn("Fetch error:", err);
      }
    }
  }
}

/* ==========================================================================
   Cross-Device Account Authentication & Automated Sync Engine
   ========================================================================== */

// Multi-Tab Local Synchronization via BroadcastChannel
let syncChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    syncChannel = new BroadcastChannel("impact_framework_sync");
    syncChannel.onmessage = (event) => {
      if (event.data && event.data.type === "tasks_updated") {
        if (!editingId && document.activeElement?.tagName !== "INPUT") {
          isApplyingRemoteUpdate = true;
          state = loadState();
          render();
          isApplyingRemoteUpdate = false;
          updateSyncStatusBadge("synced", "Synced (Multi-Tab)");
        }
      }
    };
  }
} catch (e) {}

function broadcastLocalUpdate() {
  try {
    if (syncChannel) {
      syncChannel.postMessage({ type: "tasks_updated", timestamp: Date.now() });
    }
  } catch (e) {}
}

// Listen to storage events for cross-tab sync in browsers without BroadcastChannel
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY && !isApplyingRemoteUpdate) {
    if (!editingId && document.activeElement?.tagName !== "INPUT") {
      isApplyingRemoteUpdate = true;
      state = loadState();
      render();
      isApplyingRemoteUpdate = false;
      updateSyncStatusBadge("synced", "Synced (Multi-Tab)");
    }
  }
  if (e.key === AUTH_STORAGE_KEY) {
    updateAccountUI();
  }
});

function getAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.username) return session;
  } catch (e) {}
  return null;
}

function saveAuthSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {}
  updateAccountUI();
}

function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {}
  updateAccountUI();
}

function formatTimeAgo(date) {
  if (!date || isNaN(date.getTime())) return "Just now";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function updateSyncStatusBadge(status, text) {
  const syncStatusBadge = document.getElementById("syncStatusBadge");
  const syncStatusText = document.getElementById("syncStatusText");
  const headerSyncPill = document.getElementById("headerSyncPill");
  const headerDot = headerSyncPill ? headerSyncPill.querySelector(".sync-status-dot") : null;
  const syncNowBtn = document.getElementById("manualSyncBtn");

  if (syncStatusBadge) {
    syncStatusBadge.className = "account-badge-pill " + status;
  }
  if (syncStatusText && text) {
    syncStatusText.textContent = text;
  }
  if (headerDot) {
    headerDot.className = "sync-status-dot " + status;
  }
  if (syncNowBtn) {
    if (status === "syncing") {
      syncNowBtn.classList.add("syncing");
    } else {
      syncNowBtn.classList.remove("syncing");
    }
  }
}

function updateAccountUI() {
  const session = getAuthSession();
  const notSignedInCard = document.getElementById("accountNotSignedIn");
  const signedInCard = document.getElementById("accountSignedIn");
  const headerSyncPill = document.getElementById("headerSyncPill");
  const headerSyncUser = document.getElementById("headerSyncUser");
  const accountUsername = document.getElementById("accountUsername");
  const accountAvatar = document.getElementById("accountAvatar");
  const accountLastSync = document.getElementById("accountLastSync");

  if (!session) {
    if (notSignedInCard) notSignedInCard.style.display = "block";
    if (signedInCard) signedInCard.style.display = "none";
    if (headerSyncPill) headerSyncPill.style.display = "none";
  } else {
    if (notSignedInCard) notSignedInCard.style.display = "none";
    if (signedInCard) signedInCard.style.display = "block";
    if (accountUsername) accountUsername.textContent = session.username;
    if (accountAvatar) {
      accountAvatar.textContent = (session.username.charAt(0) || "U").toUpperCase();
    }
    if (headerSyncPill) {
      headerSyncPill.style.display = "inline-flex";
      if (headerSyncUser) headerSyncUser.textContent = session.username;
    }
    if (accountLastSync) {
      accountLastSync.textContent = lastSyncedAt ? formatTimeAgo(new Date(lastSyncedAt)) : "Just now";
    }
    updateSyncStatusBadge("synced", "Cloud Synced");
  }
}

// API Communication with Google Apps Script & Shadow Store fallback
async function sendApiRequest(payload) {
  const url = (window.IMPACT_CONFIG && window.IMPACT_CONFIG.googleWebhookUrl) || "";
  let shadowAccounts = {};
  try {
    shadowAccounts = JSON.parse(localStorage.getItem(SHADOW_ACCOUNTS_KEY) || "{}");
  } catch (e) {}

  // 1. Try Google Apps Script remote endpoint if configured
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status) {
          // Detect outdated Google Apps Script (e.g. older script returns type: "review" instead of action)
          const isAuthOrSync = payload.type && (payload.type.startsWith("auth_") || payload.type.startsWith("sync_"));
          if (isAuthOrSync && (data.type === "review" || (!data.action && data.status === "success"))) {
            console.warn("Outdated Google Apps Script Web App detected: Please update Google Apps Script code in Google Sheets.", data);
            return {
              status: "error",
              isOutdatedScript: true,
              message: "Google Sheet backend needs update: Open Extensions > Apps Script in your Google Sheet and deploy the latest script code to enable cloud sync."
            };
          }

          // Mirror to shadow store for instant multi-tab parity
          if (payload.type === "auth_register" && data.status === "success") {
            shadowAccounts[payload.username.toLowerCase()] = {
              password: payload.password,
              tasks: payload.tasks,
              updatedAt: data.updatedAt,
              token: data.token
            };
            try { localStorage.setItem(SHADOW_ACCOUNTS_KEY, JSON.stringify(shadowAccounts)); } catch (e) {}
          } else if (payload.type === "sync_push" && data.status === "success") {
            const u = payload.username.toLowerCase();
            if (shadowAccounts[u]) {
              shadowAccounts[u].tasks = payload.tasks;
              shadowAccounts[u].updatedAt = data.updatedAt;
              try { localStorage.setItem(SHADOW_ACCOUNTS_KEY, JSON.stringify(shadowAccounts)); } catch (e) {}
            }
          }
          return data;
        }
      }
    } catch (netErr) {
      console.warn("Remote sync endpoint warning (using shadow store fallback):", netErr);
    }
  }

  // 2. Seamless local shadow fallback (allows instant multi-device / multi-tab verification)
  if (payload.type === "auth_register" || payload.action === "register") {
    const u = payload.username.trim().toLowerCase();
    if (shadowAccounts[u]) {
      return { status: "error", message: `Username '${payload.username}' is already taken. Please choose another or sign in.` };
    }
    const token = "tok_" + Math.random().toString(36).substring(2, 12);
    const updatedAt = new Date().toISOString();
    shadowAccounts[u] = {
      password: payload.password,
      tasks: payload.tasks || state,
      updatedAt: updatedAt,
      token: token
    };
    try { localStorage.setItem(SHADOW_ACCOUNTS_KEY, JSON.stringify(shadowAccounts)); } catch (e) {}
    return {
      status: "success",
      username: payload.username,
      token: token,
      tasks: payload.tasks || state,
      updatedAt: updatedAt
    };
  }

  if (payload.type === "auth_login" || payload.action === "login") {
    const u = payload.username.trim().toLowerCase();
    const acc = shadowAccounts[u];
    if (!acc) {
      return { status: "error", message: `Account '${payload.username}' not found. Check username or create an account.` };
    }
    if (acc.password !== payload.password) {
      return { status: "error", message: "Incorrect password. Please try again." };
    }
    return {
      status: "success",
      username: payload.username,
      token: acc.token,
      tasks: acc.tasks || { q1: [], q2: [], q3: [], q4: [] },
      updatedAt: acc.updatedAt
    };
  }

  if (payload.type === "sync_push" || payload.action === "push") {
    const u = payload.username.trim().toLowerCase();
    const acc = shadowAccounts[u];
    if (acc) {
      const updatedAt = new Date().toISOString();
      acc.tasks = payload.tasks;
      acc.updatedAt = updatedAt;
      try { localStorage.setItem(SHADOW_ACCOUNTS_KEY, JSON.stringify(shadowAccounts)); } catch (e) {}
      return { status: "success", updatedAt: updatedAt };
    }
    return { status: "error", message: "Account not found for sync." };
  }

  if (payload.type === "sync_pull" || payload.action === "pull") {
    const u = payload.username.trim().toLowerCase();
    const acc = shadowAccounts[u];
    if (acc) {
      const hasUpdate = !payload.lastSyncedAt || acc.updatedAt > payload.lastSyncedAt;
      return {
        status: "success",
        hasUpdate: hasUpdate,
        tasks: hasUpdate ? acc.tasks : null,
        updatedAt: acc.updatedAt
      };
    }
    return { status: "error", message: "Account not found." };
  }

  throw new Error("Unable to complete request.");
}

function scheduleCloudPush() {
  if (!isInitialized) return;
  const session = getAuthSession();
  if (!session) return;

  updateSyncStatusBadge("syncing", "Syncing...");

  clearTimeout(pushSyncTimer);
  pushSyncTimer = setTimeout(() => {
    executeCloudPush();
  }, 1000);
}

async function executeCloudPush() {
  const session = getAuthSession();
  if (!session) return;

  const payload = {
    type: "sync_push",
    username: session.username,
    token: session.token,
    tasks: state,
    clientUpdatedAt: new Date().toISOString(),
    device: getDeviceType(),
    os: getClientOS()
  };

  try {
    const res = await sendApiRequest(payload);
    if (res && res.status === "success") {
      lastSyncedAt = res.updatedAt || new Date().toISOString();
      updateSyncStatusBadge("synced", "Cloud Synced");
      const accountLastSync = document.getElementById("accountLastSync");
      if (accountLastSync) accountLastSync.textContent = "Just now";
    } else if (res && res.isOutdatedScript) {
      updateSyncStatusBadge("error", "Update Sheet script");
      const accountLastSync = document.getElementById("accountLastSync");
      if (accountLastSync) accountLastSync.textContent = "Apps Script update required";
    } else {
      updateSyncStatusBadge("error", "Sync warning");
    }
  } catch (err) {
    console.warn("Push error:", err);
    updateSyncStatusBadge("offline", "Offline (Saved locally)");
  }
}

async function executeCloudPull(isManual = false) {
  const session = getAuthSession();
  if (!session) return;

  if (editingId !== null || (document.activeElement && document.activeElement.tagName === "INPUT")) {
    return;
  }

  if (isManual) {
    updateSyncStatusBadge("syncing", "Checking cloud...");
  }

  const payload = {
    type: "sync_pull",
    username: session.username,
    token: session.token,
    lastSyncedAt: isManual ? "" : (lastSyncedAt || ""),
    force: isManual
  };

  try {
    const res = await sendApiRequest(payload);
    if (res && res.status === "success") {
      if (res.hasUpdate && res.tasks) {
        isApplyingRemoteUpdate = true;
        state = res.tasks;
        save();
        render();
        isApplyingRemoteUpdate = false;
        lastSyncedAt = res.updatedAt || new Date().toISOString();
        broadcastLocalUpdate();
        updateSyncStatusBadge("synced", "Synced from cloud ✓");
        const accountLastSync = document.getElementById("accountLastSync");
        if (accountLastSync) accountLastSync.textContent = "Just now";
      } else {
        if (res.updatedAt) lastSyncedAt = res.updatedAt;
        updateSyncStatusBadge("synced", "Cloud Synced");
        const accountLastSync = document.getElementById("accountLastSync");
        if (accountLastSync) accountLastSync.textContent = "Just now";
      }
    } else if (res && res.isOutdatedScript) {
      updateSyncStatusBadge("error", "Update Sheet script");
      const accountLastSync = document.getElementById("accountLastSync");
      if (accountLastSync) accountLastSync.textContent = "Apps Script update required";
    } else if (isManual) {
      updateSyncStatusBadge("offline", "Sync offline");
    }
  } catch (err) {
    if (isManual) {
      updateSyncStatusBadge("offline", "Sync offline");
    }
  }
}

function initAuthAndSync() {
  const openCreateBtn = document.getElementById("openCreateAccountBtn");
  const openSignInBtn = document.getElementById("openSignInBtn");
  const authModalBackdrop = document.getElementById("authModalBackdrop");
  const authCloseBtn = document.getElementById("authModalCloseBtn");
  const authCancelBtn = document.getElementById("authCancelBtn");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authForm = document.getElementById("authForm");
  const authUsername = document.getElementById("authUsername");
  const authPassword = document.getElementById("authPassword");
  const authTogglePwd = document.getElementById("authTogglePwd");
  const tabCreate = document.getElementById("tabCreateAccount");
  const tabSignIn = document.getElementById("tabSignIn");
  const authTitle = document.getElementById("authModalTitle");
  const authNotice = document.getElementById("authNotice");
  const authStatusMsg = document.getElementById("authStatusMsg");
  const signOutBtn = document.getElementById("signOutBtn");
  const manualSyncBtn = document.getElementById("manualSyncBtn");
  const headerSyncPill = document.getElementById("headerSyncPill");

  let authMode = "register"; // "register" | "login"
  let isSubmittingAuth = false;

  function setAuthMode(mode) {
    authMode = mode;
    if (authStatusMsg) {
      authStatusMsg.style.display = "none";
      authStatusMsg.textContent = "";
    }
    if (mode === "register") {
      if (tabCreate) { tabCreate.classList.add("active"); tabCreate.setAttribute("aria-selected", "true"); }
      if (tabSignIn) { tabSignIn.classList.remove("active"); tabSignIn.setAttribute("aria-selected", "false"); }
      if (authTitle) authTitle.textContent = "Create Account";
      if (authSubmitBtn) authSubmitBtn.textContent = "Create Account & Sync";
      if (authNotice) authNotice.textContent = "Creating an account saves your current board to the cloud so you can access it on all your devices.";
    } else {
      if (tabSignIn) { tabSignIn.classList.add("active"); tabSignIn.setAttribute("aria-selected", "true"); }
      if (tabCreate) { tabCreate.classList.remove("active"); tabCreate.setAttribute("aria-selected", "false"); }
      if (authTitle) authTitle.textContent = "Sign In";
      if (authSubmitBtn) authSubmitBtn.textContent = "Sign In & Sync";
      if (authNotice) authNotice.textContent = "Signing in fetches your latest board from the cloud and connects this device.";
    }
  }

  function openAuthModal(mode) {
    setAuthMode(mode);
    if (authUsername) authUsername.value = "";
    if (authPassword) authPassword.value = "";
    if (authModalBackdrop) {
      authModalBackdrop.classList.add("is-open");
      authModalBackdrop.setAttribute("aria-hidden", "false");
    }
    setTimeout(() => {
      if (authUsername) authUsername.focus();
    }, 150);
  }

  function closeAuthModal() {
    if (authModalBackdrop) {
      authModalBackdrop.classList.remove("is-open");
      authModalBackdrop.setAttribute("aria-hidden", "true");
    }
    if (authStatusMsg) {
      authStatusMsg.style.display = "none";
    }
  }

  if (openCreateBtn) openCreateBtn.addEventListener("click", () => openAuthModal("register"));
  if (openSignInBtn) openSignInBtn.addEventListener("click", () => openAuthModal("login"));
  if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthModal);
  if (authCancelBtn) authCancelBtn.addEventListener("click", closeAuthModal);

  if (authModalBackdrop) {
    authModalBackdrop.addEventListener("click", (e) => {
      if (e.target === authModalBackdrop) closeAuthModal();
    });
  }

  if (tabCreate) tabCreate.addEventListener("click", () => setAuthMode("register"));
  if (tabSignIn) tabSignIn.addEventListener("click", () => setAuthMode("login"));

  // Toggle Password Visibility
  if (authTogglePwd && authPassword) {
    authTogglePwd.addEventListener("click", () => {
      const isPwd = authPassword.type === "password";
      authPassword.type = isPwd ? "text" : "password";
      authTogglePwd.style.opacity = isPwd ? "1" : "0.7";
    });
  }

  // Handle Form Submit
  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSubmittingAuth) return;

      const user = (authUsername?.value || "").trim();
      const pass = authPassword?.value || "";

      if (user.length < 3) {
        showAuthError("Username must be at least 3 characters long.");
        return;
      }
      if (!/^[a-zA-Z0-9_\-\.]+$/.test(user)) {
        showAuthError("Username can only contain letters, numbers, hyphens, and underscores.");
        return;
      }
      if (pass.length < 4) {
        showAuthError("Password must be at least 4 characters long.");
        return;
      }

      isSubmittingAuth = true;
      if (authSubmitBtn) {
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = authMode === "register" ? "Creating..." : "Signing in...";
      }

      const payload = {
        type: authMode === "register" ? "auth_register" : "auth_login",
        username: user,
        password: pass,
        tasks: state,
        device: getDeviceType(),
        os: getClientOS()
      };

      try {
        const res = await sendApiRequest(payload);
        if (res && res.status === "success") {
          saveAuthSession({
            username: res.username || user,
            token: res.token,
            signedInAt: Date.now()
          });

          if (authMode === "login" && res.tasks) {
            isApplyingRemoteUpdate = true;
            state = res.tasks;
            save();
            render();
            isApplyingRemoteUpdate = false;
            broadcastLocalUpdate();
          } else if (authMode === "register") {
            lastSyncedAt = res.updatedAt || new Date().toISOString();
          }

          closeAuthModal();
          updateSyncStatusBadge("synced", "Cloud Synced");
        } else {
          showAuthError(res?.message || "Authentication failed. Please try again.");
        }
      } catch (err) {
        showAuthError("Connection error: " + (err.message || "Failed to reach server"));
      } finally {
        isSubmittingAuth = false;
        if (authSubmitBtn) {
          authSubmitBtn.disabled = false;
          authSubmitBtn.textContent = authMode === "register" ? "Create Account & Sync" : "Sign In & Sync";
        }
      }
    });
  }

  function showAuthError(msg) {
    if (authStatusMsg) {
      authStatusMsg.className = "auth-status-msg error";
      authStatusMsg.textContent = msg;
      authStatusMsg.style.display = "block";
    }
  }

  // Handle Sign Out (Tactile 2-step inline confirmation, zero browser freeze)
  if (signOutBtn) {
    let signOutPending = false;
    let signOutTimer = null;
    signOutBtn.addEventListener("click", () => {
      if (!signOutPending) {
        signOutPending = true;
        signOutBtn.textContent = "Confirm?";
        signOutBtn.style.color = "#ffffff";
        signOutBtn.style.background = "#c54242";
        signOutBtn.style.borderColor = "#c54242";
        clearTimeout(signOutTimer);
        signOutTimer = setTimeout(() => {
          signOutPending = false;
          signOutBtn.textContent = "Sign Out";
          signOutBtn.style.color = "";
          signOutBtn.style.background = "";
          signOutBtn.style.borderColor = "";
        }, 3500);
      } else {
        clearTimeout(signOutTimer);
        signOutPending = false;
        signOutBtn.textContent = "Sign Out";
        signOutBtn.style.color = "";
        signOutBtn.style.background = "";
        signOutBtn.style.borderColor = "";
        clearAuthSession();
        updateSyncStatusBadge("offline", "Local Device");
      }
    });
  }

  // Handle Manual Sync
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener("click", async () => {
      await executeCloudPull(true);
      await executeCloudPush();
    });
  }

  // Header pill click opens contact drawer
  if (headerSyncPill) {
    headerSyncPill.addEventListener("click", () => {
      const contactBtn = document.getElementById("contactBtn");
      if (contactBtn) contactBtn.click();
    });
  }

  // Sync Triggers: Window focus & Visibility change
  window.addEventListener("focus", () => executeCloudPull());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      executeCloudPull();
    }
  });

  // Heartbeat Polling: Every 6 seconds while tab is active and visible
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible" && !document.hidden && getAuthSession()) {
      executeCloudPull();
    }
  }, 6000);

  // Initialize UI
  updateAccountUI();
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  prefetchGeoData();
  initAddForms();
  initContactDrawer();
  initAuthAndSync();
  render();
  isInitialized = true;

  if (getAuthSession()) {
    executeCloudPull();
  }

  // Dismiss active input and keypad when tapping outside on mobile
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#contactDrawer") || e.target.closest("#contactBtn") || e.target.closest("#authModalBackdrop")) return;
    if (!e.target.closest(".add-form") && !e.target.closest(".smooth-input-wrap")) {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        active.blur();
        document.body.classList.remove("shift-bottom-active");
      }
    }
  });
});

}

