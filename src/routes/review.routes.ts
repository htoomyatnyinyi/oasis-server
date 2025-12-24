import { Router } from "express";
import { body } from "express-validator";
import {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
} from "../controllers/review.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Public route - get product reviews
router.get("/product/:productId", getProductReviews);

// Protected routes
router.use(authenticate);

// Create review
router.post(
  "/",
  [
    body("productId").notEmpty().withMessage("Product ID is required"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Comment must be less than 1000 characters"),
  ],
  createReview
);

// Update review
router.put(
  "/:id",
  [
    body("rating")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Comment must be less than 1000 characters"),
  ],
  updateReview
);

// Delete review
router.delete("/:id", deleteReview);

export default router;
