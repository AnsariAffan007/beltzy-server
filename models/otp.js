const mongoose = require('mongoose')

const userOTPVerificationSchema = new mongoose.Schema({
  userID: String,
  otp: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 300 }
  }
}, { timestamps: true });

const UserOTPVerification = mongoose.model('UserOTPVerification', userOTPVerificationSchema)

module.exports = UserOTPVerification;