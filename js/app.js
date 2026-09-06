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
    { id: "t-5", text: "Weekly operational review & vendor replies", done: false }
  ],
  q4: [
    { id: "t-6", text: "Re-organize non-critical document folders", done: false }
  ]
};

let state = loadState();
let editingId = null;

const GOOGLE_WEBHOOK_URL = (typeof window !== "undefined" && window.IMPACT_CONFIG && window.IMPACT_CONFIG.googleWebhookUrl) || 
  "https://script.google.com/macros/s/AKfycbxA0SIv6IiO-fkWbSUiV6Vwp6XmwFutVEeCjgPmPiQQlTNuiIZ5uqlJrlIvOOGlUvaK/exec";

// Offscreen canvas for microsecond-precise character width measurements
const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

// Automatically request persistent browser storage so it is never purged
if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_TASKS));
    const parsed = JSON.parse(raw);
    const out = {};
    for (const q of QUADRANTS) {
      out[q] = Array.isArray(parsed[q])
        ? parsed[q].filter((t) => t && typeof t.text === "string")
        : [];
    }
    return out;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_TASKS));
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (typeof triggerCloudSyncDebounced === "function") {
    triggerCloudSyncDebounced();
  }
}

function render() {
  for (const q of QUADRANTS) {
    const list = document.querySelector(`.task-list[data-quadrant="${q}"]`);
    if (!list) continue;
    list.textContent = "";
    for (const task of state[q]) {
      list.appendChild(createTaskElement(q, task));
    }
  }
  save();
}

function createTaskElement(q, task) {
  const li = document.createElement("li");
  li.className = "task" + (task.done ? " done" : "");
  li.dataset.id = task.id;
  li.dataset.quadrant = q;

  // Editing Mode with smooth Docs Silk caret
  if (editingId === task.id) {
    const wrap = document.createElement("div");
    wrap.className = "smooth-input-wrap";
    wrap.style.flex = "1";

    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = task.text;
    input.setAttribute("aria-label", "Edit task");

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
    li.appendChild(wrap);

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

  // Task Text (Double-click or double-tap only to edit)
  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  text.title = "Double-click to edit";

  text.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    editingId = task.id;
    render();
  });

  // Mobile double-tap detection
  let lastTap = 0;
  text.addEventListener("touchend", (e) => {
    const currentTime = Date.now();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      e.preventDefault();
      editingId = task.id;
      render();
    }
    lastTap = currentTime;
  });

  // Actions Container (Delete button + Square Checkbox at far right)
  const actions = document.createElement("div");
  actions.className = "task-actions";

  // Delete button (subtle × icon)
  const delBtn = document.createElement("button");
  delBtn.className = "btn-delete";
  delBtn.title = "Delete";
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
    render();
    if (task.done) {
      logTaskToGoogleSheets("Completed", q, task.text);
    }
  });

  actions.append(delBtn, doneBtn);
  li.append(text, actions);

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
      state[q].push({ id: uid(), text, done: false });
      input.value = "";
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
   Pure Manual Pointer Drag & Drop (Zero Shadow, Zero Ghosting, Zero Animation)
   ========================================================================== */
function setupPointerDrag(li, fromQuadrant, task) {
  li.addEventListener("pointerdown", (e) => {
    if (editingId === task.id || e.target.closest("button, input")) return;

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

        const textSpan = document.createElement("span");
        textSpan.className = "task-text";
        textSpan.textContent = task.text;

        const square = document.createElement("div");
        square.className = "task-done-square";

        floatingEl.append(textSpan, square);
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
     Link Device Controller (Zero-Login 6-Digit Code Cross-Device Sync)
     ========================================================================== */
  function getDevicePairingCode() {
    let code = localStorage.getItem("impact_device_pairing_code");
    if (!code || !/^\d{6}$/.test(code)) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      localStorage.setItem("impact_device_pairing_code", code);
    }
    return code;
  }

  function getActiveSyncCode() {
    return localStorage.getItem("impact_linked_code") || getDevicePairingCode();
  }

  function formatPairingCode(code) {
    const clean = String(code || "").replace(/\D/g, "");
    if (clean.length <= 3) return clean;
    return clean.slice(0, 3) + "-" + clean.slice(3, 6);
  }

  let isCloudPulling = false;
  let cloudSyncTimeout = null;

  function triggerCloudSyncDebounced() {
    if (isCloudPulling) return;
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    cloudSyncTimeout = setTimeout(() => {
      syncBoardToCloud();
    }, 1200);
  }

  function syncBoardToCloud(customCode) {
    const code = customCode || getActiveSyncCode();
    const cleanCode = String(code).replace(/\D/g, "");
    if (!cleanCode || cleanCode.length !== 6) return;

    const url = GOOGLE_WEBHOOK_URL;
    if (!url) return;

    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const payload = {
      type: "sync_tasks",
      code: cleanCode,
      tasks: state,
      device: isMobile ? "Mobile" : "Desktop",
      uid: getDevicePairingCode()
    };

    try {
      fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).catch((err) => {
        console.warn("Cloud sync warning:", err);
      });
    } catch (err) {
      console.warn("Cloud sync error:", err);
    }
  }

  async function fetchTasksFromCloud(code) {
    const cleanCode = String(code || "").replace(/\D/g, "");
    if (!cleanCode || cleanCode.length !== 6) return { success: false, message: "Invalid code format." };

    const url = GOOGLE_WEBHOOK_URL;
    if (!url) return { success: false, message: "Webhook URL not configured." };

    try {
      const res = await fetch(`${url}?action=get_tasks&code=${encodeURIComponent(cleanCode)}`);
      if (!res.ok) {
        return { success: false, message: "Network error connecting to cloud." };
      }
      const data = await res.json();
      if (data.status === "success" && data.tasks && typeof data.tasks === "object") {
        isCloudPulling = true;
        try {
          const out = {};
          for (const q of QUADRANTS) {
            out[q] = Array.isArray(data.tasks[q])
              ? data.tasks[q].filter((t) => t && typeof t.text === "string")
              : [];
          }
          state = out;
          save();
          render();
        } finally {
          isCloudPulling = false;
        }
        return { success: true, tasks: data.tasks, lastUpdated: data.lastUpdated };
      } else if (data.status === "not_found") {
        return { success: false, notFound: true, message: "No tasks found for code " + formatPairingCode(cleanCode) };
      } else {
        return { success: false, message: data.message || "Unable to retrieve tasks." };
      }
    } catch (err) {
      console.warn("Fetch cloud tasks error:", err);
      return { success: false, message: "Connection issue. Check your internet." };
    }
  }

  function updateLinkDeviceUI() {
    const linkDeviceBtn = document.getElementById("linkDeviceBtn");
    const linkActiveBanner = document.getElementById("linkActiveBanner");
    const currentPairingCodeDisplay = document.getElementById("currentPairingCodeDisplay");
    const myPairingCode = document.getElementById("myPairingCode");

    const myCode = getDevicePairingCode();
    const linkedCode = localStorage.getItem("impact_linked_code");
    const isLinked = localStorage.getItem("impact_is_linked") === "true";

    if (myPairingCode) {
      myPairingCode.textContent = formatPairingCode(myCode);
    }

    if (isLinked && linkedCode) {
      if (linkActiveBanner) linkActiveBanner.style.display = "flex";
      if (currentPairingCodeDisplay) currentPairingCodeDisplay.textContent = formatPairingCode(linkedCode);
      if (linkDeviceBtn) {
        linkDeviceBtn.classList.add("is-linked");
        if (!linkDeviceBtn.querySelector(".nav-linked-dot")) {
          const dot = document.createElement("span");
          dot.className = "nav-linked-dot";
          linkDeviceBtn.prepend(dot);
        }
      }
    } else {
      if (linkActiveBanner) linkActiveBanner.style.display = "none";
      if (linkDeviceBtn) {
        linkDeviceBtn.classList.remove("is-linked");
        const dot = linkDeviceBtn.querySelector(".nav-linked-dot");
        if (dot) dot.remove();
      }
    }
  }

  function initLinkDevice() {
    const linkDeviceBtn = document.getElementById("linkDeviceBtn");
    const backdrop = document.getElementById("linkDeviceBackdrop");
    const closeBtn = document.getElementById("linkDeviceCloseBtn");
    const copyBtn = document.getElementById("copyPairingCodeBtn");
    const pairCodeInput = document.getElementById("pairCodeInput");
    const linkCodeForm = document.getElementById("linkCodeForm");
    const linkSubmitBtn = document.getElementById("linkSubmitBtn");
    const linkFeedback = document.getElementById("linkFeedback");
    const linkSyncNowBtn = document.getElementById("linkSyncNowBtn");
    const linkUnlinkBtn = document.getElementById("linkUnlinkBtn");

    updateLinkDeviceUI();

    // Modal open
    if (linkDeviceBtn) {
      linkDeviceBtn.addEventListener("click", () => {
        updateLinkDeviceUI();
        if (backdrop) {
          backdrop.classList.add("is-open");
          backdrop.setAttribute("aria-hidden", "false");
        }
        if (linkFeedback) {
          linkFeedback.textContent = "";
          linkFeedback.className = "link-feedback";
        }
        setTimeout(() => {
          if (pairCodeInput) pairCodeInput.focus();
        }, 150);
      });
    }

    // Modal close
    function closeModal() {
      if (backdrop) {
        backdrop.classList.remove("is-open");
        backdrop.setAttribute("aria-hidden", "true");
      }
    }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
      });
    }
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop && backdrop.classList.contains("is-open")) {
        closeModal();
      }
    });

    // Copy own code
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const codeText = formatPairingCode(getDevicePairingCode());
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(codeText).then(() => {
            const orig = copyBtn.innerHTML;
            copyBtn.textContent = "Copied! ✓";
            copyBtn.classList.add("copied");
            setTimeout(() => {
              copyBtn.innerHTML = orig;
              copyBtn.classList.remove("copied");
            }, 1800);
          }).catch(() => fallbackCopy(codeText));
        } else {
          fallbackCopy(codeText);
        }

        function fallbackCopy(text) {
          const temp = document.createElement("input");
          temp.value = text;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          document.body.removeChild(temp);
          copyBtn.textContent = "Copied! ✓";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "Copy";
            copyBtn.classList.remove("copied");
          }, 1800);
        }
      });
    }

    // Input formatting (Auto-hyphenate XXX-XXX)
    if (pairCodeInput) {
      pairCodeInput.addEventListener("input", (e) => {
        const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
        if (clean.length > 3) {
          e.target.value = clean.slice(0, 3) + "-" + clean.slice(3, 6);
        } else {
          e.target.value = clean;
        }
        if (linkFeedback) {
          linkFeedback.textContent = "";
          linkFeedback.className = "link-feedback";
        }
      });
    }

    // Form submit (Connect device)
    if (linkCodeForm) {
      linkCodeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const raw = pairCodeInput ? pairCodeInput.value : "";
        const clean = raw.replace(/\D/g, "");

        if (clean.length !== 6) {
          if (linkFeedback) {
            linkFeedback.textContent = "Please enter a valid 6-digit code (e.g. 482-915).";
            linkFeedback.className = "link-feedback error";
          }
          return;
        }

        if (clean === getDevicePairingCode()) {
          if (linkFeedback) {
            linkFeedback.textContent = "This is your own code! Enter it on your other device.";
            linkFeedback.className = "link-feedback error";
          }
          return;
        }

        if (linkSubmitBtn) {
          linkSubmitBtn.disabled = true;
          linkSubmitBtn.textContent = "Connecting...";
        }
        if (linkFeedback) {
          linkFeedback.textContent = "Connecting to device...";
          linkFeedback.className = "link-feedback info";
        }

        const result = await fetchTasksFromCloud(clean);

        if (linkSubmitBtn) {
          linkSubmitBtn.disabled = false;
          linkSubmitBtn.textContent = "Connect";
        }

        if (result.success) {
          localStorage.setItem("impact_linked_code", clean);
          localStorage.setItem("impact_is_linked", "true");
          updateLinkDeviceUI();
          if (pairCodeInput) pairCodeInput.value = "";
          if (linkFeedback) {
            linkFeedback.textContent = "✓ Linked successfully! Board synced.";
            linkFeedback.className = "link-feedback success";
          }
          setTimeout(closeModal, 1600);
        } else if (result.notFound) {
          // If code doesn't have tasks yet in cloud, link with it and push our current board!
          localStorage.setItem("impact_linked_code", clean);
          localStorage.setItem("impact_is_linked", "true");
          syncBoardToCloud(clean);
          updateLinkDeviceUI();
          if (pairCodeInput) pairCodeInput.value = "";
          if (linkFeedback) {
            linkFeedback.textContent = "✓ Linked with code! Current board uploaded.";
            linkFeedback.className = "link-feedback success";
          }
          setTimeout(closeModal, 1600);
        } else {
          if (linkFeedback) {
            linkFeedback.textContent = result.message || "Failed to link device.";
            linkFeedback.className = "link-feedback error";
          }
        }
      });
    }

    // Force Sync Now Button
    if (linkSyncNowBtn) {
      linkSyncNowBtn.addEventListener("click", async () => {
        const activeCode = getActiveSyncCode();
        linkSyncNowBtn.textContent = "Syncing...";
        await fetchTasksFromCloud(activeCode);
        syncBoardToCloud(activeCode);
        linkSyncNowBtn.textContent = "Synced! ✓";
        setTimeout(() => {
          linkSyncNowBtn.textContent = "Sync Now";
        }, 1500);
      });
    }

    // Unlink Button
    if (linkUnlinkBtn) {
      linkUnlinkBtn.addEventListener("click", () => {
        localStorage.removeItem("impact_linked_code");
        localStorage.setItem("impact_is_linked", "false");
        updateLinkDeviceUI();
        if (linkFeedback) {
          linkFeedback.textContent = "Device unlinked. Local tasks kept.";
          linkFeedback.className = "link-feedback info";
        }
      });
    }

    // Auto-sync on startup if linked
    if (localStorage.getItem("impact_is_linked") === "true") {
      const linkedCode = localStorage.getItem("impact_linked_code");
      if (linkedCode && linkedCode.length === 6) {
        fetchTasksFromCloud(linkedCode);
      }
    } else {
      // Also push our own initial board to cloud once so peer can discover it immediately
      setTimeout(() => {
        syncBoardToCloud(getDevicePairingCode());
      }, 2000);
    }
  }

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  prefetchGeoData();
  initAddForms();
  initContactDrawer();
  initLinkDevice();
  render();

  // Dismiss active input and keypad when tapping outside on mobile
  document.addEventListener("pointerdown", (e) => {
    if (
      e.target.closest("#contactDrawer") ||
      e.target.closest("#contactBtn") ||
      e.target.closest("#linkDeviceBackdrop") ||
      e.target.closest("#linkDeviceBtn")
    ) return;
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

