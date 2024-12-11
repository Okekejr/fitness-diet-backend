import { WorkoutsT } from "./workouts";

export interface UserDataT {
  user_id: string;
  name: string;
  weight: number;
  height: number;
  age: number;
  activity_level: string;
  allergies: string;
  preferences: {
    workout: string[];
    diet: string[];
  };
  workout_plan: WorkoutsT[];
  profile_picture?: string;
  current_workout_week: number;
  week_start_date: string;
}
