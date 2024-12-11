import express from "express";
import { query } from "../database";

const router = express.Router();

// Get overview stats for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Total workouts, including custom activities
    const totalWorkouts = await query(
      `
      SELECT COUNT(*) AS total_workouts
      FROM (
        SELECT id FROM user_completed_workouts WHERE user_id = $1
        UNION ALL
        SELECT id FROM custom_activities WHERE user_id = $1
      ) combined
      `,
      [userId]
    );

    // Current Streak
    const streak = await query(
      `
      SELECT streak FROM user_data WHERE user_id = $1
      `,
      [userId]
    );

    // Total calories burned, including custom activities
    const totalCalories = await query(
      `
      SELECT SUM(calories_burned) AS total_calories
      FROM (
        SELECT w.calories_burned FROM user_completed_workouts ucw
        JOIN workouts w ON ucw.workout_id = w.id
        WHERE ucw.user_id = $1
        UNION ALL
        SELECT calories_burned FROM custom_activities WHERE user_id = $1
      ) combined
      `,
      [userId]
    );

    // Total minutes, including custom activities
    const totalMinutes = await query(
      `
      SELECT SUM(duration) AS total_minutes
      FROM (
        SELECT w.duration FROM user_completed_workouts ucw
        JOIN workouts w ON ucw.workout_id = w.id
        WHERE ucw.user_id = $1
        UNION ALL
        SELECT duration FROM custom_activities WHERE user_id = $1
      ) combined
      `,
      [userId]
    );

    // Best day for completed workouts (custom activities not included as they lack `completed_at`)
    const bestDay = await query(
      `
      SELECT to_char(ucw.completed_at, 'Day') AS day, COUNT(*) AS count
      FROM user_completed_workouts ucw
      WHERE ucw.user_id = $1
      GROUP BY day ORDER BY count DESC LIMIT 1
      `,
      [userId]
    );

    // Workout breakdown, including tags from custom activities
    const workoutBreakdown = await query(
      `
      SELECT name, COUNT(*) AS population,
             CASE 
               WHEN name = 'Strength' THEN '#4CAF50'
               WHEN name = 'Cardio' THEN '#FF6347'
               WHEN name = 'HIIT' THEN '#FFD700'
               WHEN name = 'Core' THEN '#00BFFF'
               WHEN name = 'Endurance' THEN '#FF69B4'
               ELSE '#808080'
             END AS color,
             '#7F7F7F' AS legendFontColor
      FROM (
        SELECT w.tag AS name FROM user_completed_workouts ucw
        JOIN workouts w ON ucw.workout_id = w.id
        WHERE ucw.user_id = $1
        UNION ALL
        SELECT tag AS name FROM custom_activities WHERE user_id = $1
      ) combined
      GROUP BY name
      `,
      [userId]
    );

    // Send response
    res.status(200).json({
      totalWorkouts: parseInt(totalWorkouts[0].total_workouts, 10),
      totalCalories: parseInt(totalCalories[0].total_calories, 10),
      totalMinutes: parseInt(totalMinutes[0].total_minutes, 10),
      bestDay: bestDay[0]?.day.trim() || "N/A",
      workoutBreakdown,
      streak: streak[0].streak,
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({ error: "Failed to fetch overview stats." });
  }
});

export default router;
