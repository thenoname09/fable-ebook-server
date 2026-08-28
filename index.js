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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("FableEbookDB");
    const EbookCollection = db.collection("Ebooks");
    const bookBuyCollection = db.collection("bookBuyCollections");
    const paymentCollection = db.collection("paymentCollections");

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
      const {
        ebookId,
        ebookTitle,
        status,
        coverImage,
        amount,
        buyerUserId,
        buyerUserEmail,
        buyerEmail,
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

      const isPurchaseBookExist = await bookBuyCollection.findOne({
          ebookId,
  buyerUserId,
      });
      if (isPurchaseBookExist) {
        return res.status(202).send({ message: "You already own this book " });
      }

      const buyingData = await bookBuyCollection.insertOne(purchaseData);

      const paymentData = {
        buyerUserId,
        buyerUserEmail,
        amount,
        status,
        paymentIntentId,
        ebookId
      };

      await paymentCollection.insertOne(paymentData);

      res.json(buyingData);
    });

    // user purchasedBooks show
app.get("/api/bookBuyCollection/:userId", async (req, res, next) => {
  const { userId } = req.params;

  const query = { buyerUserId: userId };
  const purchasedBooks = await bookBuyCollection.find(query).toArray();

  res.send(purchasedBooks);
});






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
