import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.js";

// Get user's cart
export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  // Calculate total
  const total = cart.items.reduce((sum, item) => {
    return sum + Number(item.product.price) * item.quantity;
  }, 0);

  const cartWithTotal = {
    ...cart,
    total: parseFloat(total.toFixed(2)),
  };

  res.json({
    success: true,
    data: cartWithTotal,
  });
});

// Add item to cart
export const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { productId, quantity = 1 } = req.body;

  // Validate quantity
  if (quantity < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
  }

  // Check if product exists and has stock
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (product.stock < quantity) {
    res.status(400);
    throw new Error(`Only ${product.stock} items available in stock`);
  }

  // Get or create cart
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: true },
    });
  }

  // Check if item already exists in cart
  const existingItem = cart.items.find((item) => item.productId === productId);

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;

    // Check stock
    if (product.stock < newQuantity) {
      res.status(400);
      throw new Error(
        `Cannot add ${quantity} more items. Only ${
          product.stock - existingItem.quantity
        } available`
      );
    }

    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    // Add new item
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });
  }

  // Get updated cart
  const updatedCart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // Calculate total
  const total = updatedCart!.items.reduce((sum, item) => {
    return sum + Number(item.product.price) * item.quantity;
  }, 0);

  const cartWithTotal = {
    ...updatedCart,
    total: parseFloat(total.toFixed(2)),
  };

  res.json({
    success: true,
    message: "Item added to cart",
    data: cartWithTotal,
  });
});

// Update cart item quantity
export const updateCartItem = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!itemId || itemId.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    if (quantity < 1) {
      res.status(400);
      throw new Error("Quantity must be at least 1");
    }

    // Get cart item
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!cartItem) {
      res.status(404);
      throw new Error("Cart item not found");
    }

    // Verify cart belongs to user
    if (cartItem.cart.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Check stock
    if (cartItem.product.stock < quantity) {
      res.status(400);
      throw new Error(
        `Only ${cartItem.product.stock} items available in stock`
      );
    }

    // Update quantity
    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    // Get updated cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Calculate total
    const total = cart!.items.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    const cartWithTotal = {
      ...cart,
      total: parseFloat(total.toFixed(2)),
    };

    res.json({
      success: true,
      message: "Cart updated",
      data: cartWithTotal,
    });
  }
);

// Remove item from cart
export const removeCartItem = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { itemId } = req.params;

    if (!itemId || itemId.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    // Get cart item
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
      },
    });

    if (!cartItem) {
      res.status(404);
      throw new Error("Cart item not found");
    }

    // Verify cart belongs to user
    if (cartItem.cart.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Delete item
    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    res.json({
      success: true,
      message: "Item removed from cart",
    });
  }
);

// Clear cart
export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  // Get cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
  });

  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  // Delete all cart items
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  res.json({
    success: true,
    message: "Cart cleared",
  });
});
