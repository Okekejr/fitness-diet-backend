import express, { Request, Response, NextFunction } from "express";
import { query } from "../database";

const categoryRouter = express.Router();

// Get all categories
categoryRouter.get("/", async (req: Request, res: Response) => {
  try {
    const categories = await query("SELECT * FROM workout_categories");
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch workout categories" });
  }
});

// Get a specific category by ID
categoryRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      "SELECT * FROM workout_categories WHERE id = $1",
      [id]
    );

    if (result.length === 0) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

// Get all workouts for a specific category
categoryRouter.get("/:id/workouts", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workouts = await query(
      "SELECT * FROM workouts WHERE category_id = $1",
      [id]
    );

    if (workouts.length === 0) {
      res.status(404).json({ error: "No workouts found for this category" });
      return;
    }

    res.status(200).json(workouts);
  } catch (error) {
    console.error("Error fetching workouts for category:", error);
    res.status(500).json({ error: "Failed to fetch workouts" });
  }
});

export default categoryRouter;
