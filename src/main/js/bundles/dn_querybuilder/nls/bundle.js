/*
 * Copyright (C) 2025 con terra GmbH (info@conterra.de)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export default {
    root: ({
        bundleName: "Query Builder",
        bundleDescription: "Bundle to build custom query tools",
        windowTitle: "Query Builder",
        editableWindowTitle: "Editable Query",
        filterWindowTitle: "Set filter to map content",
        tool: {
            title: "Build Query",
            tooltip: "Build your own Query"
        },
        ui: {
            selectStore: "What to search for?",
            spatialRelation: "Where to search?",
            linkOperator: "What is valid?",
            sorting: "Sorting",
            sortOptions: "How to sort?",
            everywhere: "everywhere",
            currentExtent: "current extent",
            delete: "Delete",
            replaceOpenedTables: "Replace opened tables",
            search: "Search",
            cancelSearch: "Cancel search",
            setLayerDefinition: "Set filter",
            typeInValue: "type in value",
            yes: "yes",
            no: "no",
            and: "All conditions",
            or: "At least one condition",
            enterValue: "enter value",
            removeQuery: "Remove this query",
            multipleSpatialInputs: "Select multiple geometries",
            resetSpatialInput: "Remove spatial restriction",
            negateSpatialInput: "Search outside of selected geometry",
            filterTitle: "Filter",
            tempStoreTitle: "Results of the previous search",
            setFilterActionLabel: "Filter map content",
            resetFilterActionLabel: "Reset filter",
            conditionFieldsetLegend: "Condition",
            conditionFieldNameLabel: "Field name",
            relationalOperators: {
                is: "is",
                is_not: "is not",
                exists: "exists",
                eqw: "is (wildcard)",
                suggest: "suggest",
                contains: "contains",
                contains_not: "does not contain",
                starts_with: "starts with",
                ends_with: "ends with",
                is_greater_than: "is greater than",
                is_greater_or_equal: "is greater or equal",
                is_less_than: "is less than",
                is_less_or_equal: "is less or equal",
                before: "before",
                after: "after",
                in: "is in"
            },
            rules: {
                required: "required",
                number: "value must be type of number",
                string: "value must be type of string"
            },
            errors: {
                noResultsError: "No results found for your query!"
            },
            aria: {
                add: "add new condition",
                remove: "remove current condition",
                negate: "negate current condition",
                selectLayer: "select layer",
                sortingField: "select sort field name",
                linkOperatorsEnabled: "Link operators are active.",
                linkOperatorsDisabled: "Link operators are inactive.",
                selectRelationalOperators: "Select relational operators"
            }
        }
    }),
    "de": true
};
