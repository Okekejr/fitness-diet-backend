import express, { Request, Response, NextFunction } from "express";
import { query } from "../database";

const router = express.Router();

// Get all completed workouts for a user
router.get("/", async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    res.status(400).json({ error: "userId is required in query parameters." });
    return;
  }

  try {
    const completedWorkouts = await query(
      `
      SELECT w.*
      FROM user_completed_workouts ucw
      JOIN workouts w ON ucw.workout_id = w.id
      WHERE ucw.user_id = $1
      `,
      [userId]
    );

    if (completedWorkouts.length === 0) {
      res.status(200).json([]);
      return;
    }

    res.status(200).json(completedWorkouts);
    return;
  } catch (error) {
    console.error("Error fetching completed workouts:", error);
    res.status(500).json({ error: "Failed to fetch completed workouts." });
    return;
  }
});

// get completed workout for summary page
router.get("/getCompleted", async (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  if (!userId) {
    res.status(400).json({ error: "userId is required in query parameters." });
    return;
  }

  try {
    const completedWorkouts = await query(
      `
      SELECT workout_id, name, image_url, intensity, duration, tag, activity_level, completed_at
      FROM (
      -- Completed workouts from user_completed_workouts
      SELECT ucw.workout_id, w.name, w.image_url, w.intensity, w.duration, w.tag, w.activity_level, ucw.completed_at
      FROM user_completed_workouts ucw
      JOIN workouts w ON ucw.workout_id = w.id
      WHERE ucw.user_id = $1
      
      UNION ALL
      
      -- Custom activities from custom_activities
      SELECT NULL AS workout_id, cw.tag AS name, NULL AS image_url, NULL AS intensity, cw.duration, cw.tag, NULL AS activity_level, cw.created_at AS completed_at
      FROM custom_activities cw
      WHERE cw.user_id = $1
      ) combined
      ORDER BY completed_at DESC;
      `,
      [userId]
    );

    if (completedWorkouts.length === 0) {
      res.status(200).json([]);
      return;
    }

    res.status(200).json(completedWorkouts);
    return;
  } catch (error) {
    console.error("Error fetching completed workouts:", error);
    res.status(500).json({ error: "Failed to fetch completed workouts." });
    return;
  }
});

// Mark a workout as completed
router.post("/", async (req: Request, res: Response) => {
  const { userId, workoutId } = req.body;

  if (!userId || !workoutId) {
    res.status(400).json({ error: "userId and workoutId are required." });
    return;
  }

  try {
    await query(
      `INSERT INTO user_completed_workouts (user_id, workout_id, completed_at)
       VALUES ($1, $2, $3) ON CONFLICT (user_id, workout_id) DO NOTHING`,
      [userId, workoutId, new Date()]
    );

    res.status(200).json({ message: "Workout marked as completed." });
  } catch (error) {
    console.error("Error marking workout as completed:", error);
    res.status(500).json({ error: "Failed to mark workout as completed." });
  }
});

export default router;
