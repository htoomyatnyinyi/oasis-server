import { Router } from "express";
import { body } from "express-validator";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  createPaymentIntent,
  stripeWebhook,
} from "../controllers/order.controller.ts";
import { authenticate, authorize } from "../middlewares/auth.middleware.ts";

const router = Router();

// Stripe webhook (no authentication needed)
router.post("/webhook", stripeWebhook);

// Protected routes
router.use(authenticate);

router.post(
  "/",
  [
    body("addressId").notEmpty().withMessage("Address ID is required"),
    body("paymentMethod").notEmpty().withMessage("Payment method is required"),
  ],
  createOrder,
);

router.post("/payment-intent", createPaymentIntent);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.post("/:id/cancel", cancelOrder);

// Admin routes
router.put(
  "/:id/status",
  authenticate,
  authorize("ADMIN"),
  [
    body("status")
      .isIn(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"])
      .withMessage("Invalid status"),
  ],
  updateOrderStatus,
);

export default router;
