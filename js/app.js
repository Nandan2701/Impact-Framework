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
  state[q] = state[q].filter((t) => t.id !== id);
  render();
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

  const GMAIL = "vinay25sapkal@gmail.com";
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

  // Distractionless Star Rating
  if (starsBar) {
    const savedRating = parseInt(localStorage.getItem(RATING_KEY), 10) || 0;
    if (savedRating > 0) {
      highlightStars(savedRating);
      if (ratingFeedback) {
        ratingFeedback.textContent = `Your rating: ${savedRating}/5 stars ⭐`;
      }
    }

    starsBar.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rating = parseInt(btn.dataset.rating, 10);
        if (!rating) return;
        localStorage.setItem(RATING_KEY, rating.toString());
        highlightStars(rating);
        if (ratingFeedback) {
          ratingFeedback.textContent = `Thank you for rating ${rating}/5 stars! ⭐`;
        }
      });
    });

    function highlightStars(val) {
      starsBar.querySelectorAll(".star-btn").forEach((s) => {
        const r = parseInt(s.dataset.rating, 10);
        s.classList.toggle("active", r <= val);
      });
    }
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initAddForms();
  initContactDrawer();
  render();

  // Dismiss active input and keypad when tapping outside on mobile
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#contactDrawer") || e.target.closest("#contactBtn")) return;
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

