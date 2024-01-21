const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Buyer = require('./models/buyer');
const Seller = require('./models/seller');
const Admin = require('./models/admin');
const Jwt = require('jsonwebtoken');
const verifyToken = require('./verifyToken');
const UserOTPVerification = require('./models/otp');
const sendOTPEmail = require('./sendOTPEmail');
const Product = require('./models/product');
const fileUpload = require('express-fileupload');
const imgur = require('imgur');
const imageUploader = require('./imageUploader');
const Order = require('./models/order');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(fileUpload())
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

mongoose.connect(process.env.MONGO_URI).then(() => {
    app.listen(5000, () => {
        console.log("Server tuned to port 5000");
    })
});

app.get('/best-selling', async (req, res) => {
    let bestSelling = await Product.find({ verified: true }).select('-createdAt -verified -__v').sort({ 'sold': -1 }).limit(4);
    res.send(bestSelling);
})

app.get('/products', async (req, res) => {
    let products = await Product.find({ verified: true }).select('-createdAt -verified -__v').sort({ 'sold': -1 });
    res.send(products);
})

app.post('/order', verifyToken('buyer'), async (req, res) => {
    let orders = {};
    let productIds = [];
    let cart = req.body;
    cart.forEach(cartProduct => {
        if (!(cartProduct.sellerId in orders)) {
            orders[cartProduct.sellerId] = {
                sellerId: cartProduct.sellerId,
                sellerName: cartProduct.sellerName,
                buyerId: req.buyer._id,
                buyerName: req.buyer.username,
                buyerNumber: req.buyer.phoneNumber,
                buyerAddress: req.buyer.address,
                products: [],
                totalAmount: 0,
                status: 0
            }
        }
        productIds.push(cartProduct.productId);
        orders[cartProduct.sellerId].products.push({
            productId: cartProduct.productId,
            productName: cartProduct.name,
            productImage: cartProduct.image,
            brand: cartProduct.brand,
            size: parseInt(cartProduct.size),
            price: cartProduct.price
        })
        orders[cartProduct.sellerId].totalAmount += parseInt(cartProduct.price);
    })
    try {
        const ordersArray = Object.values(orders).map(order => {
            return Order.create(order);
        })
        const savedOrders = await Promise.all(ordersArray);
    }
    catch (e) {
        res.send(e)
    }
    // Decrementing product stocks.
    await Product.updateMany(
        { _id: { $in: productIds } },
        { $inc: { stock: -1, sold: 1 } }
    )

    res.send({ success: true });
})

app.get('/seller-info/:name', async (req, res) => {
    const sellerDetails = await Seller.findOne({ username: req.params.name }).select('-_id -verified -profileImage -password -__v');
    res.send(sellerDetails);
})

app.post("/buyer-register", async (req, res) => {
    let foundUser = await Buyer.findOne({ username: req.body.username });
    if (foundUser) {
        res.status(400).send({ type: 'username', message: "Username already exists !" });
    }
    else {
        let buyer = new Buyer({
            username: req.body.username,
            email: req.body.email,
            phoneNumber: req.body.phone,
            address: req.body.address,
            password: await bcrypt.hash(req.body.password, 10)
        });
        await buyer.save();
        buyer.role = 'buyer';
        Jwt.sign({ buyer }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
            if (error) res.send(error);
            buyer.password = undefined;
            res.send({ buyer, token: token });
        })
    }
})

app.post("/buyer-login", async (req, res, next) => {

    let buyer = await Buyer.findOne({ username: req.body.username });
    if (!buyer) {
        res.status(401).send({ type: 'username', message: "Username doesn't exist" });
        return;
    }
    bcrypt.compare(req.body.password, buyer.password, function (err, response) {
        if (err) {
            res.status(500).send(err);
            return;
        }
        if (response) {
            buyer.role = 'buyer';
            Jwt.sign({ buyer }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
                if (error) {
                    res.send(error);
                }
                else {
                    buyer.password = undefined;
                    res.send({ buyer, token: token });
                    return;
                }
            })
        } else {
            res.status(401).send({ type: 'password', message: 'Incorrect Password' });
            return;
        }
    });
})

app.get('/buyer-orders', verifyToken('buyer'), async (req, res) => {
    const orders = await Order.find({ buyerId: req.buyer._id }).select('-sellerId');
    res.send(orders);
})

app.put('/confirm-delivery', verifyToken('buyer'), async (req, res) => {
    try {
        await Order.updateOne({ _id: req.body.id }, { $inc: { status: 1 } });
        res.send({ success: true });
    }
    catch (err) {
        res.send({ success: false, message: 'Error updating status' });
    }
})

app.post("/update-buyer", verifyToken('buyer'), async (req, res, next) => {
    let updatedBuyer = await Buyer.findOneAndUpdate({ username: req.body[0] }, req.body[1], { new: true });
    updatedBuyer.role = 'buyer';
    Jwt.sign({ buyer: updatedBuyer }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
        if (error) res.send(error);
        updatedBuyer.password = undefined;
        res.send({ buyer: updatedBuyer, token: token });
    })
})

app.post('/seller-register', async (req, res, next) => {
    let foundUser = await Seller.findOne({ username: req.body.username });
    if (foundUser) {
        res.status(409).send('A seller with this username already exists !');
    }
    else {
        let imageFile = req.files.sellerImage;
        const { imageUrl, hash } = await imageUploader(imageFile, res);

        let newSeller = new Seller({
            verified: false,
            profileImage: {
                url: imageUrl,
                deleteHash: hash
            },
            username: req.body.username,
            email: req.body.email,
            phoneNumber: req.body.phone,
            shopName: req.body.shopName,
            city: req.body.city,
            closestStation: req.body.station,
            address: req.body.address,
            password: await bcrypt.hash(req.body.password, 10)
        });
        let seller = await newSeller.save();
        seller.role = 'seller';
        Jwt.sign({ seller }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
            if (error) res.send(error);
            newSeller.password = undefined;
            res.send({ newSeller: seller, token: token });
        })

    }
})

app.post('/seller-login', async (req, res) => {
    let seller = await Seller.findOne({ username: req.body.username });
    if (!seller) {
        return res.status(401).send({ type: 'username', message: "Username doesn't exist !" });
    }
    if (req.body.email !== seller.email) return res.status(401).send({ type: 'email', message: "Email doesn't match with username !" });
    bcrypt.compare(req.body.password, seller.password, async (err, response) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (!response) {
            return res.status(401).send({ type: 'password', message: 'Incorrect Password' });
        } else {
            sendOTPEmail(seller, res);
        }
    });
})

app.post('/verify-otp', async (req, res, next) => {
    let userOTP = await UserOTPVerification.findOne({ userID: req.body.userId });
    if (!userOTP) {
        res.status(404).send("OTP Expired. Please Log In Again");
        return;
    }
    let seller = await Seller.findOne({ _id: req.body.userId });
    bcrypt.compare(req.body.otp.toString(), userOTP.otp, function (err, response) {
        if (err) {
            return res.status(500).send(err);
        }
        if (response) {
            seller.role = 'seller';
            Jwt.sign({ seller }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
                if (error) res.send(error);
                seller.password = undefined;
                return res.send({ seller, token: token });
            })
        } else {
            return res.status(401).send('Incorrect OTP');
        }
    });
})

app.post('/update-seller', verifyToken('seller'), async (req, res) => {
    let updatedSeller = await Seller.findOneAndUpdate({ username: req.body[0] }, req.body[1], { new: true }).lean();
    updatedSeller.role = 'seller';
    Jwt.sign({ seller: updatedSeller }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
        if (error) res.send(error);
        updatedSeller.password = undefined;
        res.send({ seller: { ...updatedSeller }, token: token });
    })
})

app.post('/update-seller-profile-pic', verifyToken('seller'), async (req, res) => {

    let seller = await Seller.findOne({ username: req.body.username });
    imgur.deleteImage(seller.profileImage.deleteHash)
        .catch(function (err) {
            res.status(500).send({ message: 'Error updating image. Please contact admin' });
        })

    let imageFile = req.files.sellerImage;
    const { imageUrl, hash } = await imageUploader(imageFile, res);

    if (!imageUrl) res.status(500).send({ message: "Couldn't update image. Try uploading a smaller size image" })

    let update = { profileImage: { url: imageUrl, deleteHash: hash } };
    let updatedSeller = await Seller.findOneAndUpdate({ username: req.body.username }, update, { new: true });
    res.send({ token: req.headers.authorization.split(' ')[1], updatedImage: updatedSeller.profileImage.url });
})

app.get('/get-products', verifyToken('seller'), async (req, res) => {
    let sellerProducts = await Product.find({ sellerId: req.seller._id }).select('-sellerId -sellerName -__v').sort({ createdAt: 1 }).exec();
    res.send(sellerProducts);
})

app.post('/upload-product', verifyToken('seller'), async (req, res) => {
    if (req.seller._id !== req.body.sellerId) {
        res.status(400).send({ message: 'Error in account validation. Please login again' })
    }
    else if (!req.seller.verified) res.status(403).send({ message: 'This account has not been verified by Admin' });
    else {
        const imageFile = req.files.productImage;
        const { imageUrl, hash } = await imageUploader(imageFile, res);

        const sizes = req.body.sizes.split(',').map(Number);

        let newProduct = new Product({
            verified: false,
            productImage: {
                url: imageUrl,
                deleteHash: hash
            },
            name: req.body.name,
            description: req.body.description,
            brand: req.body.brand,
            sellerId: req.seller._id,
            sellerName: req.seller.username,
            sizes: sizes,
            price: req.body.price,
            material: req.body.material,
            stock: parseInt(req.body.stock),
            sold: 0
        })
        let savedDoc = await newProduct.save();
        res.send({
            id: savedDoc._id,
            creationTime: savedDoc.createdAt,
            image: savedDoc.productImage.url,
            message: 'Successful'
        });
    }
})

app.delete('/delete-product/:id', verifyToken('seller'), async (req, res) => {
    if (req.seller._id !== req.body.sellerId) {
        res.status(400).send({ message: 'Error in account validation. Please login again' })
    }
    else if (!req.seller.verified) res.status(403).send({ message: 'This account has not been verified by Admin' });
    else {
        const productId = req.params.id;
        let result = await Product.findOneAndDelete({ _id: productId });
        res.send(result);
    }
})

app.put('/update-product/:id', verifyToken('seller'), async (req, res) => {
    if (req.seller._id !== req.body.sellerId) {
        res.status(400).send({ message: 'Error in account validation. Please login again' })
    }
    else if (!req.seller.verified) res.status(403).send({ message: 'This account has not been verified by Admin' });
    else {
        let update = req.body;
        delete update.productImage;

        if (req.files) {
            // req.body comes in multipart form data because of image. so sizes becomes string. so converting to int.
            const sizes = req.body.sizes.split(',').map(Number);
            update.sizes = sizes;

            let product = await Product.findOne({ _id: req.body._id });
            imgur.deleteImage(product.productImage.deleteHash)
                .catch(function (err) {
                    res.status(500).send({ message: 'Error updating image. Please contact admin' });
                });

            let imageFile = req.files.productImage;
            const { imageUrl, hash } = await imageUploader(imageFile, res);

            if (!imageUrl) res.status(500).send({ message: "Couldn't update image. Try uploading a smaller size image" })
            update.productImage = {
                url: imageUrl,
                deleteHash: hash
            }
        }
        const updatedProduct = await Product.findOneAndUpdate({ _id: req.body._id }, update, { new: true }).lean();
        if (updatedProduct) res.send(updatedProduct);
        else res.status(500).send({ message: 'Error updating Product' });
    }
})

app.get('/seller-orders', verifyToken('seller'), async (req, res) => {
    const orders = await Order.find({ sellerId: req.seller._id }).select('-sellerId -sellerName -__v');
    res.send(orders)
})

app.put('/update-status', verifyToken('seller'), async (req, res) => {
    try {
        await Order.updateOne({ _id: req.body.id }, { $inc: { status: 1 } });
        res.send({ success: true });
    }
    catch (err) {
        res.send({ success: false, message: 'Error updating status' });
    }
})

app.post('/admin-login', async (req, res) => {
    let admin = await Admin.findOne({ username: req.body.username });
    if (!admin) {
        return res.status(401).send({ type: 'username', message: "Username doesn't exist !" });
    }
    if (req.body.email !== admin.email) return res.status(401).send({ type: 'email', message: "Email doesn't match with username !" });
    bcrypt.compare(req.body.password, admin.password, async (err, response) => {
        if (err) {
            return res.status(500).send(err);
        }
        if (!response) {
            return res.status(401).send({ type: 'password', message: 'Incorrect Password' });
        } else {
            sendOTPEmail(admin, res);
        }
    });
})

app.post('/verify-admin-otp', async (req, res) => {
    let userOTP = await UserOTPVerification.findOne({ userID: req.body.userId });
    if (!userOTP) {
        res.status(404).send("OTP Expired. Please Log In Again");
        return;
    }
    let admin = await Admin.findOne({ _id: req.body.userId });
    bcrypt.compare(req.body.otp.toString(), userOTP.otp, function (err, response) {
        if (err) {
            return res.status(500).send(err);
        }
        if (response) {
            admin.role = 'admin';
            Jwt.sign({ admin }, process.env.JWT_KEY, { expiresIn: '2h' }, (error, token) => {
                if (error) res.send(error);
                admin.password = undefined;
                return res.send({ admin, token: token });
            })
        } else {
            return res.status(401).send('Incorrect OTP');
        }
    });
})

app.get('/get-sellers', verifyToken('admin'), async (req, res) => {
    let sellers = await Seller.find();
    res.send({ valid: true, sellers: sellers })
})

app.put('/verify-seller/:id', verifyToken('admin'), async (req, res) => {
    let updatedSeller = await Seller.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });
    if (!req.body.verified) {
        let updatedProducts = await Product.updateMany({ sellerId: req.params.id }, { verified: false }, { new: true });
    }
    res.send({ valid: true })
})

app.get('/get-seller-products/:id', verifyToken('admin'), async (req, res) => {
    let products = await Product.find({ sellerId: req.params.id }).sort({ createdAt: 1 }).exec();
    res.send(products);
})

app.put('/verify-product/:id', verifyToken('admin'), async (req, res) => {
    let seller = await Seller.findById(req.body.sellerId);
    if (!seller.verified) res.send({ valid: false, message: 'Verify this seller first!' });
    else {
        let updatedProduct = await Product.findOneAndUpdate({ _id: req.params.id }, { verified: req.body.verified }, { new: true });
        res.send({ valid: true });
    }
})
