(function(){if (Meteor.isServer) {
	Meteor.publish("times", function () {
	    return Times.find({}, {sort: {ad: 1}});
	});
}

})();
