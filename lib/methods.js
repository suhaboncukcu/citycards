Meteor.methods({
	'chooseTime': function(id) {
		return Times.findOne({'_id': id});
	}
});