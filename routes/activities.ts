import express, { Request, Response } from "express";
import { query } from "../database";

const router = express.Router();

// API route to get activity logs for all users in the same club
router.get("/:clubId", async (req: Request, res: Response) => {
  const { clubId } = req.params;

  try {
    // Get all user_ids from the club
    const clubMembersResult = await query(
      `SELECT user_id FROM club_members WHERE club_id = $1`,
      [clubId]
    );

    // Extract user_ids from the result
    const userIds = clubMembersResult.map(
      (row: { user_id: string }) => row.user_id
    );

    // If there are no users in the club, return an empty response
    if (userIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Get activity logs for all users in the club
    const activityLogsResult = await query(
      `SELECT id, user_id, activity_type, reference_id, custom_text, timestamp
         FROM activity_logs
         WHERE user_id = ANY($1::varchar[])  -- Using the user_ids array
         ORDER BY timestamp DESC`,
      [userIds]
    );

    res.status(200).json(activityLogsResult);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

export default router;
