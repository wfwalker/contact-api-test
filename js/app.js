// TODO: handle deletes

// a dictionary of contacts, indexed by their ID's
var gContacts = {};
var gLastUpdate = 0;

// log a message by writing on screen and to console
function logMessage(inMessage) {
  console.log(inMessage);
  document.getElementById('message').innerHTML += ('<div>' + inMessage + '</div>');
}

function resetLog() {
  document.getElementById('message').innerHTML = new Date().toTimeString();
}

// updates the local contacts database with the given contact
// if the given contact has an unknown ID, add it
// if the given contact has a known ID, then
//      if the given contact is newer than the one already in the local DB, update
function compareOneContact(inContact) {
  if (gContacts[inContact.id]) {
    var existingRecord = gContacts[inContact.id];

    if (existingRecord.updated >= inContact.updated) {
      logMessage('exisiting same age as modified one');
    } else {
      gContacts[inContact.id] = inContact;
      logMessage('exisiting older than modified, updating');
      displayAllContacts();
    }
  } else {
    logMessage('adding new contact to DB ' + inContact.id);
    gContacts[inContact.id] = inContact;
    displayAllContacts();    
  }
}

function removeOneContactByID(inRemovedContactID) {
  if (gContacts[inRemovedContactID]) {
    logMessage('found removed contact, removing', inRemovedContactID);
    delete gContacts[inRemovedContactID];
  } else {
    logMessage('DID NOT find removed contact, doing nothing', inRemovedContactID);
  }
}

// find all contacts in the mozContacts DB and try updating the local DB
// with each one in turn, see compareOneContact()
function compareAllContacts() {
  resetLog();
  logMessage('compareAllContacts: ' + Object.keys(gContacts).length);

  var knownIDs = Object.keys(gContacts);

  var allContacts = navigator.mozContacts.getAll({sortBy: "familyName", sortOrder: "descending"});

  // TODO: maintain list of all known contact id's
  // TODO: make copy of that list, mark off the ones found during this iteration
  // TODO: delete the contacts whose id's are in our DB but not listed in these search results
  allContacts.onsuccess = function(event) {
    var cursor = event.target;
    
    if (cursor.result) {

      var tmpIndex = knownIDs.indexOf(cursor.result.id);
      if (tmpIndex >= 0) {
        knownIDs[tmpIndex] = null;
      }

      if (gContacts[cursor.result.id] && (cursor.result.updated < gLastUpdate)) {
        // that contact is already in my local copy
        // and hasn't been updated since our last check
        // so do nothing
      } else {
        // that contact either isn't in my list
        // or has been recently updated, so need to compare
        compareOneContact(cursor.result);
      }

      cursor.continue();
    } else {
      var shouldBeDeleted = knownIDs.filter(function(v) { return v != null; })

      shouldBeDeleted.forEach(function(deletedID) {
        removeOneContactByID(deletedID);
      })
    }
  };

  allContacts.onerror = function(e) {
    logMessage("error " + e);
  };

  gLastUpdate = Date.now();
}

// for a given ID, find that contact in the mozContacts DB; if found, try updating the local DB
function getAndUpdateContactByID(inID) {
  console.log('getAndUpdateContactByID', inID);

  var options = {
    filterValue: inID,
    filterBy: ['id'],
    filterOp: 'equals'
  }

  var search = navigator.mozContacts.find(options);

  search.onsuccess = function() {
    if (search.result.length === 1) {
      compareOneContact(search.result[0]);
    } else {
      logMessage(search.result.length + " contact(s) for ID, cannot update");
    }
  };

  search.onerror = function() {
    logMessage('could not search contacts for ID');
  };    
}

// find all existing alarms for this app and removes them.
// useful because alarms accumulate during development
function killOldAlarms() {
  var oldAlarmsRequest = navigator.mozAlarms.getAll();

  oldAlarmsRequest.onsuccess = function() {
    this.result.forEach(function(alarm) {
      console.log('found alarm', alarm.id);
      navigator.mozAlarms.remove(alarm.id);
    });
  }

  oldAlarmsRequest.onerror = function() {
    console.log('could not retrieve old alarms');
  }
}

// schedule an alarm for some number of mSec in the future
function scheduleAlarm(inDelta) {
  console.log('scheduleAlarm');
  var myDate  = new Date(Date.now() + inDelta);

  // This is arbitrary data pass to the alarm
  var data = {
    foo: "bar"
  }

  // TODO: probably these don't get unregistered! sorcerer's apprentice!
  var request = navigator.mozAlarms.add(myDate, "honorTimezone", data);

  request.onsuccess = function () {
    // console.log("The alarm has been scheduled");
  };

  request.onerror = function () { 
    logMessage("An error occurred: " + this.error.name);
  };
}

function displayAllContacts() {
  console.log('displayAllContacts');

  document.getElementById('summary').innerHTML = '';

  Object.keys(gContacts).forEach(function(aContactID) {
    document.getElementById('summary').innerHTML += ('<div>' + gContacts[aContactID].givenName[0] + ' ' + gContacts[aContactID].familyName[0] + '</div>');
  });
}

// DOMContentLoaded is fired once the document has been loaded and parsed,
// but without waiting for other external resources to load (css/images/etc)
// That makes the app more responsive and perceived as faster.
// https://developer.mozilla.org/Web/Reference/Events/DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {

  // We'll ask the browser to use strict code to help us catch errors earlier.
  // https://developer.mozilla.org/Web/JavaScript/Reference/Functions_and_function_scope/Strict_mode
  'use strict';

  document.getElementById('addContact').addEventListener('click', function (e) {
    console.log('add contact and sync to firefox');

    // second way: using a value object
    var contactData = {
      givenName: ["John"],
      familyName: ["Doe"],
      nickname: ["No kidding"]
    };

    var person = new mozContact(contactData);
    var saving = navigator.mozContacts.save(person);

    saving.onsuccess = function() {
      console.log('new contact saved', person);
      // This update the person as it is stored
      // It includes its internal unique ID
      // Note that saving.result is null here
    };

    saving.onerror = function(err) {
      console.error(err);
    };
  })

  // on launch, update all contacts
  compareAllContacts();

  // and show a summary
  displayAllContacts();    

  // listen for contact changes
  navigator.mozContacts.addEventListener('contactchange', function(updateEvent) { 
    if (updateEvent.reason == 'remove') {
      logMessage('contact removed from Firefox OS');
      removeOneContactByID(updateEvent.contactID);
    } else if (updateEvent.reason == 'create') {
      logMessage('contact created in Firefox OS');
      getAndUpdateContactByID(updateEvent.contactID);
    } else if (updateEvent.reason == 'update') {
      logMessage('contact updated in Firefox OS');
      getAndUpdateContactByID(updateEvent.contactID);
    } else {
      logMessage('unknown update reason ' + updateEvent.reason);
    }
  });

  // respond to alarms by updating all contacts and then scheduling another alarm
  navigator.mozSetMessageHandler("alarm", function (mozAlarm) { 
    killOldAlarms();

    compareAllContacts();

    displayAllContacts();

    // note: artificially short time for demo
    scheduleAlarm(10000);
  });

  // schedule the first alarm
  // note: artificially short time for demo
  scheduleAlarm(10000);
});
