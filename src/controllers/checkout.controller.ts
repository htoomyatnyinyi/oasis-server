import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma";
import Stripe from "stripe";
import {
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
} from "../services/email.service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Calculate cart totals with taxes and shipping
export const calculateCheckoutTotals = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const {
      shippingMethodId,
      couponCode,
      shippingAddressId,
      useShippingAsBilling = true,
    } = req.body;

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
    let shippingAddress = null;
    if (shippingAddressId) {
      shippingAddress = await prisma.address.findUnique({
        where: { id: shippingAddressId },
      });

      if (!shippingAddress) {
        res.status(404);
        throw new Error("Shipping address not found");
      }

      if (shippingAddress.userId !== userId) {
        res.status(403);
        throw new Error("Not authorized to use this address");
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    let itemsTotal = 0;
    let taxableItems = [];

    for (const item of cart.items) {
      const itemTotal = Number(item.product.price) * item.quantity;
      itemsTotal += itemTotal;

      // Check stock
      if (item.product.stock < item.quantity) {
        res.status(400);
        throw new Error(
          `Insufficient stock for ${item.product.name}. Only ${item.product.stock} available`
        );
      }

      taxableItems.push({
        product: item.product,
        quantity: item.quantity,
        itemTotal,
      });
    }

    subtotal = itemsTotal;

    // Calculate tax (simplified - in real app, use tax API like TaxJar)
    let taxAmount = 0;
    if (shippingAddress) {
      // Example tax calculation based on location
      const taxRates: any = {
        CA: 0.0825, // 8.25% for California
        NY: 0.08875, // 8.875% for New York
        TX: 0.0625, // 6.25% for Texas
        // Add more states/countries
      };

      const state = shippingAddress.state;
      const taxRate = taxRates[state] || 0.07; // Default 7%
      taxAmount = subtotal * taxRate;
    }

    // Calculate shipping
    let shippingAmount = 0;
    let shippingMethod = null;
    let estimatedDelivery = null;

    if (shippingMethodId) {
      shippingMethod = await prisma.shippingMethod.findUnique({
        where: { id: shippingMethodId, isActive: true },
      });

      if (!shippingMethod) {
        res.status(404);
        throw new Error("Shipping method not found");
      }

      shippingAmount = Number(shippingMethod.price);

      // Calculate estimated delivery date
      const deliveryDate = new Date();
      deliveryDate.setDate(
        deliveryDate.getDate() + shippingMethod.deliveryDays
      );
      estimatedDelivery = deliveryDate;
    }

    // Apply coupon discount
    let discountAmount = 0;
    let coupon = null;

    if (couponCode) {
      coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });

      if (coupon) {
        // Check usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          res.status(400);
          throw new Error("Coupon usage limit reached");
        }

        // Check minimum purchase
        if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
          res.status(400);
          throw new Error(
            `Minimum purchase of $${coupon.minPurchase} required for this coupon`
          );
        }

        // Calculate discount
        if (coupon.discountType === "percentage") {
          discountAmount = subtotal * (Number(coupon.discountValue) / 100);

          // Apply max discount if set
          if (
            coupon.maxDiscount &&
            discountAmount > Number(coupon.maxDiscount)
          ) {
            discountAmount = Number(coupon.maxDiscount);
          }
        } else if (coupon.discountType === "fixed") {
          discountAmount = Number(coupon.discountValue);
        }
      }
    }

    // Calculate total
    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    // Get available shipping methods
    const shippingMethods = await prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });

    res.json({
      success: true,
      data: {
        items: cart.items,
        totals: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          taxAmount: parseFloat(taxAmount.toFixed(2)),
          shippingAmount: parseFloat(shippingAmount.toFixed(2)),
          discountAmount: parseFloat(discountAmount.toFixed(2)),
          totalAmount: parseFloat(totalAmount.toFixed(2)),
        },
        shippingAddress,
        billingAddress: useShippingAsBilling ? shippingAddress : null,
        shippingMethod,
        estimatedDelivery,
        coupon,
        availableShippingMethods: shippingMethods,
      },
    });
  }
);

// Validate coupon
export const validateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const { code } = req.body;
    const userId = (req as any).user.userId;

    if (!code) {
      res.status(400);
      throw new Error("Coupon code is required");
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        code,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    if (!coupon) {
      res.status(404);
      throw new Error("Invalid or expired coupon code");
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      res.status(400);
      throw new Error("Coupon usage limit reached");
    }

    // Check if user has already used this coupon
    const alreadyUsed = await prisma.orderCoupon.findFirst({
      where: {
        couponId: coupon.id,
        order: {
          userId: userId,
        },
      },
    });

    if (alreadyUsed) {
      res.status(400);
      throw new Error("You have already used this coupon");
    }

    res.json({
      success: true,
      message: "Coupon is valid",
      data: coupon,
    });
  }
);

// Create order (checkout)
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const {
    shippingAddressId,
    billingAddressId,
    shippingMethodId,
    paymentMethod,
    couponCode,
    notes,
    saveBillingAddress,
  } = req.body;

  // Step 1: Get user cart
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

  // Step 2: Get shipping address
  const shippingAddress = await prisma.address.findUnique({
    where: { id: shippingAddressId },
  });

  if (!shippingAddress) {
    res.status(404);
    throw new Error("Shipping address not found");
  }

  if (shippingAddress.userId !== userId) {
    res.status(403);
    throw new Error("Not authorized");
  }

  // Step 3: Get billing address
  let billingAddress = shippingAddress; // Default to shipping address
  if (billingAddressId && billingAddressId !== shippingAddressId) {
    billingAddress = await prisma.address.findUnique({
      where: { id: billingAddressId },
    });

    if (!billingAddress) {
      res.status(404);
      throw new Error("Billing address not found");
    }

    if (billingAddress.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }
  }

  // Step 4: Get shipping method
  const shippingMethod = await prisma.shippingMethod.findUnique({
    where: { id: shippingMethodId, isActive: true },
  });

  if (!shippingMethod) {
    res.status(404);
    throw new Error("Shipping method not found");
  }

  // Step 5: Calculate totals
  let subtotal = 0;
  const orderItems = [];

  for (const item of cart.items) {
    if (item.product.stock < item.quantity) {
      res.status(400);
      throw new Error(
        `Insufficient stock for ${item.product.name}. Only ${item.product.stock} available`
      );
    }

    const itemTotal = Number(item.product.price) * item.quantity;
    subtotal += itemTotal;

    orderItems.push({
      productName: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      productId: item.product.id,
    });
  }

  // Calculate tax (simplified)
  const taxRates: any = {
    CA: 0.0825,
    NY: 0.08875,
    TX: 0.0625,
  };
  const state = shippingAddress.state;
  const taxRate = taxRates[state] || 0.07;
  const taxAmount = subtotal * taxRate;
  const shippingAmount = Number(shippingMethod.price);

  // Apply coupon if provided
  let discountAmount = 0;
  let coupon = null;

  if (couponCode) {
    coupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    if (coupon) {
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        res.status(400);
        throw new Error("Coupon usage limit reached");
      }

      if (coupon.discountType === "percentage") {
        discountAmount = subtotal * (Number(coupon.discountValue) / 100);
        if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
          discountAmount = Number(coupon.maxDiscount);
        }
      } else if (coupon.discountType === "fixed") {
        discountAmount = Number(coupon.discountValue);
      }

      // Increment coupon usage
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }
  }

  const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

  // Step 6: Calculate estimated delivery
  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(
    estimatedDelivery.getDate() + shippingMethod.deliveryDays
  );

  // Step 7: Create order in database
  const order = await prisma.$transaction(async (tx) => {
    // Create order
    const newOrder = await tx.order.create({
      data: {
        userId,
        addressId: shippingAddressId,
        subtotal,
        taxAmount,
        shippingAmount,
        discountAmount,
        totalAmount,
        shippingMethod: shippingMethod.name,
        paymentMethod,
        estimatedDelivery,
        shippingAddress: {
          street: shippingAddress.street,
          city: shippingAddress.city,
          state: shippingAddress.state,
          country: shippingAddress.country,
          postalCode: shippingAddress.postalCode,
        },
        billingAddress:
          billingAddressId !== shippingAddressId
            ? {
                street: billingAddress.street,
                city: billingAddress.city,
                state: billingAddress.state,
                country: billingAddress.country,
                postalCode: billingAddress.postalCode,
              }
            : null,
        notes,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
        address: true,
      },
    });

    // Save billing address if requested
    if (saveBillingAddress && billingAddressId !== shippingAddressId) {
      await tx.address.create({
        data: {
          userId,
          street: billingAddress.street,
          city: billingAddress.city,
          state: billingAddress.state,
          country: billingAddress.country,
          postalCode: billingAddress.postalCode,
          isDefault: false,
        },
      });
    }

    // Save coupon usage
    if (coupon) {
      await tx.orderCoupon.create({
        data: {
          orderId: newOrder.id,
          couponId: coupon.id,
          discountAmount,
        },
      });
    }

    // Update product stock
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    // Clear cart
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return newOrder;
  });

  // Step 8: Create payment intent for card payments
  let paymentIntent = null;
  if (paymentMethod === "card") {
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        orderId: order.id,
        userId,
        email: (req as any).user.email,
      },
      description: `Order #${order.id}`,
      shipping: shippingAddress
        ? {
            address: {
              line1: shippingAddress.street,
              city: shippingAddress.city,
              state: shippingAddress.state,
              country: shippingAddress.country,
              postal_code: shippingAddress.postalCode,
            },
            name: `${shippingAddress.user.firstName} ${shippingAddress.user.lastName}`.trim(),
            phone: shippingAddress.user.phoneNumber,
          }
        : undefined,
    });

    // Update order with payment intent ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentIntentId: paymentIntent.id },
    });
  }

  // Step 9: Send confirmation email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (user) {
    await sendOrderConfirmationEmail(user.email, order, user);
  }

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: {
      order,
      clientSecret: paymentIntent?.client_secret,
      requiresPayment: paymentMethod === "card",
    },
  });
});

// Get available shipping methods
export const getShippingMethods = asyncHandler(
  async (req: Request, res: Response) => {
    const { addressId } = req.query;
    const userId = (req as any).user.userId;

    let address = null;
    if (addressId) {
      address = await prisma.address.findUnique({
        where: { id: addressId as string },
      });

      if (address && address.userId !== userId) {
        res.status(403);
        throw new Error("Not authorized");
      }
    }

    const shippingMethods = await prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });

    // Filter methods based on address (e.g., no overnight to certain countries)
    let filteredMethods = shippingMethods;
    if (address) {
      // Example: No express shipping to remote areas
      if (address.country === "Remote Country") {
        filteredMethods = shippingMethods.filter(
          (method) => method.name !== "Express"
        );
      }
    }

    res.json({
      success: true,
      data: filteredMethods,
    });
  }
);

// Get checkout summary
export const getCheckoutSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    const [cart, addresses, defaultShippingMethod] = await Promise.all([
      prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
      prisma.address.findMany({
        where: { userId },
        orderBy: { isDefault: "desc" },
      }),
      prisma.shippingMethod.findFirst({
        where: { isActive: true },
        orderBy: { price: "asc" },
      }),
    ]);

    if (!cart || cart.items.length === 0) {
      res.status(400);
      throw new Error("Cart is empty");
    }

    // Calculate subtotal
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
        addresses,
        defaultShippingMethod,
        estimatedTotals: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          shipping: defaultShippingMethod
            ? Number(defaultShippingMethod.price)
            : 0,
          tax: parseFloat((subtotal * 0.07).toFixed(2)), // Estimate tax
          total: 0, // Will be calculated with address
        },
      },
    });
  }
);

// Confirm payment
export const confirmPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId, paymentIntentId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      res.status(400);
      throw new Error("Payment not successful");
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        paymentStatus: "paid",
      },
    });

    res.json({
      success: true,
      message: "Payment confirmed successfully",
      data: updatedOrder,
    });
  }
);

// Get order by ID for checkout completion
export const getOrderDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
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
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (order.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    res.json({
      success: true,
      data: order,
    });
  }
);

// Cancel order during checkout
export const cancelCheckoutOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (order.userId !== userId) {
      res.status(403);
      throw new Error("Not authorized");
    }

    // Only allow cancellation of pending orders
    if (order.status !== "PENDING") {
      res.status(400);
      throw new Error("Only pending orders can be cancelled");
    }

    // Restore product stock
    for (const item of order.items) {
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

    // Update order status
    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        paymentStatus: "refunded", // If payment was made, handle refund via webhook
      },
    });

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });
  }
);
