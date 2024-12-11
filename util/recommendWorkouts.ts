interface RecomWorkt {
  weight: number;
  goals: string[];
  activityLevel: string;
}

interface RecommendDetails {
  intensity: string;
  activity_level: string;
  recomendation: string;
}

export const recommendWorkouts = ({
  weight,
  goals,
  activityLevel,
}: RecomWorkt) => {
  let queryStr = "SELECT * FROM workouts WHERE ";

  let data: RecommendDetails = {
    intensity: "",
    activity_level: activityLevel,
    recomendation: "",
  };

  // Adjust query based on goals, incorporating all 13 workout categories
  if (goals.includes("weight-loss")) {
    queryStr += `
        (tag = 'Cardio' OR tag = 'HIIT' OR tag = 'Endurance' 
        OR tag = 'Strength Training' OR tag = 'Core' OR tag = 'Functional'
        OR tag = 'Flexibility' OR tag = 'Balance' OR tag = 'Recovery'
        OR tag = 'Yoga' OR tag = 'Pilates')`;
  } else if (goals.includes("muscle-gain")) {
    queryStr += `
        (tag = 'Strength Training' OR tag = 'Core' OR tag = 'Functional'
        OR tag = 'HIIT' OR tag = 'Endurance' OR tag = 'Cardio' 
        OR tag = 'Flexibility' OR tag = 'Balance' OR tag = 'Recovery'
        OR tag = 'Yoga' OR tag = 'Pilates')`;
  } else if (goals.includes("endurance")) {
    queryStr += `
        (tag = 'Endurance' OR tag = 'Cardio' OR tag = 'Sports'
        OR tag = 'Strength Training' OR tag = 'Functional' OR tag = 'Core'
        OR tag = 'Flexibility' OR tag = 'Recovery' OR tag = 'Yoga' 
        OR tag = 'Pilates')`;
  }

  // Adjust intensity based on activity level
  if (activityLevel === "very-active") {
    queryStr += " AND intensity = 'High'";
    data.intensity = "High";
  } else if (activityLevel === "sedentary" || activityLevel === "light") {
    queryStr += " AND intensity = 'Low'";
    data.intensity = "Low";
  } else if (activityLevel === "moderate" || activityLevel === "active") {
    queryStr += " AND intensity = 'Medium'";
    data.intensity = "Medium";
  }

  // Adjust recommendation based on weight
  if (weight > 100) {
    queryStr += " AND activity_level = 'Advanced'";
    data.recomendation = "Advanced";
  } else if (weight < 60) {
    queryStr += " AND activity_level = 'Beginner'";
    data.recomendation = "Beginner";
  } else {
    queryStr += " AND activity_level = 'Intermediate'";
    data.recomendation = "Intermediate";
  }

  // Determine the number of workouts per month based on activity level
  let workoutsPerWeek: number = 0;

  if (activityLevel === "sedentary") workoutsPerWeek = 1;
  else if (activityLevel === "light")
    workoutsPerWeek = 2; // average of 1-3 days/week
  else if (activityLevel === "moderate")
    workoutsPerWeek = 4; // average of 3-5 days/week
  else if (activityLevel === "active") workoutsPerWeek = 6; // 6-7 days/week
  else if (activityLevel === "very-active") workoutsPerWeek = 7; // daily intense exercise

  const workoutsPerMonth = workoutsPerWeek * 4; // Multiply by 4 weeks to get total workouts for the month

  // Return the primary query string
  let query = queryStr + ` ORDER BY RANDOM() LIMIT ${workoutsPerMonth}`;

  // Fallback query (in case no results found for the exact criteria)
  const fallbackQuery = `
      SELECT * FROM workouts 
      WHERE tag IN ('Cardio', 'Strength Training', 'HIIT', 'Endurance', 'Functional', 'Core', 'Flexibility', 'Recovery', 'Yoga', 'Pilates') 
      ORDER BY RANDOM() LIMIT ${workoutsPerMonth}`;

  return { query, fallbackQuery, data };
};

export const workoutDays = (activityLevel: string): number => {
  // Determine the number of workouts per month based on activity level
  let workoutsPerWeek = 0;

  if (activityLevel === "sedentary") workoutsPerWeek = 1;
  else if (activityLevel === "light") workoutsPerWeek = 2;
  else if (activityLevel === "moderate") workoutsPerWeek = 4;
  else if (activityLevel === "active") workoutsPerWeek = 6;
  else if (activityLevel === "very-active") workoutsPerWeek = 7;

  return workoutsPerWeek;
};
