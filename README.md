# 📦 Image Upload Server

A scalable image upload backend using Node.js, NGINX load balancer, and AWS S3 storage. No database required.

---

## 🏗 Architecture
Client (curl / Postman)
│
▼
┌───────────┐
│ NGINX :80 │  ← round-robin load balancer
└─────┬─────┘
│
┌────┴─────┐
│          │
▼          ▼
:3001       :3002    ← Node.js instances
│          │
└────┬─────┘
│
▼
AWS S3 Bucket

---

## ⚙️ Setup Steps

### 1. Clone the repository
git clone https://github.com/param20h/-Image-Upload-.git
cd Image-Upload-

### 2. Install dependencies
npm install

### 3. Create `.env` file
AWS_ACCESS_KEY_ID=your-key-here
AWS_SECRET_ACCESS_KEY=your-secret-here
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your-bucket-name

### 4. Install NGINX (Mac)
brew install nginx

---

## 🚀 How to Run Multiple Instances

Open **two terminal windows** and run one command in each:

**Terminal 1:**
npm run start:3001

**Terminal 2:**
npm run start:3002

You will see:
[instance-1] Server running on port 3001
[instance-2] Server running on port 3002

---

## 🔁 NGINX Configuration

Config file is at `nginx/nginx.conf`.

Apply it:
sudo cp nginx/nginx.conf /opt/homebrew/etc/nginx/nginx.conf
sudo mkdir -p /var/log/nginx
sudo nginx -t
sudo nginx

How it works:
- NGINX listens on **port 80**
- All requests are forwarded to either **:3001** or **:3002**
- Uses **round-robin** by default — each request alternates between instances
- Upload size limit set to **3MB** (above the 2MB app limit)

---

## ⚡ API Reference

### GET /health
Check if server is running.

**Response:**
```json
{
  "status": "ok",
  "instance": "instance-1",
  "port": 3001
}
```

### POST /upload
Upload an image to S3.

| Field | Type | Rules |
|-------|------|-------|
| image | file | JPG or PNG only, max 2MB |

**Success Response:**
```json
{
  "url": "https://my-bucket.s3.amazonaws.com/uploads/1720000000-abc123.jpg"
}
```

**Error Responses:**

| Status | Reason |
|--------|--------|
| 400 | No file attached |
| 400 | Wrong file type |
| 413 | File over 2MB |
| 500 | Server or S3 error |

---

## 🧪 Sample Request & Response

### Upload an image
curl -X POST http://localhost/upload 
-F "image=@/path/to/photo.jpg"

### Response
```json
{
  "url": "https://my-image-upload.s3.amazonaws.com/uploads/1720000123456-550e8400-e29b-41d4-a716-446655440000.jpg"
}
```

### Verify load balancing
Run 4 uploads and watch terminals alternate:
[instance-1] Received upload: photo.jpg
[instance-2] Received upload: photo.jpg
[instance-1] Received upload: photo.jpg
[instance-2] Received upload: photo.jpg

---

## 🔬 GitHub Actions CI Pipeline

File: `.github/workflows/ci.yml`

Runs automatically on every **push** and **pull request**.

### Jobs:

**1. Test**
- Installs dependencies
- Runs all 6 Jest tests
- S3 is mocked — no real AWS needed
- Fails pipeline if any test fails

**2. Startup Check**
- Starts instance on port 3001 → hits `/health`
- Starts instance on port 3002 → hits `/health`
- Fails pipeline if either instance does not start

### Pipeline result:
✅ Test    — 6/6 tests passed
✅ Build   — both instances started successfully

---

## 🧪 Running Tests Locally
npm test

Expected output:
PASS tests/upload.test.js
✓ returns 200
✓ 400 when no file
✓ 400 for wrong file type
✓ 413 for file over 2MB
✓ 200 and url for valid PNG
✓ two uploads produce unique URLs
Tests: 6 passed

---

## ⭐ Bonus Features

| Feature | Details |
|---------|---------|
| Image resizing | Images resized to max 1920px before upload using sharp |
| Unique filenames | timestamp + UUID ensures no collisions |

---

## 🛠 Tech Stack

| Tool | Purpose |
|------|---------|
| Node.js + Express | Backend server |
| Multer | File upload handling |
| AWS S3 | Image storage |
| Sharp | Image resizing |
| NGINX | Load balancer |
| Jest + Supertest | Testing |
| GitHub Actions | CI pipeline |