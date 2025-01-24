# Fitness & Diet App - Backend  

The backend for the Fitness & Diet App is built with Express.js, providing APIs for authentication, user management, workout tracking, and other features. It integrates PostgreSQL for data storage and utilizes SuperTokens for secure authentication.  

---

## Features  

### Authentication  
- **User Authentication**:  
  - Email/password-based login using SuperTokens.  
  - Third-party authentication (GitHub and Apple).  
  - Password reset functionality with customizable email delivery.  

- **Session Management**:  
  - Secure session handling via SuperTokens.  

### APIs  
- **User Management**: Manage user profiles and preferences.  
- **Diet Plans**: Retrieve and update personalized diet plans.  
- **Workout Tracking**:  
  - Log activities, completed workouts, and custom activities.  
  - Retrieve recommendations and featured workouts.  
- **Run Clubs**: Manage run club memberships, events, and goals.  
- **Achievements**: Track and display user milestones.  
- **Categories & Favorites**: Organize workouts and favorite items.  

### Modular Routes  
- `authRoutes`: Handles authentication-related requests.  
- `userRoutes`: Manages user data.  
- `categoryRoutes`: Categorizes available workouts.  
- `workoutRoutes`: Provides workout-related endpoints.  
- `completedWorkoutRoutes`: Logs completed workouts.  
- `recommendations`: Offers personalized recommendations.  
- `profilePicture`: Handles profile picture uploads.  
- `featuredWorkouts`: Lists featured workouts.  
- `userWorkouts`: Manages user-specific workout data.  
- `overviewRoutes`: Displays overall user data.  
- `achievements`: Manages achievements and milestones.  
- `clubRoutes`: Handles run club functionalities.  
- `userDiet`: Manages user diet plans.  
- `customActivity`: Logs custom activities.  
- `activities`: Tracks user activities.  

---

## Technologies Used  

### Frameworks & Libraries  
- **Backend**: Express.js  
- **Authentication**: SuperTokens  
- **Database**: PostgreSQL  
- **Environment Variables**: dotenv  

### Tools  
- **Supertokens Dashboard**: Manage authentication configurations.  
- **CORS**: Configured for secure cross-origin requests.  

---

## Database  

The app uses PostgreSQL for data storage, with connection pooling managed by `pg`.  

Example connection setup:  

```typescript
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const database = new Pool({
  user: process.env.NEXT_PUBLIC_DB_USER,
  host: process.env.NEXT_PUBLIC_DB_HOST,
  database: process.env.NEXT_PUBLIC_DB_NAME,
  password: process.env.NEXT_PUBLIC_DB_PASS,
  port: 5432,
});

export const query = async (text: string, params: any[] = []) => {
  const client = await database.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
};
