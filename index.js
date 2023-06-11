const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

//middleWare
app.use(cors());
app.use(express.json());

// verify token

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  MongoAWSError,
} = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.16yxiu9.mongodb.net/?retryWrites=true&w=majority`;

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

    const userCollection = client.db("languageLab").collection("users");
    const classCollection = client.db("languageLab").collection("classes");
    const selectedClassCollection = client
      .db("languageLab")
      .collection("selectedClass");
    const paymentCollection = client.db("languageLab").collection("payments");

    //secure apis--------------------------------------
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    // verify instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //-----------------------------------------

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exits" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // find user role
    app.get("/users/check-role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const role = {
        projection: { _id: 0, role: 1 },
      };
      const result = await userCollection.findOne(query, role);
      res.send(result);
    });

    // get all classes
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // get approved classes-------

    app.get("/approved-classes", async (req, res) => {
      const status = req.query.status;
      const query = { status: status };
      const result = await classCollection.find(query).sort({totalEnrolled:-1}).toArray();
      res.send(result);
    });

    // get all instructor ----
    app.get("/all-instructor", async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // student related apis --------------------------------------------------------------------

    // select class --------
    app.post("/select-class", verifyJWT, async (req, res) => {
      const { selectClass } = req.body;
      const result = await selectedClassCollection.insertOne(selectClass);
      res.send(result);
    });

    // get selected classes
    app.get("/selected-classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { studentEmail: email };
      const result = await selectedClassCollection.find(query).toArray();
      // console.log(result)
      res.send(result);
    });

    // delete a class
    app.delete("/delete-class/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    // my enrolled class
    app.get('/enrolled-classes',verifyJWT, async(req,res)=>{
      const email = req.query.email;
      const query = {studentEmail:email}
      const result = await paymentCollection.find(query).toArray();
      res.send(result);

    })

    // payment history
    app.get('/payment-history',verifyJWT, async(req,res)=>{
      const email = req.query.email;
      const query = {studentEmail:email}
      const result = await paymentCollection.find(query).sort({date:-1}).toArray();
      res.send(result);

    })



    // admin related apis-----------------------------------------------------------

    // get all users -------------
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // make admin--------------
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // make instructor ----
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // handle class status -------
    app.patch("/status/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const status = req.query.status;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };

      const result = await classCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // route for send feedback-----------
    app.put("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await classCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // instructor related apis --------------------------------------------

    // add a class----------------
    app.post("/class", verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    // get my classes-------------
    app.get("/my-classes", verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.query.email;
      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // payment related api
    // create payment intent-------------
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(price, amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment ---------------
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { _id: new ObjectId(payment.selectedClassId) };
      const query2 = { _id: new ObjectId(payment.classId) };
      const previousClass = await classCollection.findOne(query2);
      // console.log(previousClass);
      const updateDoc = {
        $set: {
          availableSeat: --previousClass.availableSeat,
          totalEnrolled: ++previousClass.totalEnrolled || 0
        },
      };

      const updateResult = await classCollection.updateOne(query2,updateDoc);
      const deleteResult = await selectedClassCollection.deleteOne(query);
      res.send({ insertResult, deleteResult,updateResult });
    });

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

app.get("/", (req, res) => {
  res.send("Language Lab Running Now");
});

app.listen(port, () => {
  console.log(`Language Lab is running on port:${port}`);
});
