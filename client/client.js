Times = new Mongo.Collection("times");


EasySearch.createSearchIndex('times', {
  'collection': Times, 
  'use' : 'mongo-db',
  'field': ['ad'],
  'limit': 4,
});


if(Meteor.isClient) {
	Meteor.setInterval(function() {
	    Session.set('clock', moment().format('hh:mm:ss a  (MM.DD.YYYY)'));
	}, 1000);



	Template.body.helpers({
		clock: function () {
			return Session.get('clock');
		}

	});

	Template.time.events({
		'click .timeAdder' : function() {
			Meteor.call('chooseTime', this._id, function(error, result) {
				console.log(result);
			});
			
		}
	});


	


}