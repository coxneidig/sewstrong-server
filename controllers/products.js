const DB = require('../models');
const ROUTER = require('express').Router();

//helper functions
const errorCatch = require('../errorCatch') 

//GET  /products - All products
ROUTER.get('/', (req, res) => {
    DB.Product.find().then(products => res.send(products))
    .catch(err => errorCatch(err, 'Error finding products', res, 503, 'Internal Server Error'))
})


//POST /products - Create new product (admin only)
ROUTER.post('/', (req, res) => {
    
    if(req.user.adminPermissions) {

        DB.Product.create(req.body)
        .then(product => res.send({message: `${product.name} : ${product.startDate}`}))
        .catch(err => errorCatch(err, 'Error creating product', res, 503, 'Internal Server Error'))
    }
    else {
        res.status(403).send({message: 'Forbidden'})
    }
   
})

module.exports = ROUTER;