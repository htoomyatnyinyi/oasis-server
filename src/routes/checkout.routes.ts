import { Router } from "express";
import { body } from "express-validator";
import {
  calculateCheckoutTotals,
  validateCoupon,
  createOrder,
  getShippingMethods,
  getCheckoutSummary,
  confirmPayment,
  getOrderDetails,
  cancelCheckoutOrder,
} from "../controllers/checkout.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// All checkout routes require authentication
router.use(authenticate);

// Get checkout summary (cart, addresses, shipping methods)
router.get("/summary", getCheckoutSummary);

// Calculate totals with taxes and shipping
router.post(
  "/calculate-totals",
  [
    body("shippingAddressId").optional().isString(),
    body("shippingMethodId").optional().isString(),
    body("couponCode").optional().isString(),
    body("useShippingAsBilling").optional().isBoolean(),
  ],
  calculateCheckoutTotals
);

// Validate coupon
router.post(
  "/validate-coupon",
  [body("code").notEmpty().withMessage("Coupon code is required")],
  validateCoupon
);

// Get available shipping methods
router.get("/shipping-methods", getShippingMethods);

// Create order (complete checkout)
router.post(
  "/create-order",
  [
    body("shippingAddressId")
      .notEmpty()
      .withMessage("Shipping address is required"),
    body("shippingMethodId")
      .notEmpty()
      .withMessage("Shipping method is required"),
    body("paymentMethod")
      .isIn(["card", "paypal", "cod"])
      .withMessage("Invalid payment method"),
    body("billingAddressId").optional().isString(),
    body("couponCode").optional().isString(),
    body("notes").optional().isString(),
    body("saveBillingAddress").optional().isBoolean(),
  ],
  createOrder
);

// Confirm payment (for card payments)
router.post(
  "/confirm-payment",
  [
    body("orderId").notEmpty().withMessage("Order ID is required"),
    body("paymentIntentId")
      .notEmpty()
      .withMessage("Payment intent ID is required"),
  ],
  confirmPayment
);

// Get order details for checkout completion
router.get("/order/:id", getOrderDetails);

// Cancel order during checkout
router.post(
  "/cancel-order",
  [body("orderId").notEmpty().withMessage("Order ID is required")],
  cancelCheckoutOrder
);

export default router;
