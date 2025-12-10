import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.js";

// Get user addresses
export const getAddresses = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: {
        isDefault: "desc",
      },
    });

    res.json({
      success: true,
      data: addresses,
    });
  }
);

// Create address
export const createAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const {
      street,
      city,
      state,
      country,
      postalCode,
      isDefault = false,
    } = req.body;

    // If setting as default, update other addresses
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        street,
        city,
        state,
        country,
        postalCode,
        isDefault,
      },
    });

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: address,
    });
  }
);

// Update address
export const updateAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const updateData = req.body;

    // Find address
    const address = await prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      res.status(404);
      throw new Error("Address not found");
    }

    // Verify address belongs to user
    if (address.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // If setting as default, update other addresses
    if (updateData.isDefault) {
      await prisma.address.updateMany({
        where: { userId, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: "Address updated successfully",
      data: updatedAddress,
    });
  }
);

// Delete address
export const deleteAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    // Find address
    const address = await prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      res.status(404);
      throw new Error("Address not found");
    }

    // Verify address belongs to user
    if (address.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Check if address is used in any orders
    const orderCount = await prisma.order.count({
      where: { addressId: id },
    });

    if (orderCount > 0) {
      res.status(400);
      throw new Error("Cannot delete address that is used in orders");
    }

    // Delete address
    await prisma.address.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  }
);

// Set default address
export const setDefaultAddress = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    // Find address
    const address = await prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      res.status(404);
      throw new Error("Address not found");
    }

    // Verify address belongs to user
    if (address.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Update all addresses to not default
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    // Set this address as default
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({
      success: true,
      message: "Default address updated",
      data: updatedAddress,
    });
  }
);
