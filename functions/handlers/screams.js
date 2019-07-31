const { db } = require('../util/admin');

exports.getAllScreams = (req, res) => {
  db.collection('screams')
    .orderBy('createdAt', 'desc')
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

  if (body.trim() === '') {
    return res.status(400).json({ body: 'Body must not be empty' });
  }

  const newScream = {
    body,
    userHandle: handle,
    createdAt: new Date().toISOString()
  };

  db.collection('screams')
    .add(newScream)
    .then(doc =>
      res.json({ message: `document ${doc.id} created successfully` })
    )
    .catch(err => {
      res.status(500).json({ error: 'something went wrong' });
      console.log(err);
    });
};

exports.getScream = (req, res) => {
  const { params } = req;
  let screamData;
  db.doc(`/screams/${params.screamId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Scream not found' });
      }
      /* screamData = doc.data();
      screamData.screamId = doc.id; */
      screamData = doc.data();
      screamData.screamId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('screamId', '==', params.screamId)
        .get();
    })
    .then(data => {
      screamData.comments = [];
      data.forEach(doc => screamData.comments.push(doc.data()));
      return res.json(screamData);
    })
    .catch(err => {
      res.status(500).json({ error: 'something went wrong' });
      console.log(err);
    });
};

exports.commentOnScream = (req, res) => {
  const { body, user, params } = req;
  if (!body.body.trim()) {
    return res.status(400).json({ error: 'Must not be empty' });
  }

  const newComment = {
    body: body.body,
    createdAt: new Date().toISOString(),
    screamId: params.screamId,
    userHandle: user.handle,
    userImage: user.imageUrl
  };

  db.doc(`/screams/${params.screamId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Scream not found' });
      }
      return db.collection('comments').add(newComment);
    })
    .then(() => res.json(newComment))
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: 'something went wrong' });
    });
};
