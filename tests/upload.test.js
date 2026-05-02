jest.mock("@aws-sdk/client-s3", () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn(),
  };
});

jest.mock("sharp", () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-image")),
  }));
});

process.env.S3_BUCKET_NAME = "test-bucket";
process.env.AWS_ACCESS_KEY_ID = "fake-key";
process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
process.env.AWS_REGION = "us-east-1";
process.env.PORT = "3001";

const request = require("supertest");
const app = require("../src/server");

function fakePng() {
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478016360000000020001e221bc330000000049454e44ae426082",
    "hex"
  );
}

describe("GET /health", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /upload", () => {
  it("400 when no file", async () => {
    const res = await request(app).post("/upload");
    expect(res.status).toBe(400);
  });

  it("415 for wrong file type", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.from("not image"), { filename: "file.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("413 for file over 2MB", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", Buffer.alloc(2.5 * 1024 * 1024), { filename: "big.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(413);
  });

  it("200 and url for valid PNG", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("image", fakePng(), { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/test-bucket\.s3\.amazonaws\.com\/uploads\/.+\.png$/);
  });

  it("two uploads produce unique URLs", async () => {
    const r1 = await request(app).post("/upload").attach("image", fakePng(), { filename: "a.png", contentType: "image/png" });
    const r2 = await request(app).post("/upload").attach("image", fakePng(), { filename: "b.png", contentType: "image/png" });
    expect(r1.body.url).not.toBe(r2.body.url);
  });
});