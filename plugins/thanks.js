var request = require('request');

var NerdieInterface = require('nerdie_interface.js');

function Thanks(parentNerdie) {
	this.pluginInterface = new NerdieInterface(parentNerdie, this);
}
Thanks.prototype.init = function () {
	this.pluginInterface.registerPattern(
		/thanks gimmebot/i,
		this.getThanksGimmebot
	);
};

Conan.prototype.getThanksGimmebot = function(msg) {
	var num = 0
	, responses = [
		"You're welcome.",
		"No, thank you.",
		"Thank Fergie instead, she deserves it."
		];

	num = Math.floor(Math.random()*responses.length);
	smsg.say(msg.user + ": " + responses[num]);	
};

module.exports = Thanks;