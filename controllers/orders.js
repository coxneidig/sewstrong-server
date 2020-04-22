const DB = require('../models');
const ROUTER = require('express').Router();

//helper functions
const errorCatch = require('../errorCatch') 

//GET /orders - view all orders (admin only)
ROUTER.get('/', (req, res) => {

    //if admin: view all info
    if(req.user.is_admin){
        DB.Order.find()
        .populate({
            path: 'customer',
            populate: {
                path: 'customer'
            }
        })
        .populate('item.product')
        .populate('drivers')
        .populate({
            path: 'makers',
            populate: {
                path: 'maker',
                populate: {
                    path: 'inventory',
                    populate: {path: 'product'}
                }
            }
        })
        .then(orders => {
            res.send(orders)
        })
        .catch(err => errorCatch(err, 'Error finding orders', res, 503, 'Internal Server Error')) 
    }
    else {
        res.status(403).send({message: 'Forbidden'})
        return
    }

})

//POST /orders (admin only for now)
ROUTER.post('/', (req, res) => {
    if(!req.user.is_admin && !req.user.customer) {
        res.status(403).send({message: 'Forbidden'})
    }

    //if req.body indicates user data, need to create new user & customer & order
    //else req.body will include existing customer id and will need to just create new order and push onto customer.orders

    if(req.body.user) {
        //FIRST check if user exists
        //if user already exists - prompt to choose from existing customers
    DB.User.findOne({email: req.body.user.email })
    .then(user => {
        // if user exists, error
        if (user) {
            return res.status(409).send({ message: 'Email already in use'});
        };

        //if new, create new customer THEN create user THEN create order - then populate user and send token
        DB.Customer.create(req.body.customer)
        .then(newCustomer => {
            console.log('new customer created', newCustomer)
            //create new user with ref to customer id
            DB.User.create({
                first_name: req.body.user.first_name,
                last_name: req.body.user.last_name,
                email: req.body.user.email,
                password: req.body.user.password,
                phone: req.body.user.phone,
                zipcode: req.body.user.zipcode,
                region: req.body.user.region,
                customer: newCustomer._id
            })
            .then(newUser => {
                console.log('new user created', newUser)  
                //create new order
                DB.Order.create({
                    customer: newCustomer._id,
                    item: req.body.item 
                })
                .then(order => {
                    //then add order id to customer
                    DB.Customer.findByIdAndUpdate(newCustomer._id, {orders: [order._id]}, {new: true})
                    .then(updatedCustomer => {
                        console.log('order added to customer', updatedCustomer)
                        res.send(order)
                    })
                    .catch(err => errorCatch(err, 'Error adding order to customer', res, 503, 'Internal Server Error')) 
                })
                .catch(err => errorCatch(err, 'Error creating order', res, 503, 'Internal Server Error')) 
            })
            .catch(err => errorCatch(err, 'Error creating new user', res, 503, 'Internal Server Error'))  
        })
        .catch(err => errorCatch(err, 'Error creating new customer', res, 503, 'Internal Server Error'))   
    })
    .catch(err => errorCatch(err, 'Error checking for email', res, 503, 'Internal Server Error')) 

       
    }
    else {
         //create new order
         DB.Order.create(req.body)
         .then(order => {
            //then add order id to customer
            DB.Customer.findByIdAndUpdate(req.body.customer, {$push : {orders: order}}, {new: true})
            .then(updatedCustomer => {
                console.log('order added to customer', updatedCustomer)
                res.send(order)
            })
         
         })
         .catch(err => errorCatch(err, 'Error creating order', res, 503, 'Internal Server Error')) 
    }
    
})


//GET /orders/demand - demand numbers available to everyone (not protected)
ROUTER.get('/demand', (req, res) => {
    DB.Order.find({completed_confirmed: false, cust_cancelled: false, admin_cancelled: false})
    .populate('item.product')
    .populate({
        path: 'customer',
        populate: {
            path: 'customer',
            populate: {
                path: 'org_type'
            }
        }
    })
    .then(orders => {
        let data = orders.map(order => {
            let organization 
            if(order.customer.customer.org_type) {
                organization = order.customer.customer.org_type.name == 'Other' ? order.customer.customer.org_type_other : order.customer.customer.org_type.name
            } 
            
            return ({
                product: order.item.product.name,
                demand: order.item.total,
                organization
            })
        })
        res.send(data)
    })
    .catch(err => errorCatch(err, 'Error finding customers', res, 503, 'Internal Server Error')) 

})


//PUT /:id - edit order details
ROUTER.put('/:id', (req, res) => {

    //if admin, can make updates to any order details
    if(req.user.is_admin) {
        DB.Order.findByIdAndUpdate(req.params.id, req.body, {new: true})
        .then(updatedOrder => {
            res.send(updatedOrder)
        })
        .catch(err => errorCatch(err, 'Error finding order', res, 503, 'Internal Server Error')) 
    }

    else {
        res.status(403).send({message: 'Forbidden'})
    }
})


//DELETE /:id - delete an order (admin only)
ROUTER.delete('/:id', (req, res) => {
    
    if(!req.user.is_admin) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    //delete order
    DB.Order.findByIdAndDelete(req.params.id)
    .then(deletedOrder => {
        res.send(deletedOrder)
    })
    .catch(err => errorCatch(err, 'Error finding and deleting order', res, 503, 'Internal Server Error'))

    //remove from drivers accounts
    DB.Driver.updateMany({orders: req.params.id}, {$pull: {orders: req.params.id}})
    .then(drivers => {
        console.log('removed from drivers?', drivers)
    })
    .catch(err => errorCatch(err, 'Error finding and deleting order from driver', res, 503, 'Internal Server Error'))

    //remove from customers accounts
    DB.Customer.updateMany({orders: req.params.id}, {$pull: {orders: req.params.id}})
    .then(customers => {
        console.log('removed from customers?', customers)
    })
    .catch(err => errorCatch(err, 'Error finding and deleting order from customer', res, 503, 'Internal Server Error'))

})


module.exports = ROUTER;