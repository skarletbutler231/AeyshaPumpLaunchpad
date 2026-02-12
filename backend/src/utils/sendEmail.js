
const nodeMailer = require("nodemailer");

/* Using Hostinger Mail */
// const transporter = nodeMailer.createTransport({
//     host: "smtp.hostinger.com",
//     secure: true,
//     secureConnection: false,
//     tls: {
//        ciphers: "SSLv3",
//     },
//     requireTLS: true,
//     port: 465,
//     debug: true,
//     connectionTimeout: 10000,
//     auth: {
//         user: process.env.HOSTINGER_EMAIL,
//         pass: process.env.HOSTINGER_PASSWORD,
//     }
// });



const transporter = nodeMailer.createTransport({
    host: "smtp.hostinger.com",
    port: 587,
    // connectionTimeout: 10000,
    auth: {
        user: process.env.HOSTINGER_EMAIL,
        pass: process.env.HOSTINGER_PASSWORD,
    }
});

const sendEmail1 = async (options, callback) => {
    // console.log("===== transporter:", transporter)
	const mailOptions = {
	    from: process.env.HOSTINGER_EMAIL,
	    to: options.to,
	    subject: options.subject,
	    html: options.html
	};
    
    return transporter.sendMail(mailOptions).then(info => {
        if (callback)
            callback(null, info.response);
    })
    .catch(err => {
        console.log("Email err: ", err)
        if (callback)
            callback(err);
    });
};


const transporter1 = nodeMailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.HOSTINGER_EMAIL,
        pass: process.env.HOSTINGER_PASSWORD,
    },
    // tls: {
    //     rejectUnauthorized: false // This allows self-signed certificates (use with caution)
    // },
    // connectionTimeout: 10000, // Connection timeout in milliseconds
    // debug: true, // Enable debug output for troubleshooting
});


const sendEmail = async (options, callback) => {
    // console.log("===== transporter:", transporter)
	const mailOptions = {
	    from: process.env.HOSTINGER_EMAIL,
	    to: options.to,
	    subject: options.subject,
	    html: options.html
	};
    
    return transporter.sendMail(mailOptions).then(info => {
        if (callback)
            callback(null, info.response);
    })
    .catch(err => {
        console.log("Email err: ", err)
        if (callback)
            callback(err);
    });
};

module.exports = sendEmail;
