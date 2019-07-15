const { db } = require("../util/admin");

exports.getAllScreams = (req, res) => {
  db.collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let screams = [];
      data.forEach(doc =>
        screams.push({
          id: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt
        })
      );
      return res.json(screams);
    })
    .catch(err => console.error(err));
};

exports.createScream = (req, res) => {
  const {
    user: { handle },
    body: { body }
  } = req;

  if (body.trim() === "") {
    return res.status(400).json({ body: "Body must not be empty" });
  }

  const newScream = {
    body,
    userHandle: handle,
    createdAt: new Date().toISOString()
  };

  db.collection("screams")
    .add(newScream)
    .then(doc =>
      res.json({ message: `document ${doc.id} created successfully` })
    )
    .catch(err => {
      res.status(500).json({ error: "something went wrong" });
      console.log(err);
    });
};
