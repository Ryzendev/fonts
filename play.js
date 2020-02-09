const ytdlDiscord = require("ytdl-core-discord");
const ytdl = require('ytdl-core');
module.exports = {
  async play(song, message) {
    const queue = message.client.queue.get(message.guild.id);

    if (!song) {
      //queue.channel.leave();
      message.client.queue.delete(message.guild.id);
      return;
    }

    try {
      var stream = await ytdlDiscord(song.url, { filter: "audioonly", quality: "highestaudio" });
    } catch (error) {
      if (queue) {
        queue.songs.shift();
        module.exports.play(queue.songs[0], message);
      }

      if (error.message.includes("copyright")) {
        return message.channel.send("⛔ A video could not be played due to copyright protection ⛔")
          .catch(console.error);
      } else {
        console.error(error);
      }
    }

    const dispatcher = queue.connection.play(ytdl(song.url, { filter: "audioonly"}),  { type: "opus", passes: 3 })
      .on("end", () => {
        if (queue.loop) {
      
          let lastSong = queue.songs.shift();
          queue.songs.push(lastSong);
          module.exports.play(queue.songs[0], message);
        } else {
          queue.songs.shift();
          module.exports.play(queue.songs[0], message);
        }
      })
      .on("error", console.error);
    dispatcher.setVolumeLogarithmic(queue.volume / 100);

    try {
      var playingMessage = await queue.textChannel.send(`🎶 Started playing: **${song.title}** `);
      await playingMessage.react("⏭");
      await playingMessage.react("⏸");
      await playingMessage.react("▶");
      await playingMessage.react("⏹");
    } catch (error) {
      console.error(error);
    }

    const filter = (reaction, user) => user.id === message.author.id;
    const collector = playingMessage.createReactionCollector(filter, { time: 1800000 });

    collector.on("collect", (reaction, user) => {
      if (!queue) return;

      switch (reaction.emoji.name) {
        case "⏭":
          queue.connection.dispatcher.end();
          queue.textChannel.send(`${user} ⏩ skipped the song`).catch(console.error);
          collector.stop();
          playingMessage.reactions.removeAll();
          break;

        case "⏸":
          if (!queue.playing) break;
          queue.playing = false;
          queue.connection.dispatcher.pause();
          queue.textChannel.send(`${user} ⏸ paused the music.`).catch(console.error);
          break;

        case "▶":
          if (queue.playing) break;
          queue.playing = true;
          queue.connection.dispatcher.resume();
          queue.textChannel.send(`${user} ▶ resumed the music!`).catch(console.error);
          break;

        case "⏹":
          queue.songs = [];
          queue.connection.dispatcher.end();
          queue.textChannel.send(`${user} ⏹ stopped the music!`).catch(console.error);
          collector.stop();
          playingMessage.reactions.removeAll();
          break;

        default:
          break;
      }
    });

    collector.on("end", () => {
      playingMessage.reactions.removeAll();
    });
  }
};
