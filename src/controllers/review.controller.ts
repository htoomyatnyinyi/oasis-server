import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.ts";

// Get product reviews
export const getProductReviews = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    if (!productId || productId.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.review.count({ where: { productId } }),
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  }
);

// Create review
export const createReview = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { productId, rating, comment } = req.body;

    // Validate rating
    if (rating < 1 || rating > 5) {
      res.status(400);
      throw new Error("Rating must be between 1 and 5");
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    // Check if user has purchased the product
    const hasPurchased = await prisma.order.findFirst({
      where: {
        userId,
        items: {
          some: {
            productId,
          },
        },
        status: "DELIVERED",
      },
    });

    if (!hasPurchased) {
      res.status(400);
      throw new Error(
        "You must purchase and receive the product before reviewing"
      );
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        productId,
      },
    });

    if (existingReview) {
      res.status(400);
      throw new Error("You have already reviewed this product");
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: review,
    });
  }
);

// Update review
export const updateReview = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!id || id.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    // Find review
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      res.status(404);
      throw new Error("Review not found");
    }

    // Verify review belongs to user
    if (review.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Update review
    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  }
);

// Delete review
export const deleteReview = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    if (!id || id.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    // Find review
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      res.status(404);
      throw new Error("Review not found");
    }

    // Verify review belongs to user
    if (review.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Delete review
    await prisma.review.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  }
);
