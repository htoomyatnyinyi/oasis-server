// import { PrismaClient, Role } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import { Role } from "../src/generated/prisma/enums.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting database seed...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      username: "admin",
      password: adminPassword,
      firstName: "Admin",
      lastName: "User",
      role: Role.ADMIN,
      verified: true,
      cart: {
        create: {},
      },
    },
  });

  // Create regular user
  const userPassword = await bcrypt.hash("user123", 10);
  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      username: "user123",
      password: userPassword,
      firstName: "John",
      lastName: "Doe",
      role: Role.USER,
      verified: true,
      cart: {
        create: {},
      },
      addresses: {
        create: [
          {
            street: "123 Main St",
            city: "New York",
            state: "NY",
            country: "USA",
            postalCode: "10001",
            isDefault: true,
          },
        ],
      },
    },
  });

  // Create sample products
  const products = [
    {
      name: "iPhone 15 Pro",
      description: "Latest iPhone with A17 Pro chip",
      price: 999.99,
      stock: 50,
      imageUrl: "https://example.com/iphone.jpg",
    },
    {
      name: "Samsung Galaxy S23",
      description: "Flagship Android smartphone",
      price: 799.99,
      stock: 30,
      imageUrl: "https://example.com/galaxy.jpg",
    },
    {
      name: 'MacBook Pro 14"',
      description: "Apple laptop with M3 chip",
      price: 1999.99,
      stock: 20,
      imageUrl: "https://example.com/macbook.jpg",
    },
    {
      name: "Sony WH-1000XM5",
      description: "Wireless noise-canceling headphones",
      price: 349.99,
      stock: 100,
      imageUrl: "https://example.com/sony.jpg",
    },
    {
      name: "Nike Air Max 270",
      description: "Comfortable running shoes",
      price: 149.99,
      stock: 200,
      imageUrl: "https://example.com/nike.jpg",
    },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }

  console.log("✅ Database seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
