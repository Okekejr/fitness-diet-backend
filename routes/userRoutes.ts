import express, { NextFunction, Request, Response } from "express";
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { query } from "../database";
import { recommendFitnessAndDietPlan, recommendWorkouts } from "../util";
import supertokens from "supertokens-node";

const router = express.Router();

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await query("SELECT * FROM user_data WHERE user_id = $1", [
      id,
    ]);

    if (user.length === 0) {
      // If user not found, return 404 status
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json(user[0]);
  } catch (error: any) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Extend the Request type to include session
interface AuthenticatedRequest extends Request {
  session?: {
    getUserId(): string;
  };
}

// Route handler with session verification
router.post(
  "/userData",
  verifySession(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.session!.getUserId();
      const userInfo = await supertokens.getUser(userId);
      const email = userInfo?.emails[0];

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const {
        name,
        weight,
        height,
        age,
        allergies,
        preferences,
        activityLevel,
      } = req.body;

      console.log(preferences.workout, preferences.diet);

      // **1. Generate Workout and Diet Plan using the updated algorithm**
      const {
        workoutQuery,
        dietQuery,
        workoutData,
        dietData,
        fallbackqueryDiet,
        fallbackqueryWorkout,
      } = recommendFitnessAndDietPlan({
        weight,
        age,
        goals: preferences.workout,
        activityLevel,
        dietaryPreferences: allergies,
        dietGoal: preferences.diet, // Pass allergies to dietary preferences
      });

      console.log("workoutQuery:", workoutQuery);
      console.log("dietQuery:", dietQuery);

      // **2. Fetch workout and diet data from the database**
      const workouts = await query(fallbackqueryWorkout);
      const meals = await query(fallbackqueryDiet);

      console.log("Workouts:", workouts);
      console.log("Meals:", meals);

      // **3. Confirm workout and diet plans are generated**
      if (workouts.length === 0 || meals.length === 0) {
        res
          .status(500)
          .json({ error: "Failed to generate workout or diet plan." });
        return;
      }

      // **4. Save workout and diet plans along with user data**
      const existingUser = await query(
        "SELECT * FROM user_data WHERE user_id = $1",
        [userId]
      );

      const userQuery =
        existingUser.length > 0
          ? `UPDATE user_data 
           SET name = $1, weight = $2, height = $3, age = $4, preferences = $5, activity_level = $6, workout_plan = $7, diet_plan = $8 
           WHERE user_id = $9`
          : `INSERT INTO user_data 
           (user_id, name, weight, height, age, preferences, activity_level, workout_plan, diet_plan, email) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

      // Now the array passed to the query function:
      const queryValues =
        existingUser.length > 0
          ? [
              userId,
              name,
              weight,
              height,
              age,
              JSON.stringify(preferences),
              activityLevel,
              JSON.stringify(workouts),
              JSON.stringify(meals),
            ]
          : [
              userId,
              name,
              weight,
              height,
              age,
              JSON.stringify(preferences),
              activityLevel,
              JSON.stringify(workouts),
              JSON.stringify(meals),
              email, // Only for the INSERT query
            ];

      await query(userQuery, queryValues);

      // **5. Handle allergies** (if any provided)
      if (allergies && allergies.length > 0) {
        for (const allergy of allergies) {
          const existingAllergy = await query(
            "SELECT id FROM allergies WHERE name = $1",
            [allergy]
          );

          let allergyId;
          if (existingAllergy.length === 0) {
            const newAllergy = await query(
              "INSERT INTO allergies (name) VALUES ($1) RETURNING id",
              [allergy]
            );
            allergyId = newAllergy[0].id;
          } else {
            allergyId = existingAllergy[0].id;
          }

          await query(
            `INSERT INTO user_allergies (user_id, allergy_id) 
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, allergyId]
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "User data, workout plan, and diet plan saved successfully",
      });
    } catch (error) {
      console.error(
        "Error saving user data, workout plan, and diet plan:",
        error
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

//regenerate workout plans and diet plans
router.post(
  "/userData/regeneratePlan",
  verifySession(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.session!.getUserId();
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // **1. Check if user exists**
      const existingUser = await query(
        "SELECT * FROM user_data WHERE user_id = $1",
        [userId]
      );

      if (existingUser.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // **2. Delete existing workout and diet plans**
      await query(
        `UPDATE user_data 
         SET workout_plan = NULL, diet_plan = NULL 
         WHERE user_id = $1`,
        [userId]
      );

      // **3. Retrieve necessary user data**
      const {
        weight,
        age,
        preferences,
        activity_level: activityLevel,
        allergies,
      } = await existingUser[0];

      const safeAllergies: string[] = allergies ?? [];

      // **4. Generate new workout and diet plans using recommendFitnessAndDietPlan**
      const {
        workoutQuery,
        dietQuery,
        fallbackqueryWorkout,
        fallbackqueryDiet,
      } = recommendFitnessAndDietPlan({
        weight,
        age,
        goals: preferences.workout,
        activityLevel,
        dietaryPreferences: safeAllergies,
        dietGoal: preferences.diet,
      });

      console.log("workoutQuery:", fallbackqueryWorkout);
      console.log("dietQuery:", fallbackqueryDiet);

      // **5. Fetch new workout and diet data from database**
      const workouts = await query(fallbackqueryWorkout);
      const meals = await query(fallbackqueryDiet);

      console.log("Workouts:", workouts);
      console.log("Meals:", meals);

      if (workouts.length === 0 || meals.length === 0) {
        res
          .status(500)
          .json({ error: "Failed to generate new workout or diet plan" });
        return;
      }

      // **6. Update user_data with the new plans**
      await query(
        `UPDATE user_data
         SET workout_plan = $1, diet_plan = $2, week_start_date = NOW()
         WHERE user_id = $3`,
        [JSON.stringify(workouts), JSON.stringify(meals), userId]
      );

      res.status(200).json({
        success: true,
        message: "Workout and diet plan regenerated successfully",
        workouts,
        meals,
      });
    } catch (error) {
      console.error("Error regenerating workout and diet plan:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// update user experience
router.post(
  "/userData/updatePlans",
  verifySession(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.session!.getUserId();
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { activityLevel, preferences } = req.body;

      // **1. Check if user exists**
      const existingUser = await query(
        "SELECT * FROM user_data WHERE user_id = $1",
        [userId]
      );

      if (existingUser.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // **2. Delete existing workout and diet plans**
      await query(
        `UPDATE user_data
         SET workout_plan = NULL, diet_plan = NULL, activity_level = NULL, 
         preferences = NULL
         WHERE user_id = $1`,
        [userId]
      );

      // **3. Retrieve necessary user data**
      const { weight, age, allergies } = await existingUser[0];

      const safeAllergies: string[] =
        Array.isArray(allergies) && allergies.length > 0 ? allergies : [];

      console.log(weight, age, safeAllergies, activityLevel, preferences);

      // **4. Generate new workout and diet plans**
      const {
        workoutQuery,
        dietQuery,
        fallbackqueryWorkout,
        fallbackqueryDiet,
      } = recommendFitnessAndDietPlan({
        weight,
        age,
        goals: preferences.workout,
        activityLevel,
        dietaryPreferences: safeAllergies,
        dietGoal: preferences.diet,
      });

      console.log("workoutQuery:", fallbackqueryWorkout);
      console.log("dietQuery:", fallbackqueryDiet);

      // **5. Fetch new workout and diet data from database**
      const workouts = await query(fallbackqueryWorkout);
      const meals = await query(fallbackqueryDiet);

      console.log("Workouts:", workouts);
      console.log("Meals:", meals);

      if (workouts.length === 0 || meals.length === 0) {
        res
          .status(500)
          .json({ error: "Failed to generate new workout or diet plan" });
        return;
      }

      // **6. Update user_data with the new plans**
      await query(
        `UPDATE user_data
         SET workout_plan = $1,
             diet_plan = $2,
             activity_level = $3,
             preferences = $4,
             week_start_date = NOW()
         WHERE user_id = $5`,
        [
          JSON.stringify(workouts),
          JSON.stringify(meals),
          activityLevel,
          JSON.stringify(preferences),
          userId,
        ]
      );

      // **3. Delete user workout and diet-related data**
      await query(`DELETE FROM user_workout_schedule WHERE user_id = $1`, [
        userId,
      ]);

      await query(`DELETE FROM used_workouts WHERE user_id = $1`, [userId]);

      await query(`DELETE FROM user_diet_schedule WHERE user_id = $1`, [
        userId,
      ]);

      res.status(200).json({
        success: true,
        message: "Workout and diet plans updated successfully",
        workouts,
        meals,
      });
    } catch (error) {
      console.error("Error updating workout and diet plans:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }
);

// delete user profile
router.post("/:userId/delete", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Update user data with soft deletion
    const result = await query(
      `
      UPDATE user_data 
      SET is_deleted = TRUE, deleted_at = NOW() 
      WHERE user_id = $1
      RETURNING *
      `,
      [userId]
    );

    // If no user data is found, return a 404 error
    if (result.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res
      .status(200)
      .json({ message: "Account successfully marked for deletion." });
  } catch (error) {
    console.error("Error deleting account:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the account." });
  }
});

export default router;
