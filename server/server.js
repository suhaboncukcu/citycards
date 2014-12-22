Times = new Mongo.Collection("times");
Times._transform = function(doc) {

	doc.currentTime =  moment().tz(doc.kod).format('hh:mm:ss a');
	doc.currentDate =  moment().tz(doc.kod).format('Do, MMMM YYYY');
  	doc.ulkeClass = doc.ulke.toLowerCase();
    return doc;
}

EasySearch.createSearchIndex('times', {
  'collection': Times, 
  'use' : 'mongo-db',
  'field': ['ad'],
  'limit' : 4, 
  'query' : function (searchString, opts) {
	    // Default query that is used for searching
	    var query = EasySearch.getSearcher(this.use).defaultQuery(this, '^'+searchString);


	    return query;
	}
});

if (Meteor.isServer) {
	Meteor.startup(function () {
		
	});
	

}

 