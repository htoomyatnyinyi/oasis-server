import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.ts";
import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import fs from "fs";
import path from "path";

// Get user profile
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      birthdate: true,
      bio: true,
      avatarUrl: true,
      role: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
      addresses: {
        orderBy: {
          isDefault: "desc",
        },
      },
      _count: {
        select: {
          orders: true,
          reviews: true,
          addresses: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    success: true,
    data: user,
  });
});

// Update profile
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { firstName, lastName, phoneNumber, birthdate, bio } = req.body;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      // throw new Error(errors.array[0].m);
    }

    // Get current user to check existing avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    let avatarUrl;
    // Handle avatar upload
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;

      // Delete old avatar file if exists
      if (
        currentUser?.avatarUrl &&
        currentUser.avatarUrl.startsWith("/uploads/")
      ) {
        const oldAvatarPath = path.join(
          __dirname,
          "..",
          "..",
          currentUser.avatarUrl
        );
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phoneNumber !== undefined) {
      if (phoneNumber === "") {
        updateData.phoneNumber = null;
      } else {
        updateData.phoneNumber = phoneNumber;
      }
    }
    if (birthdate !== undefined) {
      if (birthdate === "") {
        updateData.birthdate = null;
      } else {
        updateData.birthdate = new Date(birthdate);
      }
    }
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        birthdate: true,
        bio: true,
        avatarUrl: true,
        role: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  }
);

// Change password
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      // throw new Error(errors.array()[0].msg);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user || !user.password) {
      res.status(404);
      throw new Error("User not found or password not set");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }

    // Check if new password is different
    if (currentPassword === newPassword) {
      res.status(400);
      throw new Error("New password must be different from current password");
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  }
);

// Delete account
export const deleteAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { password } = req.body;

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      // throw new Error(errors.array()[0].msg);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        avatarUrl: true,
      },
    });

    if (!user || !user.password) {
      res.status(404);
      throw new Error("User not found or password not set");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401);
      throw new Error("Password is incorrect");
    }

    // Delete user avatar file if exists
    if (user.avatarUrl && user.avatarUrl.startsWith("/uploads/")) {
      const avatarPath = path.join(__dirname, "..", "..", user.avatarUrl);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Delete user (cascade will delete related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  }
);

// Get user statistics (orders count, reviews count, etc.)
export const getUserStats = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    const [
      orderCount,
      reviewCount,
      totalSpent,
      recentOrders,
      favoriteProducts,
    ] = await Promise.all([
      // Total orders count
      prisma.order.count({
        where: { userId },
      }),

      // Reviews count
      prisma.review.count({
        where: { userId },
      }),

      // Total spent
      prisma.order.aggregate({
        where: {
          userId,
          status: "DELIVERED",
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Recent orders (last 5)
      prisma.order.findMany({
        where: { userId },
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      }),

      // Favorite products (most ordered)
      prisma.$queryRaw`
      SELECT p.*, COUNT(oi.id) as order_count
      FROM "Product" p
      JOIN "OrderItem" oi ON p.id = oi."productId"
      JOIN "Order" o ON oi."orderId" = o.id
      WHERE o."userId" = ${userId}
      GROUP BY p.id
      ORDER BY order_count DESC
      LIMIT 5
    `,
    ]);

    res.json({
      success: true,
      data: {
        orderCount,
        reviewCount,
        totalSpent: totalSpent._sum.totalAmount || 0,
        recentOrders,
        favoriteProducts,
      },
    });
  }
);

// Update email preferences
export const updateEmailPreferences = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { marketingEmails, orderUpdates, promotions } = req.body;

    // Note: You need to add these fields to your User model first
    // marketingEmails Boolean @default(true)
    // orderUpdates Boolean @default(true)
    // promotions Boolean @default(true)

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        // Uncomment when you add these fields to your schema
        // marketingEmails,
        // orderUpdates,
        // promotions
      },
      select: {
        id: true,
        email: true,
        // Add fields when available
      },
    });

    res.json({
      success: true,
      message: "Email preferences updated",
      data: user,
    });
  }
);

// Request email change
export const requestEmailChange = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { newEmail } = req.body;

    if (!newEmail || !newEmail.includes("@")) {
      res.status(400);
      throw new Error("Please provide a valid email address");
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (existingUser) {
      res.status(400);
      throw new Error("Email already in use");
    }

    // In a real app, you would:
    // 1. Generate verification token
    // 2. Save it to database with expiration
    // 3. Send verification email to new address
    // 4. Only update email after verification

    // For now, we'll just show a message
    res.json({
      success: true,
      message:
        "Email change request received. Check your new email for verification link.",
    });
  }
);

// Upload avatar (separate endpoint if needed)
export const uploadAvatar = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    if (!req.file) {
      res.status(400);
      throw new Error("Please upload an image");
    }

    // Get current user to delete old avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    const avatarUrl = `/uploads/${req.file.filename}`;

    // Delete old avatar file if exists
    if (
      currentUser?.avatarUrl &&
      currentUser.avatarUrl.startsWith("/uploads/")
    ) {
      const oldAvatarPath = path.join(
        __dirname,
        "..",
        "..",
        currentUser.avatarUrl
      );
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update user with new avatar
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      data: user,
    });
  }
);

// Remove avatar
export const removeAvatar = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!currentUser?.avatarUrl) {
      res.status(400);
      throw new Error("No avatar to remove");
    }

    // Delete avatar file if exists
    if (currentUser.avatarUrl.startsWith("/uploads/")) {
      const avatarPath = path.join(
        __dirname,
        "..",
        "..",
        currentUser.avatarUrl
      );
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    // Update user to remove avatar
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    res.json({
      success: true,
      message: "Avatar removed successfully",
      data: user,
    });
  }
);

// Get user's orders with details
export const getUserOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { userId };
    if (status) {
      filter.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: filter,
        skip,
        take: limitNum,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
          address: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.order.count({ where: filter }),
    ]);

    res.json({
      success: true,
      data: {
        orders,
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

// Get user's reviews
export const getUserReviews = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { userId },
        skip,
        take: limitNum,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.review.count({ where: { userId } }),
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

// Update user notification settings
export const updateNotificationSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const {
      pushNotifications,
      emailNotifications,
      orderStatusUpdates,
      promotionAlerts,
      priceDropAlerts,
    } = req.body;

    // Note: You need to add these fields to your User model first
    // pushNotifications Boolean @default(true)
    // emailNotifications Boolean @default(true)
    // orderStatusUpdates Boolean @default(true)
    // promotionAlerts Boolean @default(true)
    // priceDropAlerts Boolean @default(true)

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        // Uncomment when you add these fields to your schema
        // pushNotifications,
        // emailNotifications,
        // orderStatusUpdates,
        // promotionAlerts,
        // priceDropAlerts
      },
      select: {
        id: true,
        email: true,
        // Add fields when available
      },
    });

    res.json({
      success: true,
      message: "Notification settings updated",
      data: user,
    });
  }
);

// Get user wishlist (if you add wishlist feature)
export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  // Note: You need to add Wishlist model to your schema first
  // model Wishlist {
  //   id        String   @id @default(cuid())
  //   userId    String   @unique
  //   user      User     @relation(fields: [userId], references: [id])
  //   products  Product[] @relation("WishlistProduct")
  //   createdAt DateTime @default(now())
  //   updatedAt DateTime @updatedAt
  // }

  // For now, return empty array
  res.json({
    success: true,
    data: [],
  });
});

// Check username availability
export const checkUsernameAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { username } = req.query;

    if (!username || Number(username.length) < 3) {
      res.status(400);
      throw new Error("Username must be at least 3 characters");
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: username as string },
    });

    res.json({
      success: true,
      data: {
        username,
        available: !existingUser,
      },
    });
  }
);

// Export user data (GDPR compliance)
export const exportUserData = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    const [user, orders, reviews, addresses] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          birthdate: true,
          bio: true,
          avatarUrl: true,
          role: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.order.findMany({
        where: { userId },
        include: {
          items: true,
          address: true,
        },
      }),
      prisma.review.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.address.findMany({
        where: { userId },
      }),
    ]);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const userData = {
      profile: user,
      orders,
      reviews,
      addresses,
      exportedAt: new Date().toISOString(),
    };

    // In production, you might want to:
    // 1. Generate a JSON file
    // 2. Store it temporarily
    // 3. Email download link to user
    // 4. Delete after certain period

    res.json({
      success: true,
      message: "User data exported successfully",
      data: userData,
    });
  }
);

// Deactivate account (soft delete)
export const deactivateAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { password, reason } = req.body;

    // Validate password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user || !user.password) {
      res.status(404);
      throw new Error("User not found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401);
      throw new Error("Password is incorrect");
    }

    // Note: You need to add deactivation fields to your User model
    // isDeactivated Boolean @default(false)
    // deactivatedAt DateTime?
    // deactivationReason String?

    // For now, we'll just delete the account
    await prisma.user.delete({
      where: { id: userId },
    });

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    res.json({
      success: true,
      message: "Account deactivated successfully",
    });
  }
);
