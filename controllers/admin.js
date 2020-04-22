const DB = require('../models');
const ROUTER = require('express').Router();

//helper functions
const errorCatch = require('../errorCatch') 


//GET ALL DATA FOR ADMIN
ROUTER.get('/', (req, res) => {

    //FORBIDDEN if rq coming from source other than admin
    if(!req.user.is_admin) {
        res.status(403).send({message: 'Forbidden'})
        return
    }

    let data = []
    //find all volunteers 
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
        //add volunteers to data object
        data.push({volunteers: volunteers})
        
        //find all customers
        DB.User.find({customer: {$exists: true}})
        .populate({
            path: 'customer',
            populate: {
                path: 'orders',
                populate: {path: 'item.product'},
                populate: {path: 'org_type'}
            }
        })
        .then(customers => {
            //add customers to data object
            data.push({customers: customers})

            //find all orders
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
            .then(ords => {

                let orders = ords.map(ord => {
                    let makers = ord.makers.map(maker => {
                        let makerInventoryForThisOrder = maker.maker.inventory.filter(inv => inv.product.name === ord.item.product.name)
                        
                        return (
                            {
                                _id: maker._id,
                                is_admin: maker.is_admin,
                                first_name: maker.first_name,
                                last_name: maker.last_name,
                                email: maker.email,
                                phone: maker.phone,
                                zipcode: maker.zipcode,
                                region: maker.region,
                                other:maker.other,
                                maker: {
                                    _id: maker._id,
                                    inventory: makerInventoryForThisOrder,
                                    is_team_lead: maker.is_team_lead,
                                    address_one: maker.address_one,
                                    address_two: maker.address_two,
                                    city: maker.city,
                                    state: maker.state
                                }
                            }  
                        )
                    })
                    
                    return (
                        {
                            _id: ord._id,
                            customer: ord.customer,
                            item: ord.item,
                            accepted: ord.accepted,
                            in_progress: ord.in_progress,
                            ready_for_delivery: ord.ready_for_delivery,
                            in_delivery: ord.in_delivery,
                            completed: ord.completed,
                            completed_confirmed: ord.completed_confirmed,
                            cust_cancelled: ord.cust_cancelled,
                            admin_cancelled: ord.admin_cancelled,
                            createdAt: ord.createdAt,
                            updatedAt: ord.updatedAt,
                            drivers: ord.drivers,
                            makers: makers
                        }
                    )
                }) 

                data.push({orders: orders})
                res.send(data)
            })
            .catch(err => errorCatch(err, 'Error finding orders', res, 503, 'Internal Server Error'))
        })
        .catch(err => errorCatch(err, 'Error finding customers', res, 503, 'Internal Server Error'))
    })
    .catch(err => errorCatch(err, 'Error finding volunteers', res, 503, 'Internal Server Error'))

})


module.exports = ROUTER;