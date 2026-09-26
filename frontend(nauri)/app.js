(function () {
  "use strict";

  const N = window.Nouri;

  const MEAL_EMOJI = { breakfast: "🍳", lunch: "🥗", dinner: "🍲", snack: "🍫" };
  const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

  function fmt(n) {
    return Math.round(Number(n) || 0).toLocaleString();
  }

  function mealLabel(type) {
    return MEAL_LABEL[type] || "Meal";
  }

  function mealEmoji(type) {
    return MEAL_EMOJI[type] || "🍽️";
  }

  function greeting(firstName) {
    const h = new Date().getHours();
    if (h < 12) return `Good morning, ${firstName}.`;
    if (h < 18) return `Good afternoon, ${firstName}.`;
    return `Good evening, ${firstName}.`;
  }

  function renderUser() {
    const user = N.getUser();
    const avatars = document.querySelectorAll(".profile-avatar");
    const names = document.querySelectorAll(".profile b");
    const plans = document.querySelectorAll(".profile span:not(.profile-avatar)");
    if (user) {
      avatars.forEach((el) => { el.textContent = N.initials(user.name); });
      names.forEach((el) => { el.textContent = user.name; });
      plans.forEach((el) => { el.textContent = `${user.plan || "free"} plan`; });
    }
    document.querySelectorAll("[data-logout]").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        N.logout().then(() => { location.href = "login.html"; });
      });
    });
  }

  async function getConfig() {
    if (!N._config) {
      N._config = await N.request("/config");
    }
    return N._config;
  }

  /* ---------------- Auth pages ---------------- */

  function initLogin() {
    if (!N.guardGuest()) return;

    const form = document.querySelector("[data-login-form]");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = form.email?.value || document.querySelector("#email")?.value;
        const password = form.password?.value || document.querySelector("#password")?.value;
        const rememberMe = Boolean(form.querySelector('input[type="checkbox"]')?.checked);
        if (!email || !password) {
          N.toast("Please enter your email and password.");
          return;
        }
        try {
          const data = await N.request("/auth/login", {
            method: "POST",
            json: { email, password, rememberMe },
          });
          N.setSession(data);
          location.href = "dashboard.html";
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
    }

    const googleBtn = document.querySelector("[data-google-login]");
    if (googleBtn) {
      googleBtn.addEventListener("click", async () => {
        try {
          const config = await getConfig();
          if (!config.googleClientId) {
            N.toast("Google sign-in isn’t configured on this server yet.", "error");
            return;
          }
          loadGoogleScript(config.googleClientId);
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
    }
  }

  function loadGoogleScript(clientId) {
    if (window.google && window.google.accounts) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response || !response.credential) {
            N.toast("Google sign-in was cancelled.");
            return;
          }
          try {
            const data = await N.request("/auth/google", {
              method: "POST",
              json: { credential: response.credential },
            });
            N.setSession(data);
            location.href = "dashboard.html";
          } catch (err) {
            N.toast(err.message, "error");
          }
        },
      });
      window.google.accounts.id.prompt();
    };
    script.onload = init;
    document.head.appendChild(script);
  }

  function initRegister() {
    if (!N.guardGuest()) return;
    const form = document.querySelector("[data-register-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = form.name?.value?.trim();
      const email = form.email?.value?.trim();
      const password = form.password?.value;
      if (!name || !email || !password) {
        N.toast("Please fill in all fields.");
        return;
      }
      if (password.length < 8) {
        N.toast("Password must be at least 8 characters.");
        return;
      }
      try {
        const data = await N.request("/auth/register", {
          method: "POST",
          json: { name, email, password },
        });
        N.setSession(data);
        location.href = "dashboard.html";
      } catch (err) {
        N.toast(err.message, "error");
      }
    });
  }

  function initForgotPassword() {
    const form = document.querySelector("[data-reset-form]");
    const success = document.querySelector("[data-reset-success]");
    const tokenBox = document.querySelector("[data-reset-token]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = form.email?.value || document.querySelector("#reset-email")?.value;
      if (!email) {
        N.toast("Please enter your email address.");
        return;
      }
      try {
        const data = await N.request("/auth/forgot-password", { method: "POST", json: { email } });
        if (success) success.textContent = data.message || "If an account exists for that email, a reset link has been sent.";
        if (success) success.classList.add("show");
        if (tokenBox && data.devResetToken) {
          const href = `${location.pathname.replace(/[^/]*$/, "reset-password.html")}?token=${encodeURIComponent(data.devResetToken)}&email=${encodeURIComponent(email)}`;
          tokenBox.innerHTML = `Development mode — open your reset link: <a class="text-link" href="${href}">reset-password.html</a>`;
          tokenBox.classList.add("show");
        }
        form.reset();
      } catch (err) {
        N.toast(err.message, "error");
      }
    });
  }

  function initResetPassword() {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const form = document.querySelector("[data-new-password-form]");
    if (!form) return;
    if (!token) {
      N.toast("This reset link is missing its token.", "error");
      return;
    }
    const emailField = form.querySelector("[name='email']");
    if (emailField && params.get("email")) emailField.value = params.get("email");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = form.password?.value;
      const confirm = form.querySelector("[name='confirm']")?.value;
      if (!password || password.length < 8) {
        N.toast("Password must be at least 8 characters.");
        return;
      }
      if (confirm !== password) {
        N.toast("Passwords do not match.");
        return;
      }
      try {
        await N.request("/auth/reset-password", {
          method: "POST",
          json: { token, password },
        });
        N.toast("Password updated. You can now log in.");
        setTimeout(() => { location.href = "login.html"; }, 1200);
      } catch (err) {
        N.toast(err.message, "error");
      }
    });
  }

  /* ---------------- Dashboard ---------------- */

  async function loadDashboard() {
    const root = document.querySelector("[data-dashboard]");
    if (!root) return;
    if (!N.requireAuth()) return;
    renderUser();

    let data;
    try {
      data = await N.request("/dashboard");
      const user = N.getUser();
      if (user) N.setSession({ user: { ...user, name: data.user.name, plan: data.user.plan } });
    } catch (err) {
      N.toast(err.message, "error");
      return;
    }
    renderUser();

    const el = (sel) => root.querySelector(sel);

    const dateP = el("[data-greeting-date]");
    const greetingH = el("[data-greeting]");
    if (dateP) dateP.textContent = data.date.heading;
    if (greetingH) greetingH.textContent = greeting(data.user.firstName);

    const ring = el("[data-calorie-ring]");
    const ringB = ring && ring.querySelector("b");
    const ringSpan = ring && ring.querySelector("span");
    if (ringB) ringB.textContent = fmt(data.energy.consumed);
    if (ringSpan) ringSpan.textContent = `of ${fmt(data.energy.goal)}`;
    if (ring) {
      const deg = Math.max(0, Math.min(100, data.energy.percent)) * 3.6;
      ring.style.background = `conic-gradient(var(--lime) 0deg ${deg}deg, rgba(255,255,255,.13) ${deg}deg 360deg)`;
    }

    const remB = el("[data-cal-remaining]");
    const noteSpan = el("[data-energy-note]");
    if (remB) {
      if (data.energy.consumed >= data.energy.goal) remB.textContent = `${fmt(data.energy.consumed)} kcal logged`;
      else remB.textContent = `${fmt(data.energy.remaining)} kcal remaining`;
    }
    if (noteSpan) {
      if (data.energy.consumed === 0) noteSpan.textContent = `Log your first meal of the day to get started toward ${fmt(data.energy.goal)} kcal.`;
      else if (data.energy.consumed >= data.energy.goal) noteSpan.textContent = "You’ve reached today’s target. Great work!";
      else if (data.energy.percent > 70) noteSpan.textContent = "Nearly there — finish today strong.";
      else if (data.energy.percent > 35) noteSpan.textContent = "You’re well balanced for an energising afternoon.";
      else noteSpan.textContent = "A gentle start — there’s plenty of room left today.";
    }

    const macros = { protein: "protein", carbs: "carbs", fats: "fats" };
    document.querySelectorAll("[data-dashboard] .macro-row .macro").forEach((macro) => {
      const key = macro.getAttribute("data-macro") || macro.querySelector("small")?.textContent.toLowerCase().replace(/s$/, "");
      const m = data.macros[key] || data.macros[macros[key]];
      if (!m) return;
      const b = macro.querySelector("b");
      const i = macro.querySelector(".bar i");
      if (b) b.textContent = `${fmt(m.current)}g / ${fmt(m.target)}g`;
      if (i) i.style.width = `${Math.max(0, Math.min(100, m.pct))}%`;
    });

    const mealsList = el("[data-today-meals]");
    if (mealsList) {
      if (!data.todaysMeals.length) {
        mealsList.innerHTML = `<div class="meal-row"><div><strong>Nothing logged yet</strong><span>Add a meal from the calorie counter.</span></div></div>`;
      } else {
        mealsList.innerHTML = data.todaysMeals.map((meal) => `
          <div class="meal-row">
            <span class="meal-icon">${mealEmoji(meal.mealType)}</span>
            <div><strong>${N.escapeHTML(meal.name)}</strong><span>${N.escapeHTML(meal.description)}</span></div>
            <b>${fmt(meal.calories)} kcal</b>
          </div>`).join("");
      }
    }

    const chart = el("[data-weekly-chart]");
    if (chart) {
      chart.innerHTML = (data.weeklyCalories || []).map((d) => `
        <div class="chart-day ${d.active ? "active" : ""}">
          <i style="height:${Math.max(6, Math.min(100, d.value / Math.max(1, data.energy.goal) * 100))}%"></i>
          <small>${N.escapeHTML(d.label)}</small>
        </div>`).join("");
    }

    const next = el("[data-next-up]");
    if (next) {
      const rows = data.upcomingMeals.map((meal) => `
        <div class="meal-row">
          <span class="meal-icon">${mealEmoji(meal.mealType)}</span>
          <div><strong>${N.escapeHTML(meal.name)}</strong><span>${N.escapeHTML(meal.description || "")} · ${meal.time || N.date.today()}</span></div>
          <b>${fmt(meal.calories)} kcal</b>
        </div>`).join("");

      const hydrationRow = `
        <div class="meal-row">
          <span class="meal-icon">💧</span>
          <div><strong>Hydration check</strong><span>${data.hydration.current} of ${data.hydration.goal} glasses today</span></div>
          <button class="link-button" data-hydration-add>+1</button>
        </div>`;

      next.innerHTML = rows + hydrationRow;

      const addBtn = next.querySelector("[data-hydration-add]");
      if (addBtn) {
        addBtn.addEventListener("click", async () => {
          try {
            await N.request("/hydration", { method: "POST", json: { amountGlasses: 1 } });
            loadDashboard();
          } catch (err) {
            N.toast(err.message, "error");
          }
        });
      }
    }
  }

  /* ---------------- Calorie counter ---------------- */

  async function initCalorieCounter() {
    if (!N.requireAuth()) return;
    renderUser();

    const input = document.querySelector("[data-food-upload]");
    const note = document.querySelector("[data-analyze-note]");
    const logBtn = document.querySelector("[data-log-food]");
    const manualInput = document.querySelector("[data-manual-food]");
    let pending = null;

    function renderAnalysis(result) {
      pending = result;
      const name = document.querySelector("[data-analyze-name]");
      const conf = document.querySelector("[data-analyze-conf]");
      const kcal = document.querySelector("[data-analyze-kcal]");
      const img = document.querySelector("[data-analyze-img]");
      if (name) name.textContent = result.foodName;
      if (conf) conf.textContent = `AI estimate · ${Math.round(result.confidence || 0)}% confidence`;
      if (kcal) kcal.innerHTML = `${fmt(result.calories)} <small>kcal</small>`;

      const macroMap = [
        { key: "protein", max: 80 },
        { key: "carbs", max: 100 },
        { key: "fats", max: 60 },
      ];
      const lines = document.querySelectorAll("[data-analysis] .nutrition-line");
      macroMap.forEach((macro, idx) => {
        const line = lines[idx];
        if (!line) return;
        const value = Number(result[macro.key]) || 0;
        const bar = line.querySelector(".bar i");
        const b = line.querySelector("b");
        if (bar) bar.style.width = `${Math.max(4, Math.min(100, Math.round(value / macro.max * 100)))}%`;
        if (b) b.textContent = `${fmt(value)}g`;
      });

      if (img && result.imageUrl) {
        img.style.display = "grid";
        img.textContent = "";
        const pic = document.createElement("img");
        pic.src = result.imageUrl;
        pic.alt = result.foodName;
        pic.style.width = "100%";
        pic.style.height = "100%";
        pic.style.objectFit = "cover";
        pic.style.borderRadius = "inherit";
        img.appendChild(pic);
      }
    }

    if (input) {
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (note) {
          note.textContent = "Analysing your meal…";
          note.classList.add("show");
        }
        try {
          const form = new FormData();
          form.append("image", file);
          const result = await N.request("/food/analyze", { method: "POST", form });
          renderAnalysis(result);
          if (note) {
            note.textContent = "Meal image ready — AI analysis complete.";
          }
        } catch (err) {
          N.toast(err.message, "error");
          if (note) {
            note.textContent = "Analysis failed. Try another photo.";
            setTimeout(() => note.classList.remove("show"), 4000);
          }
        }
      });
    }

    async function logEntry(payload) {
      try {
        await N.request("/food/log", { method: "POST", json: payload });
        N.toast("Food added to today’s log.");
        pending = null;
        if (manualInput) manualInput.value = "";
        if (note) note.classList.remove("show");
      } catch (err) {
        N.toast(err.message, "error");
      }
    }

    if (logBtn) {
      logBtn.addEventListener("click", () => {
        const manual = manualInput && manualInput.value.trim();
        if (manual) {
          logEntry({ foodName: manual });
        } else if (pending) {
          logEntry({
            foodName: pending.foodName,
            mealType: "snack",
            calories: pending.calories,
            protein: pending.protein,
            carbs: pending.carbs,
            fats: pending.fats,
            servingSize: pending.servingSize,
          });
        } else {
          N.toast("Choose a photo or type a food to log.", "error");
        }
      });
    }
  }

  /* ---------------- Diet planner ---------------- */

  function renderPlanTimeline(data) {
    const timeline = document.querySelector("[data-plan-timeline]");
    const label = document.querySelector("[data-plan-day-label]");
    if (!timeline) return;

    const today = N.date.today();
    let day = (data.days || []).find((d) => d.date === today) || (data.days || [])[0];
    if (label) {
      if (day) {
        const d = new Date(`${day.date}T00:00:00.000Z`);
        label.textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
      } else {
        label.textContent = "Your week";
      }
    }

    const meals = (day && day.meals) || [];
    if (!meals.length) {
      timeline.innerHTML = `<div class="timeline-item"><time>—</time><span class="meal-icon">🍽️</span><div><strong>No meals planned</strong><span>Create a plan to see meals here.</span></div></div>`;
      return;
    }

    timeline.innerHTML = meals.map((meal) => `
      <div class="timeline-item">
        <time>${N.escapeHTML(meal.scheduledTime ? formatTime(meal.scheduledTime) : mealLabel(meal.mealType))}</time>
        <span class="meal-icon">${mealEmoji(meal.mealType)}</span>
        <div><strong>${N.escapeHTML(meal.name)}</strong><span>${N.escapeHTML(meal.description || `${fmt(meal.protein)}g protein · ${fmt(meal.carbs)}g carbs · ${fmt(meal.fats)}g fats`)}</span></div>
        <b>${fmt(meal.calories)} kcal</b>
      </div>`).join("");
  }

  function formatTime(time) {
    const [h, m] = String(time).split(":").map(Number);
    const hours12 = h % 12 === 0 ? 12 : h % 12;
    return `${hours12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }

  function renderPlanTargets(data) {
    const targets = document.querySelector("[data-plan-targets]");
    if (!targets) return;
    const t = data.targets || {};
    const specs = [
      { label: "Daily energy", text: `${fmt(t.calorieTarget)} kcal`, pct: (t.calorieTarget || 2000) / 3000 * 100 },
      { label: "Protein focus", text: `${fmt(t.proteinTarget)}g`, pct: (t.proteinTarget || 120) / 300 * 100 },
      { label: "Plants a week", text: `${fmt(t.plantVarietyTarget)} varieties`, pct: (t.plantVarietyTarget || 30) / 60 * 100 },
    ];
    targets.innerHTML = specs.map((s) => `
      <div class="macro">
        <small>${s.label}</small>
        <b>${s.text}</b>
        <div class="bar"><i style="width:${Math.round(s.pct)}%"></i></div>
      </div>`).join("");

    const editBtn = document.querySelector("[data-plan-edit]");
    if (!editBtn) return;
    editBtn.onclick = () => {
      if (!data.plan) {
        N.toast("Create a plan first, then you can edit targets.");
        return;
      }
      targets.innerHTML = `
        <label class="field" style="margin-top:0"><span style="font-size:.74rem;color:var(--muted)">Daily energy (kcal)</span><input type="number" min="1000" max="6000" value="${fmt(t.calorieTarget)}" data-target-calorie /></label>
        <label class="field"><span style="font-size:.74rem;color:var(--muted)">Protein focus (g)</span><input type="number" min="30" max="400" value="${fmt(t.proteinTarget)}" data-target-protein /></label>
        <label class="field"><span style="font-size:.74rem;color:var(--muted)">Plants a week</span><input type="number" min="10" max="60" value="${fmt(t.plantVarietyTarget)}" data-target-plants /></label>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="button" data-plan-save type="button">Save</button>
          <button class="button ghost" data-plan-cancel type="button">Cancel</button>
        </div>`;

      targets.querySelector("[data-plan-save]").addEventListener("click", async () => {
        try {
          const updated = await N.request(`/diet-plan/${data.plan.id}`, {
            method: "PUT",
            json: {
              dailyCalorieTarget: Number(targets.querySelector("[data-target-calorie]").value),
              proteinTarget: Number(targets.querySelector("[data-target-protein]").value),
              plantVarietyTarget: Number(targets.querySelector("[data-target-plants]").value),
            },
          });
          renderPlan(updated, false);
          N.toast("Targets updated.");
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
      targets.querySelector("[data-plan-cancel]").addEventListener("click", () => renderPlanTargets(data));
    };
  }

  async function loadDietPlan() {
    if (!N.requireAuth()) return;
    renderUser();

    const title = document.querySelector("[data-planner-title]");
    const refreshBtn = document.querySelector("[data-refresh-plan]");
    const createContainer = document.querySelector("[data-plan-empty]");
    const targets = document.querySelector("[data-plan-targets]");

    let data;
    try {
      data = await N.request("/diet-plan");
    } catch (err) {
      N.toast(err.message, "error");
      return;
    }

    const hasPlan = Boolean(data && data.plan);
    if (createContainer) createContainer.hidden = hasPlan;
    if (title) title.textContent = hasPlan ? "Your personal meal plan" : "A plan that fits your day";
    if (refreshBtn) refreshBtn.hidden = !hasPlan;
    if (targets && !hasPlan) renderPlanTargets({ targets: data.targets });

    if (hasPlan) renderPlan(data, false);
  }

  function renderPlan(data, minted) {
    renderPlanTimeline(data);
    renderPlanTargets(data);

    const createBtn = document.querySelector("[data-create-plan]");
    if (createBtn && minted) {
      N.toast("Your meal plan is ready.");
    }

    const refreshBtn = document.querySelector("[data-refresh-plan]");
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        try {
          const refreshed = await N.request(`/diet-plan/${data.plan.id}/refresh`, { method: "POST" });
          renderPlan(refreshed, false);
          N.toast("Plan refreshed with new ideas.");
        } catch (err) {
          N.toast(err.message, "error");
        }
      };
    }
  }

  function initDietPlanner() {
    const createBtn = document.querySelector("[data-create-plan]");
    if (createBtn) {
      createBtn.addEventListener("click", async () => {
        createBtn.disabled = true;
        try {
          const minted = await N.request("/diet-plan", { method: "POST", json: {} });
          const empty = document.querySelector("[data-plan-empty]");
          if (empty) empty.hidden = true;
          const title = document.querySelector("[data-planner-title]");
          if (title) title.textContent = "Your personal meal plan";
          renderPlan(minted, true);
        } catch (err) {
          N.toast(err.message, "error");
        } finally {
          createBtn.disabled = false;
        }
      });
    }
    loadDietPlan();
  }

  /* ---------------- Calendar ---------------- */

  let calState = { start: null, selected: null };

  async function loadCalendar() {
    if (!N.requireAuth()) return;
    renderUser();

    const today = N.date.today();
    if (!calState.start) calState.start = N.date.startOfWeek(today);
    if (!calState.selected) calState.selected = today;

    let data;
    try {
      const end = N.date.addDays(calState.start, 6);
      data = await N.request(`/calendar?startDate=${calState.start}&endDate=${end}`);
    } catch (err) {
      N.toast(err.message, "error");
      return;
    }

    const rangeEl = document.querySelector("[data-week-range]");
    if (rangeEl) rangeEl.textContent = N.date.formatRange(data.startDate, data.endDate);

    const grid = document.querySelector("[data-week-grid]");
    if (grid) {
      grid.innerHTML = data.days.map((day) => `
        <div class="day-card ${day.isToday ? "active" : ""}" data-day-card="${N.escapeHTML(day.date)}">
          <small>${N.escapeHTML(day.weekday)}</small>
          <b>${new Date(`${day.date}T00:00:00.000Z`).getUTCDate()}</b>
          ${day.meals.slice(0, 3).map((m) => `<div class="mini">${mealEmoji(m.mealType)} ${N.escapeHTML(m.name)}</div>`).join("") || ""}
          ${day.meals.length > 3 ? `<div class="mini">+${day.meals.length - 3} more</div>` : ""}
        </div>`).join("");

      grid.querySelectorAll("[data-day-card]").forEach((card) => {
        card.addEventListener("click", () => {
          grid.querySelectorAll(".day-card").forEach((el) => el.classList.remove("active"));
          card.classList.add("active");
          calState.selected = card.dataset.dayCard;
          renderDayPlan(data.days);
        });
      });
    }

    renderDayPlan(data.days);
    loadGrocery();
  }

  function renderDayPlan(days) {
    const panel = document.querySelector("[data-day-plan]");
    if (!panel) return;
    const day = (days || []).find((d) => d.date === calState.selected);

    const title = document.querySelector("[data-day-plan-title]");
    if (title) {
      if (day) {
        const d = new Date(`${day.date}T00:00:00.000Z`);
        title.textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
      } else {
        title.textContent = "Selected day";
      }
    }

    const meals = (day && day.meals) || [];
    panel.innerHTML = meals.length
      ? meals.map((m) => `
        <div class="timeline-item">
          <time>${N.escapeHTML(m.scheduledTime ? formatTime(m.scheduledTime) : mealLabel(m.mealType))}</time>
          <span class="meal-icon">${mealEmoji(m.mealType)}</span>
          <div><strong>${N.escapeHTML(m.name)}</strong><span>${N.escapeHTML(m.description || "")}</span></div>
          <b>${fmt(m.calories)} kcal</b>
        </div>`).join("")
      : `<div class="timeline-item"><time>—</time><span class="meal-icon">🍽️</span><div><strong>No meals scheduled</strong><span>Add a meal below.</span></div></div>`;
  }

  async function loadGrocery() {
    const list = document.querySelector("[data-grocery-list]");
    if (!list) return;
    const date = calState.selected || N.date.today();
    let data;
    try {
      data = await N.request(`/grocery?date=${date}`);
    } catch (err) {
      N.toast(err.message, "error");
      return;
    }
    list.innerHTML = data.items.length
      ? data.items.map((item) => `
        <label>
          <input type="checkbox" ${item.completed ? "checked" : ""} data-grocery-toggle="${N.escapeHTML(item.id)}" />
          <span>${N.escapeHTML(item.itemName)}</span>
          <button class="link-button" type="button" data-grocery-delete="${N.escapeHTML(item.id)}">✕</button>
        </label>`).join("")
      : `<span style="color:var(--subtle);font-size:.78rem">No items yet — add the first one.</span>`;

    list.querySelectorAll("[data-grocery-toggle]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        try {
          await N.request(`/grocery/${cb.dataset.groceryToggle}`, {
            method: "PUT",
            json: { completed: cb.checked },
          });
        } catch (err) {
          N.toast(err.message, "error");
          cb.checked = !cb.checked;
        }
      });
    });
    list.querySelectorAll("[data-grocery-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await N.request(`/grocery/${btn.dataset.groceryDelete}`, { method: "DELETE" });
          loadGrocery();
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
    });
  }

  function initCalendar() {
    const prev = document.querySelector("[data-prev-week]");
    const next = document.querySelector("[data-next-week]");
    const prevBtn = prev && prev.closest("button");
    const nextBtn = next && next.closest("button");

    if (prevBtn) prevBtn.addEventListener("click", () => {
      calState.start = N.date.addDays(calState.start, -7);
      loadCalendar();
    });
    if (nextBtn) nextBtn.addEventListener("click", () => {
      calState.start = N.date.addDays(calState.start, 7);
      loadCalendar();
    });

    const addForm = document.querySelector("[data-add-meal-form]");
    if (addForm) {
      addForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = addForm.querySelector("[name='mealName']")?.value.trim();
        if (!name) {
          N.toast("Enter a meal name.");
          return;
        }
        const payload = {
          name,
          mealType: addForm.querySelector("[name='mealType']")?.value || "snack",
          calories: Number(addForm.querySelector("[name='mealCalories']")?.value) || 0,
          scheduledDate: calState.selected || N.date.today(),
          scheduledTime: addForm.querySelector("[name='mealTime']")?.value || null,
        };
        try {
          await N.request("/calendar/meals", { method: "POST", json: payload });
          addForm.reset();
          loadCalendar();
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
    }

    const addItemBtn = document.querySelector("[data-grocery-add]");
    if (addItemBtn) {
      addItemBtn.addEventListener("click", async () => {
        const input = document.querySelector("[data-grocery-input]");
        const name = input && input.value.trim();
        if (!name) {
          N.toast("Enter a grocery item.");
          return;
        }
        try {
          await N.request("/grocery", {
            method: "POST",
            json: { itemName: name, date: calState.selected || N.date.today() },
          });
          if (input) input.value = "";
          loadGrocery();
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
    }

    loadCalendar();
  }

  /* ---------------- Progress ---------------- */

  function buildWeightChart(points) {
    const svg = document.querySelector("[data-weight-chart]");
    if (!svg) return;
    const axis = document.querySelector("[data-chart-axis]");

    const W = 650;
    const H = 235;
    const PAD = 14;
    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2;

    if (!points || points.length < 2) {
      const xAxis = points && points.length === 1 ? [N.date.monthShort(points[0].date)] : [N.date.monthShort(N.date.today())];
      svg.innerHTML = "";
      if (axis) axis.innerHTML = xAxis.map((l) => `<span>${N.escapeHTML(l)}</span>`).join("");
      return;
    }

    const weights = points.map((p) => Number(p.weight));
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const span = max - min || 1;
    const padY = Math.max(6, span * 0.25);

    const xFor = (i) => PAD + (i / (points.length - 1)) * innerW;
    const yFor = (w) => PAD + (1 - (w - (min - padY)) / (span + padY * 2)) * innerH;

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)} ${yFor(p.weight).toFixed(1)}`).join(" ");
    const area = `${line} L${xFor(points.length - 1).toFixed(1)} ${H - PAD} L${xFor(0).toFixed(1)} ${H - PAD} Z`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#9bca75" stop-opacity=".35"/>
          <stop offset="1" stop-color="#9bca75" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="M0 ${H * 0.35}H${W}M0 ${H * 0.55}H${W}M0 ${H * 0.75}H${W}" stroke="rgba(0,0,0,.08)" stroke-width="1"/>
      <path d="${area}" fill="url(#fill)"/>
      <path d="${line}" fill="none" stroke="#7ca94f" stroke-width="4" stroke-linecap="round"/>
      ${points.map((p, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(p.weight).toFixed(1)}" r="${i === points.length - 1 ? 6 : 3.5}" fill="#7ca94f"/>`).join("")}`;

    if (axis) {
      const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1];
      axis.innerHTML = labels.map((i) => `<span>${N.date.monthShort(points[i].date)} ${new Date(`${points[i].date}T00:00:00.000Z`).getUTCDate()}</span>`).join("");
    }
  }

  function renderHabitGrid(grid) {
    const el = document.querySelector("[data-habit-grid]");
    if (!el) return;
    el.innerHTML = grid.map((h) => `<span class="habit ${h.done ? "done" : ""}" title="${N.escapeHTML(h.date)}">${N.escapeHTML(h.initial)}</span>`).join("");
  }

  async function loadProgress() {
    if (!N.requireAuth()) return;
    renderUser();

    let data;
    try {
      data = await N.request("/progress?weeks=8");
    } catch (err) {
      N.toast(err.message, "error");
      return;
    }

    const set = (sel, text) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = text;
    };

    set("[data-current-weight]", data.currentWeight != null ? `${Number(data.currentWeight).toFixed(1)} kg` : "—");
    set("[data-weight-change]", data.weightChangeMonth
      ? `${data.weightChangeMonth < 0 ? "↓" : "↑"} ${Math.abs(data.weightChangeMonth).toFixed(1)} kg this month`
      : "Log weight to track");
    set("[data-daily-average]", data.dailyCalorieAverage ? `${fmt(data.dailyCalorieAverage)} kcal` : "—");
    set("[data-avg-note]", "Across your last 7 days");
    set("[data-habit-streak]", `${data.habitStreak} days`);
    set("[data-personal-best]", `Personal best: ${data.personalBestStreak} days`);

    buildWeightChart(data.weightTrend);
    renderHabitGrid(data.habitGrid);

    const form = document.querySelector("[data-add-weight-form]");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = form.querySelector("[name='weight']");
        const weight = Number(input && input.value);
        if (!Number.isFinite(weight) || weight <= 0) {
          N.toast("Enter a valid weight in kg.");
          return;
        }
        try {
          await N.request("/progress/weight", { method: "POST", json: { weight } });
          N.toast("Weight logged.");
          loadProgress();
        } catch (err) {
          N.toast(err.message, "error");
        }
      });
    }
  }

  /* ---------------- Boot ---------------- */

  function boot() {
    initLogin();
    initRegister();
    initForgotPassword();
    initResetPassword();

    if (document.querySelector("[data-dashboard]")) {
      loadDashboard();
    } else if (document.querySelector("[data-food-upload]")) {
      initCalorieCounter();
    } else if (document.querySelector("[data-diet-planner]")) {
      initDietPlanner();
    } else if (document.querySelector("[data-calendar]")) {
      initCalendar();
    } else if (document.querySelector("[data-progress]")) {
      loadProgress();
    }

    document.querySelectorAll("[data-toast-message]").forEach((button) => {
      button.addEventListener("click", () => N.toast(button.dataset.toastMessage));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();