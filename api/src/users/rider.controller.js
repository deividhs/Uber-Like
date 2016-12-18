'use strict';

import uuid from 'uuid';
import { isMobilePhone, isEmail } from 'validator';
import bcrypt from 'bcrypt';
import EventEmitter from 'events';

import Rider from './rider.model';
import datetime from '../helpers/time';
import response from '../helpers/response';
import log from '../helpers/log';

const riderController = {};

riderController.add = (req, res) => {
    log.info('Hi! Adding a rider...');

    const firstname = req.body.firstname;
    const lastname = req.body.lastname;
    const email = req.body.email;
    const password = req.body.password;
    let phone = req.body.phone;

    // Split to avoid callbacks hell
    const checkEvent = new EventEmitter();

    const checking = () => {
        const errors = [];

        if (!lastname || !firstname || !phone ||
            !email || !password) {
            errors.push('missing_fields');
        } else {
            phone = `+33${req.body.phone.substr(1)}`;

            if (!isMobilePhone(phone, 'fr-FR')) {
                errors.push('incorrect_phone_number');
            } if (!isEmail(email)) {
                errors.push('incorrect_email_address');
            } if (password.length < 6) {
                errors.push('password_too_short');
            }

            if (errors.length === 0) {
                // We could use promises here, but I prefer this option

                const emailCheck = () => {
                    Rider.doesThisExist(['email', email], (result) => {
                        if (result) {
                            errors.push('email_address_already_taken');
                            checkEvent.emit('error', errors);
                        } else {
                            checkEvent.emit('success');
                        }
                    });
                };

                const phoneCheck = () => {
                    Rider.doesThisExist(['phone', phone], (result) => {
                        if (result) {
                            errors.push('phone_number_already_taken');
                            checkEvent.emit('error', errors);
                        } else {
                            emailCheck();
                        }
                    });
                };

                phoneCheck();
            }
        }

        if (errors.length > 0) {
            checkEvent.emit('error', errors);
        }
    };

    checkEvent.on('error', (errors) => {
        response.error(res, 400, errors);
    });

    checking();

    checkEvent.on('success', () => {
        /**
        * Generate password with 2^12 (4096) iterations for the algo.
        * Safety is priority here, performance on the side in this case
        * Become slower, but this is to "prevent" more about brute force attacks.
        * It will take more time during matching process, then more time to reverse it
        */
        bcrypt.hash(password, 12, (err, hash) => {
            const newRider = {
                lastname,
                firstname,
                phone,
                email,
                password: hash,
                uuid: uuid.v4(),
                created_at: datetime()
            };

            Rider.add(newRider, () => {
                response.successAdd(res, 'rider_added', `/riders/${newRider.uuid}`,
                    { rider: { uuid: newRider.uuid } }
                );
            });
        });
    });
};

riderController.getAll = (req, res) => {
    console.log('Hi! Getting all of the riders...');
    Rider.getAll((rows) => {
        res.json(rows);
    });
};

export default riderController;
