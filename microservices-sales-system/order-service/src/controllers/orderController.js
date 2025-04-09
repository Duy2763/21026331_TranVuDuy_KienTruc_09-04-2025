const Order = require("../models/Order");
const { validateOrder } = require("../validators/orderValidator");
const axios = require("axios");
const amqp = require("amqplib");

// Kết nối RabbitMQ
let channel;

async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue("order_events", { durable: true });
  } catch (error) {
    console.error("Could not connect to RabbitMQ:", error);
  }
}

connectToRabbitMQ();

// Thông báo về sự kiện đơn hàng
async function publishOrderEvent(event, data) {
  try {
    if (channel) {
      channel.sendToQueue(
        "order_events",
        Buffer.from(
          JSON.stringify({
            event,
            data,
            timestamp: new Date(),
          })
        )
      );
    }
  } catch (error) {
    console.error("Error publishing to RabbitMQ:", error);
  }
}

// Kiểm tra tồn kho thông qua Product Service
async function checkProductStock(productId, quantity) {
  try {
    const response = await axios.post(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/check-stock`,
      { productId, quantity }
    );
    return response.data;
  } catch (error) {
    console.error("Error checking product stock:", error);
    throw new Error("Không thể kiểm tra tồn kho sản phẩm");
  }
}

// Cập nhật tồn kho thông qua Product Service
async function updateProductStock(productId, quantity, operation) {
  try {
    const response = await axios.post(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/update-stock`,
      { productId, quantity, operation }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating product stock:", error);
    throw new Error("Không thể cập nhật tồn kho sản phẩm");
  }
}

// Lấy thông tin khách hàng thông qua Customer Service
async function getCustomerDetails(customerId) {
  try {
    const response = await axios.get(
      `${process.env.CUSTOMER_SERVICE_URL}/api/customers/${customerId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching customer details:", error);
    throw new Error("Không thể lấy thông tin khách hàng");
  }
}

// Lấy thông tin sản phẩm thông qua Product Service
async function getProductDetails(productId) {
  try {
    const response = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching product details:", error);
    throw new Error("Không thể lấy thông tin sản phẩm");
  }
}

// Lấy tất cả đơn hàng
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy đơn hàng theo ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy đơn hàng theo khách hàng
exports.getOrdersByCustomer = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tạo đơn hàng mới
exports.createOrder = async (req, res) => {
  try {
    // Validate dữ liệu đơn hàng
    const { error } = validateOrder(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Kiểm tra khách hàng tồn tại
    try {
      await getCustomerDetails(req.body.customerId);
    } catch (err) {
      return res.status(400).json({ message: "Khách hàng không tồn tại" });
    }

    // Kiểm tra tồn kho cho từng sản phẩm
    for (const item of req.body.items) {
      const stockCheck = await checkProductStock(item.productId, item.quantity);
      if (!stockCheck.available) {
        return res.status(400).json({
          message: `Sản phẩm ${item.productName} không đủ tồn kho (hiện có: ${stockCheck.currentStock})`,
        });
      }
    }

    // Tạo đơn hàng mới
    const order = new Order(req.body);

    // Tính tổng tiền đơn hàng
    order.calculateTotalAmount();

    // Lưu đơn hàng
    const savedOrder = await order.save();

    // Cập nhật tồn kho
    for (const item of savedOrder.items) {
      await updateProductStock(item.productId, item.quantity, "decrease");
    }

    // Thông báo về đơn hàng mới
    publishOrderEvent("order_created", savedOrder);

    res.status(201).json(savedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật trạng thái đơn hàng
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (
      !["pending", "processing", "shipped", "delivered", "cancelled"].includes(
        status
      )
    ) {
      return res
        .status(400)
        .json({ message: "Trạng thái đơn hàng không hợp lệ" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra nếu đơn hàng bị hủy, cập nhật lại tồn kho
    if (status === "cancelled" && order.status !== "cancelled") {
      for (const item of order.items) {
        await updateProductStock(item.productId, item.quantity, "increase");
      }
    }

    order.status = status;
    const updatedOrder = await order.save();

    // Thông báo về cập nhật trạng thái đơn hàng
    publishOrderEvent("order_status_updated", {
      orderId: updatedOrder._id,
      newStatus: status,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật thông tin đơn hàng
exports.updateOrder = async (req, res) => {
  try {
    // Không cho phép cập nhật toàn bộ đơn hàng, chỉ cho phép cập nhật trạng thái
    res
      .status(405)
      .json({
        message:
          "Phương thức không được hỗ trợ. Sử dụng /update-status để cập nhật trạng thái đơn hàng",
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa đơn hàng (chỉ dùng cho mục đích quản trị)
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Nếu đơn hàng chưa bị hủy, cập nhật lại tồn kho
    if (order.status !== "cancelled") {
      for (const item of order.items) {
        await updateProductStock(item.productId, item.quantity, "increase");
      }
    }

    await Order.findByIdAndDelete(req.params.id);

    // Thông báo về xóa đơn hàng
    publishOrderEvent("order_deleted", { orderId: req.params.id });

    res.status(200).json({ message: "Đơn hàng đã được xóa" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
