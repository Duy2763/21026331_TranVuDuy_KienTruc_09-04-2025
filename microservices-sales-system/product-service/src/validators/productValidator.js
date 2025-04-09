const Joi = require("joi");

exports.validateProduct = (product) => {
  const schema = Joi.object({
    name: Joi.string().required().trim(),
    description: Joi.string().required(),
    price: Joi.number().min(0).required(),
    stock: Joi.number().min(0),
    category: Joi.string().required(),
    imageUrl: Joi.string().allow(""),
    createdAt: Joi.date(),
    updatedAt: Joi.date(),
  });

  return schema.validate(product);
};
