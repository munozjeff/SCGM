import { db } from "../firebase";
import { ref, push, get, query, orderByChild, startAt, endAt } from "firebase/database";

/**
 * Logs a user action to the database.
 * Structure: user_activity_logs/{userId}/{year_month}/{pushId}
 * 
 * @param {string} userId - The UID of the user performing the action.
 * @param {string} userEmail - The email of the user (for easier reading).
 * @param {string} action - Short code for the action (e.g., 'UPDATE_SIM', 'IMPORT_SALES').
 * @param {string} details - Human readable details (e.g., 'Updated 5 records').
 * @param {object} metadata - Optional additional data.
 */
export const logUserAction = async (userId, userEmail, action, details, metadata = {}) => {
    if (!userId) return;

    try {
        const now = new Date();
        const dateStr = now.toISOString(); // Full timestamp
        const yearMonth = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY_MM

        const logEntry = {
            timestamp: dateStr,
            userEmail,
            action,
            details,
            ...metadata
        };

        // Store logs grouped by User and Month for easier retrieval/archiving
        const logsRef = ref(db, `user_activity_logs/${userId}/${yearMonth}`);
        await push(logsRef, logEntry);

    } catch (error) {
        console.error("Failed to log user action:", error);
        // Do not throw, logging failure should not block the main action
    }
};

/**
 * Retrieves activity logs for a specific user and month.
 * @param {string} userId 
 * @param {string} monthStr - Format "YYYY_MM" (e.g., "2024_05")
 */
export const getUserActivity = async (userId, monthStr) => {
    try {
        const logsRef = ref(db, `user_activity_logs/${userId}/${monthStr}`);
        const snapshot = await get(logsRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert to array and sort by timestamp desc
            return Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        return [];
    } catch (error) {
        console.error("Error fetching user activity:", error);
        return [];
    }
};

/**
 * Retrieves ALL activity logs from the database.
 * Note: This fetches the entire `user_activity_logs` node. 
 * For a production app with huge data, this should be optimized 
 * (e.g., restricted by month at the root level or using Cloud Functions).
 */
export const getAllUsersActivity = async () => {
    try {
        const logsRef = ref(db, 'user_activity_logs');
        const snapshot = await get(logsRef);

        if (snapshot.exists()) {
            return snapshot.val();
        }
        return {};
    } catch (error) {
        console.error("Error fetching all user activity:", error);
        return {};
    }
};
