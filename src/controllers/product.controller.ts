import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import prisma from "../config/prisma.ts";
import { validationResult } from "express-validator";

// Get all products with pagination and filters
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    category,
    search,
    sort = "createdAt",
    order = "desc",
    minPrice,
    maxPrice,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Build filter
  const filter: any = {};

  if (category) {
    // If you add category field to Product model
    // filter.category = category
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.gte = parseFloat(minPrice as string);
    if (maxPrice) filter.price.lte = parseFloat(maxPrice as string);
  }

  if (search) {
    filter.OR = [
      { name: { contains: search as string, mode: "insensitive" } },
      { description: { contains: search as string, mode: "insensitive" } },
    ];
  }

  // Build sort
  const orderBy: any = {};
  orderBy[sort as string] = order === "asc" ? "asc" : "desc";

  // Get products with reviews and average rating
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: filter,
      skip,
      take: limitNum,
      orderBy,
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    }),
    prisma.product.count({ where: filter }),
  ]);

  // Calculate average rating for each product
  const productsWithRating = products.map((product) => {
    const totalRating = product.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    const averageRating =
      product.reviews.length > 0 ? totalRating / product.reviews.length : 0;

    return {
      ...product,
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: product._count.reviews,
    };
  });

  res.json({
    success: true,
    data: {
      products: productsWithRating,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// Get single product
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        reviews: {
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
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    // Calculate average rating
    const totalRating = product.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    const averageRating =
      product.reviews.length > 0 ? totalRating / product.reviews.length : 0;

    const productWithRating = {
      ...product,
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: product._count.reviews,
    };

    res.json({
      success: true,
      data: productWithRating,
    });
  }
);

// Get featured products
export const getFeaturedProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { limit = 8 } = req.query;
    const limitNum = parseInt(limit as string);

    // Get products with highest average rating
    const products = await prisma.$queryRaw`
    SELECT 
      p.*,
      COALESCE(AVG(r.rating), 0) as average_rating,
      COUNT(r.id) as review_count
    FROM "Product" p
    LEFT JOIN "Review" r ON p.id = r."productId"
    WHERE p.stock > 0
    GROUP BY p.id
    ORDER BY average_rating DESC, review_count DESC
    LIMIT ${limitNum}
  `;

    res.json({
      success: true,
      data: products,
    });
  }
);

// Get related products
export const getRelatedProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 4 } = req.query;
    const limitNum = parseInt(limit as string);

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        // If you have category field, use it for related products
        // category: true
      },
    });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    // For now, get random products excluding current one
    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: id },
        stock: { gt: 0 },
      },
      take: limitNum,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Calculate average rating
    const productsWithRating = relatedProducts.map((p) => {
      const totalRating = p.reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating =
        p.reviews.length > 0 ? totalRating / p.reviews.length : 0;

      return {
        ...p,
        averageRating: parseFloat(averageRating.toFixed(1)),
      };
    });

    res.json({
      success: true,
      data: productsWithRating,
    });
  }
);

// Create product (Admin only)
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array()[0].msg);
    }

    const { name, description, price, stock, category } = req.body;

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        imageUrl,
        // Add category field if needed
      },
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  }
);

// Update product (Admin only)
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      res.status(404);
      throw new Error("Product not found");
    }

    // Handle image upload
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Convert numeric fields
    if (updateData.price) {
      updateData.price = parseFloat(updateData.price);
    }
    if (updateData.stock) {
      updateData.stock = parseInt(updateData.stock);
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  }
);

// Delete product (Admin only)
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    // Check if product is in any orders
    const orderItems = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItems > 0) {
      res.status(400);
      throw new Error("Cannot delete product that has been ordered");
    }

    await prisma.product.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

// Get product categories
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    // If you add category field to Product model:
    // const categories = await prisma.product.groupBy({
    //   by: ['category'],
    //   where: { category: { not: null } },
    //   _count: true
    // })

    // For now, return empty array or mock data
    const categories = [
      "Electronics",
      "Fashion",
      "Home & Garden",
      "Sports",
      "Books",
      "Toys",
    ];

    res.json({
      success: true,
      data: categories,
    });
  }
);

// Search products
export const searchProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.toString().trim() === "") {
      return res.json({
        success: true,
        data: [],
      });
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query as string, mode: "insensitive" } },
          { description: { contains: query as string, mode: "insensitive" } },
        ],
        stock: { gt: 0 },
      },
      take: parseInt(limit as string),
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Calculate average rating
    const productsWithRating = products.map((product) => {
      const totalRating = product.reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating =
        product.reviews.length > 0 ? totalRating / product.reviews.length : 0;

      return {
        ...product,
        averageRating: parseFloat(averageRating.toFixed(1)),
      };
    });

    res.json({
      success: true,
      data: productsWithRating,
    });
  }
);
