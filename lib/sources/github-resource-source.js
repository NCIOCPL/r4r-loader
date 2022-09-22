const { AbstractRecordSource }  = require('loader-pipeline');
const {Octokit}                   = require('@octokit/rest');
const axios                     = require('axios');
const https                     = require('https');
const matter                    = require('gray-matter');
const github_url_parse          = require('parse-github-repo-url');

/**
 * This class implements a Resource Source wherin the content lives in the
 * r4rcontent structure of Github.
 */
class GithubResourceSource extends AbstractRecordSource {

    /**
     * Creates a new instance of a GithubResourceSource
     * @param {logger} logger An instance of a logger.
     * @param {Object} client An initialized GitHub client from octokit/rest.
     * @param {Object} axclient Axios client for making HTTP(s) requests
     * @param {Object} param2 A configuration object
     * @param {string} param2.repoUrl The URL for the source github repo
     * @param {string} param2.resourcesPath The path within the repo to the resources. (DEFAULT: /resources)
     * @param {string} param2.branchName The name of the branch to use. (DEFAULT: master)
     */
    constructor(logger, client, axclient, { repoUrl = false, resourcesPath = '/resources', branchName = false } = {}) {
        super(logger);

        if (repoUrl === false) {
            throw new Error("You must supply a repository URL");
        }

        // Set Github Client
        this.client = client;

        // Set HTTP(S) Agent
        this.axclient = axclient;

        //break up the repo url
        try {
            const [owner, repo] = github_url_parse(repoUrl);
            this.owner = owner;
            this.repo = repo;
        } catch (err) {
            this.logger.error(`Could not parse repoUrl, ${repoUrl}`);
            throw new Error("Failed to parse github url");
        }

        this.resourcesPath = resourcesPath;

        this.branchName = branchName;

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

        this.logger.debug("GithubResourceSource:getResources - Beginning Fetch");

        let resourcesList;

        //Get list of content from github
        try {
            resourcesList = await this.getResourceList();
        } catch (err) {
            this.logger.error(`Could not fetch resources from GitHub https://github.com/${this.owner}/${this.repo}${this.resourcesPath}\n\n${err}`);
            throw err;
        }

        //download the content
        const results = await Promise.all(
            resourcesList.map(async (item) => {
                rtnResources.push(await this.getResourceContent(item));
            })
        );

        this.logger.debug("GithubResourceSource:getResources - Completed Fetch");

        return rtnResources;
    }

    /**
     * Internal function to get the list of resources in the resources folder
     * @return {array} an array of the URLs to download
     */
    async getResourceList() {

        let options = {
            owner: this.owner,
            repo: this.repo,
            path: this.resourcesPath,
        }

        if(this.branchName) {
            options = {
                ...options,
                ref: this.branchName
            }
        }

        const result = await this.client.repos.getContent(options);

        const regEx = /.*\.md$/;

        const downloadList = result.data
            .filter(r => r.type === 'file' && regEx.test(r.download_url))
            .map(r => r.download_url);

        return downloadList;
    }

    /**
     * Downloads a resource from github.
     * @param {*} contentUrl The raw url for the content
     * @returns {Object} the resource
     */
    async getResourceContent(contentUrl) {

        let response;

        try {
            response = await this.axclient.get(contentUrl, {
                responseType: 'text'
            });
        } catch (err) {
            this.logger.error(`Could not fetch ${contentUrl}`);
            throw err;
        }

        return response.data;
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
     * @param {string} config.repoUrl The URL for the source github repo
     * @param {string} config.resourcesPath The path within the repo to the resources. (DEFAULT: /resources)
     * @param {string} param2.branchName The name of the branch to use. (DEFAULT: master)
     */
    static ValidateConfig(config) {
        let errors = [];

        if (!config.repoUrl) {
            errors.push(new Error("You must supply a repository URL"));
        }

        return errors;
    }

    /**
     * A static helper function to get a configured source instance
     * @param {Object} logger the logger to use
     * @param {Object} config configuration parameters to use for this instance. See GithubResourceSource constructor.
     */
    static async GetInstance(logger, config) {

        if (!config) {
            throw new Error("Config must be supplied");
        }

        //TODO: Find a better way to manage the agent so there can be one agent per
        //application.  (and thus one pool of sockets)
        const agent = new https.Agent({
            keepAlive: true,
            maxSockets: 80
        });

        //Get instance of axios with our custom https agent
        const axiosInstance = axios.create({
            httpsAgent: agent
        })

        const options = {
            // Since we will be scraping the GitHub site we will be making a lot of calls
            // the following options will make sure that we do not kill the computer's
            // sockets that it runs on.
            request: {
                agent
            }
        };

        // We will probably need to authenticate to get around the rate limits
        // they are based on IP address, which for us *could* be a major limiter.
        if (config['authentication'] != null) {
            options.auth = config['authentication'].token;
        }

        const client = new Octokit(options);

        return new GithubResourceSource(logger, client, axiosInstance, config);
    }
}

module.exports = GithubResourceSource;