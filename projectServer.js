const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const fs = require('fs');
const formidable = require('express-formidable');
const mongourl = 'mongodb+srv://hoyin1017:hoyin1017@cluster0.pgjdg.mongodb.net/test?retryWrites=true&w=majority';
const dbName = 'test';
///EJS, login, logout
const session = require('cookie-session');
const bodyParser = require('body-parser');

app.set('view engine', 'ejs');

//List of users' username & password
const users = new Array(
    { name: 'developer', password: '' },
	{ name: 'demo', password: '' },//For test case
	{ name: 'student', password: '' } //For test case
);

const findDocument = (db, criteria, callback) => {
    let cursor = db.collection('inventory').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

const updateDocument = (criteria, updateDoc, callback) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

         db.collection('inventory').updateOne(criteria,
            {
                $set : updateDoc
            },
            (err, results) => {
                client.close();
				console.log(`Closed DB connection`);
                assert.equal(err, null);
                callback(results);
            }
        );
    });
}

app.use(session({
	name: 'loginSession',
	keys: ['SECRETKEY']
}));

// support parsing of application/json type post data
app.use(bodyParser.json());
/* ---------------------------- 接住clients' input ---------------------------- */
app.use(bodyParser.urlencoded({ extended: true }));


app.get('/', (req, res) => {
	console.log(req.session);
	if (!req.session.authenticated) {    // When user haven't logged in, redirect to login page
		res.redirect('/login');
	} else {    //else, send user to homepage
		res.redirect('/home');
	}
});

app.get('/login', (req, res) => {
	res.status(200).render('login', {});
});

app.post('/login', (req, res) => {
	users.forEach((user) => {
		if (user.name == req.body.name && user.password == req.body.password) {
			// correct user name + password
			// store the following name/value pairs in cookie session
			req.session.authenticated = true;        // 'authenticated': true
			req.session.username = req.body.name;	 // 'username': req.body.name		
		}
	});
	res.redirect('/');
});

app.get('/logout', (req, res) => {
	req.session = null;   // clear cookie-session
	res.redirect('/');
});

app.get('/home', (req, res) => {
	const client = new MongoClient(mongourl);
	client.connect((err) => {
		console.log("Connected successfully to server");
		const db = client.db(dbName);

		findDocument(db, req.query, (docs) => {
			client.close();
			console.log("Closed DB connection");
			res.status(200).render('home', {
				name: req.session.username,
				doc: docs
			});
		});
	});

});

app.use(formidable());

app.get('/create', (req, res) => {
	res.status(200).render('create', {});
});

app.post('/create', (req, res) => {

	var doc = {

		"name": req.fields.name,
		"quantity": req.fields.quantity,
		"type": req.fields.inv_type,
		"manager": req.session.username,
		"photo_mimetype": req.fields.photo_mimetype,
		"inventory_address": {
			"street": req.fields.street,
			"building": req.fields.building,
			"country": req.fields.country,
			"zipcode": req.fields.zipcode,
            "latitude": req.fields.latitude,
            "longitude": req.fields.longitude
		}

	};
    if (req.files.filetoupload.size > 0) { //check if photo is upload
        fs.readFile(req.files.filetoupload.path, (err,data) => {
            assert.equal(err,null);
            doc['photo'] = new Buffer.from(data).toString('base64');
            doc['photo_mimetype'] = req.files.filetoupload.type;
        });
    }
	const client = new MongoClient(mongourl);

	client.connect((err) => {			// if Connection is good, error will store Nothing
		console.log("Connected successfully to server");
		const db = client.db(dbName);
		// var userCollection = db.collection('inventory');
		//create a contact

		db.collection('inventory').insertOne(doc, function (err, collection) {
			if (err) throw err;
			console.log("Record inserted Successfully");
		});
		client.close();
		res.status(200).render('info', {message: `document has been inserted to database.`})

	});
});

app.get('/details', (req, res) => {
	const client = new MongoClient(mongourl);
	client.connect((err) => {
		assert.equal(null, err);
		console.log("Connected successfully to server");
		const db = client.db(dbName);

		// use Document ID for query
		let DOCID = {};
		DOCID['_id'] = ObjectID(req.query._id)
		console.log(`Passing _id: ${DOCID['_id']} to find document for details`);
		findDocument(db, DOCID, (docs) => {  // docs contain 1 document (hopefully)
			client.close();
			console.log("Closed DB connection");
			res.status(200).render('details', { doc: docs });
		});
	});
});

app.get('/edit', (req,res) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(req.query._id)
        console.log(`Passing _id: ${DOCID['_id']} to find docoument for edit`);
        let cursor = db.collection('inventory').find(DOCID);
        cursor.toArray((err,docs) => {
            client.close();
            assert.equal(err,null);
            res.status(200).render('edit',{doc: docs});
        });
    });
})

app.post('/update', (req,res) => {
    if(req.session.username == req.fields.manager){// to check user is owner of document or not
        var DOCID = {};
        DOCID['_id'] = ObjectID(req.fields._id);
        console.log(`Getting id ${DOCID['_id']} to do update`);
        var updateDoc = {};
		updateDoc['name'] = req.fields.name;
        updateDoc['type'] = req.fields.type;
        updateDoc['quantity'] = req.fields.quantity;
        updateDoc['inventory_address.street'] = req.fields.street;
        updateDoc['inventory_address.building'] = req.fields.building;
        updateDoc['inventory_address.country'] = req.fields.country;
        updateDoc['inventory_address.zipcode'] = req.fields.zipcode;
        updateDoc['inventory_address.latitude'] = req.fields.latitude;
        updateDoc['inventory_address.longitude'] = req.fields.longitude;
            if (req.files.filetoupload.size > 0) { //check if photo is uploaded
            fs.readFile(req.files.filetoupload.path, (err,data) => {
                assert.equal(err,null);
                updateDoc['photo'] = new Buffer.from(data).toString('base64');
                updateDoc['photo_mimetype'] = req.files.filetoupload.type;
                updateDocument(DOCID, updateDoc, (results) => {
                    res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})
                });
            });
        } else {
            updateDocument(DOCID, updateDoc, (results) => {
                res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})
            });
        }
    }else{
        res.status(200).render('info', {message: `You don't have permission to edit this document!`})
    }
})

app.get('/delete', (req,res) => {
	if(req.session.username == req.query.owner){// to check user is owner of document or not
		const client = new MongoClient(mongourl);
		client.connect((err) => {
			assert.equal(null, err);
			console.log("Connected successfully to server");
			const db = client.db(dbName);

			// use Document ID for query
			let DOCID = {};
			DOCID['_id'] = ObjectID(req.query._id)
			console.log(`Passing _id: ${DOCID['_id']} to find document for delete`);

			db.collection('inventory').deleteOne({ _id : DOCID['_id'] }, function (err, collection) {
				if (err) throw err;
				console.log("Record deleted Successfully");

		});

		client.close();
		console.log("Closed DB connection");
		res.status(200).render('info', {message: `The document has been deleted!`})
		});
	}else {
		res.status(200).render('info', {message: `You don't have permission to delete this document!`})
	}
});

app.get("/map", (req, res) => {
	res.render("leaflet", {
		lat: req.query.lat,
		lon: req.query.lon,
		zoom: req.query.zoom ? req.query.zoom : 15
	});
	res.end();
});

//RESTful service

//curl -X GET http://localhost:8099/api/inventory/name/xxx

app.get('/api/inventory/name/:name', (req,res) => {
    if (req.params.name) {
        let criteria = {};
        criteria['name'] = req.params.name;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing inventory name"});
    }
})

//curl -X GET http://localhost:8099/api/inventory/type/yyy

app.get('/api/inventory/type/:type', (req,res) => {
    if (req.params.type) {
        let criteria = {};
        criteria['type'] = req.params.type;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing inventory type"});
    }
})

//Handle unknown request
app.get('/*', (req,res) => {
    res.status(404).render('info', {message: `${req.path} - Unknown request!` });
})

app.listen(app.listen(process.env.PORT || 8099));