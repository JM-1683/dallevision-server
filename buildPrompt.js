/* buildPrompt does a few things:

1. Asks ChatGPT to generate a picture description similar to the litany of like prompts in prompt.txt
2. Generates the prompt
3. Generates a story to go along with that prompt
4. Commits all of the resulting data to currentPrompt.txt and currentStory.txt in ./images/current

*/

const fs = require('fs');
const OpenAI = require('openai');
const { Random, MersenneTwister19937 } = require('random-js'); //used for random number generation that's more random than Math.random()
const { buildList } = require('./buildListObject');
const { getApiKey } = require('./getApiKey');


//defines the seed using the Mersenne Twister PRNG
const random = new Random(MersenneTwister19937.autoSeed());

//Will return a random element of whatever array is passed to it,
//using again the Merseene Twister PRNG

//Submits `prompt` to ChatGPT
const askGPT = async (prompt) => {
    try {

        const Key = await getApiKey();
        const openai = new OpenAI({
            apiKey: Key
        });

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-3.5-turbo',
        });
        const results = completion.choices[0].message.content;
        return results;
    } catch (error) {
        console.error("Error with OpenAI request:", error);
        return null;
    }
}

//The prompt builder.
const buildPrompt = async () => {
    try {
        //read the prompt from ./prompt.txt into a var and feed it into askGPT()
        //the result of the prompt is *ideally* a set of prompts formatted for Dalle
        const gptPrompt = fs.readFileSync('./prompt.txt', { encoding: 'utf8', flag: 'r' });
        let finalPrompt = await askGPT(gptPrompt);
        let storyTerms = finalPrompt;

        //buildListObject is called to build an array of Art Styles
        const styles = await buildList('./lists/stylesFantasy.txt');

        //The art style is appended at the end of the Dalle generation terms, but not always;
        //wildcard is a random number between 1 and 6, and if it's between 1 and 3,
        //a random art style will be used with the Dalle generation
        let wildCard = random.integer(1, parseInt(6));
        let randStylePicker = random.integer(0, styles.length);
        let style = "";
        if (wildCard <= 3) {
            style = styles[randStylePicker];
            finalPrompt += ", " + style + " style";
        }
        finalPrompt = finalPrompt.replace('.', '');

        //using the same terms but without the art style, ChatGPT is asked to build a short story
        //using the terms in storyTerms, which is really just the prompt without the art style attached.
        //Otherwise, you get stories about dragons terrorizing Cubist villages or chests of Dadaist treasure.
        //./storyPrompt.txt contains the rules for story generation ChatGPT is expected to follow
        const storyPrompt = fs.readFileSync('./storyPrompt.txt', { encoding: 'utf8', flag: 'r' });
        let storyPromptFinal = storyPrompt + storyTerms;
        storyPromptFinal = storyPromptFinal.replace('"', '');
        const finalStory = await askGPT(storyPromptFinal);
        fs.writeFileSync('./images/current/currentStory.txt', finalStory);

        //the story is written to 
        fs.writeFileSync('./images/current/currentPrompt.txt', finalPrompt);
        //console.log("Final prompt: " + finalPrompt);
        //the finalPrompt is returned for use by buildImages.js
        return finalPrompt;
    } catch (err) {
        console.log(err);
    }
}

module.exports.buildPrompt = buildPrompt;
