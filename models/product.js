const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  buyerId: String,
  buyerName: String,
  buyDate: Date,
  rating: String,
  title: String,
  review: String
})

const productSchema = new mongoose.Schema({
  sellerId: String,
  sellerName: String,
  productImage: {
    url: String,
    deleteHash: String
  },
  name: String,
  brand: String,
  sizes: [Number],
  material: String,
  price: String,
  description: String,
  stock: Number,
  verified: Boolean,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sold: Number,
  reviews: [reviewSchema]
})

const Product = mongoose.model('Product', productSchema);

module.exports = Product;