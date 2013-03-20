var https = require('https')
  , querystring = require('querystring')
  , xml2js = require('xml2js');

var NerdieInterface = require('nerdie_interface.js');

var tracker_token;
var bot;
var nerdie;
var enabled = true;
var config;

function Pivotal(parentNerdie) {
	this.pluginInterface = new NerdieInterface(parentNerdie, this);
	if (!parentNerdie.config.plugins.pivotal) {
		enabled = false;
		return;
	}
	if (parentNerdie.config.plugins.pivotal.auth) {
		tracker_token = parentNerdie.config.plugins.pivotal.auth.token;
	}
	bot = parentNerdie.bot;
	nerdie = parentNerdie;
	config = parentNerdie.config;
}

Pivotal.prototype.init = function () {
	var plugin = this;
	if (!enabled) {
		return;
	}
	this.pluginInterface.registerPattern(
		this.pluginInterface.anchoredPattern('pivotal', true),
		function (msg) {
			var story_id = msg.match_data[2];
			if (story_id.match(/^[0-9]+$/)) {
				plugin.getStory(story_id, true, msg.say);
			}
		}
	);

	// URLs
	// 1) https://www.pivotaltracker.com/story/show/13911383
	this.pluginInterface.registerPattern(
		/https?:\/\/www\.pivotaltracker\.com\/story\/show\/(\d+)/,
		function (msg) {
			var num = msg.match_data[1];
			plugin.getStory(num, false, msg.say);
		}
	);

	if (config.plugins.pivotal.channel_map) {
		console.log("Registering bug + chore patterns");
		this.pluginInterface.registerPattern(
			this.pluginInterface.anchoredPattern('(bug|chore)', true),
			plugin.newStory
		);
	}
}

Pivotal.prototype.getStory = function (story_id, include_url, callback) {
	var plugin = this;
	var options = {
		'host': 'www.pivotaltracker.com',
		path: '/services/v4/stories/' + story_id,
		headers: {'x-trackertoken': tracker_token}
	};
	var data = "";
	var req = https.request(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});
		res.on('end', function() {
			var story;
			if (res.statusCode === 200) {
				var parser = new xml2js.Parser();
				parser.addListener('end', function(story) {
					formatStory(story, include_url, callback);
				});
				try {
					parser.parseString(data);
				} catch(e) {
					callback("Unparseable story XML");
					console.log(e);
				}
			} else {
				callback('Got status ' + res.statusCode + ' from pivotal API');
			}
		});
	});
	req.on('error', function(e) {
		callback('HTTP error retrieving story ' + story_id);
	});
	req.end();
};

var getProject = function (project_id, callback) {
	var plugin = this;
	var options = {
		'host': 'www.pivotaltracker.com',
		path: '/services/v4/projects/' + project_id,
		headers: {'x-trackertoken': tracker_token}
	};
	var data = "";
	var req = https.request(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});
		res.on('end', function() {
			var project;
			if (res.statusCode === 200) {
				var parser = new xml2js.Parser();
				parser.addListener('end', function(project) {
					callback(project);
				});
				try {
					parser.parseString(data);
				} catch(e) {
					callback(false);
					console.log(e);
				}
			} else {
				callback('Got status ' + res.statusCode + ' from pivotal API');
			}
		});
	});
	req.on('error', function(e) {
		callback('HTTP error retrieving project ' + project_id);
	});
	req.end();
};

var formatStory = function (story, include_url, callback) {
	var name = story.name
	var story_type = story.story_type;
	var state = story.current_state;
	var estimate = story.estimate ? story.estimate['#'] : false;
	var description = story.description;
	var owner = story.owned_by;
	var trailer = [story_type, state];
	
	if (estimate && estimate !== '-1') {
		trailer.push(estimate + ' points');
	}
	if (owner && owner.person) {
		trailer.push('owned by ' + owner.person.name);
	}

	getProject(story.project_id['#'], function (project) {
		if (!project) {
			project = {name: '(unknown)'};
		}
		var out = '[' + project.name + '] ' + name + ' -- ' + trailer.join(', ');
		callback(out);
		if (typeof description === 'string' && description !== '') {
			callback(description);
		}
		if (include_url) {
			callback(story.url);
		}
	});
};

var isChannel = function (source) {
	// check source (# or & means it's a channel)
	var first = source.substr(0, 1);
	if ('#' === first || '&' === first) {
		return true;
	}
	return false;
};

var xmlEscape = function (str) {
	return str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
}

Pivotal.prototype.newStory = function (msg) {
	var storyType = msg.match_data[2];
	var subject = msg.match_data[3];
	var channel = msg.source.toString();
	if (config.plugins.pivotal.user_map[msg.user]) {
		var user = config.plugins.pivotal.user_map[msg.user];
	} else {
		msg.say('User not in pivotal user map.');
		return;
	}
	if (!isChannel(channel) || !config.plugins.pivotal.channel_map[channel]) {
		msg.say('No project known for this channel.');
		return;
	}
	projectId = config.plugins.pivotal.channel_map[channel];
	reqBody = '<story><story_type>' + storyType + '</story_type><name>' + xmlEscape(subject) + '</name><requested_by>' + user + '</requested_by></story>';

	var options = {
		'host': 'www.pivotaltracker.com',
		path: '/services/v3/projects/' + projectId + '/stories',
		headers: {
			'x-trackertoken': tracker_token,
			'Content-type': 'application/xml',
			'Content-length': reqBody.length,
		},
		method: 'POST',
	};
	var data = "";
	var req = https.request(options, function(res) {
		res.on('data', function(chunk) {
			data += chunk;
		});
		res.on('end', function() {
			var story;
			if (res.statusCode >= 200 && res.statusCode < 300) {
				var parser = new xml2js.Parser();
				parser.addListener('end', function(story) {
					formatStory(story, true, msg.say);
				});
				try {
					parser.parseString(data);
				} catch(e) {
					msg.say("Unparseable story XML");
					console.log(e);
				}
			} else {
				msg.say('Got status ' + res.statusCode + ' from pivotal API');
				console.log(data);
			}
		});
	});
	req.on('error', function(e) {
		msg.say('HTTP error retrieving story ' + story_id);
	});
	req.write(reqBody);
	req.end();

};

module.exports = Pivotal;
