const API = "/api";
const state = { token: null, user: null, clubs: [], events: [], registrations: [] };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function showToast(message, type = "success") {
  const toast = $("#toast"); toast.textContent = message; toast.className = `toast ${type}`;
  window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 4000);
}
async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try { response = await fetch(`${API}${path}`, { ...options, headers }); }
  catch { throw new Error("Cannot reach the server. Make sure the backend is running."); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}
function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]'); if (button) { button.disabled = busy; button.dataset.original ||= button.textContent; button.textContent = busy ? "Please wait…" : button.dataset.original; }
}
function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function signedIn() { return Boolean(state.token && state.user); }
function updateAuthView() {
  $("#auth-panel").classList.toggle("hidden", signedIn());
  $("#dashboard").classList.toggle("hidden", !signedIn());
  $("#my-registrations").classList.toggle("hidden", !signedIn());
  $("#logout-btn").classList.toggle("hidden", !signedIn());
  $("#user-label").textContent = signedIn() ? state.user.name : "";
  if (signedIn()) {
    $("#welcome-heading").textContent = `Welcome, ${state.user.name.split(" ")[0]}`;
    $("#role-chip").textContent = state.user.role === "admin" ? "Administrator" : "Student";
    $("#admin-panel").classList.toggle("hidden", state.user.role !== "admin");
  }
}
function renderClubs() {
  const term = $("#club-search").value.trim().toLowerCase();
  const clubs = state.clubs.filter(c => `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(term));
  $("#club-list").innerHTML = clubs.length ? clubs.map((club, i) => `<article class="club-card"><div class="card-top"><div class="club-icon">${["✳","⌘","♫","✦","⚡"][i % 5]}</div><span class="chip">${escapeHtml(club.category)}</span></div><h3>${escapeHtml(club.name)}</h3><p>${escapeHtml(club.description)}</p><div class="card-meta"><span>Community club</span></div></article>`).join("") : '<div class="empty-state">No clubs match your search yet.</div>';
}
function renderEvents() {
  const term = $("#event-search").value.trim().toLowerCase();
  const events = state.events.filter(e => `${e.title} ${e.description} ${e.location} ${e.club_name || ""}`.toLowerCase().includes(term));
  $("#event-list").innerHTML = events.length ? events.map(e => {
    const registered = state.registrations.some(r => r.event_id === e.id);
    const full = Number(e.registration_count) >= Number(e.capacity);
    const canRegister = signedIn() && !registered && !full && new Date(e.starts_at) > new Date();
    return `<article class="event-card"><div class="card-top"><span class="chip">${escapeHtml(e.club_name || "Campus event")}</span><span class="muted">${escapeHtml(String(e.registration_count))}/${escapeHtml(String(e.capacity))} seats</span></div><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.description)}</p><div class="card-meta"><span>◷ ${escapeHtml(formatDate(e.starts_at))}</span><span>⌖ ${escapeHtml(e.location)}</span></div><div class="card-actions">${signedIn() ? (registered ? '<span class="chip">Registered</span>' : full ? '<span class="muted">Event full</span>' : new Date(e.starts_at) <= new Date() ? '<span class="muted">Event passed</span>' : `<button class="button" data-register="${escapeHtml(e.id)}">Register</button>`) : '<span class="muted">Log in to register</span>'}</div></article>`;
  }).join("") : '<div class="empty-state">No upcoming events found. Check back soon.</div>';
}
function renderRegistrations() {
  $("#registration-list").innerHTML = state.registrations.length ? state.registrations.map(r => `<article class="event-card"><span class="chip">Registered</span><h3>${escapeHtml(r.event_title)}</h3><p>${escapeHtml(r.club_name || "Campus event")}</p><div class="card-meta"><span>◷ ${escapeHtml(formatDate(r.starts_at))}</span><span>⌖ ${escapeHtml(r.location)}</span></div><div class="card-actions"><button class="button button-secondary" data-cancel="${escapeHtml(r.event_id)}">Cancel registration</button></div></article>`).join("") : '<div class="empty-state">You have not registered for an event yet.</div>';
}
function renderClubOptions() {
  $("#event-club").innerHTML = state.clubs.length ? state.clubs.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("") : '<option value="">Create a club first</option>';
}
function renderStats() {
  $("#stat-clubs").textContent = state.clubs.length;
  $("#stat-events").textContent = state.events.filter(e => new Date(e.starts_at) > new Date()).length;
  $("#stat-registrations").textContent = state.registrations.length;
}
async function loadPublicData() {
  const [clubs, events] = await Promise.all([request("/clubs"), request("/events")]);
  state.clubs = clubs.data; state.events = events.data;
  renderClubs(); renderEvents(); renderClubOptions(); renderStats();
}
async function loadRegistrations() {
  if (!signedIn()) { state.registrations = []; renderRegistrations(); renderStats(); return; }
  const result = await request("/registrations/mine"); state.registrations = result.data;
  renderRegistrations(); renderEvents(); renderStats();
}
async function refresh() { await loadPublicData(); await loadRegistrations(); }
function saveSession(payload) {
  state.token = payload.token; state.user = payload.user;
  // Keep the bearer token in memory only; refreshing the page signs the user out.
  updateAuthView();
}
$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  const data = Object.fromEntries(new FormData(form));
  try { const result = await request("/auth/register", { method: "POST", body: JSON.stringify(data) }); saveSession(result.data); form.reset(); await refresh(); showToast("Account created. Welcome to CampusClubs!"); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(form, false); }
});
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  try { const result = await request("/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); saveSession(result.data); form.reset(); await refresh(); showToast("You are now logged in."); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(form, false); }
});
$("#logout-btn").addEventListener("click", () => {
  state.token = null; state.user = null; state.registrations = []; updateAuthView(); renderEvents(); renderRegistrations(); showToast("You have logged out.");
});
$("#club-search").addEventListener("input", renderClubs);
$("#event-search").addEventListener("input", renderEvents);
$("#event-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-register]"); if (!button) return;
  button.disabled = true;
  try { await request("/registrations", { method: "POST", body: JSON.stringify({ event_id: button.dataset.register }) }); await loadRegistrations(); showToast("You are registered for the event."); }
  catch (error) { showToast(error.message, "error"); button.disabled = false; }
});
$("#registration-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel]"); if (!button) return;
  if (!window.confirm("Cancel your registration for this event?")) return;
  button.disabled = true;
  try { await request(`/registrations/${encodeURIComponent(button.dataset.cancel)}`, { method: "DELETE" }); await loadRegistrations(); showToast("Registration cancelled."); }
  catch (error) { showToast(error.message, "error"); button.disabled = false; }
});
$("#club-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  try { await request("/clubs", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); await loadPublicData(); showToast("Club created successfully."); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(form, false); }
});
$("#event-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; setBusy(form, true);
  const data = Object.fromEntries(new FormData(form)); data.capacity = Number(data.capacity); data.starts_at = new Date(data.starts_at).toISOString();
  try { await request("/events", { method: "POST", body: JSON.stringify(data) }); form.reset(); await loadPublicData(); showToast("Event published successfully."); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(form, false); }
});
updateAuthView();
loadPublicData().catch(error => { $("#club-list").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; $("#event-list").innerHTML = '<div class="empty-state">Could not load events. Check the server and database configuration.</div>'; });
