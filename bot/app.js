var restify = require('restify'),
    builder = require('botbuilder'),
    fse = require('fs-extra');

var jsonPath = './data/teams.json';

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server to listen on port 3978 by default
// The bot emulator (or later the "real" Skype bot, which you
// have to register at https://dev.botframework.com/bots/new
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url);
});

var teamsTmp = {};

// Create chat bot
var connector = new builder.ChatConnector({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
var version = 1.0;
server.post('/api/messages', connector.listen());

function readTeamsFromFile() {
  return fse.readJsonSync(jsonPath);
}

function writeTeamsToFile(teams) {
  fse.outputJsonSync(jsonPath, teams);
}

bot.use(builder.Middleware.firstRun({ version: version, dialogId: '*:/firstRun' }));
bot.dialog('/firstRun', [
  function (session, args) {
    if (session.userData.user && session.userData.team) {
      session.userData['BotBuilder.Data.FirstRunVersion'] = version;
      session.replaceDialog('/dailyScrum');
    } else {
      builder.Prompts.text(session, "Hello... What's your team name?");
    }
  },
  function (session, results) {
    // We'll save the users name and send them an initial greeting. All
    // future messages from the user will be routed to the root dialog.
    var teams = readTeamsFromFile();
    var providedTeamName = results.response.toLowerCase();
    var user = session.message.user.name.toLowerCase();
    if (teams[providedTeamName] && Object.keys(teams[providedTeamName].members).indexOf(user) > -1) {
      teams[providedTeamName].members[user].address = session.message.address;
      writeTeamsToFile(teams);
      session.userData.user = user;
      session.userData.team = providedTeamName;
      session.send("Hi %s, you are now registered for the %s team daily scrum. We will contact you at the time of the meeting, which is at %s", user, providedTeamName, timeToString(teams[providedTeamName].time));
    } else {
      session.send("Wrong team! Try again :D (%s)", user);
      session.replaceDialog('/firstRun');
    }
  }
]);

bot.dialog('/', function(session) {
  if (!session.userData.team || !session.userData.user) {
    session.replaceDialog('/firstRun');
  } else {
    session.send("Hello there, it's not yet scrum time. I'll get back to you later.");
  }
});

bot.dialog('/report', function(session, args) {
  session.send(args.report);
  session.endDialog();
});

function shouldStartScrum(team) {
  var teams = readTeamsFromFile();
  if (teams[team].time < 24 * 60 * 60 && getTimeInSeconds() > teams[team].time) {
    var nextTime = Math.round(new Date().getTime()/1000) - getTimeInSeconds() + 24 * 60 * 60 + teams[team].time;
    teams[team].time = nextTime;
    writeTeamsToFile(teams);
    return true;
  } else if (Math.round(new Date().getTime()/1000) > teams[team].time) {
    var nextTime = 24 * 60 * 60 + teams[team].time;
    teams[team].time = nextTime;
    writeTeamsToFile(teams);
    return true;
  }

  return false;
}

bot.dialog('/dailyScrum', [
  function (session) {
    builder.Prompts.text(session, "What did you do yesterday?");
  },
  function(session, results) {
    if (results.response.length > 0) {
      teamsTmp[session.userData.team].members[session.userData.user] = { q1: results.response };
      builder.Prompts.text(session, "What will you do today?");
    } else {
      session.send("It can't be that you did nothing %s! Let's try this again.", session.userData.user);
      session.replaceDialog('/dailyScrum');
    }
  },
  function(session, results) {
    teamsTmp[session.userData.team].members[session.userData.user].q2 = results.response ;
    builder.Prompts.text(session, "Are there any impediments in your way?");
  },
  function(session, results) {
    teamsTmp[session.userData.team].members[session.userData.user].q3 = results.response;
    teamsTmp[session.userData.team].members[session.userData.user].isDone = true;
    session.send("Got it! Thank you. When all the members finished answering you will receive a summary.");

    if (!teamsTmp[session.userData.team].checker) {
      teamsTmp[session.userData.team].checker = setInterval(function() {
        if (isEverybodyDone(session.userData.team)) {
          teamsTmp[session.userData.team].isDone = true;
          clearInterval(teamsTmp[session.userData.team].checker);
          var teams = fse.readJsonSync(jsonPath);
          Object.keys(teamsTmp[session.userData.team].members).forEach(function(member) {
            bot.beginDialog(teams[session.userData.team].members[member].address, '/report', { report: createReport(session.userData.team) });
          });

          session.endDialog();
        }
      }, 1000);
    }

    session.endDialog();

  }
]);

function timeToString(time) {
  return pad(parseInt(time / 60 / 60 % 24)) + ":" + pad(parseInt(time / 60) % 60)
}

function pad(num) {
  var s = "0" + num;
  return s.substr(s.length - 2);
}

function getTimeInSeconds() {
  var d = new Date();
  return d.getHours() * 60 * 60 + d.getMinutes() * 60;
}

function isEverybodyDone(team) {
  var everybodyDone = true;

  Object.keys(teamsTmp[team].members).forEach(function (x) {
    if (!teamsTmp[team].members[x].isDone) {
      everybodyDone = false;
    }
  });

  return everybodyDone;
}

function createReport(team) {
  // change to members
  var report = "_"+ team + "_<br />";
  report += "___________<br />";

  Object.keys(teamsTmp[team].members).forEach(function(member) {
    report += "**User:** " + member + "<br />";
    report += "**What did " + member + " do yesterday:** " + teamsTmp[team].members[member].q1 + "<br />";
    report += "**What will " + member + " do today:** " + teamsTmp[team].members[member].q2 + "<br />";
    report += "**Impediments for " + member + ":** " + teamsTmp[team].members[member].q3 + "<br />";
    report += "___________<br />";
  });

  return report;
}

setInterval(function() {
  var teams = readTeamsFromFile();
  Object.keys(teams).forEach(function(team) {
    if (shouldStartScrum(team)) {
      teamsTmp[team] = { members: {} };
      Object.keys(teams[team].members).forEach(function(member) {
        if (teams[team].members[member].address) {
          bot.beginDialog(teams[team].members[member].address, '/dailyScrum', {team, member});
        }
      });
    }
  });
}, 3 * 1000);

bot.use({
  botbuilder: function (session, next) {
    if (session.userData.team && session.userData.user) {
      var teams = fse.readJsonSync(jsonPath);
      teams[session.userData.team].members[session.userData.user].address = session.message.address;
      fse.outputJsonSync(jsonPath, teams);
    }
    next();
  }
});
