import express from "express";
import { query } from "../database";

const router = express.Router();

// Route to fetch 5 random workouts
router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM workouts ORDER BY RANDOM() LIMIT 3"
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching featured workouts:", error);
    res.status(500).json({ error: "Failed to fetch workouts" });
  }
});

export default router;
