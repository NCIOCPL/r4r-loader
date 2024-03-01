const { AbstractRecordSource }  = require('loader-pipeline');
const fs                        = require('fs/promises');
const path                      = require('path');


const MSG_SPECIFY_DIRECTORY = 'You must supply a resource directory URL.';

/**
 * This class implements a Resource Source wherin the content lives in the
 * local file system.
 */
class FileSystemResourceSource extends AbstractRecordSource {

    /**
     * Creates a new instance of a FileSystemResourceSource
     * @param {logger} logger An instance of a logger.
     * @param {Object} param2 A configuration object
     * @param {string} param2.resourcesPath The path within the filesystem to the resources. (DEFAULT: /resources)
     */
    constructor(logger, { resourcesPath = '/resources' } = {}) {
        super(logger);

        if (!resourcesPath || typeof resourcesPath !== 'string' || !(resourcesPath.trim())) {
            throw new Error(MSG_SPECIFY_DIRECTORY);
        }

        this.resourcesPath = resourcesPath.trim();
    }

    /**
     * Called before any resources are loaded.
     */
    async begin() {
        return;
    }

    /**
     * Get a collection of resources from this source
     */
    async getRecords() {

        let rtnResources = [];

        this.logger.debug("FileSystemResourceSource:getResources - Beginning Fetch");

        let resourceList;

        // Get list of content.
        try {
            resourceList = await this.getResourceList();
        } catch (err) {
            this.logger.error(`Could not fetch resources from ${this.resourcesPath}.`);
            throw err;
        }
        console.info(`Retrieving ${resourceList.length} resource files.`);

        // Get the content
        const results = await Promise.all(resourceList.map(async (item) => await this.getResourceContent(item)));

        return results;
    }

    /**
     * Internal function to get the list of file in the resources folder
     * @return {array} an array of the files to retrieve
     */
    async getResourceList() {

        const regEx = /.*\.md$/;

        const candidates = await fs.readdir( this.resourcesPath, { withFileTypes: true} );

        // Filter the list to only files, and only markdown.
        const resourceFileList = candidates
            .filter(c => c.isFile() && regEx.test(c.name))
            .map(c => path.join(this.resourcesPath, c.name));

        return resourceFileList;
    }

    /**
     * Internal function to retrieve the contents of a specific file.
     *
     * @param {string} filename
     *  The name of the file to retrieve.
     * @return {string} the file's contents.
     */
    async getResourceContent(filename) {
        return await fs.readFile(filename, {encoding: 'utf8', flag: 'r'});
    }


    /**
     * Method called after all resources have been loaded
     */
    async end() {
        return;
    }

    /**
     * Called upon a fatal loading error. Use this to clean up any items created on startup
     */
    async abort() {
        return;
    }

    /**
     * A static method to validate a configuration object against this module type's schema
     * @param {Object} config configuration parameters to use for this instance.
     * @param {string} config.resourcesPath The path within the filesystem to the resources. (DEFAULT: /resources)
     */
    static ValidateConfig(config) {
        let errors = [];

        if (!config.resourcesPath || typeof config.resourcesPath !== 'string' || !(config.resourcesPath.trim())) {
            errors.push(new Error(MSG_SPECIFY_DIRECTORY));
        }

        return errors;
    }

    /**
     * A static helper function to get a configured source instance
     * @param {Object} logger the logger to use
     * @param {Object} config configuration parameters to use for this instance. See FileSystemResourceSource constructor.
     */
    static async GetInstance(logger, config) {

        if (!config) {
            throw new Error("Config must be supplied.");
        }

        return new FileSystemResourceSource(logger, config);
    }

}

module.exports = FileSystemResourceSource;
