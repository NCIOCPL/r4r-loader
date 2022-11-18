function fn() {
    var config = {
        esHost: 'http://localhost:9200'
    };
    if (java.lang.System.getenv('KARATE_ESHOST')) {
        config.esHost = java.lang.System.getenv('KARATE_ESHOST');
    }
    return config;
}