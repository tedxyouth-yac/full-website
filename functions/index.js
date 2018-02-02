const functions = require('firebase-functions');
var admin = require("firebase-admin");

admin.initializeApp(functions.config().firebase);

exports.ticket = functions.https.onRequest((req, res) => {
    var token = req.body.stripeToken;

    var youthNames = req.body.youthNames.split("<|>");
    var generalNames = req.body.generalNames.split("<|>");;
    var youthEmails = req.body.youthEmails.split("<|>");;
    var generalEmails = req.body.generalEmails.split("<|>");;
    var promoCode = req.body.promoCode;
    var emailV = req.body.email;

    var allPromises = [];

    console.log(promoCode);

    if (youthNames[0] == "") {
        youthNames = [];
    }

    if (generalNames[0] == "") {
        generalNames = [];
    }

    if (youthEmails[0] == "") {
        youthEmails = [];
    }

    if (generalEmails[0] == "") {
        generalEmails = [];
    }

    var stripe = require("stripe")("YOUR_STRIPE_TOKEN");

    var totalPrice = (youthNames.length * 6) + (generalNames.length * 10);

    if (totalPrice == 0) {
        res.status(200).send(`
            <h1>Request failed!</h1>
            <p>You didn't buy any tickets! Wait a few minutes and try purchasing again. If it doesn't work, email YOUREVENTEMAIL@EVENT.COM</p>
        `);
        return;
    }

    var deduct = 0;

    if (promoCode == "PROMO1") {
        deduct = 10;
    } else if (promoCode == "PROMO2") {
        deduct = 20;
    } else if (promoCode == "PROMO3") {
        deduct = 30;
    }

    totalPrice = totalPrice - deduct;

    if (totalPrice < 0) {
        totalPrice = 0;
    }

    var processEverything = function() {
        var db = admin.firestore();

        var ticketRef = db.collection("ticket");
        var randomString = require("randomstring");

        // Collision checking on QR codes disabled due to timing delays and the incredible unlikelyness of a collision (16^54)
        var codes = [];
        var i = 0;

        youthNames.forEach(function(nameV) {
            qrCode = randomString.generate(16);
            var data = {
                name: nameV,
                email: youthEmails[i],
                qr_login: qrCode,
                signed_in: false,
                type: 0
            };

            var prm = db.collection('ticket').add(data);
            allPromises.push(prm);

            codes.push(qrCode);

            i = i + 1;
        });

        i = 0;

        generalNames.forEach(function(nameV) {
            qrCode = randomString.generate(16);
            var data = {
                name: nameV,
                email: generalEmails[i],
                qr_login: qrCode,
                signed_in: false,
                type: 1
            };

            db.collection('ticket').add(data);

            codes.push(qrCode);

            i = i + 1;
        });

        var qr = require("qr-image");

        var codeImages = [];
        i = 0;
        var allNames = youthNames.concat(generalNames);
        console.log(allNames);

        allNames.forEach(function(nameV) {
            codeImages.push(qr.imageSync(codes[i], { type: 'png' }));
            i = i + 1;
        });

        console.log(codeImages);

        qrAttachments = [];

        var i = 0;
        codeImages.forEach(function(imageContent) {
            var atch =  {
              content: imageContent.toString('base64'),
              filename: allNames[i] + '.png',
              type: 'image/png',
              disposition: 'attachment',
              contentId: codes[i]
          };
          qrAttachments.push(atch);

          i = i + 1;
        });

        console.log(qrAttachments)

        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey("YOUR_SENDGRID_API_KEY");
        var msg = {
          to: emailV,
          from: "tickets@YOUREVENT.com",
          subject: 'Your tickets for YOUREVENTNAME',
          text: 'x',
          attachments: qrAttachments,
          html: `
          <html>
          <head>
            <style>
                .logo-img {
                    width: 60%;
                }

                @media (max-width: 750px) {
                    .logo-img {
                        width: 80% !important;
                    }
                }
            </style>
          </head>
          <body style="background-color: #E0E0E0;">
          <br><br>
          <center>
              <img src="https://i.imgur.com/YOURLOGOIMAGE.png" alt="logo" class="logo-img">
          </center>
          <br>
          <div style="margin: 0 auto; width: 80%; background-color: #fff; border-radius: 10px;">
              <div style="margin: 0 auto; width: 90%;">
                  <br>
                  <p style="font-family: Roboto, Helvetica-Neue, Arial; font-size: 15px;">Hey! Thanks for buying a (or multiple) ticket(s)! Below, you'll find some QR codes: that's all you'll need to sign in on the day of the event. If you know you won't have your phone on hand on the day of the event, please print the codes out - we'd like to avoid name lookups as much as possible. Thanks!</p>
                  <br>
              </div>
          </div>
          <br><br>

          </body>
          </html>`,
        };

        console.log(msg);

        res.redirect(307, '/#paid');

        var prm = sgMail.send(msg);
        allPromises.push(prm);

        return Promise.all(allPromises);
    }

    if (totalPrice == 0) {
        var result = processEverything();
        return result;
    }

    stripe.charges.create({
      amount: totalPrice * 100,
      currency: "usd",
      description: "Tickets for EVENT NAME",
      source: token,
    }, function(err, charge) {
        if (err) {
            res.status(200).send(`
                <h1>Request failed!</h1>
                <p>Wait a few minutes and try purchasing again. If it doesn't work, email hillsboro.tedxyouth@gmail.com.</p>
            `);
            return;
        } else {
            var result = processEverything();
            return result;
        }
    });

});

exports.checkin = functions.https.onRequest((req, res) => {
    var parameterString = req.originalUrl;
    parameterString = parameterString.substr(1);
    var params = parameterString.split("%7C");
    var password = params[0];
    var qrCode = params[1];

    console.log(password);
    console.log(qrCode);
    if (password != "CHECKIN_APP_PASSWORD") {
        res.status(200).send("215");
        return;
    }

    var db = admin.firestore();
    var ticketRef = db.collection("ticket");

    ticketRef.where("qr_login", "==", qrCode).get().then(function(querySnapshot) {
        var steps = 0;
        var id = 0;
        var signedIn = false;
        var username = "";
        querySnapshot.forEach((doc) => {
            steps = steps + 1;
            if (steps != 1) {
                res.status(200).send("420");
                return;
            }

            id = doc.id;
            signedIn = doc.data().signed_in;
            username = doc.data().name;

        });

        if (id == 0) {
            res.status(200).send("202");
            return;
        }

        if (signedIn == true) {
            res.status(200).send("201");
            return;
        }

        db.collection("ticket").doc(id).update({
            signed_in: true
        }).then(function() {
            res.status(200).send("200" + username);
            return;
        });
    });
});

exports.checkPromoCode = functions.https.onRequest((req, res) => {
    console.log(req.body.toString());
    console.log(req.body.code);

    if (req.body.code == "PROMO1") {
        res.status(200).send("-1|The price of one of your tickets has been dropped!|PROMO1");
    } else if (req.body.code == "PROMO2") {
        res.status(200).send("-2|The price of two of your tickets has been dropped! (The speaker doesn't need to buy a ticket.)|PROMO2");
    } else if (req.body.code == "PROMO3") {
        res.status(200).send("-3|30 dollars (max) discounted!|PROMO3");
    } else {
        res.status(200).send("DENY|Sorry, but that promo code is invalid.|");
    }

});
