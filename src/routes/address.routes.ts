import { Router } from "express";
import { body } from "express-validator";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/address.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// All address routes require authentication
router.use(authenticate);

// Get user addresses
router.get("/", getAddresses);

// Create address
router.post(
  "/",
  [
    body("street").notEmpty().withMessage("Street is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("postalCode").notEmpty().withMessage("Postal code is required"),
    body("state").optional().notEmpty(),
    body("isDefault").optional().isBoolean(),
  ],
  createAddress
);

// Update address
router.put(
  "/:id",
  [
    body("street").optional().notEmpty().withMessage("Street cannot be empty"),
    body("city").optional().notEmpty().withMessage("City cannot be empty"),
    body("country")
      .optional()
      .notEmpty()
      .withMessage("Country cannot be empty"),
    body("postalCode")
      .optional()
      .notEmpty()
      .withMessage("Postal code cannot be empty"),
    body("state").optional().notEmpty(),
    body("isDefault").optional().isBoolean(),
  ],
  updateAddress
);

// Delete address
router.delete("/:id", deleteAddress);

// Set default address
router.put("/:id/default", setDefaultAddress);

export default router;
