const elasticsearch         = require('@elastic/elasticsearch');
const moment                = require('moment');
const nock                  = require('nock');
const path                  = require('path');
const winston               = require('winston');

const ElasticTools          = require('elastic-tools');
const WinstonNullTransport  = require('winston-null-transport');

const ElasticResourceLoader = require('../elastic-resource-loader');


beforeAll(() => {
    nock.disableNetConnect();
})


//After each test, cleanup any remaining mocks
afterEach(() => {
    nock.cleanAll();
});

afterAll(() => {
    nock.enableNetConnect();
})


const VALID_LOADER_CONFIG = {
    // Basically, non-default values.
    bufferSize: 5,
    daysToKeep: 20,
    minIndexesToKeep: 20,
    aliasName: 'r4r_v1'
};

// Config that would be used with GetInstance (and thus ValidateConfig) to instantiate the loader,
// but with some items which aren't directly used in the loader functionality.
// (e.g. mappingPath is where to find the mapping file, but isn't used beyond that.)
const VALID_META_CONFIG = {
    ...VALID_LOADER_CONFIG,
    "eshosts": ['http://localhost:9200/'],
    "mappingPath": "es-mappings/mappings.json",
    "settingsPath": "es-mappings/settings.json"
}

// Constant values for constructor tests.
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new WinstonNullTransport()
    ]
});

const estools = new ElasticTools(logger, new elasticsearch.Client({
    nodes: ['http://example.org:9200'],
    maxSockets: 100,
    keepAlive: true
}));

const mappings = {mappings: {properties: {}}};
const settings = {settings: {index: {}}};



describe('ElasticResourceLoader', () => {

    describe('constructor', () => {

        it('works with all required arguments', async() => {

            const actual = new ElasticResourceLoader(
                logger,
                estools,
                mappings,
                settings,
                {
                    aliasName: 'testAlias'
                }
            );

            expect(actual).not.toBeNull();
            expect(actual.aliasName).toBe('testAlias');
        });

        it('has default settings', async() => {

            const actual = new ElasticResourceLoader(
                logger,
                estools,
                mappings,
                settings,
                {
                    aliasName: 'testAlias'
                }
            );

            expect(actual.buffer.length).toBe(0);
            expect(actual.daysToKeep).toBe(10);
            expect(actual.minIndexesToKeep).toBe(2);
        });

        it('alows defaults to be overridden', async() => {

            const actual = new ElasticResourceLoader(
                logger,
                estools,
                mappings,
                settings,
                {
                    ...VALID_LOADER_CONFIG,
                    aliasName: 'testAlias'
                }
            );

            expect(actual.buffer.length).toBe(VALID_LOADER_CONFIG.bufferSize);
            expect(actual.daysToKeep).toBe(VALID_LOADER_CONFIG.daysToKeep);
            expect(actual.minIndexesToKeep).toBe(VALID_LOADER_CONFIG.minIndexesToKeep);
        })

        it.each([
            [
                'throws error on no aliasName',
                {
                    ...VALID_LOADER_CONFIG,
                    aliasName: undefined
                },
                "aliasName is required for the elastic loader"
            ],
            [
                'throws error on invalid aliasName',
                {
                    ...VALID_LOADER_CONFIG,
                    aliasName: true
                },
                "aliasName is required for the elastic loader"
            ],
            [
                'throws error on invalid daysToKeep',
                {
                    ...VALID_LOADER_CONFIG,
                    daysToKeep: 'chicken'
                },
                "daysToKeep is required for the elastic loader"
            ],
            [
                'throws error on invalid minIndexesToKeep',
                {
                    ...VALID_LOADER_CONFIG,
                    minIndexesToKeep: 'chicken'
                },
                "minIndexesToKeep is required for the elastic loader"
            ],
        ])(
            '%s',
            (name, config, expectedMessage) => {
                expect(()=>{
                    new ElasticResourceLoader(
                        logger,
                        estools,
                        mappings,
                        settings,
                        {
                            ...config
                        }
                    );
                }).toThrow(expectedMessage);
            }
        );
    })

    describe('begin', () => {

        it('creates an index', async() => {

            const expectedIndex = `${VALID_LOADER_CONFIG.aliasName}-index`;

            const mockEStools = {
                createTimestampedIndex: jest.fn((aliasName, mappings, settings) => `${aliasName}-index` )
            }

            const actual = new ElasticResourceLoader(
                logger,
                mockEStools,
                mappings,
                settings,
                VALID_LOADER_CONFIG
            );
            await actual.begin();

            expect(actual.indexName).toBe(expectedIndex);
            expect(mockEStools.createTimestampedIndex.mock.calls.length).toBe(1);
            expect(mockEStools.createTimestampedIndex.mock.calls[0][0]).toBe(VALID_LOADER_CONFIG.aliasName);
            expect(mockEStools.createTimestampedIndex.mock.calls[0][1]).toBe(mappings);
            expect(mockEStools.createTimestampedIndex.mock.calls[0][2]).toBe(settings);
        });

    })

    describe('end', () => {

        it('updates the indices', async () => {

            const testIndexName = 'testIndex';

            const mockEStools = {
                cleanupOldIndices: jest.fn((aliasName, daysToKeep, minIndexesToKeep) => null),
                createTimestampedIndex: jest.fn((aliasName, mappings, settings) => testIndexName),
                optimizeIndex: jest.fn(indexName => null ),
                setAliasToSingleIndex: jest.fn((aliasName, indexName) => null)
            }

            const actual = new ElasticResourceLoader(
                logger,
                mockEStools,
                mappings,
                settings,
                VALID_LOADER_CONFIG
            );
            // Need to call begin in order to set an index name for end to use.
            await actual.begin();
            await actual.end();

            expect(mockEStools.optimizeIndex.mock.calls.length).toBe(1);
            expect(mockEStools.optimizeIndex.mock.calls[0][0]).toBe(testIndexName);

            expect(mockEStools.setAliasToSingleIndex.mock.calls.length).toBe(1);
            expect(mockEStools.setAliasToSingleIndex.mock.calls[0][0]).toBe(VALID_LOADER_CONFIG.aliasName);
            expect(mockEStools.setAliasToSingleIndex.mock.calls[0][1]).toBe(testIndexName);

            expect(mockEStools.cleanupOldIndices.mock.calls.length).toBe(1);
            expect(mockEStools.cleanupOldIndices.mock.calls[0][0]).toBe(VALID_LOADER_CONFIG.aliasName);
            expect(mockEStools.cleanupOldIndices.mock.calls[0][1]).toBe(VALID_LOADER_CONFIG.daysToKeep);
            expect(mockEStools.cleanupOldIndices.mock.calls[0][2]).toBe(VALID_LOADER_CONFIG.minIndexesToKeep);

        });

    })

    describe('loadRecord', () => {

        it('indexes the document', async () => {

            const testIndexName = `${VALID_META_CONFIG.aliasName}-testIndex`

            const mockEStools = {
                indexDocument: jest.fn(),
                createTimestampedIndex: jest.fn((aliasName, mappings, settings) => testIndexName)
            }

            const resourceRecord = {
                "id": 1,
                "title": "Enhancer Linking by Methylation/Expression Relationships (ELMER)",
                "website": "http://bioconductor.org/packages/release/bioc/html/ELMER.html",
                "body": "<p>ELMER is a R tool for analysis of DNA methylation and expression datasets. Integrative analysis allows reconstruction of <em>in vivo</em> transcription factor networks altered in cancer, along with identification of the underlying gene regulatory sequences.</p>",
                "description": "<p>ELMER is a R tool for analysis of DNA methylation and expression datasets.</p>",
                "toolTypes": [
                    {
                        "key": "analysis_tools",
                        "label": "Analysis Tools"
                    }
                ],
                "toolSubtypes": [
                    {
                        "parentKey": "analysis_tools",
                        "key": "r_software",
                        "label": "R Software"
                    }
                ],
                "researchAreas": [
                    {
                        "key": "cancer_omics",
                        "label": "Cancer Omics"
                    }
                ],
                "researchTypes": [
                    {
                        "key": "basic",
                        "label": "Basic"
                    }
                ],
                "resourceAccess": {
                    "type": "open",
                    "notes": null
                },
                "doCs": [
                    {
                        "key": "itcr",
                        "label": "Informatics Technology for Cancer Research (ITCR)"
                    }
                ],
                "poCs": []
            };

            const actual = new ElasticResourceLoader(
                logger,
                mockEStools,
                mappings,
                settings,
                VALID_LOADER_CONFIG
            );
            // Need to call begin in order to set an index name for loadRecord to use.
            await actual.begin();
            await actual.loadRecord(resourceRecord);

            expect(mockEStools.indexDocument.mock.calls.length).toBe(1);
            expect(mockEStools.indexDocument.mock.calls[0][0]).toBe(testIndexName);
            expect(mockEStools.indexDocument.mock.calls[0][1]).toBe(resourceRecord.id);
            expect(mockEStools.indexDocument.mock.calls[0][2]).toBe(resourceRecord);

        });
    })

    describe('ValidateConfig', () => {

        it.each([
            ['has no errors', VALID_META_CONFIG, []],
            [
                'has error on no es hosts',
                {
                    ...VALID_META_CONFIG,
                    eshosts: undefined
                },
                [
                    new Error("eshosts is required for the elastic loader")
                ]
            ],
            [
                'has error on no settings',
                {
                    ...VALID_META_CONFIG,
                    settingsPath: undefined
                },
                [
                    new Error("settingsPath is required for the elastic loader")
                ]
            ],
            [
                'has error on no mappings',
                {
                    ...VALID_META_CONFIG,
                    mappingPath: undefined
                },
                [
                    new Error("mappingPath is required for the elastic loader")
                ]
            ]
        ])(
            '%s',
            (name, config, expected) => {
                const actual = ElasticResourceLoader.ValidateConfig(config);
                expect(actual).toEqual(expected);
            }
        )

    });

    describe('GetInstance', () => {

        it('works', async() => {
            const actual = await ElasticResourceLoader.GetInstance(logger, VALID_META_CONFIG);

            expect(actual.aliasName).toEqual(VALID_META_CONFIG.aliasName);
            expect(actual.daysToKeep).toEqual(VALID_META_CONFIG.daysToKeep);
            expect(actual.minIndexesToKeep).toEqual(VALID_META_CONFIG.minIndexesToKeep);

            //TODO: This will break if estools is mocked.
            expect(actual.estools.client.transport.connectionPool.connections).toHaveLength(VALID_META_CONFIG.eshosts.length);
            let actualHosts = actual.estools.client.transport.connectionPool.connections.map(conn => conn.url.href);
            expect(actualHosts).toEqual(expect.arrayContaining(VALID_META_CONFIG.eshosts));
            //TODO: Test socketLimit
        });

        it('works with socketLimit', async () => {
            const actual = await ElasticResourceLoader.GetInstance(
                logger,
                {
                    ...VALID_META_CONFIG,
                    socketLimit: 50
                });

            expect(actual.aliasName).toEqual(VALID_META_CONFIG.aliasName);
            expect(actual.daysToKeep).toEqual(VALID_META_CONFIG.daysToKeep);
            expect(actual.minIndexesToKeep).toEqual(VALID_META_CONFIG.minIndexesToKeep);
            //TODO: This will break if estools is mocked.
            expect(actual.estools.client.transport.connectionPool.connections).toHaveLength(VALID_META_CONFIG.eshosts.length);
            let actualHosts = actual.estools.client.transport.connectionPool.connections.map(conn => conn.url.href);
            expect(actualHosts).toEqual(expect.arrayContaining(VALID_META_CONFIG.eshosts));
            //TODO: Test socketLimit
        })


        it.each([
            [
                'throws error on no eshosts',
                {
                    ...VALID_META_CONFIG,
                    eshosts: undefined
                },
                'eshosts is required for the elastic loader'
            ],
            [
                'throws error on no mappingPath',
                {
                    ...VALID_META_CONFIG,
                    mappingPath: undefined
                },
                'mappingPath is required for the elastic loader'
            ],
            [
                'throws error on non-string mappingPath',
                {
                    ...VALID_META_CONFIG,
                    mappingPath: []
                },
                'mappingPath is required for the elastic loader'
            ],
            [
                'throws error on bad mappingPath',
                {
                    ...VALID_META_CONFIG,
                    mappingPath: 'chicken'
                },
                `mappingPath cannot be loaded: ${ path.join(__dirname, '../../../', 'chicken') }`
            ],
            [
                'throws error on no settingsPath',
                {
                    ...VALID_META_CONFIG,
                    settingsPath: undefined
                },
                'settingsPath is required for the elastic loader'
            ],
            [
                'throws error on non-string settingsPath',
                {
                    ...VALID_META_CONFIG,
                    settingsPath: []
                },
                'settingsPath is required for the elastic loader'
            ],
            [
                'throws error on bad settingsPath',
                {
                    ...VALID_META_CONFIG,
                    settingsPath: 'chicken'
                },
                `settingsPath cannot be loaded: ${ path.join(__dirname, '../../../', 'chicken') }`
            ],
            [
                'throws error on non-numeric socketLimit',
                {
                    ...VALID_META_CONFIG,
                    socketLimit: 'chicken'
                },
                'socketLimit must be a number greater than 0'
            ],
            [
                'throws error on negative socketLimit',
                {
                    ...VALID_META_CONFIG,
                    socketLimit: 'chicken'
                },
                'socketLimit must be a number greater than 0'
            ],
        ])(
            '%s', async (missingItem, config, expectedMessage) => {

                expect.assertions(1);
                try {
                    await ElasticResourceLoader.GetInstance(
                        logger,
                        config
                    );
                } catch (err) {
                    expect(err).toMatchObject({
                        message: expectedMessage
                    });
                }
            }
        );

    })

})