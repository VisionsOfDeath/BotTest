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

var version = "1.2.2";

var LobbySize = 10;
var Group = [];
var isGroupRunning = false;
var isDrafting = false;
var currentHoster = "";
var currentCaptain = "";
var TeamA = [];
var TeamB = [];
var FreePlayers = [];
var Pick = "";
var date = new Date();
var lastRavage = 0;
var ravagecooldown = 150;
var DiscordServerName = global.config.discord_servername;
//var DiscordServerName = "EU Master Stack";


discordbot.on("message", function(message) {
    if(message.content.charAt(0) == "!"){
    var commands = message.content.substring(1,message.content.length).split(" ");
        switch(commands[0]){
            case "register":
                console.log("Command used: Register");
                if(commands.length >= 2){
                if(commands[1].length != 17 || isNaN(commands[1])){
                    discordbot.reply(message, "Incorrect use, command should be !register 'steamid64'. You can get your steamid at http://steamid.io/lookup");
                } else {
                    var alreadyRegisted = false;
                    for(var i=0, len = jsonObj.users.length; i<len;i++) {
                        if(message.author.id == jsonObj.users[i].discordid){
                            alreadyRegisted = true;
                            discordbot.reply(message, "you are already registered.");
                        }
                    }
                if(!alreadyRegisted){
                    discordbot.reply(message, "Welcome!");
                    var discordid = message.author.id;
                    var steamid = commands[1];
                    var newuser = {discordid, steamid};
                    jsonObj.users.push(newuser);
                    jsonfile.writeFileSync(file, jsonObj);
                }   
            }
            } else { 
                discordbot.reply(message, "Incorrect use, command should be !register 'steamid64'. You can get your steamid at http://steamid.io/lookup");
            }
            break;

            case "creategame":
                console.log("Command used: creategame.");
                if(checkSignup(message.author.id) == true){
                    if(!isGroupRunning){
                        CreateGroup(message.author.username, message.author.id);
                    } else {
                        WriteToChannel("You can't make a game, there is already one running, try !join.");
                    }
                } else {
                    discordbot.reply(message, "you are not registered.")}
            break;
                
            case "disband":
                if(message.author.id == currentHoster){
                    WriteToChannel(message.author.username + " has disbanded the inhouse party.");
                    ResetGlobals();
                }
            break;
                
                case "join":
                    console.log("Command used: join.");
                    if(isGroupRunning == false){
                        WriteToChannel(message.author.username + " there is no queue game currently running. Use !creategame to create one, or use !help to get a full list of commands.");
                        break;
                    }
                    if(checkSignup(message.author.id) == true){
                        if(!checkGroup(message.author.id))
                        {
                            if(Group.length < LobbySize && isGroupRunning == true)
                            {
                                Group.push(message.author.id);
                                
                                if(Group.length == LobbySize)
                                {
                                    isDrafting = true;
                                    WriteToChannel("Group is now full! Someone use !captain to draft for Team B");
                                    //CreateDotaLobby(randomnumber);
                                } else {
                                    WriteToChannel(message.author.username + " joins the group! " + Group.length + "/" + LobbySize + " slots taken.");
                                }
                            }
                        }else(
                            discordbot.reply(message, "you have already joined this game."));
                          
                    } else {
                        discordbot.reply(message, "you are not registered. Use !register 'steamid64'.")}
                    break;
                    
                case "start":
                    console.log("Command used: start");
                    if(checkSignup(message.author.id) == true && message.author.id == currentHoster && isDrafting == false){
                        Dota2.launchPracticeLobby();
                        Dota2.leavePracticeLobby();
                        ResetGlobals();
                        WriteToChannel("GLHF, bot is now ready for new group!");
                    }
                    break;
                    
                    //Makes the bot send an invite to you 
                case "invite":
                    console.log("Command used: invite.");
                    for(var x=0, len=jsonObj.users.length; x<len;x++){
                        if(message.author.id == jsonObj.users[x].discordid)
                        {
                            Dota2.inviteToLobby(jsonObj.users[x].steamid);
                        }
                    }
                    break;
                    
                    //Takes your ID out of Group[], if not throws error
                case "leave":
                    console.log("Command used: leave.");
                    if(isGroupRunning == true){
                        console.log(Group.toString());
                        if(message.author.id != currentHoster)
                        {
                            if(isDrafting == true){
                                WriteToChannel(message.author.username + " has tried to disband the party mid draft.");
                                break;
                            }
                            var index = Group.indexOf(message.author.id);
                            if (index > -1) {
                                discordbot.reply(message, "has left the lobby");
                                Group.splice(index, 1);
                                WriteToChannel("Lobby is now: " + Group.length + "/" + LobbySize);
                            }
                        } else {
                            WriteToChannel("Lobby leader has left, lobby disbanding.");
                            isGroupRunning = false;
                            Group = [];
                        }
                    } else {
                        discordbot.reply(message, "you can't leave a lobby that you aren't in!");
                    }
    
                    break;
                    
                    //Lists all players that are currently in the group
                case "listplayers":
                    console.log("Command used: listplayers");
                    if(isGroupRunning)
                    {
                        var playerString = "";
                        
                        for(var i=0, len=Group.length; i<len;i++)
                        {
                            if(Group[i] == currentHoster)
                            {
                               playerString = playerString + (discordbot.users.get("id", Group[i]).username + " :trident: ") + "\n";
                            } else {
                               playerString = playerString + (discordbot.users.get("id", Group[i]).username) + "\n";
                            }
                        }
                        
                        WriteToChannel(playerString);
                        playerString = "";
                    } else
                    {
                        WriteToChannel("There is no group running at the moment");
                    }
                    break;
               
                case "pingplayers":
                    console.log("Command used: pingplayers");
                    if(isGroupRunning && message.author.id != currentHoster){
                        WriteToChannel("Only the party leader can ping the current players.");
                        break;
                    }
                    if(isGroupRunning && message.author.id == currentHoster)
                    {
                        var playerString = "";
                        
                        for(var i=0, len=Group.length; i<len;i++)
                        {
                            if(Group[i] == currentHoster)
                            {
                               playerString = playerString + (discordbot.users.get("id", Group[i])) + " :trident: " + "\n";
                            } else {
                                playerString = playerString + (discordbot.users.get("id", Group[i])) + "\n";
                            }
                            
                        WriteToChannel(playerString);
                        playerString = "";
                        }
                    } else {
                        WriteToChannel("There is no group running at the moment");
                    }
                    break;
               
                    
                case "help":    
                    console.log("Command used: help.");
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
                    " !pingplayers    - Pings all current players in the game\n" +
                    " !start    - Summon Cthulhu\n" +
                    " !disband  - Pull a virtus.pro" + 
                    " \n\ncurrent version is: " + version
                    );
                    break;
                
                //Admin only commands
                case "forceleave":
                    console.log("Command used: forceleave.");
                    if(message.server == undefined && checkRole(message.author.id) == true)
                    {
                        discordbot.reply(message, "Admin forced the bot to leave the lobby.");
                        Dota2.leavePracticeLobby();
                    }
                    break;
                    
                case "forcedisband":
                    console.log("Command used: forcedisband.");
                    if(message.server == undefined && checkRole(message.author.id) == true)
                    {
                        console.log("Command used: forcedisband used successfully.");
                        WriteToChannel("Force disbanded the inhouse party by an Admin.");
                        ResetGlobals();
                    }
                    break;
                    
                case "forcestart":
                    console.log("Command used: forcestart.");
                    if(message.server == undefined && checkRole(message.author.id) == true)
                    {
                        discordbot.reply(message, "Admin force started the game.");
                        Dota2.launchPracticeLobby();
                        Dota2.leavePracticeLobby();
                        ResetGlobals();
                        WriteToChannel("GL HF, bot is now ready for new group!");
                    }
                    break;
                    
                case "forcelobby":
                    console.log("Command used: forcelobby.");
                    isGroupRunning = true;
                    if(message.server == undefined && checkRole(message.author.id) == true)
                    {
                        var randomnumber = Math.floor((Math.random() * 100) + 1);
                        WriteToChannel("Admin force created lobby: EMSLobby " + randomnumber);
                        CreateDotaLobby(randomnumber);
                    }
                    break;
                    
                case "forceshuffle":
                    console.log("Command used: forceshuffle.");
                    if(message.server == undefined && checkRole(message.author.id) == true){
                        Dota2.balancedShuffleLobby();
                        WriteToChannel("Admin forceshuffled the game.");
                    }
                    break;
                    
                case "ravage":
                    console.log("Command used: ravage.");
                    if(isGroupRunning == true){
                        date = new Date();
                        if(date.getTime() > lastRavage + (1000*ravagecooldown)) {
                            WriteToChannel("@here looking for more players for inhouse: " + Group.length + "/" + LobbySize + " slots taken");
                            lastRavage = date.getTime();
                        } else {
                            WriteToChannel("Ravage is still on CD for: " + Math.floor((lastRavage + (1000*ravagecooldown) - date.getTime())/1000) + " secs");
                        }
                    } else {
                        WriteToChannel("There is no group runnning");
                    }
                break;
                
                /*case "debug":
                    if(message.server == undefined && checkRole(message.author.id) == true){
                        console.log(Dota2.Lobby);
                    }
                    break;
                */
                    
                case "pick":
                    if(message.author.id == currentHoster || message.author.id == currentCaptain)
                    {
                        if(Pick == "A")
                        {
                            if(message.author.id == currentHoster && message.mentions.length >= 1)
                            {
                                if(commands.length > 1 && message.mentions.length >= 1)
                                {
                                    if(FreePlayers.indexOf(message.mentions[0].id) > -1)
                                    {
                                        TeamA.push(message.mentions[0].id);
                                        var index = FreePlayers.indexOf(message.mentions[0].id);
                                        if (index > -1) { FreePlayers.splice(index, 1); }
                                        Pick = "B";
                                        DraftStatus();
                                    }
                                } else { WriteToChannel("Usage: !pick @DiscordName"); }
                            } else { 
                                //WriteToChannel("It is Team " + Pick + " turn to pick"); 
                                
                            }
                        }
                        
                        if(Pick == "B")
                        {
                            if(message.author.id == currentCaptain && message.mentions.length >= 1)
                            {
                                if(commands.length > 1 && message.mentions.length >= 1)
                                {
                                    if(FreePlayers.indexOf(message.mentions[0].id) > -1)
                                    {
                                        TeamB.push(message.mentions[0].id);
                                        var index = FreePlayers.indexOf(message.mentions[0].id);
                                        if (index > -1) { FreePlayers.splice(index, 1); }
                                        Pick = "A";
                                        DraftStatus();
                                    }
                                } else { WriteToChannel("Usage: !pick @DiscordName"); }
                            } else { 
                               //WriteToChannel("It is Team " + Pick + " turn to pick"); 
                            }
                        }
                    } else {
                        discordbot.reply(message, "You are not drafting sir");
                    }
                break;
                
                case "captain":
                    if(checkGroup(message.author.id) && isDrafting == true && currentHoster != message.author.id && currentCaptain == "")
                    {
                        currentCaptain = message.author.id;
                        FreePlayers = Group.slice();
                        var Captainindex = FreePlayers.indexOf(currentCaptain);
                        if (Captainindex > -1) { FreePlayers.splice(Captainindex, 1); }
                        var HosterIndex = FreePlayers.indexOf(currentHoster);
                        if (HosterIndex > -1) { FreePlayers.splice(HosterIndex, 1); }
                        
                        TeamA.push(currentHoster);
                        TeamB.push(currentCaptain);
                        Pick = "A";
                        DraftStatus();
                    } else { WriteToChannel("You are not in the group or you are the current group leader") };
                break;
                
                //Default message whenever someone incorrectly types in a command
                default:
                    discordbot.reply(message, "Unknown command, use !help to find the list of commands.");
                break;
                
        }
    }
});

function ResetGlobals()
{
    isGroupRunning = false;
    currentHoster = "";
    currentCaptain = "";
    TeamA = [];
    TeamB = [];
    Group = [];
    FreePlayers = [];
}

function DraftStatus()
{
    
        var TeamAusers = [];
        var TeamBusers = [];
        var FreePlayersusers = [];
        for(var i=0, len = TeamA.length; i<len;i++)
        {
            TeamAusers.push(discordbot.users.get("id", TeamA[i]).username);
        }
        
        for(var i=0, len = TeamB.length; i<len;i++)
        {
            TeamBusers.push(discordbot.users.get("id", TeamB[i]).username);
        }
        
        for(var i=0, len = FreePlayers.length; i<len;i++)
        {
            FreePlayersusers.push(discordbot.users.get("id", FreePlayers[i]).username);
        }
        
    if(FreePlayers.length != 0)
    {
        WriteToChannel(
            "Team A: " + TeamAusers.toString() +
            "\nTeam B: " + TeamBusers.toString() + 
            "\nUnpicked: " + FreePlayersusers.toString() +
            "\nTeam " + Pick + " turn to pick!");
    } 
    if(FreePlayers.length == 0){
        WriteToChannel(
            "Draft is complete Teams are: " +
            "\nTeam A: " + TeamAusers.toString() + 
            "\nTeam B: " + TeamBusers.toString());
        var randomnumber = Math.floor((Math.random() * 100) + 1);
        isDrafting = false;
        CreateDotaLobby(randomnumber);
    }
}

function CreateDotaLobby(lobbyname)
{
    Dota2.leavePracticeLobby();
    
    var steamids = [];
    
    for(var i=0, len=Group.length; i<len;i++)
    {
        for(var y=0, len2=jsonObj.users.length; y<len2;y++)
        {
            if(jsonObj.users[y].discordid == Group[i])
            {
                steamids[i] = jsonObj.users[y].steamid;
            }
        }
    }
    
                Dota2.createPracticeLobby("EMS" + lobbyname,
                {
                    "game_name": "EMSLobby " + lobbyname,
                    "server_region": dota2.ServerRegion.EUROPE,
                    "game_mode": dota2.schema.DOTA_GameMode.DOTA_GAMEMODE_CM,
                    "series_type": 0,
                    "game_version": 1,
                    "allow_cheats": false,
                    "fill_with_bots": false,
                    "allow_spectating": true,
                    "pass_key": "EMS" + lobbyname,
                    "radiant_series_wins": 0,
                    "dire_series_wins": 0,
                    "allchat": false
                },
                function(err, body){
                    console.log(JSON.stringify(body));
                    Dota2.practiceLobbyKickFromTeam(Dota2.AccountID);
                    for(var i=0, len=steamids.length; i<len;i++)
                    {
                            Dota2.inviteToLobby(steamids[i]);
                    }
                    console.log(Dota2.Lobby);
                });

            
        
    /* Do some dota wizzardy 
    isGroupRunning = false;
    Group = [];
    WriteToChannel("Bot is ready for a new group!");*/
}
function checkSignup(id)
{
    var isSignedUp = false;
    for(var i=0, len = jsonObj.users.length; i<len;i++)
    {
        if(jsonObj.users[i].discordid == id)
        {
            isSignedUp = true;
        }
    }
    return isSignedUp;
}

function checkGroup(id)
{
    var isGrouped = false;
    for(var i=0, len = Group.length; i<len;i++)
    {
        if(Group[i] == id)
        {
            isGrouped = true;
        }
    }
    return isGrouped;
}

function checkRole(user)
{
    var isAuthed = false;
    
    var server = discordbot.servers.get("name", DiscordServerName);
    
    var authedusers = server.usersWithRole(server.roles.get("name", "Bot Wrangler"));
    
    console.log(user);
    for(var i=0, len = authedusers.length; i<len;i++)
    {
        console.log(authedusers[i].id);
        if(user == authedusers[i].id)
        {
            isAuthed = true;
        }
    }
    return isAuthed;
}

function CreateGroup(user, id)
{
    isGroupRunning = true;
    Group = [];
    WriteToChannel(user + " has created a new inhouse game! Do !join to get a slot");
    currentHoster = id;
    Group.push(id);
}

function WriteToChannel(msg)
{
    discordbot.sendMessage(discordbot.channels.get("name", "inhouseorganising"), msg);
}


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

                    }
                });
                
                Dota2.on("chatMessage", function(channel, personaName, message) {
                    Dota2.sendMessage(channel, "");
                });
            });
            Dota2.on("unready", function onUnready() {
                console.log("Node-dota2 unready.");
            });
        
            // setTimeout(function(){ Dota2.exit(); }, 5000);
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