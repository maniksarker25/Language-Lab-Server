const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleWare
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Language Lab Running Now");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.16yxiu9.mongodb.net/?retryWrites=true&w=majority`;

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


    const userCollection = client.db("languageLab").collection('users');


    //secure apis
    app.post('/jwt', (req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn: "2h",
      });
      res.send({token})
    })


    //users apis 
    app.post('/users', async(req,res)=>{
      const user = req.body;
      const query = {email:user.email};
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message:'user already exits'})
      }
      const result = await userCollection.insertOne(user)
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Language Lab is running on port:${port}`);
});
