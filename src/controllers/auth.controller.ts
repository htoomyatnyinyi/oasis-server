import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.ts";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/email.service.ts";
import { validationResult } from "express-validator";
import dotenv from "dotenv";

dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (userId: string, role: string) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Generate Refresh Token
const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
  });
};

// Register User
export const register = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    throw new Error(errors.array()[0]?.msg);
  }

  const { email, password, username, firstName, lastName, phoneNumber } =
    req.body;
  console.log(req.body, 'at register');

  // Check if user exists
  const userExists = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists with this email or username");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      verified: false,
    },
  });

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.emailVerificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      expiresAt,
    },
  });

  // Send verification email
  await sendVerificationEmail(email, verificationToken);

  // Generate tokens
  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Set refresh token in cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // Create cart for user
  await prisma.cart.create({
    data: {
      userId: user.id,
    },
  });

  res.status(201).json({
    success: true,
    message: "Registration successful. Please verify your email.",
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      token,
    },
  });
});

// Login User
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log(email, password);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { cart: true },
  });

  if (!user || !user.password) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  // Check if user is verified
  if (!user.verified) {
    res.status(403);
    throw new Error("Please verify your email address");
  }

  // Generate tokens
  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Set refresh token in cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  res.json({
    success: true,
    message: "Login successful",
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      cart: user.cart,
      token,
    },
  });
});

// Google Authentication
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    res.status(400);
    throw new Error("Invalid Google token");
  }

  const { email, given_name, family_name, picture, sub: googleId } = payload;

  // Find or create user
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { googleId }],
    },
    include: { cart: true },
  });

  if (!user) {
    // Generate unique username
    const baseUsername = email.split("@")[0];
    let username = baseUsername;
    let counter = 1;

    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    user = await prisma.user.create({
      data: {
        email,
        username,
        googleId,
        firstName: given_name,
        lastName: family_name,
        avatarUrl: picture,
        verified: true,
      },
      include: { cart: true },
    });

    // Create cart for user
    await prisma.cart.create({
      data: {
        userId: user.id,
      },
    });
  } else if (!user.googleId) {
    // Link Google account to existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId },
      include: { cart: true },
    });
  }

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: "Google authentication successful",
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      cart: user.cart,
      token: accessToken,
    },
  });
});

// Verify Email
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  console.log(token, "verifyemail");
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken) {
    res.status(400);
    throw new Error("Invalid verification token");
  }

  if (verificationToken.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    });
    res.status(400);
    throw new Error("Verification token has expired");
  }

  // Update user verification status
  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { verified: true },
  });

  // Delete verification token
  await prisma.emailVerificationToken.delete({
    where: { id: verificationToken.id },
  });

  res.json({
    success: true,
    message: "Email verified successfully",
  });
});

// Forgot Password
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal that user doesn't exist for security
      res.json({
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link",
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Delete existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send reset email
    await sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: "Password reset link sent to your email",
    });
  }
);

// Reset Password
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, password } = req.body;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      res.status(400);
      throw new Error("Invalid reset token");
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      res.status(400);
      throw new Error("Reset token has expired");
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Delete reset token
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    res.json({
      success: true,
      message: "Password reset successful",
    });
  }
);

// Refresh Token
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401);
      throw new Error("No refresh token provided");
    }

    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET!
      ) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        res.status(401);
        throw new Error("User not found");
      }

      const newAccessToken = generateToken(user.id, user.role);
      const newRefreshToken = generateRefreshToken(user.id);

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: { token: newAccessToken },
      });
    } catch (error) {
      res.status(401);
      throw new Error("Invalid refresh token");
    }
  }
);

// Logout
export const logout = asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// Get Current User
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.userId },
      include: {
        cart: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        addresses: true,
      },
    });

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    // Remove sensitive data
    const { password, ...userData } = user;

    res.json({
      success: true,
      data: userData,
    });
  }
);
