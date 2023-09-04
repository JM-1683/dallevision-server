//Back when wordlists were used to construct prompts at random, lists of words from certain topics would
//be generated from ChatGPT (such lists can be seen in ./lists/). Because those lists were usually separated
//with commas, this script will format the list so there's only one word on each line. The script was run locally,
//hence the calling of processFile() at the end. At some point the usage of lists may return, so this will be kept here.
//Future implementation would see processFile taking arguments for directories, changing all fs.functionSync to their
//asynchronous alternatives, etc

const fs = require('fs').promises;

const processFile = async () => {
    const filePath = './lists/test.txt';

    try {
        const fileContents = await fs.readFile(filePath, 'utf8');
        const formattedContents = fileContents.replace(/, /g, '\n');

        await fs.writeFile(filePath, formattedContents);
        console.log('File processed successfully');
    } catch (error) {
        console.log('Error processing the file:', error);
    }
}

processFile();