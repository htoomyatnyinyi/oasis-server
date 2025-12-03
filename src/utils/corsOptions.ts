// import { FRONTEND_URL } from "./secrets";

// // CORS Configuration
// // const corsOptions = {
// //   origin: FRONTEND_URL || "http://localhost:5173", // Replace with your frontend URL
// //   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
// //   credentials: true, // Allow cookies and authentication headers
// //   optionsSuccessStatus: 204, // For legacy browser support
// // };

// // export default corsOptions;

// // Dynamic origin based on allowed domains
// const allowedOrigins = [
//   "http://localhost:5173",
//   FRONTEND_URL,
//   "https://your-production-domain.com",
// ];

// const corsOptions = {
//   origin: (
//     origin: string | undefined,
//     callback: (err: Error | null, allow?: boolean) => void
//   ) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true,
//   optionsSuccessStatus: 204,
// };

// export default corsOptions;
