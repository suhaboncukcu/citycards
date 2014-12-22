(function () {

/* Imports */
var _ = Package.underscore._;
var DDP = Package.ddp.DDP;
var DDPServer = Package.ddp.DDPServer;
var Meteor = Package.meteor.Meteor;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var Log = Package.logging.Log;
var Tracker = Package.deps.Tracker;
var Deps = Package.deps.Deps;
var Blaze = Package.ui.Blaze;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var Spacebars = Package.spacebars.Spacebars;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var EasySearch;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/matteodem:easy-search/lib/easy-search-common.js                                                     //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
EasySearch = (function () {                                                                                     // 1
  'use strict';                                                                                                 // 2
                                                                                                                // 3
  var ESCounts,                                                                                                 // 4
    Searchers,                                                                                                  // 5
    indexes = {/** @see defaultOptions */},                                                                     // 6
    defaultOptions = {                                                                                          // 7
      'format' : 'mongo',                                                                                       // 8
      'skip' : 0,                                                                                               // 9
      'limit' : 10,                                                                                             // 10
      'use' : 'minimongo',                                                                                      // 11
      'reactive' : true,                                                                                        // 12
      'props' : {},                                                                                             // 13
      'sort' : function () {                                                                                    // 14
        if (Searchers[this.use]) {                                                                              // 15
          return Searchers[this.use].defaultSort(this);                                                         // 16
        }                                                                                                       // 17
                                                                                                                // 18
        return {};                                                                                              // 19
      },                                                                                                        // 20
      'count' : function () {                                                                                   // 21
        var doc = ESCounts.findOne({ _id : this.name });                                                        // 22
                                                                                                                // 23
        if (doc) {                                                                                              // 24
          return doc.count;                                                                                     // 25
        }                                                                                                       // 26
                                                                                                                // 27
        return 0;                                                                                               // 28
      },                                                                                                        // 29
      'changeResults' : function (results) {                                                                    // 30
        return results;                                                                                         // 31
      },                                                                                                        // 32
      /**                                                                                                       // 33
       * When using elastic-search it's the query object,                                                       // 34
       * while using with mongo-db it's the selector object.                                                    // 35
       *                                                                                                        // 36
       * @param {String} searchString                                                                           // 37
       * @return {Object}                                                                                       // 38
       */                                                                                                       // 39
      'query' : function (searchString) {                                                                       // 40
        return Searchers[this.use].defaultQuery(this, searchString);                                            // 41
      }                                                                                                         // 42
    };                                                                                                          // 43
                                                                                                                // 44
  ESCounts = new Mongo.Collection('esCounts');                                                                  // 45
                                                                                                                // 46
  /** Helper Functions */                                                                                       // 47
  function setUpPublication(name, opts) {                                                                       // 48
    Meteor.publish(name + '/easySearch', function (conf) {                                                      // 49
      var resultSet,                                                                                            // 50
        resultArray = [],                                                                                       // 51
        publishScope = this;                                                                                    // 52
                                                                                                                // 53
      check(conf, Object);                                                                                      // 54
                                                                                                                // 55
      // TODO: sanity check each property                                                                       // 56
      indexes[name].skip = conf.skip;                                                                           // 57
      indexes[name].limit = conf.limit || indexes[name].limit;                                                  // 58
      indexes[name].props = _.extend(indexes[name].props, conf.props);                                          // 59
      indexes[name].publishScope = this;                                                                        // 60
                                                                                                                // 61
      resultSet = Searchers[opts.use].search(name, conf.value, indexes[name]);                                  // 62
                                                                                                                // 63
      ESCounts.update({ _id: name }, { $set: { count: resultSet.total } }, { upsert: true });                   // 64
                                                                                                                // 65
      if (resultSet.results.length > 0) {                                                                       // 66
        if (_.isObject(resultSet.results[0])) {                                                                 // 67
          resultArray = _.pluck(resultSet.results, '_id');                                                      // 68
        } else if (_.isString(resultSet.results[0])) {                                                          // 69
          resultArray = resultSet.results;                                                                      // 70
        }                                                                                                       // 71
                                                                                                                // 72
        // properly observe the collection!                                                                     // 73
        opts.collection                                                                                         // 74
          .find({ _id: { $in: resultArray } }, { sort: indexes[name].sort()})                                   // 75
          .observe({                                                                                            // 76
            added: function (doc) {                                                                             // 77
              doc._index = name;                                                                                // 78
              publishScope.added('esSearchResults', doc._id, doc);                                              // 79
            },                                                                                                  // 80
            changed: function (doc) {                                                                           // 81
              publishScope.changed('esSearchResults', doc._id, doc);                                            // 82
            },                                                                                                  // 83
            removed: function (doc) {                                                                           // 84
              publishScope.removed('esSearchResults', doc._id);                                                 // 85
            }                                                                                                   // 86
          }                                                                                                     // 87
        );                                                                                                      // 88
                                                                                                                // 89
        publishScope.ready();                                                                                   // 90
      } else {                                                                                                  // 91
        return [];                                                                                              // 92
      }                                                                                                         // 93
    });                                                                                                         // 94
                                                                                                                // 95
    Meteor.publish(name + '/easySearchCount', function () {                                                     // 96
      return ESCounts.find({ '_id' : name });                                                                   // 97
    });                                                                                                         // 98
  }                                                                                                             // 99
                                                                                                                // 100
  if (Meteor.isClient) {                                                                                        // 101
    /**                                                                                                         // 102
     * find method to let users interact with search results.                                                   // 103
     * @param {Object} selector                                                                                 // 104
     * @param {Object} options                                                                                  // 105
     * @returns {MongoCursor}                                                                                   // 106
     */                                                                                                         // 107
    defaultOptions.find = function (selector, options) {                                                        // 108
      selector = selector || {};                                                                                // 109
      selector._index = this.name;                                                                              // 110
      return ESSearchResults.find(selector, options);                                                           // 111
    };                                                                                                          // 112
                                                                                                                // 113
    /**                                                                                                         // 114
     * findOne method to let users interact with search results.                                                // 115
     * @param {Object} selector                                                                                 // 116
     * @param {Object} options                                                                                  // 117
     * @returns {Document}                                                                                      // 118
     */                                                                                                         // 119
    defaultOptions.findOne = function (selector, options) {                                                     // 120
      if (_.isObject(selector) || !selector) {                                                                  // 121
        selector = selector || {};                                                                              // 122
        selector._index = this.name;                                                                            // 123
      }                                                                                                         // 124
                                                                                                                // 125
      return ESSearchResults.findOne(selector, options);                                                        // 126
    };                                                                                                          // 127
  }                                                                                                             // 128
                                                                                                                // 129
                                                                                                                // 130
  /**                                                                                                           // 131
   * Searchers contains all engines that can be used to search content, until now:                              // 132
   *                                                                                                            // 133
   * minimongo (client): Client side collection for reactive search                                             // 134
   * elastic-search (server): Elastic search server to search with (fast)                                       // 135
   * mongo-db (server): MongoDB on the server to search (more convenient)                                       // 136
   *                                                                                                            // 137
   */                                                                                                           // 138
  Searchers = {};                                                                                               // 139
                                                                                                                // 140
  return {                                                                                                      // 141
    /**                                                                                                         // 142
     * Placeholder config method.                                                                               // 143
     *                                                                                                          // 144
     * @param {Object} newConfig                                                                                // 145
     */                                                                                                         // 146
    'config' : function (newConfig) {                                                                           // 147
      return {};                                                                                                // 148
    },                                                                                                          // 149
    /**                                                                                                         // 150
     * Simple logging method.                                                                                   // 151
     *                                                                                                          // 152
     * @param {String} message                                                                                  // 153
     * @param {String} type                                                                                     // 154
     */                                                                                                         // 155
    'log' : function (message, type) {                                                                          // 156
      type = type || 'log';                                                                                     // 157
                                                                                                                // 158
      if (console && _.isFunction(console[type])) {                                                             // 159
        console[type](message);                                                                                 // 160
      } else if (console && _.isFunction(console.log)) {                                                        // 161
        console.log(message);                                                                                   // 162
      }                                                                                                         // 163
    },                                                                                                          // 164
    /**                                                                                                         // 165
     * Create a search index.                                                                                   // 166
     *                                                                                                          // 167
     * @param {String} name                                                                                     // 168
     * @param {Object} options                                                                                  // 169
     */                                                                                                         // 170
    'createSearchIndex' : function (name, options) {                                                            // 171
      check(name, Match.OneOf(String, null));                                                                   // 172
      check(options, Object);                                                                                   // 173
                                                                                                                // 174
      options.name = name;                                                                                      // 175
      options.field = _.isArray(options.field) ? options.field : [options.field];                               // 176
      indexes[name] = _.extend(_.clone(defaultOptions), options);                                               // 177
                                                                                                                // 178
      options = indexes[name];                                                                                  // 179
                                                                                                                // 180
      if (options.permission) {                                                                                 // 181
        EasySearch.log(                                                                                         // 182
            'permission property is now deprecated! Return false inside a custom query method instead',         // 183
            'warn'                                                                                              // 184
        );                                                                                                      // 185
      }                                                                                                         // 186
                                                                                                                // 187
      if (Meteor.isServer && EasySearch._usesSubscriptions(name)) {                                             // 188
        setUpPublication(name, indexes[name]);                                                                  // 189
      }                                                                                                         // 190
                                                                                                                // 191
      Searchers[options.use] && Searchers[options.use].createSearchIndex(name, options);                        // 192
    },                                                                                                          // 193
    /**                                                                                                         // 194
     * Perform a search.                                                                                        // 195
     *                                                                                                          // 196
     * @param {String} name             the search index                                                        // 197
     * @param {String} searchString     the string to be searched                                               // 198
     * @param {Object} options          defined with createSearchIndex                                          // 199
     * @param {Function} callback       optional callback to be used                                            // 200
     */                                                                                                         // 201
    'search' : function (name, searchString, options, callback) {                                               // 202
      var results,                                                                                              // 203
        index = indexes[name],                                                                                  // 204
        searcherType = index.use;                                                                               // 205
                                                                                                                // 206
      check(name, String);                                                                                      // 207
      check(searchString, String);                                                                              // 208
      check(options, Object);                                                                                   // 209
      check(callback, Match.Optional(Function));                                                                // 210
                                                                                                                // 211
      if ("undefined" === typeof Searchers[searcherType]) {                                                     // 212
        throw new Meteor.Error(500, "Couldnt search with type: '" + searcherType + "'");                        // 213
      }                                                                                                         // 214
                                                                                                                // 215
      results = Searchers[searcherType].search(name, searchString, _.extend(indexes[name], options), callback); // 216
                                                                                                                // 217
      return index.changeResults(results);                                                                      // 218
    },                                                                                                          // 219
    /**                                                                                                         // 220
     * Retrieve a specific index configuration.                                                                 // 221
     *                                                                                                          // 222
     * @param {String} name                                                                                     // 223
     * @return {Object}                                                                                         // 224
     * @api public                                                                                              // 225
     */                                                                                                         // 226
    'getIndex' : function (name) {                                                                              // 227
      return indexes[name];                                                                                     // 228
    },                                                                                                          // 229
    /**                                                                                                         // 230
     * Retrieve all index configurations                                                                        // 231
     */                                                                                                         // 232
    'getIndexes' : function () {                                                                                // 233
      return indexes;                                                                                           // 234
    },                                                                                                          // 235
    /**                                                                                                         // 236
     * Retrieve a specific Seacher.                                                                             // 237
     *                                                                                                          // 238
     * @param {String} name                                                                                     // 239
     * @return {Object}                                                                                         // 240
     * @api public                                                                                              // 241
     */                                                                                                         // 242
    'getSearcher' : function (name) {                                                                           // 243
      return Searchers[name];                                                                                   // 244
    },                                                                                                          // 245
    /**                                                                                                         // 246
     * Retrieve all Searchers.                                                                                  // 247
     */                                                                                                         // 248
    'getSearchers' : function () {                                                                              // 249
      return Searchers;                                                                                         // 250
    },                                                                                                          // 251
    /**                                                                                                         // 252
     * Loop through the indexes and provide the configuration.                                                  // 253
     *                                                                                                          // 254
     * @param {Array|String} indexes                                                                            // 255
     * @param callback                                                                                          // 256
     */                                                                                                         // 257
    'eachIndex' : function (indexes, callback) {                                                                // 258
      indexes = !_.isArray(indexes) ? [indexes] : indexes;                                                      // 259
                                                                                                                // 260
      _.each(indexes, function (index) {                                                                        // 261
        callback(index, EasySearch.getIndex(index));                                                            // 262
      });                                                                                                       // 263
    },                                                                                                          // 264
    /**                                                                                                         // 265
     * Makes it possible to override or extend the different                                                    // 266
     * types of search to use with EasySearch (the "use" property)                                              // 267
     * when using EasySearch.createSearchIndex()                                                                // 268
     *                                                                                                          // 269
     * @param {String} key      Type, e.g. mongo-db, elastic-search                                             // 270
     * @param {Object} methods  Methods to be used, only 2 are required:                                        // 271
     *                          - createSearchIndex (name, options)                                             // 272
     *                          - search (name, searchString, [options, callback])                              // 273
     *                          - defaultQuery (options, searchString)                                          // 274
     *                          - defaultSort (options)                                                         // 275
     */                                                                                                         // 276
    'createSearcher' : function (key, methods) {                                                                // 277
      check(key, String);                                                                                       // 278
      check(methods.search, Function);                                                                          // 279
      check(methods.createSearchIndex, Function);                                                               // 280
                                                                                                                // 281
      Searchers[key] = methods;                                                                                 // 282
    },                                                                                                          // 283
    /**                                                                                                         // 284
     * Simple helper to check if searcher uses server side subscriptions for searching.                         // 285
     *                                                                                                          // 286
     * @param {String} index Index name to check configuration for                                              // 287
     */                                                                                                         // 288
    '_usesSubscriptions' : function (index) {                                                                   // 289
      var conf = EasySearch.getIndex(index);                                                                    // 290
      return conf && conf.reactive && conf.use !== 'minimongo';                                                 // 291
    }                                                                                                           // 292
  };                                                                                                            // 293
})();                                                                                                           // 294
                                                                                                                // 295
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/matteodem:easy-search/lib/easy-search-convenience.js                                                //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
Meteor.Collection.prototype.initEasySearch = function (fields, options) {                                       // 1
  if (!_.isObject(options)) {                                                                                   // 2
    options = {};                                                                                               // 3
  }                                                                                                             // 4
                                                                                                                // 5
  EasySearch.createSearchIndex(this._name, _.extend(options, {                                                  // 6
    'collection' : this,                                                                                        // 7
    'field' : fields                                                                                            // 8
  }));                                                                                                          // 9
};                                                                                                              // 10
                                                                                                                // 11
if (Meteor.isClient) {                                                                                          // 12
  jQuery.fn.esAutosuggestData = function () {                                                                   // 13
    var id,                                                                                                     // 14
      input = $(this);                                                                                          // 15
                                                                                                                // 16
    if (input.prop("tagName").toUpperCase() !== 'INPUT') {                                                      // 17
      return [];                                                                                                // 18
    }                                                                                                           // 19
                                                                                                                // 20
    id = EasySearch.Components.generateId(input.parent().data('index'), input.parent().data('id'));             // 21
                                                                                                                // 22
    return EasySearch.Components.Variables.get(id, 'autosuggestSelected');                                      // 23
  }                                                                                                             // 24
}                                                                                                               // 25
                                                                                                                // 26
                                                                                                                // 27
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/matteodem:easy-search/lib/searchers/mongo.js                                                        //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var methods = {                                                                                                 // 1
  /**                                                                                                           // 2
   * Set up a search index.                                                                                     // 3
   *                                                                                                            // 4
   * @param name                                                                                                // 5
   * @param options                                                                                             // 6
   * @returns {void}                                                                                            // 7
   */                                                                                                           // 8
  'createSearchIndex' : function (name, options) {},                                                            // 9
  /**                                                                                                           // 10
   *                                                                                                            // 11
   * Perform a really simple search with mongo db.                                                              // 12
   *                                                                                                            // 13
   * @param {String} name                                                                                       // 14
   * @param {String} searchString                                                                               // 15
   * @param {Object} options                                                                                    // 16
   * @param {Function} callback                                                                                 // 17
   * @returns {Object}                                                                                          // 18
   */                                                                                                           // 19
  'search' : function (name, searchString, options, callback) {                                                 // 20
    var cursor,                                                                                                 // 21
      results,                                                                                                  // 22
      selector,                                                                                                 // 23
      cursorOptions,                                                                                            // 24
      index = EasySearch.getIndex(name);                                                                        // 25
                                                                                                                // 26
    if (!_.isObject(index)) {                                                                                   // 27
      return;                                                                                                   // 28
    }                                                                                                           // 29
                                                                                                                // 30
    options.limit = options.limit || 10;                                                                        // 31
                                                                                                                // 32
    // if several, fields do an $or search, otherwise only over the field                                       // 33
    selector = index.query(searchString, options);                                                              // 34
                                                                                                                // 35
    if (!selector) {                                                                                            // 36
      return { total: 0, results: [] };                                                                         // 37
    }                                                                                                           // 38
                                                                                                                // 39
    cursorOptions = {                                                                                           // 40
      sort : index.sort(searchString)                                                                           // 41
    };                                                                                                          // 42
                                                                                                                // 43
    if (options.returnFields) {                                                                                 // 44
      cursorOptions.fields = options.returnFields;                                                              // 45
    }                                                                                                           // 46
                                                                                                                // 47
    if (options.skip) {                                                                                         // 48
      cursorOptions.skip = options.skip;                                                                        // 49
    }                                                                                                           // 50
                                                                                                                // 51
    cursor = index.collection.find(selector, cursorOptions);                                                    // 52
                                                                                                                // 53
    results = {                                                                                                 // 54
      'results' : _.first(cursor.fetch(), options.limit),                                                       // 55
      'total' : cursor.count()                                                                                  // 56
    };                                                                                                          // 57
                                                                                                                // 58
    if (_.isFunction(callback)) {                                                                               // 59
      callback(results);                                                                                        // 60
    }                                                                                                           // 61
                                                                                                                // 62
    return results;                                                                                             // 63
  },                                                                                                            // 64
  /**                                                                                                           // 65
   * The default mongo-db query - selector used for searching.                                                  // 66
   *                                                                                                            // 67
   * @param {Object} options                                                                                    // 68
   * @param {String} searchString                                                                               // 69
   * @returns {Object}                                                                                          // 70
   */                                                                                                           // 71
  'defaultQuery' : function (options, searchString) {                                                           // 72
    var orSelector,                                                                                             // 73
      selector = {},                                                                                            // 74
      field = options.field,                                                                                    // 75
      stringSelector = { '$regex' : '.*' + searchString + '.*', '$options' : 'i' };                             // 76
                                                                                                                // 77
    if (_.isString(field)) {                                                                                    // 78
      selector[field] = stringSelector;                                                                         // 79
      return selector;                                                                                          // 80
    }                                                                                                           // 81
                                                                                                                // 82
    // Convert numbers if configured                                                                            // 83
    if (options.convertNumbers && parseInt(searchString, 10) == searchString) {                                 // 84
      searchString = parseInt(searchString, 10);                                                                // 85
    }                                                                                                           // 86
                                                                                                                // 87
    // Should be an array                                                                                       // 88
    selector['$or'] = [];                                                                                       // 89
                                                                                                                // 90
    _.each(field, function (fieldString) {                                                                      // 91
      orSelector = {};                                                                                          // 92
                                                                                                                // 93
      if (_.isString(searchString)) {                                                                           // 94
        orSelector[fieldString] = stringSelector;                                                               // 95
      } else if (_.isNumber(searchString)) {                                                                    // 96
        orSelector[fieldString] = searchString;                                                                 // 97
      }                                                                                                         // 98
                                                                                                                // 99
      selector['$or'].push(orSelector);                                                                         // 100
    });                                                                                                         // 101
                                                                                                                // 102
    return selector;                                                                                            // 103
  },                                                                                                            // 104
  /**                                                                                                           // 105
   * The default mongo-db sorting method used for sorting the results.                                          // 106
   *                                                                                                            // 107
   * @param {Object} options                                                                                    // 108
   * @return array                                                                                              // 109
   */                                                                                                           // 110
  'defaultSort' : function (options) {                                                                          // 111
    return options.field;                                                                                       // 112
  }                                                                                                             // 113
};                                                                                                              // 114
                                                                                                                // 115
if (Meteor.isClient) {                                                                                          // 116
  EasySearch.createSearcher('minimongo', methods);                                                              // 117
} else if (Meteor.isServer) {                                                                                   // 118
  EasySearch.createSearcher('mongo-db', methods);                                                               // 119
}                                                                                                               // 120
                                                                                                                // 121
                                                                                                                // 122
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/matteodem:easy-search/lib/easy-search-server.js                                                     //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
'use strict';                                                                                                   // 1
var ElasticSearch = Npm.require('elasticsearch');                                                               // 2
                                                                                                                // 3
EasySearch._esDefaultConfig = {                                                                                 // 4
  host : 'localhost:9200'                                                                                       // 5
};                                                                                                              // 6
                                                                                                                // 7
/**                                                                                                             // 8
 * Override the config for Elastic Search.                                                                      // 9
 *                                                                                                              // 10
 * @param {object} newConfig                                                                                    // 11
 */                                                                                                             // 12
EasySearch.config = function (newConfig) {                                                                      // 13
  if ("undefined" !== typeof newConfig) {                                                                       // 14
    check(newConfig, Object);                                                                                   // 15
    this._config = _.extend(this._esDefaultConfig, newConfig);                                                  // 16
    this.ElasticSearchClient = new ElasticSearch.Client(this._config);                                          // 17
  }                                                                                                             // 18
                                                                                                                // 19
  return this._config;                                                                                          // 20
};                                                                                                              // 21
                                                                                                                // 22
/**                                                                                                             // 23
 * Get the ElasticSearchClient                                                                                  // 24
 * @see http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current                       // 25
 *                                                                                                              // 26
 * @return {ElasticSearch.Client}                                                                               // 27
 */                                                                                                             // 28
EasySearch.getElasticSearchClient = function () {                                                               // 29
  return this.ElasticSearchClient;                                                                              // 30
};                                                                                                              // 31
                                                                                                                // 32
Meteor.methods({                                                                                                // 33
  /**                                                                                                           // 34
   * Make server side search possible on the client.                                                            // 35
   *                                                                                                            // 36
   * @param {String} name                                                                                       // 37
   * @param {String} searchString                                                                               // 38
   * @param {Object} options                                                                                    // 39
   */                                                                                                           // 40
  easySearch: function (name, searchString, options) {                                                          // 41
    check(name, String);                                                                                        // 42
    check(searchString, String);                                                                                // 43
    check(options, Object);                                                                                     // 44
    return EasySearch.search(name, searchString, options);                                                      // 45
  }                                                                                                             // 46
});                                                                                                             // 47
                                                                                                                // 48
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/matteodem:easy-search/lib/searchers/elastic-search.js                                               //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
'use strict';                                                                                                   // 1
                                                                                                                // 2
var Future = Npm.require('fibers/future'),                                                                      // 3
  ElasticSearch = Npm.require('elasticsearch');                                                                 // 4
                                                                                                                // 5
/**                                                                                                             // 6
 * Return Elastic Search indexable data.                                                                        // 7
 *                                                                                                              // 8
 * @param {Object} doc the document to get the values from                                                      // 9
 * @return {Object}                                                                                             // 10
 */                                                                                                             // 11
function getESFields(doc) {                                                                                     // 12
  var newDoc = {};                                                                                              // 13
                                                                                                                // 14
  _.each(doc, function (value, key) {                                                                           // 15
    newDoc[key] = _.isObject(value) && !_.isArray(value) ? JSON.stringify(value) : value;                       // 16
  });                                                                                                           // 17
                                                                                                                // 18
  return newDoc;                                                                                                // 19
}                                                                                                               // 20
                                                                                                                // 21
EasySearch.createSearcher('elastic-search', {                                                                   // 22
  /**                                                                                                           // 23
   * Write a document to a specified index.                                                                     // 24
   *                                                                                                            // 25
   * @param {String} name                                                                                       // 26
   * @param {Object} doc                                                                                        // 27
   * @param {String} id                                                                                         // 28
   */                                                                                                           // 29
  'writeToIndex' : function (name, doc, id) {                                                                   // 30
    var config = EasySearch.config() || {};                                                                     // 31
                                                                                                                // 32
    // add to index                                                                                             // 33
    EasySearch.ElasticSearchClient.index({                                                                      // 34
      index : name.toLowerCase(),                                                                               // 35
      type : 'default',                                                                                         // 36
      id : id,                                                                                                  // 37
      body : doc                                                                                                // 38
    }, function (err, data) {                                                                                   // 39
      if (err) {                                                                                                // 40
        console.log('Had error adding a document!');                                                            // 41
        console.log(err);                                                                                       // 42
      }                                                                                                         // 43
                                                                                                                // 44
      if (config.debug && console) {                                                                            // 45
        console.log('EasySearch: Added / Replaced document to Elastic Search:');                                // 46
        console.log('EasySearch: ' + data + "\n");                                                              // 47
      }                                                                                                         // 48
    });                                                                                                         // 49
  },                                                                                                            // 50
  /**                                                                                                           // 51
   * Setup some observers on the mongo db collection provided.                                                  // 52
   *                                                                                                            // 53
   * @param {String} name                                                                                       // 54
   * @param {Object} options                                                                                    // 55
   */                                                                                                           // 56
  'createSearchIndex' : function (name, options) {                                                              // 57
    var searcherScope = this,                                                                                   // 58
      config = EasySearch.config() || {};                                                                       // 59
                                                                                                                // 60
    if ("undefined" === typeof EasySearch.ElasticSearchClient) {                                                // 61
      EasySearch.ElasticSearchClient = new ElasticSearch.Client(this._esDefaultConfig);                         // 62
    }                                                                                                           // 63
                                                                                                                // 64
    name = name.toLowerCase();                                                                                  // 65
                                                                                                                // 66
    options.collection.find().observeChanges({                                                                  // 67
      added: function (id, fields) {                                                                            // 68
        searcherScope.writeToIndex(name, getESFields(fields), id);                                              // 69
      },                                                                                                        // 70
      changed: function (id, fields) {                                                                          // 71
        // Overwrites the current document with the new doc                                                     // 72
        searcherScope.writeToIndex(name, getESFields(options.collection.findOne(id)), id);                      // 73
      },                                                                                                        // 74
      removed: function (id) {                                                                                  // 75
        EasySearch.ElasticSearchClient.delete({                                                                 // 76
          index: name,                                                                                          // 77
          type: 'default',                                                                                      // 78
          id: id                                                                                                // 79
        }, function (error, response) {                                                                         // 80
          if (config.debug) {                                                                                   // 81
            console.log('Removed document with id ( ' +  id + ' )!');                                           // 82
          }                                                                                                     // 83
        });                                                                                                     // 84
      }                                                                                                         // 85
    });                                                                                                         // 86
  },                                                                                                            // 87
  /**                                                                                                           // 88
   * Get the data out of the JSON elastic search response.                                                      // 89
   *                                                                                                            // 90
   * @param {Object} data                                                                                       // 91
   * @returns {Array}                                                                                           // 92
   */                                                                                                           // 93
  'extractJSONData' : function (data) {                                                                         // 94
    data = _.isString(data) ? JSON.parse(data) : data;                                                          // 95
                                                                                                                // 96
    var results = _.map(data.hits.hits, function (resultSet) {                                                  // 97
      var field = '_source';                                                                                    // 98
                                                                                                                // 99
      if (resultSet['fields']) {                                                                                // 100
        field = 'fields';                                                                                       // 101
      }                                                                                                         // 102
                                                                                                                // 103
      resultSet[field]['_id'] = resultSet['_id'];                                                               // 104
      return resultSet[field];                                                                                  // 105
    });                                                                                                         // 106
                                                                                                                // 107
    return {                                                                                                    // 108
      'results' : results,                                                                                      // 109
      'total' : data.hits.total                                                                                 // 110
    };                                                                                                          // 111
  },                                                                                                            // 112
  /**                                                                                                           // 113
   * Perform a search with Elastic Search, using fibers.                                                        // 114
   *                                                                                                            // 115
   * @param {String} name                                                                                       // 116
   * @param {String} searchString                                                                               // 117
   * @param {Object} options                                                                                    // 118
   * @param {Function} callback                                                                                 // 119
   * @returns {*}                                                                                               // 120
   */                                                                                                           // 121
  'search' : function (name, searchString, options, callback) {                                                 // 122
    var bodyObj,                                                                                                // 123
      that = this,                                                                                              // 124
      fut = new Future(),                                                                                       // 125
      index = EasySearch.getIndex(name);                                                                        // 126
                                                                                                                // 127
    if (!_.isObject(index)) {                                                                                   // 128
      return;                                                                                                   // 129
    }                                                                                                           // 130
                                                                                                                // 131
    bodyObj = {                                                                                                 // 132
      "query" : index.query(searchString, options)                                                              // 133
    };                                                                                                          // 134
                                                                                                                // 135
    if (!bodyObj.query) {                                                                                       // 136
      return { total: 0, results: [] };                                                                         // 137
    }                                                                                                           // 138
                                                                                                                // 139
    if (!options.reactive) {                                                                                    // 140
      bodyObj.sort = index.sort(searchString);                                                                  // 141
    }                                                                                                           // 142
                                                                                                                // 143
    if (options.returnFields) {                                                                                 // 144
      if (options.returnFields.indexOf('_id') === -1 ) {                                                        // 145
        options.returnFields.push('_id');                                                                       // 146
      }                                                                                                         // 147
                                                                                                                // 148
      bodyObj.fields = options.returnFields;                                                                    // 149
    }                                                                                                           // 150
                                                                                                                // 151
    // Modify Elastic Search body if wished                                                                     // 152
    if (index.body && _.isFunction(index.body)) {                                                               // 153
      bodyObj = index.body(bodyObj);                                                                            // 154
    }                                                                                                           // 155
                                                                                                                // 156
    name = name.toLowerCase();                                                                                  // 157
                                                                                                                // 158
    if ("function" === typeof callback) {                                                                       // 159
      EasySearch.ElasticSearchClient.search(name, bodyObj, callback);                                           // 160
      return;                                                                                                   // 161
    }                                                                                                           // 162
                                                                                                                // 163
    // Most likely client call, return data set                                                                 // 164
    EasySearch.ElasticSearchClient.search({                                                                     // 165
      index : name,                                                                                             // 166
      body : bodyObj,                                                                                           // 167
      size : options.limit,                                                                                     // 168
      from: options.skip                                                                                        // 169
    }, function (error, data) {                                                                                 // 170
      if (error) {                                                                                              // 171
        console.log('Had an error while searching!');                                                           // 172
        console.log(error);                                                                                     // 173
        return;                                                                                                 // 174
      }                                                                                                         // 175
                                                                                                                // 176
      if ("raw" !== index.format) {                                                                             // 177
        data = that.extractJSONData(data);                                                                      // 178
      }                                                                                                         // 179
                                                                                                                // 180
      fut['return'](data);                                                                                      // 181
    });                                                                                                         // 182
                                                                                                                // 183
    return fut.wait();                                                                                          // 184
  },                                                                                                            // 185
  /**                                                                                                           // 186
   * The default ES query object used for searching the results.                                                // 187
   *                                                                                                            // 188
   * @param {Object} options                                                                                    // 189
   * @param {String} searchString                                                                               // 190
   * @return array                                                                                              // 191
   */                                                                                                           // 192
  'defaultQuery' : function (options, searchString) {                                                           // 193
    return {                                                                                                    // 194
      "fuzzy_like_this" : {                                                                                     // 195
        "fields" : options.field,                                                                               // 196
        "like_text" : searchString                                                                              // 197
      }                                                                                                         // 198
    };                                                                                                          // 199
  },                                                                                                            // 200
  /**                                                                                                           // 201
   * The default ES sorting method used for sorting the results.                                                // 202
   *                                                                                                            // 203
   * @param {Object} options                                                                                    // 204
   * @return array                                                                                              // 205
   */                                                                                                           // 206
  'defaultSort' : function (options) {                                                                          // 207
    return options.field;                                                                                       // 208
  }                                                                                                             // 209
});                                                                                                             // 210
                                                                                                                // 211
// Expose ElasticSearch API                                                                                     // 212
EasySearch.ElasticSearch = ElasticSearch;                                                                       // 213
                                                                                                                // 214
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['matteodem:easy-search'] = {
  EasySearch: EasySearch
};

})();

//# sourceMappingURL=matteodem_easy-search.js.map
