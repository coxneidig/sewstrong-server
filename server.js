// dependencies
require('dotenv').config();
const CORS = require('cors');
const EXPRESS = require('express');
const EXPRESS_JWT = require('express-jwt');
const MORGAN = require('morgan');
const ROWDY_LOGGER = require('rowdy-logger');
// app and logger instantiation
const APP = EXPRESS();
const ROWDY_RESULTS = ROWDY_LOGGER.begin(APP);
// middleware config
APP.use(CORS());
APP.use(MORGAN('dev'));
APP.use(EXPRESS.urlencoded({ extended: false }));
APP.use(EXPRESS.json());
// auth routes
APP.use('/auth', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}).unless({
    path: [
        { url: '/auth/login', methods: ['POST']},
        { url: '/auth/signup/volunteer', methods: ['POST']},
        { url: '/auth/signup/order', methods: ['POST']},
        { url: '/auth/info', methods: ['GET']}
    ]
}), require('./controllers/auth'));

// protected routes
APP.use('/profile', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}), require('./controllers/profile'))
APP.use('/volunteers', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}), require('./controllers/volunteers'))
APP.use('/customers', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}), require('./controllers/customers'))
APP.use('/orders', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}).unless({
    path: [
        { url: '/orders/demand', methods: ['GET']}
    ]
}), require('./controllers/orders'))
APP.use('/products', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}).unless({
    path: [
        { url: '/products', methods: ['GET']}
    ]
}), require('./controllers/products'))
APP.use('/admin', EXPRESS_JWT({
    secret: process.env.JWT_SECRET
}), require('./controllers/admin'))

APP.get('/', (req, res) => {
    res.send({message: 'Server running'})
})

// port set up
APP.listen(process.env.PORT, () => {
    console.log(`Keeping it ${process.env.PORT}`)
    ROWDY_RESULTS.print()
});