
## Steps to Run Locally
1. Have docker installed
1. Have [nvm](https://github.com/nvm-sh/nvm) installed.
1. Open a command prompt
1. `cd <REPO_ROOT>/integration-tests/docker-r4r-loader`
1. `docker-compose up --force-recreate`
   * This is being run without the detached (-d) option so that it can be easier to stop. You can choose however you want to run it.
1. `cd <REPO_ROOT>`
1. `nvm use`
1. `npm ci`
6. `node index.js` -- this loads the test data
5. `cd <REPO_ROOT>/integration-tests`
7. `./bin/karate ./features` -- This runs the tests
   * `./bin/karate -w ./features` will watch the feature files and rerun when they are changed. So good for devving tests

## Notes
* [Docs for understanding how to run Karate standalone](https://github.com/intuit/karate/blob/6de466bdcf105d72450a40cf31b8adb5c043037d/karate-netty/README.md#standalone-jar)
   * Specifically this has to do with the magic naming of the logging config which is really why I am posting this here!
* We have docker for dev testing because ES will no longer run on higher Java versions, this is the easiest way to get it up and running.
* You need to use the `--force-recreate` option to `docker-compose up` or run `docker-compose rm` after shutting down the cluster. If the elasticsearch container is not removed, it keeps its data, and any restarts will leave the cluster in a bad state.

