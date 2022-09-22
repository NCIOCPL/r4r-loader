Feature: Stupid simple tests.

    Background:
        * url esHost

    Scenario: All the documents are loaded.

        Given path 'r4r_v1', '_count'
        When method get
        Then status 200
        And response.count == 258


    Scenario: Hit metadata has a reasonable form

        Given path 'r4r_v1', '_count'
        When method get
        Then def size = response.count

        Given path 'r4r_v1', '_search'
        *   def body = {'sort': ['id']}
        *   body.size = size
        And request body
        When method get
        Then status 200
        And response.count == 258
        And match each $.hits.hits[*]._index == '#regex r4r_v1_\\d{8}_\\d+'
        And match each $.hits.hits[*]._id == '#regex \\d+'


    Scenario: Individual hits have the right high-level shape

        Given path 'r4r_v1', '_count'
        When method get
        Then def size = response.count

        Given path 'r4r_v1', '_search'
        *   def body = {'sort': ['id']}
        *   body.size = size
        And request body
        When method get
        Then status 200
        And match each $.hits.hits[*]._source contains
            """
            {
                id: '#number',
                title: '#string',
                description: '#string',
                website: '#string',
                toolTypes: '#array',
                researchAreas: '#array',
                researchTypes: '#array',
                resourceAccess: '##object',
                docs: '#array',
                body: '#string',
                pocs: '#array',
                toolSubtypes: '#array'
            }
            """


    Scenario: Compare details of a live fetch to a saved response.

        Given path 'r4r_v1', '_count'
        When method get
        Then def size = response.count

        # Extract just the detailed nodes.
        * def blob = read('simple-big-blob.json')
        * def expected = get blob.hits.hits[*]._source

        Given path 'r4r_v1', '_search'
        *   def body = {'sort': ['id']}
        *   body.size = size
        And request body
        When method get
        Then status 200
        *   def hits = $.hits.hits[*]._source
        And match hits == expected

