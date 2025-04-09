const Product = require("../models/Product");
const amqp = require("amqplib");
const { validateProduct } = require("../validators/productValidator");

// Kết nối RabbitMQ
let channel;

async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue("product_updates", { durable: true });
  } catch (error) {
    console.error("Could not connect to RabbitMQ:", error);
  }
}

connectToRabbitMQ();

// Thông báo cập nhật tồn kho
async function publishStockUpdate(productId, newStock) {
  try {
    if (channel) {
      channel.sendToQueue(
        "product_updates",
        Buffer.from(
          JSON.stringify({
            event: "stock_updated",
            productId,
            newStock,
            timestamp: new Date(),
          })
        )
      );
    }
  } catch (error) {
    console.error("Error publishing to RabbitMQ:", error);
  }
}

// Lấy tất cả sản phẩm
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy một sản phẩm theo ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tạo sản phẩm mới
exports.createProduct = async (req, res) => {
  try {
    const { error } = validateProduct(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const product = new Product(req.body);
    const savedProduct = await product.save();

    // Thông báo về sản phẩm mới
    if (channel) {
      channel.sendToQueue(
        "product_updates",
        Buffer.from(
          JSON.stringify({
            event: "product_created",
            product: savedProduct,
            timestamp: new Date(),
          })
        )
      );
    }

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật sản phẩm
exports.updateProduct = async (req, res) => {
  try {
    const { error } = validateProduct(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    // Thông báo về cập nhật sản phẩm
    if (channel && req.body.stock !== undefined) {
      publishStockUpdate(product._id, product.stock);
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa sản phẩm
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    // Thông báo về xóa sản phẩm
    if (channel) {
      channel.sendToQueue(
        "product_updates",
        Buffer.from(
          JSON.stringify({
            event: "product_deleted",
            productId: req.params.id,
            timestamp: new Date(),
          })
        )
      );
    }

    res.status(200).json({ message: "Sản phẩm đã được xóa" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Kiểm tra tồn kho
exports.checkStock = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const isAvailable = product.stock >= quantity;
    res
      .status(200)
      .json({ available: isAvailable, currentStock: product.stock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật tồn kho (để sử dụng từ Order Service)
exports.updateStock = async (req, res) => {
  try {
    const { productId, quantity, operation } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    let newStock;
    if (operation === "decrease") {
      if (product.stock < quantity) {
        return res.status(400).json({ message: "Số lượng tồn kho không đủ" });
      }
      newStock = product.stock - quantity;
    } else if (operation === "increase") {
      newStock = product.stock + quantity;
    } else {
      return res.status(400).json({ message: "Thao tác không hợp lệ" });
    }

    product.stock = newStock;
    await product.save();

    // Thông báo cập nhật tồn kho
    publishStockUpdate(product._id, newStock);

    res.status(200).json({ message: "Đã cập nhật tồn kho", newStock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
