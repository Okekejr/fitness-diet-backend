import express, { Request, Response } from "express";
import { query } from "../database";

const workoutRouter = express.Router();

// Fetch a workout by ID
workoutRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query("SELECT * FROM workouts WHERE id = $1", [id]);

    if (result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res.status(404).json({ error: "Workout not found" });
    }
  } catch (error) {
    console.error("Error fetching workout:", error);
    res.status(500).json({ error: "Failed to fetch workout" });
  }
});

// Get all workouts
workoutRouter.get("/", async (req: Request, res: Response) => {
  try {
    const workouts = await query(`SELECT * FROM workouts`);
    res.status(200).json(workouts);
    return;
  } catch (error) {
    console.error("Error fetching workouts:", error);
    res.status(500).json({ error: "Failed to fetch workouts" });
    return;
  }
});

export default workoutRouter;
