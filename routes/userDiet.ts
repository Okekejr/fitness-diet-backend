import express, { NextFunction, Request, Response } from "express";
import { query } from "../database";

const router = express.Router();

router.get("/:mealId", async (req: Request, res: Response) => {
  const { mealId } = req.params;

  try {
    // Query to fetch meal details by ID
    const result = await query("SELECT * FROM diets WHERE id = $1", [mealId]);

    if (result.length === 0) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Error fetching meal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
