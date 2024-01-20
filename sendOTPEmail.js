const bcrypt = require('bcrypt');
const UserOTPVerification = require('./models/otp');
const transporter = require('./transporter');

async function sendOTPEmail(user, res) {
  try {
    const otp = Math.floor(1000 + Math.random() * 9000);
    let userOTP = await UserOTPVerification.find({ userID: user._id });
    if (userOTP.length !== 0) {
      res.status(200).send({ exists: true, userId: user._id, email: user.email });
      return;
    }
    const mailOptions = {
      from: 'beltzy786@gmail.com',
      to: user.email,
      subject: 'Verify your Email',
      html: `<p>Enter ${otp} to complete your Sign in.</p>`
    };
    let hashedOtp = await bcrypt.hash(otp.toString(), 10);
    const newOTPVerification = new UserOTPVerification({
      userID: user._id,
      otp: hashedOtp,
      createdAt: Date.now()
    })
    newOTPVerification.save();
    await transporter.sendMail(mailOptions);
    res.status(200).send({ userId: user._id, email: user.email });
  }
  catch (err) {
    console.log(err);
  }
}

module.exports = sendOTPEmail;