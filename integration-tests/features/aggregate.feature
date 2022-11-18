Feature: Verify the expected aggregates are unchanged.

    Background:
        * url esHost

    Scenario Outline: Compare aggregate queries for facets.

        *   def blob = read('aggregate-' + filter + '.json')
        *   def expected = get blob.aggregations.TestAggregation

        *   def aggPath = filter
        *   def aggBasis = filter + ".label"

        *   def body =
                """
                {
                    "size": 0,
                    "aggs": {
                        "TestAggregation": {
                            "nested": {
                                "path": null
                            },
                            "aggs": {
                                "innerAggregation": {
                                    "terms": {
                                        "size": 1000,
                                        "order": {"_key": "asc"},
                                        "field": null
                                    }
                                }
                            }
                        }
                    }
                }
                """
        *   body.aggs.TestAggregation.nested.path = aggPath
        *   body.aggs.TestAggregation.aggs.innerAggregation.terms.field = aggBasis

        Given path 'r4r_v1', '_search'
        And request body
        When method get
        Then status 200
        *   def actualAggregation = $.aggregations.TestAggregation
        And match actualAggregation == expected

        Examples:
            | filter        |
            | docs          |
            | researchAreas |
            | researchTypes |
            | toolTypes     |


    Scenario Outline: Compare aggregate queries for sub-facets.

        *   def blob = read('aggregate-subfacet-' + filter + '-' + parentType + '.json')
        *   def expected = get blob.aggregations.TestAggregation

        *   def aggPath = filter
        *   def parentKey = filter + ".parentKey"
        *   def aggBasis = filter + ".label"

        *   def body =
            """
            {
                "size": 0,
                "aggs": {
                    "TestAggregation": {
                        "nested": {
                            "path": null
                        },
                        "aggs": {
                            "innerAggregation": {
                                "filter": {
                                    "term": { }
                                },
                                "aggs": {
                                    "innermostAggregation": {
                                        "terms": {
                                            "size": 1000,
                                            "order": {
                                                "_key": "asc"
                                            },
                                            "field": null
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            """
        *   body.aggs.TestAggregation.nested.path = aggPath
            # Array syntax lets us create an object with a dynamic key name.
        *   body.aggs.TestAggregation.aggs.innerAggregation.filter.term[parentKey] = parentType
        *   body.aggs.TestAggregation.aggs.innerAggregation.aggs.innermostAggregation.terms.field = aggBasis

        Given path 'r4r_v1', '_search'
        And request body
        When method get
        Then status 200
        *   def actualAggregation = $.aggregations.TestAggregation
        And match actualAggregation == expected

        Examples:
            | filter       | parentType               |
            | toolSubtypes | analysis_tools           |
            | toolSubtypes | community_research_tools |
            | toolSubtypes | datasets_databases       |
            | toolSubtypes | lab_tools                |
