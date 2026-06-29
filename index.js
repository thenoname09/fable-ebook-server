const express = require('express');
const app = express();

const dotenv = require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors());
app.use(express.json());

const uri =process.env.MONGODB_URL 

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("FableEbookDB");
     const EbookCollection= db.collection("Ebooks"); 

// addbook form api
app.post("/api/ebooks",  async (req, res) => {
      const Ebook= req.body;

      const result = await EbookCollection.insertOne(Ebook);

      res.json(result);
      console.log(result,"fsdf")
    });

// // book data loadapi
app.get("/api/ebooks/writer/:email", async (req, res) => {

  const { email } = req.params;
  const result = await EbookCollection.find({ writerEmail: email }).toArray();
  res.json(result);
});


app.patch("/api/ebooks/:id", async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const result = await EbookCollection.updateOne(
    { _id: new ObjectId(id) },   
    { $set: updatedData }            
  );

  res.json(result);
});


app.delete("/api/ebooks/:id", async (req, res) => {
  const { id } = req.params;
  const result = await EbookCollection.deleteOne({ _id: new ObjectId(id) });
  res.json(result);
});




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});