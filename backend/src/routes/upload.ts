import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authorize } from "../middleware/rbac.js";
import { sendError } from "../utils/errors.js";

const router = Router();

// Configure cloudinary with env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post(
  "/",
  authorize("ADMIN", "FLEET_MANAGER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return sendError(res, 400, "No file uploaded");
      }

      // Upload to cloudinary via stream
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "transitops",
        resource_type: "auto",
      });

      res.status(200).json({
        message: "File uploaded successfully",
        url: result.secure_url,
      });
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      next(error);
    }
  }
);

export default router;
