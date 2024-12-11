import { AssignedWorkoutT } from "./workouts";

export interface DietPlanEntity {
  id: number;
  goal: string;
  name: string;
  calories: number;
  image_url: string;
  meal_time: string;
  meal_type: string;
  created_at: string;
  recipe_url: string;
  description: string;
  ingredients?: string[] | null;
  activity_level: string;
  dietary_restrictions?: string[] | null;
}

export interface AssignedDietT {
  day: number; // Represents the day of the week (1 for Monday, 7 for Sunday)
  diet: DietPlanEntity; // The diet assigned for this day
  week: number; // The week number this diet is assigned for
}
export interface ScheduleDay {
  day: number; // Day of the week (1 to 7)
  workouts: AssignedWorkoutT[]; // Array of workouts for the day
  diets: AssignedDietT[]; // Array of diets for the day
}

export interface SaveScheduleRequest {
  userId: string; // User ID
  schedule: ScheduleDay[]; // Array of schedules for each day
  currentWeek: number; // The current workout/diet week
  weekStartDate: string; // Start date of the week
}
