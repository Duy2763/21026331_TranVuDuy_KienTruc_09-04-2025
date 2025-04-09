const Joi = require("joi");

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  zipCode: Joi.string().required(),
  isDefault: Joi.boolean(),
});

exports.validateCustomer = (customer) => {
  const schema = Joi.object({
    firstName: Joi.string().required().trim(),
    lastName: Joi.string().required().trim(),
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().required(),
    addresses: Joi.array().items(addressSchema),
    dateOfBirth: Joi.date().iso(),
    createdAt: Joi.date(),
    updatedAt: Joi.date(),
  });

  return schema.validate(customer);
};

exports.validateAddress = (address) => {
  return addressSchema.validate(address);
};

exports.validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().trim().lowercase(),
    password: Joi.string().required(),
  });

  return schema.validate(data);
};

exports.validateUpdate = (customer) => {
  const schema = Joi.object({
    firstName: Joi.string().trim(),
    lastName: Joi.string().trim(),
    email: Joi.string().email().trim().lowercase(),
    phone: Joi.string(),
    dateOfBirth: Joi.date().iso(),
    addresses: Joi.array().items(addressSchema),
    updatedAt: Joi.date(),
  });

  return schema.validate(customer);
};
