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
    bundleName: "Query Builder",
    bundleDescription: "Das Bundle ermöglicht es benutzerdefinierte Queries zu erstellen",
    windowTitle: "Abfrage erstellen",
    editableWindowTitle: "Bearbeitbare Abfrage",
    filterWindowTitle: "Karteninhalt filtern",
    tool: {
        title: "Eigene Abfrage erstellen",
        tooltip: "Bauen Sie Ihre eigene Abfrage"
    },
    ui: {
        selectStore: "Was suchen?",
        spatialRelation: "Wo suchen?",
        linkOperator: "Was soll gelten?",
        sorting: "Sortierung",
        sortOptions: "Wie sortieren?",
        everywhere: "Überall",
        currentExtent: "Aktueller Kartenausschnitt",
        delete: "Löschen",
        replaceOpenedTables: "Vorhandene Ergebnisse ersetzen",
        search: "Suche starten",
        cancelSearch: "Suche abbrechen",
        setLayerDefinition: "Filter setzen",
        typeInValue: "Wert eingeben",
        yes: "ja",
        no: "nein",
        and: "Alle Bedingungen",
        or: "Mindestens eine Bedingung",
        enterValue: "Wert eingeben",
        removeQuery: "Diese Bedingung entfernen",
        multipleSpatialInputs: "Mehrere Geometrien auswählen",
        resetSpatialInput: "Räumliche Einschränkung entfernen",
        negateSpatialInput: "Außerhalb der ausgewählten Geometrie suchen",
        filterTitle: "Filter",
        tempStoreTitle: "Ergebnisse der vorherigen Suche",
        setFilterActionLabel: "Karteninhalt filtern",
        resetFilterActionLabel: "Filter zurücksetzen",
        conditionFieldsetLegend: "Bedingung",
        conditionFieldNameLabel: "Feldname",
        relationalOperators: {
            is: "ist gleich",
            is_not: "ist nicht gleich",
            exists: "ist vorhanden",
            eqw: "ist gleich (wildcard)",
            suggest: "ähnelt",
            contains: "enthält",
            contains_not: "enthält nicht",
            starts_with: "beginnt mit",
            ends_with: "endet mit",
            is_greater_than: "ist größer",
            is_greater_or_equal: "ist größer / gleich",
            is_less_than: "ist kleiner",
            is_less_or_equal: "ist kleiner / gleich",
            before: "vor",
            after: "nach",
            in: "ist in"
        },
        rules: {
            required: "Wert wird benötigt",
            number: "Wert muss vom Typ number sein",
            string: "Wert muss vom Typ string sein"
        },
        errors: {
            noResultsError: "Keine Ergebnisse für Ihre Abfrage gefunden!"
        },
        aria: {
            add: "Neue Bedingung hinzufügen",
            remove: "Aktuelle Bedingung entfernen",
            negate: "Aktuelle Bedingung negieren",
            selectLayer: "Layer auswählen",
            sortingField: "Sortierfeldname auswählen",
            linkOperatorsEnabled: "Verknüpfungsoperatoren sind aktiv.",
            linkOperatorsDisabled: "Verknüpfungsoperatoren sind nicht aktiv.",
            selectRelationalOperators: "Vergleichsoperatoren auswählen"
        }
    }
};
