import { Router } from "express";
import { body, query } from "express-validator";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getUserStats,
  updateEmailPreferences,
  requestEmailChange,
  uploadAvatar,
  removeAvatar,
  getUserOrders,
  getUserReviews,
  updateNotificationSettings,
  getWishlist,
  checkUsernameAvailability,
  exportUserData,
  deactivateAccount,
} from "../controllers/user.controller.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";
import { uploadSingle } from "../middlewares/upload.middleware.ts";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Profile routes
router.get("/profile", getProfile);
router.get("/stats", getUserStats);

// Update profile
router.put(
  "/profile",
  uploadSingle("avatar"),
  [
    body("firstName")
      .optional()
      .notEmpty()
      .withMessage("First name cannot be empty"),
    body("lastName")
      .optional()
      .notEmpty()
      .withMessage("Last name cannot be empty"),
    body("phoneNumber")
      .optional()
      .isMobilePhone("any")
      .withMessage("Invalid phone number"),
    body("birthdate")
      .optional()
      .isISO8601()
      .withMessage("Invalid birthdate format"),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Bio must be less than 500 characters"),
  ],
  updateProfile
);

// Avatar management
router.post("/avatar", uploadSingle("avatar"), uploadAvatar);
router.delete("/avatar", removeAvatar);

// Password management
router.put(
  "/change-password",
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters")
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error(
            "New password must be different from current password"
          );
        }
        return true;
      }),
  ],
  changePassword
);

// Email management
router.put(
  "/email-preferences",
  [
    body("marketingEmails").optional().isBoolean(),
    body("orderUpdates").optional().isBoolean(),
    body("promotions").optional().isBoolean(),
  ],
  updateEmailPreferences
);

router.post(
  "/request-email-change",
  [body("newEmail").isEmail().withMessage("Please provide a valid email")],
  requestEmailChange
);

// Notification settings
router.put(
  "/notifications",
  [
    body("pushNotifications").optional().isBoolean(),
    body("emailNotifications").optional().isBoolean(),
    body("orderStatusUpdates").optional().isBoolean(),
    body("promotionAlerts").optional().isBoolean(),
    body("priceDropAlerts").optional().isBoolean(),
  ],
  updateNotificationSettings
);

// User content
router.get("/orders", getUserOrders);
router.get("/reviews", getUserReviews);
router.get("/wishlist", getWishlist);

// Account management
router.delete(
  "/account",
  [
    body("password")
      .notEmpty()
      .withMessage("Password is required for account deletion"),
  ],
  deleteAccount
);

router.post(
  "/deactivate",
  [
    body("password").notEmpty().withMessage("Password is required"),
    body("reason").optional().isLength({ max: 500 }),
  ],
  deactivateAccount
);

// Data export
router.get("/export-data", exportUserData);

// Utilities
router.get(
  "/check-username",
  [
    query("username")
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters"),
  ],
  checkUsernameAvailability
);

export default router;
