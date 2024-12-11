import express from "express";
import { query } from "../database";

const router = express.Router();

// Save a new achievement
router.post("/save", async (req, res) => {
  const { userId, achievementId } = req.body;

  try {
    await query(
      `INSERT INTO user_achievements (user_id, achievement_id) 
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, achievementId]
    );
    res.status(201).json({ message: "Achievement saved successfully" });
  } catch (error) {
    console.error("Error saving achievement:", error);
    res.status(500).json({ error: "Failed to save achievement" });
  }
});

// Fetch all achievements unlocked by a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await query(
      `SELECT achievement_id FROM user_achievements WHERE user_id = $1`,
      [userId]
    );
    const achievements = result.map((row) => row.achievement_id);
    res.status(200).json(achievements);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    res.status(500).json({ error: "Failed to fetch achievements" });
  }
});

export default router;
