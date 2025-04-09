const Customer = require("../models/Customer");
const {
  validateCustomer,
  validateLogin,
  validateUpdate,
  validateAddress,
} = require("../validators/customerValidator");
const amqp = require("amqplib");

// Kết nối RabbitMQ
let channel;

async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue("customer_events", { durable: true });
  } catch (error) {
    console.error("Could not connect to RabbitMQ:", error);
  }
}

connectToRabbitMQ();

// Thông báo về sự kiện khách hàng
async function publishCustomerEvent(event, data) {
  try {
    if (channel) {
      channel.sendToQueue(
        "customer_events",
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

// Lấy tất cả khách hàng
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find();
    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy khách hàng theo ID
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }
    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đăng ký khách hàng mới
exports.registerCustomer = async (req, res) => {
  try {
    // Validate dữ liệu khách hàng
    const { error } = validateCustomer(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingCustomer = await Customer.findOne({ email: req.body.email });
    if (existingCustomer) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Tạo khách hàng mới
    const customer = new Customer(req.body);
    const savedCustomer = await customer.save();

    // Thông báo về khách hàng mới
    publishCustomerEvent("customer_registered", {
      customerId: savedCustomer._id,
      email: savedCustomer.email,
    });

    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đăng nhập
exports.loginCustomer = async (req, res) => {
  try {
    // Validate dữ liệu đăng nhập
    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Tìm khách hàng theo email
    const customer = await Customer.findOne({ email: req.body.email });
    if (!customer) {
      return res
        .status(404)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // Kiểm tra mật khẩu
    const validPassword = await customer.comparePassword(req.body.password);
    if (!validPassword) {
      return res
        .status(400)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    res.status(200).json({
      message: "Đăng nhập thành công",
      customer,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật thông tin khách hàng
exports.updateCustomer = async (req, res) => {
  try {
    // Validate dữ liệu cập nhật
    const { error } = validateUpdate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Kiểm tra email đã tồn tại chưa (nếu đang cập nhật email)
    if (req.body.email) {
      const existingCustomer = await Customer.findOne({
        email: req.body.email,
        _id: { $ne: req.params.id },
      });

      if (existingCustomer) {
        return res
          .status(400)
          .json({ message: "Email đã được sử dụng bởi khách hàng khác" });
      }
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Thông báo về cập nhật khách hàng
    publishCustomerEvent("customer_updated", {
      customerId: customer._id,
      email: customer.email,
    });

    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa khách hàng
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Thông báo về xóa khách hàng
    publishCustomerEvent("customer_deleted", {
      customerId: req.params.id,
      email: customer.email,
    });

    res.status(200).json({ message: "Khách hàng đã được xóa" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm địa chỉ mới
exports.addAddress = async (req, res) => {
  try {
    // Validate địa chỉ mới
    const { error } = validateAddress(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Nếu địa chỉ mới là mặc định, đặt tất cả các địa chỉ khác thành không mặc định
    if (req.body.isDefault) {
      customer.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    // Thêm địa chỉ mới
    customer.addresses.push(req.body);
    const updatedCustomer = await customer.save();

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật địa chỉ
exports.updateAddress = async (req, res) => {
  try {
    // Validate dữ liệu địa chỉ
    const { error } = validateAddress(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Tìm địa chỉ cần cập nhật
    const addressIndex = customer.addresses.findIndex(
      (addr) => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ" });
    }

    // Nếu địa chỉ mới là mặc định, đặt tất cả các địa chỉ khác thành không mặc định
    if (req.body.isDefault) {
      customer.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    // Cập nhật địa chỉ
    customer.addresses[addressIndex] = {
      ...customer.addresses[addressIndex].toObject(),
      ...req.body,
    };

    const updatedCustomer = await customer.save();

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa địa chỉ
exports.deleteAddress = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }

    // Tìm địa chỉ cần xóa
    const addressIndex = customer.addresses.findIndex(
      (addr) => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ message: "Không tìm thấy địa chỉ" });
    }

    // Xóa địa chỉ
    customer.addresses.splice(addressIndex, 1);
    const updatedCustomer = await customer.save();

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
