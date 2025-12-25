import { Router } from "express";
import { body } from "express-validator";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";

const router = Router();

// All cart routes require authentication
router.use(authenticate);

router.get("/", getCart);
router.post(
  "/items",
  [
    body("productId").notEmpty().withMessage("Product ID is required"),
    body("quantity")
      .isInt({ min: 1 })
      .withMessage("Quantity must be at least 1"),
  ],
  addToCart
);
router.put("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", removeCartItem);
router.delete("/", clearCart);

export default router;
