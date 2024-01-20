const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  username: String,
  email: String,
  phoneNumber: String,
  address: String,
  password: String,
  role: String
})

const Buyer = mongoose.model('Buyer', buyerSchema);

module.exports = Buyer;