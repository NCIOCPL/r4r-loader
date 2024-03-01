const { AbstractRecordTransformer } = require('loader-pipeline');
const fsp                           = require('fs/promises');
const matter                        = require('gray-matter');
const unified                       = require('unified');
const markdown                      = require('remark-parse');
const remark2rehype                 = require('remark-rehype');
const html                          = require('rehype-stringify');

/**
 * This class implements a Resource transformer that transforms a Netlify yaml-frontmatter
 * document into a resource for indexing
 */
class NetlifyMdResourceTransformer extends AbstractRecordTransformer {

    /**
     *
     * @param {Object} logger Logger to use for logging
     * @param {Object} unifiedMd2HtmlProcessor Unified processor configured to convert markdown to HTML
     * @param {Object} param2 configuration
     * @param {Object} param2.mappingFiles an object representing the location of that facet mapping files
     * @param {string} param2.mappingFiles.docs the location of the Divisions, offices and centers map
     * @param {string} param2.mappingFiles.researchAreas the location of the research areas map
     * @param {string} param2.mappingFiles.researchTypes the location of the researchTypes map
     * @param {string} param2.mappingFiles.toolTypes the location of the tool types map
     */
    constructor(
        logger,
        unifiedMd2HtmlProcessor,
        {
            mappingFiles: mappingFiles = {
                docs: false,
                researchAreas: false,
                researchTypes: false,
                toolTypes: false
            }
        } = {}
    ) {
        super(logger);

        //Check and see if the mapping URLs are a valid structure.
        //NOTE: this is not checking for files missing from the filesystem.
        if (!( mappingFiles &&
            ['docs', 'researchAreas', 'researchTypes', 'toolTypes']
            .reduce(
                (ac, cv) => ac = ac && (mappingFiles[cv] && typeof mappingFiles[cv] === 'string'),
                true
            )
        )) {
            throw new Error("Mapping Files are not valid");
        }

        this.mappingFiles = mappingFiles;
        this.mdProcessor = unifiedMd2HtmlProcessor;

        //To be filled in on begin
        this.facetMaps = {}
    }

    /**
     * Gets a single mapping file
     * @param {*} key The key to store in the facetMaps
     * @param {*} path The path to the mapping file
     */
    async getMappingFile(key, path) {

        try {
            //const rawData = await this.fsp.readFile(path, {encoding: 'utf8', flag: 'r'});
            const rawData = await fsp.readFile(path, 'utf8');

            const mapData = JSON.parse(rawData);

            // TODO: We should probably validate the map against a schema

            // Convert the data to a format that supports easy lookups, and
            // also uses the right keys for the facet
            this.facetMaps[key] = mapData.reduce(
                (obj, item) => {
                    obj[item.value] = { key: item.value.toLowerCase(), label: item.label }
                    return obj;
                }, {}
            );

        } catch (err) {
            this.logger.error(`Cannot fetch mapping ${key} located at ${path}.`);
            throw err;
        }

    }

    /**
     * Called before any resources are transformed -- load mappers and anything else here.
     */
    async begin() {
        this.logger.debug("NetlifyMdResourceTransformer:begin - Begin Begin");

        const jsonFetchers = Object.keys(this.mappingFiles).map(async key => {
            await this.getMappingFile(key, this.mappingFiles[key]);
        })

        await Promise.all(jsonFetchers);

        this.logger.debug("NetlifyMdResourceTransformer:begin - End Begin");
    }

    /**
     * Maps data from raw resource to facet.
     * @param {*} facet
     * @param {*} incoming
     */
    mapFacet(facet, incoming) {

        //No map, skip
        if (!incoming[facet] || !Array.isArray(incoming[facet])) {
            return [];
        }

        const facets = incoming[facet].map((facetTag) => {

            //Since we do not have multi-select capability in Netlify CMS yet,
            //we made the facets a lists of facet objects.  For example,
            //docs: [] contains an array of objects that look like {"doc": "<the_key>"}
            //
            // So we need to grab the doc out.  In hindsight, we should have made the object
            // be facet or something generic... The consistent thing is that the collection
            // is plural and the individual item is singular

            const tag = facet.substr(0, facet.length - 1);
            const key = facetTag[tag].toLowerCase(); //Force this to be lower case as it is the key
            const pair = this.facetMaps[facet][key];

            if (!pair) {
                this.logger.warn(`Could not lookup key ${key} for facet ${facet}`);
                //Decide if we really want to blow up here. Probably should keep track of
                //lookup errors, and report at the end, but not break.
                throw new Error(`Facet Lookup Error`);
            }

            return pair;
        })

        return facets;
    }

    /**
     * This is a quick and dirty method to validate that the transformed resource
     * is a valid resource
     * @param {*} resource
     */
    validateResource(resource){
        // Quick and Dirty Validation of our object
        const validKeys = [];

        return true;
    }

    /**
     * This converts a raw ToolType facet item into a
     * object
     * @param {*} facetItem
     */
    explodeToolTypeFacet(facetItem) {

        if (facetItem.key.includes('/')) {
            //This is a subtyped item
            let typeSubKey = facetItem.key.split('/');

            if (typeSubKey.length != 2) {
                this.logger.error(`Bad Tool Type/Subtype key: ${facetItem.key}`);
                throw new Error("Tool Type Key for Type/Subtype does not match expected format");
            }

            let typeSubLabel = facetItem.label.split(/\s+-\s+/);
            if (typeSubLabel.length != 2) {
                this.logger.error(`Bad Tool Type/Subtype label for key: ${facetItem.key}`);
                throw new Error("Tool Type Label for Type/Subtype does not match expected format");
            }

            return { label: typeSubLabel[0], key: typeSubKey[0] };
        } else {
            //This is type only
            return facetItem;
        }
    }

    /**
     * This converts a raw ToolType facet item into a
     * subtype object
     * @param {*} facetItem
     */
    explodeToolSubtypeFacet(facetItem) {

        if (facetItem.key.includes('/')) {
            //This is a subtyped item
            let typeSubKey = facetItem.key.split('/');

            if (typeSubKey.length != 2) {
                this.logger.error(`Bad Tool Type/Subtype key: ${facetItem.key}`);
                throw new Error("Tool Type Key for Type/Subtype does not match expected format");
            }

            let typeSubLabel = facetItem.label.split(/\s+-\s+/);
            if (typeSubLabel.length != 2) {
                this.logger.error(`Bad Tool Type/Subtype label for key: ${facetItem.key}`);
                throw new Error("Tool Type Label for Type/Subtype does not match expected format");
            }

            return { label: typeSubLabel[1], key: typeSubKey[1], parentKey: typeSubKey[0] };
        } else {
            //This is type only
            return undefined;
        }
    }

    /**
     * Transforms the resource
     * @param {Object} data the object to be transformed
     * @returns the transformed object
     */
    async transform(data) {
        const document = matter(data);

        // Get resource ID for error logging
        const resourceId = document.data.id;

        // We need to get the toolTypes into key/label pairs to start
        // before we can explode them into separate tool type/subtype fields.
        const toolTypeData = this.mapFacet("toolTypes", document.data);

        let resource;
        try {
            //Map to object we want to push to ES
            resource = {
                ...document.data,
                body: String(await this.mdProcessor.process(document.content)),
                description: String(await this.mdProcessor.process(document.data.description)),
                // NOTE: it is poc in the source content.
                poc: undefined,
                pocs: !document.data.poc ? [] : document.data.poc.map((poc) => { return {
                    ...poc,
                    name: {...poc.name},
                }}),
                docs: this.mapFacet("docs", document.data),
                researchAreas: this.mapFacet("researchAreas", document.data),
                researchTypes: this.mapFacet("researchTypes", document.data),
                toolTypes: toolTypeData
                            .map(this.explodeToolTypeFacet.bind(this))
                            //Remove dupes.
                            .reduce(
                                (a,c) => (!a.some(el => el.key === c.key && el.label === c.label) ? a.concat(c): a)
                                , []
                            ),
                toolSubtypes: toolTypeData.map(this.explodeToolSubtypeFacet.bind(this)).filter(st => st)
            }
        } catch (err) {
            this.logger.error(`Error transforming resource ${resourceId}`);
            this.logger.error(`Transform Error: ${err}`)
            throw err;
        }

        //Validate the resource
        if (!this.validateResource(resource)) {
            this.logger.error(`Resource ${data} is not valid.`)
            throw new Error("Resource is not valid");
        }

        return resource;
    }

    /**
     * Method called after all resources have been transformed
     */
    async end() {
        return; //I have nothing to do here...
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
     */
    static ValidateConfig(config) {

        let errors = [];

        if (!config || typeof config !== 'object') {
            errors.push(new Error("Config is not object or null"));
        } else if (
            Object.keys(config).length !== 1 ||
            !config["mappingFiles"] ||
            typeof config.mappingFiles !== "object"
        ) {
            errors.push(new Error("Config is not valid - mappingFiles is missing or invalid"));
        } else {
            for(let key of ['docs', 'researchAreas', 'researchTypes', 'toolTypes']) {
                if (!config.mappingFiles[key] || typeof config.mappingFiles[key] !== 'string') {
                    errors.push(new Error(`Mapping config for ${key} is invalid`));
                }
            }
        }

        return errors;
    }

    /**
     * A static helper function to get a configured source instance
     * @param {Object} logger the logger to use
     * @param {Object} config configuration parameters to use for this instance. See GithubResourceSource constructor.
     */
    static async GetInstance(logger, config) {

        const unifiedMd2HtmlProcessor = unified()
                                        .use(markdown)
                                        .use(remark2rehype)
                                        .use(html);

        return new NetlifyMdResourceTransformer(logger, unifiedMd2HtmlProcessor, config);
    }
}

module.exports = NetlifyMdResourceTransformer;