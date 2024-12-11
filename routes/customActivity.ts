import express, { NextFunction, Request, Response } from "express";
import { query } from "../database";

const router = express.Router();

// Add custom activity
router.post("/add", async (req: Request, res: Response) => {
  const { userId, duration, caloriesBurned, intensity, tag } = req.body;

  if (!userId || !duration || !caloriesBurned) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  try {
    // Insert into custom_workouts
    await query(
      `INSERT INTO custom_activities (user_id, duration, calories_burned, intensity, tag)
         VALUES ($1, $2, $3, $4, $5)`,
      [userId, duration, caloriesBurned, intensity, tag]
    );

    res.status(200).json({ message: "Custom activity added successfully." });
  } catch (error) {
    console.error("Error adding custom activity:", error);
    res.status(500).json({ error: "Failed to add custom activity." });
  }
});

export default router;
