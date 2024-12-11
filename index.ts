import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import supertokens from "supertokens-node";
import { middleware, errorHandler } from "supertokens-node/framework/express";
import Session from "supertokens-node/recipe/session";
import Dashboard from "supertokens-node/recipe/dashboard";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import workoutRoutes from "./routes/workoutRoutes";
import favorites from "./routes/favorites";
import completedWorkoutRoutes from "./routes/completedWorkoutRoutes";
import recommendations from "./routes/recommendations";
import uploadRoute from "./routes/profilePicture";
import featuredWorkouts from "./routes/featuredWorkouts";
import userWorkouts from "./routes/userWorkouts";
import overview from "./routes/overviewRoutes";
import achievements from "./routes/achievements";
import runClubs from "./routes/clubRoutes";
import userDiet from "./routes/userDiet";
import customActivity from "./routes/customActivity";
import activities from "./routes/activities";

dotenv.config();

supertokens.init({
  framework: "express",
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_URI || "",
    apiKey: process.env.SUPERTOKENS_KEY || "",
  },
  appInfo: {
    appName: "saas_project",
    apiDomain: "http://localhost:4000",
    websiteDomain: "http://localhost:3000",
    apiBasePath: "/api/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init({
      emailDelivery: {
        override: (originalImplementation) => {
          return {
            ...originalImplementation,
            sendEmail: async function (input) {
              if (input.type === "PASSWORD_RESET") {
                // Adjust the reset password link to point to your app's resetPassword route
                const updatedResetLink = input.passwordResetLink.replace(
                  `http://localhost:3000/auth/reset-password`,
                  `http://${process.env.MACHINE_IP}3000/resetPassword`
                );

                console.log("Password reset link sent:", updatedResetLink);

                return originalImplementation.sendEmail({
                  ...input,
                  passwordResetLink: updatedResetLink,
                });
              }
              return originalImplementation.sendEmail(input);
            },
          };
        },
      },
    }),
    ThirdParty.init({
      signInAndUpFeature: {
        providers: [
          {
            config: {
              thirdPartyId: "github",
              clients: [
                {
                  clientId: "your-github-client-id",
                  clientSecret: "your-github-client-secret",
                },
              ],
            },
          },
          {
            config: {
              thirdPartyId: "apple",
              clients: [
                {
                  clientId: "4398792-io.supertokens.example.service",
                  additionalConfig: {
                    keyId: "7M48Y4RYDL",
                    privateKey:
                      "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgu8gXs+XYkqXD6Ala9Sf/iJXzhbwcoG5dMh1OonpdJUmgCgYIKoZIzj0DAQehRANCAASfrvlFbFCYqn3I2zeknYXLwtH30JuOKestDbSfZYxZNMqhF/OzdZFTV0zc5u5s3eN+oCWbnvl0hM+9IW0UlkdA\n-----END PRIVATE KEY-----",
                    teamId: "YWQCXGJRJL",
                  },
                },
              ],
            },
          },
        ],
      },
    }),
    Session.init(),
    Dashboard.init(),
  ],
});

const app: Application = express();
const port = process.env.PORT || 4000;

// CORS setup
app.use(
  cors({
    origin: "http://localhost:3000",
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    credentials: true,
  })
);

// Express middleware for SuperTokens
app.use(middleware());

app.use(express.json());

// Mounting modular routes
app.use("/api/auth", authRoutes);
app.use("/api/logs", activities);
app.use("/api/customActivity", customActivity);
app.use("/api/user", userWorkouts);
app.use("/api/userDiet", userDiet);
app.use("/api/clubs", runClubs);
app.use("/api/overview", overview);
app.use("/api/achievements", achievements);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/favorites", favorites);
app.use("/api/workouts", workoutRoutes);
app.use("/api/completedWorkouts", completedWorkoutRoutes);
app.use("/api/recommendation", recommendations);
app.use("/api", uploadRoute);
app.use("/api/featuredWorkouts", featuredWorkouts);

// SuperTokens error handling middleware
app.use(errorHandler());

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
