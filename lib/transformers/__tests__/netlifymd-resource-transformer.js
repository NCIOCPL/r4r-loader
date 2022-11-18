const axios                 = require('axios');
const fs                    = require('fs');
const https                 = require('https');
const nock                  = require('nock');
const winston               = require('winston');
const WinstonNullTransport  = require('winston-null-transport');
const path                  = require('path');
const util                  = require('util');
const unified               = require('unified');
const markdown              = require('remark-parse');
const remark2rehype         = require('remark-rehype');
const html                  = require('rehype-stringify');
const minify                = require('rehype-preset-minify');

// Convert fs.readFile into Promise version of same
const readFileAsync = util.promisify(fs.readFile);


const NetlifyMdResourceTransformer    = require('../netlifymd-resource-transformer');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new WinstonNullTransport()
    ]
});


const VALID_CONFIG = {
    mappingUrls: {
        docs: "https://example.org/bryanpizzillo/r4rcontent/master/data/docs.json",
        researchAreas: "https://example.org/bryanpizzillo/r4rcontent/master/data/researchAreas.json",
        researchTypes: "https://example.org/bryanpizzillo/r4rcontent/master/data/researchTypes.json",
        toolTypes: "https://example.org/bryanpizzillo/r4rcontent/master/data/toolTypes.json"
    }
};

const DOCS_EXPECTED = require('./data/facets/docs.expected.json');
const RESEARCHAREAS_EXPECTED = require('./data/facets/researchAreas.expected.json');
const RESEARCHTYPES_EXPECTED = require('./data/facets/researchTypes.expected.json');
const TOOLTYPES_EXPECTED = require('./data/facets/toolTypes.expected.json');

const TEST_FILE_PATH = path.join(__dirname, 'data', 'facets');


const httpAdapterPath = path.join(
    path.dirname(require.resolve('axios')),
    'lib/adapters/http'
);
const httpAdapter = require(httpAdapterPath);
axios.defaults.adapter = httpAdapter;

const DEFAULT_MDPROCESSOR = unified()
    .use(markdown)
    .use(remark2rehype)
    .use(html)
    .use(minify); //For testing remove new lines and extra spaces

describe('NetlifyMdResourceTransformer', () => {

    describe('Constructor', () => {

        it('throws errors on no mappings', () => {
            const axclient = axios.create({});

            expect(() => {
                new NetlifyMdResourceTransformer(
                    logger,
                    axclient,
                    DEFAULT_MDPROCESSOR,
                    {...VALID_CONFIG, mappingUrls: null }
                )
            }).toThrow("Mapping URLs are not valid");
        })

        it('throws errors on invalid mappings', () => {
            const axclient = axios.create({});

            expect(() => {
                new NetlifyMdResourceTransformer(
                    logger,
                    axclient,
                    DEFAULT_MDPROCESSOR,
                    {...VALID_CONFIG, mappingUrls: { docs: "string", researchAreas: {}} }
                )
            }).toThrow("Mapping URLs are not valid");
        })

        it('creates as expected', () => {

            const axclient = axios.create({});
            const xformer = new NetlifyMdResourceTransformer(
                logger,
                axclient,
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            )

            expect(xformer).not.toBeNull();
            expect(xformer.logger).toBe(logger);
            expect(xformer.axclient).toBe(axclient);
            expect(xformer.mappingUrls).toBe(VALID_CONFIG.mappingUrls);
        })

    })


    describe('GetInstance', () => {

        it('returns an instance', async () => {
            const transformer = await NetlifyMdResourceTransformer.GetInstance(logger, VALID_CONFIG)
            expect(transformer).toBeInstanceOf(NetlifyMdResourceTransformer);
            expect(transformer.axclient).not.toBeNull();
            expect(transformer.mappingUrls).toMatchObject(VALID_CONFIG.mappingUrls);
            expect(transformer.logger).toBe(logger);
        })
    })

    describe('ValidateConfig', () => {

        it('makes sure config is valid', () => {
            const errors = NetlifyMdResourceTransformer.ValidateConfig(VALID_CONFIG);
            expect(errors).toHaveLength(0);
        })

        it('returns an error when config null', () => {
            const expected = [new Error("Config is not object or null")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig();
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when invalid', () => {
            const expected = [new Error("Config is not valid - mappingUrls is missing or invalid")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig({});
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when config has invalid mapping urls', () => {
            const expected = [new Error("Config is not valid - mappingUrls is missing or invalid")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig({ mappingUrls: "bad"});
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when extra options', () => {
            const expected = [new Error("Config is not valid - mappingUrls is missing or invalid")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig({ foo: {}, mappingUrls: {} });
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when mappingUrls bad', () => {
            const expected = [
                new Error("Mapping config for docs is invalid"),
                new Error("Mapping config for researchAreas is invalid"),
                new Error("Mapping config for researchTypes is invalid"),
                new Error("Mapping config for toolTypes is invalid")
            ]
            const errors = NetlifyMdResourceTransformer.ValidateConfig(
                {
                    mappingUrls: {
                        docs: false,
                        researchAreas: false,
                        researchTypes: false,
                        toolTypes: false
                    }
                }
            );
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

    })

    describe('getMappingFile', () => {

        it('fetches a single file', async() => {
            let scope = nock('https://example.org')
                .get("/bryanpizzillo/r4rcontent/master/data/docs.json")
                .replyWithFile(200, path.join(TEST_FILE_PATH, 'docs.json'))

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            await transformer.getMappingFile("test", "https://example.org/bryanpizzillo/r4rcontent/master/data/docs.json");

            expect(transformer.facetMaps).toMatchObject({test: DOCS_EXPECTED});
        })

        it('throws on 404', async() => {
            let scope = nock('https://example.org')
            .get("/bryanpizzillo/r4rcontent/master/data/foo.json")
            .reply(404);

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            expect.assertions(1);

            try {
                await transformer.getMappingFile("test", "https://example.org/bryanpizzillo/r4rcontent/master/data/foo.json");
            } catch (err) {
                expect(err).toMatchObject({
                    message: "Request failed with status code 404"
                });
            }
        })

        it('throws on invalid json', async() => {
            let scope = nock('https://example.org')
            .get("/bryanpizzillo/r4rcontent/master/data/badData.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'badData.json'));

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            expect.assertions(1);

            try {
                await transformer.getMappingFile("test", "https://example.org/bryanpizzillo/r4rcontent/master/data/badData.json");
            } catch (err) {
                expect(err).toMatchObject({
                    message: "Could not load json map"
                });
            }
        })

    })

    describe('begin', () => {

        it('loads the mapping files from web', async () => {

            let scope = nock('https://example.org')
                .get("/bryanpizzillo/r4rcontent/master/data/docs.json")
                .replyWithFile(200, path.join(TEST_FILE_PATH, 'docs.json'))
                .get("/bryanpizzillo/r4rcontent/master/data/researchAreas.json")
                .replyWithFile(200, path.join(TEST_FILE_PATH, 'researchAreas.json'))
                .get("/bryanpizzillo/r4rcontent/master/data/researchTypes.json")
                .replyWithFile(200, path.join(TEST_FILE_PATH, 'researchTypes.json'))
                .get("/bryanpizzillo/r4rcontent/master/data/toolTypes.json")
                .replyWithFile(200, path.join(TEST_FILE_PATH, 'toolTypes.json'))

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            await transformer.begin();

            expect(transformer.facetMaps).toMatchObject({
                docs: DOCS_EXPECTED,
                researchTypes: RESEARCHTYPES_EXPECTED,
                researchAreas: RESEARCHAREAS_EXPECTED,
                toolTypes: TOOLTYPES_EXPECTED
            });

        })

        it('throws an error when an error occurs while loading', async () => {
            let scope = nock('https://example.org')
            .get("/bryanpizzillo/r4rcontent/master/data/docs.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'docs.json'))
            .get("/bryanpizzillo/r4rcontent/master/data/researchAreas.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'researchAreas.json'))
            .get("/bryanpizzillo/r4rcontent/master/data/researchTypes.json")
            .reply(404)
            .get("/bryanpizzillo/r4rcontent/master/data/toolTypes.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'badData.json'))

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            expect.assertions(1);
            try {
                await transformer.begin();
            } catch(err) {
                //We don't care about the type of error as long as one was thrown
                expect(err).toBeTruthy();
            }

        })


    })

    //End does nothing now, so this is just a test to call it.
    describe('end', () => {
        it('ends correctly', async () => {
            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            expect.assertions(0);
            await transformer.end();
        })
    })

    describe('explodeToolSubtypeFacet', () => {
        const transformer = new NetlifyMdResourceTransformer(
            logger,
            axios.create({}),
            DEFAULT_MDPROCESSOR,
            VALID_CONFIG
        );

        it('works for type/subtype', () => {

            const item = { "label": "Datasets & Databases - Clinical Data", "key": "datasets_databases/clinical_data" };

            const expected = { "key": "clinical_data", "label": "Clinical Data", "parentKey": "datasets_databases" };

            const actual = transformer.explodeToolSubtypeFacet(item);

            expect(actual).toEqual(expected);
        });

        it('throws when key is not valid', () => {
            const item = { "label": "A - B - C", "key": "a/b/c" };

            expect(() => {
                transformer.explodeToolSubtypeFacet(item);
            }).toThrow("Tool Type Key for Type/Subtype does not match expected format");
        });

        it('throws when label is not valid', () => {
            const item = { "label": "A - B - C", "key": "a/b" };
            expect(() => {
                transformer.explodeToolSubtypeFacet(item);

            }).toThrow("Tool Type Label for Type/Subtype does not match expected format");
        });

    });

    describe('explodeToolTypeFacet', () => {

        const transformer = new NetlifyMdResourceTransformer(
            logger,
            axios.create({}),
            DEFAULT_MDPROCESSOR,
            VALID_CONFIG
        );

        it('works for type/subtype', () => {

            const item = { "label": "Datasets & Databases - Clinical Data", "key": "datasets_databases/clinical_data" };

            const expected = { "key": "datasets_databases", "label": "Datasets & Databases" };

            const actual = transformer.explodeToolTypeFacet(item);

            expect(actual).toEqual(expected);
        });

        it('works for type only', () => {
            const item = { "label": "Datasets & Databases", "key": "datasets_databases" };

            const expected = { "key": "datasets_databases", "label": "Datasets & Databases" };

            const actual = transformer.explodeToolTypeFacet(item);

            expect(actual).toEqual(expected);
        });

        it('throws when key is not valid', () => {
            const item = { "label": "A - B - C", "key": "a/b/c" };

            expect(() => {
                transformer.explodeToolTypeFacet(item);
            }).toThrow("Tool Type Key for Type/Subtype does not match expected format");
        });

        it('throws when label is not valid', () => {
            const item = { "label": "A - B - C", "key": "a/b" };
            expect(() => {
                transformer.explodeToolTypeFacet(item);

            }).toThrow("Tool Type Label for Type/Subtype does not match expected format");
        });
    })

    describe('transform', () => {

        it('throws an error for bad documents', async () => {
            //expect(false).toBeTruthy();
        })

        it('transforms the resource', async () => {

            let scope = nock('https://example.org')
            .get("/bryanpizzillo/r4rcontent/master/data/docs.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'docs.json'))
            .get("/bryanpizzillo/r4rcontent/master/data/researchAreas.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'researchAreas.json'))
            .get("/bryanpizzillo/r4rcontent/master/data/researchTypes.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'researchTypes.json'))
            .get("/bryanpizzillo/r4rcontent/master/data/toolTypes.json")
            .replyWithFile(200, path.join(TEST_FILE_PATH, 'toolTypes.json'))

            //Load our MD file.
            const rawResource = await readFileAsync(path.join(TEST_FILE_PATH, '..', 'full_item.md'));

            //Load expected object
            const expResource = require('./data/full_item.expected.json');

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                axios.create({}),
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            await transformer.begin();

            const transformed = await transformer.transform(rawResource);

            expect(transformed).toEqual(expResource);
        })

    })

})

