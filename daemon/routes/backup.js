import { Router } from "express";
import { log } from "../shared.js";
import { asyncHandler } from "../utils.js";
import { getS3Config, saveS3Config } from "../backup.js";

const router = Router();

// GET /api/backup/config
router.get("/api/backup/config", asyncHandler(async (req, res) => {
  const config = await getS3Config();
  if (!config) return res.json({ success: true, configured: false, config: null });

  const safeConfig = { ...config };
  if (safeConfig.secretKey) safeConfig.secretKey = "***";
  res.json({ success: true, configured: true, config: safeConfig });
}));

// POST /api/backup/config
router.post("/api/backup/config", asyncHandler(async (req, res) => {
  const { endpoint, accessKey, secretKey, bucket, region } = req.body;
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return res.status(400).json({ success: false, error: "endpoint, accessKey, secretKey, and bucket are required" });
  }

  const config = { endpoint, accessKey, secretKey, bucket, region: region || "us-east-1" };
  await saveS3Config(config);
  log("info", "✅ [POST /api/backup/config] S3 backup configuration saved");
  res.json({ success: true, message: "Backup configuration saved successfully" });
}));

export default router;
