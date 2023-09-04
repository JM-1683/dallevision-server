//Another carryover from when lists were used. Technically, only the list of art styles is used (stylesFantasy.txt),
//which is fed into this and an object is made.
//This will take stylesFantasy and create an array of all the art styles listed, which is then picked from at random later on.

const readline = require('readline');
const fs = require('fs');

const buildList = async (inputFile) => {
    try {
        const readInterface = readline.createInterface({
            input: fs.createReadStream(inputFile),
            console: false,
        });

        let listObject = [];

        for await (const line of readInterface) {
            listObject.push(line);
        }

        return listObject;
    } catch (err) {
        console.log("Error while building list: " + err);
    }
}

module.exports.buildList = buildList;