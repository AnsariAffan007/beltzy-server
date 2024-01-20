const mongoose = require('mongoose');

const productOrderSchema = new mongoose.Schema({
  productId: String,
  productName: String,
  productImage: String,
  brand: String,
  size: Number,
  price: String,
})

const orderSchema = new mongoose.Schema({
  sellerId: String,
  sellerName: String,
  buyerId: String,
  buyerName: String,
  buyerNumber: String,
  buyerAddress: String,
  products: [productOrderSchema],
  totalAmount: Number,
  status: Number
}, { timestamps: true })

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;