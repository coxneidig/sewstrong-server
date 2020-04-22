// dependencies
require('dotenv').config();
const JWT = require('jsonwebtoken');
const DB = require('../models');
const ROUTER = require('express').Router();
const ASYNC = require('async')

const errorCatch = require('../errorCatch') 

// POST /auth/login
ROUTER.post('/login', (req, res) => {
    // check if email is in the system
    DB.User.findOne({ email: req.body.email})
    .populate({
        path: 'maker',
        populate: {
            path: 'inventory',
            populate: {path: 'product'}
        }
    })
    .populate({
        path: 'driver',
        populate: {path: 'orders'}
    })
    .populate({
        path: 'customer',
        populate: {path: 'orders'},
        populate: {path: 'org_type'}
    })
    .then(user => {
        // confirm user and password exist
        if (!user || !user.password) {
            return res.status(404).send({ message: 'User not found.'});
        };
        // if user exists, check password
        if (!user.isAuthenticated(req.body.password)) {
            // invalid password, error
            return res.status(406).send({ message: 'Invalid credentials.'});
        };
        let token = JWT.sign(user.toJSON(), process.env.JWT_SECRET, {
            expiresIn: 60 * 15
        });
        res.send({ token });
    })
    .catch(err => errorCatch(err, 'Error in POST /auth/login', res, 503, 'Internal Server Error'))
});

// POST /auth/signup/volunteer - sign up for volunteer
ROUTER.post('/signup/volunteer', (req, res) => {

    // if email exists, user is already in the system
    DB.User.findOne({ email: req.body.email })
    .then(user => {
        // if user exists, error
        if (user) {
            return res.status(409).send({ message: 'Email already in use'});
        }
        
        // if not, create the user's account (maker, driver), then create a user and reference the new account
        console.log(req.headers)
        //IF USER SIGNING UP IS A MAKER
        if(req.headers['user-type'] === 'maker') {
            console.log('creating new maker')
            //first create the maker account
            DB.Maker.create(req.body.maker)
            .then(newAccount => {
                let newInventories = []
                //create new blank inventory for each product
                ASYNC.forEach(req.body.inventory, (product, done) => {
                    DB.Inventory.create({
                        product: product.product,
                        total_units: product.total_units,
                        total_inventory_to_date: product.total_inventory_to_date,
                        maker: newAccount._id
                    })
                    .then(newInventory => {
                        console.log('new inventory created', newInventory)
                        newInventories.push(newInventory)
                        done()
                    })
                    .catch(done)
                },
                //once all inventories created, add ids to maker
                () => {
                    let inventoryIds = newInventories.map(inventory => inventory._id)
                    DB.Maker.findByIdAndUpdate(newAccount._id, {inventory: inventoryIds}, {new:true})
                    .then(updatedMaker => {
                        console.log('maker updated with inventories', updatedMaker)
                        //then create user and include the new maker id in maker ref for user
                        DB.User.create({
                            first_name: req.body.first_name,
                            last_name: req.body.last_name,
                            email: req.body.email,
                            password: req.body.password,
                            phone: req.body.phone,
                            zipcode: req.body.zipcode,
                            region: req.body.region,
                            other: req.body.other,
                            maker: updatedMaker._id
                        }) 
                        .then(user => {
                            DB.User.findById(user._id)
                            .populate({
                                path: 'maker',
                                populate: {
                                    path: 'inventory',
                                    populate: {path: 'product'}
                                }
                            })
                            .then(u => {
                                let token = JWT.sign(u.toJSON(), process.env.JWT_SECRET, {
                                    expiresIn: 60 * 15
                                });
                                res.send({ token });
                            })
                            .catch(err => errorCatch(err, 'Error populating new user', res, 503, 'Internal Server Error'))
                        }) 
                        .catch(err => errorCatch(err, 'Error creating new user', res, 503, 'Internal Server Error'))
                    })
                    .catch(err => errorCatch(err, 'Error adding inventory to maker', res, 503, 'Internal Server Error'))
                })          
            })
            .catch(err => errorCatch(err, 'Error creating new maker account', res, 503, 'Internal Server Error'))
        }

        //IF USER SIGNING UP IS A DRIVER
        else if(req.headers['user-type'] === 'driver') {
            console.log('creating new driver')
            DB.Driver.create({
                orders: [],
                distance_willing_to_drive: req.body.driver.distance_willing_to_drive,
                days_available: req.body.driver.days_available,
                times_available: req.body.driver.times_available
            })
            .then(newAccount => {
                DB.User.create({
                    first_name: req.body.first_name,
                    last_name: req.body.last_name,
                    email: req.body.email,
                    password: req.body.password,
                    phone: req.body.phone,
                    zipcode: req.body.zipcode,
                    region: req.body.region,
                    other: req.body.other,
                    driver: newAccount._id
                }) 
                .then(user => {
                    DB.User.findById(user._id)
                    .populate('driver')
                    .then(u => {
                        let token = JWT.sign(u.toJSON(), process.env.JWT_SECRET, {
                            expiresIn: 60 * 15
                        });
                        res.send({ token });
                    })
                    .catch(err => errorCatch(err, 'Error populating new user', res, 503, 'Internal Server Error'))
                })
                .catch(err => errorCatch(err, 'Error creating new user', res, 503, 'Internal Server Error'))
            })
            .catch(err => errorCatch(err, 'Error creating new account', res, 503, 'Internal Server Error'))
        }

        //IF USER SIGNING UP IS A MAKER & DRIVER
        else if(req.headers['user-type'] === 'maker+driver') { 
            console.log('creating new maker + driver')
            DB.Driver.create({
                orders: [],
                distance_willing_to_drive: req.body.driver.distance_willing_to_drive,
                days_available: req.body.driver.days_available,
                times_available: req.body.driver.times_available
            })
            .then(newDriverAccount => {
                DB.Maker.create(req.body.maker)
                .then(newAccount => {
                    let newInventories = []
                    // create new blank inventory for each product
                    ASYNC.forEach(req.body.inventory, (product, done) => {
                        DB.Inventory.create({
                            product: product.product,
                            total_units: product.total_units,
                            total_inventory_to_date: product.total_inventory_to_date,
                            maker: newAccount._id
                        })
                        .then(newInventory => {
                            console.log('new inventory created', newInventory)
                            newInventories.push(newInventory)
                            done()
                        })
                        .catch(done)
                    },
                    //once all inventories created, add ids to maker
                    () => {
                        let inventoryIds = newInventories.map(inventory => inventory._id)
                        DB.Maker.findByIdAndUpdate(newAccount._id, {inventory: inventoryIds}, {new:true})
                        .then(updatedMaker => {
                            console.log('maker updated with inventories', updatedMaker)
                            //create user and add maker and driver ids
                            DB.User.create({
                                first_name: req.body.first_name,
                                last_name: req.body.last_name,
                                email: req.body.email,
                                password: req.body.password,
                                phone: req.body.phone,
                                zipcode: req.body.zipcode,
                                region: req.body.region,
                                other: req.body.other,
                                maker: updatedMaker._id,
                                driver: newDriverAccount._id
                            }) 
                            .then(user => {
                                DB.User.findById(user._id)
                                .populate({
                                    path: 'maker',
                                    populate: {
                                        path: 'inventory',
                                        populate: {path: 'product'}
                                    }
                                })
                                .populate({
                                    path: 'driver',
                                    populate: {path: 'orders'}
                                })
                                .then(u => {
                                    let token = JWT.sign(u.toJSON(), process.env.JWT_SECRET, {
                                        expiresIn: 60 * 15
                                    });
                                    res.send({ token });
                                })
                                .catch(err => errorCatch(err, 'Error populating new user', res, 503, 'Internal Server Error'))
                            }) 
                            .catch(err => errorCatch(err, 'Error creating new user', res, 503, 'Internal Server Error'))
                        })
                        .catch(err => errorCatch(err, 'Error adding inventory to maker', res, 503, 'Internal Server Error'))
                    })          
                })
                .catch(err => errorCatch(err, 'Error creating new maker account', res, 503, 'Internal Server Error'))
            })
            .catch(err => errorCatch(err, 'Error creating new driver account', res, 503, 'Internal Server Error')) 
        }

        //IF OTHER
        else {
            console.log('creating new other')
            DB.User.create(req.body)
            .then(user => {
                let token = JWT.sign(user.toJSON(), process.env.JWT_SECRET, {
                    expiresIn: 60 * 15
                });
                res.send({ token });
            })
            .catch(err => errorCatch(err, 'Error creating new user', res, 503, 'Internal Server Error'))
        }
    })
    .catch(err => errorCatch(err, 'Error in POST auth/signup/volunteer', res, 503, 'Internal Server Error'))
});

//POST /auth/signup/order - sign up customer & place order request
ROUTER.post('/signup/order', (req, res) => {
    
    //FIRST check if user exists
        //if user already exists - prompt to log in and place order from there
    DB.User.findOne({email: req.body.email })
    .then(user => {
        // if user exists, error
        if (user) {
            return res.status(409).send({ message: 'Email already in use'});
        };

        //if new, create new customer THEN create user THEN create order - then populate user and send token
        if(req.body.customer.org_type)
        DB.Customer.create(req.body.customer)
        .then(newCustomer => {
            console.log('new customer created', newCustomer)
            //create new user with ref to customer id
            DB.User.create({
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                email: req.body.email,
                password: req.body.password,
                phone: req.body.phone,
                zipcode: req.body.zipcode,
                region: req.body.region,
                customer: newCustomer._id
            })
            .then(newUser => {
                console.log('new user created', newUser)
                let newOrders = []
                //create new orders
                ASYNC.forEach(req.body.productOrderDetails, (productOrder, done) => {
                    DB.Order.create({
                        customer: newUser._id,
                        item: productOrder
                    })
                    .then(newOrder => {
                        console.log('new order created', newOrder)
                        newOrders.push(newOrder)
                        done()
                    })
                    .catch(done)
                    }, 
                    //once all orders created, add the ids to the customer
                    () => {
                    
                    let orderIds = newOrders.map(order => order._id)
                    DB.Customer.findByIdAndUpdate(newCustomer._id, {orders: orderIds}, {new: true})
                    .then(updatedCustomer => {
                        console.log('customer updated', updatedCustomer)

                        //populate and send user token
                        DB.User.findById(newUser._id)
                        .populate({
                            path: 'customer',
                            populate: {path: 'orders'},
                            populate: {path: 'org_type'}
                        })
                        .then(user => {
                            // sign token to user
                            let token = JWT.sign(user.toJSON(), process.env.JWT_SECRET, {
                                expiresIn: 60 * 15
                            });
                            res.send({ token })
                        })
                        .catch(err => errorCatch(err, 'Error populating new user', res, 503, 'Internal Server Error')) 
                    })
                    .catch(err => errorCatch(err, 'Error updating new user', res, 503, 'Internal Server Error'))
                })     
            })
            .catch(err => errorCatch(err, 'Error creating new user', res, 503, 'Internal Server Error'))  
        })
        .catch(err => errorCatch(err, 'Error creating new organization', res, 503, 'Internal Server Error'))    
    })
    .catch(err => errorCatch(err, 'Error checking email', res, 503, 'Internal Server Error'))  
})

ROUTER.get('/info', (req, res) => {
    DB.Product.find().then(products => {
        DB.OrgType.find().then(orgTypes => {
            res.send({products, orgTypes})
        })
        .catch(err => errorCatch(err, 'Error finding org types', res, 503, 'Internal server error'))
    })
    .catch(err => errorCatch(err, 'Error finding products', res, 503, 'Internal server error'))
})


// DO WE NEED THIS?

// GET /current/user
ROUTER.get('/current/user', (req, res) => {
    // if user is logged in, req.user should have data
    console.log(req.user);
    if (!req.user || !req.user._id) {
        return res.status(417).send({ message: 'Expectation failed. Check config.' });
    };
        // Data from token issue
        // If updating user, sign token again after update
    res.send({ user: req.user });
});

module.exports = ROUTER;