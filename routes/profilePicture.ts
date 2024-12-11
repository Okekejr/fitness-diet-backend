import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { query } from "../database";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.S3_REGION!,
});

router.post(
  "/upload-profile-picture/:userId",
  upload.single("profilePicture"),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const bucketName = process.env.S3_BUCKET_NAME!;
    const key = `profile-pictures/${userId}-${Date.now()}.jpg`;

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "max-age=31536000", // Cache for one year
    };

    try {
      // Upload the file to S3

      const command = new PutObjectCommand(uploadParams);
      await s3.send(command);

      // Generate CloudFront URL
      const cloudFrontUrl = `https://${process.env.CLOUDFRONT_URL}/${key}`;

      // Save the image URL in the database
      await query(
        "UPDATE user_data SET profile_picture = $1 WHERE user_id = $2",
        [cloudFrontUrl, userId]
      );

      res
        .status(200)
        .json({ message: "Profile picture uploaded", imageUrl: cloudFrontUrl });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Error uploading profile picture" });
    }
  }
);

export default router;
