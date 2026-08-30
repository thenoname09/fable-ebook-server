const express = require("express");
const app = express();

const dotenv = require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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

// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();

client.connect(()=>{
      console.log('connected to MongoDB!')
}).catch(console.dir)

    const db = client.db("FableEbookDB");
    const EbookCollection = db.collection("Ebooks");
    const bookBuyCollection = db.collection("bookBuyCollections");
    const paymentCollection = db.collection("paymentCollections");
    const usersCollection = db.collection("user");

    // addbook form api
    app.post("/api/ebooks", async (req, res) => {
      const Ebook = req.body;

      const result = await EbookCollection.insertOne(Ebook);

      res.json(result);
      console.log(result, "fsdf");
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

      const result = await EbookCollection.find(query).toArray();
      res.json(result);
    });

    app.get("/api/ebooks/:id", async (req, res) => {
      const { id } = req.params;
      const query = {
        _id: new ObjectId(id),
      };

      const result = await EbookCollection.findOne(query);
      res.json(result);
    });

    app.patch("/api/ebooks/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      const result = await EbookCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );

      res.json(result);
    });

    app.delete("/api/ebooks/:id", async (req, res) => {
      const { id } = req.params;
      const result = await EbookCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.post("/api/bookBuyCollection", async (req, res) => {
      try {
        const {
          ebookId,
          ebookTitle,
          status,
          coverImage,
          amount,
          buyerUserId,
          buyerUserEmail,
          paymentIntentId,
        } = req.body;

        const purchaseData = {
          ebookId,
          ebookTitle,
          coverImage,
          buyerUserId,
          buyerUserEmail,
          amount,
          paymentIntentId,
          status,
          purchasedDate: new Date(),
        };

        // 1. Block Writers and Admins
        const buyer = await usersCollection.findOne({ email: buyerUserEmail });

        if (buyer && (buyer.role === "writer" || buyer.role === "admin")) {
          return res.status(403).json({
            message: "Action denied: Admins and Writers cannot purchase books.",
          });
        }

        // 2. Prevent double-purchasing
        const isPurchaseBookExist = await bookBuyCollection.findOne({
          ebookId,
          buyerUserId,
        });

        if (isPurchaseBookExist) {
          return res.status(409).send({ message: "You already own this book" });
        }

        // 3. Save the purchase
        const buyingData = await bookBuyCollection.insertOne(purchaseData);

        // 4. Save the payment
        const paymentData = {
          buyerUserId,
          buyerUserEmail,
          amount,
          status,
          paymentIntentId,
          ebookId,
          ebookTitle,
          createdAt: new Date(),
        };

        await paymentCollection.insertOne(paymentData);

        // 5. Send success response
        res.status(201).json(buyingData);
      } catch (error) {
        // This catches any database errors and stops your server from crashing
        console.error("Error processing purchase:", error);
        res
          .status(500)
          .json({ message: "Internal server error", error: error.message });
      }
    });

    // user purchasedBooks show api
    app.get("/api/bookBuyCollection/:userId", async (req, res, next) => {
      const { userId } = req.params;

      const query = { buyerUserId: userId };
      const purchasedBooks = await bookBuyCollection.find(query).toArray();

      res.send(purchasedBooks);
    });

    // user purchased ebook full details
    app.get("/api/bookBuyCollection/:userId/:ebookId", async (req, res) => {
      const { userId, ebookId } = req.params;

      const purchasedBook = await bookBuyCollection.findOne({
        buyerUserId: userId,
        ebookId: ebookId,
      });

      if (!purchasedBook) {
        return res.status(404).send({ message: "Purchase not found" });
      }

      res.json(purchasedBook);
    });

    // Get payments for a specific user
    app.get("/api/paymentCollection/:userId", async (req, res, next) => {
      const { userId } = req.params;

      const query = { buyerUserId: userId };
      const payments = await paymentCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();

      res.send(payments);
    });

    // GET all users (for admin table)
    app.get("/api/users", async (req, res) => {
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

    // PATCH — change a user's role
    app.patch("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body; // e.g. { role: "writer" }

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
    app.delete("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
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