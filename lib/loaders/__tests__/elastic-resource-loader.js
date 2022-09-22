const elasticsearch         = require('@elastic/elasticsearch');
const moment                = require('moment');
const nock                  = require('nock');
const path                  = require('path');
const winston               = require('winston');
const WinstonNullTransport  = require('winston-null-transport');

const ElasticResourceLoader = require('../elastic-resource-loader');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new WinstonNullTransport()
    ]
});

const VALID_CONFIG = {

};

describe('ElasticResourceLoader', () => {
    describe('constructor', () => {


    })

    describe('begin', () => {


    })

    describe('abort', () => {


    })

    describe('end', () => {


    })

    describe('ValidateConfig', () => {
        it('validates config', async() => {

        });


    })

    describe('GetInstance', () => {
        it('returns instance', async() => {

        });

    })

})