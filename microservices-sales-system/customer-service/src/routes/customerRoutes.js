const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// CRUD Routes
router.get("/", customerController.getAllCustomers);
router.get("/:id", customerController.getCustomerById);
router.post("/", customerController.registerCustomer);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);

// Authentication Routes
router.post("/login", customerController.loginCustomer);

// Address Management Routes
router.post("/:id/addresses", customerController.addAddress);
router.put("/:id/addresses/:addressId", customerController.updateAddress);
router.delete("/:id/addresses/:addressId", customerController.deleteAddress);

module.exports = router;
