//dependencies
require('dotenv').config();
const JWT = require('jsonwebtoken');
const DB = require('../models');
const ROUTER = require('express').Router();

//helper functions
const errorCatch = require('../errorCatch') 

// PUT /profile/:id - edit user info and reissue token
ROUTER.put('/:id', (req, res) => {
    DB.User.findByIdAndUpdate(req.params.id, req.body, {new: true})
    .then(updatedUser => {
        let token = JWT.sign(updatedUser.toJSON(), process.env.JWT_SECRET, {
            expiresIn: 60 * 15
        })
        res.send({ token })
    })
    .catch(err => errorCatch(err, 'Error updating user', res, 503, 'Internal Server Error'))
})


//NEED THIS ROUTE? Going to have all of their user info in their token
// GET /profile/:id - show user info
ROUTER.get('/:id', (req, res) => {
    DB.User.findById(req.params.id)
    .then(user => {
        res.send(user)
    })
    .catch(err => errorCatch(err, 'Error finding user', res, 503, 'Internal Server Error'))
})

module.exports = ROUTER;