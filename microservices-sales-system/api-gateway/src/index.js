const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { createProxyMiddleware } = require("http-proxy-middleware");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const winston = require("winston");

// Load environment variables
dotenv.config();

// Configure logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút",
});
app.use(limiter);

// Routes
app.get("/", (req, res) => {
  res.send("API Gateway cho hệ thống quản lý bán hàng");
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "api-gateway" });
});

// Service proxies
// Product Service proxy
app.use(
  "/api/products",
  createProxyMiddleware({
    target: process.env.PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/products": "/api/products",
    },
    onError: (err, req, res) => {
      logger.error(`Product Service proxy error: ${err.message}`);
      res.status(500).json({ message: "Product Service không khả dụng" });
    },
  })
);

// Order Service proxy
app.use(
  "/api/orders",
  createProxyMiddleware({
    target: process.env.ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/orders": "/api/orders",
    },
    onError: (err, req, res) => {
      logger.error(`Order Service proxy error: ${err.message}`);
      res.status(500).json({ message: "Order Service không khả dụng" });
    },
  })
);

// Customer Service proxy
app.use(
  "/api/customers",
  createProxyMiddleware({
    target: process.env.CUSTOMER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/customers": "/api/customers",
    },
    onError: (err, req, res) => {
      logger.error(`Customer Service proxy error: ${err.message}`);
      res.status(500).json({ message: "Customer Service không khả dụng" });
    },
  })
);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ message: "Đã xảy ra lỗi" });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  console.log(`API Gateway running on port ${PORT}`);
});

module.exports = app;
