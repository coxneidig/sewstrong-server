const DB = require('../models');
const ROUTER = require('express').Router();

//helper functions
const errorCatch = require('../errorCatch')

//GET /customers - show all customers & organizations info - if admin
ROUTER.get('/', (req, res) => {
    if(!req.user.is_admin) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    DB.User.find({customer: {$exists: true}})
    .populate({
        path: 'customer',
        populate: {
            path: 'orders',
            populate: {path: 'item.product'}
        }
    })
    .then(customers => {
        res.send(customers)
    })
    .catch(err => errorCatch(err, 'Error finding customers', res, 503, 'Internal Server Error')) 
})


//PUT /customers/:id - update 1 customer info (admin only)
ROUTER.put('/:id', (req, res) => {
    if(!req.user.is_admin){
        res.status(403).send({message: 'Forbidden'})
        return
    }

    //if has updates to customer account:
    if(req.body.customer) {
        DB.User.findByIdAndUpdate(req.params.id, req.body.user, {new: true})
        .then(updatedUser => {
            DB.Customer.findByIdAndUpdate(updatedUser.customer._id, req.body.customer, {new: true})
            .then(updatedCustomer => {
                res.send(updatedUser)
            })
            .catch(err => errorCatch(err, 'Error updating customer account', res, 503, 'Internal server error'))
            
        })
        .catch(err => errorCatch(err, 'Error updating customer user info', res, 503, 'Internal server error'))
    }
    //if just user updates
    else {
        DB.User.findByIdAndUpdate(
            req.params.id, 
            req.body.user, 
            {new: true})
        .then(updatedUser => {
            res.send(updatedUser)        
        })
        .catch(err => errorCatch(err, 'Error updating customer user info', res, 503, 'Internal server error'))
    }
})






//NOT UPDATED/NOT NEEDED FOR V1(I DONT THINK)


//GET /customers/:id - show 1 customer info (customer should be only one to need this route)
ROUTER.get('/:id', (req, res) => {
    if(!req.user.customer){
        res.status(403).send({message: 'Forbidden'})
        return
    }

    DB.User.findById(req.params.id)
    .populate('orders')
    .then(user => {
        res.send(user)
    })
    .catch(err => errorCatch(err, 'Error finding customer', res, 503, 'Internal Server Error')) 
})



module.exports = ROUTER;