const { AbstractRecordLoader }  = require('loader-pipeline');
const path                      = require('path');
const fsp                       = require('fs/promises');


/**
 * Implements a record loader to create a static file suitable
 * for bulk loading into Elasticsearch via the raw HTTP interface.
 *
 * The order of records in the generated record is nondeterministic,
 * this is due to asynchronous "one record at a time" nature of an
 * AbstractRecordLoader.
 *
 * A sample local.json for invoking this loader vs the default
 * elastic-resource-loader appears below.
 *
 * Note: Including the documentType property will cause the generated
 *       file to include a documentType for each record. This should
 *       only be specified when generating bulk data for ES version 5.
 *
 *      {
 *          "pipeline": {
 *              "loader": {
 *                  "module": "./lib/loaders/file-resource-loader",
 *                  "config": {
 *                      "outputFile": "resources.json",
 *                      "documentType": "resource"
 *                  }
 *              }
 *          }
 *      }
 *
 */
class FileResourceLoader extends AbstractRecordLoader {

    /**
     * Creates a new instance of FileResourceLoader
     * @param {*} logger An instance of a logger.
     * @param {*} indexName Name of the index the records will be loaded into.
     * @param {*} outputFile Name of the file to place the records in.
     * @param {*} documentType Optional document type. Only use with Elasticsearch
     *                          versions earlier than 6
     */
    constructor(
        logger,
        {
            indexName = null,
            outputFile = null,
            documentType = null
        } = {}
    ) {
        super(logger);

        if (!outputFile || typeof outputFile !== 'string') {
            throw new Error('outputFile is required for the FileResourceLoader');
        }
        this.outputFile = outputFile;

        if(!indexName || typeof indexName !== 'string') {
            throw new Error('indexName is required for the FileResourceLoader');
        }
        this.indexName = indexName;

        // documentType isn't required, but if present, we can generate a bulk
        // data load file for use with Elasticsearch 5.
        if (documentType && typeof documentType === 'string') {
            this.documentType = documentType;
        }


        this.outputFileHandle = null;
    }

    /**
     * Called before any records are loaded.
     */
    async begin() {
        this.logger.debug("FileResourceLoader:begin - Begin Begin");

        this.outputFileHandle = await fsp.open(this.outputFile, 'w+');

        this.logger.debug("FileResourceLoader:begin - End Begin");
    }

    /**
     * Load a resource into the bulk loading file.
     * @param {*} resource
     */
    async loadRecord(resource) {
        const metadata = {"_index": this.indexName, "_id": resource.id};
        if (this.documentType && typeof this.documentType === 'string')
            metadata["_type"] = this.documentType;

        const indexInfo = JSON.stringify({"index": metadata});

        const payload = JSON.stringify(resource);

        let buffer = (indexInfo + '\n' + payload + '\n');

        await fsp.appendFile(this.outputFileHandle, buffer);
    }

    /**
     * Called upon a fatal loading error. Use this to clean up any items created on startup
     */
    async abort() {
        throw new Error('Not Implemented');
    }

    /**
     * Called after all records are loaded.
     */
    async end() {
        this.logger.debug("FileResourceLoader:end - Begin End");

        await this.outputFileHandle.close();

        this.logger.debug("FileResourceLoader:end - End End");
    }

    static ValidateConfig(config) {
        let errors = [];

        // Do something.

        return errors;
    }

    static async GetInstance(logger, config) {

        const appRoot = path.join(__dirname, '..', '..');

        return new FileResourceLoader(
            logger,
            {
                ...config,
                indexName: config.aliasName,

            }
        )
    }
}

module.exports = FileResourceLoader;