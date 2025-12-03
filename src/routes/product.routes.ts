import { Router } from "express";
import { body } from "express-validator";
import {
  getProducts,
  getProductById,
  getFeaturedProducts,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  searchProducts,
} from "../controllers/product.controller.ts";
import { authenticate, authorize } from "../middlewares/auth.middleware.ts";
import { uploadSingle } from "../middlewares/upload.middleware.ts";

const router = Router();

// Public routes
router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/categories", getCategories);
router.get("/search", searchProducts);
router.get("/:id", getProductById);
router.get("/:id/related", getRelatedProducts);

// Admin routes
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  uploadSingle("image"),
  [
    body("name").notEmpty().withMessage("Product name is required"),
    body("price")
      .isFloat({ gt: 0 })
      .withMessage("Price must be greater than 0"),
    body("stock")
      .isInt({ min: 0 })
      .withMessage("Stock must be a non-negative integer"),
  ],
  createProduct
);

router.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  uploadSingle("image"),
  updateProduct
);

router.delete("/:id", authenticate, authorize("ADMIN"), deleteProduct);

export default router;
