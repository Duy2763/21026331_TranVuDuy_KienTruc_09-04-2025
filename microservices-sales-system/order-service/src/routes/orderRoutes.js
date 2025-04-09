const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// CRUD Routes
router.get("/", orderController.getAllOrders);
router.get("/:id", orderController.getOrderById);
router.post("/", orderController.createOrder);
router.put("/:id", orderController.updateOrder); // Không hỗ trợ, chỉ redirects sang update-status
router.delete("/:id", orderController.deleteOrder);

// Additional routes
router.get("/customer/:customerId", orderController.getOrdersByCustomer);
router.patch("/:id/update-status", orderController.updateOrderStatus);

module.exports = router;
