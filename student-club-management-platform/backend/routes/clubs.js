const express = require("express");
const supabase = require("../supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("clubs").select("id,name,description,category,created_at").order("name");
    if (error) throw error;
    res.json({ data });
  } catch (error) { next(error); }
});
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Club name must be between 2 and 100 characters." });
    if (!description || description.length > 1000) return res.status(400).json({ error: "Description is required and must be at most 1000 characters." });
    if (!category || category.length > 60) return res.status(400).json({ error: "Category is required and must be at most 60 characters." });
    const { data, error } = await supabase.from("clubs").insert({ name, description, category, created_by: req.user.id }).select("id,name,description,category,created_at").single();
    if (error) { if (error.code === "23505") return res.status(409).json({ error: "A club with this name already exists." }); throw error; }
    res.status(201).json({ data });
  } catch (error) { next(error); }
});
module.exports = router;
