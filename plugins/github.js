
var GitHubApi = require("github");
var NerdieInterface = require('nerdie_interface.js');

var github_auth;
var bot;
var nerdie;
var enabled = true;
var config;

var gh_username;
var gh_password;


function Github(parentNerdie) {
    this.pluginInterface = new NerdieInterface(parentNerdie, this);
    if (!parentNerdie.config.plugins.github) {
        enabled = false;
        return;
    }
    if (parentNerdie.config.plugins.github) {
        gh_username = parentNerdie.config.plugins.github.auth.username;
        gh_password = parentNerdie.config.plugins.github.auth.password;
    }

    bot = parentNerdie.bot;
    nerdie = parentNerdie;
    config = parentNerdie.config;
}


Github.prototype.init = function () {

    var plugin = this;
    if (!enabled) {
        return;
    }

    // URLs
    // 1) https://github.com/fictivekin/atlantic/issues/23
    this.pluginInterface.registerPattern(
        /https?:\/\/github\.com\/([a-z]+)\/([a-z]+)\/issues\/(\d+)/,
        function (msg) {
            var repo_owner = msg.match_data[1];
            var repo_name = msg.match_data[2];
            var issue_id = msg.match_data[3];

            plugin.getIssue(repo_owner, repo_name, issue_id, msg.say);
        }
    );

    // Create issue
    // 2) !issue [owner]/[repo] [issue title]
    this.pluginInterface.registerPattern(
        this.pluginInterface.anchoredPattern('issue', true),
        function (msg) {
            var message = msg.match_data[2];
            plugin.newIssue(message, msg.say, msg.source.toString());
        }
    );

};

Github.prototype.getIssue = function (repo_owner, repo_name, issue_id, callback) {

    // setup client
    var github = new GitHubApi({
        version: "3.0.0",
        timeout: 5000
    });

    // OAuth2
    github.authenticate({
        type: "basic",
        username: gh_username,
        password: gh_password
    });

    // set options for the issue
    var options = {
        user: repo_owner,
        repo: repo_name,
        number: issue_id
    }

    // get the issue
    github.issues.getRepoIssue(options, function(err, res) {

        if (!res) {
            callback('Something went wrong.')
        };

        formatIssue(res, repo_name, function(issue_text) {
            callback(issue_text);
        });
    });
};

Github.prototype.newIssue = function (message, callback, source) {

    parseMessage(message, source, function (message_obj) {

        if (!message_obj) {
            callback('Incorrect format.');
            return;
        };

        // setup client
        var github = new GitHubApi({
            version: "3.0.0",
            timeout: 5000
        });

        // OAuth2
        github.authenticate({
            type: "basic",
            username: gh_username,
            password: gh_password
        });

        // set required options for the issue
        var options = {
            user: message_obj.repo_owner,
            repo: message_obj.repo_name,
            title: message_obj.issue_title,
            body: message_obj.issue_body,
            labels: []
        };

        // get the issue
        github.issues.create(options, function(err, res) {
            if (!res) {
                callback('Something went wrong.')
                return;
            };

            // display the url in chat
            callback(res.html_url);
        });
    });
}

var formatIssue = function(issue_data, repo_name, callback) {
    var title = issue_data.title,
        requester = issue_data.user.login,
        assignee, milestone;

    if (issue_data.assignee) {
          assignee = issue_data.assignee.login;
    } else {
      assignee = 'nobody';
    };

    if (issue_data.milestone) {
        milestone = issue_data.milestone.title;
    };

    var message = "[" + repo_name + "] " + title + " – owner: " + assignee + ", opened by: " + requester + ", milestone: " + milestone + ".";
    callback(message);
};

var parseMessage = function(message, source, callback) {
    if (!message.match(/([a-z]+)\/([a-z]+)[ ](.*)/)) {
        callback(false);
        return;
    };

    var pieces = message.match(/([a-z]+)\/([a-z]+)[ ](.*)/)
    var message_obj = {
        repo_owner: pieces[1],
        repo_name: pieces[2],
        issue_title: pieces[3],
        issue_body: "requested by: " + message.user + " on " + source
    };
    callback(message_obj);
};

module.exports = Github;
