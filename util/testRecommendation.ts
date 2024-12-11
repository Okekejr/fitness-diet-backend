interface RecomWorkt {
  weight: number;
  age: number;
  goals: string[];
  activityLevel: string;
  dietaryPreferences?: string[];
  dietGoal: string[]; // e.g., allergies, vegetarian
}

interface RecommendDetails {
  intensity: string;
  activityLevel: string;
  recommendation: string;
}

interface DietDetails {
  caloricIntake: number;
  protein: number;
  carbs: number;
  fats: number;
}

export const recommendFitnessAndDietPlan = ({
  weight,
  age,
  goals = [],
  activityLevel,
  dietaryPreferences = [],
  dietGoal = ["balanced"],
}: RecomWorkt) => {
  // Initialize query strings and response objects
  let workoutQueryStr = "SELECT * FROM workouts WHERE ";
  let dietQueryStr = "SELECT * FROM diets WHERE ";

  let workoutData: RecommendDetails = {
    intensity: "",
    activityLevel,
    recommendation: "",
  };

  let dietData: DietDetails = {
    caloricIntake: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  };

  // --- Workout Algorithm ---
  if (goals.includes("weight-loss")) {
    workoutQueryStr += `(tag = 'Cardio' OR tag = 'HIIT' OR tag = 'Endurance' OR tag = 'Strength Training' OR tag = 'Core')`;
  } else if (goals.includes("muscle-gain")) {
    workoutQueryStr += `(tag = 'Strength Training' OR tag = 'Core' OR tag = 'HIIT' OR tag = 'Endurance')`;
  } else if (goals.includes("endurance")) {
    workoutQueryStr += `(tag = 'Endurance' OR tag = 'Cardio' OR tag = 'Strength Training')`;
  }

  if (age > 50) {
    workoutQueryStr += " AND intensity = 'Low'";
    workoutData.intensity = "Low";
  } else if (activityLevel === "very-active") {
    workoutQueryStr += " AND intensity = 'High'";
    workoutData.intensity = "High";
  } else if (activityLevel === "sedentary" || activityLevel === "light") {
    workoutQueryStr += " AND intensity = 'Low'";
    workoutData.intensity = "Low";
  } else if (activityLevel === "moderate" || activityLevel === "active") {
    workoutQueryStr += " AND intensity = 'Medium'";
    workoutData.intensity = "Medium";
  } else {
    workoutQueryStr += " AND intensity = 'Low'"; // Fallback to low intensity
  }

  if (weight > 100) {
    workoutQueryStr += " AND activity_level = 'Advanced'";
    workoutData.recommendation = "Advanced";
  } else if (weight < 60) {
    workoutQueryStr += " AND activity_level = 'Beginner'";
    workoutData.recommendation = "Beginner";
  } else {
    workoutQueryStr += " AND activity_level = 'Intermediate'";
    workoutData.recommendation = "Intermediate";
  }

  // --- Diet Algorithm ---
  let calorieAdjustment = 0;
  if (goals.includes("weight-loss")) {
    calorieAdjustment = -500;
  } else if (goals.includes("muscle-gain")) {
    calorieAdjustment = 500;
  }

  let bmr = 10 * weight + 6.25 * (age * 0.9) - 5 * age + 5;
  if (age > 60) {
    bmr *= 0.9;
  }
  let tdee =
    bmr *
    (activityLevel === "sedentary"
      ? 1.2
      : activityLevel === "light"
      ? 1.375
      : activityLevel === "moderate"
      ? 1.55
      : activityLevel === "active"
      ? 1.725
      : 1.9);
  let caloricIntake = tdee + calorieAdjustment;

  let protein = goals.includes("muscle-gain") ? 2 * weight : 1.2 * weight;
  if (age > 50) {
    protein = Math.max(protein, 1.5 * weight);
  }
  let carbs = goals.includes("muscle-gain") ? 3 * weight : 2 * weight;
  let fats = (caloricIntake - (protein * 4 + carbs * 4)) / 9;

  let dietCondition = `goal = '${goals}' AND calories BETWEEN ${
    caloricIntake - 500
  } AND ${caloricIntake + 500}`;

  if (dietaryPreferences.length > 0) {
    dietCondition += ` AND NOT (ingredients @> ARRAY[${dietaryPreferences
      .map((ingredient) => `'${ingredient}'`)
      .join(",")}]::TEXT[])`; // Avoid allergens in ingredients
  }

  // If a diet goal is provided, match it to the diet's diet_type field
  if (dietGoal) {
    dietCondition += ` AND diet_type = '${dietGoal}'`; // Ensure diet matches the selected diet type (e.g., "high-protein")
  }

  dietQueryStr += dietCondition;

  // --- Monthly Plan Generation ---
  let workoutsPerWeek = 0;

  if (activityLevel === "sedentary") workoutsPerWeek = 1;
  else if (activityLevel === "light") workoutsPerWeek = 2;
  else if (activityLevel === "moderate") workoutsPerWeek = 4;
  else if (activityLevel === "active") workoutsPerWeek = 6;
  else if (activityLevel === "very-active") workoutsPerWeek = 7;

  const workoutsPerMonth = workoutsPerWeek * 4;
  const mealsPerMonth = 3;

  let finalWorkoutQuery =
    workoutQueryStr + ` ORDER BY RANDOM() LIMIT ${workoutsPerMonth}`;
  let finalDietQuery =
    dietQueryStr + ` ORDER BY RANDOM() LIMIT ${mealsPerMonth}`;
  let fallbackqueryWorkout = `
    SELECT * 
    FROM workouts
    ORDER BY RANDOM()
    LIMIT 16;
    `;
  let fallbackqueryDiet = `
  SELECT * 
  FROM diets;
  `;

  dietData = {
    caloricIntake,
    protein,
    carbs,
    fats,
  };

  return {
    workoutQuery: finalWorkoutQuery,
    dietQuery: finalDietQuery,
    fallbackqueryWorkout,
    fallbackqueryDiet,
    workoutData,
    dietData,
  };
};
