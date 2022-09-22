const {Octokit}             = require('@octokit/rest');
const axios                 = require('axios');
const https                 = require('https');
const moment                = require('moment');
const nock                  = require('nock');
const path                  = require('path');
const winston               = require('winston');
const WinstonNullTransport  = require('winston-null-transport');

const GithubResourceSource = require('../github-resource-source');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new WinstonNullTransport()
    ]
});

const VALID_CONFIG = {
    repoUrl: 'https://github.com/NCIOCPL/r4r-content'
};

describe('GithubResourceSource', () => {
    describe('constructor', () => {

        const agent = new https.Agent({
            keepAlive: true,
            maxSockets: 80
        });
        const client = new Octokit({
            agent: agent
        });

        const axclient = axios.create({
            httpsAgent: agent
        });


        it('Creates with defaults', () => {

            const source = new GithubResourceSource(logger, client, axclient, VALID_CONFIG);
            expect(source.client).toBe(client);
            expect(source.axclient).toBe(axclient);
            expect(source.owner).toEqual("NCIOCPL");
            expect(source.repo).toEqual("r4r-content");
            expect(source.resourcesPath).toEqual("/resources");
            expect(source.branchName).toBeFalsy();
        });

        it('Creates with defaults, custom ', () => {

            const source = new GithubResourceSource(
                logger,
                client,
                axclient,
                {
                    ...VALID_CONFIG,
                    resourcesPath: '/test'
                });
            expect(source.client).toBe(client);
            expect(source.axclient).toBe(axclient);
            expect(source.owner).toEqual("NCIOCPL");
            expect(source.repo).toEqual("r4r-content");
            expect(source.resourcesPath).toEqual("/test");
            expect(source.branchName).toBeFalsy();
        });

        it('Creates with defaults, branch ', () => {

            const source = new GithubResourceSource(
                logger,
                client,
                axclient,
                {
                    ...VALID_CONFIG,
                    resourcesPath: '/test',
                    branchName: 'test'
                });
            expect(source.client).toBe(client);
            expect(source.axclient).toBe(axclient);
            expect(source.owner).toEqual("NCIOCPL");
            expect(source.repo).toEqual("r4r-content");
            expect(source.resourcesPath).toEqual("/test");
            expect(source.branchName).toEqual('test');
        });

        it('Gracefully throws an error on bad repo url ', () => {

            expect(() => {
                const source = new GithubResourceSource(
                    logger,
                    client,
                    axclient,
                    {
                        repoUrl: "chicken"
                    });
                }).toThrowError("Failed to parse github url");
        });

        it('Gracefully throws an error missing repo url ', () => {

            expect(() => {
                const source = new GithubResourceSource(
                    logger,
                    client,
                    axclient,
                    {
                    });
                }).toThrowError("You must supply a repository URL");
        });

    })

    describe('begin', () => {


    })

    describe('abort', () => {

    })

    describe('end', () => {


    })

    describe('ValidateConfig', () => {
        it('validates config', () => {
            const actual = GithubResourceSource.ValidateConfig(VALID_CONFIG);
            expect(actual).toEqual([]);
        });

        it('errors config', () => {
            const actual = GithubResourceSource.ValidateConfig({});
            expect(actual).toEqual([new Error("You must supply a repository URL")]);
        });

    })

    describe('GetInstance', () => {
        it('gets instance, no auth', async() => {
            const actual = await GithubResourceSource.GetInstance(logger, VALID_CONFIG);
            expect(actual.client).toBeTruthy();
            expect(actual.axclient).toBeTruthy();
            expect(actual.owner).toEqual("NCIOCPL");
            expect(actual.repo).toEqual("r4r-content");
            expect(actual.resourcesPath).toEqual("/resources");
            expect(actual.branchName).toBeFalsy();
        });


        it('gets instance, with auth', async() => {

            //NOTE: the internal git client's authenticate method does
            //nothing more then setup an object in memory that adds a
            //set of headers before every request. So we can't really check
            //that without a mock. Creating a mock for octokit and authenticate
            //will be tricky.
            const actual = await GithubResourceSource.GetInstance(logger,
                            {
                                ...VALID_CONFIG,
                                authentication: {
                                    type: "token",
                                    token: "SECRET"
                                }
                            });
            expect(actual.client).toBeTruthy();
            expect(actual.axclient).toBeTruthy();
            expect(actual.owner).toEqual("NCIOCPL");
            expect(actual.repo).toEqual("r4r-content");
            expect(actual.resourcesPath).toEqual("/resources");
            expect(actual.branchName).toBeFalsy();
        });


    it('throws an error if config is not defined', async() => {
        try {
            const actual = await GithubResourceSource.GetInstance(logger);
        } catch (err) {
            expect(err).not.toBeNull();
        }
    });


    })

})