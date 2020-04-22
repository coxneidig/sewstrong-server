const DB = require('../models');
const ROUTER = require('express').Router();
const ASYNC = require('async')

//helper functions
const errorCatch = require('../errorCatch') 

//THIS VERSION OF THE GET ROUTE WILL NEED TO CHANGE/THIS IS TAKEN CARE OF IN ADMIN ROUTE
//THIS ROUTE CAN BE FOR TEAM LEADS TO VIEW VOLUNTEERS IN THEIR REGION/ON THEIR TEAM
// GET /volunteers - find all volunteers (admin)
ROUTER.get('/', (req, res) => {
    
     //if rq coming from source other than admin
    if(!req.user.is_admin) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    //find all volunteers (!customer fields exist for the user)
    DB.User.find({customer: {$exists: false}, is_admin: false})
    .populate({
        path: 'maker',
        populate: {
            path: 'inventory',
            populate: {path: 'product'}
        }
    })
    .populate('driver')
    .then(volunteers => {
        res.send(volunteers)
    })
    .catch(err => errorCatch(err, 'Error finding volunteers', res, 503, 'Internal Server Error'))
})

ROUTER.get('/inventory/:id', (req, res) => {
      //if not admin or user w/ maker id === req.body.maker, send forbidden
      if(!req.user.is_admin && (req.user.maker && (req.user.maker._id != req.params.id))) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    DB.Inventory.find({maker: req.params.id})
    .populate('product')
    .then(inventory => {
        res.send(inventory)
    })
    .catch(err => errorCatch(err, 'Error finding inventory', res, 503, 'Internal Server Error'))
})

//PUT /volunteers/inventory - admin or volunteer/maker post new production inventory
ROUTER.put('/inventory', (req, res) => {

    //if not admin or user w/ maker id === req.body.maker, send forbidden
    if(!req.user.is_admin && (req.user.maker && (req.user.maker._id != req.body.maker))) {
        res.status(403).send({message: 'Forbidden'})
        return
    }
    
    //check if inventory already exists for this maker for this product
        //if does, update within the inventory model and then send back the updated inventory
        //if does not, create new inventory in inventory model, then find maker for current user and push inventory id into inventory array
            //will need to create new token

    //check inventory for document with current maker and productid in req.body
    DB.Inventory.findOne({maker: req.body.maker, product: req.body.product})
    .then(inventory => {
        //if exists, update
        if(inventory) {
            console.log('inventory already exists', inventory)
            DB.Inventory.findByIdAndUpdate(inventory._id, req.body, {new: true})
            .then(updatedInventory => {
                console.log('updated inventory', updatedInventory)
                res.send(updatedInventory)
            })
            .catch(err => errorCatch(err, 'Error updating inventory', res, 503, 'Internal Server Error'))
        }
        else {
            //otherwise, create new & push into maker
            console.log('inventory does not exist, creating:', req.body)
            DB.Inventory.create(req.body)
            .then(newInventory => {
                DB.Maker.findById(req.body.maker)
                .then(maker => {
                    maker.inventory.push(newInventory._id)
                    maker.save()
                    .then(updatedMaker => {
                        res.send(updatedMaker)
                    })
                    .catch(err => errorCatch(err, 'Error adding inventory to maker', res, 503, 'Internal Server Error'))
                })
                .catch(err => errorCatch(err, 'Error finding maker', res, 503, 'Internal Server Error'))
            })
            .catch(err => errorCatch(err, 'Error creating inventory', res, 503, 'Internal Server Error'))
        }
    })
    .catch(err => errorCatch(err, 'Error looking for inventory', res, 503, 'Internal Server Error'))
})

//POST /volunteers/account/:id - create new account and add to existing user
ROUTER.post('/account/:id', (req, res) => {
    
     //if not admin or user w/ params id, send forbidden
     if(!req.user.is_admin && req.user._id !== req.params.id) {
        res.status(403).send({message: 'Forbidden'})
        return
    }


    //if req.body.maker: create new maker account, create new blank inventories, and add to maker, then find user and update to add new maker id
    if(req.body.maker) {
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
            //once all inventories created, add ids to maker, then find user and add new maker id
            () => {
                let inventoryIds = newInventories.map(inventory => inventory._id)
                DB.Maker.findByIdAndUpdate(newAccount._id, {inventory: inventoryIds}, {new:true})
                .then(updatedMaker => {
                    console.log('maker updated with inventories', updatedMaker)
                    //then find user and update with new maker ref
                    DB.User.findByIdAndUpdate(
                        req.params.id, 
                        {maker: updatedMaker._id}, 
                        {new: true}) 
                    .then(updatedUser => {
                        res.send(updatedUser)
                    }) 
                    .catch(err => errorCatch(err, 'Error updating user', res, 503, 'Internal server error'));
                })
                .catch(err => errorCatch(err, 'Error adding inventory to maker', res, 503, 'Internal server error'));
            })
        })
        .catch(err => errorCatch(err, 'Error creating new maker account', res, 503, 'Internal server error'));
    }
    //else if req.body.driver: create new driver, then update user/add driver
    else if(req.body.driver) {
        DB.Driver.create(req.body.driver)
        .then(newDriver => {
            //then find user and update with new driver ref
            DB.User.findByIdAndUpdate(
                req.params.id, 
                {driver: newDriver._id}, 
                {new: true}) 
            .then(updatedUser => {
                res.send(updatedUser)
            }) 
            .catch(err => errorCatch(err, 'Error updating user', res, 503, 'Internal server error'));
        })
        .catch(err => errorCatch(err, 'Error creating new driver account', res, 503, 'Internal server error'));
    }
    //else if req.body.makerdriver: 
        //create new maker, create blank inventories, add inventories to maker
        //then create new driver
        //then find user and update with new ids
    else if(req.body.makerdriver) {

        DB.Maker.create(req.body.makerdriver.maker)
        .then(newAccount => {
            let newInventories = []
            //create new blank inventory for each product
            ASYNC.forEach(req.body.makerdriver.inventory, (product, done) => {
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
            //once all inventories created, add ids to maker, then add refs to user
            () => {
                let inventoryIds = newInventories.map(inventory => inventory._id)
                DB.Maker.findByIdAndUpdate(newAccount._id, {inventory: inventoryIds}, {new:true})
                .then(updatedMaker => {
                    console.log('maker updated with inventories', updatedMaker)
                    DB.Driver.create(req.body.makerdriver.driver)
                    .then(newDriver => {
                        //then find user and update with new driver ref
                        DB.User.findByIdAndUpdate(
                            req.params.id, 
                            {driver: newDriver._id, maker: updatedMaker._id}, 
                            {new: true}) 
                        .then(updatedUser => {
                            res.send(updatedUser)
                        }) 
                        .catch(err => errorCatch(err, 'Error updating user', res, 503, 'Internal server error'));
                    })
                    .catch(err => errorCatch(err, 'Error creating new driver account', res, 503, 'Internal server error'));
                })
                .catch(err => errorCatch(err, 'Error adding inventory to maker', res, 503, 'Internal server error'));
            })
        })
        .catch(err => errorCatch(err, 'Error creating new maker account', res, 503, 'Internal server error'));
    }
})

ROUTER.put('/account/:id', (req, res) => {
    
    //if not admin or user w/ params id, send forbidden
    if(!req.user.is_admin && req.user._id !== req.params.id) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    //remove specified accounts from user
    if(req.body.removeAccount === 'maker') {
        DB.User.findByIdAndUpdate(
            req.params.id,
            {$unset: {maker: ""}},
            {new: true}
        )
        .then(updatedUser => {
            res.send(updatedUser)
        })
        .catch(err => errorCatch(err, 'Error finding user or removing account', res, 503, 'Internal server error'))
    }
    else if(req.body.removeAccount === 'driver') {
        DB.User.findByIdAndUpdate(
            req.params.id,
            {$unset: {driver: ""}},
            {new: true}
        )
        .then(updatedUser => {
            res.send(updatedUser)
        })
        .catch(err => errorCatch(err, 'Error finding user or removing account', res, 503, 'Internal server error'))
    }
    else if(req.body.removeAccount === 'maker+driver') {
        DB.User.findByIdAndUpdate(
            req.params.id,
            {$unset: {driver: "", maker: ""}},
            {new: true}
        )
        .then(updatedUser => {
            res.send(updatedUser)
        })
        .catch(err => errorCatch(err, 'Error finding user or removing account', res, 503, 'Internal server error'))
    }
    else {
        res.status(403).send({message: 'Forbidden'})
    }
})

//PUT /volunteers/:id - update volunteer info (admin)
ROUTER.put('/:id', (req, res) => {

    //if it not admin, can't use this route (for now)
    if(!req.user.is_admin) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    
    //***MAKER UPDATES***/
        //find user and update, then find maker w/ user.maker id and update 
    if(req.body.maker) {
        DB.User.findByIdAndUpdate(
            req.params.id, 
            req.body.user, 
            {new: true})
        .then(updatedUser => {
            DB.Maker.findByIdAndUpdate(
                updatedUser.maker,
                req.body.maker, 
                {new: true})
            .then(updatedMaker => {
                res.send({updatedMaker, updatedUser})
            })
            .catch(err => errorCatch(err, 'Error finding and updating maker', res, 503, 'Internal server error'))
        })
        .catch(err => errorCatch(err, 'Error finding and updating volunteer', res, 503, 'Internal server error'))
    }
     
    //***DRIVER UPDATES***/
        //find user and update, then find driver w/ user.driver id and update
    else if(req.body.driver) {
        DB.User.findByIdAndUpdate(
            req.params.id, 
            req.body.user, 
            {new: true})
        .then(updatedUser => {
            DB.Driver.findByIdAndUpdate(
                updatedUser.driver,
                req.body.driver, 
                {new: true})
            .then(updatedDriver => {
                res.send({updatedDriver, updatedUser})
            })
            .catch(err => errorCatch(err, 'Error finding and updating driver', res, 503, 'Internal server error'))
        })
        .catch(err => errorCatch(err, 'Error finding and updating volunteer', res, 503, 'Internal server error'))
    }   

    //***MAKER+DRIVER UPDATES***/
        //find user and update
        //then find driver w/ user.driver id and update(req.body.makerdriver.driver)
        //then find maker w/ user.maker id and update(req.body.makerdriver.maker)
    else if(req.body.makerdriver){
        DB.User.findByIdAndUpdate(
            req.params.id, 
            req.body.user, 
            {new: true})
        .then(updatedUser => {
            DB.Driver.findByIdAndUpdate(
                updatedUser.driver,
                req.body.makerdriver.driver, 
                {new: true})
            .then(updatedDriver => {
                DB.Maker.findByIdAndUpdate(
                    updatedUser.maker,
                    req.body.makerdriver.maker,
                    {new: true}
                )
                .then(updatedMaker => {
                    res.send({updatedDriver, updatedMaker, updatedUser})
                })
                .catch(err => errorCatch(err, 'Error finding and updating maker', res, 503, 'Internal server error'))
            })
            .catch(err => errorCatch(err, 'Error finding and updating driver', res, 503, 'Internal server error'))
        })
        .catch(err => errorCatch(err, 'Error finding and updating volunteer', res, 503, 'Internal server error'))
    }   

    //***USER ONLY UPDATES***/
    else {
        DB.User.findByIdAndUpdate(
            req.params.id,
            req.body.user,
            {new: true})
        .then(updatedUser => {
            res.send(updatedUser)
        })
        .catch(err => errorCatch(err, 'Error finding and updating volunteer', res, 503, 'Internal server error'))
    }
})

module.exports = ROUTER;