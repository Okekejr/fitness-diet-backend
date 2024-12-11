import express, { NextFunction, Request, Response } from "express";
import { query } from "../database";
import { ScheduleDay } from "../types/diet";

const router = express.Router();

// Get past used workouts for a user
router.get("/getPastUsedWorkouts", async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
  }

  try {
    const result = await query(
      "SELECT workout_id FROM used_workouts WHERE user_id = $1",
      [userId]
    );

    // If no results, return an empty array with a 200 status
    const pastUsedWorkouts = result.map((row) => ({ id: row.workout_id }));
    res.status(200).json(pastUsedWorkouts);
  } catch (error) {
    console.error("Error fetching past used workouts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/getWorkoutSchedule", async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const result = await query(
      `SELECT workout_schedule 
         FROM user_workout_schedule 
         WHERE user_id = $1 
         AND week_number = (SELECT current_workout_week FROM user_data WHERE user_id = $1)`,
      [userId]
    );

    if (result.length === 0) {
      res.status(200).json([]);
      return;
    }

    res.status(200).json(result[0].workout_schedule);
  } catch (error) {
    console.error("Error fetching workout schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/saveWorkoutSchedule", async (req: Request, res: Response) => {
  const { userId, workoutSchedule, currentWorkoutWeek, weekStartDate } =
    req.body;

  console.log(userId, workoutSchedule, currentWorkoutWeek, weekStartDate);

  if (!userId || !workoutSchedule || !currentWorkoutWeek || !weekStartDate) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // Delete existing workout schedule for this week to avoid duplication
    await query(
      `DELETE FROM user_workout_schedule WHERE user_id = $1 AND current_workout_week = $2`,
      [userId, currentWorkoutWeek]
    );

    await query(
      `UPDATE user_data
       SET current_workout_week = $1
       WHERE user_id = $2`,
      [currentWorkoutWeek, userId]
    );

    // Insert the new workout schedule
    await query(
      `INSERT INTO user_workout_schedule (user_id, workout_schedule, current_workout_week, week_start_date, week_number)
         VALUES ($1, $2, $3, $4, $3)`,
      [
        userId,
        JSON.stringify(workoutSchedule),
        currentWorkoutWeek,
        weekStartDate,
      ]
    );

    res.status(200).json({ message: "Workout schedule saved successfully" });
    return;
  } catch (error) {
    console.error("Error saving workout schedule:", error);
    res.status(500).json({ error: "Failed to save workout schedule" });
    return;
  }
});

router.post("/saveUsedWorkouts", async (req: Request, res: Response) => {
  const { userId, usedWorkouts } = req.body;

  if (!userId || !Array.isArray(usedWorkouts) || usedWorkouts.length === 0) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    console.log("Saving used workouts:", { userId, usedWorkouts });

    for (const workout of usedWorkouts) {
      const { workoutId, weekNumber, dateAssigned } = workout;

      if (!workoutId || !weekNumber || !dateAssigned) {
        console.warn("Skipping invalid workout entry:", workout);
        continue;
      }

      // Check if the workout for this week already exists
      const existingWorkout = await query(
        `SELECT 1 FROM used_workouts 
         WHERE user_id = $1 AND workout_id = $2 AND week_number = $3`,
        [userId, workoutId, weekNumber]
      );

      if (existingWorkout.length === 0) {
        // Insert the workout if it doesn't exist
        await query(
          `INSERT INTO used_workouts (user_id, workout_id, week_number, date_assigned)
           VALUES ($1, $2, $3, $4)`,
          [userId, workoutId, weekNumber, dateAssigned]
        );
      } else {
        console.log(`Workout already exists for user ${userId}:`, workoutId);
      }
    }

    res.status(200).json({ message: "Used workouts saved successfully" });
  } catch (error) {
    console.error("Error saving used workouts:", error);
    res.status(500).json({
      error:
        (error as { message?: string }).message ||
        "Failed to save used workouts",
    });
  }
});

router.post("/saveSchedule", async (req: Request, res: Response) => {
  const { userId, schedule, currentWeek, weekStartDate } = req.body;

  if (!userId || !schedule || !currentWeek || !weekStartDate) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // Save workout schedule
    await query(
      `DELETE FROM user_workout_schedule WHERE user_id = $1 AND current_workout_week = $2`,
      [userId, currentWeek]
    );

    await query(
      `UPDATE user_data
       SET current_workout_week = $1
       WHERE user_id = $2`,
      [currentWeek, userId]
    );

    await query(
      `INSERT INTO user_workout_schedule (user_id, workout_schedule, current_workout_week, week_start_date, week_number)
       VALUES ($1, $2, $3, $4, $3)`,
      [
        userId,
        JSON.stringify(schedule.map((day: ScheduleDay) => day.workouts)), // Map to workouts only
        currentWeek,
        weekStartDate,
      ]
    );

    // Save diet schedule
    await query(
      `DELETE FROM user_diet_schedule WHERE user_id = $1 AND week_number = $2`,
      [userId, currentWeek]
    );

    await query(
      `INSERT INTO user_diet_schedule (user_id, diet_schedule, current_diet_week, week_start_date, week_number)
       VALUES ($1, $2, $3, $4, $3)`,
      [
        userId,
        JSON.stringify(schedule.map((day: ScheduleDay) => day.diets)), // Map to diets only
        currentWeek,
        weekStartDate,
      ]
    );

    res.status(200).json({ message: "Schedule saved successfully" });
  } catch (error) {
    console.error("Error saving schedule:", error);
    res.status(500).json({ error: "Failed to save schedule" });
  }
});

router.get("/getSchedule", async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    // Fetch the current workout week for the user
    const weekResult = await query(
      `SELECT current_workout_week FROM user_data WHERE user_id = $1`,
      [userId]
    );

    if (weekResult.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const currentWeek = weekResult[0].current_workout_week;

    // Fetch workout schedule from user_workout_schedule table for the current week
    const workoutResult = await query(
      `SELECT workout_schedule 
         FROM user_workout_schedule 
         WHERE user_id = $1 
         AND week_number = $2`,
      [userId, currentWeek]
    );

    // Fetch diet schedule from user_diet_schedule table for the current week
    const dietResult = await query(
      `SELECT diet_schedule 
         FROM user_diet_schedule 
         WHERE user_id = $1 
         AND week_number = $2`,
      [userId, currentWeek]
    );

    // If no schedule exists in either table, return an empty array
    if (workoutResult.length === 0 && dietResult.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Flatten workout and diet schedules
    const workout_schedule =
      workoutResult.length > 0 ? workoutResult[0].workout_schedule.flat() : [];
    const diet_schedule =
      dietResult.length > 0 ? dietResult[0].diet_schedule.flat() : [];

    // Combine the workout and diet schedule by day
    const combinedSchedule = Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      return {
        day,
        workouts: workout_schedule.filter(
          (workout: { day: number }) => workout.day === day
        ),
        diets: diet_schedule.filter(
          (diet: { day: number }) => diet.day === day
        ),
      };
    });

    // Send the combined schedule
    res.status(200).json(combinedSchedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/streak", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const [result] = await query(
      "SELECT streak, last_activity_date FROM user_data WHERE user_id = $1",
      [userId]
    );

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { streak, last_activity_date } = result;
    res.status(200).json({
      streak,
      lastActivityDate: new Date(last_activity_date).toISOString(),
    });
  } catch (error) {
    console.error("Error fetching streak:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update streak
router.post("/updateStreak", async (req, res) => {
  const { userId, todayDate } = req.body;

  if (!userId || !todayDate) {
    res.status(400).json({ error: "Missing userId or todayDate" });
    return;
  }

  try {
    const [result] = await query(
      "SELECT streak, last_activity_date FROM user_data WHERE user_id = $1",
      [userId]
    );

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { streak, last_activity_date } = result;

    const lastActivityDate = new Date(last_activity_date);
    const today = new Date(todayDate);

    if (isNaN(lastActivityDate.getTime()) || isNaN(today.getTime())) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    let newStreak = streak;
    const dayDifference = Math.floor(
      (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDifference === 1) {
      newStreak += 1; // Increment streak
    } else if (dayDifference > 1) {
      newStreak = 0; // Reset streak if more than one day missed
    }

    await query(
      "UPDATE user_data SET streak = $1, last_activity_date = $2 WHERE user_id = $3",
      [newStreak, todayDate, userId]
    );

    res.status(200).json({ streak: newStreak });
  } catch (error) {
    console.error("Error updating streak:", error);
    res.status(500).json({ error: "Failed to update streak" });
  }
});

// Reset streak
router.post("/resetStreak", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    await query(
      "UPDATE user_data SET streak = 0, last_activity_date = NULL WHERE user_id = $1",
      [userId]
    );

    res.status(200).json({ streak: 0 });
  } catch (error) {
    console.error("Error resetting streak:", error);
    res.status(500).json({ error: "Failed to reset streak" });
  }
});

export default router;
