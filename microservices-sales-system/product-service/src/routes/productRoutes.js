const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// CRUD Routes
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.post("/", productController.createProduct);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

// Inventory Management Routes
router.post("/check-stock", productController.checkStock);
router.post("/update-stock", productController.updateStock);

module.exports = router;
