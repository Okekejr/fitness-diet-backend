import express, { Request, Response, NextFunction } from "express";
import { query } from "../database";

const router = express.Router();

interface FormField {
  id: string;
  value: string;
}

// Generate reset password token
router.post(
  "/user/password/reset/token",
  async (req: Request, res: Response) => {
    try {
      const { formFields } = req.body;
      console.log(formFields);

      const email = formFields.find(
        (field: FormField) => field.id === "email"
      )?.value;

      console.log(email);

      const response = await fetch(
        `${process.env.SUPERTOKENS_URI}/auth/user/password/reset/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formFields: [{ id: "email", value: email }] }),
        }
      );

      const data = await response.json();

      console.log(data);
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Error generating reset token:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Handle password reset
router.post("/user/password/reset", async (req: Request, res: Response) => {
  try {
    const { token, formFields } = req.body;

    console.log(token, formFields);

    const response = await fetch(
      `${process.env.SUPERTOKENS_URI}/auth/user/password/reset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "token", token, formFields }),
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/updateBiometric", async (req, res) => {
  const { userId, biometricEnabled } = req.body;

  if (typeof biometricEnabled !== "boolean" || !userId) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    await query(
      "UPDATE user_data SET biometric_enabled = $1 WHERE user_id = $2",
      [biometricEnabled, userId]
    );
    res.status(200).json({ message: "Biometric preference updated" });
  } catch (error) {
    console.error("Error updating biometric preference:", error);
    res.status(500).json({ error: "Failed to update preference" });
  }
});

router.get("/biometricPreference", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  try {
    const [result] = await query(
      "SELECT biometric_enabled FROM user_data WHERE user_id = $1",
      [userId]
    );

    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ biometricEnabled: result.biometric_enabled });
  } catch (error) {
    console.error("Error fetching biometric preference:", error);
    res.status(500).json({ error: "Failed to fetch preference" });
  }
});

export default router;
