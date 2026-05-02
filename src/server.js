const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { randomUUID: uuidv4 } = require("crypto");
const sharp = require("sharp");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const INSTANCE_ID = process.env.INSTANCE_ID || `instance-${PORT}`;

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG images are allowed"), false);
    }
  },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", instance: INSTANCE_ID, port: PORT });
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    if (!BUCKET_NAME) {
      return res.status(500).json({ error: "S3 bucket not configured" });
    }

    console.log(`[${INSTANCE_ID}] Received upload: ${req.file.originalname} (${req.file.size} bytes)`);

    let fileBuffer = req.file.buffer;
    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";

    fileBuffer = await sharp(fileBuffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .toBuffer();

    const uniqueKey = `uploads/${Date.now()}-${uuidv4()}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    }));

    const imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${uniqueKey}`;

const signedUrl = await getSignedUrl(
  s3,
  new GetObjectCommand({ Bucket: BUCKET_NAME, Key: uniqueKey }),
  { expiresIn: 3600 }
);

console.log(`[${INSTANCE_ID}] Uploaded to S3: ${imageUrl}`);
return res.status(200).json({ 
  url: imageUrl,
  signedUrl: signedUrl,
  expiresIn: "1 hour"
});

  } catch (err) {
    console.error(`[${INSTANCE_ID}] Upload error:`, err.message);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File size exceeds 2MB limit" });
    }
    if (err.message.includes("Only JPG")) {
      return res.status(415).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File size exceeds 2MB limit" });
  }
  if (err) return res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[${INSTANCE_ID}] Server running on port ${PORT}`);
});

module.exports = app;
