const winston                   = require('winston');
const WinstonNullTransport      = require('winston-null-transport');

const FileSystemResourceSource  = require('../filesystem-resource-source');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    transports: [
        new WinstonNullTransport()
    ]
});

const VALID_CONFIG = {
    resourcesPath: '/resources'
};

const DATA_DIRECTORY_CONFIG = {
    resourcesPath: './lib/sources/__tests__/data/content'
}

const EMPTY_DIRECTORY_CONFIG = {
    resourcesPath: 'lib/sources/__tests__/data/empty'
}


describe('FileSystemResourceSource', () => {
    describe('constructor', () => {

        it('Creates with defaults', () => {

            const source = new FileSystemResourceSource(logger, {});
            expect(source.resourcesPath).toBe('/resources');
        });

        it('Creates with defaults, and custom override', () => {

            const source = new FileSystemResourceSource(
                logger,
                {
                    ...VALID_CONFIG,
                    resourcesPath: '/custom-value'
                }
            );
            expect(source.resourcesPath).toBe('/custom-value');
        });

        it('Trims leading/trailing spaces from resourcesPath', () => {

            const source = new FileSystemResourceSource(
                logger,
                {
                    ...VALID_CONFIG,
                    resourcesPath: ' /custom-value '
                }
            );
            expect(source.resourcesPath).toBe('/custom-value');
        });

        it.each([
            [
                'throws an error on null resource path',
                {
                    ...VALID_CONFIG,
                    resourcesPath: null
                }
            ],
            [
                'throws an error on empy resource path',
                {
                    ...VALID_CONFIG,
                    resourcesPath: ''
                }
            ],
            [
                'throws an error on blank resource path',
                {
                    ...VALID_CONFIG,
                    resourcesPath: '    '
                }
            ]
        ])(
            '%s',
            (name, config) => {
                expect(() => {
                    new FileSystemResourceSource(logger, config);
                }).toThrow('You must supply a resource directory URL.');
            }
        );
    });

    describe('begin', () => {

        // Minimal test in case of begin gaining functionality.
        it('succeeds', async () => {

            const instance = await FileSystemResourceSource.GetInstance(logger, VALID_CONFIG);

            expect(async() => {
                await instance.begin();
            }).not.toThrow();
        })
    });

    describe('end', () => {

        // Minimal test in case of end gaining functionality.
        it('succeeds', async () => {

            const instance = await FileSystemResourceSource.GetInstance(logger, VALID_CONFIG);

            expect(async() => {
                await instance.end();
            }).not.toThrow();
        })
    });

    describe('abort', () => {

        // Minimal test in case of abort gaining functionality.
        it('succeeds', async () => {

            const instance = await FileSystemResourceSource.GetInstance(logger, VALID_CONFIG);

            expect(async() => {
                await instance.abort();
            }).not.toThrow();
        })
    });

    describe('ValidateConfig', () => {
        it('validates config', () => {
            const actual = FileSystemResourceSource.ValidateConfig(VALID_CONFIG);
            expect(actual).toEqual([]);
        });

        it('reports bad config', () => {
            const actual = FileSystemResourceSource.ValidateConfig(
                logger,
                {
                    ...VALID_CONFIG,
                    resourcesPath: null
                }
            );
            expect(actual).toEqual([new Error('You must supply a resource directory URL.')])
        });
    });

    describe('GetInstance', () => {
        it('gets instance with defaults', async () => {
            const instance = await FileSystemResourceSource.GetInstance(logger, {});
            expect(instance).not.toBeNull();
            expect(instance.resourcesPath).toBe('/resources');
        });

        it('gets instance with non-default', async () => {
            const instance = await FileSystemResourceSource.GetInstance(
                logger,
                {
                    ...VALID_CONFIG,
                    resourcesPath: '/non-default'
                }
            );
            expect(instance).not.toBeNull();
            expect(instance.resourcesPath).toBe('/non-default');
        });

        it('throws an error with missing config', async () => {
            try {
                const actual = await FileSystemResourceSource.GetInstance(logger);
            }
            catch (err) {
                expect(err).not.toBeNull();
                expect(err.message).toBe('Config must be supplied.')
            }
        });

    });

    describe('getRecords', () => {

        it('returns empty from directory with no markdown files', async () => {
            const source = await FileSystemResourceSource.GetInstance(logger, EMPTY_DIRECTORY_CONFIG);
            await source.begin();
            const records = await source.getRecords();
            await source.end();

            expect(records).toStrictEqual([]);
        });

        it('returns records from directory with markdown files', async () => {
            const source = await FileSystemResourceSource.GetInstance(logger, DATA_DIRECTORY_CONFIG);
            await source.begin();
            const records = await source.getRecords();
            await source.end();

            expect(records).toHaveLength(5);
            records.forEach( r => {
                expect(r).not.toBeNull();
                expect(r).not.toBeUndefined();
                expect(r.length).toBeGreaterThan(600);
            });
        });

        it('throws an error on non-existent directory', async () => {
            const source = await FileSystemResourceSource.GetInstance(
                logger,
                {
                    ...DATA_DIRECTORY_CONFIG,
                    resourcesPath: './chicken'
                }
                );
            await source.begin();

            // Two asserts in order to avoid OS-specific path separators.
            await expect(source.getRecords()).rejects.toThrow("ENOENT: no such file or directory");
            await expect(source.getRecords()).rejects.toThrow("chicken");
        });

    });

    // This is slightly dirty in that helper function should ideally should be treated as an
    // implementation detail without tests of their own. But, (at least in this case) it's
    // easier to build out and test the sub-pieces as part of getting getRecords working.
    describe('helper functions', () => {

        describe('getResourceList', () => {

            it('returns records when there are markdown files', async () => {
                const source = await FileSystemResourceSource.GetInstance(logger, DATA_DIRECTORY_CONFIG);
                await source.begin();
                const fileList = await source.getResourceList();
                await source.end();

                expect(fileList).toHaveLength(5);
                fileList.forEach( f => {
                    expect(f).not.toBeNull();
                    expect(f.toLowerCase().endsWith('.md')).toBe(true);
                });
            });

            it('returns empty when there are no markdown files', async () => {
                const source = await FileSystemResourceSource.GetInstance(logger, EMPTY_DIRECTORY_CONFIG);
                await source.begin();
                const fileList = await source.getResourceList();
                await source.end();

                expect(fileList).toEqual([]);
            });

        });

        describe('getResourceData', () => {

            it('succeeds in retrieving a file', async () => {
                const source = await FileSystemResourceSource.GetInstance(logger, EMPTY_DIRECTORY_CONFIG);
                await source.begin();
                const data = await source.getResourceContent('lib/sources/__tests__/data/content/resource1.md');
                await source.end();

                expect(data).not.toBeNull();
                expect(data).not.toBeUndefined();
                expect(data.length).toBeGreaterThan(600);
            });
        });

    });

});