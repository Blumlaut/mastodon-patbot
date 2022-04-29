const Mastodon = require('mastodon-api'); // Mastodon API
const petPetGif = require('pet-pet-gif')
const fs = require('fs');

const readline = require("readline");
require("dotenv").config()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', (input) => {
    eval(input) // execute code entered in terminal, allows us to use addtoqueue function to manually add posts that may have been msised
});

conf = {
    client_key: process.env.CLIENT_KEY, // The keys are store in the .env file
    client_secret: process.env.CLIENT_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    //timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests
    api_url: process.env.API_URL, // Mastodon API related to the botsin.space instance
}

const M = new Mastodon(conf)
const stream = M.stream('streaming/user')

var queue = []

stream.on('message', async(response) => { // TODO: figure out why this doesnt trigger for the first notification
    if (response.event === 'notification' && response.data.type === 'mention') {
        queue.push(response.data.status)
        console.log(`added ${response.data.account.acct} to queue, current queue length: ${queue.length}`)
    }
})


async function addtoqueue(msgid) {
    if (!msgid) {return}
    M.get('statuses/'+msgid).then(response => {
        queue.push(response.data)
        console.log(`added ${response.data.account.acct} to queue, current queue length: ${queue.length}`)
    })

}

async function loopQueue() {
    var data = queue.shift()

    if(!data) {return}

    var loweredContent = data.content.toLowerCase().replace(/patbot/g, "bot") // TODO: make this less bad

    if ((loweredContent.search(/please|plz|pls/g) != -1)|| (loweredContent.search(/p[ae]t/g) != -1)) {
        var animatedGif = undefined

        var replyMentions = `@${data.account.acct}`


        if (data.mentions.length > 1) {
            var mention = data.mentions[data.mentions.length - 1]
            console.log("getting account data..")
            var result = await M.get('accounts/'+mention.id)
            var account = result.data

            if (account.bot) {
                console.log("account is a bot. bailing.")
            } else {
                animatedGif = await petPetGif(account.avatar)
    
                replyMentions += ` @${account.acct}`
                console.log("done checking mentions")
            }
        }

        if (!animatedGif) {
            animatedGif = await petPetGif(data.account.avatar)
        }

        // TODO: figure out why converting the buffer to a streamable does not get accepted by mastodon
        await fs.writeFileSync(`tmp/${data.id}.gif`, animatedGif, 'binary');
        const readable = fs.createReadStream(`tmp/${data.id}.gif`);

        M.post('media', { file: readable }).then(resp => {
            const id = resp.data.id;
            M.post('statuses', { in_reply_to_id: data.id, status: `${replyMentions} patpat`, media_ids: [id], visibility: "unlisted" })

            // see earlier todo
            fs.unlinkSync(`tmp/${data.id}.gif`)
            
        });
    }
    console.log(`processed ${data.account.acct}'s request. current queue: ${queue.length}`)
}

setInterval(loopQueue, 5000);