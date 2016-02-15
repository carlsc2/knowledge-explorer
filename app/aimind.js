
var Graph = require('./graph'),
    SearchStorage = require('./search-storage'),
    Knowledge = require('./knowledge'),
    DBPedia = require('./dbpedia'),
    fs = require('fs'),
    pd = require('./pretty-data').pd,
    xml2js = require('xml2js');


var handleAddResourceToGraph = function(uri) {
  console.log(uri);
  var searchResult = SearchStorage.get(uri);

  return Knowledge.addNode(
    searchResult.uri,
    searchResult.label,
    searchResult.relationships,
    true
  );
}

var importByURI = function(uri) {
  // If the resource is currently in the graph, skip it
  if(Knowledge.getGraph().graph[uri]) {
    return;
  }

  // Add resource to graph, if it's been searched before, within fetching new data
  //   otherwise, fetch the resource data and add to graph
  if(SearchStorage.get(uri)) {
    handleAddResourceToGraph(uri);
  } else {
    DBPedia.getAbstractByUri(uri, function(abstract_result){
      // If abstract not found on the uri, move on
      if(abstract_result.results.bindings.length === 0)  {
        return;
      } else {
        DBPedia.getPropertiesByUri(uri, function(relationships){
          console.log(uri, abstract_result);
          var abstract = abstract_result.results.bindings[0].abs.value,
              label = abstract_result.results.bindings[0].name.value,
              formatted_description = DBPedia.getFormattedDescription(abstract),
              first_sentence = DBPedia.getFirstSentence(formatted_description);
          SearchStorage.add({
            uri: uri,
            label: label,
            description: formatted_description,
            speak: first_sentence,
            relationships: relationships
          });
          handleAddResourceToGraph(uri);
        });
      }
    });
  }
}


// Import an AIMind XML file
var _import = function(filename) {
  var parser = new xml2js.Parser({ normalizeTags: true });
  fs.readFile(filename, function(err, data) {
      parser.parseString(data, function (err, result) {
          result.aimind.feature.map(function(feature) {
            importByURI(feature.$.uri);
          });
      });
  });
}


// Export an AIMind XML file
var _export = function(graph, filename) {
  var builder = new xml2js.Builder( {rootName: "AIMind"} );

  // Create a JSON object
  var features = {
    // Add root node
    feature: {
      info: {$: {data: 'root', id: "0", uri: ""}},
      neighbor: {$: {dest: '', relationship: '', weight: "0"}},
      parent: {$: {dest: '', relationship: '', weight: "1"}},
      speak: ''
    }
  };
  
  Object.keys(graph.graph).map(function(uri){

    // Add a new feature into JSON object
    features.feature[SearchStorage.get(uri).label].info.$.data = graph.graph[uri].ref;
    features.feature[SearchStorage.get(uri).label].info.$.id = SearchStorage.get(uri).label;
    features.feature[SearchStorage.get(uri).label].info.$.uri = uri;

    graph.graph[uri].dependedOnBy.map(function(neighbor_uri){
      if(!graph.graph[uri].depends[neighbor_uri]) {
        features.feature[SearchStorage.get(uri).label].neighbor.$.dest = graph.graph[neighbor_uri].ref;
        features.feature[SearchStorage.get(uri).label].neighbor.$.relationship = relationship;
      }
    });

    graph.graph[uri].depends.map(function(parent_uri){
      features.feature[SearchStorage.get(uri).label].parent.$.dest = graph.graph[parent_uri].ref;
      features.feature[SearchStorage.get(uri).label].parent.$.relationship = relationship;
    });

    features.feature[SearchStorage.get(uri).label].speak = SearchStorage.get(uri).speak;

  });
  
  console.log(features);
  // Build features JSON object into XML
  var xml = builder.buildObject(features);

  // Write to file
  fs.writeFile(filename, pd.xml(xml), function(err) {
      if(err) {
          return console.log(err);
      }
      // Space for console response
  });
  console.log(filename);

};

module.exports = {
    import: _import,
    export: _export
}
