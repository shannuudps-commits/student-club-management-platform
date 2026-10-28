const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabase");
const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many authentication attempts. Try again in 15 minutes." } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
function makeToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "2h", issuer: "campus-clubs" });
}
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Name must be between 2 and 80 characters." });
    if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (typeof password !== "string" || password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be between 8 and 72 characters." });
    const { data: existing, error: lookupError } = await supabase.from("app_users").select("id").eq("email", email).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });
    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from("app_users").insert({ name, email, password_hash, role: "student" }).select("id,name,email,role").single();
    if (error) { if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." }); throw error; }
    res.status(201).json({ data: { token: makeToken(user), user: publicUser(user) } });
  } catch (error) { next(error); }
});
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body.password;
    if (!emailPattern.test(email) || typeof password !== "string" || !password) return res.status(400).json({ error: "Enter your email and password." });
    const { data: user, error } = await supabase.from("app_users").select("id,name,email,role,password_hash").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
    res.json({ data: { token: makeToken(user), user: publicUser(user) } });
  } catch (error) { next(error); }
});
module.exports = router;
