const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  verified: Boolean,
  profileImage: {
    url: String,
    deleteHash: String
  },
  username: String,
  email: String,
  phoneNumber: String,
  password: String,
  shopName: String,
  city: String,
  closestStation: String,
  address: String,
  role: String
})

const Seller = mongoose.model('Seller', sellerSchema);

module.exports = Seller;