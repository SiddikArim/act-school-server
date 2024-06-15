const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.Stripe_Secret);
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }

  //token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.VERIFY_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = process.env.DB_URL;

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
    client.connect();

    const userCollection = client.db("actSchoolDb").collection("users");
    const classCollection = client.db("actSchoolDb").collection("classes");
    const selectedCollection = client.db("actSchoolDb").collection("selected");
    const paymentCollection = client.db("actSchoolDb").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.VERIFY_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);

      if (user?.role !== "admin") {
        res.status(403).send({
          error: true,
          message: "Forbidden Access",
        });
      }
      next();
    };

    // Its not a usefull function TODO:
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);

      if (user?.role !== "instructor") {
        res.status(403).send({
          error: true,
          message: "Forbidden Access",
        });
      }
      next();
    };
    /*****************************
     * Home Page Route - Instructors and Classes
     ******************************/
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/classs", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.put("/classs/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(feedback);
      // console.log('Id hitting to approve', req.params.id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const newStatus = {
        $set: { status: "Approved" },
      };
      const result = await classCollection.updateOne(
        filter,
        newStatus,
        options
      );

      res.send(result);
    });

    app.put("/classs-d/:id", async (req, res) => {
      const id = req.params.id;
      // console.log('Id hitting to approve', req.params.id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const newStatus = {
        $set: { status: "Denied" },
      };
      const result = await classCollection.updateOne(
        filter,
        newStatus,
        options
      );

      res.send(result);
    });

    app.get("/approved-classes", async (req, res) => {
      const query = { status: "Approved" };
      const approvedClass = await classCollection.find(query).toArray();
      const result = { class: approvedClass?.status === "Approved" };
      res.send(approvedClass);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    /*****************************
     * Admin route
     ******************************/
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    /*****************************
     * Course route
     ******************************/
    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    app.get("/myClass", verifyJWT, async (req, res) => {
      const email = req.decoded.email;

      let query = {};

      if (email) {
        query = { instructorEmail: req.decoded.email };
      }

      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    /*****************************
     * Selected class route
     ******************************/
    app.post("/selectedClass", async (req, res) => {
      const selectedItem = req.body;
      const result = await selectedCollection.insertOne(selectedItem);
      res.send(result);
    });

    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/selectedClass", verifyJWT, async (req, res) => {
      const email = req.decoded.email;

      let query = {};

      if (email) {
        query = { studentEmail: req.decoded.email };
      }

      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    });

    /*****************************
     * Users route
     ******************************/
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      //   console.log(newUser);
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.put("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const email = req.decoded.email;
      console.log(email, "hitting to make role change to Admin", id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const newRole = {
        $set: {
          role: "admin",
          roleStatusLog: { permitter: email, date: Date() },
        },
      };
      const result = await userCollection.updateOne(filter, newRole, options);
      res.send(result);
    });

    app.put(
      "/users/instructor/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const email = req.decoded.email;
        console.log(email, "hitting to make role change to Instructor", id);
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };

        const newRole = {
          $set: {
            role: "instructor",
            roleStatusLog: { permitter: email, date: Date() },
          },
        };
        const result = await userCollection.updateOne(filter, newRole, options);
        res.send(result);
      }
    );

    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    /*****************************
     * Enrolled Class Route
     ******************************/
    app.get("/payments", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email };

      const paymentsHistory = await paymentCollection.find(query).toArray();
      const paidCourseIds = paymentsHistory.map((payment) => payment.classId);
      const classes = await classCollection.find().toArray();
      const paidClasses = classes.filter((cls) => cls._id === paidCourseIds);

      res.send({ paymentsHistory, paidCourseIds, paidClasses });
    });

    /*****************************
     * Stripe Gateway
     ******************************/
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment-
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.selectedItemId.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await selectedCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ACT School Server");
});

app.listen(port, () => {
  console.log("Server running on port - ", port);
});
