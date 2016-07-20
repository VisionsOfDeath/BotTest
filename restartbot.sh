#!/bin/sh
ssh -t wigumen@ts.shittyplayer.com "killall nodejs; killall supervise; cd /home/wigumen/topbot/; screen nodejs bot.js"