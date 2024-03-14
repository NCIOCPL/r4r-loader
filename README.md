# r4rimporter
Resources for Researchers Prototype Importer

## Requirements
* Node 20

## Running loader
1. Clone this repo
1. Create a `local.json` file in the `<importer_root>/config` directory following the configuration information below. The system uses node-config for managing configurations. More information regarding the format and options can be found at https://github.com/lorenwest/node-config.
1. Run `node index.js`

## Configuration Information
The configuration file is based on the https://github.com/NCIOCPL/loader-pipeline library.  For the R4R Loader we have implemented the following pipeline steps:
### Source
* **FileSystemResourceSource** - This class pulls the content from the local filesystem.
  * Input: N/A
  * Output: This returns an array of the raw documents.
  * Configuration:
    * `resourcesPath`: (required) The path on the filesystem to the resource files.
### Transformers:
* **NetlifyMDResourceTransformer** - Transforms documents in Markdown with YML Front-matter format conforming to the r4r-content schema (https://github.com/NCIOCPL/r4r-content/blob/master/admin/config.yml) the
  * Input: An array of documents that follow the r4r-content schema
  * Output: A single record in a format expected by the ElasticResourceLoader
  * Configuration:
    * `mappingUrls` - (required) An object that contains the following properties:
      * `docs` - (required) The path to the docs taxonomy file.
      * `researchAreas` - (required) The path to the research areas taxonomy file.
      * `researchTypes` - (required) The path to the research types taxonomy file.
      * `toolTypes` - (required) The path to the tool types taxonomy file.
### Loader:
* **ElasticResourceLoader** - Loads all records into an Elasticsearch index matching the format of \<aliasName\>\_YYYYMMDD\_HHMMSS. Upon successful completion
  * Input: Documents in a format matching the elasticsearch mapping
  * Output: N/A
  * Configuration:
    * `eshosts` - (required) An array of elasticsearch host URIs. This should include the protocal, username (if needed), password (if needed), port.
    * `daysToKeep` - (required) The number of days to keep indices for
    * `aliasName` - (required) The Elasticsearch alias for the most recent index. This is also the prefix for the timestamped index
    * `mappingPath` - (required) The index mapping configuration in JSON
    * `settingsPath` - (required) The index settings configuration in JSON.



## Development
### Setup for Development
1. Install Jest globally
`npm install -g jest`
2. Setup local
`npm install`
3. For VSCode development
   1. Install Coverage Gutters extension
   2. Install Jest extension
4. Setup a local configuration
   1. create a local.json file in the `<importer_root>/config` directory
   2. This file is used to override the default.json options and should look something like:
```
{
    "logging": {
        "level": "debug"
    },
    "pipeline": {
        "source": {
            "module": "./lib/sources/filesystem-resource-source",
            "config": {
                "resourcesPath": "<PATH TO RESOURCE FILES>",
            }
        },
        "loader": {
            "module": "lib/loaders/elastic-resource-loader",
            "config": {
               "eshosts": [ "<THE REAL DEV SERVER>" ],
               //"eshosts": [ "http://localhost:9200" ],
               "daysToKeep": 10,
               "aliasName": "r4r_v1",
               "mappingPath": "es-mappings/mappings.json",
               "settingsPath": "es-mappings/settings.json"
            }
        }
    }
}
```

### To run tests
`npm test`

### To see code coverage
1. Run tests (this generates the code coverage file used by Coverage Gutters)
`npm test`
2. Select a JS file under lib and click the add watch in the bottom bar
3. When asked for the coverage info:
3. Select <projroot>/coverage/lcov.info
See https://marketplace.visualstudio.com/items?itemName=ryanluker.vscode-coverage-gutters for more information.
