import express, { Request, Response } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import { query } from "../database";
import { format } from "date-fns";

const router = express.Router();

// Configure Multer for in-memory storage and file size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Invalid file type. Only JPEG or PNG allowed."));
    }
    cb(null, true);
  },
});

// AWS S3 Client configuration
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.S3_REGION!,
});

// Create a club with logo upload
router.post(
  "/create",
  upload.single("clubLogo"),
  async (req: Request, res: Response) => {
    const { userId, name, description, location, maxMembers } = req.body;
    const file = req.file;

    if (!userId || !name || !location) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    try {
      // Generate a unique invite code
      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      // Generate QR code as a base64 string
      const qrCode = await QRCode.toDataURL(inviteCode);

      let logoUrl: string | null = null;

      // Upload the club logo to S3 (if provided)
      if (file) {
        const logoKey = `club-logos/${name}-${Date.now()}.jpg`;

        const uploadParams = {
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: logoKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: "max-age=31536000",
        };

        try {
          const command = new PutObjectCommand(uploadParams);
          await s3.send(command);
          console.log("Logo uploaded successfully!");

          // Generate CloudFront URL (or use S3 URL if needed)
          logoUrl = `https://${process.env.CLOUDFRONT_URL}/${logoKey}`;
        } catch (uploadError) {
          console.error("Error uploading logo:", uploadError);
          res.status(500).json({ error: "Failed to upload club logo." });
          return;
        }
      }

      // Insert club data into the database with logo URL and QR code
      const result = await query(
        `
          INSERT INTO run_clubs (name, description, created_by, invite_code, qr_code, location, max_members, logo)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
        [
          name,
          description,
          userId,
          inviteCode,
          qrCode,
          location,
          maxMembers,
          logoUrl,
        ]
      );

      console.log("Club created successfully:", result[0]);

      res.status(201).json(result[0]);
      return;
    } catch (error) {
      console.error("Error creating club:", error);
      res.status(500).json({ error: "Failed to create club." });
      return;
    }
  }
);

// Route to update the club logo
router.post(
  "/updateLogo/:clubId",
  (req, res, next) => {
    upload.single("clubLogo")(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ error: "File too large. Please select a file under 5 MB." });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const { clubId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No logo file provided" });
      return;
    }

    try {
      const logoKey = `club-logos/${clubId}-${Date.now()}.jpg`;

      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: logoKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "max-age=31536000",
      };

      const command = new PutObjectCommand(uploadParams);
      await s3.send(command);

      const logoUrl = `https://${process.env.CLOUDFRONT_URL}/${logoKey}`;

      // Update the logo URL in the database
      await query(`UPDATE run_clubs SET logo = $1 WHERE id = $2`, [
        logoUrl,
        clubId,
      ]);

      res
        .status(200)
        .json({ message: "Club logo updated successfully", logoUrl });
    } catch (error) {
      console.error("Error updating logo:", error);
      res.status(500).json({ error: "Failed to update club logo" });
    }
  }
);

// Check if a club exists by ID or invite code
router.get("/exists/:inviteCode", async (req, res) => {
  const { inviteCode } = req.params;

  try {
    const result = await query(
      `
      SELECT 
        c.*, 
        COUNT(cm.id) AS members_count 
      FROM run_clubs c
      LEFT JOIN club_members cm ON c.id = cm.club_id
      WHERE c.invite_code = $1
      GROUP BY c.id
      LIMIT 1
      `,
      [inviteCode]
    );

    if (result.length === 0) {
      res.status(404).json({ error: "Club not found." });
      return;
    }

    const club = result[0];
    club.members_count = parseInt(club.members_count, 10);

    res.status(200).json(club);
  } catch (error) {
    console.error("Error checking club:", error);
    res.status(500).json({ error: "Failed to check if club exists." });
  }
});

router.get("/userClub/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await query(
      `
        SELECT c.*
        FROM club_members cm
        JOIN run_clubs c ON cm.club_id = c.id
        WHERE cm.user_id = $1
        LIMIT 1
        `,
      [userId]
    );

    if (result.length === 0) {
      res.status(404).json({ error: "User is not part of any club." });
      return;
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error fetching user club:", error);
    res.status(500).json({ error: "Failed to fetch user club." });
  }
});

router.post("/addMember", async (req, res) => {
  const { userId, clubId, isLeader } = req.body;

  try {
    await query(
      `INSERT INTO club_members (user_id, club_id, is_leader, joined_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [userId, clubId, isLeader]
    );

    res.status(201).json({ message: "Member added successfully." });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({ error: "Failed to add member." });
  }
});

router.get("/:clubId", async (req, res) => {
  const { clubId } = req.params;

  try {
    const clubData = await query(
      `
        SELECT c.*, COUNT(cm.id) AS members_count
        FROM run_clubs c
        LEFT JOIN club_members cm ON c.id = cm.club_id
        WHERE c.id = $1
        GROUP BY c.id
        `,
      [clubId]
    );

    if (clubData.length === 0) {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    res.status(200).json(clubData[0]);
  } catch (error) {
    console.error("Error fetching club data:", error);
    res.status(500).json({ error: "Failed to fetch club data" });
  }
});

router.post("/saveRoute", async (req: Request, res: Response) => {
  const { clubId, pointA, pointB, distance, estimatedTime, runDate, runTime } =
    req.body;

  // Validate required fields
  if (
    !clubId ||
    !pointA ||
    !pointB ||
    !distance ||
    !estimatedTime ||
    !runDate ||
    !runTime
  ) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  try {
    // Insert route data into the club_routes table
    const result = await query(
      `
      INSERT INTO club_routes (club_id, point_a, point_b, distance, estimated_time, run_date, run_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `,
      [clubId, pointA, pointB, distance, estimatedTime, runDate, runTime]
    );

    res
      .status(201)
      .json({ message: "Route saved successfully", route: result[0] });
  } catch (error) {
    console.error("Error saving route:", error);
    res.status(500).json({ error: "Failed to save route." });
  }
});

router.get("/getRoutes/:clubId", async (req: Request, res: Response) => {
  const { clubId } = req.params;

  // Validate clubId
  if (!clubId) {
    res.status(400).json({ error: "Missing clubId." });
    return;
  }

  try {
    const result = await query(
      `
      SELECT 
        point_a AS "startPoint", 
        point_b AS "endPoint", 
        estimated_time AS "estimatedTime", 
        distance AS "estimatedDistance", 
        created_at AS "dateCreated",
        run_date,
        run_time
      FROM club_routes
      WHERE club_id = $1
      ORDER BY created_at DESC;
    `,
      [clubId]
    );

    // Format the date and time for each route
    const formattedRoutes = result.map((route) => {
      const runDate = new Date(route.run_date);
      const runTime = new Date(route.run_time);
      const dateCreated = new Date(route.dateCreated);

      const formattedRunDate = format(runDate, "do MMMM, yyyy"); // Format like 23rd November, 2024
      const formattedRunTime = format(runTime, "h:mm a"); // Format like 3:00 PM
      const formattedDateTime = `${formattedRunDate} at ${formattedRunTime}`; // Combine date and time

      return {
        startPoint: route.startPoint,
        endPoint: route.endPoint,
        estimatedTime: route.estimatedTime,
        estimatedDistance: route.estimatedDistance,
        formattedRunDate,
        formattedRunTime,
        formattedDateTime,
        dateCreated,
      };
    });

    res.status(200).json({ routes: formattedRoutes });
  } catch (error) {
    console.error("Error fetching routes:", error);
    res.status(500).json({ error: "Failed to fetch routes." });
  }
});

// Check if a user is a leader in a specific club
router.get("/isLeader/:clubId/:userId", async (req: Request, res: Response) => {
  const { clubId, userId } = req.params;

  try {
    const result = await query(
      `
        SELECT is_leader 
        FROM club_members 
        WHERE club_id = $1 AND user_id = $2
        LIMIT 1;
      `,
      [clubId, userId]
    );

    if (result.length === 0) {
      res.status(404).json({ message: "User is not part of this club." });
      return;
    }

    const isLeader = result[0].is_leader;

    res.status(200).json({ isLeader });
  } catch (error) {
    console.error("Error checking leadership status:", error);
    res.status(500).json({ error: "Failed to check leadership status." });
  }
});

// API Route to list users in a run club
router.get("/:clubId/users", async (req: Request, res: Response) => {
  const { clubId } = req.params;

  try {
    // Query to get user data for the club members
    const result = await query(
      `SELECT 
        cm.id AS club_member_id,
        cm.user_id,
        cm.is_leader,
        ud.name,
        ud.profile_picture, -- Include profile picture
        cm.joined_at
      FROM club_members cm
      INNER JOIN user_data ud ON cm.user_id = ud.user_id
      WHERE cm.club_id = $1
      ORDER BY cm.is_leader DESC, ud.name ASC`,
      [clubId]
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching club users:", error);
    res.status(500).json({ error: "Failed to fetch users for the club" });
  }
});

// API Route to remove a user from a run club
router.delete("/:clubId/users/:userId", async (req: Request, res: Response) => {
  const { clubId, userId } = req.params;

  try {
    // Delete the user from club_members
    await query(
      `DELETE FROM club_members
       WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId]
    );

    res.status(200).json({ message: "User removed successfully" });
  } catch (error) {
    console.error("Error removing user from club:", error);
    res.status(500).json({ error: "Failed to remove user from the club" });
  }
});

export default router;
