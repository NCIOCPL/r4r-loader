const fsp                   = require('fs/promises');
const winston               = require('winston');
const WinstonNullTransport  = require('winston-null-transport');
const path                  = require('path');
const unified               = require('unified');
const markdown              = require('remark-parse');
const remark2rehype         = require('remark-rehype');
const html                  = require('rehype-stringify');
const minify                = require('rehype-preset-minify');


const NetlifyMdResourceTransformer    = require('../netlifymd-resource-transformer');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new WinstonNullTransport()
    ]
});


const VALID_CONFIG = {
    mappingFiles: {
        docs: "../mapping/docs.json",
        researchAreas: "../mapping/researchAreas.json",
        researchTypes: "../mapping/researchTypes.json",
        toolTypes: "../mapping/toolTypes.json"
    }
};

const DOCS_EXPECTED = require('./data/facets/docs.expected.json');
const RESEARCHAREAS_EXPECTED = require('./data/facets/researchAreas.expected.json');
const RESEARCHTYPES_EXPECTED = require('./data/facets/researchTypes.expected.json');
const TOOLTYPES_EXPECTED = require('./data/facets/toolTypes.expected.json');

const TEST_FILE_PATH = path.join(__dirname, 'data', 'facets');


const DEFAULT_MDPROCESSOR = unified()
    .use(markdown)
    .use(remark2rehype)
    .use(html)
    .use(minify); //For testing remove new lines and extra spaces

describe('NetlifyMdResourceTransformer', () => {

    describe('Constructor', () => {

        it('throws errors on no mappings', () => {

            expect(() => {
                new NetlifyMdResourceTransformer(
                    logger,
                    DEFAULT_MDPROCESSOR,
                    {...VALID_CONFIG, mappingFiles: null }
                )
            }).toThrow("Mapping Files are not valid");
        })

        it('throws errors on invalid mappings', () => {

            expect(() => {
                new NetlifyMdResourceTransformer(
                    logger,
                    DEFAULT_MDPROCESSOR,
                    {...VALID_CONFIG, mappingFiles: { docs: "string", researchAreas: {}} }
                )
            }).toThrow("Mapping Files are not valid");
        })

        it('creates as expected', () => {

            const xformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            )

            expect(xformer).not.toBeNull();
            expect(xformer.logger).toBe(logger);
            expect(xformer.mappingFiles).toBe(VALID_CONFIG.mappingFiles);
        })

    })


    describe('GetInstance', () => {

        it('returns an instance', async () => {
            const transformer = await NetlifyMdResourceTransformer.GetInstance(logger, VALID_CONFIG)
            expect(transformer).toBeInstanceOf(NetlifyMdResourceTransformer);
            expect(transformer.mappingFiles).toMatchObject(VALID_CONFIG.mappingFiles);
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
            const expected = [new Error("Config is not valid - mappingFiles is missing or invalid")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig({});
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when config has invalid mapping urls', () => {
            const expected = [new Error("Config is not valid - mappingFiles is missing or invalid")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig({ mappingFiles: "bad"});
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when extra options', () => {
            const expected = [new Error("Config is not valid - mappingFiles is missing or invalid")]
            const errors = NetlifyMdResourceTransformer.ValidateConfig({ foo: {}, mappingFiles: {} });
            expect(errors).toEqual(expect.arrayContaining(expected));
        })

        it('returns an error when mappingFiles bad', () => {
            const expected = [
                new Error("Mapping config for docs is invalid"),
                new Error("Mapping config for researchAreas is invalid"),
                new Error("Mapping config for researchTypes is invalid"),
                new Error("Mapping config for toolTypes is invalid")
            ]
            const errors = NetlifyMdResourceTransformer.ValidateConfig(
                {
                    mappingFiles: {
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

            const testFile = path.join(TEST_FILE_PATH, 'docs.json');

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            await transformer.getMappingFile("test", testFile);

            expect(transformer.facetMaps).toMatchObject({test: DOCS_EXPECTED});
        });

        it('throws on non-existing file', async() => {

            const testFile = path.join(TEST_FILE_PATH, 'non-existing-file.json');

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            expect.assertions(1);

            await expect(transformer.getMappingFile('test', testFile))
                .rejects.toThrow('ENOENT: no such file or directory');

        });

        it('throws on invalid json', async() => {

            const testFile = path.join(TEST_FILE_PATH, 'badData.json');

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                VALID_CONFIG
            );

            expect.assertions(1);

            await expect(transformer.getMappingFile("test", testFile))
                .rejects.toThrow('is not valid JSON');
        });

    })

    describe('begin', () => {

        it('loads the mapping files', async () => {

            const config = {
                ...VALID_CONFIG,
                mappingFiles: {
                    ...VALID_CONFIG.mappingFiles,
                    docs: path.join(TEST_FILE_PATH, 'docs.json'),
                    researchAreas: path.join(TEST_FILE_PATH, 'researchAreas.json'),
                    researchTypes: path.join(TEST_FILE_PATH, 'researchTypes.json'),
                    toolTypes: path.join(TEST_FILE_PATH, 'toolTypes.json')
                }
            }

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                config
            );

            await transformer.begin();

            expect(transformer.facetMaps).toMatchObject({
                docs: DOCS_EXPECTED,
                researchTypes: RESEARCHTYPES_EXPECTED,
                researchAreas: RESEARCHAREAS_EXPECTED,
                toolTypes: TOOLTYPES_EXPECTED
            });

        });

        it('throws an error when an error occurs while loading', async () => {

            const config = {
                ...VALID_CONFIG,
                mappingFiles: {
                    ...VALID_CONFIG.mappingFiles,
                    docs: path.join(TEST_FILE_PATH, 'docs.json'),
                    researchAreas: path.join(TEST_FILE_PATH, 'researchAreas.json'),
                    researchTypes: path.join(TEST_FILE_PATH, 'bad-file-name.json'),
                    toolTypes: path.join(TEST_FILE_PATH, 'toolTypes.json')
                }
            }
            const transformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                config
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

            const config = {
                ...VALID_CONFIG,
                mappingFiles: {
                    ...VALID_CONFIG.mappingFiles,
                    docs: path.join(TEST_FILE_PATH, 'docs.json'),
                    researchAreas: path.join(TEST_FILE_PATH, 'researchAreas.json'),
                    researchTypes: path.join(TEST_FILE_PATH, 'researchTypes.json'),
                    toolTypes: path.join(TEST_FILE_PATH, 'toolTypes.json')
                }
            }

            //Load our MD file.
            const rawResource = await fsp.readFile(path.join(TEST_FILE_PATH, '..', 'full_item.md'));

            //Load expected object
            const expResource = require('./data/full_item.expected.json');

            const transformer = new NetlifyMdResourceTransformer(
                logger,
                DEFAULT_MDPROCESSOR,
                config
            );

            await transformer.begin();

            const transformed = await transformer.transform(rawResource);

            expect(transformed).toEqual(expResource);
        })

    })

})

