import express from "express";
import type { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import path from "path";
import dotenv from "dotenv";

// Routes
import authRoutes from "./routes/auth.routes.ts";
import productRoutes from "./routes/product.routes.ts";
// import cartRoutes from "./routes/cart.routes";
// import orderRoutes from "./routes/order.routes";
// import userRoutes from "./routes/user.routes";
// import reviewRoutes from "./routes/review.routes";
// import addressRoutes from "./routes/address.routes";

// // Middlewares
import errorHandler from "./middlewares/error.middleware.ts";

dotenv.config();

const app: Application = express();

// Security middleware
app.use(helmet());
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL,
//     credentials: true,
//   })
// );

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// // Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api", limiter);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
// app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/reviews", reviewRoutes);
// app.use("/api/addresses", addressRoutes);

// // 404 handler
// app.use("*", (req: Request, res: Response) => {
//   res.status(404).json({
//     success: false,
//     message: `Route ${req.originalUrl} not found`,
//   });
// });

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 8090;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});

export default app;
