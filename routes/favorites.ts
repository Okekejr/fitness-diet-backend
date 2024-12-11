import express, { Request, Response, NextFunction } from "express";
import { query } from "../database";

const router = express.Router();

// Handle adding/removing favorites
router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId, workoutId, isFavorite } = req.body;

    try {
      if (isFavorite === true) {
        const favorites = await query(
          `
          SELECT w.*
          FROM user_workout_favorites uf
          JOIN workouts w ON uf.workout_id = w.id
          WHERE uf.user_id = $1
          `,
          [userId]
        );

        if (favorites.length === 0) {
          res.status(404).json({ message: "Favorite not found" });
          return;
        }
        
        await query(
          `DELETE FROM user_workout_favorites WHERE user_id = $1 AND workout_id = $2`,
          [userId, workoutId]
        );

        res.status(200).json({ message: "Removed from favorites" });
      } else {
        // Add to favorites
        await query(
          `INSERT INTO user_workout_favorites (user_id, workout_id) VALUES ($1, $2)`,
          [userId, workoutId]
        );

        res.status(201).json({ message: "Added to favorites" });
      }
    } catch (error) {
      console.error("Error updating favorite:", error);
      next(error); // Pass error to the next middleware (e.g., error handler)
    }
  }
);

// Get all favorite workouts for a user
router.get("/", async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const favorites = await query(
      `
      SELECT w.*
      FROM user_workout_favorites uf
      JOIN workouts w ON uf.workout_id = w.id
      WHERE uf.user_id = $1
      `,
      [userId]
    );

    if (favorites.length === 0) {
      res.status(200).json([]);
      return;
    }

    res.status(200).json(favorites);
    return;
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ error: "Failed to fetch user favorites" });
    return;
  }
});

export default router;
