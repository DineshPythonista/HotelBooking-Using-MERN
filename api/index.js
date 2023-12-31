const express = require("express");
const app = express();
const cors = require("cors");
const User = require("./models/User.js");
const Place = require("./models/Place.js");
const Booking = require("./models/Booking.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const multer = require("multer");
const fs = require("fs");

const { default: mongoose, models } = require("mongoose");
const BookingModel = require("./models/Booking.js");
require("dotenv").config();
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "hsviat77igsbwqk378wiwgABWH";

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:5173",
  })
);

mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get("/test", (req, res) => {
  res.json("test ok");
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        {
          email: userDoc.email,
          id: userDoc._id,
          name: userDoc.name,
          role: userDoc.role,
        },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json(userDoc);
        }
      );
    } else {
      res.status(422).json("pass not ok");
    }
  } else {
    res.status(422).json("not found");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id, role } = await User.findById(userData.id);
      res.json({ name, email, _id, role });
    });
  } else {
    res.json(null);
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + newName,
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads/" });
app.post("/upload", photosMiddleware.array("photos", 100), (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace("uploads/", ""));
  }
  res.json(uploadedFiles);
});

app.post("/places", (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos: addedPhotos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    });
    res.json(placeDoc);
  });
});

app.get("/user-places", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put("/places", async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json("ok");
    }
  });
});

app.get("/places", async (req, res) => {
  res.json(await Place.find());
});

app.post("/bookings", async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const { place, checkIn, checkOut, numberOfGuests, name, phone, price } =
    req.body;
  Booking.create({
    place,
    checkIn,
    checkOut,
    numberOfGuests,
    name,
    phone,
    price,
    user: userData.id,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      throw err;
    });
});

app.get("/bookings", async (req, res) => {
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate("place"));
});

app.get("/hotelNames", async (req, res) => {
  const { name, from, to } = req.query; // Use req.query to get the 'name' parameter from the query string
  try {
    const data = await BookingModel.aggregate([
      {
        $lookup: {
          from: "places",
          localField: "place",
          foreignField: "_id",
          as: "placeInfo",
        },
      },
      {
        $unwind: "$placeInfo",
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "customerInfo",
        },
      },
      {
        $unwind: "$customerInfo",
      },
      {
        $match: {
          checkIn: {
            $gte: new Date(from),
          },
          checkOut: {
            $lte: new Date(to),
          },
        },
      },
      {
        $group: {
          _id: "$placeInfo._id",
          placeInfo: { $first: "$placeInfo" },
          totalRevenue: { $sum: "$price" },
        },
      },
      {
        $match: {
          totalRevenue: { $gt: 100000 },
        },
      },
      {
        $match: {
          "placeInfo.address": name, // Use single quotes for the field name
        },
      },
    ]);

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.get("/custNames", async (req, res) => {
  const { name, from, to } = req.query; // Use req.query to get the 'name' parameter from the query string
  const data = await BookingModel.aggregate([
    {
      $match: {
        checkIn: {
          $gte: new Date(from),
        },
        checkOut: {
          $lte: new Date(to),
        },
      },
    },
    {
      $lookup: {
        from: "places",
        localField: "place",
        foreignField: "_id",
        as: "placeInfo",
      },
    },
    {
      $unwind: "$placeInfo",
    },
    {
      $group: {
        _id: { place: "$place", user: "$user" },
        totalPrice: { $sum: "$price" },
        bookings: { $push: "$$ROOT" },
      },
    },
    {
      $match: {
        totalPrice: { $gt: 100000 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id.user",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    {
      $unwind: "$userInfo",
    },
    {
      $match: {
        "bookings.placeInfo.address": name, // Use single quotes for the field name
      },
    },

    {
      $project: {
        _id: 0, // Remove _id field
        place: "$_id.place",
        user: "$_id.user",
        totalPrice: 1,
        bookings: 1,
        userInfo: 1,
      },
    },
  ]);
  res.json(data);
});

app.get("/highlyValuedCust", async (req, res) => {
  const { from, to } = req.query; // Use req.query to get the 'name' parameter from the query string
  const data = await BookingModel.aggregate([
    {
      $match: {
        checkIn: {
          $gte: new Date(from),
          $lt: new Date(to),
        },
      },
    },
    {
      $group: {
        _id: "$user",
        totalBookingValue: { $sum: "$price" },
      },
    },
    {
      $sort: { totalBookingValue: -1 },
    },
    {
      $limit: 1,
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    {
      $unwind: "$userInfo",
    },
    {
      $project: {
        _id: 0,
        UserName: "$userInfo.name",
        UserEmail: "$userInfo.email",
        TotalBookingValue: "$totalBookingValue",
      },
    },
  ]);
  res.json(data);
});

app.get("/getAllPlaces", async (req, res) => {
  const data = await Place.aggregate([{ $project: { address: 1 } }]);
  res.json(data);
});

app.listen(4000);
