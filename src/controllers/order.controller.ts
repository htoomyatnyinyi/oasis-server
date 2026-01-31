import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.ts";
import Stripe from "stripe";
import { sendOrderConfirmationEmail } from "../services/email.service.ts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create order
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { addressId, paymentMethod } = req.body;

  // Get user cart
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

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  // Get shipping address
  const address = await prisma.address.findUnique({
    where: { id: addressId },
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

  // Calculate total
  let totalAmount = 0;
  const orderItems = [];

  // Check stock and prepare order items
  for (const item of cart.items) {
    if (item.product.stock < item.quantity) {
      res.status(400);
      throw new Error(
        `Insufficient stock for ${item.product.name}. Only ${item.product.stock} available`,
      );
    }

    const itemTotal = Number(item.product.price) * item.quantity;
    totalAmount += itemTotal;

    orderItems.push({
      productName: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      productId: item.product.id,
    });
  }

  // Create order
  const order: any = await prisma.order.create({
    data: {
      user: { connect: { id: userId } },
      address: { connect: { id: addressId } },
      totalAmount,
      subtotal: totalAmount,
      taxAmount: 0,
      shippingAmount: 0,
      discountAmount: 0,
      shippingAddress: {
        street: address.street,
        city: address.city,
        state: (address as any).state,
        country: address.country,
        postalCode: address.postalCode,
      },
      items: {
        create: orderItems,
      },
    },
    include: {
      items: true,
      address: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Update product stock
  for (const item of cart.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        stock: {
          decrement: item.quantity,
        },
      },
    });
  }

  // Clear cart
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  // Create Stripe payment intent if payment method is card
  let paymentIntent = null;
  if (paymentMethod === "card") {
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        orderId: order.id,
        userId,
      },
    });
  }

  // Send confirmation email
  await sendOrderConfirmationEmail(
    (order as any).user.email,
    order as any,
    (order as any).user,
  );

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: {
      order,
      clientSecret: paymentIntent?.client_secret,
    },
  });
});

// Get user orders
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
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
        items: true,
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
});

// Get order by ID
export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    if (!id || id.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        address: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Check authorization (user or admin)
    const userRole = (req as any).user.role;
    if (order.userId !== userId && userRole !== "ADMIN") {
      res.status(403);
      throw new Error("Not authorized");
    }

    res.json({
      success: true,
      data: order,
    });
  },
);

// Update order status (Admin only)
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || id.trim() === "") {
      res.status(400);
      throw new Error("Product ID is required");
    }

    const validStatuses = [
      "PENDING",
      "PAID",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!validStatuses.includes(status)) {
      res.status(400);
      throw new Error("Invalid status");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Check if order can be cancelled
    if (status === "CANCELLED" && order.status !== "PENDING") {
      res.status(400);
      throw new Error("Only pending orders can be cancelled");
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    // If cancelled, restore product stock
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: id },
      });

      for (const item of orderItems) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }
    }

    res.json({
      success: true,
      message: "Order status updated",
      data: updatedOrder,
    });
  },
);

// Cancel order (User)
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  if (!id || id.trim() === "") {
    res.status(400);
    throw new Error("Product ID is required");
  }

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Verify order belongs to user
  if (order.userId !== userId) {
    res.status(403);
    throw new Error("Not authorized");
  }

  // Check if order can be cancelled
  if (order.status !== "PENDING") {
    res.status(400);
    throw new Error("Only pending orders can be cancelled");
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  // Restore product stock
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId: id },
  });

  for (const item of orderItems) {
    if (item.productId) {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    }
  }

  res.json({
    success: true,
    message: "Order cancelled",
    data: updatedOrder,
  });
});

// Create payment intent
export const createPaymentIntent = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (order.status !== "PENDING") {
      res.status(400);
      throw new Error("Order is not pending payment");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(order.totalAmount) * 100),
      currency: "usd",
      metadata: {
        orderId: order.id,
        userId: order.userId,
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        order,
      },
    });
  },
);

// Stripe webhook handler
export const stripeWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: any) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;

        if (!orderId || orderId.trim() === "") {
          res.status(400);
          throw new Error("Product ID is required");
        }

        // Update order status to PAID
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "PAID" },
        });
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        // Handle failed payment
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  },
);
