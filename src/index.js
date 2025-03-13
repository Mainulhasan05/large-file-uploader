// server.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 3000;

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Use original filename with timestamp to avoid conflicts
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  },
});

// Configure multer with file size limits and storage
const upload = multer({
  storage: storage,
  limits: {
    // Remove file size limit to allow any size
    fileSize: Infinity,
  },
});

// Track upload progress for each file
const uploadProgress = {};

// Serve static files
app.use(express.static("public"));

// JSON middleware
app.use(express.json());

// Route to handle file uploads
app.post("/upload", (req, res) => {
  // Create unique ID for this upload
  const uploadId = Date.now().toString();
  uploadProgress[uploadId] = { progress: 0, filename: null };

  // Set up multer middleware for this specific request
  const uploadHandler = upload.single("file");

  // Track upload progress
  req.on("data", (chunk) => {
    // Update progress if we know the content length
    if (req.headers["content-length"]) {
      const totalSize = parseInt(req.headers["content-length"]);
      uploadProgress[uploadId].bytesReceived =
        (uploadProgress[uploadId].bytesReceived || 0) + chunk.length;
      uploadProgress[uploadId].progress = Math.floor(
        (uploadProgress[uploadId].bytesReceived / totalSize) * 100
      );
    }
  });

  uploadHandler(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Update progress to 100% when complete
    uploadProgress[uploadId].progress = 100;
    uploadProgress[uploadId].filename = req.file.filename;

    // Return upload ID to client so they can check progress
    res.json({
      success: true,
      message: "File uploaded successfully",
      filename: req.file.filename,
      size: req.file.size,
      uploadId: uploadId,
    });

    // Clean up progress tracking after 5 minutes
    setTimeout(() => {
      delete uploadProgress[uploadId];
    }, 5 * 60 * 1000);
  });
});

// Route to check upload progress
app.get("/progress/:uploadId", (req, res) => {
  const { uploadId } = req.params;
  if (!uploadProgress[uploadId]) {
    return res.status(404).json({ error: "Upload not found" });
  }

  res.json(uploadProgress[uploadId]);
});

// Get list of uploaded files
app.get("/files", (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to list files" });
    }

    // Get file details
    const fileDetails = files.map((file) => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return {
        name: file,
        size: stats.size,
        created: stats.birthtime,
      };
    });

    res.json(fileDetails);
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
