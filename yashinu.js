const { Discord, Client, MessageEmbed } = require('discord.js');
const client = global.client = new Client({fetchAllMembers: true});
const { botOwner, botPrefix, botToken, guildID, botVoiceChannelID, inviteChannelID, durum } = require('./ayarlar.json');
const guildInvites = new Map();
const mongoose = require('mongoose');
mongoose.connect('', {useNewUrlParser: true, useUnifiedTopology: true});// Mongo connect linki
// Yashinu tarafından kodlanmıştır.

client.on("ready", async () => {
  client.user.setPresence({ activity: { name: durum }, status: "dnd" });
  let botVoiceChannel = client.channels.cache.get(botVoiceChannelID);
  if (botVoiceChannel) botVoiceChannel.join().catch(err => console.error("Bot ses kanalına bağlanamadı!"));
  client.guilds.cache.forEach(guild => {
    guild.fetchInvites().then(invites => guildInvites.set(guild.id, invites)).catch(err => console.log(err));
  });
});    
client.on("inviteCreate", async invite => guildInvites.set(invite.guild.id, await invite.guild.fetchInvites()));
client.on("inviteDelete", invite => setTimeout(async () => { guildInvites.set(invite.guild.id, await invite.guild.fetchInvites()); }, 5000));
const Database = require('./models/inviter.js');
client.on("guildMemberAdd", async member => {
  let cachedInvites = guildInvites.get(member.guild.id);
  let newInvites = await member.guild.fetchInvites();
  let usedInvite = newInvites.find(inv => cachedInvites.get(inv.code).uses < inv.uses) || cachedInvites.find(inv => !newInvites.has(inv.code)) || {code: member.guild.vanityURLCode, uses: null, inviter: {id: null}};
  let inviter = client.users.cache.get(usedInvite.inviter.id) || {id: member.guild.id};
  let isMemberFake = (Date.now() - member.user.createdTimestamp) < 7*24*60*60*1000;
  let inviteChannel = client.channels.cache.get(inviteChannelID);
  Database.findOne({ guildID: member.guild.id, userID: member.id }, (err, joinedMember) => {
    if (!joinedMember) {
      let newJoinedMember = new Database({
          _id: new mongoose.Types.ObjectId(),
          guildID: member.guild.id,
          userID: member.id,
          inviterID: inviter.id,
          regular: 0,
          bonus: 0,
          fake: 0
      });
      newJoinedMember.save();
    } else {
      joinedMember.inviterID = inviter.id;
      joinedMember.save();
    };
  });
  if (isMemberFake) {
    Database.findOne({ guildID: member.guild.id, userID: inviter.id }, (err, inviterData) => {
      if (!inviterData) {
        let newInviter = new Database({
          _id: new mongoose.Types.ObjectId(),
          guildID: member.guild.id,
          userID: inviter.id,
          inviterID: null,
          regular: 0,
          bonus: 0,
          fake: 1
        });
        newInviter.save().then(x => {
          if (inviteChannel) inviteChannel.send(`${member} katıldı! **Davet eden**: ${inviter.id == member.guild.id ? member.guild.name : inviter.tag} (**${(x.regular ? x.regular : 0)+(x.bonus ? x.bonus : 0)}** davet ❌)`).catch(err => {});
        });
      } else {
        inviterData.fake++
        inviterData.save().then(x => {
          if (inviteChannel) inviteChannel.send(`${member} katıldı! **Davet eden**: ${inviter.id == member.guild.id ? member.guild.name : inviter.tag} (**${(x.regular ? x.regular : 0)+(x.bonus ? x.bonus : 0)}** davet ❌)`).catch(err => {});
        });
      };
    });
  } else {
    Database.findOne({ guildID: member.guild.id, userID: inviter.id }, (err, inviterData) => {
        if (!inviterData) {
          let newInviter = new Database({
            _id: new mongoose.Types.ObjectId(),
            guildID: member.guild.id,
            userID: inviter.id,
            inviterID: null,
            regular: 1,
            bonus: 0,
            fake: 0
          });
          newInviter.save().then(x => {
            if (inviteChannel) inviteChannel.send(`${member} katıldı! **Davet eden**: ${inviter.id == member.guild.id ? member.guild.name : inviter.tag} (**${(x.regular ? x.regular : 0)+(x.bonus ? x.bonus : 0)}** davet ✅)`).catch(err => {});
          });
        } else {
          inviterData.regular++;
          inviterData.save().then(x => {
            if (inviteChannel) inviteChannel.send(`${member} katıldı! **Davet eden**: ${inviter.id == member.guild.id ? member.guild.name : inviter.tag} (**${(x.regular ? x.regular : 0)+(x.bonus ? x.bonus : 0)}** davet ✅)`).catch(err => {});
          });
        };
      });
  };
  guildInvites.set(member.guild.id, newInvites);
});

client.on("guildMemberRemove", async member => {
  let isMemberFake = (Date.now() - member.user.createdTimestamp) < 7*24*60*60*1000;
  let inviteChannel = client.channels.cache.get(inviteChannelID);
  Database.findOne({ guildID: member.guild.id, userID: member.id }, async (err, memberData) => {
    if (memberData && memberData.inviterID) {
      let inviter = client.users.cache.get(memberData.inviterID) || {id: member.guild.id};
      Database.findOne({ guildID: member.guild.id, userID: memberData.inviterID }, async (err, inviterData) => {
        if (!inviterData) {
         let newInviter = new Database({
            _id: new mongoose.Types.ObjectId(),
            guildID: member.guild.id,
            userID: inviter.id,
            inviterID: null,
            regular: 0,
            bonus: 0,
            fake: 0
          });
          newInviter.save();
        } else {
          if (isMemberFake) {
            if (inviterData.fake-1 >= 0) inviterData.fake--;
          } else {
            if (inviterData.regular-1 >= 0) inviterData.regular--;
          };
          inviterData.save().then(x => {
            if (inviteChannel) inviteChannel.send(`\`${member.user.tag}\` ayrıldı! ${inviter.tag ? `**Davet eden**: ${inviter.id == member.guild.id ? member.guild.name : inviter.tag} (**${(x.regular ? x.regular : 0)+(x.bonus ? x.bonus : 0)}** davet)` : `Davetçi bulunamadı!`}`).catch(err => {});
          });
        };
      });
    } else {
      if (inviteChannel) inviteChannel.send(`\`${member.user.tag}\` ayrıldı! Davetçi bulunamadı!`).catch(err => {});
    };
  });
});

client.on("message", async message => {
  if (message.author.bot || !message.guild || !message.content.toLowerCase().startsWith(botPrefix)) return;
  let args = message.content.split(' ').slice(1);
  let command = message.content.split(' ')[0].slice(botPrefix.length);

  if (command === "eval" && message.author.id === botOwner) {
    if (!args[0]) return message.channel.send(`Kod belirtilmedi`);
    let code = args.join(' ');

    function clean(text) {
      if (typeof text !== 'string') text = require('util').inspect(text, { depth: 0 })
      text = text.replace(/`/g, '`' + String.fromCharCode(8203)).replace(/@/g, '@' + String.fromCharCode(8203))
      return text;
    };
    try { 
      var evaled = clean(await eval(code));
      if(evaled.match(new RegExp(`${client.token}`, 'g'))) evaled.replace("token", "Yasaklı komut").replace(client.token, "Yasaklı komut");
      message.channel.send(`${evaled.replace(client.token, "Yasaklı komut")}`, {code: "js", split: true});
    } catch(err) { message.channel.send(err, {code: "js", split: true}) };
  };

  if (command === "davet" || command === "info" || command === "invites") {
    let uye = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
    let embed = new MessageEmbed().setAuthor(uye.displayName, uye.user.displayAvatarURL({dynamic: true})).setColor(uye.displayHexColor).setFooter(`${client.users.cache.get(botOwner).tag} was here!`).setTimestamp();
    Database.findOne({guildID: message.guild.id, userID: uye.id}, (err, inviterData) => {
      if (!inviterData) {
        embed.setDescription(`Davet bilgileri bulunmamaktadır!`);
        message.channel.send(embed);
      } else {
        Database.find({guildID: message.guild.id, inviterID: uye.id}).sort().exec((err, inviterMembers) => {
          let dailyInvites = 0;
          if (inviterMembers.length) {
            dailyInvites = inviterMembers.filter(x => message.guild.members.cache.has(x.userID) && (Date.now() - message.guild.members.cache.get(x.userID).joinedTimestamp) < 1000*60*60*24).length;
          };
          embed.setDescription(`Toplam **${inviterData.regular+inviterData.bonus}** davete sahip! (**${inviterData.regular}** gerçek, **${inviterData.bonus}** bonus, **${inviterData.fake}** fake, **${dailyInvites}** günlük)`);
          message.channel.send(embed);
        });
      };
    });
  };

  if (command === "bonus") {
    if (!message.member.hasPermission("ADMINISTRATOR")) return;
    let uye = message.mentions.members.first () || message.guild.members.cache.get(args[0]);
    let sayi = args[1];
    if (!uye || !sayi) return message.reply(`Geçerli bir üye ve sayı belirtmelisin! (${botPrefix}bonus @üye +10/-10)`);
    Database.findOne({guildID: message.guild.id, userID: uye.id}, (err, inviterData) => {
      if (!inviterData) {
        let newInviter = new Database({
          _id: new mongoose.Types.ObjectId(),
          guildID: message.guild.id,
          userID: uye.id,
          inviterID: null,
          regular: 0,
          bonus: sayi,
          fake: 0
        });
        newInviter.save().then(x => message.reply(`Belirtilen üyenin bonus daveti **${sayi}** olarak ayarlandı!`));
      } else {
        eval(`inviterData.bonus = inviterData.bonus+${Number(sayi)}`);
        inviterData.save().then(x => message.reply(`Belirtilen üyenin bonus davetine **${sayi}** eklendi!`));
      };
    });
  };

  if (command === "üyeler" || command === "members") {
    let uye = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
    let embed = new MessageEmbed().setColor(uye.displayHexColor).setAuthor(uye.displayName + " Üyeleri", uye.user.displayAvatarURL({dynamic: true})).setFooter(message.member.displayName + " tarafından istendi!", message.author.displayAvatarURL({dynamic: true})).setThumbnail().setFooter(`${client.users.cache.get(botOwner).tag} was here!`);
    let currentPage = 1;
    Database.find({guildID: message.guild.id, inviterID: uye.id}).sort([["descending"]]).exec(async (err, pageArray) => {
      pageArray = pageArray.filter(x => message.guild.members.cache.has(x.userID));
      if (err) console.log(err);
      if (!pageArray.length) {
        Database.findOne({guildID: message.guild.id, userID: uye.id}, async (err, uyeData) => {
          if (!uyeData) uyeData = {inviterID: null};
          let inviterUye = client.users.cache.get(uyeData.inviterID) || {id: message.guild.id};
          message.channel.send(embed.setDescription(`${uye} üyesini davet eden: ${inviterUye.id == message.guild.id ? message.guild.name : inviterUye.toString()}\n\nDavet ettiği üye bulunamadı!`));
        });
      } else {
        let pages = pageArray.chunk(10);
        if (!pages.length || !pages[currentPage - 1].length) return message.channel.send("Davet ettiği üye bulunamadı!");
        let msg = await message.channel.send(embed);
        let reactions = ["◀", "❌", "▶"];
        for (let reaction of reactions) await msg.react(reaction);
        Database.findOne({guildID: message.guild.id, userID: uye.id}, async (err, uyeData) => {
          let inviterUye = client.users.cache.get(uyeData.inviterID) || {id: message.guild.id};
          if (msg) await msg.edit(embed.setDescription(`${uye} üyesini davet eden: ${inviterUye.id == message.guild.id ? message.guild.name : inviterUye.toString()}\n\n${pages[currentPage - 1].map((kisi, index) => { let kisiUye = message.guild.members.cache.get(kisi.userID); return `\`${index+1}.\` ${kisiUye.toString()} | ${client.tarihHesapla(kisiUye.joinedAt)}`; }).join('\n')}`).setFooter(`Şu anki sayfa: ${currentPage}`)).catch(err => {});
        });
        const back = msg.createReactionCollector((reaction, user) => reaction.emoji.name == "◀" && user.id == message.author.id,
              { time: 20000 }),
            x = msg.createReactionCollector((reaction, user) => reaction.emoji.name == "❌" && user.id == message.author.id, 
              { time: 20000 }),
            go = msg.createReactionCollector((reaction, user) => reaction.emoji.name == "▶" && user.id == message.author.id,
              { time: 20000 });
          back.on("collect", async reaction => {
            await reaction.users.remove(message.author.id).catch(err => {});
            if (currentPage == 1) return;
            currentPage--;
            if (msg) msg.edit(embed.setDescription(`${pages[currentPage - 1].map((kisi, index) => { let kisiUye = message.guild.members.cache.get(kisi.userID); return `\`${index+1}.\` ${kisiUye.toString()} | ${client.tarihHesapla(kisiUye.joinedAt)}`; }).join('\n')}`).setFooter(`Şu anki sayfa: ${currentPage}`)).catch(err => {});
          });
          go.on("collect", async reaction => {
            await reaction.users.remove(message.author.id).catch(err => {});
            if (currentPage == pages.length) return;
            currentPage++;
            if (msg) msg.edit(embed.setDescription(`${pages[currentPage - 1].map((kisi, index) => { let kisiUye = message.guild.members.cache.get(kisi.userID); return `\`${index+1}.\` ${kisiUye.toString()} | ${client.tarihHesapla(kisiUye.joinedAt)}`; }).join('\n')}`).setFooter(`Şu anki sayfa: ${currentPage}`));
          });
          x.on("collect", async reaction => {
            await back.stop();
            await go.stop();
            await x.stop();
            if (message) message.delete().catch(err => {});
            if (msg) return msg.delete().catch(err => {});
          });
          back.on("end", async () => {
            await back.stop();
            await go.stop();
            await x.stop();
            if (message) message.delete().catch(err => {});
            if (msg) return msg.delete().catch(err => {});
          });
      };
    });
  };

  if (command === "top" || command === "sıralama") {
    let embed = new MessageEmbed().setColor(message.member.displayHexColor).setAuthor("Davet Sıralaması", message.guild.iconURL({dynamic: true})).setFooter(message.member.displayName + " tarafından istendi!", message.author.displayAvatarURL({dynamic: true})).setThumbnail().setFooter(`${client.users.cache.get(botOwner).tag} was here!`);
    let currentPage = 1;
    Database.find({guildID: message.guild.id}).sort().exec(async (err, pageArray) => {
      pageArray = pageArray.filter(x => message.guild.members.cache.has(x.userID)).sort((uye1, uye2) => ((uye2.regular ? uye2.regular : 0)+(uye2.bonus ? uye2.bonus : 0))-((uye1.regular ? uye1.regular : 0)+(uye1.bonus ? uye1.bonus : 0)));
      if (err) console.log(err);
      if (!pageArray.length) {
        message.channel.send(embed.setDescription("Davet verisi bulunamadı!"));
      } else {
        let pages = pageArray.chunk(10);
        if (!pages.length || !pages[currentPage - 1].length) return message.channel.send("Daveti olan üye bulunamadı!");
        let msg = await message.channel.send(embed);
        let reactions = ["◀", "❌", "▶"];
        for (let reaction of reactions) await msg.react(reaction);
        if (msg) await msg.edit(embed.setDescription(`${pages[currentPage - 1].map((kisi, index) => `\`${index+1}.\` ${message.guild.members.cache.get(kisi.userID).toString()} | **${kisi.regular+kisi.bonus}** davet`).join('\n')}`).setFooter(`Şu anki sayfa: ${currentPage}`));
        const back = msg.createReactionCollector((reaction, user) => reaction.emoji.name == "◀" && user.id == message.author.id,
              { time: 20000 }),
            x = msg.createReactionCollector((reaction, user) => reaction.emoji.name == "❌" && user.id == message.author.id, 
              { time: 20000 }),
            go = msg.createReactionCollector((reaction, user) => reaction.emoji.name == "▶" && user.id == message.author.id,
              { time: 20000 });
          back.on("collect", async reaction => {
          await reaction.users.remove(message.author.id).catch(err => {});
          if (currentPage == 1) return;
            currentPage--;
            if (msg) msg.edit(embed.setDescription(`${pages[currentPage - 1].map((kisi, index) => `\`${index+1}.\` ${message.guild.members.cache.get(kisi.userID).toString()} | **${kisi.regular+kisi.bonus}** davet`).join('\n')}`).setFooter(`Şu anki sayfa: ${currentPage}`));
          });
          go.on("collect", async reaction => {
            await reaction.users.remove(message.author.id).catch(err => {});
              if (currentPage == pages.length) return;
              currentPage++;
              if (msg) msg.edit(embed.setDescription(`${pages[currentPage - 1].map((kisi, index) => `\`${index+1}.\` ${message.guild.members.cache.get(kisi.userID).toString()} | **${kisi.regular+kisi.bonus}** davet`).join('\n')}`).setFooter(`Şu anki sayfa: ${currentPage}`));
          });
          x.on("collect", async reaction => {
            await back.stop();
            await go.stop();
            await x.stop();
            if (message) message.delete().catch(err => {});
            if (msg) return msg.delete().catch(err => {});
          });
          back.on("end", async () => {
            await back.stop();
            await go.stop();
            await x.stop();
            if (message) message.delete().catch(err => {});
            if (msg) return msg.delete().catch(err => {});
          });
      };
    });
  };
});
client.tarihHesapla = (date) => {
  const startedAt = Date.parse(date);
  var msecs = Math.abs(new Date() - startedAt);

  const years = Math.floor(msecs / (1000 * 60 * 60 * 24 * 365));
  msecs -= years * 1000 * 60 * 60 * 24 * 365;
  const months = Math.floor(msecs / (1000 * 60 * 60 * 24 * 30));
  msecs -= months * 1000 * 60 * 60 * 24 * 30;
  const weeks = Math.floor(msecs / (1000 * 60 * 60 * 24 * 7));
  msecs -= weeks * 1000 * 60 * 60 * 24 * 7;
  const days = Math.floor(msecs / (1000 * 60 * 60 * 24));
  msecs -= days * 1000 * 60 * 60 * 24;
  const hours = Math.floor(msecs / (1000 * 60 * 60));
  msecs -= hours * 1000 * 60 * 60;
  const mins = Math.floor((msecs / (1000 * 60)));
  msecs -= mins * 1000 * 60;
  const secs = Math.floor(msecs / 1000);
  msecs -= secs * 1000;

  var string = "";
  if (years > 0) string += `${years} yıl ${months} ay`
  else if (months > 0) string += `${months} ay ${weeks > 0 ? weeks+" hafta" : ""}`
  else if (weeks > 0) string += `${weeks} hafta ${days > 0 ? days+" gün" : ""}`
  else if (days > 0) string += `${days} gün ${hours > 0 ? hours+" saat" : ""}`
  else if (hours > 0) string += `${hours} saat ${mins > 0 ? mins+" dakika" : ""}`
  else if (mins > 0) string += `${mins} dakika ${secs > 0 ? secs+" saniye" : ""}`
  else if (secs > 0) string += `${secs} saniye`
  else string += `saniyeler`;

  string = string.trim();
  return `\`${string} önce\``;
};

Array.prototype.chunk = function(chunk_size) {
  let myArray = Array.from(this);
  let tempArray = [];
  for (let index = 0; index < myArray.length; index += chunk_size) {
    let chunk = myArray.slice(index, index + chunk_size);
    tempArray.push(chunk);
  }
  return tempArray;
};

client.login(botToken).then(c => console.log(`${client.user.tag} olarak giriş yapıldı!`)).catch(err => console.error("Bota giriş yapılırken başarısız olundu!"));
