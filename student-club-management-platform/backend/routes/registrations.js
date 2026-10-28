const express = require("express");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("registrations").select("id,event_id,created_at,events(title,starts_at,location,clubs(name))").eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ data: data.map(r => ({ id: r.id, event_id: r.event_id, created_at: r.created_at, event_title: r.events?.title || "Event unavailable", starts_at: r.events?.starts_at, location: r.events?.location, club_name: r.events?.clubs?.name || "Campus event" })) });
  } catch (error) { next(error); }
});
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const event_id = req.body.event_id;
    if (typeof event_id !== "string" || !/^[0-9a-f-]{36}$/i.test(event_id)) return res.status(400).json({ error: "Select a valid event." });
    const { data, error } = await supabase.rpc("register_for_event", { p_event_id: event_id, p_user_id: req.user.id });
    if (error) {
      if (error.message.includes("EVENT_NOT_FOUND")) return res.status(404).json({ error: "Event not found." });
      if (error.message.includes("EVENT_PASSED")) return res.status(400).json({ error: "Registration is closed because this event has started." });
      if (error.message.includes("EVENT_FULL")) return res.status(409).json({ error: "Sorry, this event is full." });
      if (error.message.includes("ALREADY_REGISTERED")) return res.status(409).json({ error: "You are already registered for this event." });
      throw error;
    }
    res.status(201).json({ data: { registration_id: data } });
  } catch (error) { next(error); }
});
router.delete("/:eventId", requireAuth, async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.eventId)) return res.status(400).json({ error: "Invalid event ID." });
    const { data, error } = await supabase.from("registrations").delete().eq("event_id", req.params.eventId).eq("user_id", req.user.id).select("id");
    if (error) throw error;
    if (!data.length) return res.status(404).json({ error: "Your registration was not found." });
    res.json({ data: { cancelled: true } });
  } catch (error) { next(error); }
});
module.exports = router;
