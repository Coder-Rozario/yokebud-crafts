const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const { google } = require('googleapis');
const cron = require('node-cron');
const multer = require("multer");
const bcrypt = require("bcrypt");
const app = express();
const path = require("path");
const fs = require("fs");

const compression = require("compression");
const helmet = require("helmet");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const { sendEmail, getStudentEmailTemplate, getAdminEmailTemplate } = require("./utils/emailHelper");
require("dotenv").config();

// Middleware
app.use(cors({ maxAge: 86400 }));
app.use(compression());
app.set("trust proxy", 1);
app.set("etag", "strong");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(hpp());
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Add this middleware to handle /api prefix globally
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  next();
});

// Lightweight response cache for GET requests
const responseCache = new Map();
function clearCache() {
  responseCache.clear();
}

function cacheGet(ttlMs = 45000) {
  return (req, res, next) => {
    if (req.method !== "GET" || "nocache" in req.query) return next();
    const key = req.originalUrl;
    const now = Date.now();
    const cached = responseCache.get(key);
    if (cached && now - cached.time < ttlMs) {
      res.set("X-Cache", "HIT");
      if (cached.headers) {
        Object.entries(cached.headers).forEach(([h, v]) => v && res.set(h, v));
      }
      return res.status(cached.status).send(cached.body);
    }
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      try {
        const headers = {
          "Cache-Control": res.get("Cache-Control") || "public, max-age=45",
          ETag: res.get("ETag") || undefined,
        };
        responseCache.set(key, {
          body,
          time: Date.now(),
          status: res.statusCode,
          headers,
        });
        res.set("X-Cache", "MISS");
      } catch {}
      return originalSend(body);
    };
    next();
  };
}
app.use(cacheGet(5000));

// Middleware to clear cache on POST, PUT, DELETE
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    clearCache();
  }
  next();
});

// Helper for standard queries with connection pool management
const executeQuery = (sql, params, callback) => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection error:", err);
      if (typeof callback === 'function') callback(err, null);
      return;
    }
    connection.query(sql, params, (queryErr, results) => {
      connection.release();
      if (typeof callback === 'function') callback(queryErr, results);
    });
  });
};

// Helper for dynamic updates
const dynamicUpdate = (table, updates, whereClause, whereValues, res) => {
  const fields = Object.keys(updates).filter(key => updates[key] !== undefined);
  if (fields.length === 0) {
    return res.status(200).json({ message: "No changes to update" });
  }

  const setClause = fields.map(field => `\`${field}\` = ?`).join(", ");
  const values = fields.map(field => updates[field]);
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;

  executeQuery(sql, [...values, ...whereValues], (err, result) => {
    if (err) {
      console.error(`Error updating ${table}:`, err);
      // Handle missing table error (ER_NO_SUCH_TABLE)
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(200).json({ message: "Update skipped: Table does not exist", error: "TABLE_MISSING" });
      }
      return res.status(500).json({ error: `Failed to update ${table}` });
    }
    if (result && result.affectedRows > 0) {
      res.status(200).json({ message: "Updated successfully!" });
    } else {
      res.status(404).json({ error: "No record found to update" });
    }
  });
};

app.use((req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "public, max-age=5");
  }
  next();
});
app.use(bodyParser.json()); // For JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // For form-encoded bodies



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/';
    const url = (req.originalUrl || req.url).toLowerCase();
    console.log("Processing Upload for URL:", url);
    
    // Priority matching
    if (url.includes('api/news')) {
        uploadPath += 'news_and_events/';
    } else if (url.includes('api/videos')) {
        uploadPath += 'Videos/';
    } else if (url.includes('about') || url.includes('portfolio') || 
               url.includes('profile') || url.includes('dream') || 
               url.includes('brief') || url.includes('authority') || 
               url.includes('concession')) {
        uploadPath += 'about/';
    } else if (url.includes('teacher')) {
        uploadPath += 'teachers/';
    } else if (url.includes('staff')) {
        uploadPath += 'staff/';
    } else if (url.includes('notice')) {
        uploadPath += 'notices/';
    } else if (url.includes('admission') || url.includes('submit-admission')) {
        uploadPath += 'admission/';
    } else if (url.includes('save') || url.includes('campus')) {
        uploadPath += 'campus/';
    } else if (url.includes('feedback')) {
        uploadPath += 'feedback/';
    } else if (url.includes('hero-image')) {
        uploadPath += 'department/';
    } else if (url.includes('photo')) {
        uploadPath += 'hero_images/';
    } else if (url.includes('upload')) {
        uploadPath += 'photos/';
    }

    console.log("Final Upload Path:", uploadPath);

    // Ensure the folder exists
    if (!fs.existsSync(uploadPath)) {
      try {
        fs.mkdirSync(uploadPath, { recursive: true });
      } catch (err) {
        console.error("Error creating directory:", err);
      }
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection error:", err);
    return;
  }
  console.log("Connected to MySQL database!");
  if (connection) connection.release();
});

setInterval(() => {
  executeQuery("SELECT 1", [], () => {});
}, 10 * 60 * 1000);

// --- Google Reviews sync (fetch from Google My Business and store in MySQL) ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

async function syncGoogleReviews() {
  try {
    const accountId = process.env.GOOGLE_ACCOUNT_ID;
    const locationId = process.env.GOOGLE_LOCATION_ID;
    if (!accountId || !locationId) {
      console.warn('Google account/location ID not configured; skipping reviews sync.');
      return;
    }

    const res = await oauth2Client.request({
      url: `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
    });

    const reviews = (res && res.data && res.data.reviews) ? res.data.reviews : [];

    for (let review of reviews) {
      const reviewId = review.reviewId || null;
      const reviewerName = review.reviewer && review.reviewer.displayName ? review.reviewer.displayName : null;
      const profilePhoto = review.reviewer && review.reviewer.profilePhotoUrl ? review.reviewer.profilePhotoUrl : '';
      const starRating = review.starRating === 'FIVE' ? 5 : review.starRating === 'FOUR' ? 4 : review.starRating === 'THREE' ? 3 : review.starRating === 'TWO' ? 2 : 1;
      const comment = review.comment || '';
      const createTime = review.createTime ? new Date(review.createTime) : new Date();
      const ownerReply = review.reviewReply ? review.reviewReply.comment : null;
      const ownerReplyTime = review.reviewReply && review.reviewReply.updateTime ? new Date(review.reviewReply.updateTime) : null;

      const query = `
        INSERT INTO google_reviews (review_id, reviewer_name, reviewer_profile_photo, star_rating, comment, create_time, owner_reply, owner_reply_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        reviewer_name = VALUES(reviewer_name),
        reviewer_profile_photo = VALUES(reviewer_profile_photo),
        star_rating = VALUES(star_rating),
        comment = VALUES(comment),
        owner_reply = VALUES(owner_reply),
        owner_reply_time = VALUES(owner_reply_time)
      `;

      await new Promise((resolve) => {
        db.query(query, [reviewId, reviewerName, profilePhoto, starRating, comment, createTime, ownerReply, ownerReplyTime], (err) => {
          if (err) console.error('DB insert/update error for google_reviews:', err);
          resolve();
        });
      });
    }

    console.log('Google Reviews successfully synced with MySQL Database.');
  } catch (error) {
    console.error('Error syncing Google reviews:', error);
  }
}

// Schedule daily sync at 00:00 server time
cron.schedule('0 0 * * *', () => {
  console.log('Running daily Google Reviews sync...');
  syncGoogleReviews();
});

// Expose simple API endpoints for frontend
app.get('/api/google-reviews', (req, res) => {
  db.query('SELECT * FROM google_reviews ORDER BY create_time DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database fetch error' });
    res.status(200).json(rows);
  });
});

app.get('/api/sync-reviews-manual', async (req, res) => {
  await syncGoogleReviews();
  res.send('Sync trigger completed.');
});

// Serve Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// Specific limiter for login to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login requests per window
  message: { error: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login Route
app.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required!" });
  }

  const sql = "SELECT * FROM admin_users WHERE username = ?";
  executeQuery(sql, [username], async (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(401).json({ error: "Auth table missing." });
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    
    if (results && results.length > 0) {
      const user = results[0];
      const dbPassword = (user.password || "");
      
      // Check if password is encrypted (starts with $2b$ or similar bcrypt prefixes)
      const isEncrypted = dbPassword.startsWith("$2b$") || dbPassword.startsWith("$2a$");
      
      let isMatch = false;
      try {
        if (isEncrypted) {
          isMatch = await bcrypt.compare(password, dbPassword);
        } else {
          // Fallback for plain text
          isMatch = (password === dbPassword);
        }

        if (isMatch) {
          return res.status(200).json({ 
            message: "Login successful!",
            token: "authenticated_admin_token_" + Date.now() // Generating a unique-ish token
          });
        }
      } catch (error) {
        console.error("Bcrypt compare error:", error);
        return res.status(500).json({ error: "Authentication error" });
      }
    }
    
    // Default fail response
    res.status(401).json({ error: "Invalid username or password!" });
  });
});

// API Endpoint for Form Submission
app.post("/submit-form", (req, res) => {
  const { name, email, phone, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).send("Name, email, and message are required!");
  }
  
  const sql = "INSERT INTO contacts (name, email, phone, message) VALUES (?, ?, ?, ?)";
  executeQuery(sql, [name, email, phone, message], (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).send("Failed to save data to the database.");
    }
    res.status(200).send("Form data successfully saved!");
  });
});

// API Endpoint to Fetch Messages
app.get("/get-messages", (req, res) => {
  const sql = "SELECT * FROM contacts";
  executeQuery(sql, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Database query error:", err);
      return res.status(500).send("Failed to fetch messages from the database.");
    }
    res.status(200).json(results);
  });
});

// API Endpoint to Delete a Message
app.delete("/delete-message/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM contacts WHERE id = ?";
  
  executeQuery(sql, [id], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing, nothing to delete." });
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Failed to delete message." });
    }
    if (result && result.affectedRows === 0) {
      return res.status(404).json({ message: "Message not found." });
    }
    res.status(200).json({ message: "Message deleted successfully." });
  });
});

// API Endpoint to Get Message Details
app.get("/get-message-details/:id", (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return res.status(400).json({ message: "Invalid message ID." });
  }
  
  const sql = "SELECT * FROM contacts WHERE id = ?";
  executeQuery(sql, [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(404).json({ message: "Table not found." });
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Failed to fetch message details." });
    }
    
    if (results && results.length === 0) {
      return res.status(404).json({ message: "Message not found." });
    }
    
    res.status(200).json(results[0]);
  });
});

// API Endpoint to Update Message Status
app.put("/update-message-status/:id", (req, res) => {
  const { id } = req.params;
  const { is_viewed } = req.body;
  dynamicUpdate("contacts", { is_viewed }, "id = ?", [id], res);
});

// API Endpoint to Get Unread Messages Count
app.get("/unread-messages", (req, res) => {
  executeQuery("SELECT COUNT(*) AS unreadCount FROM contacts WHERE is_viewed = 0", [], (err, result) => {
      if (err) {
          if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ unreadCount: 0 });
          return res.status(500).json({ error: err.message });
      }
      res.json({ unreadCount: (result && result[0] ? result[0].unreadCount : 0) });
  });
});

//Admission

// API Endpoint to Update Admission Status
app.put("/update-admission-status/:id", (req, res) => {
  const { id } = req.params;
  const { is_Clicked } = req.body;
  dynamicUpdate("online_admissions", { is_Clicked }, "id = ?", [id], res);
});

// API Endpoint to Get Admission Status
app.get("/online-admissions-status", (req, res) => {
  const query = `
    SELECT id, is_Clicked
    FROM online_admissions
  `;

  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Error fetching admission statuses: " + err.message);
      return res.status(500).json({ error: "Failed to fetch admission statuses." });
    }
    res.json(results);
  });
});

// API Endpoint to Get Unread Admissions Count
app.get("/unread-admissions", (req, res) => {
  executeQuery("SELECT COUNT(*) AS unreadCount FROM online_admissions WHERE is_Clicked = 0", [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ unreadCount: 0 });
      return res.status(500).json({ error: err.message });
    }
    res.json({ unreadCount: (result && result[0] ? result[0].unreadCount : 0) });
  });
});



//Notice Board


// API Endpoint to Upload Notices
app.post("/upload-notice", upload.single("files"), async (req, res) => {
  console.log("Upload request received");
  console.log("Request body:", req.body);
  console.log("Request file:", req.file);
  
  const { title } = req.body;

  if (!req.file || !title) {
    console.log("Missing file or title");
    return res.status(400).json({ message: "Title and file are required." });
  }

  const sql = "INSERT INTO notice_board (title, file_path) VALUES (?, ?)";
  executeQuery(sql, [title, req.file.path.replace(/\\/g, '/')], (err) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Failed to upload notice." });
    }
    console.log("Notice uploaded successfully!");
    res.status(200).json({ message: "Notice uploaded successfully!" });
  });
});

// API Endpoint to Fetch Notices
app.get('/get-notices', (req, res) => {
  const sql = "SELECT * FROM notice_board";
  executeQuery(sql, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      return res.status(500).json({ message: "Error fetching notices." });
    }
    res.status(200).json((results || []).map(notice => ({
      ...notice,
      fileUrl: notice.file_path
    })));
  });
});

// API Endpoint to Delete a Notice
app.delete("/delete-notice/:id", (req, res) => {
  const { id } = req.params;
  console.log("Delete request received for notice ID:", id);

  if (!id || isNaN(id)) {
    console.log("Invalid notice ID");
    return res.status(400).json({ message: "Invalid notice ID." });
  }

  // First, get the file path
  executeQuery('SELECT file_path FROM notice_board WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      console.error("Error fetching notice:", err);
      return res.status(500).json({ message: "Error fetching notice." });
    }
    if (!results || results.length === 0) {
      console.log("Notice not found in database");
      return res.status(404).json({ message: "Notice not found." });
    }

    const filePath = results[0].file_path;
    console.log("File path to delete:", filePath);

    // Then, delete the notice record
    executeQuery("DELETE FROM notice_board WHERE id = ?", [id], (deleteErr, result) => {
      if (deleteErr) {
        console.error("Failed to delete notice:", deleteErr);
        return res.status(500).json({ message: "Failed to delete notice." });
      }

      if (result && result.affectedRows > 0) {
        console.log("Notice deleted from database, affected rows:", result.affectedRows);
        // If record is deleted, delete the file
        if (filePath && fs.existsSync(filePath)) {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error deleting notice file:", unlinkErr);
            } else {
              console.log("File deleted successfully:", filePath);
            }
          });
        }
        console.log("Notice deletion completed successfully");
        res.status(200).json({ message: "Notice deleted successfully." });
      } else {
        console.log("No rows affected, notice not found");
        res.status(404).json({ message: "Notice not found." });
      }
    });
  });
});

// API Endpoint to Edit a Notice
app.put("/edit-notice/:id", upload.single("file"), (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const file = req.file;

  let newFilePath = null;
  if (file) {
    newFilePath = file.path.replace(/\\/g, '/');
  }

  // Get old file path to delete it
  executeQuery('SELECT file_path FROM notice_board WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      console.error('Error fetching old file path:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    const oldFilePath = (results && results.length > 0 ? results[0].file_path : null);

    // Determine the file path to be saved
    const finalFilePath = newFilePath || oldFilePath;

    dynamicUpdate('notice_board', { title, file_path: finalFilePath }, 'id = ?', [id], res);
    if (file && oldFilePath && fs.existsSync(oldFilePath)) {
      fs.unlink(oldFilePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old notice file:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Change Password
app.post("/change-password", async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "Username, current password and new password are required." });
  }

  const sql = "SELECT * FROM admin_users WHERE username = ?";
  executeQuery(sql, [username], async (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(401).json({ message: "Auth table missing." });
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (!results || results.length === 0) {
      return res.status(401).json({ message: "User not found." });
    }

    const user = results[0];
    const isEncrypted = user.password.startsWith("$2b$") || user.password.startsWith("$2a$");
    
    let isMatch = false;
    try {
      if (isEncrypted) {
        isMatch = await bcrypt.compare(currentPassword, user.password);
      } else {
        isMatch = (currentPassword === user.password);
      }

      if (!isMatch) {
        return res.status(401).json({ message: "Current password is incorrect." });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      dynamicUpdate("admin_users", { password: hashedPassword }, "username = ?", [username], res);
    } catch (error) {
      console.error("Bcrypt error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
});

// API Endpoint to Change Username
app.post("/change-username", (req, res) => {
  const { currentUsername, newUsername } = req.body;

  if (!currentUsername || !newUsername) {
    return res.status(400).json({ message: "Current username and new username are required." });
  }

  const sql = "SELECT * FROM admin_users WHERE username = ?";
  executeQuery(sql, [currentUsername], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(401).json({ message: "Auth table missing." });
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (!results || results.length === 0) {
      return res.status(401).json({ message: "Current username is incorrect." });
    }

    dynamicUpdate("admin_users", { username: newUsername }, "username = ?", [currentUsername], res);
  });
});

// News & Events API Endpoints

// GET all news
app.get("/news", (req, res) => {
  const sql = "SELECT * FROM news_and_events ORDER BY created_at DESC";
  executeQuery(sql, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Failed to fetch news." });
    }
    res.status(200).json(results);
  });
});

// POST new news
app.post("/news", upload.single('image'), (req, res) => {
  const { title, details } = req.body;
  const image = req.file ? req.file.path.replace(/\\/g, '/') : null;

  if (!title || !details || !image) {
    return res.status(400).json({ message: "Title, details, and image are required." });
  }

  const sql = "INSERT INTO news_and_events (title, details, image) VALUES (?, ?, ?)";
  executeQuery(sql, [title, details, image], (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ message: "Failed to save news." });
    }
    const newNewsId = result.insertId;
    executeQuery("SELECT * FROM news_and_events WHERE id = ?", [newNewsId], (fetchErr, newNews) => {
      if (fetchErr) {
        return res.status(500).json({ message: "Failed to fetch newly created news." });
      }
      res.status(201).json(newNews[0]);
    });
  });
});

// PUT (update) news
app.put("/news/:id", upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, details } = req.body;
  
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (details !== undefined) updates.details = details;

  if (req.file) {
    const newImage = req.file.path.replace(/\\/g, '/');
    executeQuery('SELECT image FROM news_and_events WHERE id = ?', [id], (err, results) => {
      if (!err && results && results.length > 0) {
        const oldImagePath = results[0].image;
        if (oldImagePath && fs.existsSync(oldImagePath)) {
          fs.unlink(oldImagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting old image file:", unlinkErr);
          });
        }
      }
      updates.image = newImage;
      dynamicUpdate('news_and_events', updates, 'id = ?', [id], res);
    });
  } else {
    dynamicUpdate('news_and_events', updates, 'id = ?', [id], res);
  }
});

// DELETE news
app.delete("/news/:id", (req, res) => {
  const { id } = req.params;

  // First, get the file path to delete the image
  executeQuery('SELECT image FROM news_and_events WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: "Error fetching news item." });
    }

    const imagePath = (results && results.length > 0 ? results[0].image : null);

    const sql = "DELETE FROM news_and_events WHERE id = ?";
    executeQuery(sql, [id], (deleteErr, result) => {
      if (deleteErr) {
        console.error("Database query error:", deleteErr);
        return res.status(500).json({ message: "Failed to delete news." });
      }
      if (result && result.affectedRows > 0) {
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting image file:", unlinkErr);
          });
        }
        res.status(200).json({ message: "News deleted successfully." });
      } else {
        res.status(404).json({ message: "News not found." });
      }
    });
  });
});

// API Endpoint to Save Web Data
app.post("/save-content", (req, res) => {
    const { marqueeText, phoneNumbers, facebookLink, linkedinLink, twitterLink, youtubeLink } = req.body;

    const query = `
        INSERT INTO web_data (marqueeText, phone, facebookLink, linkedinLink, twitterLink, youtubeLink)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            marqueeText = VALUES(marqueeText),
            phone = VALUES(phone),
            facebookLink = VALUES(facebookLink),
            linkedinLink = VALUES(linkedinLink),
            twitterLink = VALUES(twitterLink),
            youtubeLink = VALUES(youtubeLink);
    `;

    executeQuery(
        query,
        [marqueeText, phoneNumbers, facebookLink, linkedinLink, twitterLink, youtubeLink],
        (err, result) => {
            if (err) {
                console.error("Error saving content:", err);
                res.status(500).send("Error saving content");
            } else {
                res.status(200).send("Content saved successfully");
            }
        }
    );
});

// API Endpoint to Fetch Web Data
app.get('/get-web-data', (req, res) => {
  const query = "SELECT `id`, `marqueeText`, `phone` AS `phoneNumbers`, `facebookLink`, `linkedinLink`, `twitterLink`, `youtubeLink` FROM `web_data` WHERE 1";
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error(err);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json((results && results[0]) || {});  // Fallback to empty object if no data found
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Endpoint to Fetch Teachers
app.get('/teachers', (req, res) => {
  const sql = "SELECT * FROM teachers";
  executeQuery(sql, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Database query error:", err);
      return res.status(500).send("Failed to fetch teachers from the database.");
    }
    res.status(200).json(results);
  });
});

// API Endpoint to Update Web Data
app.post('/update-web-data', (req, res) => {
  const { marqueeText, phoneNumbers, facebookLink, linkedinLink, twitterLink, youtubeLink } = req.body;
  const updates = {};
  if (marqueeText !== undefined) updates.marqueeText = marqueeText;
  if (phoneNumbers !== undefined) updates.phone = phoneNumbers;
  if (facebookLink !== undefined) updates.facebookLink = facebookLink;
  if (linkedinLink !== undefined) updates.linkedinLink = linkedinLink;
  if (twitterLink !== undefined) updates.twitterLink = twitterLink;
  if (youtubeLink !== undefined) updates.youtubeLink = youtubeLink;

  dynamicUpdate('web_data', updates, 'id = ?', [1], res);
});

// API Endpoint to Fetch Intro Data
app.get('/getIntroData', (req, res) => {
  const query = 'SELECT `intro_Eng`, `intro_Ban`, `subtitle` FROM `web_data` WHERE 1';

  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(404).json({ error: 'Table not found' });
      console.error('Error fetching data from DB:', err);
      res.status(500).json({ error: 'Failed to fetch data' });
      return;
    }

    if (results && results.length > 0) {
      const { intro_Eng, intro_Ban, subtitle } = results[0];
      res.json({ intro_Eng, intro_Ban, subtitle });
    } else {
      res.status(404).json({ error: 'No data found' });
    }
  });
});

// API Endpoint to Update Intro Data
app.post('/updateIntroData', (req, res) => {
  const { intro_Eng, intro_Ban, subtitle } = req.body;
  const updates = {};
  if (intro_Eng !== undefined) updates.intro_Eng = intro_Eng;
  if (intro_Ban !== undefined) updates.intro_Ban = intro_Ban;
  if (subtitle !== undefined) updates.subtitle = subtitle;

  dynamicUpdate('web_data', updates, 'id = ?', [1], res);
});

// API Endpoint to Fetch Overview Data
app.get('/overview', (req, res) => {
  const query = 'SELECT id, ovr_photo, ovr_heading, ovr_text FROM web_data WHERE 1';

  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error('Error fetching data from the database:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.json(results);
    }
  });
});

// API Endpoint to Update Overview Data
app.put('/overview', (req, res) => {
  const { ovr_heading, ovr_text, ovr_photo } = req.body;
  const updates = {};
  if (ovr_heading !== undefined) updates.ovr_heading = ovr_heading;
  if (ovr_text !== undefined) updates.ovr_text = ovr_text;
  if (ovr_photo !== undefined) updates.ovr_photo = ovr_photo;

  dynamicUpdate('web_data', updates, 'id = ?', [1], res);
});

// API Endpoint to Upload Photo
app.post('/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const photoPath = req.file.path.replace(/\\/g, '/'); // Path to the uploaded photo
  dynamicUpdate('web_data', { ovr_photo: photoPath }, '1', [], res);
});

// API Endpoint to Fetch Counters
app.get('/counters', (req, res) => {
  const query = "SELECT * FROM counters ORDER BY order_index ASC";
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results || []);
  });
});

// API Endpoint to Add Counter
app.post('/counters', (req, res) => {
  const { title, value, duration } = req.body;
  if (!title || value === undefined) {
    return res.status(400).json({ error: 'Title and value are required' });
  }

  // Get max order_index
  executeQuery('SELECT MAX(order_index) as maxOrder FROM counters', [], (err, results) => {
    const nextOrder = (results && results[0] && results[0].maxOrder !== null) ? results[0].maxOrder + 1 : 0;
    const query = 'INSERT INTO counters (title, value, duration, order_index) VALUES (?, ?, ?, ?)';
    executeQuery(query, [title, value, duration || 1000, nextOrder], (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to add counter' });
      res.status(201).json({ id: result.insertId, title, value, duration: duration || 1000, order_index: nextOrder });
    });
  });
});

// API Endpoint to Update Counters
app.put('/counters/:id', (req, res) => {
  const { id } = req.params;
  const { title, value, duration } = req.body;
  
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (value !== undefined) updates.value = value;
  if (duration !== undefined) updates.duration = duration;

  dynamicUpdate('counters', updates, 'id = ?', [id], res);
});

// API Endpoint to Delete Counter
app.delete('/counters/:id', (req, res) => {
  const { id } = req.params;
  executeQuery('DELETE FROM counters WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to delete counter' });
    res.json({ message: 'Counter deleted successfully' });
  });
});

// API Endpoint to Reorder Counters
app.put('/counters-reorder', (req, res) => {
  const { orders } = req.body; // Array of {id, order_index}
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'Invalid orders format' });

  const promises = orders.map(item => {
    return new Promise((resolve, reject) => {
      executeQuery('UPDATE counters SET order_index = ? WHERE id = ?', [item.order_index, item.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  Promise.all(promises)
    .then(() => res.json({ message: 'Reordered successfully' }))
    .catch(err => res.status(500).json({ error: 'Failed to reorder' }));
});

// API Endpoint to Fetch Portfolio Items
app.get('/portfolio', (req, res) => {
  executeQuery('SELECT * FROM portfolio_items', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results || []);
  });
});

// API Endpoint to Add Portfolio Item
app.post('/portfolio', upload.single('image'), (req, res) => {
  const { title, description, zoomTitle } = req.body;
  const imgSrc = req.file ? req.file.path.replace(/\\/g, '/') : null;

  if (!imgSrc) {
    return res.status(400).json({ message: 'Image is required' });
  }

  const query = 'INSERT INTO portfolio_items (title, description, imgSrc, zoomTitle) VALUES (?, ?, ?, ?)';
  executeQuery(query, [title, description, imgSrc, zoomTitle], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error saving portfolio item' });
    }
    res.status(200).json({ message: 'Portfolio item added successfully', imgSrc });
  });
});

// API Endpoint to Update Portfolio Item
// API Endpoint to Update Portfolio Item
app.put('/portfolio/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, description, zoomTitle } = req.body;
  
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (zoomTitle !== undefined) updates.zoomTitle = zoomTitle;

  if (req.file) {
    const newImgSrc = req.file.path.replace(/\\/g, '/');
    
    // Get old image path to delete it
    executeQuery('SELECT imgSrc FROM portfolio_items WHERE id = ?', [id], (err, results) => {
      if (!err && results && results.length > 0) {
        const oldImagePath = results[0].imgSrc;
        if (oldImagePath && fs.existsSync(oldImagePath)) {
          fs.unlink(oldImagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting old image file:", unlinkErr);
          });
        }
      }
      updates.imgSrc = newImgSrc;
      dynamicUpdate('portfolio_items', updates, 'id = ?', [id], res);
    });
  } else {
    dynamicUpdate('portfolio_items', updates, 'id = ?', [id], res);
  }
});

// API Endpoint to Delete Portfolio Item
app.delete('/portfolio/:id', (req, res) => {
  const { id } = req.params;

  executeQuery('SELECT imgSrc FROM portfolio_items WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ error: 'Error fetching item details' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const imagePath = results[0].imgSrc;

    executeQuery('DELETE FROM portfolio_items WHERE id = ?', [id], (deleteErr, result) => {
      if (deleteErr) {
        return res.status(500).json({ error: 'Failed to delete portfolio item' });
      }
      if (result && result.affectedRows > 0) {
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting image file:", unlinkErr);
          });
        }
        res.json({ message: 'Portfolio item deleted successfully' });
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    });
  });
});


//videos

app.get('/videos', (req, res) => {
  const query = 'SELECT * FROM videos';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

// API Endpoint to Add Video
app.post('/videos', upload.single('video'), (req, res) => {
  const { title } = req.body;
  console.log("Upload Request URL:", req.originalUrl);
  console.log("File Destination:", req.file ? req.file.destination : "No File");

  if (!req.file) {
    return res.status(400).json({ message: "No video file uploaded." });
  }

  const videoUrl = req.file.path.replace(/\\/g, '/');

  const query = 'INSERT INTO videos (title, video_url) VALUES (?, ?)';
  executeQuery(query, [title, videoUrl], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json({ id: (result ? result.insertId : null), title, videoUrl });
  });
});

// API Endpoint to Update Video Title
app.put('/videos/:id', (req, res) => {
  const { title } = req.body;
  const videoId = req.params.id;
  dynamicUpdate('videos', { title }, 'id = ?', [videoId], res);
});

// API Endpoint to Delete Video
app.delete('/videos/:id', (req, res) => {
  const videoId = req.params.id;

  const query = 'DELETE FROM videos WHERE id = ?';
  executeQuery(query, [videoId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    res.json({ message: 'Video deleted successfully' });
  });
});


//Contactes


// API Endpoint to Fetch Contact Details
app.get('/contact', (req, res) => {
  const query = 'SELECT address, email, phone FROM web_data LIMIT 1';
  executeQuery(query, [], (err, results) => {
      if (err) {
          if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
          res.status(500).send({ error: 'Error fetching contact details' });
      } else {
          res.json(results && results[0] ? results[0] : {});
      }
  });
});

// API Endpoint to Update Contact Details
app.put('/contact', (req, res) => {
  const { address, email, phone } = req.body;
  dynamicUpdate('web_data', { address, email, phone }, '1', [], res);
});



// API Endpoint to Fetch Photos
app.get("/photos", (req, res) => {
  const query = "SELECT * FROM photos";
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Error fetching photos:", err);
      return res.status(500).json({ message: "Error fetching photos" });
    }
    res.status(200).json(results || []);
  });
});

// API Endpoint to Upload Photo
app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const imageUrl = req.file.path.replace(/\\/g, '/');

    const query = "INSERT INTO photos (url) VALUES (?)";
    executeQuery(query, [imageUrl], (err, result) => {
      if (err) {
        console.error("Error inserting photo:", err);
        return res.status(500).json({ message: "Error saving photo" });
      }
      res.status(200).json({ id: (result ? result.insertId : null), url: imageUrl });
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    res.status(500).json({ message: "Error uploading photo" });
  }
});

// API Endpoint to Delete Photo
app.delete("/photos/:id", (req, res) => {
  const { id } = req.params;

  // First, get the image path from the database to delete the file
  executeQuery('SELECT url FROM photos WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      console.error("Error fetching photo details:", err);
      return res.status(500).json({ message: "Error fetching photo details" });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Photo not found" });
    }

    const imagePath = results[0].url;

    // Then, delete the photo from the database
    const query = "DELETE FROM photos WHERE id = ?";
    executeQuery(query, [id], (err, result) => {
      if (err) {
        console.error("Error deleting photo from DB:", err);
        return res.status(500).json({ message: "Error deleting photo from database" });
      }

      // Finally, delete the file from the filesystem
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Error deleting photo file:", unlinkErr);
          }
        });
      }

      res.status(200).json({ message: "Photo deleted successfully" });
    });
  });
});

// Serve Static Files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Endpoint to Fetch Teachers
app.get('/teachers', (req, res) => {
  const query = 'SELECT `id`, `name`, `position`, `image`, `email`, `qualification`, `department` FROM `teachers`';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error('Error fetching teachers:', err);
      res.status(500).json({ error: 'Failed to fetch teachers' });
    } else {
      res.json(results || []);
    }
  });
});

//Teachers and staff

// API Endpoint to Add Teacher
app.post('/teachers', upload.single('image'), async (req, res) => {
  const { name, position, email, qualification } = req.body;
  let imageUrl = 'https://via.placeholder.com/150'; // Default image URL

  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/');
  }

  // ডাটাবেজে নতুন শিক্ষক যোগ করা
  const query = 'INSERT INTO `teachers`(`name`, `position`, `image`, `email`, `qualification`, `department`) VALUES (?, ?, ?, ?, ?, ?)';
  executeQuery(query, [name, position, imageUrl, email || null, qualification || null, (req.body.department || null)], (err, result) => {
    if (err) {
      console.error('Error adding teacher:', err);
      res.status(500).json({ error: 'Failed to add teacher' });
    } else {
      res.json({ id: (result ? result.insertId : null), name, position, image: imageUrl, email: email || null, qualification: qualification || null });
    }
  });
});


// API Endpoint to Delete Teacher
app.delete('/teachers/:id', (req, res) => {
  const { id } = req.params;

  // First, get the image path from the database
  executeQuery('SELECT image FROM teachers WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ error: 'Error fetching teacher details' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const imagePath = results[0].image;

    // Then, delete the teacher from the database
    executeQuery('DELETE FROM teachers WHERE id = ?', [id], (deleteErr, result) => {
      if (deleteErr) {
        return res.status(500).json({ error: 'Failed to delete teacher' });
      }
      if (result && result.affectedRows > 0) {
        // If the teacher is deleted, delete the image file
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting image file:", unlinkErr);
          });
        }
        res.json({ message: 'Teacher deleted successfully' });
      } else {
        res.status(404).json({ error: 'Teacher not found' });
      }
    });
  });
});

// API Endpoint to Update Teacher
app.put('/teachers/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, position, email, qualification, department } = req.body;
  
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (position !== undefined) updates.position = position;
  if (email !== undefined) updates.email = email;
  if (qualification !== undefined) updates.qualification = qualification;
  if (department !== undefined) updates.department = department;

  if (req.file) {
    const newImage = req.file.path.replace(/\\/g, '/');
    executeQuery('SELECT image FROM teachers WHERE id = ?', [id], (err, rows) => {
      if (!err && rows && rows.length > 0) {
        const oldImagePath = rows[0].image;
        if (oldImagePath && fs.existsSync(oldImagePath) && !oldImagePath.startsWith('http')) {
          fs.unlink(oldImagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting old image file:", unlinkErr);
          });
        }
      }
      updates.image = newImage;
      dynamicUpdate('teachers', updates, 'id = ?', [id], res);
    });
  } else {
    dynamicUpdate('teachers', updates, 'id = ?', [id], res);
  }
});


// API Endpoint to Fetch Staff
app.get('/staff', (req, res) => {
  const query = 'SELECT id, name, position, image FROM staff';
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      res.status(500).json({ error: 'Failed to fetch staff data' });
    } else {
      res.json(result);
    }
  });
});

// API Endpoint to Add Staff
app.post('/staff', upload.single('image'), async (req, res) => {
  const { name, position } = req.body;
  let imageUrl = 'https://via.placeholder.com/150'; // Default image URL

  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/');
  }

  // Add staff to the database
  const query = 'INSERT INTO staff (name, position, image) VALUES (?, ?, ?)';
  executeQuery(query, [name, position, imageUrl], (err, result) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(200).json({ id: (result ? result.insertId : null), name, position, image: imageUrl });
    }
  });
});

// API Endpoint to Update Staff Image
app.put('/staff/:id/image', upload.single('image'), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  const newImageUrl = req.file.path.replace(/\\/g, '/');

  // Get old image path to delete it
  executeQuery('SELECT image FROM staff WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      console.error('Error fetching old image path:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const oldImagePath = (results && results.length > 0 ? results[0].image : null);

    dynamicUpdate('staff', { image: newImageUrl }, 'id = ?', [id], res);
    if (oldImagePath && fs.existsSync(oldImagePath) && !oldImagePath.startsWith('http')) {
      fs.unlink(oldImagePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image file:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Update Staff Details
app.put('/staff/:id', async (req, res) => {
  const { id } = req.params;
  const { name, position } = req.body;

  if (!name || !position) {
    return res.status(400).json({ error: 'Name and position are required' });
  }

  dynamicUpdate('staff', { name, position }, 'id = ?', [id], res);
});

// API Endpoint to Delete Staff
app.delete('/staff/:id', (req, res) => {
  const staffId = req.params.id;

  executeQuery('SELECT image FROM staff WHERE id = ?', [staffId], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ error: 'Error fetching staff details' });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const imagePath = results[0].image;

    executeQuery('DELETE FROM staff WHERE id = ?', [staffId], (deleteErr, result) => {
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }
      if (result && result.affectedRows > 0) {
        if (imagePath && fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) console.error("Error deleting staff image file:", unlinkErr);
          });
        }
        res.status(200).json({ message: 'Staff removed successfully' });
      } else {
        res.status(404).json({ message: 'Staff member not found' });
      }
    });
  });
});

//Authority

// API Endpoint to Fetch Authority
app.get('/authority', (req, res) => {
  const query = 'SELECT `id`, `name`, `position`, `image`, `order_index` FROM `authority` ORDER BY `order_index` ASC';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      res.status(500).json({ error: 'Database query error' });
    } else {
      res.json(results);
    }
  });
});

// API Endpoint to Add Authority
app.post('/authority', upload.single('image'), (req, res) => {
  const { name, position } = req.body;
  const image = req.file ? req.file.path.replace(/\\/g, '/') : null;

  if (!name || !position) {
    return res.status(400).json({ error: 'Name and position are required' });
  }

  // Get max order_index
  executeQuery('SELECT MAX(order_index) as maxOrder FROM authority', [], (err, results) => {
    const nextOrder = (results && results[0] && results[0].maxOrder !== null) ? results[0].maxOrder + 1 : 0;
    const query = 'INSERT INTO authority (name, position, image, order_index) VALUES (?, ?, ?, ?)';
    executeQuery(query, [name, position, image, nextOrder], (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to add authority' });
      res.status(201).json({ id: result.insertId, name, position, image, order_index: nextOrder });
    });
  });
});

// API Endpoint to Delete Authority
app.delete('/authority/:id', (req, res) => {
  const { id } = req.params;
  
  // Get image path first to delete file
  executeQuery('SELECT image FROM authority WHERE id = ?', [id], (err, results) => {
    const imagePath = results && results[0] ? results[0].image : null;
    
    executeQuery('DELETE FROM authority WHERE id = ?', [id], (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to delete authority' });
      
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting image file:", unlinkErr);
        });
      }
      res.json({ message: 'Authority deleted successfully' });
    });
  });
});

// API Endpoint to Reorder Authority
app.put('/authority-reorder', (req, res) => {
  const { orders } = req.body; // Array of {id, order_index}
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'Invalid orders format' });

  const promises = orders.map(item => {
    return new Promise((resolve, reject) => {
      executeQuery('UPDATE authority SET order_index = ? WHERE id = ?', [item.order_index, item.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  Promise.all(promises)
    .then(() => res.json({ message: 'Reordered successfully' }))
    .catch(err => res.status(500).json({ error: 'Failed to reorder' }));
});

// API Endpoint to Fetch Teacher Details by ID
app.get('/teacher/:id', (req, res) => {
  const teacherId = req.params.id;
  const query = 'SELECT id, name, position, bio, image FROM authority WHERE id = ?';
  
  executeQuery(query, [teacherId], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(404).json({ error: 'Table not found' });
      res.status(500).json({ error: 'Error fetching teacher details' });
      return;
    }
    if (result && result.length > 0) {
      res.json(result[0]);
    } else {
      res.status(404).json({ error: 'Teacher not found' });
    }
  });
});

// API Endpoint to Update Teacher Details
app.put('/teacher/:id', (req, res) => {
  const teacherId = req.params.id;
  const { name, position, bio, image } = req.body;
  dynamicUpdate('authority', { name, position, bio, image }, 'id = ?', [teacherId], res);
});

// API Endpoint to Upload Teacher's Photo
app.post('/teacher/:id/photo', upload.single('photo'), (req, res) => {
  const teacherId = req.params.id;
  const filePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  if (filePath) {
    dynamicUpdate('authority', { image: filePath }, 'id = ?', [teacherId], res);
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});

// API Endpoint to Fetch Concession Data
// Fetch Concession Data
app.get('/concession', (req, res) => {
  const query = 'SELECT id, content, photo FROM about_page WHERE id = 1';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching concession data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Concession data not found' });
    }
  });
});

// Update Concession Data
app.put('/concession', upload.single('photo'), (req, res) => {
  const { content } = req.body;
  let photoUrl = req.body.photo;

  if (req.file) {
    photoUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT photo FROM about_page WHERE id = 1', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old photo' });
    }
    const oldPhoto = (results && results.length > 0 ? results[0].photo : null);

    dynamicUpdate('about_page', { content, photo: photoUrl }, 'id = 1', [], res);
    if (req.file && oldPhoto && fs.existsSync(oldPhoto)) {
      fs.unlink(oldPhoto, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old photo:", unlinkErr);
      });
    }
  });
});

// Fetch Profile Data
app.get('/profile', (req, res) => {
  const query = 'SELECT id, content, photo FROM about_page WHERE id = 2';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching profile data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Profile data not found' });
    }
  });
});

// Update Profile Data
app.put('/profile', upload.single('photo'), (req, res) => {
  const { content } = req.body;
  let photoUrl = req.body.photo;

  if (req.file) {
    photoUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT photo FROM about_page WHERE id = 2', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old photo' });
    }
    const oldPhoto = (results && results.length > 0 ? results[0].photo : null);

    dynamicUpdate('about_page', { content, photo: photoUrl }, 'id = 2', [], res);
    if (req.file && oldPhoto && fs.existsSync(oldPhoto)) {
      fs.unlink(oldPhoto, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old photo:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Our Dream Data

// Fetch Our Dream Data
app.get('/our-dream', (req, res) => {
  const query = 'SELECT id, content, photo FROM about_page WHERE id = 3';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Our Dream data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Our Dream data not found' });
    }
  });
});

// Update Our Dream Data
app.put('/our-dream', upload.single('photo'), (req, res) => {
  const { content } = req.body;
  let photoUrl = req.body.photo;

  if (req.file) {
    photoUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT photo FROM about_page WHERE id = 3', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old photo' });
    }
    const oldPhoto = (results && results.length > 0 ? results[0].photo : null);

    dynamicUpdate('about_page', { content, photo: photoUrl }, 'id = 3', [], res);
    if (req.file && oldPhoto && fs.existsSync(oldPhoto)) {
      fs.unlink(oldPhoto, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old photo:", unlinkErr);
      });
    }
  });
});
// API Endpoint to Fetch Controlling Authority Data
// Fetch Controlling Authority Data
app.get('/controlling-authority', (req, res) => {
  const query = 'SELECT id, content, photo FROM about_page WHERE id = 4';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Controlling Authority data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Controlling Authority data not found' });
    }
  });
});

// Update Controlling Authority Data
app.put('/controlling-authority', upload.single('photo'), (req, res) => {
  const { content } = req.body;
  let photoUrl = req.body.photo;

  if (req.file) {
    photoUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT photo FROM about_page WHERE id = 4', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old photo' });
    }
    const oldPhoto = (results && results.length > 0 ? results[0].photo : null);

    dynamicUpdate('about_page', { content, photo: photoUrl }, 'id = 4', [], res);
    if (req.file && oldPhoto && fs.existsSync(oldPhoto)) {
      fs.unlink(oldPhoto, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old photo:", unlinkErr);
      });
    }
  });
});

// Fetch Short Brief Data
app.get('/short-brief', (req, res) => {
  const query = 'SELECT id, content, photo FROM about_page WHERE id = 5';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Short Brief data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Short Brief data not found' });
    }
  });
});

// Update Short Brief Data
app.put('/short-brief', upload.single('photo'), (req, res) => {
  const { content } = req.body;
  let photoUrl = req.body.photo;

  if (req.file) {
    photoUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT photo FROM about_page WHERE id = 5', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old photo' });
    }
    const oldPhoto = (results && results.length > 0 ? results[0].photo : null);

    dynamicUpdate('about_page', { content, photo: photoUrl }, 'id = 5', [], res);
    if (req.file && oldPhoto && fs.existsSync(oldPhoto)) {
      fs.unlink(oldPhoto, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old photo:", unlinkErr);
      });
    }
  });
});
// Fetch Dhaka Campus Data
app.get('/fetch', (req, res) => {
  const query = 'SELECT id, table_engineering, table_textile, heading_engineering, heading_textile, image FROM academic_data WHERE id = 1';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Dhaka Campus data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Dhaka Campus data not found' });
    }
  });
});

// Update Dhaka Campus Data
app.post('/save', upload.single('image'), (req, res) => {
  const { table_engineering, table_textile, heading_engineering, heading_textile, id } = req.body;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT image FROM academic_data WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].image : null);

    const updates = { table_engineering, table_textile, heading_engineering, heading_textile, image: imageUrl };
    dynamicUpdate('academic_data', updates, 'id = ?', [id], res);
    
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Faridpur Campus Data
// Fetch Faridpur Campus Data
app.get('/fetchFaridpur', (req, res) => {
  const query = 'SELECT id, table_engineering, table_textile, heading_engineering, heading_textile, image FROM academic_data WHERE id = 2';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Faridpur Campus data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Faridpur Campus data not found' });
    }
  });
});

// Save Faridpur Campus Data
app.post('/saveFaridpur', upload.single('image'), (req, res) => {
  const { table_engineering, table_textile, heading_engineering, heading_textile, id } = req.body;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT image FROM academic_data WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].image : null);

    const updates = { table_engineering, table_textile, heading_engineering, heading_textile, image: imageUrl };
    dynamicUpdate('academic_data', updates, 'id = ?', [id], res);

    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});


// Fetch Manikganj Campus Data
app.get('/fetchManikganj', (req, res) => {
  const query = 'SELECT id, table_engineering, table_textile, heading_engineering, heading_textile, image FROM academic_data WHERE id = 3';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Manikganj Campus data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Manikganj Campus data not found' });
    }
  });
});

// Save Manikganj Campus Data
app.post('/saveManikganj', upload.single('image'), (req, res) => {
  const { table_engineering, table_textile, heading_engineering, heading_textile, id } = req.body;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT image FROM academic_data WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].image : null);

    const updates = { table_engineering, table_textile, heading_engineering, heading_textile, image: imageUrl };
    dynamicUpdate('academic_data', updates, 'id = ?', [id], res);

    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch BNIST Sonargaon Campus Data
app.get('/fetchSonargaon', (req, res) => {
  const query = 'SELECT id, table_engineering, table_textile, heading_engineering, heading_textile, image FROM academic_data WHERE id = 4';
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      console.error('Error fetching Sonargaon Campus data:', err);
      return res.status(500).json({ message: 'Error fetching data' });
    }
    if (results && results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Sonargaon Campus data not found' });
    }
  });
});

// Save Sonargaon Campus Data
app.post('/saveSonargaon', upload.single('image'), (req, res) => {
  const { table_engineering, table_textile, heading_engineering, heading_textile, id } = req.body;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path.replace(/\\/g, '/');
  }

  executeQuery('SELECT image FROM academic_data WHERE id = ?', [id], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].image : null);

    const updates = { table_engineering, table_textile, heading_engineering, heading_textile, image: imageUrl };
    dynamicUpdate('academic_data', updates, 'id = ?', [id], res);

    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

//Feedback

// API Endpoint to Handle Feedback Form Submission
app.post('/feedback', upload.single('photo'), (req, res) => {
  const { name, message, type, department, semester } = req.body;
  const photoPath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  const query = 'INSERT INTO studentfeedback (name, message, photo_path, type, department, semester, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';
  const values = [name, message, photoPath, type, department, semester];

  executeQuery(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting feedback:', err);
      return res.status(500).json({ message: 'Error submitting feedback' });
    }
    res.status(200).json({ message: 'Feedback submitted successfully' });
  });
});

// API Endpoint to Fetch Feedbacks
app.get("/get-feedbacks", (req, res) => {
  const query = `
SELECT id, name, message, photo_path, type, department, semester, created_at, accepted
FROM studentfeedback
WHERE 1
ORDER BY created_at DESC;

  `;
  
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Error fetching feedbacks:", err);
      return res.status(500).json({ message: "Error fetching feedbacks" });
    }
    res.json(results || []);
  });
});

// API Endpoint to Delete Feedback
app.delete("/delete-sfeedback/:id", (req, res) => {
  const feedbackId = req.params.id;
  const query = `DELETE FROM studentfeedback WHERE id = ?`;

  executeQuery(query, [feedbackId], (err, result) => {
    if (err) {
      console.error("Error deleting feedback:", err);
      return res.status(500).json({ message: "Error deleting feedback" });
    }

    if (result && result.affectedRows === 0) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.json({ message: "Feedback deleted successfully" });
  });
});

// API Endpoint to Accept Feedback
app.put("/accept-feedback/:id", (req, res) => {
  const feedbackId = req.params.id;
  dynamicUpdate('studentfeedback', { accepted: true }, 'id = ?', [feedbackId], res);
});

// API Endpoint to Fetch Accepted Feedbacks
app.get('/get-feedback', (req, res) => {
  const query = `
      SELECT id, name, message, photo_path, type, department, semester, created_at, accepted
      FROM studentfeedback
      WHERE accepted = 1
  `;
  executeQuery(query, [], (err, results) => {
      if (err) {
          if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
          console.error("Error fetching feedbacks:", err);
          return res.status(500).json({ error: "Failed to fetch feedbacks" });
      }
      res.json(results || []);
  });
});

// API Endpoint to Get Unread Feedbacks Count
app.get('/unread-feedbacks', (req, res) => {
  const sql = 'SELECT COUNT(*) AS unreadCount FROM studentfeedback WHERE accepted = 0';
  executeQuery(sql, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ unreadCount: 0 });
      console.error('Error fetching unread feedbacks count:', err);
      return res.status(500).json({ error: 'Failed to fetch unread feedbacks count' });
    }
    res.json({ unreadCount: (result && result[0] ? result[0].unreadCount : 0) });
  });
});

// API Endpoint to Get Unread Parent Feedbacks Count
app.get('/unread-parent-feedbacks', (req, res) => {
  const sql = 'SELECT COUNT(*) AS unreadCount FROM parents_feedback WHERE approved = 0';
  executeQuery(sql, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ unreadCount: 0 });
      console.error('Error fetching unread parent feedbacks count:', err);
      return res.status(500).json({ error: 'Failed to fetch unread parent feedbacks count' });
    }
    res.json({ unreadCount: (result && result[0] ? result[0].unreadCount : 0) });
  });
});

// API Endpoint to Add Parent Feedback
app.post("/add-parents-feedback", (req, res) => {
  const { name, occupation, message } = req.body;
  const query = "INSERT INTO parents_feedback (name, occupation, message) VALUES (?, ?, ?)";
  executeQuery(query, [name, occupation, message], (err, result) => {
    if (err) return res.status(500).json({ message: "Error adding feedback." });
    res.status(201).json({ message: "Feedback added successfully." });
  });
});

// API Endpoint to Fetch Approved Parent Feedbacks
app.get("/approved-parents-feedbacks", (req, res) => {
  const query = "SELECT * FROM parents_feedback WHERE approved = 1";
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      return res.status(500).json({ message: "Error fetching feedbacks." });
    }
    res.status(200).json(results || []);
  });
});

// API Endpoint to Approve Parent Feedback
app.put("/approve-feedback/:id", (req, res) => {
  const { id } = req.params;
  dynamicUpdate('parents_feedback', { approved: 1 }, 'id = ?', [id], res);
});

// API Endpoint to Delete Parent Feedback
app.delete("/delete-feedback/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM parents_feedback WHERE id = ?";
  executeQuery(query, [id], (err, result) => {
    if (err) return res.status(500).json({ message: "Error deleting feedback." });
    res.status(200).json({ message: "Feedback deleted successfully." });
  });
});

// API Endpoint to Fetch All Parent Feedbacks
app.get("/all-parents-feedbacks", (req, res) => {
  const query = "SELECT * FROM parents_feedback ORDER BY created_at DESC";
  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      return res.status(500).json({ message: "Error fetching feedbacks." });
    }
    res.status(200).json(results || []);
  });
});

// API Endpoint to Get New Online Admissions Count
app.get('/new-online-admissions', (req, res) => {
  const sql = 'SELECT COUNT(*) as count FROM online_admissions WHERE created_at > NOW() - INTERVAL 1 DAY';
  executeQuery(sql, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ count: 0 });
      console.error('Error fetching new online admissions count:', err);
      return res.status(500).json({ error: 'Failed to fetch count' });
    }
    res.json(result && result[0] ? result[0] : { count: 0 });
  });
});

// API Endpoint to Get New Contacts Count
app.get('/new-contacts', (req, res) => {
  const sql = 'SELECT COUNT(*) as count FROM contacts WHERE created_at > NOW() - INTERVAL 1 DAY';
  executeQuery(sql, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ count: 0 });
      console.error('Error fetching new contacts count:', err);
      return res.status(500).json({ error: 'Failed to fetch count' });
    }
    res.json(result && result[0] ? result[0] : { count: 0 });
  });
});

// API Endpoint to Get New Parent Feedbacks Count
app.get('/new-parents-feedback', (req, res) => {
  const sql = 'SELECT COUNT(*) as count FROM parents_feedback WHERE created_at > NOW() - INTERVAL 1 DAY';
  executeQuery(sql, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ count: 0 });
      console.error('Error fetching new parent feedbacks count:', err);
      return res.status(500).json({ error: 'Failed to fetch count' });
    }
    res.json(result && result[0] ? result[0] : { count: 0 });
  });
});

// API Endpoint to Get New Student Feedbacks Count
app.get('/new-studentfeedback', (req, res) => {
  const sql = 'SELECT COUNT(*) as count FROM studentfeedback WHERE created_at > NOW() - INTERVAL 1 DAY';
  executeQuery(sql, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ count: 0 });
      console.error('Error fetching new student feedbacks count:', err);
      return res.status(500).json({ error: 'Failed to fetch count' });
    }
    res.json(result && result[0] ? result[0] : { count: 0 });
  });
});

//Admission

// API Endpoint to Handle Online Admission Form Submission
app.post("/submit-admission", upload.single("image"), async (req, res) => {
  const {
    full_name,
    date_of_birth,
    father_name,
    mother_name,
    email,
    phone,
    guardian_phone,
    address,
    gender,
    nationality,
    upojati,
    freefighter,
    course_id,
    exam_id,
    pass_year,
    devition,
    board,
    b_roll,
    r_number,
    gpa,
    transaction_amount,  // Ensure this matches the frontend
    btransaction_id,
    transaction_reference,  // Ensure this matches the frontend
  } = req.body;

  try {
    const imageUrl = req.file ? req.file.path.replace(/\\/g, '/') : null;

    // Insert admission data into the database
    const query = `
      INSERT INTO online_admissions (
        full_name, date_of_birth, father_name, mother_name, email, phone, guardian_phone,
        address, gender, nationality, upojati, freefighter, course_id, image, exam_id, 
        pass_year, devition, board, b_roll, r_number, gpa, transaction_amount, 
        btransaction_id, transaction_reference, is_Clicked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      full_name,
      date_of_birth,
      father_name,
      mother_name,
      email,
      phone,
      guardian_phone,
      address,
      gender,
      nationality,
      upojati,
      freefighter,
      course_id,
      imageUrl, // Use the local file path
      exam_id,
      pass_year,
      devition,
      board,
      b_roll,
      r_number,
      gpa,
      transaction_amount,
      btransaction_id,
      transaction_reference,
      0, // Default is_Clicked to 0
    ];

    executeQuery(query, values, async (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: "Failed to submit admission", error: err.message });
      }

      // Send Emails
      try {
        console.log("Starting email process for:", email);
        // 1. Send "Thank You" email to student
        if (email) {
          const studentHtml = getStudentEmailTemplate(full_name);
          const studentEmailRes = await sendEmail(email, "Admission Application Received - NPI", studentHtml);
          console.log("Student email sent status:", studentEmailRes);
        }

        // 2. Send notification email to admin
        const adminEmail = process.env.ADMIN_EMAIL;
        const backupEmail = "portfolio.shuvorozario@gmail.com";
        const adminHtml = getAdminEmailTemplate({
          full_name,
          course_id,
          pass_year,
          phone,
          transaction_amount,
          btransaction_id,
          transaction_reference,
        });

        if (adminEmail) {
          const adminEmailRes = await sendEmail(adminEmail, "New Online Admission Received!", adminHtml);
          console.log("Admin email sent status:", adminEmailRes);
        }

        // Send to backup email as requested
        const backupEmailRes = await sendEmail(backupEmail, "New Online Admission Received!", adminHtml);
        console.log("Backup admin email sent status:", backupEmailRes);
      } catch (emailErr) {
        console.error("Email Sending Error Log:", emailErr);
      }

      res.status(200).json({ message: "Admission submitted successfully" });
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Failed to upload image" });
  }
});

// API Endpoint to Fetch All Online Admissions
app.get("/online-admissions", (req, res) => {
  const query = `
    SELECT 
      id, full_name, date_of_birth, father_name, mother_name, email, phone, 
      guardian_phone, address, gender, nationality, upojati, freefighter, 
      course_id, image, exam_id, pass_year, devition, board, b_roll, r_number, 
      gpa, transaction_amount, btransaction_id, transaction_reference, is_Clicked, created_at 
    FROM online_admissions WHERE 1
  `;

  executeQuery(query, [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      console.error("Error fetching admissions:", err);
      return res.status(500).json({ message: "Failed to fetch admissions" });
    }
    res.json(results || []);
  });
});

// API Endpoint to Upload Admission Image

// API Endpoint to Upload Image to Cloudinary
// Endpoint for handling file upload and saving image path to the database
app.post('/upload-image', upload.single('image'), (req, res) => {
  const imagePath = req.file ? `uploads/${req.file.filename}` : null;
  if (imagePath) {
    // Insert the image path into the database
    executeQuery('INSERT INTO online_admissions (image) VALUES (?)', [imagePath], (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error saving image path');
      }
      res.status(200).send({ imagePath });
    });
  } else {
    res.status(400).send('No file uploaded');
  }
});

// Endpoint to fetch the latest image path from the database
app.get('/get-latest-image', (req, res) => {
  executeQuery('SELECT image FROM online_admissions ORDER BY created_at DESC LIMIT 1', [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).send(null);
      console.error('Database error:', err);
      return res.status(500).send('Error fetching image');
    }
    res.status(200).send(result && result[0] ? result[0] : null);
  });
});


// Serve static files (if needed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// API Endpoint to Update Admission Instruction
app.post('/update-instruction/:id', async (req, res) => {
  const { id } = req.params;
  const { content, phone } = req.body;
  dynamicUpdate('admission_instraction', { content, phone }, 'id = ?', [id], res);
});

// API Endpoint to Add Admission Instruction
app.post('/add-instruction', async (req, res) => {
  const { content, phone } = req.body;
  const contentLen = (content ? content.length : 0);
  console.log("Adding new instruction. Content length:", contentLen, "Phone:", phone);
  
  const query = 'INSERT INTO admission_instraction (content, phone) VALUES (?, ?)';
  executeQuery(query, [content, phone], (err, result) => {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).json({ message: 'Error adding data', error: err.message });
    }
    console.log("Insert result. New ID:", result.insertId);
    res.status(200).json({ message: 'Instruction and Phone added successfully', id: result.insertId });
  });
});

// API Endpoint to Fetch Admission Instruction
app.get('/get-instruction', async (req, res) => {
  const query = 'SELECT id, content, phone FROM admission_instraction LIMIT 1';
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(404).json({ message: 'Table not found' });
      console.error('Fetch error:', err);
      return res.status(500).json({ message: 'Error fetching data', error: err.message });
    }
    if (result && result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res.status(404).json({ message: 'No instruction found' });
    }
  });
});


//Departments

// API Endpoint to Fetch Department Data
app.get("/department", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE 1`;

  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      res.status(500).json({ error: err.message });
    } else {
      res.status(200).json(result);
    }
  });
});

// API Endpoint to Fetch CMT Department Data
app.get("/cmtdepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 1`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); // Send first record
  });
});

// API Endpoint to Update CMT Overview & Curriculum
app.put("/cmtupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 1', [], res);
});

// API Endpoint to Update CMT Course Overview Details
app.put("/cmtupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 1', [], res);
});

// API Endpoint to Upload CMT Hero Image
app.post("/cmtupload-hero-image", upload.single("heroImage"), (req, res) => {
  const cmtheroImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 1', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: cmtheroImagePath }, 'id = 1', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Architecture Department Data
app.get("/arcdepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 2`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Architecture Overview & Curriculum
app.put("/arcupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 2', [], res);
});

// API Endpoint to Update Architecture Course Overview Details
app.put("/arcupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 2', [], res);
});

// API Endpoint to Upload Architecture Hero Image
app.post("/arcupload-hero-image", upload.single("heroImage"), (req, res) => {
  const archeroImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 2', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: archeroImagePath }, 'id = 2', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Automobile Department Data
app.get("/autodepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 3`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Automobile Overview & Curriculum
app.put("/autoupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 3', [], res);
});

// API Endpoint to Update Automobile Course Overview Details
app.put("/autoupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 3', [], res);
});

// API Endpoint to Upload Automobile Hero Image
app.post("/autoupload-hero-image", upload.single("heroImage"), (req, res) => {
  const autoheroImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 3', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: autoheroImagePath }, 'id = 3', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Civil Department Data
app.get("/civdepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 4`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Civil Overview & Curriculum
app.put("/civupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 4', [], res);
});

// API Endpoint to Update Civil Course Overview Details
app.put("/civupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 4', [], res);
});

// API Endpoint to Upload Civil Hero Image
app.post("/civupload-hero-image", upload.single("heroImage"), (req, res) => {
  const civheroImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 4', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: civheroImagePath }, 'id = 4', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Electrical Department Data
app.get("/elecdepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 5`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Electrical Overview & Curriculum
app.put("/elecupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 5', [], res);
});

// API Endpoint to Update Electrical Course Overview Details
app.put("/elecupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 5', [], res);
});

// API Endpoint to Upload Electrical Hero Image
app.post("/elecupload-hero-image", upload.single("heroImage"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const imageUrl = req.file.path.replace(/\\/g, '/');

  executeQuery('SELECT hero_image FROM department WHERE id = 5', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: imageUrl }, 'id = 5', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Electronics Department Data
app.get("/electrodepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 6`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Electronics Overview & Curriculum
app.put("/electroupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 6', [], res);
});

// API Endpoint to Update Electronics Course Overview Details
app.put("/electroupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 6', [], res);
});

// API Endpoint to Upload Electronics Hero Image
app.post("/electroupload-hero-image", upload.single("heroImage"), (req, res) => {
  const electroheroImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 6', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: electroheroImagePath }, 'id = 6', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Mechanical Department Data
app.get("/mecdepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 7`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Mechanical Overview & Curriculum
app.put("/mecupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 7', [], res);
});

// API Endpoint to Update Mechanical Course Overview Details
app.put("/mecupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 7', [], res);
});

// API Endpoint to Upload Mechanical Hero Image
app.post("/mecupload-hero-image", upload.single("heroImage"), (req, res) => {
  const mecImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 7', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: mecImagePath }, 'id = 7', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Food Department Data
app.get("/fooddepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 8`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Food Overview & Curriculum
app.put("/foodupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 8', [], res);
});

// API Endpoint to Update Food Course Overview Details
app.put("/foodupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 8', [], res);
});

// API Endpoint to Upload Food Hero Image
app.post("/foodupload-hero-image", upload.single("heroImage"), (req, res) => {
  const foodImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 8', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: foodImagePath }, 'id = 8', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// API Endpoint to Fetch Textile Department Data
app.get("/textiledepartment", (req, res) => {
  const query = `SELECT id, name, overview, curriculum, chief_instructor, total_students, duration, qualification, fees, hero_image FROM department WHERE id = 9`;
  executeQuery(query, [], (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({});
      return res.status(500).json(err);
    }
    res.json(result && result[0] ? result[0] : {}); 
  });
});

// API Endpoint to Update Textile Overview & Curriculum
app.put("/textileupdate-content", (req, res) => {
  const { overview, curriculum } = req.body;
  dynamicUpdate('department', { overview, curriculum }, 'id = 9', [], res);
});

// API Endpoint to Update Textile Course Overview Details
app.put("/textileupdate-course-overview", (req, res) => {
  const { chiefInstructor, totalStudents, duration, qualification, fees } = req.body;
  const updates = {
    chief_instructor: chiefInstructor,
    total_students: totalStudents,
    duration,
    qualification,
    fees
  };
  dynamicUpdate('department', updates, 'id = 9', [], res);
});

// API Endpoint to Upload Textile Hero Image
app.post("/textileupload-hero-image", upload.single("heroImage"), (req, res) => {
  const textileImagePath = req.file ? req.file.path.replace(/\\/g, '/') : null;

  executeQuery('SELECT hero_image FROM department WHERE id = 9', [], (err, results) => {
    if (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ message: "Table missing." });
      return res.status(500).json({ message: 'Error fetching old image' });
    }
    const oldImage = (results && results.length > 0 ? results[0].hero_image : null);

    dynamicUpdate('department', { hero_image: textileImagePath }, 'id = 9', [], res);
    if (req.file && oldImage && fs.existsSync(oldImage)) {
      fs.unlink(oldImage, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting old image:", unlinkErr);
      });
    }
  });
});

// Catch-all 404 handler to return JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 66 * 1000;
