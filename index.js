import express from "express";
import env from "dotenv";
import bcrypt from "bcrypt";
import passport from "passport";
import pkg from "pg";
import session from "express-session";
import { Strategy } from "passport-local";
import flash from "connect-flash";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";

env.config();

const app = express();
const port = 3000;
const saltRounds = 10;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Security headers ----------
// CSP is disabled here deliberately: this app loads external resources from
// several CDNs (unpkg for Leaflet, OpenStreetMap tiles, Google Fonts,
// jsDelivr for icons). Helmet adds headers to HTTP responses for security.

app.use(helmet({ contentSecurityPolicy: false }));

// ---------- Rate limiting ----------
// Slows down brute-force login/registration attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many attempts. Please try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Protects the YOLO + LLM pipeline from being spammed (both cost money/compute).
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: "Too many reports submitted. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(session({
  secret: process.env.COOKIES_PASSWORD,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // ms * sec * min * hour
  }
}));

app.use(flash()); // For flashing error messages to the user (e.g., "Incorrect password" on login failure)

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

// Makes the logged-in user (or null) available in every EJS view automatically,
// so header.ejs can show/hide nav links without every route passing it manually.
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  next();
});

const { Pool } = pkg;
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

app.use(express.static("public"));

// ---------- Email (Nodemailer) ----------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password, not the normal password
  },
});

async function sendVerificationEmail(toEmail, token) {
  const verifyUrl = `${process.env.APP_BASE_URL}/verify/${token}`;

  await transporter.sendMail({
    from: `"Community Hero" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify your Community Hero account",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your email</h2>
        <p>Thanks for signing up for Community Hero. Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}"
           style="display:inline-block; padding:12px 24px; background:#3586ff; color:#fff; text-decoration:none; border-radius:8px; margin:16px 0;">
          Verify Email
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${verifyUrl}</p>
      </div>
    `,
  });
}

async function sendResetEmail(toEmail, token) {
  const resetUrl = `${process.env.APP_BASE_URL}/reset-password/${token}`;

  await transporter.sendMail({
    from: `"Community Hero" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Reset your Community Hero password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <a href="${resetUrl}"
           style="display:inline-block; padding:12px 24px; background:#3586ff; color:#fff; text-decoration:none; border-radius:8px; margin:16px 0;">
          Reset Password
        </a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

// ---------- Auth middleware ----------

function requireLogin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect("/login");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect("/login");
  }
  if (req.user.role !== "admin") {
    return res.status(403).send("Admins only.");
  }
  next();
}

// ---------- Public / auth pages ----------

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});


app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", authLimiter, async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (checkResult.rows.length > 0) {
      return res.send("Email already exists. Try logging in.");
    }

    const hash = await bcrypt.hash(password, saltRounds);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await pool.query(
      "INSERT INTO users (email, password, is_verified, verification_token) VALUES ($1, $2, $3, $4)",
      [email, hash, false, verificationToken]
    );

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailErr) {
      // Don't fail the whole registration just because the email didn't send -
      console.error("Failed to send verification email:", emailErr.message);
    }

    req.flash("success", "Registration successful! Please check your email to verify your account before logging in.");
    res.redirect("/login");

  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const result = await pool.query(
      "SELECT * FROM users WHERE verification_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      req.flash("error", "Invalid or expired verification link.");
      return res.redirect("/login");
    }

    await pool.query(
      "UPDATE users SET is_verified = true, verification_token = NULL WHERE verification_token = $1",
      [token]
    );

    req.flash("success", "Email verified! You can now log in.");
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Verification failed. Please try again later.");
  }
});

// ---------- Forgot / reset password ----------

app.get("/forgot-password", (req, res) => {
  res.render("forgot-password.ejs");
});

app.post("/forgot-password", authLimiter, async (req, res) => {
  const email = req.body.username;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    // Always show the same message whether or not the email exists,
    // so we don't leak which emails are registered.
    const genericMessage = "If that email is registered, a password reset link has been sent.";

    if (result.rows.length === 0) {
      req.flash("success", genericMessage);
      return res.redirect("/forgot-password");
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [resetToken, expires, user.id]
    );

    try {
      await sendResetEmail(email, resetToken);
    } catch (emailErr) {
      console.error("Failed to send reset email:", emailErr.message);
    }

    req.flash("success", genericMessage);
    res.redirect("/forgot-password");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.get("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [token]
    );

    if (result.rows.length === 0) {
      req.flash("error", "That reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.render("reset-password.ejs", { token });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.post("/reset-password/:token", authLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/reset-password/${token}`);
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [token]
    );

    if (result.rows.length === 0) {
      req.flash("error", "That reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    const user = result.rows[0];
    const hash = await bcrypt.hash(password, saltRounds);

    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hash, user.id]
    );

    req.flash("success", "Your password has been reset. Please log in.");
    res.redirect("/login");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


app.get("/logout", (req, res,next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.post("/login", authLimiter, passport.authenticate("local", {
  successRedirect: "/",
  failureRedirect: "/login",
  failureFlash: true
}));

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];

        if (!user.is_verified) {
          return cb(null, false, { message: "Please verify your email before logging in. Check your inbox for the verification link." }); //cb(error, user, info)
        }

        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, result) => {
          if (err) {
            return cb(err);
          } else {
            if (result) {
              return cb(null, user);
            } else {
              return cb(null, false, { message: "Incorrect password" });
            }
          }
        });
      } else {
        return cb(null, false, { message: "Email not found" });
      }
    } catch (err) {
      return cb(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

// ---------- Report submission (citizen-facing) ----------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

app.get("/reports/new", requireLogin, (req, res) => {
  res.render("submit-report");
});

app.post("/reports", requireLogin, reportLimiter, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      // Handles multer errors (file too large, wrong type) with a clean message.
      return res.status(400).send(err.message);
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No image uploaded");
    }

    const imagePath = req.file.path.replace(/\\/g, "/");

    // 1) Send original image to YOLO service
    const form = new FormData();  // multipart/form-data request body
    form.append("file", fs.createReadStream(imagePath));

    const detectResponse = await axios.post(`${process.env.YOLO_SERVICE_URL}/detect`, form, {
    headers: form.getHeaders(),
    });

    const detections = detectResponse.data.detections;
    const annotatedBase64 = detectResponse.data.annotated_image_base64;

    // 2) Save the annotated (bounding-box) image
    const annotatedFilename = "annotated-" + Date.now() + ".jpg";
    const annotatedPath = "public/uploads/" + annotatedFilename;
    fs.writeFileSync(annotatedPath, Buffer.from(annotatedBase64, "base64"));

    // 3) Resolve location: GPS takes priority, falls back to manual text
    const latitude = req.body.latitude ? parseFloat(req.body.latitude) : null;
    const longitude = req.body.longitude ? parseFloat(req.body.longitude) : null;

    const locationText =
      req.body.location && req.body.location.trim() !== ""
        ? req.body.location.trim()
        : latitude && longitude
        ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : "Unknown location";

    // 4) Generate the structured agent report
    const reportResponse = await axios.post(`${process.env.AGENT_SERVICE_URL}/generate-report`, {
      detections: detections,
      location: locationText,
    });

    const structuredReport = reportResponse.data;

    // 5) Save to Postgres
    await pool.query(
      `INSERT INTO reports
         (user_id, image_url, annotated_image_url, raw_detections, structured_report, status, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.id,
        imagePath,
        annotatedPath,
        JSON.stringify(detections),
        JSON.stringify(structuredReport),
        "pending",
        latitude,
        longitude,
      ]
    );

    res.redirect("/my-reports");

  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong: " + err.message);
  }
});

// ---------- Logged-in user's own reports ----------

app.get("/my-reports", requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.render("my-reports", { reports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load your reports: " + err.message);
  }
});

// ---------- Admin dashboard ----------

app.get("/admin/reports", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM reports
      ORDER BY
        CASE structured_report->>'severity'
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        created_at DESC
    `);
    res.render("admin", { reports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load admin dashboard: " + err.message);
  }
});

app.get("/admin/map", requireAdmin, async (req, res) => {
  try {
    const centerLat = req.query.lat ? parseFloat(req.query.lat) : null;
    const centerLng = req.query.lng ? parseFloat(req.query.lng) : null;
    const radiusKm = req.query.radius ? parseFloat(req.query.radius) : 5;

    let result;

    if (centerLat !== null && centerLng !== null) {
      result = await pool.query(
        `
        WITH distances AS (
          SELECT *,
            6371 * acos(
              cos(radians($1)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(latitude))
            ) AS distance_km
          FROM reports
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        )
        SELECT * FROM distances
        WHERE distance_km <= $3
        ORDER BY distance_km ASC
        `,
        [centerLat, centerLng, radiusKm]
      );
    } else {
      result = await pool.query(`
        SELECT id, latitude, longitude, structured_report, status
        FROM reports
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      `);
    }

    res.render("admin-map", {
      reports: result.rows,
      centerLat,
      centerLng,
      radiusKm,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to load map: " + err.message);
  }
});

app.post("/admin/reports/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "in_progress", "resolved"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).send("Invalid status value");
    }

    await pool.query(
      "UPDATE reports SET status = $1 WHERE id = $2",
      [status, id]
    );

    res.redirect("/admin/reports");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to update status: " + err.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
