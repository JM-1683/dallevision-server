//This will "archive" whatever is in ./images/current into a directory hierarchy built from today's date.

const fs = require('fs').promises;
const path = require('path');
const { commitToTable } = require('./sql');

//Images for each generation are placed in ./images/current.
//If the server stops running before a full triplet (story, image, and corresponding prompt) is generated,
//archiveBroadcast() will search for three files but there will be less than three. In this case, to prevent errors,
//all files in the directory will be deleted if a triplet from the previous generation doesn't exist.
const directoryCheck = async (directory) => {
    try {
        const files = await fs.readdir(directory);
        if (files.length < 3) {
            for (const file of files) {
                await fs.unlink(path.join(directory, file))
            }
        }
    } catch (err) {
        console.log(err);
    }
}

//A delay function, taking one argument, an amount of milliseconds
/*const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}*/

//This grabs the preceding number from a filename passed to it and returns the number.
//This is used to determine what number should come next when contents in ./images/current
//are archived.
const grabFileNumber = (file) => {
    const match = file.match(/^(\d+)/);
    if (match) {
        const number = parseInt(match[1], 10);
        return number;
    } else {
        console.log("Error grabbing number from filename.")
    }
}


//Moves file from source to destination. Simple enough
const moveFile = async (source, destination) => {
    try {
        await fs.rename(source, destination);
    } catch (error) {
        console.error('An error occurred:', error);
        throw error;  // Propagate the error up.
    }
}

const existCheck = async (dir, retries = 10, delayDuration = 5000) => {
    try {
        console.log("CHECKING .....");
        const state = await fs.stat(dir);
        console.log("Looks good, file located");
    } catch (err) {
        if (retries > 0) {
            console.log("Doesn't yet exist, retrying...");
            setTimeout(() => existCheck(dir, retries - 1, delayDuration), delayDuration);
        } else {
            console.log("Max retries reached. Stopping check.");
        }
    }
}

//Returns a count of files in a given directory.
const countDirectoryFiles = async (dirPath) => {
    try {
        const items = await fs.readdir(dirPath);
        let fileCount = 0;
        for (const item of items) {
            const stats = await fs.stat(path.join(dirPath, item));
            if (stats.isFile()) {
                fileCount++;
            }
        }
        return fileCount;
    } catch (err) {
        console.log(err);
    }
}

//The main archiving function.
const archiveBroadcast = async (connection) => {
    try {

        //Variables created from today's date, used then to create directory variables.
        //Everything's recalculated in this function's call to prevent situations where
        //generation periods carried over after midnight are placed in the proper day's
        //directory and not yesterday's
        const date = new Date();
        const MM = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
        const DD = String(date.getDate()).padStart(2, '0');
        const YYYY = date.getFullYear();
        const yearDir = `./images/${YYYY}`;
        const monthDir = `${yearDir}/${MM}`;
        const dayDir = `${monthDir}/${DD}`;
        const fullDir = `./images/${YYYY}/${MM}/${DD}/`;

        //First, a check is done to see if there's anything present in ./images/current.
        //If there is, then the archive procedures happen
        if (await countDirectoryFiles('./images/current/') != 0) {

            // A directory hierarchy of ./images/YEAR/MONTH/DAY is created if it doesn't yet exist
            await fs.mkdir(dayDir, { recursive: true });

            //if the created directory is empty, fileNumber is set to `1`, and every file in ./images/current
            //has `1_` appended to it. If there are already files in the day's created directory, then the
            //directory is read, and the last filename's first character (which will always be the most recent number)
            //will be read. This is then incrememnted by one, and the resulting number is appended to the start of the
            //files in ./images/current.
            let fileNumber;
            const directoryCount = await countDirectoryFiles(fullDir);
            if (directoryCount == 0) {
                fileNumber = 1;
            } else {
                let items = await fs.readdir(fullDir); //Reads the contents of the day's directory
                //Sorting the files. Filenumbers
                const fileNumbers = items.reduce((acc, file) => {
                    acc[file] = grabFileNumber(file);
                    return acc;
                }, {});
                items.sort((a, b) => fileNumbers[a] - fileNumbers[b]);
                let lastItem = items[items.length - 1];
                fileNumber = grabFileNumber(lastItem) + 1;
                console.log(items);
            }

            //The filenames are created from the final directory, the file number, and their corresponding suffix.
            const pictureName = fullDir + fileNumber.toString() + "_.jpg";
            const promptName = fullDir + fileNumber.toString() + "_prompt.txt";
            const storyName = fullDir + fileNumber.toString() + "_story.txt";

            //The files are then moved from ./images/current to their respective directories.
            await moveFile('./images/current/current.jpg', pictureName);
            await moveFile('./images/current/currentPrompt.txt', promptName);
            await moveFile('./images/current/currentStory.txt', storyName);

            //await delay(150);//There was an error where the final moveFile was hanging, and the next line (which reads
            //the contents of the moved file) would return undefined as the file hadn't completed 'moving' despite the await function
            //completing. A delay of 150 ms seems to fix this issue. 

            //replaced with the rudimentary existCheck function
            existCheck(pictureName);
            existCheck(promptName);
            existCheck(storyName);

            //All data is then gathered from the prompt file and the story file. In addition,
            //and ID is generated, which is really just the YYYYMMDD_fileNumber.



            const promptToDB = await fs.readFile(promptName, 'utf-8');
            const storyToDB = await fs.readFile(storyName, 'utf-8');
            const ID = `${YYYY}${MM}${DD}_${fileNumber}`;

            //All of that is then committed to the database.
            const tableOutput = {
                imageTerms: promptToDB,
                story: storyToDB,
                ID: ID
            };
            await commitToTable(connection, tableOutput);
        } else {
            console.log("No need to archive; 'current' directory empty."); //None of the above needs to run if ./images/current is empty.
        }
    } catch (err) {
        console.log(err);
    }

    //const date = readCreateDate('./images/current/current.jpg');
    //console.log(date);
}

module.exports = {
    archiveBroadcast, countDirectoryFiles, grabFileNumber,
    directoryCheck
}