const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("events").select("id,club_id,title,description,location,starts_at,capacity,created_at,clubs(name),registrations(id)").gte("starts_at", new Date().toISOString()).order("starts_at");
    if (error) throw error;
    const result = data.map(e => ({ id: e.id, club_id: e.club_id, title: e.title, description: e.description, location: e.location, starts_at: e.starts_at, capacity: e.capacity, created_at: e.created_at, club_name: e.clubs?.name || "Campus event", registration_count: e.registrations?.length || 0 }));
    res.json({ data: result });
  } catch (error) { next(error); }
});
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { club_id, title, description, location, starts_at } = req.body;
    const capacity = Number(req.body.capacity);
    if (typeof club_id !== "string" || !/^[0-9a-f-]{36}$/i.test(club_id)) return res.status(400).json({ error: "Select a valid club." });
    if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 120) return res.status(400).json({ error: "Event title must be between 3 and 120 characters." });
    if (typeof description !== "string" || !description.trim() || description.trim().length > 1500) return res.status(400).json({ error: "Description is required and must be at most 1500 characters." });
    if (typeof location !== "string" || !location.trim() || location.trim().length > 160) return res.status(400).json({ error: "Location is required and must be at most 160 characters." });
    const date = new Date(starts_at);
    if (!starts_at || Number.isNaN(date.getTime()) || date <= new Date()) return res.status(400).json({ error: "Choose a valid future date and time." });
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return res.status(400).json({ error: "Capacity must be a whole number from 1 to 10000." });
    const { data, error } = await supabase.from("events").insert({ club_id, title: title.trim(), description: description.trim(), location: location.trim(), starts_at: date.toISOString(), capacity, created_by: req.user.id }).select("id,club_id,title,description,location,starts_at,capacity,created_at").single();
    if (error) { if (error.code === "23503") return res.status(400).json({ error: "The selected club does not exist." }); throw error; }
    res.status(201).json({ data });
  } catch (error) { next(error); }
});
module.exports = router;
