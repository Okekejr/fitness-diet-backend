import { query } from "../database";
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import express, { Request, Response } from "express";

const router = express.Router();

// Extend the Request type to include session
interface AuthenticatedRequest extends Request {
  session?: {
    getUserId(): string;
  };
}

// GET: get recommendations for the user
router.get(
  "/",
  verifySession(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.session?.getUserId();
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await query(
        `SELECT workout_plan, diet_plan, preferences, activity_level FROM user_data WHERE user_id = $1`,
        [userId]
      );

      // Ensure the query returned a valid result
      if (result.length === 0 || !result[0].workout_plan) {
        res.status(404).json({ error: "No workout plan found" });
        return;
      }

      // Correct parsing of workout_plan (JSON stored in DB)
      const workoutPlan = result[0].workout_plan;
      const dietPlan = result[0].diet_plan;

      res.status(200).json({
        workoutPlan: workoutPlan.slice(0, 3), // Only return 3 recommendations
        dietPlan: dietPlan.slice(0, 3),
        workoutData: result[0],
        message: "Workout plan retrieved successfully",
      });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  }
);

export default router;
