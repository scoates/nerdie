var http = require('http');

var NerdieInterface = require('nerdie_interface.js');

function Bitcoin(parentNerdie) {
	this.pluginInterface = new NerdieInterface(parentNerdie, this);
}
Bitcoin.prototype.init = function () {
	this.pluginInterface.registerPattern(
		this.pluginInterface.anchoredPattern('bitcoin', false),
		this.getBitcoin
	);
};

Bitcoin.prototype.getBitcoin = function(msg) {
	var options = {
		'host': 'data.mtgox.com',
		port: 80,
		'path': '/api/1/BTCUSD/ticker'
	};
	var data = ""
		, out  = "";

	http.get(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});

		res.on('end', function() {
			try {
				data = JSON.parse(data);
			} catch(e) {
				return msg.say(msg.user + ": mtgox fail");
			}

			msg.say(msg.user + ": last = " + data['return']['last']['display'] + ' ' + data['return']['last']['currency'] + ' ; avg = ' + data['return']['avg']['display'] + ' ' + data['return']['avg']['currency']);

		});
	});
};

module.exports = Bitcoin;
