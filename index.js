const express = require("express");
const app = express();

const dotenv = require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();

client
  .connect(() => {
    console.log("connected to MongoDB!");
  })
  .catch(console.dir);

const db = client.db("FableEbookDB");
const EbookCollection = db.collection("Ebooks");
const bookBuyCollection = db.collection("bookBuyCollections");
const paymentCollection = db.collection("paymentCollections");
const usersCollection = db.collection("user");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    //
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res
      .status(403)
      .json({ message: "Forbidden: Invalid or expired token" });
  }
};

const requireWriter = (req, res, next) => {
  if (req.user?.role !== "writer" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Writers only" });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }
  next();
};

const requireReader = (req, res, next) => {
if (!req.user || req.user.role === "writer" || req.user.role === "admin") {
    return res.status(403).json({
      message: "Action denied: Admins and Writers cannot purchase books.",
    });
  }
  next();
};

const verifyReader = (req, res, next) => {
  if (!req.user || req.user.role !== "reader") { 
    return res.status(403).json({ message: "Forbidden: Readers only" });
  }
  next();
};

const requireWriterOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "writer" && req.user.role !== "admin")) {
    return res.status(403).json({
      message: "Forbidden: Only writers and admins can perform this action.",
    });
  }
  next();
};

// addbook form api
app.post("/api/ebooks", verifyToken, requireWriter, async (req, res) => {
  const Ebook = req.body;

  const result = await EbookCollection.insertOne(Ebook);

  res.json(result);
  console.log(result);
});

// //writer book data loadapi
// app.get("/api/ebooks/writer/:email", async (req, res) => {

//   const { email } = req.params;
//   const result = await EbookCollection.find({ writerEmail: email }).toArray();
//   res.json(result);
// });

app.get("/api/ebooks", async (req, res) => {
  const query = {};

  if (req.query.writerEmail) {
    query.writerEmail = req.query.writerEmail;
  }

  if (req.query.writerId) query.writerId = req.query.writerId;
  if (req.query.status) query.status = req.query.status;
  const result = await EbookCollection.find(query).toArray();
  res.json(result);
});

//  to see Writer own manage ebook list
app.get("/api/ebooks/manage", verifyToken, requireWriter, async (req, res) => {
  try {
    const query = {};

    if (req.user.role === "admin") {
      if (req.query.writerEmail) query.writerEmail = req.query.writerEmail;
    } else {
      if (req.query.writerEmail && req.query.writerEmail !== req.user.email) {
        return res.status(403).json({ message: "Forbidden access" });
      }
      query.writerEmail = req.user.email;
    }

    const result = await EbookCollection.find(query).toArray();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching ebooks (manage):", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

app.get("/api/ebooks/:id", async (req, res) => {
  const { id } = req.params;
  const query = {
    _id: new ObjectId(id),
  };

  const result = await EbookCollection.findOne(query);
  res.json(result);
});

app.patch(
  "/api/ebooks/:id",
  verifyToken,
  requireWriterOrAdmin,
  async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const query = { _id: new ObjectId(id) };

    if (req.user.role !== "admin") {
      const currentUserId = String(req.user._id || req.user.id);
      query.writerId = currentUserId;
    }

    const { _id, writerId, writerEmail, createdAt, ...cleanUpdates } = req.body;

    const result = await EbookCollection.updateOne(query, {
      $set: {
        ...cleanUpdates,
        updatedAt: new Date(),
      },
    });

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ message: "Book not found or unauthorized" });
    }

    res.json(result);
  },
);

app.delete(
  "/api/ebooks/:id",
  verifyToken,
  requireWriterOrAdmin,
  async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const query = { _id: new ObjectId(id) };

    if (req.user.role !== "admin") {
      const currentUserId = String(req.user._id || req.user.id );
      query.writerId = currentUserId;
    }

    const result = await EbookCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You do not own this book or it does not exist",
        });
    }

    res.json(result);
  },
);

-app.post(
  "/api/bookBuyCollection",
  verifyToken,
  requireReader,
  async (req, res) => {
    try {
      const {
        ebookId,
        ebookTitle,
        status,
        coverImage,
        amount,
        paymentIntentId,
      } = req.body;

      
      const buyerUserId = String(req.user._id || req.user.id);
      const buyerUserEmail = req.user.email;

      const isPurchaseBookExist = await bookBuyCollection.findOne({
        ebookId,
        buyerUserId,
      });

      if (isPurchaseBookExist) {
        return res.status(409).json({ message: "You already own this book" });
      }

      // Save purchase record
      const purchaseData = {
        ebookId,
        ebookTitle,
        coverImage,
        buyerUserId,
        buyerUserEmail,
        amount,
        paymentIntentId,
        status: status || "completed",
        purchasedDate: new Date(),
      };

      const buyingData = await bookBuyCollection.insertOne(purchaseData);

      // Save payment record
      const paymentData = {
        buyerUserId,
        buyerUserEmail,
        amount,
        status: status || "succeeded",
        paymentIntentId,
        ebookId,
        ebookTitle,
        createdAt: new Date(),
      };

      await paymentCollection.insertOne(paymentData);

      res.status(201).json(buyingData);
    } catch (error) {
      console.error("Error processing purchase:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  },
);


// user purchasedBooks show api
app.get("/api/bookBuyCollection/:userId", verifyToken, verifyReader, async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const query = { buyerUserId: userId };
  const purchasedBooks = await bookBuyCollection.find(query).toArray();
  res.json(purchasedBooks);
});


// user purchased ebook full details
app.get("/api/bookBuyCollection/:userId/:ebookId", verifyToken, verifyReader, async (req, res) => {
  const { userId, ebookId } = req.params;

  if (req.user.id !== userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const purchasedBook = await bookBuyCollection.findOne({
    buyerUserId: userId,
    ebookId: ebookId,
  });

  if (!purchasedBook) {
    return res.status(404).json({ message: "Purchase not found" });
  }

  res.json(purchasedBook);
});

// Get payments for a specific user
app.get("/api/paymentCollection/:userId", verifyToken, verifyReader, async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const query = { buyerUserId: userId };
  const payments = await paymentCollection
    .find(query)
    .sort({ _id: -1 })
    .toArray();

  res.json(payments);
});

// GET all users (for admin table)
app.get("/api/users", verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await usersCollection
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            role: 1,
            image: 1,
            createdAt: 1,
          },
        },
      )
      .toArray();
    res.json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

//admin patch change a user role
app.patch("/api/users/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    if (id === req.user.id && updatedData.role && updatedData.role !== "admin") {
      return res.status(400).json({ message: "Cannot change your own admin role" });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData },
    );

    res.json(result);
  } catch (error) {
    console.error("Error updating user:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// DELETE a user
app.delete("/api/users/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const result = await usersCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.json(result);
  } catch (error) {
    console.error("Error deleting user:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});


app.get("/api/reader/:userId/stats", verifyToken, verifyReader,async (req, res) => {
  try {
    const { userId } = req.params;

    if ( req.user.id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Query 1 — totals via aggregation
    const totals = await bookBuyCollection.aggregate([
      { $match: { buyerUserId: userId } },
      {
        $group: {
          _id: "$buyerUserId",
          totalBooks: { $sum: 1 },
          totalSpent: { $sum: { $toDouble: "$amount" } },
        },
      },
      {
        $project: {
          _id: 0,
          totalBooks: 1,
          totalSpent: { $round: ["$totalSpent", 2] },
        },
      },
    ]).toArray();

    // Query 2 — recent purchases, plain find
    const recentPurchases = await bookBuyCollection
      .find({ buyerUserId: userId })
      .sort({ purchasedDate: -1 })
      .limit(4)
      .toArray();

    const result = {
      totalBooks: totals[0]?.totalBooks || 0,
      totalSpent: totals[0]?.totalSpent || 0,
      recentPurchases,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});










// Send a ping to confirm a successful connection
// await client.db("admin").command({ ping: 1 });
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!",
//     );
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.send("Hello World!");
// });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.export = app;
