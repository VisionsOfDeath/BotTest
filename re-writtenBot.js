/// <reference path="typings/tsd.d.ts" />
var jsonfile = require('jsonfile');
var file = "players.json";
var jsonObj = jsonfile.readFileSync(file);

console.log(jsonObj.users[0].discordid);

var steam = require("steam"),
    util = require("util"),
    fs = require("fs"),
    crypto = require("crypto"),
    dota2 = require("./"),
    steamClient = new steam.SteamClient(),
    steamUser = new steam.SteamUser(steamClient),
    steamFriends = new steam.SteamFriends(steamClient),
    Dota2 = new dota2.Dota2Client(steamClient, true);

var Discord = require("discord.js");
global.config = require("./config");
var discordbot = new Discord.Client();
discordbot.login(global.config.discord_email, global.config.discord_pass);

//Original user Input 
var input = ""; 

//The command that the user enters
var command = ""; 

//An argument that goes with the command
var argument = "";

//Boolean for if a player is registered or not
var isRegistered = false;

//Whether a group is currently running
var isGroupRunning = false;

//Array of the current players in the group
var Group = [];

//The current hoster of the lobby
var currentHoster = "";

//Max number of people in a given lobby
var LobbySize = 10;

//Whether the game is in drafting stage or not
var isDrafting = false;


var version = "v1.3";

discordbot.on("message", function(message) {
    if(message.content.charAt(0) == "!"){
        input = message.content.substring(1,message.content.length).split(" ");
        command = input[0];
        argument = input[1];
        
        //Uncomment these to test what has been entered 
        //WriteToChannel(input);
        //WriteToChannel(command + "  = command");
        //WriteToChannel(argumnt + " = argument");

        //Lowers the command to lowercase so that !TEST is converted to !test
        command = command.toString().toLowerCase();
        //WriteToChannel(command + "  = lowered command");
        
        switch(command){
            case "register":
                if(isNaN(argument)){
                    writeToChannel("Error your steam ID cannot be undefined. You can get your steamid at http://steamid.io/lookup");
                    break;
                } else {
                    register(argument, message);
                    break; 
                }
                    
            case "creategame":
                createGame(message);
                break;
            
            case "join":
                join(message);
                break;
            
            case "leave":
                leave(message);
                break;
                
            case "listplayers":
                listPlayers();
                break;
            
            case "pingplayers":
                pingPlayers(message);
                break;
            
            case "help":
                showHelp(message, version);
                break;
            
            case "disband":
                disband(message);
                break;
                
            case "start":
                start(message);
                break;
                
            default:
                unknownInput(message);
                break;
            }
        }
});

//Writes messages to channel
function writeToChannel(msg){
    discordbot.sendMessage(discordbot.channels.get("name", "inhouseorganising"), msg);
}

//Default message when someone sends an unknown comamnd
function unknownInput(){
    writeToChannel("Unknown command, private message me with !help for a full list.");
}


//Checks if the user is already registered up
function checkSignup(id){
    var isSignedUp = false;
    for(var i=0, len = jsonObj.users.length; i<len;i++) {
        if(jsonObj.users[i].discordid == id) {
            isSignedUp = true;
        }
    }
    return isSignedUp;
}

//Resets the global variables
function resetGlobals(){
    isGroupRunning = false;
    currentHoster = "";
    Group = [];
}

//Checks to see if the user is already in the group
function checkGroup(id){
    var isGrouped = false;
    for(var i=0, len = Group.length; i<len;i++){
        if(Group[i] == id) {
            isGrouped = true;
        }
    }
    return isGrouped;
}

//Creates an array of users called 'Group', contains only the leader for now
function createGroup(user, id){
    isGroupRunning = true;
    Group = [];
    writeToChannel(user + " has created a new inhouse game! Do !join to get a slot");
    currentHoster = id;
    Group.push(id);
}

//Function for registering new users
function register(input, message){
    if(input.length == 17 && message.length == 2){
        isRegistered = false;
        
        //Checks if the user is already registered, returns if they are 
        for(var i=0, len = jsonObj.users.length; i<len;i++) {
            if(message.author.id == jsonObj.users[i].discordid){
                isRegistered = true;
                discordbot.reply(message, "you are already registered.");
                return;
            }
        }
        
        //Registers them if not
        if(isRegistered == false){
            discordbot.reply(message, "Welcome! You have now been registered.");
            var discordid = message.author.id;
            var steamid = input;
            var newuser = {discordid, steamid};
            jsonObj.users.push(newuser);
            jsonfile.writeFileSync(file, jsonObj);
            return;
        }   
    } else {
        //Standard reply if they enter the wrong argument
        discordbot.reply(message, "Incorrect use, command should be !register 'steamid64'. You can get your steamid at http://steamid.io/lookup");
        return;
    }
}

//Function for creating a virtual lobby that people join
function createGame(message){
    if(checkSignup(message.author.id) == true){
        if(!isGroupRunning){
           createGroup(message.author.username, message.author.id);
        } else {
            writeToChannel("You can't make a game, there is already one running, try !join.");
        }
    } else {
        discordbot.reply(message, "you are not registered.");
    }
}

//Function for joining the group
function join(message){
    if(checkGroup(message.author.id)){
       writeToChannel(message.author.username + " you're already in the group mate.");
       return;
    }
    //Checks if a group is already running
    if(!isGroupRunning){
        writeToChannel(message.author.username + " there is no queue game currently running. Use !creategame to create one, or use !help to get a full list of commands.");
        return;
    } else {
        // if not, checks if they are signed up
        if(checkSignup(message.author.id) == true){
            //Checks to see if Group[] is less than the number of people in the lobby currently
            if(Group.length < LobbySize){
                //Adds them to group
                Group.push(message.author.id);
                writeToChannel(message.author.username + " joins the group! " + Group.length + "/" + LobbySize + " slots taken.");
                //Once the lobby is full, drafting begins
                if(Group.length == LobbySize){
                    draftPhase();
                }
            } else {
                writeToChannel(message.author.username + " the group is currently full. Please try again later.");
            }
        } else {
            discordbot.reply(message, "you are not registered. Use !register 'steamid64'.");
        }
        return;
    }
}

//Function which allows people to leave the group
function leave(message){
    //Checks to see if a group is running
    if(!isGroupRunning){
         writeToChannel("No group is running at the moment, use !creategame to make one.");
         return;
    }
    //Checks to see if the person wanting to leave is the host
    if(message.author.id == currentHoster){
        writeToChannel("Lobby leader has left, lobby disbanding.");
        isGroupRunning = false;
        Group = [];
        return;
    } else {
        //Checks if the drafting phase is running, stops them if it is
        if(isDrafting == true){
            writeToChannel(message.author.username + " you cannot leave, the draft has begun.");
            return;
        }
        //If drafting hasn't begun, removes them from the group
        var index = Group.indexOf(message.author.id);
        if (index > -1) {
            discordbot.reply(message, "has left the lobby");
            Group.splice(index, 1);
            writeToChannel("Lobby is now: " + Group.length + "/" + LobbySize);
        }
        return;
    }
}

//Function to loop through the current group and print everyone out, leader gets an extra icon
function listPlayers(){
    if(!isGroupRunning){
         writeToChannel("No group is running at the moment, use !creategame to make one.");
         return;
    }
    var playerString = "";
    for(var i=0, len=Group.length; i<len;i++){
        if(Group[i] == currentHoster){
            playerString = playerString + (discordbot.users.get("id", Group[i]).username + " :trident: ") + "\n";
        } else {
            playerString = playerString + (discordbot.users.get("id", Group[i]).username) + "\n";
        }
    }
    writeToChannel(playerString);
    playerString = "";
    return;
}

//Pings all current players in the group with an @ message
function pingPlayers(message){
    //Will stop the user if they aren't the host
    if(isGroupRunning && message.author.id != currentHoster){
        writeToChannel("Only the party leader can ping the current players.");
        return;
    }
    if(!isGroupRunning){
         writeToChannel("No group is running at the moment, use !creategame to make one.");
         return;
    }
    var playerString = "";
    for(var i=0, len=Group.length; i<len;i++){
        if(Group[i] == currentHoster){
            playerString = playerString + (discordbot.users.get("id", Group[i]) + " :trident: ") + "\n";
        } else {
            playerString = playerString + (discordbot.users.get("id", Group[i])) + "\n";
        }
    }
    writeToChannel(playerString);
    playerString = "";
    return;
}

//PM's a list of all commands to the user
function showHelp(message, version){
    discordbot.sendMessage(message.author, 
        " !register - Register your steamid\n" +
        " !creategame  - Start a Inhouse Game \n" +
        " !join     - Summon a magical unicorn from rainbow land not to join inhouses or anything like that\n" +
        " !leave   - Leaves a lobby \n" +
        " !invite   - Request a new lobby invite from the bot \n" +
        " !listplayers   - Lists all the players who are currently in a game. :trident: means they created the lobby \n" +
        " !captain   - Slots you as the captain of Team B \n" +
        " !pick   - Picks a user for you team, only available to captains. Usage: !pick @USERNAME \n" +
        "----------------------------------------------------------------------------\n" +
        "--------------------Group leader specific commands-------------------\n" +
        "----------------------------------------------------------------------------\n" +
        " !pingplayers    - Pings all current players in the pending lobby\n" +
        " !start    - Starts the game\n" +
        " !disband  - Pull a virtus.pro" + 
        " \n\nCurrent version is: " + version);
    return;
}

//Disbands the lobby if it is the leader
function disband(message){
    if(message.author.id == currentHoster){
        writeToChannel(message.author.username + " has disbanded the inhouse party.");
        resetGlobals();
        return;
    } else {
        writeToChannel(message.author.username + " you are not the leader, you cannot disband.");
        return;
    }
}

//Need to continue this 
function draftPhase(){
    isDrafting = true;
    writeToChannel("Group is now full, team drafting will begin soon.");
    return;
}

//Starts the game if you are the lobby leader &
function start(message){
    if(message.author.id == currentHoster && isDrafting == false){
        Dota2.launchPracticeLobby();
        Dota2.leavePracticeLobby();
        resetGlobals();
        writeToChannel("GLHF, bot is now ready for new group!");
    } else {
        
    }
}
//function whatever the fuck comes next


var onSteamLogOn = function onSteamLogOn(logonResp) {
    if (logonResp.eresult == steam.EResult.OK) {
        steamFriends.setPersonaState(steam.EPersonaState.Busy); // to display your steamClient's status as "Online"
        steamFriends.setPersonaName("EMSBot"); // to change its nickname
        util.log("Logged on.");
        Dota2.launch();
        Dota2.on("ready", function() {
            console.log("Node-dota2 ready.");
            steamFriends.on('message', function(source, message, type, chatter) {
                console.log('Received message: ' + message);
                var command = message.split(" ");
                    switch (command[0]) {
                        case "invite":
                            Dota2.inviteToLobby(command[1]);
                            break;
                        case "leave":
                            Dota2.leavePracticeLobby();
                            break;
                    }
            });
                        
            Dota2.on("chatMessage", function(channel, personaName, message) {
                Dota2.sendMessage(channel, "");});
            });
            Dota2.on("unready", function onUnready() {
                console.log("Node-dota2 unready.");
            });
        }
    },
    onSteamServers = function onSteamServers(servers) {
        util.log("Received servers.");
        fs.writeFile('servers', JSON.stringify(servers));
    },
    onSteamLogOff = function onSteamLogOff(eresult) {
        util.log("Logged off from Steam.");
    },
    onSteamError = function onSteamError(error) {
        util.log("Connection closed by server.");
    };

steamUser.on('updateMachineAuth', function(sentry, callback) {
    var hashedSentry = crypto.createHash('sha1').update(sentry.bytes).digest();
    fs.writeFileSync('sentry', hashedSentry);
    util.log("sentryfile saved");
    callback({
        sha_file: hashedSentry
    });
});

// Login, only passing authCode if it exists
var logOnDetails = {
    "account_name": global.config.steam_user,
    "password": global.config.steam_pass,
};
if (global.config.steam_guard_code) logOnDetails.auth_code = global.config.steam_guard_code;

try {
    var sentry = fs.readFileSync('sentry');
    if (sentry.length) logOnDetails.sha_sentryfile = sentry;
} catch (beef) {
    util.log("Cannae load the sentry. " + beef);
}

steamClient.connect();
steamClient.on('connected', function() {
    steamUser.logOn(logOnDetails);
});
steamClient.on('logOnResponse', onSteamLogOn);
steamClient.on('loggedOff', onSteamLogOff);
steamClient.on('error', onSteamError);
steamClient.on('servers', onSteamServers);