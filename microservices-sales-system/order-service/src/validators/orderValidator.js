const Joi = require("joi");

exports.validateOrder = (order) => {
  const orderItemSchema = Joi.object({
    productId: Joi.string().required(),
    productName: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    price: Joi.number().min(0).required(),
  });

  const shippingAddressSchema = Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    zipCode: Joi.string().required(),
  });

  const schema = Joi.object({
    customerId: Joi.string().required(),
    items: Joi.array().items(orderItemSchema).min(1).required(),
    totalAmount: Joi.number().min(0),
    status: Joi.string().valid(
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled"
    ),
    shippingAddress: shippingAddressSchema.required(),
    paymentMethod: Joi.string()
      .valid("credit_card", "debit_card", "paypal", "cash")
      .required(),
    paymentStatus: Joi.string().valid(
      "pending",
      "completed",
      "failed",
      "refunded"
    ),
    createdAt: Joi.date(),
    updatedAt: Joi.date(),
  });

  return schema.validate(order);
};
