(function() {
  var fse = require('fs-extra');
  var jsonPath = './bot/data/teams.json'

  class BotConfigurator {
    constructor() {
      this.teams = undefined;

      // getting all the elements we will need to manipulate later on
      // it's handier to do it this way than to call document.getElementById every time
      this.teamsSelect = document.getElementById('teams');
      this.membersDiv = document.getElementById('members');
      this.addMemberButton = document.getElementById('addMember');
      this.messageParagraph = document.getElementById('message');
      this.addTeamButton = document.getElementById('addTeam');
      this.newTeamNameButton = document.getElementById('newTeamName');
      this.timeWrapper = document.getElementById('timeWrapper');
      this.saveButton = document.getElementById('save');

      this.loadTeams(this.teamsSelect, () => {
        this.teamsSelect.addEventListener('change', (event) => {
          this.populateTeam(event);
        });

        this.newTeamNameButton.addEventListener('keyup', (event) => {
          this.addTeamButton.disabled = event.target.value.length <= 0;
        });

        this.saveButton.addEventListener('click', () => {
          this.save(this.teamsSelect.value);
        });

        this.addTeamButton.addEventListener('click', () => {
          this.teams[this.newTeamNameButton.value] = {};
          this.save(this.newTeamNameButton.value);
          this.newTeamNameButton.value = '';
          this.showMessage('New team added!');
          this.loadTeams();
        });

        this.addMemberButton.addEventListener('click', () => {
          this.addMemberInput();
        });
      });
    }

    loadTeams(dropdown, cb) {
      if (!dropdown) {
        dropdown = this.teamsSelect;
      }

      fse.readJson(jsonPath, (err, teamsJson) => {
        this.teams = teamsJson;
        dropdown.innerHTML = '<option>Select a team...</option>';
        Object.keys(this.teams).forEach(function (team) {
          var option = document.createElement('OPTION');
          option.innerHTML = team;
          option.value = team;
          dropdown.appendChild(option);
        });
        if (cb) {
          cb();
        }
      });
    }

    addMemberInput(member = '') {
      var memberContainerDiv = document.createElement('DIV');

      var memberInput = document.createElement('INPUT');
      memberInput.name = 'members[]';
      memberInput.type = 'text';
      memberInput.value = member;
      memberInput.innerHTML = member;
      memberInput.readOnly = member !== '';
      memberInput.dataset.team = this.teamsSelect.value;
      memberInput.className = 'member';

      var removeMemberButton = document.createElement('BUTTON');
      removeMemberButton.type = 'button';
      removeMemberButton.innerHTML = 'X';
      removeMemberButton.addEventListener('click', function() {
        removeMemberButton.parentNode.remove();
      });

      memberContainerDiv.appendChild(memberInput);
      memberContainerDiv.appendChild(removeMemberButton);

      this.membersDiv.appendChild(memberContainerDiv);
    }

    populateTeam(event) {
      this.membersDiv.innerHTML = '';
      document.getElementById('timeWrapper').innerHTML = '';
      Object.keys(this.teams[event.target.value].members).forEach(function (member) {
        this.addMemberInput(member, event.target.value);
      });

      var datePickerLabel = document.createElement('LABEL');
      datePickerLabel.innerHTML = 'Daily scrum time';
      datePickerLabel.for = 'time';

      var timePickerInput = document.createElement('INPUT');
      timePickerInput.type = 'time';
      timePickerInput.name = 'time';
      timePickerInput.id = 'time';

      this.timeWrapper.appendChild(datePickerLabel);
      this.timeWrapper.appendChild(timePickerInput);
    }

    save(team) {
      var membersToSave = {};

      Array.from(this.membersDiv.querySelectorAll('input.member')).forEach((member) => {
        if (member.value.trim() !== '' && member.dataset.team === team) {
          membersToSave[member.value.toLowerCase()] = {};
          var memberTmp = this.teams[team].members[member.value.toLowerCase()];
          if (memberTmp && memberTmp.address) {
            membersToSave[member.value.toLowerCase()].address = this.teams[team].members[member.value.toLowerCase()].address;
          }
        }
      });

      this.teams[team].members = membersToSave;
      var time = document.getElementById('time');
      if (time) {
        this.teams[team].time = BotConfigurator.convertStringToSeconds(time.value);
      }

      fse.outputJsonSync(jsonPath, this.teams);

      this.showMessage('Saved!');
    }

    static convertStringToSeconds(timeString) {
      if (timeString === '') {
        return 0;
      }
      timeString = timeString.split(':');
      return parseInt(timeString[0]) * 60 * 60 + parseInt(timeString[1]) * 60;
    }

    showMessage(message) {
      this.messageParagraph.innerHTML = message;
      setTimeout(() => {
        this.messageParagraph.innerHTML = '';
      }, 3000);
    }
  }

  new BotConfigurator();
})();
